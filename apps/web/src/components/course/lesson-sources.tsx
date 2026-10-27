"use client";

import Link from "next/link";
import { useUiText } from "@/hooks/use-ui-text";
import type { GuidedLesson } from "@/lib/api/guided-learning";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Source = GuidedLesson["sources"][number];
function sourceLabel(source: Source): string {
  if (source.url) {
    try {
      const parts = new URL(source.url).pathname.split("/").filter(Boolean);
      const blob = parts.indexOf("blob");
      const path = blob >= 0 ? parts.slice(blob + 2) : parts;
      if (path.length) return decodeURIComponent(path.slice(-2).join("/"));
    } catch { /* Fall back to the saved title. */ }
  }
  return source.title;
}

export function LessonSources({courseId, sources}: {courseId: string; sources: Source[]}) {
  const ui = useUiText();
  const unique = [...new Map(sources.map((source) => [source.url || source.node_id,source])).values()];
  if (!unique.length) return null;
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
        {ui("View source material")} ({unique.length})
      </button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{ui("Source material")}</DialogTitle>
        <DialogDescription>{ui("Original files used for this lesson. Open a link to check the source.")}</DialogDescription>
      </DialogHeader>
      <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
        {unique.map((source) => <li key={source.url || source.node_id}>
          {source.url?.startsWith("https://") ? <a href={source.url} target="_blank" rel="noreferrer" className="block break-all rounded-lg border border-border p-3 underline underline-offset-4 hover:bg-muted" title={source.url}>{sourceLabel(source)}</a>
            : <Link href={`/course/${courseId}/unit/${source.node_id}`} className="block rounded-lg border border-border p-3 underline underline-offset-4 hover:bg-muted">{source.title}</Link>}
        </li>)}
      </ul>
    </DialogContent>
  </Dialog>;
}
