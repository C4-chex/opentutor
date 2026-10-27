"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUiText } from "@/hooks/use-ui-text";
import { previewGitHub, importGitHub, type GitHubMaterialPreview, type GitHubImportResult } from "@/lib/api/github";

export function GitHubImporter() {
  const ui = useUiText();
  const params = useSearchParams();
  const [url, setUrl] = useState(() => params.get("url") || "");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<GitHubMaterialPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState("");
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GitHubImportResult | null>(null);
  const requestId = useRef<string | null>(null);
  const activeFile = preview?.files.find((file) => file.path === activePath);

  async function handlePreview() {
    setBusy("preview"); setError(""); setResult(null); setPreview(null);
    requestId.current = null;
    try {
      const data = await previewGitHub(url.trim());
      setPreview(data);
      setName(data.title);
      setSelected(new Set(data.files.filter((file) => file.recommended).map((file) => file.path)));
      setActivePath(data.files[0]?.path || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : ui("Could not preview GitHub material."));
    } finally { setBusy(null); }
  }

  async function handleImport() {
    if (!preview || !selected.size) return;
    setBusy("import"); setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      setResult(await importGitHub(preview.snapshot_id, [...selected], name.trim() || preview.title, requestId.current));
    } catch (err) {
      setError(err instanceof Error ? err.message : ui("Could not import GitHub material."));
    } finally { setBusy(null); }
  }

  function changeSelection(path: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(path); else next.delete(path);
      return next;
    });
    requestId.current = null;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 space-y-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← {ui("Back to home")}</Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{ui("Import a GitHub tutorial")}</h1>
        <p className="text-sm text-muted-foreground">{ui("Paste a public repository, directory or file link. Preview the original files before importing.")}</p>
      </div>
      <form className="flex flex-col sm:flex-row gap-3" onSubmit={(event) => { event.preventDefault(); void handlePreview(); }}>
        <label className="sr-only" htmlFor="github-url">{ui("GitHub source URL")}</label>
        <input id="github-url" type="url" required value={url} disabled={!!busy}
          onChange={(event) => { setUrl(event.target.value); setPreview(null); setResult(null); }}
          placeholder="https://github.com/owner/repository/tree/main/docs"
          className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={!!busy} className="rounded-lg bg-brand text-brand-foreground px-5 py-2 text-sm disabled:opacity-50">
          {busy === "preview" ? ui("Reading source files...") : ui("Preview material")}
        </button>
      </form>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {result && <section role="status" className="rounded-xl border border-brand/40 bg-brand-muted/20 p-5 space-y-3">
        <h2 className="font-semibold">{ui("Learning material imported")}</h2>
        <p className="text-sm">{result.files_imported} {ui("source files are ready. Open a file to study with the tutor.")}</p>
        <div className="flex flex-wrap gap-4 text-sm text-brand underline">
          <Link href={`/course/${result.course_id}`}>{ui("Enter learning space")}</Link>
          <Link href={`/course/${result.course_id}/unit/${result.first_node_id}`}>{ui("Read the first source file")}</Link>
          <a href={`/api/content/files/${result.job_id}`} download>{ui("Download original material pack")}</a>
        </div>
      </section>}
      {preview && <>
        <section className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm break-all">{preview.repository} / {preview.path || "/"}</p>
          <p className="text-xs text-muted-foreground">{ui("Pinned source version")}: {preview.commit.slice(0, 12)} · {preview.files.length} {ui("readable files")}</p>
          {!preview.has_documents && <p className="text-sm rounded-lg bg-muted p-3">{ui("This directory contains code examples without a standalone tutorial. The original code, templates and configuration will be preserved for study.")}</p>}
          <label className="flex flex-col gap-2 text-sm" htmlFor="github-course-name">{ui("Learning space name")}
            <input id="github-course-name" maxLength={100} value={name} disabled={!!busy || !!result}
              onChange={(event) => { setName(event.target.value); requestId.current = null; }}
              className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
        </section>
        <section className="grid lg:grid-cols-[minmax(280px,2fr)_3fr] gap-4">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="p-3 border-b border-border space-y-2">
              <h2 className="font-semibold text-sm">{ui("Choose source files")} · {selected.size}/{preview.files.length}</h2>
              <div className="flex flex-wrap gap-3 text-xs text-brand">
                <button disabled={!!busy || !!result} onClick={() => { setSelected(new Set(preview.files.filter((file) => file.recommended).map((file) => file.path))); requestId.current = null; }}>{ui("Recommended selection")}</button>
                <button disabled={!!busy || !!result} onClick={() => { setSelected(new Set(preview.files.map((file) => file.path))); requestId.current = null; }}>{ui("Select all")}</button>
                <button disabled={!!busy || !!result} onClick={() => { setSelected(new Set()); requestId.current = null; }}>{ui("Clear selection")}</button>
              </div>
              <p className="text-xs text-muted-foreground">{ui("Test files are optional. Click a filename to preview its original content.")}</p>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
              {preview.files.map((file) => <div key={file.path} className={`flex items-start gap-2 p-3 ${activePath === file.path ? "bg-muted" : ""}`}>
                <input type="checkbox" aria-label={`${ui("Select file")}: ${file.relative_path}`} checked={selected.has(file.path)}
                  disabled={!!busy || !!result} className="mt-1" onChange={(event) => changeSelection(file.path, event.target.checked)} />
                <button className="text-left text-xs min-w-0 flex-1 break-all" onClick={() => setActivePath(file.path)} aria-label={`${ui("Preview file")}: ${file.relative_path}`}>
                  {file.relative_path}<span className="block text-muted-foreground mt-1">{file.kind === "document" ? ui("Document") : ui("Source code")} · {(file.size / 1024).toFixed(1)} KB</span>
                </button>
              </div>)}
            </div>
          </div>
          <div className="rounded-xl border border-border min-w-0 overflow-hidden">
            <div className="p-3 border-b border-border space-y-2">
              <h2 className="text-sm font-semibold break-all">{activeFile?.relative_path}</h2>
              {activeFile && <a className="text-xs text-brand underline" href={activeFile.source_url} target="_blank" rel="noreferrer">{ui("View pinned original")}</a>}
            </div>
            <pre aria-label={ui("Original file preview")} className="p-4 text-xs leading-relaxed overflow-auto max-h-[520px] whitespace-pre-wrap break-words">{activeFile?.content}</pre>
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{ui("Importing reads source text without running repository code or generating AI summaries.")}</p>
          <button onClick={() => void handleImport()} disabled={!!busy || !selected.size || !!result}
            className="rounded-lg bg-brand text-brand-foreground px-5 py-3 text-sm disabled:opacity-50">
            {busy === "import" ? ui("Importing selected files...") : `${ui("Import selected files")} (${selected.size})`}
          </button>
        </div>
      </>}
    </div>
  );
}
