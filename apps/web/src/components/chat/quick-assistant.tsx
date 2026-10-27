"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import dynamic from 'next/dynamic';
import {MessageCircle,X,Maximize2,Minimize2} from 'lucide-react';
import {useUiText} from '@/hooks/use-ui-text';
import {QuickAskPanel} from './quick-ask-panel';
import {selectionMarkdown} from '@/lib/classroom-notes';
import {getHealthStatus} from '@/lib/api';
const CourseChat=dynamic(()=>import('./chat-view').then(module=>module.ChatView),{ssr:false});

export function QuickAssistant(){
 const ui=useUiText();const pathname=usePathname();
 const match=pathname.match(/^\/course\/([0-9a-f-]+)(?:\/unit\/([0-9a-f-]+))?/i);
 const courseId=match?.[1],nodeId=match?.[2];
 const scope={...(courseId?{course_id:courseId}:{}),...(nodeId?{node_id:nodeId}:{})};
 const key=nodeId||courseId||'general';
 const [open,setOpen]=useState(false);const [mounted,setMounted]=useState(false);const [expanded,setExpanded]=useState(false);
 const [mode,setMode]=useState<'quick'|'course'>('quick');const [excerpt,setExcerpt]=useState('');const [selection,setSelection]=useState('');
 const excerptScope=useRef('');
 const [aiEnabled,setAiEnabled]=useState(true);const panel=useRef<HTMLElement>(null);
 const show=useCallback(()=>{setMounted(true);setOpen(true);},[]);
 useEffect(()=>{setExcerpt('');setSelection('');setMode('quick');},[key]);
 useEffect(()=>{
  if(!open)return;let live=true;getHealthStatus().then(status=>{if(live)setAiEnabled(!['mock_fallback','configuration_required'].includes(status.llm_status));}).catch(()=>{});return()=>{live=false;};
 },[open]);
 useEffect(()=>{
  function openCourse(){if(courseId){setMode('course');show();}}
  function askSelection(event:Event){const data=(event as CustomEvent).detail;if(data?.courseId===courseId&&data?.nodeId===nodeId&&typeof data.markdown==='string'){excerptScope.current=key;setExcerpt(data.markdown.slice(0,6000));setMode('quick');show();}}
  window.addEventListener('opentutor:open-course-chat',openCourse);window.addEventListener('opentutor:ask-selection',askSelection);
  return()=>{window.removeEventListener('opentutor:open-course-chat',openCourse);window.removeEventListener('opentutor:ask-selection',askSelection);};
 },[courseId,nodeId,show]);
 useEffect(()=>{
  function selected(){
   const value=window.getSelection();if(!value||value.isCollapsed||!value.rangeCount||value.toString().length>6000){setSelection('');return;}
   const range=value.getRangeAt(0);const ancestor=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
   if(!document.querySelector('#main-content')?.contains(range.commonAncestorContainer)||ancestor?.closest('[data-quick-assistant],input,textarea,[contenteditable="true"]')){setSelection('');return;}
   const markdown=selectionMarkdown(value);setSelection(markdown.length<=6000?markdown:'');
  }
  document.addEventListener('selectionchange',selected);return()=>document.removeEventListener('selectionchange',selected);
 },[]);
 useEffect(()=>{
  function close(event:KeyboardEvent){if(event.key==='Escape'&&!event.defaultPrevented&&panel.current?.contains(document.activeElement)){setOpen(false);}}
  document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);
 },[]);
 if(/^\/(welcome|onboarding|login|auth)(\/|$)/.test(pathname))return null;
 return <div data-quick-assistant>
  <button type="button" aria-label={ui(open?'Minimize assistant':'Open quick assistant')} aria-expanded={open} onClick={()=>{if(open)setOpen(false);else show();}} className="fixed bottom-6 right-6 z-[45] flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm text-brand-foreground shadow-lg hover:bg-brand/90">
   {open?<X className="size-4"/>:<MessageCircle className="size-4"/>}{ui('Quick question')}
  </button>
  {mounted&&<section ref={panel} aria-label={ui('Quick assistant panel')} hidden={!open} className={`${open?'flex':'hidden'} fixed z-[45] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ${expanded?'inset-x-3 top-4 bottom-24 sm:inset-x-auto sm:right-6 sm:w-[560px]':'bottom-24 right-3 sm:right-6 w-[min(420px,calc(100vw-1.5rem))] h-[min(640px,calc(100dvh-8rem))]'}`}>
   <header className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-2">
    <button type="button" aria-pressed={mode==='quick'} onClick={()=>setMode('quick')} className={`rounded-lg px-3 py-2 text-sm ${mode==='quick'?'bg-brand/10 text-brand':'text-muted-foreground'}`}>{ui('Quick assistant')}</button>
    {courseId&&<button type="button" aria-pressed={mode==='course'} onClick={()=>setMode('course')} className={`rounded-lg px-3 py-2 text-sm ${mode==='course'?'bg-brand/10 text-brand':'text-muted-foreground'}`}>{ui('Course agent')}</button>}
    <button type="button" onClick={()=>setExpanded(v=>!v)} aria-label={ui(expanded?'Shrink assistant':'Expand assistant')} className="ml-auto rounded p-2 hover:bg-muted">{expanded?<Minimize2 className="size-4"/>:<Maximize2 className="size-4"/>}</button>
    <button type="button" onClick={()=>setOpen(false)} aria-label={ui('Minimize assistant')} className="rounded p-2 hover:bg-muted"><X className="size-4"/></button>
   </header>
   {selection&&mode==='quick'&&<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{excerptScope.current=key;setExcerpt(selection);setSelection('');window.getSelection()?.removeAllRanges();}} className="shrink-0 border-b border-border px-4 py-2 text-left text-xs text-brand underline">{ui('Quote selected text in question')}</button>}
   <div className={`${mode==='quick'?'flex':'hidden'} min-h-0 flex-1 flex-col`}><QuickAskPanel key={key} scope={scope} excerpt={excerptScope.current===key?excerpt:''} onExcerptConsumed={()=>setExcerpt('')}/></div>
   {mode==='course'&&courseId&&<div className="flex min-h-0 flex-1 flex-col"><p className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">{ui('The course agent can use course tools. For small questions, use Quick assistant.')}</p><div className="min-h-0 flex-1"><CourseChat key={courseId} courseId={courseId} aiActionsEnabled={aiEnabled}/></div></div>}
  </section>}
 </div>;
}
