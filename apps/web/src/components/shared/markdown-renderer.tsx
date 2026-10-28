"use client";

import { useUiText } from "@/hooks/use-ui-text";

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { CodeCell } from "./code-cell";
import { prepareLessonMarkdown } from "@/lib/markdown/lesson";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { buildMermaidFallbackText, stabilizeMermaidCode } from "@/lib/markdown/mermaid";
import "katex/dist/katex.min.css";

type MermaidInstance = typeof import("mermaid")["default"];

let mermaidLoader: Promise<MermaidInstance> | null = null;

function getMermaid() {
  if (!mermaidLoader) {
    mermaidLoader = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        suppressErrorRendering: true,
      });
      return mermaid;
    });
  }
  return mermaidLoader;
}

function createMermaidRenderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `mermaid-${crypto.randomUUID()}`;
  }
  return `mermaid-${Math.random().toString(36).slice(2, 10)}`;
}

function MermaidBlock({ code }: { code: string }) {
  const ui = useUiText();
  const renderIdRef = useRef<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [fallbackText, setFallbackText] = useState("");

  if (renderIdRef.current == null) {
    renderIdRef.current = createMermaidRenderId();
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = await getMermaid();
        const preparedCode = stabilizeMermaidCode(code);
        const renderId = renderIdRef.current ?? createMermaidRenderId();
        renderIdRef.current = renderId;
        const { svg } = await mermaid.render(renderId, preparedCode);
        if (!cancelled) {
          setSvgMarkup(DOMPurify.sanitize(svg));
          setFallbackText("");
        }
      } catch {
        if (!cancelled) {
          setSvgMarkup("");
          setFallbackText(buildMermaidFallbackText(code));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (svgMarkup) {
    return (
      <div
        className="my-4 flex justify-center"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    );
  }

  if (fallbackText) {
    return (
      <div className="my-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {ui("Diagram preview unavailable. Showing a text outline instead.")}</p>
          <pre className="whitespace-pre-wrap text-sm text-foreground">{fallbackText}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
        {ui("Rendering diagram...")}</div>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  teaching?: boolean;
}

export function MarkdownRenderer({
  content,
  className,
  teaching = false,
}: MarkdownRendererProps) {
  return (
    <div role="article" className={`rich-markdown min-w-0 ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({children}) {
            const child = Children.toArray(children)[0];
            if (isValidElement<{className?: string; children?: ReactNode}>(child) && typeof child.props.children === "string") {
              const language = /language-([^\s]+)/.exec(child.props.className || "")?.[1] || "";
              const code = String(child.props.children ?? "").replace(/\n$/, "");
              if (language === "mermaid") return <MermaidBlock code={code.trim()} />;
              return <CodeCell key={`${language}:${code}`} code={code} language={language} />;
            }
            return <pre className="overflow-x-auto rounded-xl bg-muted/30 p-4">{children}</pre>;
          },
          code({children, className: codeClassName}) {
            return <code className={`rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[0.9em] ${codeClassName || ""}`}>{children}</code>;
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-border/60 text-sm">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border/60 bg-muted/30 px-3 py-2 text-left font-medium">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-border/60 px-3 py-2">{children}</td>;
          },
        }}
      >
        {teaching ? prepareLessonMarkdown(content) : content}
      </ReactMarkdown>
    </div>
  );
}
