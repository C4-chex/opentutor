"""Locally persisted grading attempts, immutable question snapshots, and review history."""
from __future__ import annotations
import asyncio
import copy
import hashlib
import json
import uuid
from datetime import datetime
from weakref import WeakValueDictionary
from sqlalchemy import select
from models.agent_kv import AgentKV
from models.practice import PracticeProblem, PracticeResult
from models.ingestion import WrongAnswer
from models.course import Course
from libs.datetime_utils import utcnow
from libs.exceptions import ConflictError, NotFoundError, ValidationError
from services.diagnosis.evidence_grader import POLICY_VERSION, Rubric, grade_answer, make_rubric, exact_grade
from services.learning_material import learning_nodes, material_text
from services.learning_language import learning_locale
from services.progress.tracker import rebuild_quiz_progress
from services.diagnosis.tutoring_feedback import teaching_hint, add_choice_hint
from services.answer_reveal import has_viewed_answer

_locks = WeakValueDictionary()

def course_lock(user_id, course_id):
    key = (str(user_id), str(course_id))
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock(); _locks[key] = lock
    return lock

async def owned_problem(db, user_id, problem_id):
    problem = (await db.execute(select(PracticeProblem).join(Course).where(
        PracticeProblem.id == problem_id, Course.user_id == user_id))).scalar_one_or_none()
    if problem is None:
        raise NotFoundError('Problem', problem_id)
    return problem

async def owned_attempt(db, user_id, attempt_id):
    record = (await db.execute(select(AgentKV).where(AgentKV.id == attempt_id,
        AgentKV.user_id == user_id, AgentKV.namespace == 'grading_attempt'))).scalar_one_or_none()
    if record is None:
        raise NotFoundError('作答记录', attempt_id)
    return record

async def snapshot_problem(db, problem):
    nodes = await learning_nodes(db, problem.course_id, problem.content_node_id)
    return {'problem_id':str(problem.id), 'question_type':problem.question_type,
            'question':problem.question, 'options':problem.options,
            'correct_answer':problem.correct_answer, 'explanation':problem.explanation,
            'material':material_text(nodes, budget=14000),
            'sources':[{'node_id':str(n.id),'title':n.title,'source':n.source_file} for n in nodes[:20]],
            'policy_version':POLICY_VERSION}

async def cached_rubric(db, user_id, course_id, snapshot):
    signature = hashlib.sha256(json.dumps([snapshot,learning_locale.get()],ensure_ascii=False,sort_keys=True).encode()).hexdigest()
    record = (await db.execute(select(AgentKV).where(AgentKV.user_id==user_id,
        AgentKV.course_id==course_id, AgentKV.namespace=='grading_rubric', AgentKV.key==signature))).scalar_one_or_none()
    if record:
        return Rubric.model_validate(record.value_json)
    rubric = await make_rubric(snapshot)
    db.add(AgentKV(user_id=user_id,course_id=course_id,namespace='grading_rubric',key=signature,
                   value_json=rubric.model_dump()))
    return rubric

def response(state):
    result = state['assessment']
    definitive = result['status'] in ('correct','incorrect')
    hint = teaching_hint(state['snapshot'],state['answer'],result,assisted=not state['independent'])
    return {'attempt_id':state['attempt_id'], 'revision':state['revision'],
        'status':result['status'], 'is_correct': result['status']=='correct' if definitive else None,
        'counted':state['counted'], 'independent':state['independent'],
        'answer_viewed':state.get('answer_viewed',False),
        'correct_answer':None, 'explanation':hint, 'follow_up':'',
        'criteria':[], 'grading_method':result.get('grading_method',''),
        'history':[{'revision':h['revision'],'status':h['assessment']['status'],
                    'feedback':teaching_hint(state['snapshot'],state['answer'],h['assessment']),
                    'reason':h.get('reason',''), 'at':h['at']} for h in state['history']],
        'warnings':[]}

