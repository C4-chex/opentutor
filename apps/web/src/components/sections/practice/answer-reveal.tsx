"use client";

import { useEffect, useState } from "react";
import { revealProblemAnswer, type RevealedAnswer } from "@/lib/api/practice";
import { useUiText } from "@/hooks/use-ui-text";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

const VIEW_EVENT = "opentutor:answer-viewed";

export function AnswerReveal({problemId,answerViewed=false,disabled=false}: {
  problemId:string;answerViewed?:boolean;disabled?:boolean;
}) {
  const ui=useUiText();
  const [viewedId,setViewedId]=useState("");
  const [busyId,setBusyId]=useState("");
  const [revealed,setRevealed]=useState<RevealedAnswer|null>(null);
  const [openId,setOpenId]=useState("");
  const [failure,setFailure]=useState<{problemId:string;message:string}|null>(null);
  const viewed=answerViewed||viewedId===problemId;
  const busy=busyId===problemId;
  const open=openId===problemId&&revealed?.problem_id===problemId;
  useEffect(()=>{
    const onViewed=(event:Event)=>{
      if((event as CustomEvent<{problemId:string}>).detail?.problemId===problemId)setViewedId(problemId);
    };
    window.addEventListener(VIEW_EVENT,onViewed);
    return()=>window.removeEventListener(VIEW_EVENT,onViewed);
  },[problemId]);
  async function reveal(){
    if(busy||disabled)return;
    if(open){setOpenId("");return;}
    if(revealed?.problem_id===problemId){setOpenId(problemId);return;}
    setBusyId(problemId);setFailure(null);
    try{
      const result=await revealProblemAnswer(problemId);
      window.dispatchEvent(new CustomEvent(VIEW_EVENT,{detail:{problemId}}));
      setRevealed(result);setOpenId(problemId);setViewedId(problemId);
    }catch(error){setFailure({problemId,message:(error as Error).message||ui("Unable to save the viewed-answer record. The reference remains hidden; please retry.")});}
    finally{setBusyId(current=>current===problemId?"":current);}
  }
  return <div className="space-y-2 border-t border-border/50 pt-3" data-testid="answer-reveal">
    {viewed&&<p className="text-xs text-amber-600 dark:text-amber-400">{ui("Reference viewed · assisted learning")}</p>}
    <p className="text-xs text-muted-foreground">{ui("Try it yourself first. Viewing is recorded locally; later attempts on this question count as assisted practice. Earlier independent attempts are preserved.")}</p>
    <button type="button" disabled={busy||disabled} aria-expanded={!!open} onClick={()=>void reveal()}
      className="text-sm text-brand underline underline-offset-4 disabled:opacity-50">
      {ui(busy?"Saving viewed-answer record...":open?"Hide reference answer and explanation":"View reference answer and explanation")}
    </button>
    {failure?.problemId===problemId&&<p role="alert" className="text-xs text-destructive">{failure.message}</p>}
    {open&&revealed&&<section aria-label={ui("Reference answer and explanation")} className="rounded-xl border border-amber-500/20 bg-muted/30 p-3 space-y-3">
      {revealed.correct_answer&&<div className="space-y-1"><h4 className="text-xs font-medium">{ui("Reference answer")}</h4><MarkdownRenderer teaching content={revealed.correct_answer} className="prose prose-sm dark:prose-invert max-w-none"/></div>}
      {revealed.explanation&&<div className="space-y-1"><h4 className="text-xs font-medium">{ui("Reference explanation")}</h4><MarkdownRenderer teaching content={revealed.explanation} className="prose prose-sm dark:prose-invert max-w-none"/></div>}
      <p className="text-xs text-muted-foreground">{ui("After understanding the explanation, use a different problem to check independent mastery. References can contain mistakes; report any issue.")}</p>
    </section>}
  </div>;
}
