import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import { GitHubImporter } from "./github-importer";
import { previewGitHub, importGitHub } from "@/lib/api/github";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api/github", () => ({ previewGitHub: vi.fn(), importGitHub: vi.fn() }));
const source = {
  snapshot_id: "snapshot", repository: "example/tutorial", url: "https://github.com/example/tutorial/tree/main/docs",
  ref: "main", commit: "a".repeat(40), path: "docs", title: "docs", has_documents: false, skipped_count: 0,
  files: [
    { path: "docs/main.html", relative_path: "main.html", size: 60, content: '<div th:text="${message}">Original</div>', source_url: "https://github.com/example/tutorial/blob/commit/docs/main.html", kind: "code" as const, language: "html", recommended: true },
    { path: "docs/Test.java", relative_path: "Test.java", size: 20, content: "class Test {}", source_url: "https://github.com/example/tutorial/blob/commit/docs/Test.java", kind: "code" as const, language: "java", recommended: false },
  ],
};
beforeEach(() => {
  vi.clearAllMocks(); setLocale("en");
  vi.mocked(previewGitHub).mockResolvedValue(source);
  vi.mocked(importGitHub).mockResolvedValue({course_id:"course", job_id:"job", first_node_id:"first", files_imported:1, nodes_created:3, commit:"a".repeat(40)});
});
afterEach(() => { cleanup(); localStorage.clear(); });

async function preview() {
  fireEvent.change(screen.getByLabelText("GitHub source URL"), {target:{value:source.url}});
  fireEvent.click(screen.getByRole("button", {name:"Preview material"}));
  await screen.findByRole("heading", {name:/Choose source files/});
}

describe("GitHub learning material import", () => {
  it("previews literal source code and recommends non-test files", async () => {
    const {container} = render(<GitHubImporter />); await preview();
    expect(screen.getByLabelText("Select file: main.html")).toBeChecked();
    expect(screen.getByLabelText("Select file: Test.java")).not.toBeChecked();
    expect(screen.getByLabelText("Original file preview").textContent).toContain('<div th:text="${message}">Original</div>');
    expect(container.querySelector('[th\\:text]')).toBeNull();
  });
  it("imports only selected paths and shows explicit learning links", async () => {
    render(<GitHubImporter />); await preview();
    fireEvent.click(screen.getByLabelText("Select file: main.html"));
    fireEvent.click(screen.getByLabelText("Select file: Test.java"));
    fireEvent.click(screen.getByRole("button", {name:"Import selected files (1)"}));
    await screen.findByText("Learning material imported");
    expect(importGitHub).toHaveBeenCalledWith("snapshot", ["docs/Test.java"], "docs", expect.any(String));
    expect(screen.getByRole("link", {name:"Enter learning space"})).toHaveAttribute("href", "/course/course");
    expect(screen.getByRole("link", {name:"Read the first source file"})).toHaveAttribute("href", "/course/course/unit/first");
  });
  it("clears stale previews after the source URL changes", async () => {
    render(<GitHubImporter />); await preview();
    fireEvent.change(screen.getByLabelText("GitHub source URL"), {target:{value:"https://github.com/another/repo"}});
    expect(screen.queryByRole("button", {name:/Import selected files/})).not.toBeInTheDocument();
  });
  it("shows extraction errors without creating a learning space", async () => {
    vi.mocked(previewGitHub).mockRejectedValue(new Error("GitHub rate limit"));
    render(<GitHubImporter />);
    fireEvent.change(screen.getByLabelText("GitHub source URL"), {target:{value:source.url}});
    fireEvent.click(screen.getByRole("button", {name:"Preview material"}));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("GitHub rate limit"));
    expect(importGitHub).not.toHaveBeenCalled();
  });
});
