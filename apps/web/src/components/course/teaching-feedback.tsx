"use client";
import { useRef, useState } from "react";
import { loadTeachingReports, saveTeachingReport, type FeedbackKind, type TeachingReport } from "@/lib/api/teaching-feedback";

const kinds:Record<FeedbackKind,string>={explanation:"讲解错误",grading:"答案判定错误",question:"题目有问题",source:"资料识别错误",other:"其他问题（自行填写）"};
export function TeachingFeedback({courseId,nodeId,revision}:{courseId:string;nodeId:string;revision:number}) {
  const [open,setOpen]=useState(false);
  const [kind,setKind]=useState<FeedbackKind>("explanation");
  const [note,setNote]=useState("");
  const [reports,setReports]=useState<TeachingReport[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);
  const operation=useRef<{signature:string;id:string}|null>(null);
  async function show() {
    setOpen(true);setError("");
    try{setReports(await loadTeachingReports(courseId,nodeId));}
    catch(err){setError(err instanceof Error?err.message:"历史反馈暂时无法读取，仍可填写当前问题。");}
  }
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy||(kind==="other"&&!note.trim()))return;
    setBusy(true);setError("");setSaved(false);
    const signature=JSON.stringify([revision,kind,note.trim()]);
    if(operation.current?.signature!==signature)operation.current={signature,id:crypto.randomUUID()};
    try{
      const report=await saveTeachingReport(courseId,nodeId,{report_id:operation.current.id,revision,kind,note:note.trim()});
      setReports((old)=>[report,...old.filter((item)=>item.report_id!==report.report_id)]);
      setSaved(true);setNote("");operation.current=null;
    }catch(err){setError(err instanceof Error?err.message:"反馈保存失败，输入仍保留。");}
    finally{setBusy(false);}
  }
  if(!open)return <button type="button" onClick={()=>void show()} className="text-sm underline text-muted-foreground">反馈教学问题</button>;
  return <div className="rounded-xl border border-border p-4 space-y-3">
    <div className="flex justify-between gap-3"><h3 className="font-medium text-sm">反馈教学问题</h3><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="text-xs underline">收起</button></div>
    <p className="text-xs text-muted-foreground">将当前教学内容和你的说明保存在本机。提交反馈不会自动修改成绩或判定为已修复。</p>
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm space-y-1"><span>问题类型</span><select value={kind} disabled={busy} onChange={(e)=>{setKind(e.target.value as FeedbackKind);setSaved(false);}} className="block w-full rounded-lg border border-border bg-background p-2">
        {Object.entries(kinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="block text-sm space-y-1"><span>具体问题说明{kind==="other"?"（必填）":"（选填）"}</span>
        <textarea value={note} onChange={(e)=>{setNote(e.target.value);setSaved(false);}} disabled={busy} required={kind==="other"} maxLength={2000}
          placeholder="例如：我的代码在原题条件下是正确的，但 AI 忽略了输入范围。" className="block w-full min-h-20 rounded-lg border border-border bg-background p-3" />
      </label>
      <button type="submit" disabled={busy||(kind==="other"&&!note.trim())} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">{busy?"正在保存…":"保存问题反馈"}</button>
    </form>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved&&<p role="status" className="text-sm text-brand">反馈已保存在本机，尚未复核。若当前判定有误，可使用“撤回上一轮”退回上一步。</p>}
    {reports.length>0&&<details className="text-xs"><summary className="cursor-pointer">本章已记录反馈（{reports.length} 条）</summary>
      <ul className="space-y-2 pt-2">{reports.map((report)=><li key={report.report_id} className="rounded border border-border p-2"><p>{kinds[report.kind]} · 第 {report.revision} 轮 · 待复核</p>{report.note&&<p className="whitespace-pre-wrap mt-1">{report.note}</p>}</li>)}</ul>
    </details>}
  </div>;
}
