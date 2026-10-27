"use client";

import {useEffect,useState} from "react";
import {useUiText} from "@/hooks/use-ui-text";
import type {useExcerptDrafts,ExcerptDraft} from "@/hooks/use-excerpt-drafts";
import type {useClassroomNotes} from "@/hooks/use-classroom-notes";
import {annotatedExcerptMarkdown,downloadNotebook} from "@/lib/classroom-notes";
import {MarkdownRenderer} from "@/components/shared/markdown-renderer";

type Drafts=ReturnType<typeof useExcerptDrafts>;
type Notebook=ReturnType<typeof useClassroomNotes>;

export function ExcerptComposer({drafts,note,title,onShowNotebook}:{
  drafts:Drafts;note:Notebook;title:string;onShowNotebook:()=>void;
}) {
  const ui=useUiText();const [notice,setNotice]=useState("");const [error,setError]=useState("");
  useEffect(()=>{
    if(note.loading)return;
    // Keep a recovery copy until the full notebook has either a browser draft
    // or a committed database copy. A failed save never triggers a second append.
    const added=drafts.drafts.filter(item=>item.addedMarkdown&&note.text.includes(item.addedMarkdown)&&
      (note.status==="saved"||!note.storageWarning)).map(item=>item.id);
    if(added.length)drafts.remove(added);
  },[drafts.drafts,drafts.remove,note.loading,note.text,note.status,note.storageWarning]);
  function addToNotebook(draft:ExcerptDraft){
    if(note.loading||note.status==="conflict"||note.status==="error")return;
    const markdown=draft.addedMarkdown||annotatedExcerptMarkdown(draft.markdown,draft.reflection,draft.origin);
    if(draft.addedMarkdown&&note.text.includes(markdown)){void note.save();return;}
    if(!note.append(markdown)){setError(ui("The notebook is full. Your excerpt and reflection are still kept here; export or shorten the notebook first."));return;}
    drafts.markAdded(draft.id,markdown);setError("");
    setNotice(ui("Added to this chapter's notes. The save status above shows whether it has reached the local database."));
  }
  return <section aria-label={ui("Excerpt and reflection")} className="space-y-3">
    <p className="text-xs text-muted-foreground">{ui("Keep the excerpt as it is, then add your own understanding. Saving appends to this chapter's notebook without replacing existing notes.")}</p>
    {drafts.warning&&<p role="alert" className="text-xs text-destructive">{ui("Excerpt draft storage is unavailable. Keep this page open or export pending excerpts before leaving.")}</p>}
    {drafts.full&&<p role="alert" className="text-xs text-destructive">{ui("Pending excerpts are full. Save or export them before adding another excerpt.")}</p>}
    {(error||note.error)&&<p role="alert" className="text-xs text-destructive">{error||note.error}</p>}
    {note.status==="conflict"&&<button type="button" onClick={onShowNotebook} className="text-xs underline">{ui("Open the full notebook to resolve its saved-version conflict")}</button>}
    {note.status==="error"&&<button type="button" onClick={()=>void note.reload()} className="text-xs underline">{ui("Retry loading the notebook; keep my excerpt")}</button>}
    {notice&&<p role="status" className="text-xs text-brand">{notice}</p>}
    {!drafts.drafts.length?<p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">{ui("Select a sentence in the lesson or use Take a note on a code block to start.")}</p>:drafts.drafts.map((draft,index)=><article key={draft.id} className="space-y-3 rounded-xl border border-border p-3" data-excerpt-draft={draft.id}>
      <h3 className="text-xs font-medium text-muted-foreground">{ui(draft.origin==="ai"?"AI lecture excerpt":"Classroom excerpt")} · {index+1}</h3>
      <div className="max-h-48 overflow-auto rounded-lg bg-muted/20 p-2">
        <MarkdownRenderer content={draft.markdown} className="prose prose-sm dark:prose-invert max-w-none"/>
      </div>
      <label className="block space-y-1 text-sm"><span>{ui("My understanding (optional)")}</span>
        <textarea value={draft.reflection} onChange={event=>drafts.reflect(draft.id,event.target.value)}
          disabled={!!draft.addedMarkdown} maxLength={6000} aria-label={`${ui("My understanding (optional)")} ${index+1}`}
          placeholder={ui("Explain why this matters, how the code works, or what still confuses you.")}
          className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm leading-6"/>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={note.loading||note.status==="conflict"||note.status==="error"}
          onClick={()=>addToNotebook(draft)} className="rounded-lg bg-brand px-3 py-2 text-sm text-brand-foreground disabled:opacity-50">
          {ui(draft.addedMarkdown?"Retry saving this excerpt":"Add excerpt and reflection to notes")}
        </button>
        <button type="button" onClick={()=>drafts.remove([draft.id])} className="text-xs text-muted-foreground underline">{ui("Discard this pending excerpt")}</button>
      </div>
    </article>)}
    {!!drafts.drafts.length&&<button type="button" onClick={()=>downloadNotebook(title+"-excerpts",drafts.drafts.map(draft=>draft.addedMarkdown||annotatedExcerptMarkdown(draft.markdown,draft.reflection,draft.origin)).join("\n\n"))} className="text-xs underline">{ui("Export pending excerpts")}</button>}
    <button type="button" onClick={onShowNotebook} className="block text-xs text-brand underline">{ui("View the full chapter notebook")}</button>
  </section>;
}
