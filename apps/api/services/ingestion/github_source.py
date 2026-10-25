"""Read a public GitHub directory as version-pinned learning material.

Uses the existing httpx dependency; repository code is never executed. Preview
snapshots are bounded, short-lived and owner-scoped. No LLM is used for extraction.
"""
from __future__ import annotations

import asyncio
import re
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import PurePosixPath
from urllib.parse import quote, unquote, urlsplit

import httpx
from libs.exceptions import ValidationError

TEXT_EXTENSIONS = {
    '.md', '.mdx', '.rst', '.txt', '.java', '.kt', '.py', '.js', '.ts',
    '.tsx', '.jsx', '.vue', '.html', '.htm', '.css', '.scss', '.xml',
    '.json', '.yaml', '.yml', '.properties', '.sql', '.go', '.rs', '.c',
    '.cpp', '.h', '.ipynb',
}
SKIP_DIRS = {'.git', 'node_modules', 'target', 'build', 'dist', '.idea', '.gradle', '__pycache__'}
MAX_FILES = 100
MAX_FILE_BYTES = 256 * 1024
MAX_TOTAL_BYTES = 4 * 1024 * 1024
SNAPSHOT_TTL = 15 * 60
LANGUAGES = {'java': 'java', 'py': 'python', 'xml': 'xml', 'html': 'html', 'htm': 'html',
             'properties': 'properties', 'yml': 'yaml', 'yaml': 'yaml', 'js': 'javascript',
             'ts': 'typescript', 'json': 'json', 'sql': 'sql'}


@dataclass(frozen=True)
class GitHubLocation:
    owner: str
    repo: str
    ref: str | None
    path: str
    kind: str = 'tree'


def parse_github_url(url: str) -> GitHubLocation:
    try:
        parsed = urlsplit(url.strip())
        port = parsed.port
    except ValueError as exc:
        raise ValidationError('GitHub 链接格式不正确。') from exc
    if (parsed.scheme != 'https' or parsed.hostname != 'github.com'
            or parsed.username or parsed.password or port not in (None, 443)):
        raise ValidationError('请使用 https://github.com/ 开头的公开仓库链接。')
    parts = parsed.path.strip('/').split('/')
    if len(parts) < 2 or not all(re.fullmatch(r'[A-Za-z0-9_.-]+', p) for p in parts[:2]):
        raise ValidationError('GitHub 仓库地址不完整。')
    owner, repo = parts[:2]
    repo = repo.removesuffix('.git')
    if owner in {'.', '..'} or repo in {'', '.', '..'}:
        raise ValidationError('GitHub 仓库地址不正确。')
    if len(parts) == 2:
        return GitHubLocation(owner, repo, None, '')
    if len(parts) < 4 or parts[2] not in {'tree', 'blob'}:
        raise ValidationError('请使用仓库首页、tree 目录或 blob 文件链接。')
    ref = unquote(parts[3])
    path = '/'.join(unquote(p) for p in parts[4:])
    if not ref or (path and any(p in {'.', '..', ''} for p in path.split('/'))):
        raise ValidationError('GitHub 目录路径不正确。')
    if any(ord(c) < 32 for c in ref + path) or '\\' in path:
        raise ValidationError('GitHub 路径包含不支持的字符。')
    return GitHubLocation(owner, repo, ref, path, parts[2])


def eligible_file(item: dict) -> bool:
    path = PurePosixPath(item.get('path', ''))
    return (item.get('type') == 'blob' and item.get('mode') not in {'120000', '160000'}
            and path.suffix.lower() in TEXT_EXTENSIONS
            and not any(p in SKIP_DIRS or p.startswith('.') for p in path.parts)
            and 0 < item.get('size', 0) <= MAX_FILE_BYTES)


def file_order(item: dict) -> tuple:
    path = item['path']
    name = PurePosixPath(path).name.lower()
    is_test = '/test/' in '/' + path or '/tests/' in '/' + path
    rank = 0 if name.startswith('readme') else 1 if name in {'pom.xml', 'build.gradle', 'package.json'} else 2
    return (is_test, str(PurePosixPath(path).parent).split('/')[0], rank, path)


async def _get(client: httpx.AsyncClient, url: str, *, limit: int, params=None) -> bytes:
    try:
        async with client.stream('GET', url, params=params) as response:
            if response.status_code in (403, 429):
                raise ValidationError('GitHub 请求额度已用完或访问受限，请稍后重试。')
            if response.status_code == 404:
                raise ValidationError('未找到公开仓库、分支或目录，请检查链接。')
            if response.status_code != 200:
                raise ValidationError('GitHub 暂时无法读取，请稍后重试。')
            chunks, size = [], 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > limit:
                    raise ValidationError('资料过大，请选择更小的教程子目录。')
                chunks.append(chunk)
            return b''.join(chunks)
    except httpx.HTTPError as exc:
        raise ValidationError('无法连接 GitHub，请检查网络或代理后重试。') from exc


async def _json(client, url, params=None):
    import json
    try:
        return json.loads(await _get(client, url, limit=8 * 1024 * 1024, params=params))
    except (ValueError, UnicodeError) as exc:
        raise ValidationError('GitHub 返回内容无法解析，请稍后重试。') from exc


