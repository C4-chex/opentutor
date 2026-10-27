"use client";

import { useEffect, useId, useState } from "react";
import { loadLearningProfile, saveLearningProfile, type LearningPreferences } from "@/lib/api/learning-profile";

const choices = {
  foundation_level: {title:"目前的学习基础", options:[
    {value:"beginner", label:"刚入门", detail:"需要直观例子和较小的学习步骤。"},
    {value:"some", label:"有一些基础", detail:"学过相关内容，部分知识点需要补充。"},
    {value:"advanced", label:"基础比较扎实", detail:"希望少重复基础，把时间放在应用和迁移。"},
    {value:"unsure", label:"基础还不确定", detail:"结合下面的背景描述和实际作答来调整。"},
  ]},
  learning_depth: {title:"希望学到什么程度", options:[
    {value:"essentials", label:"先掌握核心内容", detail:"优先理解关键概念与必要的基础应用。"},
    {value:"applied", label:"能够独立实操", detail:"注重应用、代码练习和解决实际问题。"},
    {value:"thorough", label:"系统深入理解", detail:"增加不同类型的应用，理解条件与边界。"},
    {value:"unsure", label:"要求还不确定", detail:"结合学习目标和实际表现逐步确定。"},
  ]},
  learning_pace: {title:"默认的学习速度", options:[
    {value:"slow", label:"慢一点", detail:"拆小步骤，多一点解释与巩固。"},
    {value:"adaptive", label:"按画像调整", detail:"结合学习基础、目标和实际作答安排节奏。"},
    {value:"fast", label:"快一点", detail:"减少重复解释，合并相关步骤，保留必要检验。"},
  ]},
  teaching_mode: {title:"开始一个新知识点时", options:[
    {value:"explain_first", label:"先讲解，再尝试", detail:"先看一小段解释和例子，再回答问题或做练习。"},
    {value:"try_first", label:"先尝试，再讲解", detail:"先做一个小任务，再根据表现获得讲解。"},
  ]},
  feedback_level: {title:"答错时，默认怎样帮助我", options:[
    {value:"hint", label:"小提示", detail:"先给方向，让我再想一想。"},
    {value:"locate", label:"指出问题", detail:"指出错误位置和原因，让我自己修改。"},
    {value:"explain", label:"完整讲解", detail:"讲清当前问题，再换一个任务检查独立完成能力。"},
  ]},
  review_mode: {title:"待巩固知识的复习方式", options:[
    {value:"related", label:"在相关练习中适量复习", detail:"允许在后续相关练习中带回薄弱点。"},
    {value:"manual", label:"仅手动复习", detail:"保留待巩固记录，由我主动选择复习。"},
  ]},
} as const;
type ChoiceKey = keyof typeof choices;
type Draft = Omit<LearningPreferences, ChoiceKey> & {[K in ChoiceKey]: LearningPreferences[K] | ""};
const empty:Draft = {teaching_mode:"", feedback_level:"", review_mode:"", background:"", current_progress:"", learning_goal:"", foundation_level:"",learning_depth:"",learning_pace:""};

