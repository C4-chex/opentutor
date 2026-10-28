"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {loadClassroomNote,saveClassroomNote,type ClassroomNote} from "@/lib/api/classroom-notes";

export type NoteStatus="loading"|"saved"|"dirty"|"saving"|"error"|"conflict";
interface Draft {markdown:string; revision:number; updated_at:number; key?:string}
function editorId() {
  if (typeof window==="undefined") return "server";
  try {
    const existing=sessionStorage.getItem("opentutor:note-editor");
    if (existing) return existing;
    const id=crypto.randomUUID();sessionStorage.setItem("opentutor:note-editor",id);return id;
  } catch {return crypto.randomUUID();}
}

export function useClassroomNotes(courseId:string,nodeId:string) {
  const [clientId]=useState(editorId);
  const prefix=`opentutor:classroom-draft:${courseId}:${nodeId}:`;
  const draftKey=prefix+clientId;
  const [text,setText]=useState("");
  const [status,setStatus]=useState<NoteStatus>("loading");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [storageWarning,setStorageWarning]=useState(false);
  const [remote,setRemote]=useState<ClassroomNote|null>(null);
  const [recovery,setRecovery]=useState<Draft|null>(null);
  const live=useRef(true);
  const loadEpoch=useRef(0);
  const state=useRef({text:"",savedText:"",revision:0,ready:false,paused:false,saving:false});
  const pending=useRef<{markdown:string;revision:number;id:string}|null>(null);

  const cache=useCallback((markdown:string,revision:number)=>{
    try {localStorage.setItem(draftKey,JSON.stringify({markdown,revision,updated_at:Date.now()}));setStorageWarning(false);return true;}
    catch {setStorageWarning(true);return false;}
  },[draftKey]);
  const clearCache=useCallback((expected?:string)=>{try {
    const draft=JSON.parse(localStorage.getItem(draftKey)||"null");
    if(expected===undefined||draft?.markdown===expected)localStorage.removeItem(draftKey);
  } catch { /* The database still has the saved text. */ }},[draftKey]);
  const edit=useCallback((markdown:string)=>{
    if (markdown.length>60000) {setError("笔记超过本章长度上限，请先导出或拆分内容。");return false;}
    state.current.text=markdown;setText(markdown);cache(markdown,state.current.revision);
    setStatus(state.current.paused?"conflict":markdown===state.current.savedText?"saved":"dirty");
    return true;
  },[cache]);
  const append=useCallback((markdown:string)=>edit([state.current.text.trimEnd(),markdown.trim()].filter(Boolean).join("\n\n")),[edit]);

  const load=useCallback(async()=>{
    const epoch=++loadEpoch.current;
    setLoading(true);setError("");
    try {
      const saved=await loadClassroomNote(courseId,nodeId);
      if (!live.current||epoch!==loadEpoch.current) return;
      let own:Draft|null=null;let candidate:Draft|null=null;
      try {
        const raw=localStorage.getItem(draftKey);if(raw) own=JSON.parse(raw);
        for(let index=0;index<localStorage.length;index++) {
          const key=localStorage.key(index);
          if(!key?.startsWith(prefix)||key===draftKey)continue;
          try {const draft=JSON.parse(localStorage.getItem(key)||"null") as Draft|null;
            if(draft&&typeof draft.markdown==="string"&&draft.markdown!==saved.markdown&&(!candidate||draft.updated_at>candidate.updated_at))candidate={...draft,key};
          } catch { /* Ignore an incomplete browser recovery record. */ }
        }
      } catch {setStorageWarning(true);}
      if(own&&typeof own.markdown!=="string")own=null;
      const markdown=own?.markdown??saved.markdown;
      const conflict=!!own&&own.markdown!==saved.markdown&&own.revision!==saved.revision;
      Object.assign(state.current,{text:markdown,savedText:saved.markdown,revision:conflict?own!.revision:saved.revision,ready:true,paused:conflict});
      pending.current=null;setText(markdown);setRemote(conflict?saved:null);setRecovery(candidate);
      setStatus(conflict?"conflict":markdown===saved.markdown?"saved":"dirty");
      if(markdown===saved.markdown)clearCache();
    } catch(err) {
      if(!live.current||epoch!==loadEpoch.current)return;
      try {const draft=JSON.parse(localStorage.getItem(draftKey)||"null") as Draft|null;
        if(draft&&typeof draft.markdown==="string"){state.current.text=draft.markdown;state.current.revision=draft.revision;setText(draft.markdown);}
      } catch { /* The draft warning is already displayed when storage is unavailable. */ }
      setStatus("error");setError((err as Error).message);
    } finally {if(live.current&&epoch===loadEpoch.current)setLoading(false);}
  },[courseId,nodeId,draftKey,prefix,clearCache]);

  const save=useCallback(async()=>{
    const current=state.current;
    if(!current.ready||current.saving||current.paused)return;
    if(current.text===current.savedText){setStatus("saved");clearCache();return;}
    const signature={markdown:current.text,revision:current.revision};
    if(!pending.current||pending.current.markdown!==signature.markdown||pending.current.revision!==signature.revision)
      pending.current={...signature,id:crypto.randomUUID()};
    const request=pending.current;current.saving=true;setStatus("saving");setError("");
    try {
      const saved=await saveClassroomNote(courseId,nodeId,request.markdown,request.revision,request.id);
      current.revision=saved.revision;current.savedText=saved.markdown;pending.current=null;
      if(current.text===saved.markdown)clearCache(saved.markdown);else if(live.current)cache(current.text,current.revision);
      if(live.current)setStatus(current.text===saved.markdown?"saved":"dirty");
    } catch(err) {
      if(live.current)cache(current.text,current.revision);
      if(live.current){
        const conflict=(err as {status?:number}).status===409;current.paused=conflict;
        setStatus(conflict?"conflict":"error");setError((err as Error).message);
      }
    } finally {current.saving=false;}
  },[courseId,nodeId,clearCache,cache]);

  useEffect(()=>{live.current=true;void load();return()=>{live.current=false;loadEpoch.current++;};},[load]);
  useEffect(()=>{
    if(status!=="dirty"||loading||!state.current.ready)return;
    const timer=setTimeout(()=>void save(),1000);return()=>clearTimeout(timer);
  },[text,status,loading,save]);
  async function loadRemote(){try{setRemote(await loadClassroomNote(courseId,nodeId));}catch(err){setError((err as Error).message);}}
  function mergeRemote(){
    if(!remote)return;
    const merged=[remote.markdown.trimEnd(),"## 待合并的浏览器草稿",state.current.text].filter(Boolean).join("\n\n");
    if(merged.length>60000){setError("合并内容超过长度上限，请先导出草稿，再手动整理。");return;}
    state.current.revision=remote.revision;state.current.savedText=remote.markdown;state.current.paused=false;
    pending.current=null;setRemote(null);edit(merged);
  }
  function useRemote(){
    if(!remote)return;
    try {localStorage.setItem(`${draftKey}:recovery:${Date.now()}`,JSON.stringify({markdown:state.current.text,revision:state.current.revision,updated_at:Date.now()}));}
    catch {setError("无法备份当前草稿，请先导出后再切换版本。");return;}
    Object.assign(state.current,{text:remote.markdown,savedText:remote.markdown,revision:remote.revision,paused:false});
    pending.current=null;setText(remote.markdown);setRemote(null);setStatus("saved");clearCache();
  }
  function recover(){
    if(!recovery)return;
    const conflict=recovery.revision!==state.current.revision;
    state.current.paused=conflict;
    if(conflict)state.current.revision=recovery.revision;
    edit(recovery.markdown);
    if(conflict){setStatus("conflict");void loadRemote();}
    if(recovery.key&&cache(recovery.markdown,state.current.revision)){
      try{localStorage.removeItem(recovery.key);}catch{ /* Keep both recovery copies. */ }
    }
    setRecovery(null);
  }
  return {revision:state.current.revision,text,status,loading,error,storageWarning,remote,recovery,edit,append,save,reload:load,loadRemote,mergeRemote,useRemote,recover};
}
