"""Explicit local-vault export/import with external edit detection; never touches .obsidian."""
from __future__ import annotations
import asyncio
import hashlib
import os
import re
from pathlib import Path
import uuid
from urllib.parse import quote
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from config import settings
from libs.exceptions import ConflictError, PermissionDeniedError, ValidationError
from models.agent_kv import AgentKV
from services.classroom_notes import load_notebook, save_notebook, SaveNotebook

def is_redirect(path):
    return path.is_symlink() or getattr(path, 'is_junction', lambda: False)()


NS = 'obsidian_integration'
MARKER = '<!-- opentutor-note-content -->\n'
_locks: dict[str, asyncio.Lock] = {}

class VaultSettings(BaseModel):
    model_config = ConfigDict(extra='forbid')
    vault_path: str = Field(default='', max_length=1024)

class NoteRevision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    revision: int = Field(ge=1)

class ImportNote(NoteRevision):
    file_hash: str = Field(pattern=r'^[a-f0-9]{64}$')

def local_only():
    if settings.deployment_mode != 'single_user':
        raise PermissionDeniedError('本地笔记库接入仅支持单用户部署。')

def vault_path(value: str) -> Path:
    path = Path(value.strip())
    if not value.strip() or not path.is_absolute() or str(path).startswith(('\\\\', '//')):
        raise ValidationError('请填写本机 Obsidian 笔记库的完整文件夹路径。')
    try:
        path = path.resolve(strict=True)
        if not path.is_dir() or not (path / '.obsidian').is_dir():
            raise ValidationError('该目录不是 Obsidian 笔记库。请先在 Obsidian 中打开此文件夹，再连接。')
    except OSError as exc:
        raise ValidationError('无法访问这个笔记库，请检查路径和文件夹权限。') from exc
    return path

async def record(db, user_id, key, course_id=None):
    return (await db.execute(select(AgentKV).where(AgentKV.user_id == user_id,
        AgentKV.course_id == course_id, AgentKV.namespace == NS, AgentKV.key == key))).scalars().first()

async def put(db, user_id, key, value, course_id=None):
    row = await record(db, user_id, key, course_id)
    if row: row.value_json = value; row.version += 1
    else:
        identity=uuid.uuid5(uuid.NAMESPACE_URL,f"opentutor:obsidian:{user_id}:{course_id or 'global'}:{key}")
        db.add(AgentKV(id=identity,user_id=user_id, course_id=course_id, namespace=NS, key=key, value_json=value))

async def get_config(db, user_id):
    local_only()
    row = await record(db, user_id, 'vault')
    return {'vault_path': row.value_json['vault_path'] if row else '', 'folder': 'OpenTutor'}

async def set_config(db, user_id, body):
    local_only()
    value = str(vault_path(body.vault_path)) if body.vault_path.strip() else ''
    await put(db, user_id, 'vault', {'vault_path': value})
    try: await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError('笔记库连接已在其他页面更新，请重新载入设置。') from exc
    return await get_config(db, user_id)

async def target(db, user_id, course_id, node_id, title="笔记"):
    config = await get_config(db, user_id)
    root = vault_path(config['vault_path'])
    suffix = '-' + str(uuid.UUID(str(node_id))) + '.md'
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', title).strip(' .')[:64] or '笔记'
    filename = name + suffix
    receipt = await record(db, user_id, str(node_id), course_id)
    previous_name = receipt.value_json.get('filename', '') if receipt else ''
    if previous_name and Path(previous_name).name == previous_name and previous_name.endswith(suffix):
        filename = previous_name
    path = root / 'OpenTutor' / str(uuid.UUID(str(course_id))) / filename
    try:
        resolved = path.resolve()
    except OSError as exc:
        raise ValidationError('无法访问导出目录，请检查文件夹权限。') from exc
    if not resolved.is_relative_to(root) or any(is_redirect(p) for p in (path, path.parent, path.parent.parent)):
        raise ValidationError('导出目录包含外部链接，请使用笔记库内的普通 OpenTutor 文件夹。')
    return path

def digest(content): return hashlib.sha256(content).hexdigest()

def read_file(path):
    if not path.exists(): return None
    if path.stat().st_size > 500000:
        raise ValidationError('外部笔记过大，请先导出备份并手动整理。')
    return path.read_bytes()

def public_file(path, data):
    text = data.decode('utf-8-sig') if data is not None else ''
    body = text.split(MARKER, 1)[1] if MARKER in text else text
    if len(body) > 60000: raise ValidationError('外部笔记超过编辑器长度限制，请先手动整理。')
    return {'path': str(path), 'uri': 'obsidian://open?path=' + quote(str(path), safe=''),
            'markdown': body, 'file_hash': digest(data) if data is not None else None}

