"""Answer privacy and assistance tracking. Synthetic data; no real model calls."""
import unittest
import uuid
from unittest.mock import AsyncMock, patch
from sqlalchemy import select
from models import AgentKV, PracticeProblem, PracticeResult
from services.answer_reveal import reveal_answer, viewed_problem_ids, NAMESPACE
from services.grading_sessions import submit
from routers.quiz_submission import list_problems
from routers.wrong_answers import list_wrong_answers
from libs.exceptions import NotFoundError, ValidationError
from schemas.quiz import SubmitAnswerRequest
import test_evidence_grading as fixtures


class AnswerRevealTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.GradingStateTests.asyncSetUp
    asyncTearDown = fixtures.GradingStateTests.asyncTearDown
    body = fixtures.GradingStateTests.body
    rows = fixtures.GradingStateTests.rows

    async def test_wrong_answer_list_hides_reference_and_private_grading_evidence(self):
        self.problem.explanation = 'SECRET_REFERENCE_SOLUTION'
        await self.db.commit()
        output = await submit(self.db,self.user.id,self.body('B'))
        record = await self.db.get(AgentKV,uuid.UUID(output['attempt_id']))
        wrong = await self.db.get(fixtures.WrongAnswer,uuid.UUID(record.value_json['wrong_answer_id']))
        wrong.explanation = 'SECRET_LEGACY_EXPLANATION'
        wrong.error_detail = {'criteria':[{'requirement':'SECRET_RUBRIC_SOLUTION'}], 'category':'conceptual'}
        await self.db.commit()
        items = await list_wrong_answers(self.course.id,limit=100,offset=0,user=self.user,db=self.db)
        data = items[0].model_dump()
        self.assertIsNone(data['correct_answer'])
        self.assertNotIn('SECRET',str(data))
        self.assertFalse(data['answer_viewed'])
        self.assertEqual(data['user_answer'],'B')
        self.assertFalse(await viewed_problem_ids(self.db,self.user.id,self.course.id,[self.problem.id]))

    async def test_reveal_is_explicit_idempotent_and_survives_a_new_database_session(self):
        self.problem.explanation='Synthetic worked solution'
        await self.db.commit()
        first=await reveal_answer(self.db,self.user.id,self.problem.id)
        second=await reveal_answer(self.db,self.user.id,self.problem.id)
        self.assertEqual(first,second)
        self.assertEqual(first['correct_answer'],'A')
        self.assertTrue(first['answer_viewed'])
        async with self.factory() as fresh:
            seen=await viewed_problem_ids(fresh,self.user.id,self.course.id,[self.problem.id])
            self.assertEqual(seen,{str(self.problem.id)})
            output=await submit(fresh,self.user.id,self.body('A'))
        self.assertTrue(output['is_correct'])
        self.assertTrue(output['answer_viewed'])
        self.assertFalse(output['independent'])
        self.assertFalse(output['counted'])
        self.assertEqual(await self.rows(PracticeResult),[])
        records=await self.rows(AgentKV)
        self.assertEqual(sum(record.namespace==NAMESPACE for record in records),1)

    async def test_public_problem_list_only_restores_viewed_flag_never_reference(self):
        await reveal_answer(self.db,self.user.id,self.problem.id)
        problems=await list_problems(self.course.id,limit=50,offset=0,user=self.user,db=self.db)
        data=problems[0].model_dump()
        self.assertTrue(data['answer_viewed'])
        self.assertNotIn('correct_answer',data)
        self.assertNotIn('explanation',data)

    async def test_earlier_independent_work_is_preserved_after_viewing(self):
        body=self.body('A')
        original=await submit(self.db,self.user.id,body)
        await reveal_answer(self.db,self.user.id,self.problem.id)
        replay=await submit(self.db,self.user.id,body)
        self.assertEqual(original,replay)
        self.assertTrue(replay['independent'])
        self.assertTrue(replay['counted'])
        later=await submit(self.db,self.user.id,self.body('A'))
        self.assertFalse(later['independent'])
        self.assertFalse(later['counted'])
        self.assertEqual(len(await self.rows(PracticeResult)),1)

    async def test_viewing_one_question_does_not_taint_an_independent_variant(self):
        await reveal_answer(self.db,self.user.id,self.problem.id)
        variant=PracticeProblem(id=uuid.uuid4(),course_id=self.course.id,question_type='mc',
            question='New transfer problem',options={'A':'new answer','B':'distractor'},correct_answer='A')
        self.db.add(variant)
        await self.db.commit()
        result=await submit(self.db,self.user.id,SubmitAnswerRequest(problem_id=variant.id,user_answer='A'))
        self.assertTrue(result['independent'])
        self.assertTrue(result['counted'])
        self.assertFalse(result['answer_viewed'])

    async def test_reveal_does_not_mark_wrong_answers_mastered_or_erase_their_record(self):
        original=await submit(self.db,self.user.id,self.body('B'))
        await reveal_answer(self.db,self.user.id,self.problem.id)
        records=await self.rows(fixtures.WrongAnswer)
        self.assertFalse(records[0].mastered)
        self.assertEqual(records[0].user_answer,'B')
        public=await list_wrong_answers(self.course.id,limit=100,offset=0,user=self.user,db=self.db)
        self.assertTrue(public[0].answer_viewed)
        self.assertIsNone(public[0].correct_answer)
        self.assertEqual(len(await self.rows(PracticeResult)),1)

    async def test_other_learners_and_archived_questions_cannot_be_revealed(self):
        with self.assertRaises(NotFoundError):
            await reveal_answer(self.db,self.other.id,self.problem.id)
        self.problem.is_archived=True
        await self.db.commit()
        with self.assertRaises(ValidationError):
            await reveal_answer(self.db,self.user.id,self.problem.id)
        self.assertFalse(await viewed_problem_ids(self.db,self.user.id,self.course.id,[self.problem.id]))

    async def test_missing_reference_has_no_viewed_marker(self):
        self.problem.correct_answer=None
        self.problem.explanation=None
        await self.db.commit()
        with self.assertRaises(ValidationError):
            await reveal_answer(self.db,self.user.id,self.problem.id)
        self.assertFalse(await viewed_problem_ids(self.db,self.user.id,self.course.id,[self.problem.id]))

    async def test_failed_local_save_never_returns_the_reference(self):
        with patch.object(self.db,'commit',new=AsyncMock(side_effect=RuntimeError('synthetic disk outage'))):
            with self.assertRaises(RuntimeError):
                await reveal_answer(self.db,self.user.id,self.problem.id)
        await self.db.rollback()
        self.assertEqual(await self.rows(AgentKV),[])
