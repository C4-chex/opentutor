import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LearningDetails } from "./learning-details";
import { PracticePanel } from "./practice-panel";
import { revealProblemAnswer } from "@/lib/api/practice";
import { setLocale } from "@/lib/i18n";
import type { ContentNode, WrongAnswer } from "@/lib/api";

const mocks=vi.hoisted(()=>({practiceRender:vi.fn()}));
vi.mock("@/lib/i18n-context",()=>({useT:()=>((key:string)=>key),useTF:()=>((key:string)=>key)}));
vi.mock("@/lib/api/practice",()=>({revealProblemAnswer:vi.fn()}));
vi.mock("@/components/shared/markdown-renderer",()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
vi.mock("@/components/sections/practice-section",()=>({PracticeSection:()=>{
  mocks.practiceRender();return <input aria-label="额外练习草稿" defaultValue=""/>;
}}));
const node:ContentNode={id:"node",title:"Chapter",content:"SOURCE",level:1,order_index:0,source_type:"url",children:[]};
const wrong:WrongAnswer={id:"wrong",problem_id:"problem",question:"PREVIOUS_WRONG_QUESTION",question_type:"mc",options:{A:"one",B:"two"},user_answer:"A",correct_answer:"STALE_REFERENCE_ANSWER",explanation:"STALE_REFERENCE_SOLUTION",diagnosis:null,error_category:null,error_detail:null,knowledge_points:[],review_count:0,mastered:false};
const props={courseId:"course",node,nodePath:[node],parentNode:null,siblingNodes:[],focusTerms:["FOCUS_SIGNAL"],wrongAnswers:[wrong],reviewItems:[],loadingSignals:false,urgentReviews:0};
beforeEach(()=>{vi.clearAllMocks();setLocale("zh");});
afterEach(cleanup);

it("keeps secondary stats, signals and historical errors out of the initial reading view",()=>{
  render(<LearningDetails {...props}/>);
  expect(screen.getByRole("button",{name:"展开 学习详情"})).toHaveAttribute("aria-expanded","false");
  expect(screen.queryByText("FOCUS_SIGNAL")).not.toBeInTheDocument();
  expect(screen.queryByText("unit.masteryTimeline")).not.toBeInTheDocument();
  expect(screen.queryByText("PREVIOUS_WRONG_QUESTION")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"展开 学习详情"}));
  expect(screen.getByText("FOCUS_SIGNAL")).toBeVisible();
  expect(screen.getByText("unit.masteryTimeline")).toBeVisible();
  expect(screen.getByText("PREVIOUS_WRONG_QUESTION")).toBeVisible();
  expect(screen.queryByText("STALE_REFERENCE_ANSWER")).not.toBeInTheDocument();
  expect(revealProblemAnswer).not.toHaveBeenCalled();
});

it("preserves the explicit-reference assistance label while closing and reopening details",async()=>{
  vi.mocked(revealProblemAnswer).mockResolvedValue({problem_id:"problem",answer_viewed:true,viewed_at:"2026-10-24T00:00:00Z",correct_answer:"REFERENCE",explanation:"SOLUTION"});
  render(<LearningDetails {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"展开 学习详情"}));
  fireEvent.click(screen.getByRole("button",{name:"查看参考答案与解析"}));
  await screen.findByText("看过解析 · 辅助学习");
  fireEvent.click(screen.getByRole("button",{name:"收起 学习详情"}));
  expect(screen.getByText("看过解析 · 辅助学习")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"展开 学习详情"}));
  expect(screen.getByText("看过解析 · 辅助学习")).toBeVisible();
  expect(revealProblemAnswer).toHaveBeenCalledTimes(1);
});

it("loads supplementary exercises only on demand and preserves an unfinished answer when folded",async()=>{
  const generate=vi.fn();
  render(<PracticePanel courseId="course" difficultyLevel="easy" aiActionsEnabled generatingFocusedQuiz={false} onGenerateFocusedQuiz={generate} t={key=>key} tf={key=>key}/>);
  expect(screen.getByRole("button",{name:"展开 补充练习"})).toHaveAttribute("aria-expanded","false");
  expect(mocks.practiceRender).not.toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"展开 补充练习"}));
  const draft=await screen.findByRole("textbox",{name:"额外练习草稿"});
  fireEvent.change(draft,{target:{value:"my unfinished solution"}});
  fireEvent.click(screen.getByRole("button",{name:"收起 补充练习"}));
  expect(draft).not.toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"展开 补充练习"}));
  expect(screen.getByRole("textbox",{name:"额外练习草稿"})).toHaveValue("my unfinished solution");
  fireEvent.click(screen.getByRole("button",{name:"unit.generateFocusedQuizWithDifficulty"}));
  expect(generate).toHaveBeenCalledTimes(1);
});

it("starts with details closed again when navigating to a new chapter",()=>{
  const view=render(<LearningDetails key="node" {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"展开 学习详情"}));
  view.rerender(<LearningDetails key="other" {...props} node={{...node,id:"other"}}/>);
  expect(screen.getByRole("button",{name:"展开 学习详情"})).toHaveAttribute("aria-expanded","false");
  expect(screen.queryByText("PREVIOUS_WRONG_QUESTION")).not.toBeInTheDocument();
});
