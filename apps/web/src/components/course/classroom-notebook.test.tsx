import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {ClassroomNotebook,useClassroomNotebook} from "./classroom-notebook";
import {loadClassroomNote,saveClassroomNote,outlineClassroomNote} from "@/lib/api/classroom-notes";
import {setLocale} from "@/lib/i18n";
vi.mock("@/lib/api/classroom-notes",()=>({loadClassroomNote:vi.fn(),saveClassroomNote:vi.fn(),outlineClassroomNote:vi.fn()}));
vi.mock("@/components/shared/markdown-renderer",()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
const doc={node_id:"node",title:"Basics",markdown:"My own notes",revision:1,updated_at:null};
function Lesson(){const book=useClassroomNotebook();return <button onClick={()=>book?.capture('## AI lecture excerpt\n\n```c\nint x=1;\n```\n\n$$x=1$$')}>capture</button>;}
async function setup(){render(<ClassroomNotebook courseId="course" nodeId="node" title="Basics"><Lesson/></ClassroomNotebook>);await act(async()=>{});}
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();sessionStorage.clear();setLocale("en");vi.mocked(loadClassroomNote).mockResolvedValue(doc);vi.mocked(saveClassroomNote).mockImplementation(async(_c,_n,markdown,revision)=>({...doc,markdown,revision:revision+1}));vi.mocked(outlineClassroomNote).mockResolvedValue({markdown:"AI proposed summary",ai_generated:true,lesson_revision:3,limited_scope:false});});
afterEach(()=>{cleanup();vi.useRealTimers();});

describe("classroom note workflow",()=>{
 it("captures lecture code and formulas alongside personal notes and opens the panel",async()=>{
  await setup();fireEvent.click(screen.getByText("capture"));await act(async()=>{});
  const editor=screen.getByLabelText("Classroom note editor");expect((editor as HTMLTextAreaElement).value).toContain("My own notes");
  expect((editor as HTMLTextAreaElement).value).toContain('```c\nint x=1;\n```');
  expect((editor as HTMLTextAreaElement).value).toContain('$$x=1$$');
  expect(outlineClassroomNote).not.toHaveBeenCalled();
 });
 it("shows an AI preview first and only appends it after explicit acceptance",async()=>{
  await setup();fireEvent.click(screen.getAllByRole("button",{name:"Classroom notes"})[0]);
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"AI: organize this lesson"}));});
  expect(screen.getByLabelText("Classroom note editor")).toHaveValue("My own notes");
  expect(screen.getByText("AI proposed summary")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Add outline to my notes"}));
  expect((screen.getByLabelText("Classroom note editor") as HTMLTextAreaElement).value).toContain("My own notes");
  expect((screen.getByLabelText("Classroom note editor") as HTMLTextAreaElement).value).toContain("AI-organized notes — review needed");
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});expect(saveClassroomNote).toHaveBeenCalledTimes(1);
 });
 it("discarding an AI preview leaves the notebook unchanged",async()=>{
  await setup();fireEvent.click(screen.getAllByRole("button",{name:"Classroom notes"})[0]);
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"AI: organize this lesson"}));});
  fireEvent.click(screen.getByRole("button",{name:"Discard preview"}));
  expect(screen.getByLabelText("Classroom note editor")).toHaveValue("My own notes");expect(saveClassroomNote).not.toHaveBeenCalled();
 });
 it("keeps the notebook editable after a failed organizer call",async()=>{
  vi.mocked(outlineClassroomNote).mockRejectedValueOnce(new Error("model unavailable"));
  await setup();fireEvent.click(screen.getAllByRole("button",{name:"Classroom notes"})[0]);
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"AI: organize this lesson"}));});
  expect(screen.getByText("model unavailable")).toBeInTheDocument();expect(screen.getByLabelText("Classroom note editor")).toHaveValue("My own notes");
 });
 it("uses Chinese controls and does not call AI when the notebook is opened",async()=>{
  setLocale("zh");await setup();fireEvent.click(screen.getAllByRole("button",{name:"随堂笔记"})[0]);
  expect(screen.getByRole("button",{name:"AI 整理本节要点"})).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"导出 Markdown"})).toBeInTheDocument();expect(outlineClassroomNote).not.toHaveBeenCalled();
 });
});

it("explicitly removes legacy return links while preserving existing writing",async()=>{
 vi.mocked(loadClassroomNote).mockResolvedValue({...doc,markdown:"My own notes\n\n> [Back to lesson](/course/course/unit/node)\n\nAn explanation"});
 await setup();fireEvent.click(screen.getAllByRole("button",{name:"Classroom notes"})[0]);
 fireEvent.click(screen.getByRole("button",{name:"Remove old classroom return links"}));
 const editor=screen.getByLabelText("Classroom note editor") as HTMLTextAreaElement;
 expect(editor.value).toContain("My own notes");expect(editor.value).toContain("An explanation");expect(editor.value).not.toContain("Back to lesson");
 await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});expect(saveClassroomNote).toHaveBeenCalledTimes(1);
});

it("keeps oversized captures pending and retries them after space is available",async()=>{
 vi.mocked(loadClassroomNote).mockResolvedValue({...doc,markdown:"x".repeat(59995)});
 await setup();fireEvent.click(screen.getByText("capture"));await act(async()=>{});
 expect(screen.getByRole("button",{name:"Export pending excerpts"})).toBeInTheDocument();
 expect((screen.getByLabelText("Classroom note editor") as HTMLTextAreaElement).value).toHaveLength(59995);
 expect(saveClassroomNote).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText("Classroom note editor"),{target:{value:"Shortened personal notes"}});await act(async()=>{});
 const value=(screen.getByLabelText("Classroom note editor") as HTMLTextAreaElement).value;
 expect(value).toContain("Shortened personal notes");expect(value).toContain('```c\nint x=1;\n```');
 expect(value.split("## AI lecture excerpt")).toHaveLength(2);
 expect(screen.queryByRole("button",{name:"Export pending excerpts"})).not.toBeInTheDocument();
 await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});expect(saveClassroomNote).toHaveBeenCalledOnce();
});
