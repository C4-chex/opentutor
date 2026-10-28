"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnswerResult } from "@/lib/api";

interface QuizResultProps {
  result: AnswerResult;
  onReview?: (reason: string) => Promise<void>;
  reviewing?: boolean;
}

export function QuizResult({ result, onReview, reviewing }: QuizResultProps) {
  const t = useT();
  const [reason, setReason] = useState("");
  const status = result.status ?? (result.is_correct ? "correct" : "incorrect");
  return (
    <div className="space-y-3 pt-1" aria-live="polite" data-testid="grading-result">
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
        <Badge variant={result.is_correct ? "default" : "outline"}>{t(`grading.${status}`)}</Badge>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.explanation || t("grading.tryAgainHint")}</p>
        {result.is_correct === false || status === "partial" ? <p className="text-xs text-muted-foreground">{t("grading.retryHint")}</p> : null}
        {result.is_correct && result.independent === false ? <p className="text-xs text-muted-foreground">{t("grading.corrected")}</p> : null}
        {result.grading_method === "static_code_review" ? <p className="text-xs text-muted-foreground">{t("grading.staticCode")}</p> : null}
      </div>
      {result.attempt_id && onReview ? <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer w-fit py-1">{t("grading.reviewEntry")}</summary>
        <div className="mt-2 space-y-2 rounded-lg border p-3">
          <label className="block">{t("grading.reviewReason")}
            <textarea className="w-full border rounded-lg p-2 mt-1 bg-background text-foreground" maxLength={1000}
              value={reason} onChange={e=>setReason(e.target.value)} disabled={reviewing}/>
          </label>
          <Button type="button" variant="outline" size="sm" disabled={reviewing} onClick={()=>void onReview(reason)}>
            {t(reviewing ? "grading.reviewing" : "grading.review")}
          </Button>
          {(result.history?.length ?? 0)>1 ? <details>
            <summary className="cursor-pointer py-1">{t("grading.history")}</summary>
            <ol className="mt-2 space-y-2">{result.history!.map(h=><li key={h.revision}>
              #{h.revision} · {t(`grading.${h.status}`)} · {new Date(h.at).toLocaleString()}
            </li>)}</ol>
          </details> : null}
        </div>
      </details> : null}
    </div>
  );
}
