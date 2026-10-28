import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuizView } from "./quiz-view";
import { toast } from "sonner";

vi.mock("@/lib/api", async () => {
  const problems = [
    {
      id: "p1",
      question: "What color is the sky?",
      options: { a: "Red", b: "Blue", c: "Green" },
      difficulty_layer: 1,
      problem_metadata: { core_concept: "Atmosphere" },
    },
    {
      id: "p2",
      question: "2 + 2 = ?",
      options: { a: "3", b: "4", c: "5" },
      difficulty_layer: 1,
      problem_metadata: {},
    },
  ];
  return {
    listProblems: vi.fn().mockResolvedValue(problems),
    getQuizAttempts: vi.fn().mockResolvedValue([]),
    reviewQuizAnswer: vi.fn(),
    extractQuiz: vi.fn().mockResolvedValue({ problems_created: 5 }),
    submitAnswer: vi.fn().mockResolvedValue({
      is_correct: true,
      correct_answer: "b",
      explanation: "Blue is correct.",
      prerequisite_gaps: [],
    }),
  };
});

vi.mock("@/lib/i18n-context", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
  },
}));

vi.mock("@/store/workspace", () => ({
  useWorkspaceStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ sectionRefreshKey: { practice: 0 }, spaceLayout: { mode: "self_paced", blocks: [] } }),
    {
      getState: () => ({
        sectionRefreshKey: { practice: 0 },
        spaceLayout: { mode: "self_paced", blocks: [] },
        addBlock: vi.fn(),
        reorderBlocks: vi.fn(),
      }),
    },
  ),
}));

vi.mock("@/lib/block-system/feature-unlock", () => ({
  updateUnlockContext: vi.fn(),
  getUnlockContext: () => ({ practiceAttempts: 0, hasWrongAnswer: false }),
}));

vi.mock("@/components/shared/ai-feature-blocked", () => ({
  AiFeatureBlocked: () => <div data-testid="ai-blocked" />,
}));

vi.mock("./use-quiz-persistence", () => {
  const persistence = {save: vi.fn(), load: vi.fn().mockReturnValue(null), clear: vi.fn()};
  return {useQuizPersistence: () => persistence};
});

describe("QuizView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    render(<QuizView courseId="test" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("renders quiz question after loading", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => {
      expect(screen.getByText("What color is the sky?")).toBeInTheDocument();
    });
  });

  it("has role=form with aria-label", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));
    expect(screen.getByRole("form", { name: "quiz.ariaLabel" })).toBeInTheDocument();
  });

  it("has role=radiogroup for answer options", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));
    expect(screen.getByRole("radiogroup", { name: "quiz.answerOptions" })).toBeInTheDocument();
  });

  it("renders answer options as radio buttons", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("selects option and submits answer on click", async () => {
    const { submitAnswer } = await import("@/lib/api");
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));

    const optionB = screen.getByTestId("quiz-option-b");
    fireEvent.click(optionB);

    await waitFor(() => {
      expect(submitAnswer).toHaveBeenCalledWith("p1", "b", expect.any(Number), expect.objectContaining({requestId:expect.any(String)}));
    });
  });

  it("shows explanation after answering", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));

    fireEvent.click(screen.getByTestId("quiz-option-b"));

    await waitFor(() => {
      expect(screen.getByText(/Blue is correct/)).toBeInTheDocument();
    });
  });

  it("shows fallback feedback when explanation details are missing", async () => {
    const { submitAnswer } = await import("@/lib/api");
    vi.mocked(submitAnswer).mockResolvedValueOnce({
      is_correct: false,
      correct_answer: null,
      explanation: null,
      prerequisite_gaps: [],
    });

    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));

    fireEvent.click(screen.getByTestId("quiz-option-b"));

    await waitFor(() => {
      expect(screen.getByText("grading.incorrect")).toBeInTheDocument();
      expect(screen.getByText("grading.tryAgainHint")).toBeInTheDocument();
    });
    expect(toast.warning).toHaveBeenCalledWith("quiz.feedbackWarning");
  });

  it("navigates to next question", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));

    const nextBtn = screen.getByText("quiz.next");
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("2 + 2 = ?")).toBeInTheDocument();
    });
  });

  it("disables previous button on first question", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));
    expect(screen.getByText("quiz.prev")).toBeDisabled();
  });

  it("shows core concept badge", async () => {
    render(<QuizView courseId="test" />);
    await waitFor(() => screen.getByText("What color is the sky?"));
    expect(screen.getByText("Atmosphere")).toBeInTheDocument();
  });
});


