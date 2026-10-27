"use client";
import {useEffect,useRef,useState,useId,type ReactNode} from "react";
import {NotebookPen,X} from "lucide-react";
import {useUiText} from "@/hooks/use-ui-text";
import {useClassroomNotes} from "@/hooks/use-classroom-notes";
import {outlineClassroomNote,type NoteOutline} from "@/lib/api/classroom-notes";
import {downloadNotebook,selectionMarkdown,removeGeneratedLessonLinks} from "@/lib/classroom-notes";
import {ObsidianSync} from "./obsidian-sync";
import {MarkdownRenderer} from "@/components/shared/markdown-renderer";
import {NotebookContext,type ExcerptOrigin} from "./notebook-context";
import {useExcerptDrafts} from "@/hooks/use-excerpt-drafts";
import {ExcerptComposer} from "./excerpt-composer";
export {useClassroomNotebook} from "./notebook-context";

interface Capture {id:string;markdown:string}

function NotebookEditor({courseId,nodeId,title,captures,onHandled,aiActionsEnabled,excerptDrafts,tab,onTab}: {
  courseId:string;nodeId:string;title:string;captures:Capture[];onHandled:(ids:string[])=>void;aiActionsEnabled:boolean;
  excerptDrafts:ReturnType<typeof useExcerptDrafts>;tab:"excerpts"|"notebook";onTab:(tab:"excerpts"|"notebook")=>void;
}) {
  const ui=useUiText();const tabsId=useId();
  const note=useClassroomNotes(courseId,nodeId);
  const [preview,setPreview]=useState(false);
  const [organizing,setOrganizing]=useState(false);
  const [outline,setOutline]=useState<NoteOutline|null>(null);
  const [aiError,setAiError]=useState("");
  const [captureError,setCaptureError]=useState("");
  const handled=useRef(new Set<string>());
  useEffect(()=>{
    if(note.loading)return;
    const pending=captures.filter(item=>!handled.current.has(item.id));
    if(!pending.length)return;
    const ids=pending.map(item=>item.id);
    if(!note.append(pending.map(item=>item.markdown).join("\n\n"))){
      setCaptureError(ui("The notebook is full. Your excerpts are kept here; shorten the note to retry, or export the pending excerpts."));
      return;
    }
    ids.forEach(id=>handled.current.add(id));setCaptureError("");setPreview(false);onHandled(ids);
  },[captures,note.loading,note.append,note.text,onHandled,ui]);
  async function organize(){
    setOrganizing(true);setAiError("");
    try {setOutline(await outlineClassroomNote(courseId,nodeId,note.text));}
    catch(err){setAiError((err as Error).message);}
    finally{setOrganizing(false);}
  }
  const cleanedText=removeGeneratedLessonLinks(note.text,courseId,nodeId);
  const labels={loading:"Loading notebook...",saved:"Saved on this computer",dirty:"Waiting to save...",saving:"Saving notebook...",error:"Not saved yet. Your browser draft is kept.",conflict:"Another page changed this notebook. Your draft is kept."};
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground break-words">{title}</p>
    <p role="status" className={`text-xs ${note.status==="error"||note.status==="conflict"?"text-amber-600 dark:text-amber-400":"text-muted-foreground"}`}>{ui(note.status==="saved"&&!note.text?"Start writing; your notes will save automatically.":labels[note.status])}</p>
    <div role="tablist" aria-label={ui("Notebook views")} className="flex gap-2 border-b border-border pb-2 text-sm">
      <button type="button" role="tab" id={`${tabsId}-excerpts-tab`} aria-controls={`${tabsId}-excerpts`} aria-selected={tab==="excerpts"}
        onClick={()=>onTab("excerpts")} className={`rounded-lg px-3 py-2 ${tab==="excerpts"?"bg-brand/10 text-brand":"text-muted-foreground"}`}>
        {ui("Excerpt and reflection")}{excerptDrafts.drafts.length?` (${excerptDrafts.drafts.length})`:""}
      </button>
      <button type="button" role="tab" id={`${tabsId}-notebook-tab`} aria-controls={`${tabsId}-notebook`} aria-selected={tab==="notebook"}
        onClick={()=>onTab("notebook")} className={`rounded-lg px-3 py-2 ${tab==="notebook"?"bg-brand/10 text-brand":"text-muted-foreground"}`}>{ui("Full chapter notebook")}</button>
    </div>
    <div role="tabpanel" id={`${tabsId}-excerpts`} aria-labelledby={`${tabsId}-excerpts-tab`} hidden={tab!=="excerpts"}>
      <ExcerptComposer drafts={excerptDrafts} note={note} title={title} onShowNotebook={()=>onTab("notebook")}/>
    </div>
    <div role="tabpanel" id={`${tabsId}-notebook`} aria-labelledby={`${tabsId}-notebook-tab`} hidden={tab!=="notebook"} className="space-y-3">
    {captureError&&<div role="alert" className="rounded-lg border border-amber-500/40 p-3 text-xs space-y-2">
      <p>{captureError}</p>
      <button type="button" onClick={()=>downloadNotebook(title+"-pending",captures.map(item=>item.markdown).join("\n\n"))} className="underline">{ui("Export pending excerpts")}</button>
      <details><summary className="cursor-pointer">{ui("Preview pending excerpts")}</summary><MarkdownRenderer content={captures.map(item=>item.markdown).join("\n\n")} className="mt-2 text-sm"/></details>
    </div>}
    {note.storageWarning&&<p role="alert" className="text-xs text-destructive">{ui("Browser draft storage is unavailable. Export your unsaved notes before leaving.")}</p>}
    {note.recovery&&<div className="rounded-lg bg-muted p-2 text-xs space-y-2"><p>{ui("An unfinished browser draft is available.")}</p><button type="button" onClick={note.recover} className="underline">{ui("Recover draft")}</button></div>}
    <div className="flex flex-wrap gap-2 text-xs">
      <button type="button" aria-pressed={!preview} onClick={()=>setPreview(false)} className="rounded border border-border px-3 py-1.5">{ui("Edit notes")}</button>
      <button type="button" aria-pressed={preview} onClick={()=>setPreview(true)} className="rounded border border-border px-3 py-1.5">{ui("Preview notes")}</button>
      <button type="button" disabled={note.loading||note.status==="saving"||note.status==="conflict"} onClick={()=>void(note.status==="error"?note.reload():note.save())} className="rounded border border-border px-3 py-1.5 disabled:opacity-50">{ui("Save now")}</button>
      <button type="button" onClick={()=>downloadNotebook(title,note.text)} disabled={!note.text} className="rounded border border-border px-3 py-1.5 disabled:opacity-50">{ui("Export Markdown")}</button>
    </div>
    {cleanedText!==note.text&&<button type="button" disabled={note.loading} onClick={()=>note.edit(cleanedText)} className="text-xs underline">{ui("Remove old classroom return links")}</button>}
    <ObsidianSync courseId={courseId} nodeId={nodeId} revision={note.revision} disabled={note.status!=="saved"||!note.text} onImported={note.reload}/>
    {preview?<div className="min-h-64 rounded-lg border border-border p-3"><MarkdownRenderer content={note.text||ui("Your notebook is empty.")} className="text-sm"/></div>:
      <label className="block"><span className="sr-only">{ui("Classroom note editor")}</span><textarea value={note.text} onChange={event=>note.edit(event.target.value)} disabled={note.loading} maxLength={60000} placeholder={ui("Write your understanding, questions, code or formulas. Select lesson text or save a teaching point to collect it here.")} className="min-h-80 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm leading-7 focus:ring-2 focus:ring-brand/30"/></label>}
    <p className="text-xs text-muted-foreground">{ui("Automatically saved locally. Markdown, code blocks and LaTeX are supported.")}</p>
    {note.error&&<p role="alert" className="text-xs text-destructive">{note.error}</p>}
    {note.status==="conflict"&&<div className="rounded-lg border border-amber-500/40 p-3 text-xs space-y-2">
      <button type="button" onClick={()=>void note.loadRemote()} className="underline">{ui("View the latest saved version")}</button>
      {note.remote&&<><details><summary className="cursor-pointer">{ui("Latest saved content")}</summary><MarkdownRenderer content={note.remote.markdown} className="mt-2"/></details>
        <button type="button" onClick={note.mergeRemote} className="block underline">{ui("Append my draft to the latest version")}</button>
        <button type="button" onClick={note.useRemote} className="block underline">{ui("Use latest version and keep a recovery copy")}</button></>}
    </div>}
    <div className="border-t border-border pt-3 space-y-2">
      <button type="button" onClick={()=>void organize()} disabled={organizing||note.loading||!aiActionsEnabled} className="rounded-lg bg-brand text-brand-foreground px-3 py-2 text-sm disabled:opacity-50">{organizing?ui("Organizing a preview..."):ui("AI: organize this lesson")}</button>
      <p className="text-xs text-muted-foreground">{ui("Uses your configured model only when clicked. Review the draft before adding it.")}</p>
      {aiError&&<p role="alert" className="text-xs text-destructive">{aiError}</p>}
      {outline&&<div className="rounded-lg border border-brand/40 p-3 space-y-3">
        <p className="text-xs font-medium text-brand">{ui("AI outline preview — check before adding")}</p>
        <MarkdownRenderer content={outline.markdown} className="text-sm"/>
        {outline.limited_scope&&<p className="text-xs text-muted-foreground">{ui("This preview uses a bounded portion of the lesson and notes.")}</p>}
        <div className="flex gap-3 text-xs"><button type="button" className="underline" onClick={()=>{if(note.append(`## ${ui("AI-organized notes — review needed")}\n\n${outline.markdown}`)){setOutline(null);setPreview(false);}}}>{ui("Add outline to my notes")}</button><button type="button" className="underline" onClick={()=>setOutline(null)}>{ui("Discard preview")}</button></div>
      </div>}
    </div>
    </div>
  </div>;
}

