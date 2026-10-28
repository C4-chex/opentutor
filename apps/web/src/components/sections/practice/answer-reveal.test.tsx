import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnswerReveal } from "./answer-reveal";
import { revealProblemAnswer, type RevealedAnswer } from "@/lib/api/practice";
import { ErrorAnalysis } from "@/app/course/[id]/unit/[nodeId]/_components/error-analysis";
import { WrongAnswerCard } from "./wrong-answer-card";
import type { WrongAnswer } from "@/lib/api";
import { setLocale } from "@/lib/i18n";
vi.mock("@/lib/api/practice",()=>({revealProblemAnswer:vi.fn()}));
vi.mock("@/components/shared/markdown-renderer",()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
const answer:RevealedAnswer={problem_id:"problem",answer_viewed:true,viewed_at:"2026-10-24T00:00:00Z",correct_answer:"REFERENCE_ANSWER",explanation:"REFERENCE_SOLUTION"};
const item:WrongAnswer={id:"wrong",problem_id:"problem",question:"QUESTION",question_type:"mc",options:{A:"option one",B:"option two"},user_answer:"B",correct_answer:"LEGACY_ANSWER",explanation:"LEGACY_SOLUTION",diagnosis:"LEGACY_DIAGNOSIS_SOLUTION",error_category:null,error_detail:null,knowledge_points:[],review_count:0,mastered:false};
beforeEach(()=>{vi.resetAllMocks();setLocale("zh");vi.mocked(revealProblemAnswer).mockResolvedValue(answer);});
afterEach(cleanup);
it("does not render or request a reference before an explicit click",()=>{
  render(<AnswerReveal problemId="problem"/>);
  expect(screen.queryByText("REFERENCE_ANSWER")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("参考答案与解析")).not.toBeInTheDocument();
  expect(revealProblemAnswer).not.toHaveBeenCalled();
  expect(screen.getByText(/本题后续作答按辅助练习/)).toBeInTheDocument();
});
it("waits for a saved record before revealing, and permits hiding it again",async()=>{
  let done!:(value:RevealedAnswer)=>void;
  vi.mocked(revealProblemAnswer).mockReturnValueOnce(new Promise(resolve=>{done=resolve;}));
  render(<AnswerReveal problemId="problem"/>);
  fireEvent.click(screen.getByRole("button",{name:"查看参考答案与解析"}));
  expect(screen.queryByText("REFERENCE_SOLUTION")).not.toBeInTheDocument();
  expect(screen.queryByText("看过解析 · 辅助学习")).not.toBeInTheDocument();
  await act(async()=>done(answer));
  expect(screen.getByText("REFERENCE_SOLUTION")).toBeVisible();
  expect(screen.getByText("看过解析 · 辅助学习")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"收起参考答案与解析"}));
  expect(screen.queryByText("REFERENCE_SOLUTION")).not.toBeInTheDocument();
  expect(screen.getByText("看过解析 · 辅助学习")).toBeInTheDocument();
});
it("keeps the solution hidden if the local record could not be saved and supports retry",async()=>{
  vi.mocked(revealProblemAnswer).mockRejectedValueOnce(new Error("查看记录未保存"));
  render(<AnswerReveal problemId="problem"/>);
  fireEvent.click(screen.getByRole("button",{name:"查看参考答案与解析"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("查看记录未保存");
  expect(screen.queryByText("REFERENCE_ANSWER")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"查看参考答案与解析"}));
  expect(await screen.findByText("REFERENCE_ANSWER")).toBeVisible();
});
it("restores the viewed flag without automatically revealing the answer again",()=>{
  render(<AnswerReveal problemId="problem" answerViewed/>);
  expect(screen.getByText("看过解析 · 辅助学习")).toBeVisible();
  expect(screen.queryByText("REFERENCE_ANSWER")).not.toBeInTheDocument();
  expect(revealProblemAnswer).not.toHaveBeenCalled();
});
it("updates another instance on the same page without opening its solution",async()=>{
  render(<><div data-testid="one"><AnswerReveal problemId="problem"/></div><div data-testid="two"><AnswerReveal problemId="problem"/></div></>);
  fireEvent.click(within(screen.getByTestId("one")).getByRole("button"));
  await screen.findByText("REFERENCE_ANSWER");
  expect(within(screen.getByTestId("two")).getByText("看过解析 · 辅助学习")).toBeVisible();
  expect(within(screen.getByTestId("two")).queryByText("REFERENCE_ANSWER")).not.toBeInTheDocument();
});
it("does not insert an old reference into a different question after navigation",async()=>{
  let done!:(value:RevealedAnswer)=>void;
  vi.mocked(revealProblemAnswer).mockReturnValueOnce(new Promise(resolve=>{done=resolve;}));
  const view=render(<AnswerReveal problemId="problem"/>);
  fireEvent.click(screen.getByRole("button"));
  view.rerender(<AnswerReveal problemId="other"/>);
  await act(async()=>done(answer));
  expect(screen.queryByText("REFERENCE_ANSWER")).not.toBeInTheDocument();
  expect(screen.queryByText("看过解析 · 辅助学习")).not.toBeInTheDocument();
});
it("keeps legacy answers, explanations and diagnostic solution text off the learning page",()=>{
  render(<ErrorAnalysis items={[item]} t={key=>key}/>);
  expect(screen.getByText("QUESTION")).toBeInTheDocument();
  expect(document.body.textContent).not.toContain("LEGACY_ANSWER");
  expect(screen.queryByText("LEGACY_SOLUTION")).not.toBeInTheDocument();
  expect(screen.queryByText("LEGACY_DIAGNOSIS_SOLUTION")).not.toBeInTheDocument();
  expect(revealProblemAnswer).not.toHaveBeenCalled();
});
it("replaces the old auto-filled mastery shortcut with a real retry link",()=>{
  render(<WrongAnswerCard item={{...item,diagnosis:null}} index={0} derivingId={null} aiActionsEnabled retryHref="/course/course/wrong-answers#wrong-answer-wrong" onDerive={vi.fn()} onDiagnosticAnswer={vi.fn()}/>);
  expect(screen.getByRole("link",{name:"重新作答"})).toHaveAttribute("href","/course/course/wrong-answers#wrong-answer-wrong");
  expect(screen.queryByRole("button",{name:"Mark as mastered"})).not.toBeInTheDocument();
});
