"""SQL predicates excluding superseded assessments without erasing their audit trail."""
from sqlalchemy import String, cast, exists, select
from models.agent_kv import AgentKV
from models.practice import PracticeResult
from models.ingestion import WrongAnswer

def active_result_clause():
    return ~exists(select(AgentKV.id).where(
        AgentKV.namespace == 'grading_attempt', AgentKV.user_id == PracticeResult.user_id,
        AgentKV.value_json['result_id'].as_string() == cast(PracticeResult.id, String),
        AgentKV.value_json['counted'].as_boolean() == False))

def active_wrong_clause():
    return ~exists(select(AgentKV.id).where(
        AgentKV.namespace == 'grading_attempt', AgentKV.user_id == WrongAnswer.user_id,
        AgentKV.value_json['wrong_answer_id'].as_string() == cast(WrongAnswer.id, String),
        AgentKV.value_json['counted_wrong'].as_boolean() == False))
