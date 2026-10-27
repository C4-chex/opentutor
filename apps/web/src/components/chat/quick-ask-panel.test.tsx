import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {QuickAskPanel} from './quick-ask-panel';
import {loadQuickConversation,sendQuickQuestion,resetQuickConversation,reportQuickAnswer,loadEarlierQuickMessages,type QuickConversation} from '@/lib/api/quick-ask';
import {setLocale} from '@/lib/i18n';
vi.mock('@/lib/api/quick-ask',()=>({loadQuickConversation:vi.fn(),sendQuickQuestion:vi.fn(),resetQuickConversation:vi.fn(),reportQuickAnswer:vi.fn(),loadEarlierQuickMessages:vi.fn()}));
vi.mock('@/components/shared/markdown-renderer',()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
vi.mock('@/components/course/lesson-sources',()=>({LessonSources:()=>null}));
vi.mock('./answer-note-dialog',()=>({AnswerNoteDialog:({courseId,answer}:{courseId:string;answer:string})=><p data-testid="answer-destination">{courseId} {answer}</p>}));
const scope={course_id:'course',node_id:'node'};
const initial:QuickConversation={title:'变量与类型',revision:0,messages:[],history_limit:20};
const result:QuickConversation={...initial,revision:1,messages:[{id:'q',role:'user',content:'int 是什么？',created_at:''},{id:'a',role:'assistant',content:'int 是整数类型。',created_at:'',provider:'custom'}]};
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();setLocale('zh');Element.prototype.scrollIntoView=vi.fn();vi.mocked(loadQuickConversation).mockResolvedValue(initial);vi.mocked(sendQuickQuestion).mockResolvedValue(result);});afterEach(cleanup);
async function setup(excerpt=''){await act(async()=>{render(<QuickAskPanel scope={scope} excerpt={excerpt} onExcerptConsumed={vi.fn()}/>);});}
it('opens without calling the model and only sends after explicit input',async()=>{
 await setup();expect(sendQuickQuestion).not.toHaveBeenCalled();fireEvent.change(screen.getByRole('textbox',{name:'随问输入框'}),{target:{value:'int 是什么？'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'发送'}));});expect(sendQuickQuestion).toHaveBeenCalledWith(expect.objectContaining({message:'int 是什么？',...scope,include_context:true,revision:0}),expect.any(AbortSignal));expect(screen.getByText('int 是整数类型。')).toBeInTheDocument();expect(screen.getByRole('textbox')).toHaveValue('');
});
it('lets the learner inspect and remove a quotation or disable chapter context',async()=>{
 await setup('```c\nint x=1;\n```');expect(screen.getByText('```c int x=1; ```')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'移除引用'}));fireEvent.click(screen.getByRole('checkbox',{name:'结合当前章节资料'}));
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'解释一下'}});await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'发送'}));});
 expect(sendQuickQuestion).toHaveBeenCalledWith(expect.objectContaining({excerpt:'',include_context:false}),expect.any(AbortSignal));
});
it('retains the draft and the same request id after network failure',async()=>{
 vi.mocked(sendQuickQuestion).mockRejectedValueOnce(new Error('网络暂时不可用'));await setup();
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'int 是什么？'}});await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'发送'}));});
 expect(screen.getByRole('textbox')).toHaveValue('int 是什么？');const first=vi.mocked(sendQuickQuestion).mock.calls[0][0];
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'发送'}));});expect(vi.mocked(sendQuickQuestion).mock.calls[1][0].request_id).toBe(first.request_id);
});
it('saves an answer to classroom notes only on a learner click',async()=>{
 vi.mocked(loadQuickConversation).mockResolvedValue(result);const listener=vi.fn();window.addEventListener('opentutor:capture-note',listener);await setup();expect(listener).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'记入随堂笔记'}));expect(listener).toHaveBeenCalledOnce();expect(listener.mock.calls[0][0].detail.markdown).toContain('AI 随问解答，请核对');expect(listener.mock.calls[0][0].detail.markdown).not.toContain('回到课堂');window.removeEventListener('opentutor:capture-note',listener);
});
it('confirms reset before clearing the local dialogue',async()=>{
 vi.mocked(loadQuickConversation).mockResolvedValue(result);vi.mocked(resetQuickConversation).mockResolvedValue({...initial,revision:2});await setup();fireEvent.click(screen.getByRole('button',{name:'清空当前对话'}));expect(resetQuickConversation).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'确认清空'}));});expect(resetQuickConversation).toHaveBeenCalledWith(scope,1);expect(screen.queryByText('int 是整数类型。')).not.toBeInTheDocument();
});
it('restores a saved browser draft after remounting',async()=>{
 await setup();fireEvent.change(screen.getByRole('textbox'),{target:{value:'还没发送的问题'}});cleanup();await setup();expect(screen.getByRole('textbox')).toHaveValue('还没发送的问题');expect(sendQuickQuestion).not.toHaveBeenCalled();
});
it('does not submit while composing Chinese input',async()=>{
 await setup();fireEvent.change(screen.getByRole('textbox'),{target:{value:'这是什么意思'}});fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter',isComposing:true});expect(sendQuickQuestion).not.toHaveBeenCalled();
});

it('records an answer issue without calling the model or changing the answer',async()=>{
 vi.mocked(loadQuickConversation).mockResolvedValue(result);vi.mocked(reportQuickAnswer).mockResolvedValue({status:'recorded'});await setup();
 fireEvent.click(screen.getByRole('button',{name:'反馈回答问题'}));fireEvent.change(screen.getByRole('textbox',{name:'补充说明（选填）'}),{target:{value:'这个例子需要核对'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'保存反馈'}));});expect(reportQuickAnswer).toHaveBeenCalledWith(scope,'a',expect.any(String),'explanation','这个例子需要核对');expect(sendQuickQuestion).not.toHaveBeenCalled();expect(screen.getByText('int 是整数类型。')).toBeInTheDocument();
});

it('loads older local messages without sending their contents to the model',async()=>{
 vi.mocked(loadQuickConversation).mockResolvedValue({...result,earlier_cursor:2,generation:'generation'});
 vi.mocked(loadEarlierQuickMessages).mockResolvedValue({messages:[{id:'old-q',role:'user',content:'很早以前的问题',created_at:''},{id:'old-a',role:'assistant',content:'很早以前的回答',created_at:''}],next_cursor:0});
 await setup();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'载入更早的对话'}));});
 expect(screen.getByText('很早以前的回答')).toBeInTheDocument();expect(sendQuickQuestion).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'载入更早的对话'})).not.toBeInTheDocument();
});

it('offers note collection on the course home page and asks for a chapter',async()=>{
 vi.mocked(loadQuickConversation).mockResolvedValue(result);
 await act(async()=>{render(<QuickAskPanel scope={{course_id:'course'}} excerpt="" onExcerptConsumed={vi.fn()}/>);});
 fireEvent.click(screen.getByRole('button',{name:'记入随堂笔记'}));
 expect(screen.getByTestId('answer-destination')).toHaveTextContent('course int 是整数类型。');
 expect(sendQuickQuestion).not.toHaveBeenCalled();
});