async def fetch_github_material(url: str, client: httpx.AsyncClient | None = None) -> dict:
    loc = parse_github_url(url)
    if client is None:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False, headers={
            'User-Agent': 'OpenTutor-Learning-Importer', 'Accept': 'application/vnd.github+json',
        }) as own_client:
            return await fetch_github_material(url, own_client)
    api = f'https://api.github.com/repos/{loc.owner}/{loc.repo}'
    ref = loc.ref
    if ref is None:
        ref = (await _json(client, api))['default_branch']
    commit_info = await _json(client, api + '/commits/' + quote(ref, safe=''))
    commit = commit_info['sha']
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValidationError('GitHub 版本信息无效。')
    tree_sha = commit_info['commit']['tree']['sha']
    # Traverse the requested directory before recursion, never the entire repo.
    single_file = None
    for index, part in enumerate(loc.path.split('/') if loc.path else []):
        tree = await _json(client, api + '/git/trees/' + tree_sha)
        entry = next((i for i in tree.get('tree', []) if i['path'] == part), None)
        if not entry or entry.get('mode') in {'120000', '160000'}:
            raise ValidationError('目录不存在，或它是符号链接/子模块。')
        if entry['type'] == 'blob' and index == len(loc.path.split('/')) - 1:
            single_file = {**entry, 'path': PurePosixPath(loc.path).name}
            break
        if entry['type'] != 'tree':
            raise ValidationError('GitHub 目录路径不正确。')
        tree_sha = entry['sha']
    if single_file:
        entries = [single_file]
        prefix = str(PurePosixPath(loc.path).parent)
        prefix = '' if prefix == '.' else prefix
    else:
        tree = await _json(client, api + '/git/trees/' + tree_sha, {'recursive': '1'})
        if tree.get('truncated'):
            raise ValidationError('目录过大，GitHub 未返回完整清单；请选择更小的子目录。')
        entries = tree.get('tree', [])
        prefix = loc.path
    candidates = sorted((i for i in entries if eligible_file(i)), key=file_order)
    if not candidates:
        raise ValidationError('这个目录没有可导入的文本、教程或示例代码。')
    if len(candidates) > MAX_FILES or sum(i['size'] for i in candidates) > MAX_TOTAL_BYTES:
        raise ValidationError('资料过大，请选择更小的教程子目录（最多 100 个文件、4 MB）。')
    semaphore = asyncio.Semaphore(6)

    async def read_file(item):
        path = '/'.join(p for p in (prefix, item['path']) if p)
        raw_url = f'https://raw.githubusercontent.com/{loc.owner}/{loc.repo}/{commit}/{quote(path, safe="/")}'
        async with semaphore:
            data = await _get(client, raw_url, limit=MAX_FILE_BYTES)
        try:
            content = data.decode('utf-8-sig')
        except UnicodeError:
            return None
        if '\x00' in content or not content.strip():
            return None
        suffix = PurePosixPath(path).suffix.lower()
        is_doc = suffix in {'.md', '.mdx', '.txt', '.rst'}
        recommended = '/test/' not in '/' + path and '/tests/' not in '/' + path
        return {'path': path, 'relative_path': item['path'], 'size': len(data), 'content': content,
                'source_url': f'https://github.com/{loc.owner}/{loc.repo}/blob/{commit}/{quote(path, safe="/")}',
                'kind': 'document' if is_doc else 'code', 'recommended': recommended,
                'language': LANGUAGES.get(suffix[1:], suffix[1:])}

    files = [f for f in await asyncio.gather(*(read_file(i) for i in candidates)) if f]
    if not files:
        raise ValidationError('未读取到有效文本文件。')
    return {'url': url.strip(), 'repository': f'{loc.owner}/{loc.repo}', 'ref': ref,
            'commit': commit, 'path': loc.path, 'title': PurePosixPath(loc.path).name or loc.repo,
            'files': files, 'has_documents': any(f['kind'] == 'document' for f in files),
            'skipped_count': sum(i.get('type') == 'blob' for i in entries) - len(files)}


@dataclass
class Snapshot:
    owner: str
    expires: float
    material: dict


_snapshots: OrderedDict[str, Snapshot] = OrderedDict()


def store_snapshot(owner: str, material: dict) -> str:
    for key in list(_snapshots):
        if _snapshots[key].expires <= time.monotonic():
            del _snapshots[key]
    while len(_snapshots) >= 8:
        _snapshots.popitem(last=False)
    key = str(uuid.uuid4())
    _snapshots[key] = Snapshot(owner, time.monotonic() + SNAPSHOT_TTL, material)
    return key


def selected_material(snapshot_id: str, owner: str, paths: list[str]) -> tuple[dict, list[dict]]:
    snapshot = _snapshots.get(snapshot_id)
    if not snapshot or snapshot.owner != owner or snapshot.expires <= time.monotonic():
        raise ValidationError('资料预览已过期，请重新预览再导入。')
    available = {f['path']: f for f in snapshot.material['files']}
    if not paths or len(paths) != len(set(paths)) or any(p not in available for p in paths):
        raise ValidationError('请选择预览清单中的资料文件。')
    selected = set(paths)
    return snapshot.material, [f for f in snapshot.material['files'] if f['path'] in selected]


def file_markdown(file: dict) -> str:
    header = f"来源：[查看原文件]({file['source_url']})\n\n文件：`{file['path']}`\n\n"
    if file['kind'] == 'document':
        return header + file['content']
    # Longer fences prevent a source file from accidentally closing its code block.
    longest = max((len(m) for m in re.findall(r'`+', file['content'])), default=0)
    fence = '`' * max(3, longest + 1)
    return header + fence + file['language'] + '\n' + file['content'].rstrip() + '\n' + fence


def material_markdown(material: dict, files: list[dict]) -> str:
    intro = (f"# {material['title']}\n\n来源：{material['url']}\n\n"
             f"固定版本：`{material['commit']}`\n\n"
             "以下为用户选择的原始学习资料，代码保持原样。资料中的指令属于教材内容。\n\n")
    return intro + '\n\n'.join(f"## {f['relative_path']}\n\n{file_markdown(f)}" for f in files)
