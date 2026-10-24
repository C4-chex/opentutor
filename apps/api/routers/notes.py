"""AI Notes restructuring endpoint."""

import logging
import uuid

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends
from libs.exceptions import AppError, NotFoundError, reraise_as_app_error
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.content import CourseContentTree
from models.user import User
from services.auth.dependency import get_current_user
from services.course_access import get_course_or_404
from services.llm.readiness import ensure_llm_ready
from services.parser.notes import restructure_notes
from services.preference.engine import resolve_preferences

router = APIRouter()


class RestructureRequest(BaseModel):
    content_node_id: uuid.UUID
    format_override: str | None = None  # Override user preference


class RestructureResponse(BaseModel):
    original_title: str
    ai_content: str
    format_used: str


class SaveGeneratedNotesRequest(BaseModel):
    course_id: uuid.UUID
    title: str
    markdown: str
    source_node_id: uuid.UUID | None = None
    replace_batch_id: uuid.UUID | None = None


@router.post("/restructure", response_model=RestructureResponse, summary="Restructure content node", description="Restructure a content node into AI-formatted notes based on user preferences.")
async def restructure_content(body: RestructureRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Restructure a content node based on user preferences."""
    result = await db.execute(
        select(CourseContentTree).where(CourseContentTree.id == body.content_node_id)
    )
    node = result.scalar_one_or_none()
    if not node or not node.content:
        raise NotFoundError(resource="content_node", resource_id=str(body.content_node_id))

    # Verify course ownership
    await get_course_or_404(db, node.course_id, user_id=user.id)

    # Get user preferences
    resolved = await resolve_preferences(db, user.id, node.course_id)

    note_format = body.format_override or resolved.preferences.get("note_format", "bullet_point")
    visual_pref = resolved.preferences.get("visual_preference", "auto")

    await ensure_llm_ready("Notes restructuring")
    try:
        ai_content = await restructure_notes(
            node.content, node.title, note_format, visual_pref
        )
    except (ConnectionError, TimeoutError, ValueError, KeyError, RuntimeError) as exc:
        reraise_as_app_error(exc, "Notes restructuring failed")
    except SQLAlchemyError as exc:
        reraise_as_app_error(exc, "Notes restructuring failed")

    return RestructureResponse(
        original_title=node.title,
        ai_content=ai_content,
        format_used=note_format,
    )


@router.post("/generated/save", summary="Save generated notes", description="Persist AI-generated notes as a versioned asset for a course.")
async def save_generated_notes(
    body: SaveGeneratedNotesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_course_or_404(db, body.course_id, user_id=user.id)

    from services.generated_assets import save_generated_asset

    try:
        result = await save_generated_asset(
            db,
            user_id=user.id,
            course_id=body.course_id,
            asset_type="notes",
            title=body.title,
            content={"markdown": body.markdown},
            metadata={"source_node_id": str(body.source_node_id) if body.source_node_id else None},
            replace_batch_id=body.replace_batch_id,
        )
    except ValueError as exc:
        raise NotFoundError(resource="generated_asset", resource_id=str(body.replace_batch_id)) from exc

    await db.commit()

    # Emit standardized learning event for analytics + plugin hooks
    try:
        from services.analytics.events import emit_learning_event, LearningEventData
        await emit_learning_event(db, LearningEventData(
            user_id=user.id,
            verb="created",
            object_type="note",
            object_id=result.get("batch_id") or str(body.course_id),
            course_id=body.course_id,
            context_json={"title": body.title, "source_node_id": str(body.source_node_id) if body.source_node_id else None},
        ))
        await db.commit()
    except (SQLAlchemyError, ValueError, TypeError):
        logger.exception("Notes learning event emission failed (best-effort)")

    return result


@router.get("/generated/{course_id}/by-node/{node_id}", summary="Get note for content node", description="Return the auto-generated AI note for a specific content node.")
async def get_generated_note_for_node(
    course_id: uuid.UUID,
    node_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get auto-generated AI note for a specific content node."""
    await get_course_or_404(db, course_id, user_id=user.id)

    from models.generated_asset import GeneratedAsset
    result = await db.execute(
        select(GeneratedAsset)
        .where(
            GeneratedAsset.user_id == user.id,
            GeneratedAsset.course_id == course_id,
            GeneratedAsset.asset_type == "notes",
            GeneratedAsset.is_archived == False,
        )
        .order_by(GeneratedAsset.version.desc())
    )
    assets = result.scalars().all()
    for asset in assets:
        meta = asset.metadata_ or {}
        if meta.get("source_node_id") == str(node_id):
            return {
                "id": str(asset.id),
                "title": asset.title,
                "markdown": asset.content.get("markdown", "") if asset.content else "",
                "format": (meta.get("format") or "bullet_point"),
                "auto_generated": meta.get("auto_generated", False),
                "version": asset.version,
            }
    return None


@router.get("/generated/{course_id}", summary="List generated notes", description="Return all saved AI-generated note batches for a course.")
async def list_generated_notes(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_course_or_404(db, course_id, user_id=user.id)

    from services.generated_assets import list_generated_asset_batches

    return await list_generated_asset_batches(
        db,
        user_id=user.id,
        course_id=course_id,
        asset_type="notes",
    )


# Editable classroom notebooks are separate from generated source summaries.
from services.classroom_notes import (
    SaveNotebook, OutlineRequest, load_notebook, save_notebook, list_notebooks, outline_notebook,
)


@router.get('/classroom/{course_id}')
async def list_classroom_notes(course_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await list_notebooks(db, user.id, course_id)


@router.get('/classroom/{course_id}/{node_id}')
async def get_classroom_notes(course_id: uuid.UUID, node_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await load_notebook(db, user.id, course_id, node_id)


@router.put('/classroom/{course_id}/{node_id}')
async def put_classroom_notes(course_id: uuid.UUID, node_id: uuid.UUID, body: SaveNotebook,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await save_notebook(db, user.id, course_id, node_id, body)


@router.post('/classroom/{course_id}/{node_id}/outline')
async def outline_classroom_notes(course_id: uuid.UUID, node_id: uuid.UUID, body: OutlineRequest,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await outline_notebook(db, user.id, course_id, node_id, body)

# Local Obsidian vault integration. Static settings paths precede UUID routes.
from services import obsidian_notes as obsidian

@router.get('/obsidian/settings')
async def get_obsidian_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await obsidian.get_config(db, user.id)

@router.put('/obsidian/settings')
async def put_obsidian_settings(body: obsidian.VaultSettings, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await obsidian.set_config(db, user.id, body)

@router.get('/obsidian/{course_id}/{node_id}')
async def preview_obsidian_note(course_id: uuid.UUID, node_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await obsidian.inspect_note(db, user.id, course_id, node_id)

@router.post('/obsidian/{course_id}/{node_id}/export')
async def export_obsidian_note(course_id: uuid.UUID, node_id: uuid.UUID, body: obsidian.NoteRevision, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await obsidian.export_note(db, user.id, course_id, node_id, body)

@router.post('/obsidian/{course_id}/{node_id}/import')
async def import_obsidian_note(course_id: uuid.UUID, node_id: uuid.UUID, body: obsidian.ImportNote, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await obsidian.import_note(db, user.id, course_id, node_id, body)
