"""Explicit answer reveal with local, per-learner assistance records."""
import uuid
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from models.agent_kv import AgentKV
from libs.datetime_utils import utcnow
from libs.exceptions import ValidationError

NAMESPACE = 'answer_viewed'


async def viewed_problem_ids(db, user_id, course_id, problem_ids):
    keys = [str(value) for value in problem_ids]
    if not keys:
        return set()
    return set((await db.execute(select(AgentKV.key).where(
        AgentKV.user_id == user_id, AgentKV.course_id == course_id,
        AgentKV.namespace == NAMESPACE, AgentKV.key.in_(keys)
    ))).scalars())


async def has_viewed_answer(db, user_id, problem):
    return bool(await viewed_problem_ids(db, user_id, problem.course_id, [problem.id]))


async def reveal_answer(db, user_id, problem_id):
    from services.grading_sessions import owned_problem, course_lock
    problem = await owned_problem(db, user_id, problem_id)
    async with course_lock(user_id, problem.course_id):
        await db.refresh(problem)
        if problem.is_archived:
            raise ValidationError('该题已归档，请选择当前练习题。')
        if not (problem.correct_answer or problem.explanation):
            raise ValidationError('这道题还没有参考答案或解析，可以反馈题目问题。')
        record_id = uuid.uuid5(user_id, 'answer-viewed:' + str(problem.id))
        record = await db.get(AgentKV, record_id)
        viewed_at = record.value_json['viewed_at'] if record else utcnow().isoformat()
        output = {'problem_id':str(problem.id), 'answer_viewed':True, 'viewed_at':viewed_at,
                  'correct_answer':problem.correct_answer, 'explanation':problem.explanation}
        if record is None:
            db.add(AgentKV(id=record_id, user_id=user_id, course_id=problem.course_id,
                namespace=NAMESPACE, key=str(problem.id), value_json={
                    'problem_id':str(problem.id), 'viewed_at':viewed_at}))
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                existing = await db.get(AgentKV, record_id)
                if existing is None:
                    raise
                output['viewed_at'] = existing.value_json['viewed_at']
        # The answer is returned only after the local assistance record is durable.
        # Historical attempts are intentionally left intact.
        return output
