"""Read-only chapter completion for the end-of-section review. No model calls."""
from sqlalchemy import select

from libs.exceptions import NotFoundError, ValidationError
from models.agent_kv import AgentKV
from models.content import CourseContentTree
from services.agent.guided_learning import NAMESPACE, build_source_context
from services.course_access import get_course_or_404


async def chapter_summary_status(db, user_id, course_id, node_id):
    course = await get_course_or_404(db, course_id, user_id=user_id)
    rows = (await db.execute(select(CourseContentTree).where(
        CourseContentTree.course_id == course_id).order_by(
        CourseContentTree.level, CourseContentTree.order_index))).scalars().all()
    lookup = {str(row.id): row for row in rows}
    selected = lookup.get(str(node_id))
    if selected is None:
        raise NotFoundError('Learning source')
    children = {}
    for row in rows:
        children.setdefault(str(row.parent_id), []).append(row)
    # A source document belongs to its containing section. A selected section
    # summarizes its own subtree, never unrelated chapters in the same course.
    scope = selected if children.get(str(selected.id)) else lookup.get(str(selected.parent_id), selected)
    subtree, queue, seen = [], [scope], set()
    while queue:
        row = queue.pop(0)
        if row.id in seen:
            continue
        seen.add(row.id)
        subtree.append(row)
        queue.extend(children.get(str(row.id), []))
    targets = {str(row.id) for row in subtree if row.content and not (
        children.get(str(row.id)) and (
            row.content.startswith('此分组保留') or (row.metadata_ or {}).get('github')))}
    if not targets:
        targets = {str(row.id) for row in subtree if row.content}
    records = (await db.execute(select(AgentKV).where(
        AgentKV.user_id == user_id, AgentKV.course_id == course_id,
        AgentKV.namespace == NAMESPACE, AgentKV.key.in_([str(row.id) for row in subtree])
    ))).scalars().all()
    covered = set()
    for record in records:
        state = record.value_json
        if state.get('stage') != 'complete' or state.get('limited_scope') or state.get('foundation_return'):
            continue
        evidence = state.get('evidence', [])
        verified = {item.get('stage') for item in evidence if item.get('independent')}
        if not {'feynman', 'practice', 'transfer'} <= verified:
            continue
        try:
            context = build_source_context(course.name, rows, record.key)
        except ValidationError:
            continue
        if context['limited_scope'] or context['fingerprint'] != state.get('fingerprint'):
            continue
        covered.update(source['node_id'] for source in context['sources'])
    return {
        'node_id': str(scope.id), 'title': scope.title,
        'ready': bool(targets) and targets <= covered,
        'verified_sources': len(targets & covered), 'total_sources': len(targets),
    }