async def apply_decision(db, record, state, problem):
    """Update one result in place; a suspended record remains in the local audit ledger."""
    assessment = state['assessment']
    counted = state['independent'] and assessment['status'] in ('correct','incorrect')
    correct = assessment['status']=='correct'
    state['counted'] = counted
    state['counted_wrong'] = counted and not correct
    result = await db.get(PracticeResult, uuid.UUID(state['result_id'])) if state.get('result_id') else None
    wrong = await db.get(WrongAnswer, uuid.UUID(state['wrong_answer_id'])) if state.get('wrong_answer_id') else None
    if counted:
        if result is None:
            result = PracticeResult(id=uuid.uuid4(),problem_id=problem.id,user_id=record.user_id,
                user_answer=state['answer'],is_correct=correct, difficulty_layer=problem.difficulty_layer,
                answer_time_ms=state.get('answer_time_ms'),
                answered_at=datetime.fromisoformat(state['history'][0]['at']))
            db.add(result); state['result_id']=str(result.id)
        result.is_correct = correct
        result.ai_explanation = teaching_hint(state['snapshot'],state['answer'],assessment)
        result.error_category = assessment.get('error_category') if not correct else None
        if not correct:
            if wrong is None:
                wrong = WrongAnswer(id=uuid.uuid4(),user_id=record.user_id,problem_id=problem.id,
                    course_id=problem.course_id,user_answer=state['answer'],
                    correct_answer=state['snapshot']['correct_answer'],knowledge_points=problem.knowledge_points)
                db.add(wrong); state['wrong_answer_id']=str(wrong.id)
            wrong.explanation = teaching_hint(state['snapshot'],state['answer'],assessment)
            wrong.error_category = assessment.get('error_category')
            wrong.error_detail = {'grading_attempt_id':state['attempt_id'],'revision':state['revision'],'criteria':assessment.get('criteria',[])}
    record.value_json = copy.deepcopy(state)
    record.version = state['revision']
    await db.flush()
    # Course and chapter counters, mastery and FSRS are replayed from valid evidence only.
    if result is not None:
        await rebuild_quiz_progress(db, record.user_id, problem.course_id, problem.content_node_id)

async def submit(db, user_id, body):
    if not body.user_answer.strip():
        raise ValidationError("请先填写答案。")
    problem = await owned_problem(db, user_id, body.problem_id)
    async with course_lock(user_id, problem.course_id):
        attempt_id = uuid.uuid5(user_id, 'grade:'+str(body.request_id))
        existing = await db.get(AgentKV, attempt_id)
        if existing:
            state=existing.value_json
            if state.get('problem_id') != str(problem.id) or state.get('answer') != body.user_answer:
                raise ConflictError('相同请求编号不能用于另一份作答。')
            return response(state)
        if problem.is_archived:
            raise ValidationError('该题已归档，请刷新题目。')
        prior = (await db.execute(select(AgentKV.id).where(AgentKV.user_id==user_id,
            AgentKV.course_id==problem.course_id, AgentKV.namespace=='grading_attempt',
            AgentKV.value_json['problem_id'].as_string()==str(problem.id)).limit(1))).first()
        legacy = (await db.execute(select(PracticeResult.id).where(PracticeResult.user_id==user_id,
            PracticeResult.problem_id==problem.id).limit(1))).first()
        answer_viewed = await has_viewed_answer(db, user_id, problem)
        independent = not (prior or legacy or answer_viewed)
        if body.parent_attempt_id:
            parent = await owned_attempt(db,user_id,body.parent_attempt_id)
            if parent.value_json['problem_id'] != str(problem.id):
                raise ValidationError('补充作答必须属于原题。')
            # Feedback may already teach the answer: later success is assisted evidence.
            independent = False
        snapshot = await snapshot_problem(db, problem)
        closed = exact_grade(snapshot, body.user_answer)
        rubric = None if closed is not None else await cached_rubric(db,user_id,problem.course_id,snapshot)
        assessment, rubric = await grade_answer(snapshot, body.user_answer, rubric)
        if closed is not None:
            assessment = await add_choice_hint(snapshot,body.user_answer,assessment)
        state = {'attempt_id':str(attempt_id),'problem_id':str(problem.id),'answer':body.user_answer,
            'answer_time_ms':body.answer_time_ms,'snapshot':snapshot,'rubric':rubric.model_dump() if rubric else None,
            'revision':1,'independent':independent,'answer_viewed':answer_viewed,'counted':False,'counted_wrong':False,
            'parent_attempt_id':str(body.parent_attempt_id) if body.parent_attempt_id else None,
            'assessment':assessment,'history':[], 'review_requests':{}}
        state['history'].append({'revision':1,'assessment':copy.deepcopy(assessment),'at':utcnow().isoformat()})
        record = AgentKV(id=attempt_id,user_id=user_id,course_id=problem.course_id,
            namespace='grading_attempt',key=str(body.request_id),value_json={},created_at=utcnow())
        db.add(record)
        await apply_decision(db,record,state,problem)
        await db.commit()
        return response(state)

