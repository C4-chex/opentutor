import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AnswerNoteDialog} from './answer-note-dialog';
import {getContentTree} from '@/lib/api/courses';
import {loadClassroomNote,saveClassroomNote} from '@/lib/api/classroom-notes';
import {setLocale} from '@/lib/i18n';
vi.mock('@/lib/api/courses',()=>({getContentTree:vi.fn()}));
vi.mock('@/lib/api/classroom-notes',()=>({loadClassroomNote:vi.fn(),saveClassroomNote:vi.fn()}));
vi.mock('@/components/shared/markdown-renderer',()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
const onSaved=vi.fn(),onClose=vi.fn();
const note={node_id:'chapter',title:'整数除法',markdown:'My existing notes',revision:3,updated_at:null};
beforeEach(()=>{
 vi.clearAllMocks();setLocale('en');
 vi.mocked(getContentTree).mockResolvedValue([{id:'chapter',title:'整数除法',content:'Text',level:0,order_index:0,source_type:'file',children:[]}]);
 vi.mocked(loadClassroomNote).mockResolvedValue(note);
 vi.mocked(saveClassroomNote).mockImplementation(async(_c,_n,markdown,revision)=>({...note,markdown,revision:revision+1}));
});afterEach(cleanup);
async function setup(){await act(async()=>{render(<AnswerNoteDialog courseId="course" answer={'```c\nint x=1;\n```\n$$x=1$$'} onClose={onClose} onSaved={onSaved}/>);});}
async function save(){await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Append to notes'}));});}
it('requires a chapter selection, appends without replacing writing, and does not call AI',async()=>{
 await setup();expect(saveClassroomNote).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Append to notes'})).toBeDisabled();
 fireEvent.change(screen.getByRole('combobox',{name:'Save to chapter'}),{target:{value:'chapter'}});await save();
 expect(saveClassroomNote).toHaveBeenCalledWith('course','chapter',expect.stringContaining('My existing notes\n\n## AI quick answer'),3,expect.any(String));
 const markdown=vi.mocked(saveClassroomNote).mock.calls[0][2];expect(markdown).toContain('```c\nint x=1;\n```');expect(markdown).toContain('$$x=1$$');expect(markdown).not.toContain('Back to lesson');expect(onSaved).toHaveBeenCalledOnce();
});
it('retries the same save id after a lost response to prevent duplicate appends',async()=>{
 vi.mocked(saveClassroomNote).mockRejectedValueOnce(new Error('Network error'));await setup();
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'chapter'}});await save();expect(screen.getByRole('alert')).toHaveTextContent('Network error');await save();
 expect(loadClassroomNote).toHaveBeenCalledOnce();expect(vi.mocked(saveClassroomNote).mock.calls[1]).toEqual(vi.mocked(saveClassroomNote).mock.calls[0]);expect(onSaved).toHaveBeenCalledOnce();
});
it('reloads the latest notebook after a version conflict rather than overwriting it',async()=>{
 vi.mocked(saveClassroomNote).mockRejectedValueOnce(Object.assign(new Error('Version conflict'),{status:409}));await setup();
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'chapter'}});await save();expect(onSaved).not.toHaveBeenCalled();
 vi.mocked(loadClassroomNote).mockResolvedValue({...note,revision:4,markdown:'Updated in another page'});await save();
 expect(saveClassroomNote).toHaveBeenLastCalledWith('course','chapter',expect.stringContaining('Updated in another page'),4,expect.any(String));expect(onSaved).toHaveBeenCalledOnce();
});
it('keeps the answer available when loading the chapter list fails',async()=>{
 vi.mocked(getContentTree).mockRejectedValueOnce(new Error('Cannot load chapters'));await setup();
 expect(screen.getByRole('alert')).toHaveTextContent('Cannot load chapters');expect(screen.getByRole('button',{name:'Append to notes'})).toBeDisabled();expect(saveClassroomNote).not.toHaveBeenCalled();
});

it('reloads the chapter list after a temporary failure without losing the answer',async()=>{
 vi.mocked(getContentTree).mockRejectedValueOnce(new Error('Offline'));await setup();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Reload chapters'}));});
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(screen.getByRole('option',{name:'整数除法'})).toBeInTheDocument();expect(saveClassroomNote).not.toHaveBeenCalled();
});
it('distinguishes same-named README files with their full chapter paths',async()=>{
 const file={title:'README.md',content:'Text',level:1,order_index:0,source_type:'file',children:[]};
 vi.mocked(getContentTree).mockResolvedValue([
  {...file,id:'a',title:'实验一',children:[{...file,id:'readme-a'}]},
  {...file,id:'b',title:'实验二',children:[{...file,id:'readme-b'}]}]);
 await setup();expect(screen.getByRole('option',{name:'实验一 / README.md'})).toHaveValue('readme-a');expect(screen.getByRole('option',{name:'实验二 / README.md'})).toHaveValue('readme-b');
});
