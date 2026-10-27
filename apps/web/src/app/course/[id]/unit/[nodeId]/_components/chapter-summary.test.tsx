import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChapterSummary } from "./chapter-summary";
import { getChapterSummaryStatus } from "@/lib/api/guided-learning";
import { extractQuiz, getReviewSession, listWrongAnswers } from "@/lib/api";

vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("@/lib/i18n-context",()=>({useT:()=>((key:string)=>key),useTF:()=>((key:string)=>key)}));
vi.mock("@/lib/api/guided-learning",()=>({getChapterSummaryStatus:vi.fn()}));
vi.mock("@/lib/api",()=>({extractQuiz:vi.fn(),getReviewSession:vi.fn(),listWrongAnswers:vi.fn()}));
vi.mock("@/store/course",()=>({useCourseStore:(selector:(state:unknown)=>unknown)=>selector({contentTree:[{id:"chapter",title:"Integer division",content:"text",children:[]}]})}));
const status={node_id:"chapter",title:"Time conversion",ready:false,verified_sources:0,total_sources:2};
const props={courseId:"course",nodeId:"leaf",progressKey:"learn",aiActionsEnabled:true};
beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(getChapterSummaryStatus).mockResolvedValue(status);
  vi.mocked(listWrongAnswers).mockResolvedValue([]);
  vi.mocked(getReviewSession).mockResolvedValue({course_id:"course",items:[],count:0});
  vi.mocked(extractQuiz).mockResolvedValue({problems_created:2,discarded_count:0,warnings:[]} as never);
});
afterEach(cleanup);

it("keeps both analytics cards off the learning page until the whole section is verified",async()=>{
  render(<ChapterSummary {...props}/>);
  await waitFor(()=>expect(getChapterSummaryStatus).toHaveBeenCalledWith("course","leaf"));
  expect(screen.queryByTestId("chapter-summary")).not.toBeInTheDocument();
  expect(listWrongAnswers).not.toHaveBeenCalled();
  expect(getReviewSession).not.toHaveBeenCalled();
});
it("shows the end-of-section summary and generates practice for the whole section",async()=>{
  vi.mocked(getChapterSummaryStatus).mockResolvedValue({...status,ready:true,verified_sources:2});
  render(<ChapterSummary {...props} progressKey="complete"/>);
  expect(await screen.findByText("unit.errorPattern.title")).toBeInTheDocument();
  expect(screen.getByText("unit.nextActions.title")).toBeInTheDocument();
  expect(screen.getByText(/暂无本节的长期掌握度/)).toBeInTheDocument();
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"unit.generateFocusedQuizWithDifficulty"}));
  await waitFor(()=>expect(extractQuiz).toHaveBeenCalledWith("course","chapter",expect.any(String),"easy"));
});
it("removes the previous summary immediately after restarting or undoing progress",async()=>{
  vi.mocked(getChapterSummaryStatus).mockResolvedValueOnce({...status,ready:true});
  const view=render(<ChapterSummary {...props} progressKey="complete"/>);
  await screen.findByText("unit.errorPattern.title");
  view.rerender(<ChapterSummary {...props} progressKey="restart"/>);
  expect(screen.queryByTestId("chapter-summary")).not.toBeInTheDocument();
  await waitFor(()=>expect(getChapterSummaryStatus).toHaveBeenCalledTimes(2));
});
it("ignores an old response after switching chapters",async()=>{
  let resolve!:(value:typeof status)=>void;
  vi.mocked(getChapterSummaryStatus).mockReturnValueOnce(new Promise(done=>{resolve=done;}));
  const view=render(<ChapterSummary {...props}/>);
  view.rerender(<ChapterSummary {...props} nodeId="other"/>);
  await act(async()=>resolve({...status,ready:true}));
  expect(screen.queryByTestId("chapter-summary")).not.toBeInTheDocument();
  expect(listWrongAnswers).not.toHaveBeenCalled();
});
it("keeps a summary failure retryable without blocking teaching",async()=>{
  vi.mocked(getChapterSummaryStatus).mockRejectedValueOnce(new Error("offline"));
  render(<ChapterSummary {...props}/>);
  fireEvent.click(await screen.findByRole("button",{name:"重试"}));
  await waitFor(()=>expect(getChapterSummaryStatus).toHaveBeenCalledTimes(2));
  expect(screen.queryByTestId("chapter-summary")).not.toBeInTheDocument();
});