async def review(db, user_id, attempt_id, body):
    record = await owned_attempt(db,user_id,attempt_id)
    async with course_lock(user_id, record.course_id):
        await db.refresh(record)
        state = copy.deepcopy(record.value_json)
        request_key = str(body.request_id)
        if request_key in state['review_requests']:
            return response(state)
        if body.expected_revision != state['revision']:
            raise ConflictError('判题记录已有更新，请刷新后再复核。')
        problem = await owned_problem(db,user_id,uuid.UUID(state['problem_id']))
        closed = exact_grade(state['snapshot'],state['answer'])
        rubric = None if closed is not None else (Rubric.model_validate(state['rubric']) if state.get('rubric') else await cached_rubric(
            db,user_id,record.course_id,state['snapshot']))
        assessment, rubric = await grade_answer(state['snapshot'],state['answer'],rubric,
            review=True,review_reason=body.reason)
        if closed is not None:
            assessment = await add_choice_hint(state['snapshot'],state['answer'],assessment)
        state['revision'] += 1
        state['rubric'] = rubric.model_dump() if rubric else None
        state['assessment'] = assessment
        state['history'].append({'revision':state['revision'],'assessment':copy.deepcopy(assessment),
                                 'reason':body.reason,'at':utcnow().isoformat()})
        await apply_decision(db,record,state,problem)
        output = response(state)
        state['review_requests'][request_key] = output
        record.value_json = copy.deepcopy(state)
        await db.commit()
        return output

async def latest_attempt(db, user_id, problem_id):
    problem = await owned_problem(db,user_id,problem_id)
    records = (await db.execute(select(AgentKV).where(AgentKV.user_id==user_id,
        AgentKV.course_id==problem.course_id,AgentKV.namespace=='grading_attempt',
        AgentKV.value_json['problem_id'].as_string()==str(problem_id)).order_by(AgentKV.created_at.desc(),AgentKV.id.desc()).limit(1))).scalars().all()
    if not records:
        return None
    state=records[0].value_json
    return {**response(state),'user_answer':state['answer']}


async def course_attempts(db, user_id, course_id):
    from services.course_access import get_course_or_404
    await get_course_or_404(db,course_id,user_id=user_id)
    records = (await db.execute(select(AgentKV).where(AgentKV.user_id==user_id,
        AgentKV.course_id==course_id, AgentKV.namespace=='grading_attempt').order_by(
        AgentKV.created_at.desc(),AgentKV.id.desc()))).scalars()
    seen, output = set(), []
    for record in records:
        state=record.value_json
        if state['problem_id'] in seen:
            continue
        seen.add(state['problem_id'])
        output.append({**response(state),'problem_id':state['problem_id'],'user_answer':state['answer']})
    return output


async def repair_legacy_choice_attempts(db):
    """Repair only v1's known two-reviewer disagreement bug, using existing submissions."""
    records = list((await db.execute(select(AgentKV).where(AgentKV.namespace=='grading_attempt'))).scalars())
    repaired=0
    for record in records:
        state=copy.deepcopy(record.value_json)
        previous=state['assessment']
        if state['snapshot'].get('policy_version')=='hint-first-v2':
            continue
        if previous.get('status')!='needs_clarification' or '两次独立评估结论不一致' not in previous.get('feedback',''):
            continue
        closed=exact_grade(state['snapshot'],state['answer'])
        if closed is None or closed['status'] not in ('correct','incorrect'):
            continue
        problem=await owned_problem(db,record.user_id,uuid.UUID(state['problem_id']))
        state['assessment']=closed
        state['snapshot']['policy_version']=POLICY_VERSION
        state['revision']+=1
        state['history'].append({'revision':state['revision'],'assessment':copy.deepcopy(closed),
            'reason':'修复旧版选择题多轮复核误判，恢复选项判断与原题提示。','at':utcnow().isoformat()})
        await apply_decision(db,record,state,problem)
        repaired+=1
    await db.commit()
    return repaired
