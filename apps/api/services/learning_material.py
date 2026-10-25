"""Select actual course knowledge, expanding a chapter into its descendants."""
from sqlalchemy import select
from models.content import CourseContentTree, INFO_CATEGORIES
from libs.exceptions import NotFoundError


def is_navigation_material(node):
    github = (node.metadata_ or {}).get("github") or {}
    return ((node.content or "").startswith("此分组保留")
            or bool(github and not github.get("file_path")))


async def learning_nodes(db, course_id, node_id=None):
    rows = list((await db.execute(select(CourseContentTree).where(
        CourseContentTree.course_id == course_id).order_by(
        CourseContentTree.level, CourseContentTree.order_index, CourseContentTree.id))).scalars())
    if node_id is not None:
        lookup = {str(row.id): row for row in rows}
        selected = lookup.get(str(node_id))
        if selected is None:
            raise NotFoundError("当前课程中未找到该章节。")
        children = {}
        for row in rows:
            children.setdefault(str(row.parent_id), []).append(row)
        selected_rows, queue, seen = [], [selected], set()
        while queue:
            row = queue.pop(0)
            if str(row.id) in seen:
                continue
            seen.add(str(row.id)); selected_rows.append(row)
            queue.extend(children.get(str(row.id), []))
        rows = selected_rows
    return [row for row in rows if (row.content or "").strip()
            and row.content_category not in INFO_CATEGORIES and not is_navigation_material(row)]


def material_text(nodes, budget=20000):
    parts = []
    for node in nodes:
        if budget <= 0:
            break
        chunk = f"## {node.title}\n{node.content}"[:budget]
        parts.append(chunk); budget -= len(chunk)
    return "\n\n".join(parts)