describe("Evidence grading interaction", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  const openProblem = {id:"text-1",question_type:"short_answer",question:"解释单位换算",options:null,order_index:0};

  it("supports short answers, saves drafts and keeps partial answers editable", async () => {
    const api=await import("@/lib/api");
    vi.mocked(api.listProblems).mockResolvedValueOnce([openProblem]);
    vi.mocked(api.submitAnswer).mockResolvedValueOnce({is_correct:null,status:"partial",counted:false,independent:true,
      attempt_id:"attempt-1",revision:1,correct_answer:null,explanation:"已理解关系，还需解释单位。",follow_up:"单位是什么？"});
    render(<QuizView courseId="test"/>);
    const input=await screen.findByRole("textbox",{name:"grading.answerLabel"});
    fireEvent.change(input,{target:{value:"一分钟就是六十秒"}});
    expect(localStorage.getItem("opentutor-answer-draft:test:text-1")).toBe("一分钟就是六十秒");
    fireEvent.click(screen.getByRole("button",{name:"grading.submit"}));
    await screen.findByText("grading.partial");
    expect(input).toBeEnabled(); expect(input).toHaveValue("一分钟就是六十秒");
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByText("grading.notCounted")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"grading.supplement"}));
    await waitFor(()=>expect(api.submitAnswer).toHaveBeenLastCalledWith("text-1","一分钟就是六十秒",expect.any(Number),
      expect.objectContaining({parentAttemptId:"attempt-1"})));
  });

  it("restores a local server assessment and allows review after refresh", async () => {
    const api=await import("@/lib/api");
    vi.mocked(api.listProblems).mockResolvedValueOnce([openProblem]);
    vi.mocked(api.getQuizAttempts).mockResolvedValueOnce([{...openProblem,problem_id:"text-1",user_answer:"六十秒",
      attempt_id:"saved-attempt",revision:1,is_correct:false,status:"incorrect",counted:true,correct_answer:"60秒",explanation:"原判定"}]);
    vi.mocked(api.reviewQuizAnswer).mockResolvedValueOnce({attempt_id:"saved-attempt",revision:2,is_correct:true,
      status:"correct",counted:true,correct_answer:"60秒",explanation:"同义答案正确",history:[
        {revision:1,status:"incorrect",feedback:"原判定",at:"2026-10-19T10:00:00Z"},
        {revision:2,status:"correct",feedback:"复核通过",at:"2026-10-19T10:01:00Z"}]});
    render(<QuizView courseId="test"/>);
    await screen.findByText("原判定");
    expect(screen.getByRole("textbox",{name:"grading.answerLabel"})).toHaveValue("六十秒");
    fireEvent.click(screen.getByText("grading.reviewEntry"));
    fireEvent.change(screen.getByRole("textbox",{name:"grading.reviewReason"}),{target:{value:"只是写法不同"}});
    fireEvent.click(screen.getByRole("button",{name:"grading.review"}));
    await screen.findByText("同义答案正确");
    expect(api.reviewQuizAnswer).toHaveBeenCalledWith("saved-attempt",1,"只是写法不同");
    expect(screen.getByText("grading.correct")).toBeInTheDocument();
    expect(screen.getByText("grading.history")).toBeInTheDocument();
  });

  it("keeps code when the model is unavailable and reuses the request ID on retry", async () => {
    const api=await import("@/lib/api");
    vi.mocked(api.listProblems).mockResolvedValueOnce([{...openProblem,question_type:"coding"}]);
    vi.mocked(api.submitAnswer).mockRejectedValueOnce(new Error("判题暂不可用"));
    render(<QuizView courseId="test"/>);
    const input=await screen.findByRole("textbox",{name:"quiz.coding.ariaLabel"});
    fireEvent.change(input,{target:{value:"n - n / 60 * 60"}});
    fireEvent.click(screen.getByRole("button",{name:"grading.submit"}));
    await screen.findByText("判题暂不可用");
    expect(input).toHaveValue("n - n / 60 * 60");
    const first=vi.mocked(api.submitAnswer).mock.calls[0][3]?.requestId;
    fireEvent.click(screen.getByRole("button",{name:"grading.submit"}));
    await waitFor(()=>expect(api.submitAnswer).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.submitAnswer).mock.calls[1][3]?.requestId).toBe(first);
  });

  it("multi-select waits for explicit submission", async () => {
    const api=await import("@/lib/api");
    vi.mocked(api.listProblems).mockResolvedValueOnce([{...openProblem,question_type:"select_all",options:{A:"选项甲",B:"选项乙"}}]);
    render(<QuizView courseId="test"/>);
    await screen.findByText("grading.multiHint");
    fireEvent.click(screen.getByRole("checkbox",{name:"A. 选项甲"}));
    expect(api.submitAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"grading.submit"}));
    await waitFor(()=>expect(api.submitAnswer).toHaveBeenCalledWith("text-1",'["A"]',expect.any(Number),expect.anything()));
  });
});


