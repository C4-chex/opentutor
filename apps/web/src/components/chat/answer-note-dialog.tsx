"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useUiText} from "@/hooks/use-ui-text";
import {getContentTree, type ContentNode} from "@/lib/api/courses";
import {collectContentNodes,findPathToNode} from "@/lib/content-tree";
import {loadClassroomNote, saveClassroomNote} from "@/lib/api/classroom-notes";
import {MarkdownRenderer} from "@/components/shared/markdown-renderer";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog";

interface Props {courseId:string;initialNodeId?:string;answer:string;onClose:()=>void;onSaved:()=>void}
interface SaveRequest {nodeId:string;markdown:string;revision:number;saveId:string}

export function AnswerNoteDialog({courseId, initialNodeId, answer, onClose, onSaved}:Props) {
  const ui=useUiText();
  const [nodes,setNodes]=useState<ContentNode[]>([]);
  const [nodeId,setNodeId]=useState(initialNodeId||"");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const pending=useRef<SaveRequest|null>(null);
  const saving=useRef(false);
  const live=useRef(true);
  const markdown=`## ${ui("AI quick answer — check before using")}\n\n${answer}`;
  const listEpoch=useRef(0);
  const loadChapters=useCallback(async()=>{
    const epoch=++listEpoch.current;setLoading(true);setError("");
    try {
      const tree=await getContentTree(courseId);
      if(!live.current||epoch!==listEpoch.current)return;
      const chapters=collectContentNodes(tree).map(node=>({...node,title:findPathToNode(tree,node.id).map(item=>item.title).join(" / ")}));
      setNodes(chapters);setNodeId(current=>chapters.some(node=>node.id===current)?current:"");
    }catch(err){if(live.current&&epoch===listEpoch.current)setError((err as Error).message);}
    finally{if(live.current&&epoch===listEpoch.current)setLoading(false);}
  },[courseId]);
  useEffect(()=>{
    live.current=true;void loadChapters();
    return()=>{live.current=false;listEpoch.current++;};
  },[loadChapters]);
  async function save(){
    if(!nodeId||saving.current)return;
    saving.current=true;setBusy(true);setError("");
    try {
      // Reuse the complete request after a timeout, so a committed save cannot append twice.
      if(!pending.current){
        const note=await loadClassroomNote(courseId,nodeId);
        const combined=[note.markdown.trimEnd(),markdown].filter(Boolean).join("\n\n");
        if(combined.length>60000)throw new Error(ui("The notebook is full. Export or shorten it before adding this answer."));
        pending.current={nodeId,markdown:combined,revision:note.revision,saveId:crypto.randomUUID()};
      }
      const request=pending.current;
      await saveClassroomNote(courseId,request.nodeId,request.markdown,request.revision,request.saveId);
      if(live.current)onSaved();
    } catch(err) {
      if((err as {status?:number}).status===409)pending.current=null;
      if(live.current)setError((err as Error).message);
    } finally {saving.current=false;if(live.current)setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}>
    <DialogContent showCloseButton={!busy} className="max-h-[85dvh] overflow-y-auto">
      <DialogTitle>{ui("Save answer to classroom notes")}</DialogTitle>
      <DialogDescription>{ui("Choose a chapter. This answer will be appended to its notes without replacing your writing.")}</DialogDescription>
      <label className="block text-sm">{ui("Save to chapter")}
        <select value={nodeId} disabled={loading||busy} onChange={event=>{setNodeId(event.target.value);pending.current=null;setError("");}} className="mt-2 w-full rounded-lg border border-border bg-background p-2">
          <option value="">{ui(loading?"Loading chapters...":"Choose a chapter")}</option>
          {nodes.map(node=><option key={node.id} value={node.id}>{node.title}</option>)}
        </select>
      </label>
      {!loading&&!nodes.length&&!error&&<p className="text-sm text-muted-foreground">{ui("Import learning material before saving chapter notes.")}</p>}
      <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer">{ui("Preview the answer to be added")}</summary><MarkdownRenderer content={markdown} className="mt-3 text-sm"/></details>
      {error&&<div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{!loading&&!nodes.length&&<button type="button" onClick={()=>void loadChapters()} className="underline">{ui("Reload chapters")}</button>}</div>}
      <div className="flex justify-end gap-3 text-sm">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-border px-3 py-2 disabled:opacity-50">{ui("Cancel")}</button>
        <button type="button" disabled={loading||busy||!nodeId} onClick={()=>void save()} className="rounded-lg bg-brand px-3 py-2 text-brand-foreground disabled:opacity-50">{ui(busy?"Saving notebook...":"Append to notes")}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
