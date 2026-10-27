import {act,cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ClassroomNotebook} from "./classroom-notebook";
import {CodeCell} from "@/components/shared/code-cell";
import {loadClassroomNote,saveClassroomNote,outlineClassroomNote} from "@/lib/api/classroom-notes";
import {setLocale} from "@/lib/i18n";
vi.mock("@/lib/api/classroom-notes",()=>({loadClassroomNote:vi.fn(),saveClassroomNote:vi.fn(),outlineClassroomNote:vi.fn()}));
const doc={node_id:"node",title:"Basics",markdown:"Existing personal notes",revision:1,updated_at:null};
const source='int hour = tick / 3600;\n\nprintf("%02d", hour);';
function Lesson(){return <section id="guided-learning"><p data-testid="lesson-sentence">Integer division counts complete groups.</p><CodeCell code={source} language="c"/></section>;}
async function setup(nodeId="node"){
 const view=render(<ClassroomNotebook key={nodeId} courseId="course" nodeId={nodeId} title="Basics"><Lesson/></ClassroomNotebook>);
 await act(async()=>{});return view;
}
function reflect(text:string){fireEvent.change(screen.getByRole("textbox",{name:"My understanding (optional) 1"}),{target:{value:text}});}
async function captureCode(){fireEvent.click(screen.getByRole("button",{name:"Take notes on this code"}));await act(async()=>{});}
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();sessionStorage.clear();setLocale("en");
 vi.mocked(loadClassroomNote).mockResolvedValue(doc);
 vi.mocked(saveClassroomNote).mockImplementation(async(_c,_n,markdown,revision)=>({...doc,markdown,revision:revision+1}));});
