"""Persistent, source-grounded Socratic and Feynman lessons."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from services.auth.dependency import get_current_user
from services.agent.guided_learning import get_record, lesson_action, public_state, source_context

from services.teaching_feedback import FeedbackInput, list_reports, save_report

router = APIRouter()


class LessonAction(BaseModel):
    action: Literal['start', 'answer', 'hint', 'explain', 'restart', 'undo', 'continue', 'review_basics']
    answer: str = Field(default='', max_length=6000)
    revision: int = Field(default=0, ge=0)
    action_id: uuid.UUID
    locale: Literal['zh', 'en'] = 'zh'


@router.get('/{course_id}/{node_id}')
async def load_lesson(course_id: uuid.UUID, node_id: uuid.UUID,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    context = await source_context(db, user.id, course_id, node_id)
    record = await get_record(db, user.id, course_id, node_id)
    return {'lesson': public_state(record.value_json) if record else None,
            'source_changed': bool(record and record.value_json.get('fingerprint') != context['fingerprint'])}


@router.post('/{course_id}/{node_id}')
async def act_on_lesson(course_id: uuid.UUID, node_id: uuid.UUID, body: LessonAction,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await lesson_action(db, user.id, course_id, node_id, body.action, body.answer,
        body.revision, body.action_id, body.locale)


@router.get('/{course_id}/{node_id}/reports')
async def load_reports(course_id: uuid.UUID, node_id: uuid.UUID,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await list_reports(db, user.id, course_id, node_id)


@router.post('/{course_id}/{node_id}/reports')
async def report_teaching(course_id: uuid.UUID, node_id: uuid.UUID, body: FeedbackInput,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await save_report(db, user.id, course_id, node_id, body)


@router.get('/{course_id}/{node_id}/summary-status')
async def load_chapter_summary_status(course_id: uuid.UUID, node_id: uuid.UUID,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from services.chapter_summary import chapter_summary_status
    return await chapter_summary_status(db, user.id, course_id, node_id)
