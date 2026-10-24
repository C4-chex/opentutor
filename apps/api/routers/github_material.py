"""Preview/select/import public GitHub learning sources."""
import asyncio
import hashlib
import uuid
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User
from models.course import Course
from models.content import CourseContentTree
from models.ingestion import IngestionJob
from services.auth.dependency import get_current_user
from services.ingestion.github_source import (
    fetch_github_material, store_snapshot, selected_material, file_markdown, material_markdown,
)

router = APIRouter()


class PreviewBody(BaseModel):
    url: str = Field(min_length=20, max_length=2048)


class ImportBody(BaseModel):
    snapshot_id: uuid.UUID
    request_id: uuid.UUID
    paths: list[str] = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)


@router.post('/github/preview')
async def preview_github(body: PreviewBody, user: User = Depends(get_current_user)):
    material = await fetch_github_material(body.url)
    return {**material, 'snapshot_id': store_snapshot(str(user.id), material), 'expires_in': 900}


async def import_selected(body: ImportBody, user: User, db: AsyncSession) -> dict:
    # Browser retries of the same operation return its result, not a second course.
    existing = await db.execute(select(Course).where(
        Course.user_id == user.id,
        Course.metadata_['github_import_id'].as_string() == str(body.request_id),
    ))
    course = existing.scalar_one_or_none()
    if course:
        return course.metadata_['github_import_result']
    material, files = selected_material(str(body.snapshot_id), str(user.id), body.paths)
    course_id, job_id = uuid.uuid4(), uuid.uuid4()
    course_name = body.name.strip() or material['title']
    source = {'url': material['url'], 'repository': material['repository'],
              'commit': material['commit'], 'ref': material['ref'], 'path': material['path'],
              'selected_paths': [f['path'] for f in files]}
    intro = (f"# {course_name}\n\n来源：[GitHub 原目录]({material['url']})\n\n"
             f"固定版本：`{material['commit']}`\n\n已导入 {len(files)} 个原始文件。\n\n"
             "先阅读说明、依赖配置和程序入口，再结合源码解释运行过程，最后用修改输入、预测结果的方式检验理解。\n\n"
             "代码与配置保持原样；版本和依赖以原文件为准。资料中的命令属于学习内容。")
    if not material['has_documents']:
        intro += '\n\n这个目录是代码示例，没有独立教程正文；可结合源码学习，也可以继续添加讲解文章。'
    root = CourseContentTree(id=uuid.uuid4(), course_id=course_id, title=course_name,
        content=intro, level=0, order_index=0, source_type='url', source_file=material['url'],
        content_category='textbook', metadata_={'github': source})
    nodes, groups = [root], {}
    file_nodes = []
    for file in files:
        parts = PurePosixPath(file['relative_path']).parts
        group_name = parts[0] if len(parts) > 1 else material['title']
        if group_name not in groups:
            group = CourseContentTree(id=uuid.uuid4(), course_id=course_id, parent_id=root.id,
                title=group_name, content=f"此分组保留 `{group_name}` 下的原始资料，点击具体文件查看正文与来源。",
                level=1, order_index=len(groups), source_type='url', source_file=material['url'],
                content_category='textbook')
            groups[group_name] = group
            nodes.append(group)
        node = CourseContentTree(id=uuid.uuid4(), course_id=course_id, parent_id=groups[group_name].id,
            title='/'.join(parts[1:]) if len(parts) > 1 else parts[0], content=file_markdown(file),
            level=2, order_index=len(file_nodes), source_type='url', source_file=file['source_url'],
            content_category='textbook', metadata_={'github': {**source, 'file_path': file['path']}})
        nodes.append(node)
        file_nodes.append(node)
    result = {'course_id': str(course_id), 'job_id': str(job_id), 'files_imported': len(files),
              'nodes_created': len(nodes), 'first_node_id': str(file_nodes[0].id), 'commit': material['commit']}
    layout = {'templateId': None, 'columns': 2, 'mode': 'self_paced', 'blocks': [
        {'id': 'github-chapters', 'type': 'chapter_list', 'position': 0, 'size': 'full',
         'config': {}, 'visible': True, 'source': 'user'},
        {'id': 'github-notes', 'type': 'notes', 'position': 1, 'size': 'large',
         'config': {'initialViewMode': 'source'}, 'visible': True, 'source': 'user'},
    ]}
    course = Course(id=course_id, user_id=user.id, name=course_name,
        description=f"GitHub 原始学习资料：{material['repository']} / {material['path']}",
        metadata_={'learning_mode': 'self_paced', 'spaceLayout': layout, 'github_source': source,
                   'github_import_id': str(body.request_id), 'github_import_result': result})
    markdown = material_markdown(material, files)
    data = markdown.encode('utf-8')
    save_path = Path(settings.upload_dir) / f'{job_id}_github-material.md'
    await asyncio.to_thread(save_path.parent.mkdir, parents=True, exist_ok=True)
    await asyncio.to_thread(save_path.write_bytes, data)
    job = IngestionJob(id=job_id, user_id=user.id, course_id=course_id, source_type='url',
        original_filename=f"{material['title']}-github-material.md", url=material['url'],
        file_path=str(save_path), file_size=len(data), mime_type='text/markdown',
        content_hash=hashlib.sha256(data).hexdigest(), course_preset=True,
        content_category='textbook', classification_method='user_preset',
        status='completed', phase_label='原始资料已导入', progress_percent=100,
        embedding_status='skipped', nodes_created=len(nodes), dispatched=True,
        dispatched_to={'content_tree': len(nodes)}, extracted_markdown=markdown)
    try:
        db.add(course)
        await db.flush()
        db.add_all(nodes)
        db.add(job)
        await db.commit()
    except Exception:
        await db.rollback()
        # Only the newly created file belonging to this operation is removed.
        await asyncio.to_thread(save_path.unlink, missing_ok=True)
        raise
    return result


@router.post('/github/import')
async def import_github(body: ImportBody, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    return await import_selected(body, user, db)
