"use client";

import {useId, useState, type ReactNode} from "react";
import {ChevronDown} from "lucide-react";
import {useUiText} from "@/hooks/use-ui-text";

export function CollapsibleSection({title, count, children, keepMounted=false}:{
  title:string;count?:number;children:ReactNode;keepMounted?:boolean;
}) {
  const ui=useUiText();const id=useId();const [open,setOpen]=useState(false);
  const [opened,setOpened]=useState(false);
  return <section className="rounded-2xl bg-card card-shadow" data-collapsible-section={title}>
    <h2><button type="button" aria-expanded={open} aria-controls={id}
      aria-label={`${ui(open?"Collapse":"Expand")} ${title}`} onClick={()=>{setOpened(true);setOpen(value=>!value);}}
      className="flex w-full items-center gap-3 rounded-2xl p-5 text-left text-lg font-semibold hover:bg-muted/20">
      <span className="flex-1">{title}</span>
      {count!==undefined&&<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{count}</span>}
      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open?"":"-rotate-90"}`}/>
    </button></h2>
    <div id={id} hidden={!open} style={!open?{display:"none"}:undefined} className="px-5 pb-5">
      {open||(keepMounted&&opened)?children:null}
    </div>
  </section>;
}
