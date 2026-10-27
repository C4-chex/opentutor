import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ObsidianSync} from './obsidian-sync';
import {inspectObsidianNote,exportObsidianNote,importObsidianNote} from '@/lib/api/obsidian';
import {setLocale} from '@/lib/i18n';
vi.mock('@/lib/api/obsidian',()=>({inspectObsidianNote:vi.fn(),exportObsidianNote:vi.fn(),importObsidianNote:vi.fn()}));
vi.mock('@/components/shared/markdown-renderer',()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
const external={path:'D:\\Vault\\OpenTutor\\chapter.md',uri:'obsidian://open?path=test',markdown:'External draft',file_hash:'a'.repeat(64),exists:true,revision:2,external_changed:false};
const onImported=vi.fn(async()=>{});
beforeEach(()=>{vi.clearAllMocks();setLocale('zh');vi.mocked(inspectObsidianNote).mockResolvedValue(external);vi.mocked(exportObsidianNote).mockResolvedValue(external);vi.mocked(importObsidianNote).mockResolvedValue({});});afterEach(cleanup);
async function setup(){render(<ObsidianSync courseId="course" nodeId="node" revision={2} onImported={onImported}/>);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'同步到 Obsidian'}));});}
it('only reads on open and exports on explicit click',async()=>{
 await setup();expect(exportObsidianNote).not.toHaveBeenCalled();expect(importObsidianNote).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'将当前笔记保存到 Obsidian'}));});
 expect(exportObsidianNote).toHaveBeenCalledWith('course','node',2);expect(screen.getByRole('link',{name:'在 Obsidian 中打开'})).toHaveAttribute('href',external.uri);
});
it('blocks exporting external edits, previews and requires explicit import confirmation',async()=>{
 vi.mocked(inspectObsidianNote).mockResolvedValue({...external,external_changed:true});await setup();
 expect(screen.getByRole('button',{name:'将当前笔记保存到 Obsidian'})).toBeDisabled();
 fireEvent.click(screen.getByText('预览 Obsidian 版本'));expect(screen.getByText('External draft')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'载入 Obsidian 版本'}));expect(importObsidianNote).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'确认载入外部版本'}));});
 expect(importObsidianNote).toHaveBeenCalledWith('course','node',2,'a'.repeat(64));expect(onImported).toHaveBeenCalledOnce();
 expect(screen.getByText('外部版本已载入随堂笔记。')).toBeInTheDocument();
});
it('does not sync stale local versions and offers settings when no vault is connected',async()=>{
 vi.mocked(inspectObsidianNote).mockResolvedValue({...external,revision:3});await setup();
 expect(screen.getByRole('alert')).toHaveTextContent('笔记已在其他页面更新');expect(screen.queryByRole('button',{name:'将当前笔记保存到 Obsidian'})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'配置 Obsidian 笔记库'})).toHaveAttribute('href','/settings#obsidian');
});
it('disables sync when there is an unsaved editor draft',()=>{
 render(<ObsidianSync courseId="course" nodeId="node" revision={2} disabled onImported={onImported}/>);
 expect(screen.getByRole('button',{name:'同步到 Obsidian'})).toBeDisabled();expect(inspectObsidianNote).not.toHaveBeenCalled();
});
