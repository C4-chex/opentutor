import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {restructureNotes} from "@/lib/api";
import { NotesSection } from "./notes-section";
import NotesBlock from "@/components/blocks/blocks/notes-block";
import { useCourseStore } from "@/store/course";
import { useWorkspaceStore } from "@/store/workspace";
import { setLocale } from "@/lib/i18n";

vi.mock("@/lib/i18n-context", () => ({ useT: () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-batch-manager", () => ({ useBatchManager: () => ({ saving: false, latestBatch: null, wrapSave: vi.fn() }) }));
vi.mock("@/components/shared/markdown-renderer", () => ({ MarkdownRenderer: ({content}: {content: string}) => <pre>{content}</pre> }));
vi.mock("@/lib/api", () => ({
  listGeneratedNoteBatches: vi.fn(async () => []), getAiNoteForNode: vi.fn(async () => null),
  restructureNotes: vi.fn(), saveGeneratedNotes: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  setLocale("en");
  useCourseStore.setState({courses:[{id:"github", name:"GitHub", description:null, created_at:"2026-10-17", metadata:{github_source:{repository:"example/tutorial"}}}]});
  useCourseStore.setState({contentTree:[{id:"file", title:"hello.html", type:"file", source_type:"url", content:'```html\n<h1 th:text="${message}">Hello</h1>\n```', level:2, order_index:0, children:[]}]});
  useWorkspaceStore.setState({selectedNodeId:"file"});
});
afterEach(() => { cleanup(); useCourseStore.setState({contentTree:[], courses:[]}); useWorkspaceStore.setState({selectedNodeId:null}); });

it("shows imported source immediately without requiring AI note generation", async () => {
  await act(async () => { render(<NotesBlock courseId="github" blockId="cached-notes" config={{}} aiActionsEnabled={false} />); });
  expect(screen.getByText(/<h1 th:text/)).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", {name:"hello.html"}));
  expect(screen.getByText(/<h1 th:text/)).toBeVisible();
  expect(screen.getByRole("button", {name:"Source"})).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText("No AI notes yet for this section.")).not.toBeInTheDocument();
});

it("uses source view after GitHub course metadata arrives despite an older cached layout", async () => {
  await act(async () => { render(<NotesBlock courseId="later" blockId="old-notes" config={{}} aiActionsEnabled={false} />); });
  expect(screen.getByRole("button", {name:"AI Notes"})).toHaveAttribute("aria-pressed", "true");
  await act(async () => { useCourseStore.setState({courses:[{id:"later", name:"Later", description:null, created_at:"2026-10-17", metadata:{github_source:{repository:"example/tutorial"}}}]}); });
  expect(screen.getByRole("button", {name:"Source"})).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/<h1 th:text/)).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", {name:"hello.html"}));
  expect(screen.getByText(/<h1 th:text/)).toBeVisible();
});

it("retains the existing AI-first view for other courses and permits switching to source", async () => {
  await act(async () => { render(<NotesSection courseId="ordinary" />); });
  expect(screen.getByRole("button", {name:"AI Notes"})).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", {name:"Source"}));
  expect(screen.getByText(/<h1 th:text/)).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", {name:"hello.html"}));
  expect(screen.getByText(/<h1 th:text/)).toBeVisible();
});

it("collapses an imported file again without losing its source content", async () => {
  await act(async () => {render(<NotesBlock courseId="github" blockId="notes" config={{}} aiActionsEnabled={false} />);});
  const toggle=screen.getByRole("button",{name:"hello.html"});
  fireEvent.click(toggle);expect(screen.getByText(/<h1 th:text/)).toBeVisible();
  fireEvent.click(toggle);expect(screen.getByText(/<h1 th:text/)).not.toBeVisible();
});

it("ignores a late AI result from the previous chapter and preserves the new draft", async()=>{
 const first=useCourseStore.getState().contentTree[0];
 useCourseStore.setState({contentTree:[first,{...first,id:"second",title:"Second chapter"}]});
 let firstDone!:(value:Awaited<ReturnType<typeof restructureNotes>>)=>void,secondDone!:(value:Awaited<ReturnType<typeof restructureNotes>>)=>void;
 vi.mocked(restructureNotes).mockImplementationOnce(()=>new Promise(resolve=>{firstDone=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{secondDone=resolve;}));
 await act(async()=>{render(<NotesSection courseId="ordinary"/>);});
 fireEvent.click(screen.getByTestId("notes-generate"));
 await act(async()=>{useWorkspaceStore.setState({selectedNodeId:"second"});});
 expect(screen.getByTestId("notes-generate")).not.toBeDisabled();fireEvent.click(screen.getByTestId("notes-generate"));
 await act(async()=>{secondDone({original_title:"New notes",ai_content:"SECOND_CONTENT",format_used:"markdown"});});
 expect(screen.getByText("SECOND_CONTENT")).toBeInTheDocument();
 await act(async()=>{firstDone({original_title:"Old notes",ai_content:"FIRST_CONTENT",format_used:"markdown"});});
 expect(screen.getByText("SECOND_CONTENT")).toBeInTheDocument();expect(screen.queryByText("FIRST_CONTENT")).not.toBeInTheDocument();
});
