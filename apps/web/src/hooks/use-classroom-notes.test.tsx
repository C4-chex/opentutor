import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {useClassroomNotes} from "./use-classroom-notes";
import {loadClassroomNote,saveClassroomNote,type ClassroomNote} from "@/lib/api/classroom-notes";
vi.mock("@/lib/api/classroom-notes",()=>({loadClassroomNote:vi.fn(),saveClassroomNote:vi.fn()}));
const initial:ClassroomNote={node_id:"node",title:"Division",markdown:"",revision:0,updated_at:null};
function Harness(){const note=useClassroomNotes("course","node");return <>
 <textarea aria-label="note" value={note.text} onChange={event=>note.edit(event.target.value)}/><p data-testid="state">{note.status}</p>
 <button onClick={()=>void note.save()}>save</button><button onClick={()=>void note.loadRemote()}>latest</button><button onClick={note.mergeRemote}>merge</button>
 </>;}
async function mount(){const view=render(<Harness/>);await act(async()=>{});return view;}
async function tick(){await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});}
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();sessionStorage.clear();vi.mocked(loadClassroomNote).mockResolvedValue(initial);vi.mocked(saveClassroomNote).mockImplementation(async(_c,_n,markdown,revision)=>({...initial,markdown,revision:revision+1}));});
afterEach(()=>{cleanup();vi.useRealTimers();});

describe("local notebook autosave",()=>{
 it("saves the current text after typing, with its actual base version",async()=>{
  await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"My understanding"}});await tick();
  expect(saveClassroomNote).toHaveBeenCalledWith("course","node","My understanding",0,expect.any(String));
  expect(screen.getByTestId("state")).toHaveTextContent("saved");
 });
 it("keeps newer typing while a previous save is in flight, then uses the returned version",async()=>{
  let resolve!:(note:ClassroomNote)=>void;
  vi.mocked(saveClassroomNote).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"First"}});await tick();
  fireEvent.change(screen.getByLabelText("note"),{target:{value:"First plus newer text"}});
  await act(async()=>resolve({...initial,markdown:"First",revision:1}));
  expect(screen.getByLabelText("note")).toHaveValue("First plus newer text");await tick();
  expect(saveClassroomNote).toHaveBeenLastCalledWith("course","node","First plus newer text",1,expect.any(String));
 });
 it("retains text and a browser draft after save failure, and retries the same request safely",async()=>{
  vi.mocked(saveClassroomNote).mockRejectedValueOnce(new Error("offline"));
  await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"Keep offline work"}});await tick();
  expect(screen.getByLabelText("note")).toHaveValue("Keep offline work");expect(screen.getByTestId("state")).toHaveTextContent("error");
  const first=vi.mocked(saveClassroomNote).mock.calls[0];
  await act(async()=>{fireEvent.click(screen.getByText("save"));});
  expect(vi.mocked(saveClassroomNote).mock.calls[1]).toEqual(first);
 });
 it("preserves a conflicted draft across refreshes rather than blessing it as the latest version",async()=>{
  vi.mocked(loadClassroomNote).mockResolvedValue({...initial,markdown:"Base",revision:1});
  vi.mocked(saveClassroomNote).mockRejectedValue(Object.assign(new Error("conflict"),{status:409}));
  const view=await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"My local draft"}});await tick();
  expect(screen.getByTestId("state")).toHaveTextContent("conflict");view.unmount();
  vi.mocked(loadClassroomNote).mockResolvedValue({...initial,markdown:"Other page edited",revision:2});
  const second=await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"Still my draft"}});await tick();
  second.unmount();await mount();await tick();
  expect(screen.getByLabelText("note")).toHaveValue("Still my draft");expect(screen.getByTestId("state")).toHaveTextContent("conflict");
  expect(saveClassroomNote).toHaveBeenCalledTimes(1);
 });
 it("merges the remote text and local draft explicitly without silently discarding either",async()=>{
  vi.mocked(loadClassroomNote).mockResolvedValue({...initial,markdown:"Base",revision:1});
  vi.mocked(saveClassroomNote).mockRejectedValueOnce(Object.assign(new Error("conflict"),{status:409}));
  await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"Local additions"}});await tick();
  vi.mocked(loadClassroomNote).mockResolvedValue({...initial,markdown:"Remote additions",revision:2});
  await act(async()=>{fireEvent.click(screen.getByText("latest"));});fireEvent.click(screen.getByText("merge"));await tick();
  const saved=vi.mocked(saveClassroomNote).mock.calls.at(-1)!;
  expect(saved[2]).toContain("Remote additions");expect(saved[2]).toContain("Local additions");expect(saved[3]).toBe(2);
 });
 it("does not erase a newer browser draft when an old unmounted save finishes",async()=>{
  let resolve!:(note:ClassroomNote)=>void;
  vi.mocked(saveClassroomNote).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const first=await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"Old request"}});await tick();first.unmount();
  await mount();fireEvent.change(screen.getByLabelText("note"),{target:{value:"New work after reopening"}});
  await act(async()=>resolve({...initial,markdown:"Old request",revision:1}));
  expect(screen.getByLabelText("note")).toHaveValue("New work after reopening");
  const keys=Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)!).filter(key=>key.startsWith("opentutor:classroom-draft:"));
  expect(keys.some(key=>JSON.parse(localStorage.getItem(key)!).markdown==="New work after reopening")).toBe(true);
 });

});
