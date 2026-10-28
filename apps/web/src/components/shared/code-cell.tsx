"use client";

import { useRef, useState } from "react";
import { useUiText } from "@/hooks/use-ui-text";
import {useClassroomNotebook} from "@/components/course/notebook-context";
import {codeExcerptMarkdown} from "@/lib/classroom-notes";

// Small, presentation-only token coloring. React escapes every token; nothing is executed.
function ColoredCode({code, language}: {code: string; language: string}) {
  if (!/^(?:c|cpp|c\+\+|python|py|javascript|js|typescript|ts|java|json|bash|sh|sql)$/.test(language)) return <>{code}</>;
  const tokens = code.split(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|\#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:int|float|double|char|bool|long|unsigned|void|const|static|return|if|else|for|while|break|continue|class|struct|import|from|def|as|in|not|and|or|True|False|None|let|var|function|new|public|private|true|false|null|print|printf)\b|\b\d+(?:\.\d+)?\b)/g);
  return <>{tokens.map((text,index) => {
    if (index % 2 === 0) return text;
    const kind = /^(?:\/\/|\/\*|#)/.test(text) ? "comment" : /^["']/.test(text) ? "string" : /^\d/.test(text) ? "number" : "keyword";
    return <span key={index} className={`code-token-${kind}`}>{text}</span>;
  })}</>;
}

export function CodeCell({code, language = ""}: {code: string; language?: string}) {
  const ui = useUiText();const notebook=useClassroomNotebook();const root=useRef<HTMLDivElement>(null);
  const [status,setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const calculation = language === "calculation";
  const expected = language === "expected-output";
  const output = expected || /^(?:output|text|console|result)$/.test(language);
  const label = expected ? ui("Expected output") : calculation ? ui("Calculation") : output ? ui("Output / result") : language ? language.toUpperCase() : ui("Code");
  const copyLabel = calculation || output ? ui("Copy content") : ui("Copy code");
  async function copy() {
    try { await navigator.clipboard.writeText(code); setStatus("copied"); }
    catch { setStatus("failed"); }
  }
  return <div ref={root} className={`notebook-cell my-4 overflow-hidden rounded-xl border border-border ${calculation || output ? "bg-muted/20" : "bg-muted/50"}`}>
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
      <span className="font-medium tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
      {notebook&&<button type="button" aria-label={ui(calculation||output?"Take notes on this result":"Take notes on this code")}
        onClick={()=>notebook.annotate(codeExcerptMarkdown(code,language),root.current?.closest("#guided-learning")?"ai":"classroom")}
        className="rounded px-2 py-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-brand">{ui("Take a note")}</button>}
      <button type="button" onClick={() => void copy()} className="rounded px-2 py-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-brand" aria-label={copyLabel}>
        {status === "copied" ? ui("Copied") : status === "failed" ? ui("Copy failed. Select the text to copy.") : copyLabel}
      </button>
      </div>
    </div>
    <pre data-language={language} className="m-0 overflow-x-auto p-4 text-sm leading-7" tabIndex={0} aria-label={label}>
      <code className="block whitespace-pre font-mono"><ColoredCode code={code} language={language} /></code>
    </pre>
  </div>;
}
