"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import type {ExcerptOrigin} from "@/components/course/notebook-context";

export interface ExcerptDraft {
  id:string;
  markdown:string;
  reflection:string;
  origin:ExcerptOrigin;
  addedMarkdown?:string;
}
const MAX_PENDING=60000;

function readDrafts(key:string):ExcerptDraft[] {
  const raw=localStorage.getItem(key);
  if(!raw)return [];
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data))throw new Error("Invalid excerpt drafts");
  const ids=new Set<string>();
  return data.filter((item):item is ExcerptDraft=>{
    if(!item||typeof item!=="object")return false;
    const draft=item as ExcerptDraft;
    if(typeof draft.id!=="string"||ids.has(draft.id)||typeof draft.markdown!=="string"||
      typeof draft.reflection!=="string"||!["ai","classroom"].includes(draft.origin)||
      (draft.addedMarkdown!==undefined&&typeof draft.addedMarkdown!=="string"))return false;
    ids.add(draft.id);return true;
  });
}

export function useExcerptDrafts(courseId:string,nodeId:string) {
  const key=`opentutor:excerpt-drafts:${courseId}:${nodeId}`;
  const [state,setState]=useState<{key:string;drafts:ExcerptDraft[]}|null>(null);
  const drafts=state?.key===key?state.drafts:[];
  const [warning,setWarning]=useState(false);
  const [full,setFull]=useState(false);
  const current=useRef<{key:string;drafts:ExcerptDraft[]}|null>(null);
  const ensure=useCallback(()=>{
    if(current.current?.key===key)return current.current.drafts;
    let value:ExcerptDraft[]=[];
    setWarning(false);setFull(false);
    try{value=readDrafts(key);}catch{setWarning(true);}
    current.current={key,drafts:value};return value;
  },[key]);
  useEffect(()=>{setState({key,drafts:ensure()});},[ensure,key]);
  const change=useCallback((next:ExcerptDraft[])=>{
    current.current={key,drafts:next};setState({key,drafts:next});
    try{if(next.length)localStorage.setItem(key,JSON.stringify(next));else localStorage.removeItem(key);setWarning(false);}
    catch{setWarning(true);}
  },[key]);
  const add=useCallback((markdown:string,origin:ExcerptOrigin="classroom")=>{
    const previous=ensure();
    const size=previous.reduce((sum,draft)=>sum+draft.markdown.length+draft.reflection.length,0);
    if(!markdown.trim()||size+markdown.length>MAX_PENDING){setFull(true);return;}
    setFull(false);change([...previous,{id:crypto.randomUUID(),markdown,reflection:"",origin}]);
  },[ensure,change]);
  const reflect=useCallback((id:string,text:string)=>{
    const previous=ensure();
    const next=previous.map(item=>item.id===id&&!item.addedMarkdown?{...item,reflection:text}:item);
    if(next.reduce((sum,draft)=>sum+draft.markdown.length+draft.reflection.length,0)>MAX_PENDING){setFull(true);return;}
    setFull(false);change(next);
  },[ensure,change]);
  const markAdded=useCallback((id:string,markdown:string)=>change(ensure().map(item=>item.id===id?{...item,addedMarkdown:markdown}:item)),[ensure,change]);
  const remove=useCallback((ids:string[])=>{change(ensure().filter(item=>!ids.includes(item.id)));setFull(false);},[ensure,change]);
  return {drafts,warning,full,add,reflect,markAdded,remove};
}