export function LearningProfileForm({onSaved, firstRun = false}: {onSaved?: () => void; firstRun?: boolean}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(empty);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    loadLearningProfile().then((data) => {
      if (!active) return;
      setRevision(data.revision);
      setLoaded(true);
      if (data.profile) {
        const {teaching_mode, feedback_level, review_mode, background, current_progress, learning_goal} = data.profile;
        setDraft({teaching_mode, feedback_level, review_mode, background, current_progress, learning_goal,
          foundation_level:data.profile.foundation_level ?? "unsure",learning_depth:data.profile.learning_depth ?? "unsure",
          learning_pace:data.profile.learning_pace ?? "adaptive"});
      }
      setError("");
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "画像暂时无法载入，请重试。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const complete = Object.keys(choices).every(key=>Boolean(draft[key as ChoiceKey]));
  function edit<K extends keyof Draft>(key:K, value:Draft[K]) {
    setDraft((old) => ({...old, [key]:value})); setSaved(false);
  }
  async function submit(event:React.FormEvent) {
    event.preventDefault();
    if (!complete || saving || !loaded) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const result = await saveLearningProfile(draft as LearningPreferences, revision);
      setRevision(result.revision); setSaved(true);
      window.dispatchEvent(new Event("learning-profile-updated"));
      onSaved?.();
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败，当前输入仍保留。"); }
    finally { setSaving(false); }
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">正在读取学习画像…</p>;
  return <form onSubmit={submit} className="space-y-7" aria-label="学习画像与偏好">
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">{firstRun ? "先设置适合你的学习方式" : "学习画像与偏好"}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">请明确选择学习基础、学习要求和各项偏好；不确定时可选“不确定”。速度会结合这些信息调整，也能在首页随时更改。自述不会被当作已经掌握的证明。</p>
    </div>
    <fieldset disabled={saving} className="space-y-6">
      <legend className="sr-only">必选学习偏好</legend>
      {(Object.keys(choices) as ChoiceKey[]).map((key) => <fieldset key={key} className="space-y-2">
        <legend className="text-sm font-medium mb-2">{choices[key].title} <span className="text-muted-foreground">（必选）</span></legend>
        <div className="grid gap-2 sm:grid-cols-2">{choices[key].options.map((option) => <label key={option.value}
          className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${draft[key] === option.value ? "border-brand bg-brand-muted" : "border-border"}`}>
          <input type="radio" required name={`${id}-${key}`} value={option.value} checked={draft[key] === option.value}
            onChange={() => edit(key, option.value)} className="mt-1 accent-current" />
          <span><span className="block text-sm font-medium">{option.label}</span><span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{option.detail}</span></span>
        </label>)}</div>
      </fieldset>)}
      <div className="space-y-4 border-t border-border pt-5">
        {([{key:"background", title:"我的学习背景", placeholder:"例如：BME 初学者，学过一点 C，对电路还不熟悉。"},
          {key:"current_progress", title:"我目前学到哪里", placeholder:"例如：会写循环，正在学函数；STM32 还没开始。也可以写不确定。"},
          {key:"learning_goal", title:"近期想学什么", placeholder:"例如：读懂资料后，独立写出按键控制 LED 的程序。之后也可以针对每门课程细化。"}] as const).map((field) => <div key={field.key} className="space-y-1.5">
          <label htmlFor={`${id}-${field.key}`} className="text-sm font-medium">{field.title} <span className="text-muted-foreground">（选填）</span></label>
          <textarea id={`${id}-${field.key}`} value={draft[field.key]} maxLength={2000} onChange={(e) => edit(field.key,e.target.value)}
            placeholder={field.placeholder} className="block w-full min-h-20 rounded-lg border border-border bg-background p-3 text-sm" />
        </div>)}
      </div>
    </fieldset>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm space-y-2">
      <p>{error}</p><p className="text-muted-foreground">保存失败时不会清空当前输入。若其他页面已修改画像，可重新载入后继续。</p>
      <button type="button" onClick={() => { if (window.confirm("重新载入会替换当前未保存的输入，是否继续？")) {setLoading(true);setReloadKey((n) => n+1);} }} className="underline">重新载入画像</button>
    </div>}
    {saved && <p role="status" className="text-sm text-brand">学习画像已保存。后续教学会读取这些偏好。</p>}
    <button type="submit" disabled={!complete || saving || !loaded} className="rounded-lg bg-brand text-brand-foreground px-5 py-3 text-sm font-medium disabled:opacity-50">
      {saving ? "正在保存…" : firstRun ? "保存画像并进入" : "保存学习偏好"}
    </button>
    {!complete && <p className="text-xs text-muted-foreground">请选择全部学习偏好后再继续。</p>}
  </form>;
}
