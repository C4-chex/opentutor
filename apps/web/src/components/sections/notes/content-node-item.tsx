"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ContentNode } from "@/lib/api";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

interface ContentNodeItemProps { node: ContentNode; depth?: number }

export function ContentNodeItem({ node, depth = 0 }: ContentNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = `source-content-${node.id}`;
  return <section id={`content-${node.id}`} className="mb-3 rounded-xl border border-border/60"
    style={{ marginLeft: depth > 0 ? 12 : undefined }}>
    <button type="button" aria-expanded={expanded} aria-controls={contentId}
      onClick={() => setExpanded(value => !value)}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted/40">
      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`} />
      <span className="break-words">{node.title}</span>
    </button>
    <div id={contentId} hidden={!expanded} style={!expanded ? {display:"none"} : undefined} className="space-y-3 px-3 pb-3">
      {node.content && <MarkdownRenderer content={node.content} className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert" />}
      {node.children?.map(child => <ContentNodeItem key={child.id} node={child} depth={depth + 1} />)}
    </div>
  </section>;
}