describe("Hint-first retry",()=>{
  beforeEach(()=>{vi.clearAllMocks();localStorage.clear();});
  it("lets a wrong choice be changed immediately, hides the answer and never highlights the correct option",async()=>{
    const api=await import("@/lib/api");
    vi.mocked(api.submitAnswer).mockResolvedValueOnce({is_correct:false,status:"incorrect",attempt_id:"wrong-attempt",
      revision:1,counted:true,independent:true,correct_answer:"b",explanation:"先检查当前运算是否已经做完。",
      criteria:[{id:"secret",requirement:"标准答案是Blue",status:"not_met",answer_quote:"",reason:"应选b"}]});
    render(<QuizView courseId="test"/>);
    await screen.findByText("What color is the sky?");
    fireEvent.click(screen.getByTestId("quiz-option-a"));
    await screen.findByText("先检查当前运算是否已经做完。");
    expect(screen.getByTestId("quiz-option-b")).toBeEnabled();
    expect(screen.getByTestId("quiz-option-b").className).not.toContain("green-500");
    expect(screen.getByTestId("grading-result")).not.toHaveTextContent("Blue");
    expect(screen.queryByText("grading.criteria")).not.toBeInTheDocument();
    expect(screen.getByText("grading.retryHint")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("quiz-option-b"));
    await waitFor(()=>expect(api.submitAnswer).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.submitAnswer).mock.calls[1][3]?.parentAttemptId).toBe("wrong-attempt");
    await waitFor(()=>expect(screen.getByTestId("quiz-option-b")).toBeDisabled());
  });

  it("hides old review explanations and replacement questions when restoring feedback",async()=>{
    const api=await import("@/lib/api");
    vi.mocked(api.getQuizAttempts).mockResolvedValueOnce([{problem_id:"p1",user_answer:"a",attempt_id:"old",
      revision:3,is_correct:false,status:"incorrect",counted:true,correct_answer:null,explanation:"先检查运算顺序。",
      follow_up:"换个数7199试一下",history:[{revision:2,status:"needs_clarification",feedback:"答案是b",at:"2026-10-19T00:00:00Z"}]}]);
    render(<QuizView courseId="test"/>);
    await screen.findByText("先检查运算顺序。");
    expect(screen.queryByText(/7199/)).not.toBeInTheDocument();
    expect(screen.queryByText("答案是b")).not.toBeInTheDocument();
    expect(screen.getByTestId("quiz-option-b")).toBeEnabled();
  });
});