async def inspect_note(db, user_id, course_id, node_id):
    note = await load_notebook(db, user_id, course_id, node_id)
    path = await target(db, user_id, course_id, node_id, note["title"])
    try:
        data = read_file(path)
        result = public_file(path, data)
    except (OSError, UnicodeError) as exc:
        raise ValidationError('无法读取 Obsidian 笔记，请检查权限与 UTF-8 编码。') from exc
    receipt = await record(db, user_id, str(node_id), course_id)
    result.update(exists=data is not None, revision=note['revision'],
        external_changed=data is not None and (not receipt or receipt.value_json.get('path') != str(path)
            or receipt.value_json.get('hash') != digest(data)))
    return result


def export_markdown(markdown):
    # Classroom links must remain usable outside the web app; never rewrite code.
    lines = []; fence = None
    for line in markdown.splitlines(keepends=True):
        match = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
        if match:
            token = match[1]
            if fence is None: fence = token
            elif token[0] == fence[0] and len(token) >= len(fence): fence = None
            lines.append(line)
        elif fence is not None: lines.append(line)
        else: lines.append(re.sub(r'\]\((/course/[^\s)]+)\)', r'](http://localhost:3001\1)', line))
    return ''.join(lines)

async def export_note(db, user_id, course_id, node_id, body):
    lock = _locks.setdefault(str(user_id), asyncio.Lock())
    async with lock:
        note = await load_notebook(db, user_id, course_id, node_id)
        if note['revision'] != body.revision: raise ConflictError('笔记已更新，请保存并重新打开同步窗口。')
        if not note['markdown'].strip(): raise ValidationError('先写下并保存笔记，再同步到 Obsidian。')
        path = await target(db, user_id, course_id, node_id, note["title"])
        exported = export_markdown(note['markdown'])
        if len(exported) > 60000:
            raise ValidationError('补全课堂链接后笔记超过长度上限，请先拆分内容再同步。')
        data = ('# ' + note['title'].replace('\n',' ') + '\n\n'
            + f'[返回课堂](http://localhost:3001/course/{course_id}/unit/{node_id}?notes=1)\n\n'
            + MARKER + exported).encode('utf-8')
        receipt = await record(db, user_id, str(node_id), course_id)
        try:
            before = read_file(path)
            if before == data:
                await put(db, user_id, str(node_id), {'path': str(path), 'hash': digest(data), 'filename': path.name}, course_id)
                await db.commit()
                return public_file(path, before) | {'synced': True}
            if before is not None and (not receipt or receipt.value_json.get('path') != str(path)
                    or receipt.value_json.get('hash') != digest(before)):
                raise ConflictError('Obsidian 中的笔记已有修改，已停止覆盖。请先预览并载入外部版本。')
            path.parent.mkdir(parents=True, exist_ok=True)
            # Retain a local recovery copy before replacing any prior managed file.
            if before is not None:
                backups = path.parent / '.opentutor-backups'
                if is_redirect(backups): raise ValidationError('备份目录不能是外部链接。')
                backups.mkdir(exist_ok=True)
                backup = backups / (path.stem + '-' + digest(before)[:16] + '.md')
                if not backup.exists():
                    with backup.open('xb') as out: out.write(before)
            # Check again after backup; do not ignore edits made while preparing export.
            if read_file(path) != before: raise ConflictError('外部笔记刚刚发生变化，请重新预览后同步。')
            if before is None:
                with path.open('xb') as out: out.write(data)
            else:
                temporary = path.with_name('.' + uuid.uuid4().hex + '.tmp')
                try:
                    temporary.write_bytes(data)
                    if read_file(path) != before: raise ConflictError('外部笔记刚刚发生变化，请重新预览后同步。')
                    os.replace(temporary, path)
                finally:
                    temporary.unlink(missing_ok=True)
        except OSError as exc:
            raise ValidationError('无法写入 Obsidian 笔记库。课堂笔记仍保存在本机，请检查权限。') from exc
        await put(db, user_id, str(node_id), {'path': str(path), 'hash': digest(data), 'filename': path.name}, course_id)
        await db.commit()
        return public_file(path, data) | {'synced': True}

async def import_note(db, user_id, course_id, node_id, body):
    lock = _locks.setdefault(str(user_id), asyncio.Lock())
    async with lock:
        external = await inspect_note(db, user_id, course_id, node_id)
        if not external['exists'] or external['file_hash'] != body.file_hash:
            raise ConflictError('外部笔记已变化，请重新预览后再载入。')
        note = await load_notebook(db, user_id, course_id, node_id)
        if note['revision'] != body.revision: raise ConflictError('课堂笔记已变化，请重新保存和预览。')
        # Keep the old local text as a recovery record before explicit replacement.
        await put(db, user_id, f'recovery:{node_id}:{note["revision"]}', note, course_id)
        result = await save_notebook(db, user_id, course_id, node_id,
            SaveNotebook(markdown=external['markdown'], revision=body.revision, save_id=uuid.uuid4()))
        await put(db, user_id, str(node_id), {'path': external['path'], 'hash': external['file_hash'], 'filename': Path(external['path']).name}, course_id)
        await db.commit()
        return result
