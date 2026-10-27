"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useUiText} from "@/hooks/use-ui-text";
import {listClassroomNotes,type ClassroomNote} from "@/lib/api/classroom-notes";
import {downloadNotebook} from "@/lib/classroom-notes";
import {ObsidianSync} from "./obsidian-sync";
import {MarkdownRenderer} from "@/components/shared/markdown-renderer";

export function ClassroomNoteList({courseId}:{courseId:string}) {
  const ui=useUiText();
  const [notes,setNotes]=useState<ClassroomNote[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [expanded,setExpanded]=useState<string|null>(null);
  useEffect(()=>{let cancelled=false;listClassroomNotes(courseId).then(data=>{if(!cancelled)setNotes(data);}).catch(err=>{if(!cancelled)setError((err as Error).message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[courseId]);
  return <section aria-label={ui("My classroom notebooks")} className="mb-6 rounded-2xl border border-border bg-card p-5 space-y-3">
    <h2 className="font-semibold">{ui("My classroom notebooks")}</h2>
    {loading?<p className="text-sm text-muted-foreground">{ui("Loading notebook...")}</p>:error?<p role="alert" className="text-sm text-destructive">{error}</p>:!notes.length?<p className="text-sm text-muted-foreground">{ui("Open classroom notes on a chapter page to start writing.")}</p>:notes.map(note=><article key={note.node_id} className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" aria-expanded={expanded===note.node_id} onClick={()=>setExpanded(value=>value===note.node_id?null:note.node_id)} className="font-medium underline underline-offset-4">{note.title}</button><Link href={`/course/${courseId}/unit/${note.node_id}?notes=1`} className="ml-auto text-xs text-brand underline">{ui("Back to lesson")}</Link><button type="button" onClick={()=>downloadNotebook(note.title,note.markdown)} className="text-xs underline">{ui("Export Markdown")}</button></div>
      {expanded===note.node_id&&<MarkdownRenderer content={note.markdown} className="text-sm"/>}
      <ObsidianSync courseId={courseId} nodeId={note.node_id} revision={note.revision} onImported={async()=>setNotes(await listClassroomNotes(courseId))}/>
    </article>)}
  </section>;
}
