"""Chat router helper functions — session management, persistence, serialization.

Extracted from chat.py to keep route handlers concise.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from libs.exceptions import NotFoundError
from models.chat_message import ChatMessageLog
from models.chat_session import ChatSession
from utils.serializers import serialize_model


def build_session_title(message: str) -> str:
    """Build a human-friendly title from the first user message."""
    normalized = " ".join(message.strip().split())
    if not normalized:
        return "New Chat"
    return normalized[:77] + "..." if len(normalized) > 80 else normalized


async def resolve_chat_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    course_id: uuid.UUID,
    scene_id: str | None,
    message: str,
    session_id: uuid.UUID | None,
) -> ChatSession:
    """Find an existing chat session or create a new one."""
    if session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
                ChatSession.course_id == course_id,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundError("Chat session", session_id)
        if scene_id and session.scene_id != scene_id:
            session.scene_id = scene_id
        if not session.title:
            session.title = build_session_title(message)
        await db.flush()
        return session

    session = ChatSession(
        user_id=user_id,
        course_id=course_id,
        scene_id=scene_id,
        title=build_session_title(message),
    )
    db.add(session)
    await db.flush()
    return session


async def persist_chat_turn(
    db: AsyncSession,
    session_id: uuid.UUID,
    user_message: str,
    assistant_message: str,
    assistant_metadata: dict | None = None,
    *,
    user_message_id: uuid.UUID | None = None,
    response_status: str = 'completed',
) -> None:
    """Complete a pre-saved user turn, including an interrupted partial answer."""
    now=datetime.now(timezone.utc)
    if user_message_id:
        user=(await db.execute(select(ChatMessageLog).where(ChatMessageLog.id==user_message_id,
            ChatMessageLog.session_id==session_id,ChatMessageLog.role=='user'))).scalar_one_or_none()
        if not user:raise NotFoundError('Chat user message',user_message_id)
        user.metadata_json=dict(user.metadata_json or {}) | {'response_status':response_status}
    elif assistant_message.strip():
        db.add(ChatMessageLog(session_id=session_id,role='user',content=user_message,created_at=now))
    else:
        return
    if assistant_message.strip():
        metadata=dict(assistant_metadata or {}) | {'response_status':response_status}
        assistant_id=uuid.uuid5(uuid.NAMESPACE_URL,f'opentutor:reply:{user_message_id}') if user_message_id else uuid.uuid4()
        assistant=await db.get(ChatMessageLog,assistant_id)
        if assistant:
            assistant.content=assistant_message;assistant.metadata_json=metadata
        else:
            db.add(ChatMessageLog(id=assistant_id,session_id=session_id,role='assistant',
                content=assistant_message,metadata_json=metadata,created_at=datetime.now(timezone.utc)))
    await db.execute(update(ChatSession).where(ChatSession.id==session_id).values(updated_at=now))
    await db.commit()


def serialize_session(session: ChatSession, message_count: int) -> dict:
    """Serialize a ChatSession ORM object to a dict."""
    data = serialize_model(session, ["id", "course_id", "scene_id", "title", "created_at", "updated_at"])
    data["title"] = data.get("title") or "New Chat"
    data["message_count"] = message_count
    return data
