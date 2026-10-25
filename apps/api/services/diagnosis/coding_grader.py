"""Compatibility entry point. Coding answers use the shared evidence-based policy."""
from services.diagnosis.evidence_grader import grade_answer

async def grade_coding_answer(*, question: str, reference_answer: str, user_code: str) -> dict:
    assessment, _ = await grade_answer({'question':question,'correct_answer':reference_answer,
        'question_type':'coding','options':None,'material':''},user_code)
    status=assessment['status']
    return {**assessment,'is_correct':status=='correct' if status in ('correct','incorrect') else None}
