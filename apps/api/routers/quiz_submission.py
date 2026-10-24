"""Quiz submission endpoints: submit answers, list problems, mastery history."""

from services.assessment_evidence import active_result_clause, active_wrong_clause
import logging
import uuid

logger = logging.getLogger(__name__)

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session, get_db
from models.course import Course
from models.practice import PracticeProblem, PracticeResult
from models.user import User
from schemas.quiz import (
    AnswerResponse,
    MasterySnapshotResponse,
    ProblemResponse,
    SubmitAnswerRequest,
    ReviewAnswerRequest,
    RevealAnswerResponse,
)
from services.auth.dependency import get_current_user
from services.course_access import get_course_or_404
from sqlalchemy.exc import SQLAlchemyError

from libs.exceptions import NotFoundError

router = APIRouter()


@router.get("/{course_id}", response_model=list[ProblemResponse], summary="List practice problems", description="Return paginated practice problems for a course, excluding diagnostics.")
async def list_problems(
    course_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user-facing practice problems for a course."""
    await get_course_or_404(db, course_id, user_id=user.id)

    result = await db.execute(
        select(PracticeProblem)
        .where(PracticeProblem.course_id == course_id)
        .where(PracticeProblem.is_diagnostic == False)
        .where(PracticeProblem.is_archived == False)
        .order_by(PracticeProblem.order_index)
        .offset(offset)
        .limit(limit)
    )
    problems = result.scalars().all()
    from services.answer_reveal import viewed_problem_ids
    viewed = await viewed_problem_ids(db, user.id, course_id, [problem.id for problem in problems])
    return [ProblemResponse.model_validate(problem).model_copy(update={
        'answer_viewed':str(problem.id) in viewed}) for problem in problems]


async def _auto_derive_diagnostic(wrong_answer_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Background task: auto-generate a diagnostic pair for a wrong answer."""
    try:
        async with async_session() as db:
            from models.ingestion import WrongAnswer
            from models.practice import PracticeProblem as PP
            result = await db.execute(
                select(WrongAnswer, PP)
                .join(PP, WrongAnswer.problem_id == PP.id)
                .where(WrongAnswer.id == wrong_answer_id, active_wrong_clause(), WrongAnswer.user_id == user_id)
            )
            row = result.one_or_none()
            if not row:
                return
            wa, problem = row
            # Skip if diagnostic pair already exists
            existing = await db.execute(
                select(PP.id).where(PP.parent_problem_id == problem.id, PP.is_diagnostic == True)
            )
            if existing.scalar_one_or_none():
                return
            if problem.is_diagnostic or (problem.difficulty_layer and problem.difficulty_layer < 2):
                return

            from services.diagnosis.derive import derive_diagnostic
            await derive_diagnostic(db, wa, problem)
            await db.commit()
            logger.info("Auto-generated diagnostic pair for wrong answer %s", wrong_answer_id)
    except (SQLAlchemyError, ValueError, KeyError, TypeError):
        logger.exception("Auto-derive diagnostic failed (best-effort)")


async def _check_effective_review(
    problem_id: uuid.UUID, course_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Background: if user previously got this problem wrong, record effective_review signal."""
    try:
        async with async_session() as db:
            prev_wrong = await db.execute(
                select(PracticeResult.id).where(
                    PracticeResult.problem_id == problem_id,
                    active_result_clause(), PracticeResult.user_id == user_id,
                    PracticeResult.is_correct == False,  # noqa: E712
                ).limit(1)
            )
            if prev_wrong.scalar_one_or_none() is None:
                return  # No prior wrong answer — not an improvement
            from services.block_decision.preference import record_block_event
            await record_block_event(db, user_id, course_id, "review", "effective_review")
            await db.commit()
            logger.info("Recorded effective_review signal for problem %s", problem_id)
    except (SQLAlchemyError, ValueError, ImportError):
        logger.exception("Effective review check failed (best-effort)")


async def _auto_detect_confusion(course_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Background task: detect confusion pairs from accumulated wrong answers."""
    try:
        async with async_session() as db:
            from services.loom_confusion import detect_confusion_pairs
            await detect_confusion_pairs(db, course_id, user_id, min_occurrences=1)
            await db.commit()
    except (SQLAlchemyError, ValueError, KeyError):
        logger.exception("Auto confusion detection failed (best-effort)")


@router.post("/submit", response_model=AnswerResponse, summary="Submit a quiz answer", description="Grade a practice answer, classify errors, and update mastery tracking.")
async def submit_answer(
    body: SubmitAnswerRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from services.grading_sessions import submit
    return await submit(db, user.id, body)


@router.post("/attempts/{attempt_id}/review", response_model=AnswerResponse)
async def review_answer(attempt_id: uuid.UUID, body: ReviewAnswerRequest,
                        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from services.grading_sessions import review
    return await review(db, user.id, attempt_id, body)


@router.get("/attempts/problem/{problem_id}")
async def get_latest_attempt(problem_id: uuid.UUID,
                             user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from services.grading_sessions import latest_attempt
    return await latest_attempt(db, user.id, problem_id)


@router.get("/{course_id}/attempts")
async def get_course_attempts(course_id: uuid.UUID, user: User = Depends(get_current_user),
                               db: AsyncSession = Depends(get_db)):
    from services.grading_sessions import course_attempts
    return await course_attempts(db,user.id,course_id)


@router.get("/{course_id}/mastery-history", response_model=list[MasterySnapshotResponse], summary="Get mastery history", description="Return mastery score time-series for analytics charts.")
async def mastery_history(
    course_id: uuid.UUID,
    content_node_id: uuid.UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return mastery score time-series for analytics charts."""
    from models.mastery_snapshot import MasterySnapshot

    await get_course_or_404(db, course_id, user_id=user.id)

    query = (
        select(MasterySnapshot)
        .where(
            MasterySnapshot.user_id == user.id,
            MasterySnapshot.course_id == course_id,
        )
        .order_by(MasterySnapshot.recorded_at.desc())
        .limit(limit)
    )
    if content_node_id:
        query = query.where(MasterySnapshot.content_node_id == content_node_id)

    result = await db.execute(query)
    snapshots = result.scalars().all()

    return [
        MasterySnapshotResponse(
            mastery_score=s.mastery_score,
            gap_type=s.gap_type,
            content_node_id=str(s.content_node_id) if s.content_node_id else None,
            recorded_at=s.recorded_at,
        )
        for s in reversed(snapshots)
    ]


@router.post('/problems/{problem_id}/reveal', response_model=RevealAnswerResponse)
async def reveal_problem_answer(problem_id: uuid.UUID,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from services.answer_reveal import reveal_answer
    return await reveal_answer(db, user.id, problem_id)
