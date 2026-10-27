"use client";
import {useState} from 'react';
import Link from 'next/link';
import {loadClassroomNote} from '@/lib/api/classroom-notes';
import {downloadNotebook} from '@/lib/classroom-notes';
import {useUiText} from '@/hooks/use-ui-text';
import {inspectObsidianNote,exportObsidianNote,importObsidianNote,type ObsidianFile} from '@/lib/api/obsidian';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogTrigger} from '@/components/ui/dialog';
import {MarkdownRenderer} from '@/components/shared/markdown-renderer';
export function ObsidianSync({courseId,nodeId,revision,disabled=false,onImported}:{courseId:string;nodeId:string;revision:number;disabled?:boolean;onImported:()=>Promise<unknown>}){
 const ui=useUiText();const [file,setFile]=useState<ObsidianFile|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);const [confirmImport,setConfirmImport]=useState(false);
 async function inspect(){setFile(null);setDone(false);setError('');setConfirmImport(false);setBusy(true);try{const f=await inspectObsidianNote(courseId,nodeId);if(f.revision!==revision)throw new Error(ui('The saved notebook changed. Reload the chapter before syncing.'));setFile(f);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function sync(){setBusy(true);setError('');try{const f=await exportObsidianNote(courseId,nodeId,revision);setFile({...f,exists:true,external_changed:false,revision});setDone(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function downloadCurrent(){setBusy(true);setError('');try{const note=await loadClassroomNote(courseId,nodeId);downloadNotebook(note.title,note.markdown);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function importFile(){if(!file?.file_hash)return;setBusy(true);setError('');try{await importObsidianNote(courseId,nodeId,revision,file.file_hash);await onImported();setFile(null);setDone(false);setConfirmImport(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Dialog onOpenChange={open=>{if(open)void inspect();}}>
  <DialogTrigger asChild><button type="button" disabled={disabled||revision<1} title={disabled?ui("Save the notebook before syncing."):undefined} className="rounded border border-border px-3 py-1.5 text-xs disabled:opacity-50">{ui('Sync with Obsidian')}</button></DialogTrigger>
  <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl" onInteractOutside={e=>{if(busy)e.preventDefault();}} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}>
   <DialogHeader><DialogTitle>{ui('Sync with Obsidian')}</DialogTitle><DialogDescription>{ui('Only this saved chapter notebook is synced. Your source files and API keys are excluded.')}</DialogDescription></DialogHeader>
   <Link href="/settings#obsidian" className="text-sm underline">{ui('Configure Obsidian vault')}</Link>
   {busy&&<p role="status" className="text-sm">{ui('Processing notebook...')}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   {file&&<div className="space-y-3 text-sm"><p className="break-all text-xs text-muted-foreground">{file.path}</p>
    {file.external_changed&&<p className="rounded-lg bg-amber-500/10 p-3">{ui('Obsidian has external edits. Preview them and import before exporting again.')}</p>}
    {file.exists&&<details><summary className="cursor-pointer underline">{ui('Preview Obsidian version')}</summary><MarkdownRenderer content={file.markdown} className="mt-3 text-sm"/></details>}
    <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>void sync()} disabled={busy||file.external_changed} className="rounded-lg bg-brand px-3 py-2 text-brand-foreground disabled:opacity-50">{ui('Save current notes to Obsidian')}</button>
     {file.exists&&<button type="button" disabled={busy} onClick={()=>setConfirmImport(true)} className="underline">{ui('Load Obsidian version')}</button>}
     {file.exists&&<a href={file.uri} className="underline">{ui('Open in Obsidian')}</a>}
    </div>
    {confirmImport&&<div className="rounded-lg border border-border p-3 space-y-2"><p>{ui('This replaces the classroom notebook with the previewed version. Download the current version first if you want a separate copy. A local recovery snapshot is also kept.')}</p><button type="button" onClick={()=>void downloadCurrent()} disabled={busy} className="block underline">{ui("Download current classroom version")}</button><button type="button" onClick={()=>void importFile()} disabled={busy} className="underline">{ui('Confirm load external version')}</button><button type="button" onClick={()=>setConfirmImport(false)} className="ml-4 underline">{ui('Cancel')}</button></div>}
   </div>}
   {done&&<p role="status" className="text-sm text-brand">{ui('Saved to Obsidian. Code and formulas are preserved.')}</p>}
   {!file&&!busy&&!error&&<p role="status">{ui('External version loaded into classroom notes.')}</p>}
  </DialogContent>
 </Dialog>;
}
