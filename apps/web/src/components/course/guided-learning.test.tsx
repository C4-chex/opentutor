import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GuidedLearning } from "./guided-learning";
import { loadGuidedLesson, actOnGuidedLesson, type GuidedLesson } from "@/lib/api/guided-learning";
import { setLocale } from "@/lib/i18n";

vi.mock("@/lib/api/guided-learning",()=>({loadGuidedLesson:vi.fn(),actOnGuidedLesson:vi.fn()}));
vi.mock("@/components/shared/markdown-renderer",()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
const lesson:GuidedLesson={session_id:"session",course_id:"course",node_id:"node",title:"Seconds lab",revision:1,
 stage:"diagnose",hint_level:0,goals:["Explain integer division"],evidence:[],gaps:[],limited_scope:false,
 sources:[{node_id:"readme",title:"README.md",url:"https://github.com/example/lab/blob/commit/README.md"}],
 turns:[{role:"tutor",stage:"diagnose",text:"First, think about groups of seconds.",question:"How would you find the number of full hours?"}]};
beforeEach(()=>{vi.clearAllMocks();setLocale("en");vi.mocked(loadGuidedLesson).mockResolvedValue({lesson:null,source_changed:false});vi.mocked(actOnGuidedLesson).mockResolvedValue(lesson);});
afterEach(()=>{cleanup();localStorage.clear();});
async function start(){render(<GuidedLearning courseId="course" nodeId="node"/>);fireEvent.click(await screen.findByRole("button",{name:"Start guided learning"}));await screen.findByText(lesson.turns[0].question!);}

describe("guided teaching interaction",()=>{
 it("shows an explicit start entry and starts with one grounded question",async()=>{
  await start();expect(actOnGuidedLesson).toHaveBeenCalledWith("course","node","start","",0,expect.any(String));
  expect(screen.queryByRole("link",{name:"README.md"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"View source material (1)"}));
  expect(screen.getByRole("link",{name:"README.md"})).toHaveAttribute("href",lesson.sources[0].url);
  fireEvent.click(screen.getByRole("button",{name:"Close"}));
  expect(screen.getByLabelText("Your explanation or attempt")).toHaveValue("");
 });
 it("restores persisted teaching without automatically calling the model",async()=>{
  vi.mocked(loadGuidedLesson).mockResolvedValue({lesson:{...lesson,stage:"feynman"},source_changed:false});
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  await screen.findByText("Your turn to teach the beginner");expect(actOnGuidedLesson).not.toHaveBeenCalled();
 });
 it("preserves the learner's draft after an API failure",async()=>{
  await start();vi.mocked(actOnGuidedLesson).mockRejectedValueOnce(new Error("network failure"));
  fireEvent.change(screen.getByLabelText("Your explanation or attempt"),{target:{value:"My reasoning, not just a final number"}});
  fireEvent.click(screen.getByRole("button",{name:"Submit and continue"}));
  await screen.findByText("network failure");expect(screen.getByLabelText("Your explanation or attempt")).toHaveValue("My reasoning, not just a final number");
 });
 it("sends help separately from a learner answer and does not fabricate performance",async()=>{
  await start();vi.mocked(actOnGuidedLesson).mockResolvedValue({...lesson,revision:2,hint_level:1});
  fireEvent.click(screen.getByRole("button",{name:"Give me a hint (0/4)"}));
  await waitFor(()=>expect(actOnGuidedLesson).toHaveBeenLastCalledWith("course","node","hint","",1,expect.any(String)));
  expect(screen.queryByText("Session verified")).not.toBeInTheDocument();
 });
 it("submits the actual answer and advances only to the returned server stage",async()=>{
  await start();vi.mocked(actOnGuidedLesson).mockResolvedValue({...lesson,revision:2,stage:"socratic"});
  fireEvent.change(screen.getByLabelText("Your explanation or attempt"),{target:{value:"There are 3600 seconds in each full hour"}});
  fireEvent.click(screen.getByRole("button",{name:"Submit and continue"}));
  await waitFor(()=>expect(screen.getByLabelText("Your explanation or attempt")).toHaveValue(""));
  expect(actOnGuidedLesson).toHaveBeenLastCalledWith("course","node","answer","There are 3600 seconds in each full hour",1,expect.any(String));
  expect(screen.queryByText("This session is verified, long-term retention is not yet assessed.")).not.toBeInTheDocument();
 });
});


describe("local learning recovery",()=>{
 it("restores the exact draft after the learning component is reopened",async()=>{
  await start();const input=screen.getByLabelText("Your explanation or attempt");
  fireEvent.change(input,{target:{value:"int seconds = 3661; // 我的推理"}});
  cleanup();vi.mocked(loadGuidedLesson).mockResolvedValue({lesson,source_changed:false});
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  await screen.findByText(lesson.turns[0].question!);
  expect(screen.getByLabelText("Your explanation or attempt")).toHaveValue("int seconds = 3661; // 我的推理");
 });
 it("removes the submitted draft only after a successful saved response",async()=>{
  await start();fireEvent.change(screen.getByLabelText("Your explanation or attempt"),{target:{value:"3600秒组成完整小时"}});
  expect(localStorage.getItem("opentutor:guided-draft:course:node")).toBe("3600秒组成完整小时");
  fireEvent.click(screen.getByRole("button",{name:"Submit and continue"}));
  await waitFor(()=>expect(localStorage.getItem("opentutor:guided-draft:course:node")).toBeNull());
 });
 it("uses explicit undo without pretending a new answer was given",async()=>{
  vi.mocked(loadGuidedLesson).mockResolvedValue({lesson:{...lesson,revision:2,can_undo:true,
   turns:[...lesson.turns,{role:"learner",stage:"diagnose",text:"我的实际作答"},{role:"tutor",stage:"socratic",text:"有争议的反馈",question:"新问题？"}]},source_changed:false});
  vi.spyOn(window,"confirm").mockReturnValueOnce(true);
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  fireEvent.click(await screen.findByRole("button",{name:"撤回上一轮"}));
  await waitFor(()=>expect(actOnGuidedLesson).toHaveBeenCalledWith("course","node","undo","",2,expect.any(String)));
  expect(screen.getByLabelText("Your explanation or attempt")).toHaveValue("我的实际作答");
  vi.restoreAllMocks();
 });
});


describe("teach foundations before questions",()=>{
 const foundations:GuidedLesson={...lesson,stage:"learn",turns:[{role:"tutor",stage:"learn",text:"Learn full groups and remainders first.",question:"",concepts:[{
  title:"Integer division",explanation:"Count full groups; the remainder is what is left.",
  worked_example:"125 seconds is two full minutes and five seconds.",common_mistake:"Total seconds are not the minute component.",is_supplement:true,
 }]}]};
 it("starts with readable concepts and a worked example, without a quiz or answer box",async()=>{
  vi.mocked(actOnGuidedLesson).mockResolvedValueOnce(foundations);
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  fireEvent.click(await screen.findByRole("button",{name:"Start guided learning"}));
  expect(await screen.findByText("125 seconds is two full minutes and five seconds.")).toBeInTheDocument();
  expect(screen.getByText("Worked example")).toBeInTheDocument();
  expect(screen.getByText("Common pitfall")).toBeInTheDocument();
  expect(screen.getByText("AI supplement: prerequisite knowledge not covered by the source.")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByText("Think about this one question")).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Ready for a short understanding check"})).toBeInTheDocument();
 });
 it("begins a check only after the learner clicks continue, preserving any saved draft",async()=>{
  localStorage.setItem("opentutor:guided-draft:course:node","unfinished reasoning");
  vi.mocked(loadGuidedLesson).mockResolvedValueOnce({lesson:foundations,source_changed:false});
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  fireEvent.click(await screen.findByRole("button",{name:"Ready for a short understanding check"}));
  await screen.findByLabelText("Your explanation or attempt");
  expect(actOnGuidedLesson).toHaveBeenCalledWith("course","node","continue","",1,expect.any(String));
  expect(screen.getByLabelText("Your explanation or attempt")).toHaveValue("unfinished reasoning");
 });
 it("keeps the explanation available and retryable when preparing a check fails",async()=>{
  vi.mocked(loadGuidedLesson).mockResolvedValueOnce({lesson:foundations,source_changed:false});
  vi.mocked(actOnGuidedLesson).mockRejectedValueOnce(new Error("provider unavailable"));
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  fireEvent.click(await screen.findByRole("button",{name:"Ready for a short understanding check"}));
  await screen.findByText("provider unavailable");
  expect(screen.getByText("125 seconds is two full minutes and five seconds.")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
 });
 it("allows an existing question to open foundations and return without submitting the draft",async()=>{
  vi.mocked(loadGuidedLesson).mockResolvedValueOnce({lesson,source_changed:false});
  vi.mocked(actOnGuidedLesson).mockResolvedValueOnce({...foundations,revision:2,is_foundation_review:true});
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  fireEvent.change(await screen.findByLabelText("Your explanation or attempt"),{target:{value:"my current attempt"}});
  fireEvent.click(screen.getByRole("button",{name:"Teach me the basics first"}));
  const back=await screen.findByRole("button",{name:"Return to my current question"});
  expect(actOnGuidedLesson).toHaveBeenLastCalledWith("course","node","review_basics","",1,expect.any(String));
  fireEvent.click(back);
  expect(await screen.findByLabelText("Your explanation or attempt")).toHaveValue("my current attempt");
 });
 it("restores saved foundation content without a model request and includes it in history",async()=>{
  vi.mocked(loadGuidedLesson).mockResolvedValueOnce({lesson:foundations,source_changed:false});
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  await screen.findByText("125 seconds is two full minutes and five seconds.");
  expect(actOnGuidedLesson).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"View saved learning dialogue"}));
  expect(screen.getAllByText("125 seconds is two full minutes and five seconds.")).toHaveLength(2);
 });
 it("shows all new controls in Chinese",async()=>{
  setLocale("zh");
  vi.mocked(loadGuidedLesson).mockResolvedValueOnce({lesson:foundations,source_changed:false});
  render(<GuidedLearning courseId="course" nodeId="node"/>);
  expect(await screen.findByRole("button",{name:"看完了，做个理解检查"})).toBeInTheDocument();
  expect(screen.getByText("完整示例")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"换个更易懂的方式讲"})).toBeInTheDocument();
 });
});

it("notifies the section summary after a transfer check completes",async()=>{
  const changed=vi.fn();
  vi.mocked(loadGuidedLesson).mockResolvedValueOnce({lesson:{...lesson,stage:"transfer"},source_changed:false});
  vi.mocked(actOnGuidedLesson).mockResolvedValueOnce({...lesson,stage:"complete",revision:2});
  render(<GuidedLearning courseId="course" nodeId="node" onProgressChange={changed}/>);
  fireEvent.change(await screen.findByLabelText("Your explanation or attempt"),{target:{value:"independent solution"}});
  fireEvent.click(screen.getByRole("button",{name:"Submit and continue"}));
  await waitFor(()=>expect(changed).toHaveBeenLastCalledWith({sessionId:"session",revision:2,stage:"complete"}));
});
