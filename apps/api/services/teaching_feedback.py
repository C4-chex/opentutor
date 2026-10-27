"""Local teaching issue records. Filing a report never changes learning evidence."""
from datetime import datetime, timezone
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from libs.exceptions import ConflictError, ValidationError
from models.agent_kv import AgentKV
from services.agent.guided_learning import get_record, get_checkpoint
from services.course_access import get_course_or_404

NAMESPACE = "teaching_feedback"


class FeedbackInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    report_id: uuid.UUID
    revision: int = Field(ge=1)
    kind: Literal["explanation", "grading", "question", "source", "other"]
    note: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def require_custom_description(self):
        if self.kind == "other" and not self.note:
            raise ValueError("请填写具体问题。")
        return self


async def list_reports(db, user_id, course_id, node_id):
    await get_course_or_404(db, course_id, user_id=user_id)
    records = (await db.execute(select(AgentKV).where(
        AgentKV.user_id == user_id, AgentKV.course_id == course_id,
        AgentKV.namespace == NAMESPACE,
    ).order_by(AgentKV.created_at.desc()).limit(200))).scalars().all()
    return [row.value_json for row in records if row.value_json.get("node_id") == str(node_id)][:30]


async def save_report(db, user_id, course_id, node_id, body):
    await get_course_or_404(db, course_id, user_id=user_id)
    # Deterministic ID makes a network retry safe, without hiding changed content.
    record_id = uuid.uuid5(uuid.NAMESPACE_URL, f"opentutor:teaching-feedback:{user_id}:{body.report_id}")
    existing = (await db.execute(select(AgentKV).where(AgentKV.id == record_id))).scalar_one_or_none()
    if existing:
        value = existing.value_json
        if (existing.user_id != user_id or existing.course_id != course_id
                or value.get("node_id") != str(node_id) or value.get("revision") != body.revision
                or value.get("kind") != body.kind or value.get("note") != body.note):
            raise ConflictError("反馈内容已变化，请重新提交。")
        return value
    lesson = await get_record(db, user_id, course_id, node_id)
    if not lesson:
        raise ValidationError("请先打开一段已有的教学内容，再反馈问题。")
    state = lesson.value_json
    if state["revision"] != body.revision:
        checkpoint = await get_checkpoint(db, user_id, course_id, node_id, state["session_id"], body.revision)
        if checkpoint is None:
            raise ConflictError("该轮教学已变化，请刷新进度后定位需要反馈的内容。")
        state = checkpoint.value_json
    tutor = next((turn for turn in reversed(state["turns"]) if turn["role"] == "tutor"), {})
    answer = next((turn for turn in reversed(state["turns"]) if turn["role"] == "learner" and not turn.get("is_help_request") and not turn.get("is_navigation")), {})
    value = {"report_id": str(body.report_id), "course_id": str(course_id), "node_id": str(node_id),
             "session_id": state["session_id"], "revision": body.revision, "kind": body.kind, "note": body.note,
             "status": "recorded", "created_at": datetime.now(timezone.utc).isoformat(),
             "context": {"title": state["title"], "stage": state["stage"], "tutor": tutor, "answer": answer}}
    db.add(AgentKV(id=record_id, user_id=user_id, course_id=course_id, namespace=NAMESPACE,
                  key=str(body.report_id), value_json=value))
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("反馈已在其他请求中保存，请刷新查看。") from exc
    return value