afterEach(()=>{window.getSelection()?.removeAllRanges();cleanup();vi.useRealTimers();});
it("records a code cell and personal reflection together, without replacing notes or calling AI",async()=>{
 await setup();await captureCode();reflect("The remainder belongs to the next smaller unit.");
 expect(saveClassroomNote).not.toHaveBeenCalled();
 expect(screen.getByRole("tab",{name:"Excerpt and reflection (1)"})).toHaveAttribute("aria-selected","true");
 const panel=screen.getByRole("tabpanel");expect(within(panel).getByText("AI lecture excerpt · 1")).toBeInTheDocument();
 expect(within(panel).queryByRole("button",{name:"Take notes on this code"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Add excerpt and reflection to notes"}));
 await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
 expect(saveClassroomNote).toHaveBeenCalledOnce();const markdown=vi.mocked(saveClassroomNote).mock.calls[0][2];
 expect(markdown).toContain(doc.markdown);expect(markdown).toContain('```c\n'+source+'\n```');
 expect(markdown).toContain('### My understanding\n\nThe remainder belongs to the next smaller unit.');
 expect(markdown).not.toContain('Back to lesson');expect(outlineClassroomNote).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("tab",{name:"Full chapter notebook"}));
 expect(screen.getByLabelText("Classroom note editor")).toHaveValue(markdown);
});
it("opens a reflection composer for selected text and preserves the original sentence",async()=>{
 await setup();const range=document.createRange();range.selectNodeContents(screen.getByTestId("lesson-sentence"));
 const selection=window.getSelection()!;selection.addRange(range);
 act(()=>document.dispatchEvent(new Event("selectionchange")));
 fireEvent.click(screen.getByRole("button",{name:"Annotate selected text"}));await act(async()=>{});
 const panel=screen.getByRole("tabpanel");expect(within(panel).getByText("Integer division counts complete groups.")).toBeInTheDocument();
 expect(within(panel).getByRole("textbox")).toHaveValue("");expect(saveClassroomNote).not.toHaveBeenCalled();
});
it("restores an unfinished reflection after closing and reloading the chapter",async()=>{
 const view=await setup();await captureCode();reflect("A draft I have not saved yet");
 fireEvent.click(screen.getByRole("button",{name:"Close classroom notes"}));
 fireEvent.click(screen.getAllByRole("button",{name:"Classroom notes"})[0]);
 expect(screen.getByRole("textbox",{name:"My understanding (optional) 1"})).toHaveValue("A draft I have not saved yet");
 view.unmount();await setup();fireEvent.click(screen.getAllByRole("button",{name:"Classroom notes"})[0]);
 expect(screen.getByRole("textbox",{name:"My understanding (optional) 1"})).toHaveValue("A draft I have not saved yet");
 expect(saveClassroomNote).not.toHaveBeenCalled();
});
it("isolates pending excerpts by chapter",async()=>{
 const view=await setup();await captureCode();reflect("Only for chapter one");view.unmount();
 await setup("another-node");fireEvent.click(screen.getAllByRole("button",{name:"Classroom notes"})[0]);
 fireEvent.click(screen.getByRole("tab",{name:"Excerpt and reflection"}));
 expect(screen.queryByRole("textbox",{name:"My understanding (optional) 1"})).not.toBeInTheDocument();
 expect(screen.queryByText("Only for chapter one")).not.toBeInTheDocument();
});
it("keeps the excerpt exportable if the notebook is full, then allows it after space is available",async()=>{
 vi.mocked(loadClassroomNote).mockResolvedValue({...doc,markdown:"x".repeat(59995)});
 await setup();await captureCode();reflect("Keep this reflection");
 fireEvent.click(screen.getByRole("button",{name:"Add excerpt and reflection to notes"}));
 expect(screen.getByRole("alert")).toHaveTextContent("The notebook is full");
 expect(screen.getByRole("button",{name:"Export pending excerpts"})).toBeInTheDocument();
 expect(screen.getByRole("textbox",{name:"My understanding (optional) 1"})).toHaveValue("Keep this reflection");
 expect(saveClassroomNote).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("tab",{name:"Full chapter notebook"}));
 fireEvent.change(screen.getByLabelText("Classroom note editor"),{target:{value:"Shortened notes"}});
 fireEvent.click(screen.getByRole("tab",{name:"Excerpt and reflection (1)"}));
 fireEvent.click(screen.getByRole("button",{name:"Add excerpt and reflection to notes"}));
 await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
 expect(saveClassroomNote).toHaveBeenCalledOnce();expect(vi.mocked(saveClassroomNote).mock.calls[0][2]).toContain("Keep this reflection");
});
it("retains the full browser draft after a save failure and retries without duplicating the excerpt",async()=>{
 vi.mocked(saveClassroomNote).mockRejectedValueOnce(new Error("offline"));
 await setup();await captureCode();reflect("Complete groups only");
 fireEvent.click(screen.getByRole("button",{name:"Add excerpt and reflection to notes"}));
 await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
 expect(screen.getAllByRole("status").some(item=>item.textContent?.includes("Not saved yet"))).toBe(true);
 fireEvent.click(screen.getByRole("tab",{name:"Full chapter notebook"}));
 const editor=screen.getByLabelText("Classroom note editor") as HTMLTextAreaElement;
 const markdown=editor.value;expect(markdown.split("Complete groups only")).toHaveLength(2);
 expect(Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)!).some(key=>key.startsWith("opentutor:classroom-draft:")&&localStorage.getItem(key)?.includes("Complete groups only"))).toBe(true);
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Save now"}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
 expect(saveClassroomNote).toHaveBeenCalledTimes(2);expect(vi.mocked(saveClassroomNote).mock.calls[1][2]).toBe(markdown);
});
it("shows Chinese note controls",async()=>{
 setLocale("zh");await setup();fireEvent.click(screen.getByRole("button",{name:"摘录这段代码并批注"}));await act(async()=>{});
 expect(screen.getByRole("tab",{name:"摘录批注 (1)"})).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"记入本章笔记"})).toBeInTheDocument();
 expect(screen.getByRole("textbox",{name:"我的理解（选填） 1"})).toBeInTheDocument();
});

it("keeps an exportable recovery excerpt when both browser storage and saving fail",async()=>{
 await setup();await captureCode();reflect("Do not lose this explanation");
 const storage=vi.spyOn(localStorage,"setItem").mockImplementation(()=>{throw new Error("Storage full");});
 vi.mocked(saveClassroomNote).mockRejectedValueOnce(new Error("offline"));
 try{
  fireEvent.click(screen.getByRole("button",{name:"Add excerpt and reflection to notes"}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  expect(screen.getByRole("textbox",{name:"My understanding (optional) 1"})).toHaveValue("Do not lose this explanation");
  expect(screen.getByRole("button",{name:"Export pending excerpts"})).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Retry saving this excerpt"})).toBeDisabled();
  storage.mockRestore();
  fireEvent.click(screen.getByRole("button",{name:"Retry loading the notebook; keep my excerpt"}));await act(async()=>{});
  fireEvent.click(screen.getByRole("button",{name:"Retry saving this excerpt"}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  const markdown=vi.mocked(saveClassroomNote).mock.calls.at(-1)![2];
  expect(markdown.split("Do not lose this explanation")).toHaveLength(2);
 }finally{storage.mockRestore();}
});
