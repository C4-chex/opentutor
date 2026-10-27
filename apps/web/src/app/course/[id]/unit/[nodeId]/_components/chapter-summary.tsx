"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useT, useTF } from "@/lib/i18n-context";
import { useCourseStore } from "@/store/course";
import { useWorkspaceStore } from "@/store/workspace";
import { extractQuiz, getReviewSession, listWrongAnswers, type ReviewItem, type WrongAnswer } from "@/lib/api";
import { getChapterSummaryStatus, type ChapterSummaryStatus } from "@/lib/api/guided-learning";
import { buildFocusTerms, findNodeById } from "@/lib/content-tree";
import { ErrorPatternSection } from "./error-analysis";
import { NextActionsSection } from "./mastery-timeline";
import { buildErrorPatternSummary, buildMasterySummary, buildErrorTrendSummary,
  matchesFocus, scoreWrongAnswerFocus, recommendQuizDifficulty, modeHintFromDifficulty } from "./unit-utils";

interface Props {
  courseId: string;
  nodeId: string;
  progressKey: string;
  aiActionsEnabled: boolean;
}

export function ChapterSummary({courseId,nodeId,progressKey,aiActionsEnabled}:Props) {
  const [loaded,setLoaded] = useState<{key:string;status:ChapterSummaryStatus}|null>(null);
  const [failed,setFailed] = useState("");
  const [retry,setRetry] = useState(0);
  const key = `${courseId}:${nodeId}:${progressKey}:${retry}`;
  useEffect(()=>{
    let cancelled=false;
    setFailed("");
    getChapterSummaryStatus(courseId,nodeId).then(status=>{
      if(!cancelled)setLoaded({key,status});
    }).catch(()=>{if(!cancelled)setFailed(key);});
    return ()=>{cancelled=true;};
  },[courseId,nodeId,key]);
  if(failed===key) return <p role="status" className="text-xs text-muted-foreground">
    本节总结状态暂时无法加载，不影响继续学习。 <button type="button" className="underline" onClick={()=>setRetry(value=>value+1)}>重试</button>
  </p>;
  if(loaded?.key!==key || !loaded.status.ready)return null;
  return <section aria-label="大节学习总结" data-testid="chapter-summary" className="space-y-4 rounded-2xl border border-brand/30 p-5 mt-6">
    <div className="space-y-1"><h2 className="text-lg font-semibold">大节学习总结 · {loaded.status.title}</h2>
      <p className="text-sm text-muted-foreground">本节内容已完成独立讲解、练习与迁移检查。下面集中回顾错因和下一步；长期保持情况仍需后续复习验证。</p></div>
    <SummaryDetails key={key} courseId={courseId} status={loaded.status} aiActionsEnabled={aiActionsEnabled}/>
  </section>;
}

function SummaryDetails({courseId,status,aiActionsEnabled}:{courseId:string;status:ChapterSummaryStatus;aiActionsEnabled:boolean}) {
  const t=useT();const tf=useTF();const router=useRouter();
  const tree=useCourseStore(s=>s.contentTree);
  const node=useMemo(()=>findNodeById(tree,status.node_id),[tree,status.node_id]);
  const terms=useMemo(()=>node?buildFocusTerms(node):[],[node]);
  const [signals,setSignals]=useState<{wrong:WrongAnswer[];review:ReviewItem[]}|null>(null);
  const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);
  const [generating,setGenerating]=useState(false);
  useEffect(()=>{
    let cancelled=false;setSignals(null);setFailed(false);
    Promise.all([listWrongAnswers(courseId),getReviewSession(courseId,100)]).then(([wrong,review])=>{
      if(!cancelled)setSignals({wrong,review:review?.items??[]});
    }).catch(()=>{if(!cancelled)setFailed(true);});
    return()=>{cancelled=true;};
  },[courseId,retry]);
  const wrong=useMemo(()=>signals?.wrong.filter(item=>scoreWrongAnswerFocus(item,terms)>0)??[],[signals,terms]);
  const review=useMemo(()=>signals?.review.filter(item=>matchesFocus(item.concept_label,terms))??[],[signals,terms]);
  const mastery=useMemo(()=>buildMasterySummary(review),[review]);
  const trend=useMemo(()=>buildErrorTrendSummary(wrong),[wrong]);
  const difficulty=useMemo(()=>recommendQuizDifficulty(mastery,trend,wrong.length),[mastery,trend,wrong]);
  const mode=modeHintFromDifficulty(difficulty.level);
  async function generateQuiz(){
    if(generating)return;setGenerating(true);
    try{
      const result=await extractQuiz(courseId,status.node_id,mode,difficulty.level);
      useWorkspaceStore.getState().triggerRefresh("practice");
      toast.success(tf("unit.focusedQuiz.generated",{count:result.problems_created}));
    }catch(error){toast.error((error as Error).message||t("unit.focusedQuiz.failed"));}
    finally{setGenerating(false);}
  }
  if(failed)return <p role="status" className="text-sm">总结数据加载失败。 <button type="button" className="underline" onClick={()=>setRetry(value=>value+1)}>重试</button></p>;
  if(!signals||!node)return <p role="status" className="text-sm text-muted-foreground">正在整理本节总结…</p>;
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <ErrorPatternSection wrongAnswers={wrong} errorPatterns={buildErrorPatternSummary(wrong)} t={t}/>
    <NextActionsSection courseId={courseId} masterySummary={mastery} errorTrend={trend} difficultyRec={difficulty}
      quizModeHint={mode} hasReviewData={review.length>0} hasPracticeData={wrong.length>0} aiActionsEnabled={aiActionsEnabled}
      generatingFocusedQuiz={generating} onGenerateFocusedQuiz={()=>void generateQuiz()}
      onNavigate={path=>router.push(path)} t={t} tf={tf}/>
  </div>;
}
