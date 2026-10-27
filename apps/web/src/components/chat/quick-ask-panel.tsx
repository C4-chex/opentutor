"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useUiText} from '@/hooks/use-ui-text';
import {MarkdownRenderer} from '@/components/shared/markdown-renderer';
import {LessonSources} from '@/components/course/lesson-sources';
import {AnswerNoteDialog} from './answer-note-dialog';
import {loadQuickConversation,sendQuickQuestion,resetQuickConversation,reportQuickAnswer,loadEarlierQuickMessages,type QuickMessage,type AskScope,type QuickConversation,type Question} from '@/lib/api/quick-ask';

export function QuickAskPanel({scope,excerpt,onExcerptConsumed}:{scope:AskScope;excerpt:string;onExcerptConsumed:()=>void}){
 const ui=useUiText();const key=`opentutor:quick-draft:${scope.node_id||scope.course_id||'general'}`;
 const [noteAnswer,setNoteAnswer]=useState<string|null>(null);
 const [conversation,setConversation]=useState<QuickConversation|null>(null);
 const [earlier,setEarlier]=useState<QuickMessage[]>([]);const [cursor,setCursor]=useState(0);const [historyBusy,setHistoryBusy]=useState(false);
 const current=useRef<QuickConversation|null>(null);
 const [text,setText]=useState('');const [quote,setQuote]=useState('');const [useContext,setUseContext]=useState(!!scope.node_id);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [storageWarning,setStorageWarning]=useState(false);
 const [confirmReset,setConfirmReset]=useState(false);const [notice,setNotice]=useState('');
 const [report,setReport]=useState<string|null>(null);const [reportNote,setReportNote]=useState('');const [reportKind,setReportKind]=useState('explanation');const [reportBusy,setReportBusy]=useState(false);
 const loadEpoch=useRef(0);
 const pending=useRef<Question|null>(null);const abort=useRef<AbortController|null>(null);const live=useRef(true);const end=useRef<HTMLDivElement>(null);
 const draft=useRef({text:'',quote:'',include_context:!!scope.node_id});
 function accept(result:QuickConversation){
  const previous=current.current;
  if(!previous||previous.generation!==result.generation||result.revision-previous.revision>1){setEarlier([]);setCursor(result.earlier_cursor||0);}
  else{const ids=new Set(result.messages.map(m=>m.id));const moved=previous.messages.filter(m=>!ids.has(m.id));if(moved.length)setEarlier(old=>[...new Map([...old,...moved].map(m=>[m.id,m])).values()]);}
  current.current=result;setConversation(result);
 }
 async function earlierHistory(){if(!conversation?.generation||!cursor)return;setHistoryBusy(true);setError('');try{
   const version=conversation.generation;const result=await loadEarlierQuickMessages(scope,cursor,version);
   if(live.current&&current.current?.generation===version){setEarlier(old=>[...new Map([...result.messages,...old].map(m=>[m.id,m])).values()]);setCursor(result.next_cursor);}
  }catch(e){if(live.current)setError((e as Error).message);}finally{if(live.current)setHistoryBusy(false);}
 }
 function cache(){try{sessionStorage.setItem(key,JSON.stringify({...draft.current,pending:pending.current}));}catch{setStorageWarning(true);}}
 function edit(value:string){draft.current.text=value;setText(value);cache();}
 function changeQuote(value:string){draft.current.quote=value;setQuote(value);cache();}
 async function load(){const epoch=++loadEpoch.current;setLoading(true);setError('');try{const result=await loadQuickConversation(scope);if(live.current&&epoch===loadEpoch.current){accept(result);const p=pending.current;if(p&&p.message===draft.current.text.trim()&&p.excerpt===draft.current.quote&&result.messages.some(m=>m.request_id===p.request_id)){pending.current=null;draft.current.text='';draft.current.quote='';setText('');setQuote('');cache();}}}catch(e){if(live.current&&epoch===loadEpoch.current)setError((e as Error).message);}finally{if(live.current&&epoch===loadEpoch.current)setLoading(false);}}
 useEffect(()=>{
  live.current=true;
  try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&typeof saved.text==='string'){
   draft.current={text:saved.text,quote:typeof saved.quote==='string'?saved.quote:'',include_context:typeof saved.include_context==='boolean'?saved.include_context:!!scope.node_id};
   setText(draft.current.text);setQuote(draft.current.quote);setUseContext(draft.current.include_context);pending.current=saved.pending||null;
  }}catch{setStorageWarning(true);}
  void load();return()=>{live.current=false;loadEpoch.current++;abort.current?.abort();};
 // A keyed panel owns one scope for its entire lifetime.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 useEffect(()=>{if(excerpt){changeQuote(excerpt);onExcerptConsumed();}},[excerpt]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[conversation?.revision,busy]);
 async function send(){
  if(busy||!conversation||!text.trim())return;
  const body={...scope,message:text.trim(),excerpt:quote,include_context:useContext,revision:conversation.revision};
  const previous=pending.current;
  const same=previous&&previous.message===body.message&&previous.excerpt===body.excerpt&&previous.include_context===body.include_context;
  const question=same?{...previous,revision:conversation.revision}:{...body,request_id:crypto.randomUUID()};
  pending.current=question;cache();setBusy(true);setError('');setNotice('');const controller=new AbortController();abort.current=controller;
  try{
   const result=await sendQuickQuestion(question,controller.signal);
   if(!live.current)return;accept(result);pending.current=null;draft.current={text:'',quote:'',include_context:useContext};setText('');setQuote('');cache();
  }catch(e){if(!live.current)return;setError((e as Error).name==='AbortError'?ui('Stopped waiting. Your question is kept. Reload history before retrying.'): (e as Error).message);}
  finally{if(live.current)setBusy(false);}
 }
 async function reset(){
  if(!conversation)return;setBusy(true);setError('');try{const result=await resetQuickConversation(scope,conversation.revision);if(live.current){current.current=null;setEarlier([]);setCursor(0);accept(result);pending.current=null;cache();setConfirmReset(false);}}
  catch(e){if(live.current)setError((e as Error).message);}finally{if(live.current)setBusy(false);}
 }
 async function saveReport(){if(!report)return;setReportBusy(true);setError('');try{await reportQuickAnswer(scope,report,crypto.randomUUID(),reportKind,reportNote);setReport(null);setReportNote('');setNotice(ui('Feedback saved locally. It does not change your learning record or automatically verify the answer.'));}catch(e){setError((e as Error).message);}finally{setReportBusy(false);}}
 function collect(answer:string){
  if(!scope.node_id){setNoteAnswer(answer);return;}
  setError('');
  const capture={handled:false,courseId:scope.course_id,nodeId:scope.node_id,markdown:`## ${ui('AI quick answer — check before using')}\n\n${answer}`};
  window.dispatchEvent(new CustomEvent('opentutor:capture-note',{detail:capture}));
  if(capture.handled)setNotice(ui('Answer sent to classroom notes. Check it before using.'));else setNoteAnswer(answer);
 }
 return <div className="flex min-h-0 flex-1 flex-col">
  {noteAnswer!==null&&scope.course_id&&<AnswerNoteDialog courseId={scope.course_id} initialNodeId={scope.node_id} answer={noteAnswer} onClose={()=>setNoteAnswer(null)} onSaved={()=>{setNoteAnswer(null);setNotice(ui('Answer saved to classroom notes.'));}}/>}
  <div className="border-b border-border px-4 py-2 text-xs space-y-2">
   <div className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1 truncate" title={conversation?.title}>{scope.course_id?(conversation?.title||ui('Quick question')):ui('General questions')}</span><Link href="/settings" className="underline">{ui('Model and API settings')}</Link></div>
   {scope.node_id&&<label className="flex items-center gap-2"><input type="checkbox" checked={useContext} disabled={busy} onChange={e=>{setUseContext(e.target.checked);draft.current.include_context=e.target.checked;cache();}}/>{ui('Use current chapter material')}</label>}
   <p className="text-muted-foreground">{ui('Uses your configured model. When sent, your question, recent chat and enabled excerpts go to that provider. Chats do not count as mastery.')}</p>
  </div>
  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4" aria-live="polite" aria-busy={busy}>
   {loading&&<p role="status" className="text-sm text-muted-foreground">{ui('Loading conversation...')}</p>}
   {!loading&&!conversation?.messages.length&&<p className="text-sm leading-7 text-muted-foreground">{ui('Ask about a term, a line of code or a confusing step. I will explain it briefly; you can ask for more detail.')}</p>}
   {cursor>0&&<button type="button" disabled={historyBusy||busy} onClick={()=>void earlierHistory()} className="w-full rounded-lg border border-border p-2 text-xs underline disabled:opacity-50">{ui(historyBusy?'Loading earlier messages...':'Load earlier messages')}</button>}
   {[...new Map([...earlier,...(conversation?.messages||[])].map(m=>[m.id,m])).values()].map(message=><article key={message.id} className={`space-y-2 rounded-xl p-3 text-sm ${message.role==='user'?'ml-6 bg-brand/10':'mr-2 border border-border bg-background'}`}>
    <p className="text-xs text-muted-foreground">{message.role==='user'?ui('You'):ui('AI assistant')}{message.provider?` · ${message.provider}`:''}</p>
    {message.excerpt&&<details className="text-xs text-muted-foreground"><summary>{ui('Quoted material')}</summary><pre className="mt-2 whitespace-pre-wrap break-words">{message.excerpt}</pre></details>}
    <MarkdownRenderer content={message.content} className="text-sm"/>
    {message.role==='assistant'&&<div className="flex flex-wrap gap-3 text-xs">
     {scope.course_id&&!!message.sources?.length&&<LessonSources courseId={scope.course_id} sources={message.sources}/>}
     <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(message.content);setNotice(ui('Answer copied.'));}catch{setError(ui('Copy failed. Select the answer and copy it manually.'));}}} className="underline">{ui('Copy answer')}</button><button type="button" onClick={()=>{setReport(message.id);setReportNote('');}} className="underline">{ui('Report answer issue')}</button>
     {scope.course_id&&<button type="button" onClick={()=>collect(message.content)} className="underline">{ui('Save answer to classroom notes')}</button>}
    </div>}
    {message.limited_scope&&<p className="text-xs text-muted-foreground">{ui('This answer used only a bounded excerpt of the chapter.')}</p>}
   </article>)}
   {busy&&<p role="status" className="text-sm text-muted-foreground animate-pulse">{ui('The assistant is replying...')}</p>}
   <div ref={end}/>
  </div>
  <div className="shrink-0 border-t border-border bg-card p-3 space-y-2">
   {report&&<div className="rounded-lg border border-border p-2 text-xs space-y-2"><label className="block">{ui('Issue type')}<select value={reportKind} disabled={reportBusy} onChange={e=>setReportKind(e.target.value)} className="ml-2 rounded border border-border bg-background p-1"><option value="explanation">{ui('Incorrect explanation')}</option><option value="source">{ui('Source issue')}</option><option value="other">{ui('Other issue')}</option></select></label><label className="block">{ui('Describe the issue (optional)')}<textarea value={reportNote} disabled={reportBusy} onChange={e=>setReportNote(e.target.value)} maxLength={2000} rows={2} className="mt-1 w-full rounded border border-border bg-background p-2"/></label><button type="button" disabled={reportBusy} onClick={()=>void saveReport()} className="underline">{ui('Save feedback')}</button><button type="button" disabled={reportBusy} onClick={()=>setReport(null)} className="ml-3 underline">{ui('Cancel')}</button></div>}
   {notice&&<p role="status" className="text-xs text-brand">{notice}</p>}
   {error&&<p role="alert" className="text-xs text-destructive">{error} <button type="button" disabled={busy} onClick={()=>void load()} className="underline disabled:opacity-50">{ui('Reload conversation')}</button></p>}
   {storageWarning&&<p className="text-xs text-amber-600">{ui('Browser draft storage is unavailable. Copy unsent questions before leaving.')}</p>}
   {quote&&<div className="rounded-lg border border-border p-2 text-xs"><div className="flex justify-between"><span>{ui('Quoted material')}</span><button type="button" onClick={()=>changeQuote('')} disabled={busy} className="underline">{ui('Remove quote')}</button></div><p className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap text-muted-foreground">{quote}</p></div>}
   <label className="block"><span className="sr-only">{ui('Quick question input')}</span><textarea value={text} onChange={e=>edit(e.target.value)} disabled={busy} maxLength={4000} rows={3} placeholder={ui('Ask a small question… Enter to send, Shift+Enter for a new line')} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm leading-6"/></label>
   <div className="flex items-center gap-3 text-xs">
    <button type="button" disabled={busy||!conversation?.messages.length} onClick={()=>setConfirmReset(v=>!v)} className="underline disabled:opacity-50">{ui('Clear this conversation')}</button>
    <span className="ml-auto"/>{busy?<button type="button" onClick={()=>abort.current?.abort()} className="rounded-lg border border-border px-4 py-2">{ui('Stop waiting')}</button>:<button type="button" disabled={loading||!conversation||!text.trim()} onClick={()=>void send()} className="rounded-lg bg-brand px-4 py-2 text-brand-foreground disabled:opacity-50">{ui('Send question')}</button>}
   </div>
   {confirmReset&&<div className="rounded-lg border border-border p-2 text-xs">{ui('Clear all conversations in this scope? Saved classroom notes will remain.')} <button type="button" onClick={()=>void reset()} disabled={busy} className="underline">{ui('Confirm clear')}</button> <button type="button" onClick={()=>setConfirmReset(false)} className="underline">{ui('Cancel')}</button></div>}
   <p className="text-[10px] text-muted-foreground">{ui('Full conversations are saved locally. Only recent context is sent to the model. AI may make mistakes.')}</p>
  </div>
 </div>;
}
