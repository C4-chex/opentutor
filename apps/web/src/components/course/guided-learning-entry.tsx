"use client";
import Link from "next/link";
import { useUiText } from "@/hooks/use-ui-text";
import { useWorkspaceStore } from "@/store/workspace";
import { findNodeById } from "@/lib/content-tree";
import type { ContentNode } from "@/lib/api";

function firstLeaf(nodes: ContentNode[]): ContentNode | undefined {
  for (const node of nodes) {
    const child = node.children?.length ? firstLeaf(node.children) : undefined;
    if (child) return child;
    if (!node.children?.length && node.content) return node;
  }
}

export function GuidedLearningEntry({courseId,nodes}: {courseId:string;nodes:ContentNode[]}) {
  const ui = useUiText();
  const selected = useWorkspaceStore((state) => state.selectedNodeId);
  const node = (selected ? findNodeById(nodes,selected) : null) || firstLeaf(nodes);
  if (!node) return null;
  return <section className="rounded-2xl border border-brand/30 bg-brand-muted/10 p-5 flex flex-wrap justify-between gap-4 items-center">
    <div className="space-y-1"><h2 className="font-semibold">{ui("AI guided learning")}</h2><p className="text-sm text-muted-foreground">{ui("Foundations and examples → explain it yourself → practice and transfer.")}</p><p className="text-xs text-muted-foreground">{node.title}</p></div>
    <Link className="rounded-lg bg-brand text-brand-foreground px-5 py-3 text-sm font-medium" href={`/course/${courseId}/unit/${node.id}#guided-learning`}>{ui("Open guided learning")}</Link>
  </section>;
}