export function ClassroomNotebook({courseId,nodeId,title,aiActionsEnabled=true,children}:{courseId:string;nodeId:string;title:string;aiActionsEnabled?:boolean;children:ReactNode}) {
  const ui=useUiText();
  const [open,setOpen]=useState(false);
  const excerptDrafts=useExcerptDrafts(courseId,nodeId);
  const [tab,setTab]=useState<"excerpts"|"notebook">("notebook");
  const restoredDraftsShown=useRef(false);
  useEffect(()=>{if(!restoredDraftsShown.current&&excerptDrafts.drafts.length){restoredDraftsShown.current=true;setTab("excerpts");}},[excerptDrafts.drafts.length]);
  const [captures,setCaptures]=useState<Capture[]>([]);
  const [selection,setSelection]=useState("");
  const selectionOrigin=useRef<ExcerptOrigin>("classroom");
  const study=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    function collect(event:Event){const data=(event as CustomEvent).detail;
      if(data?.courseId===courseId&&data?.nodeId===nodeId&&typeof data.markdown==='string'){
        data.handled=true;setTab("notebook");
        setCaptures(items=>[...items,{id:crypto.randomUUID(),markdown:data.markdown}]);setOpen(true);
      }
    }
    window.addEventListener('opentutor:capture-note',collect);return()=>window.removeEventListener('opentutor:capture-note',collect);
  },[courseId,nodeId]);
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("notes")==="1")setOpen(true);},[]);
  function capture(markdown:string){setTab("notebook");setCaptures(items=>[...items,{id:crypto.randomUUID(),markdown}]);setOpen(true);}
  function annotate(markdown:string,origin:ExcerptOrigin="classroom"){excerptDrafts.add(markdown,origin);setTab("excerpts");setOpen(true);}
  useEffect(()=>{
    function selected(){
      const selected=window.getSelection();
      if(!selected||selected.isCollapsed||!selected.rangeCount){setSelection("");return;}
      const range=selected.getRangeAt(0);
      if(!study.current?.contains(range.commonAncestorContainer)||selected.toString().length>6000){setSelection("");return;}
      const ancestor=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
      if(ancestor?.closest('input,textarea,button,[contenteditable="true"]')){setSelection("");return;}
      selectionOrigin.current=ancestor?.closest("#guided-learning")?"ai":"classroom";
      setSelection(selectionMarkdown(selected));
    }
    document.addEventListener("selectionchange",selected);return()=>document.removeEventListener("selectionchange",selected);
  },[]);
  return <NotebookContext.Provider value={{capture,annotate}}>
    <div className="mb-4 flex justify-end"><button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm"><NotebookPen className="size-4"/>{ui(open?"Hide classroom notes":"Classroom notes")}</button></div>
    <div className={`grid items-start gap-6 ${open?"lg:grid-cols-[minmax(0,1fr)_22rem]":""}`}>
      <div ref={study} className="min-w-0 space-y-8">{children}</div>
      <aside onKeyDown={event=>{if(event.key==="Escape")setOpen(false);}} aria-label={ui("Classroom notes")} className={`${open?"":"hidden"} fixed inset-y-12 right-0 z-40 w-[min(100vw,24rem)] overflow-y-auto border border-border bg-card p-4 shadow-xl lg:sticky lg:top-16 lg:inset-auto lg:z-auto lg:w-auto lg:max-h-[calc(100dvh-5rem)] lg:rounded-2xl lg:shadow-sm`}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{ui("Classroom notes")}</h2><button type="button" onClick={()=>setOpen(false)} aria-label={ui("Close classroom notes")} className="rounded p-1 hover:bg-muted"><X className="size-4"/></button></div>
        <NotebookContext.Provider value={null}><NotebookEditor courseId={courseId} nodeId={nodeId} title={title} captures={captures} onHandled={ids=>setCaptures(items=>items.filter(item=>!ids.includes(item.id)))} aiActionsEnabled={aiActionsEnabled} excerptDrafts={excerptDrafts} tab={tab} onTab={setTab}/></NotebookContext.Provider>
      </aside>
    </div>
    {!open&&<button type="button" onClick={()=>setOpen(true)} className="fixed bottom-6 left-6 z-30 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm shadow-lg"><NotebookPen className="size-4"/>{ui("Classroom notes")}</button>}
    {selection&&<div className="fixed inset-x-3 bottom-24 z-50 flex flex-wrap justify-center gap-2 rounded-xl border border-border bg-card p-2 shadow-lg sm:inset-x-auto sm:left-1/2 sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2"><button type="button" onPointerDown={event=>event.preventDefault()} onMouseDown={event=>event.preventDefault()} onClick={()=>{annotate(selection,selectionOrigin.current);setSelection("");window.getSelection()?.removeAllRanges();}} className="rounded-full bg-brand px-5 py-3 text-sm text-brand-foreground shadow-lg">{ui("Annotate selected text")}</button><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{
      window.dispatchEvent(new CustomEvent('opentutor:ask-selection',{detail:{courseId,nodeId,markdown:selection}}));setSelection('');window.getSelection()?.removeAllRanges();
    }} className="rounded-full border border-border bg-card px-5 py-3 text-sm shadow-lg">{ui("Ask AI about selection")}</button></div>}
  </NotebookContext.Provider>;
}
