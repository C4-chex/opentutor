"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { useT } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loadLearningProfile, updateLearningPace, type LearningPace, type LearningProfileState } from "@/lib/api/learning-profile";

export function LearningPaceButton() {
  const t=useT();
  const [open,setOpen]=useState(false);
  const [state,setState]=useState<LearningProfileState|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try { setState(await loadLearningProfile()); }
    catch(err){setError((err as Error).message);}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{
    void load();
    const onProfile=(event:Event)=>{
      const updated=(event as CustomEvent<LearningProfileState>).detail;
      if (updated && typeof updated.complete==="boolean") setState(updated);
      else void load();
    };
    window.addEventListener("learning-profile-updated",onProfile);
    return ()=>window.removeEventListener("learning-profile-updated",onProfile);
  },[load]);
  const selected=state?.profile?.learning_pace ?? "adaptive";
  async function choose(mode:LearningPace) {
    if (!state?.complete || busy || loading || mode===selected) return;
    setBusy(true);setError("");setMessage("");
    try {
      const updated=await updateLearningPace(mode,state.revision);
      setState(updated);setMessage(t("pace.saved"));
      window.dispatchEvent(new CustomEvent("learning-profile-updated",{detail:updated}));
    } catch(err) {setError((err as Error).message);}
    finally {setBusy(false);}
  }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="rounded-full h-10 gap-2" aria-label={t("pace.button")}>
        <Gauge className="size-4" aria-hidden="true"/>{t("pace.title")}: {t(`pace.${selected}`)}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl space-y-4 p-5">
      <div className="space-y-1"><h2 className="font-semibold">{t("pace.title")}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">{t("pace.description")}</p></div>
      {loading ? <p role="status" className="text-xs">{t("pace.loading")}</p> : null}
      <div role="group" aria-label={t("pace.choices")} className="grid grid-cols-3 gap-2">
        {(["slow","adaptive","fast"] as const).map(mode=><Button key={mode} type="button"
          variant={selected===mode ? "default" : "outline"} aria-pressed={selected===mode}
          disabled={loading || busy || !state?.complete} onClick={()=>void choose(mode)} className="px-2 text-xs">
          {t(`pace.${mode}`)}
        </Button>)}
      </div>
      {state?.profile ? <div className="text-xs space-y-1 text-muted-foreground">
        <p>{t("pace.foundation")}: {t(`pace.foundation.${state.profile.foundation_level ?? "unsure"}`)}</p>
        <p>{t("pace.depth")}: {t(`pace.depth.${state.profile.learning_depth ?? "unsure"}`)}</p>
        {state.pace_plan ? <p className="pt-1 leading-relaxed">{t("pace.plan").replace("{concepts}",String(state.pace_plan.concepts_per_step)).replace("{tasks}",String(state.pace_plan.practice_tasks))}</p> : null}
      </div> : !loading && !error ? <p className="text-xs">{t("pace.needsProfile")}</p> : null}
      {message ? <p role="status" className="text-xs text-brand">{message}</p> : null}
      {error ? <div role="alert" className="space-y-1 text-xs text-destructive"><p>{error}</p>
        <button type="button" onClick={()=>void load()} disabled={busy} className="underline">{t("pace.reload")}</button></div> : null}
      <Link href="/settings#learning-profile" className="block text-xs underline underline-offset-4">{t("pace.editProfile")}</Link>
    </PopoverContent>
  </Popover>;
}
