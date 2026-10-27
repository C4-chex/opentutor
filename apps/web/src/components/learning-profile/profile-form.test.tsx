import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningProfileForm } from "./profile-form";
import { loadLearningProfile, saveLearningProfile, type LearningProfileState } from "@/lib/api/learning-profile";

vi.mock("@/lib/api/learning-profile",()=>({loadLearningProfile:vi.fn(),saveLearningProfile:vi.fn()}));
const saved:LearningProfileState = {complete:true,revision:2,profile:{teaching_mode:"try_first",feedback_level:"locate",review_mode:"manual",
  background:"C 初学者",current_progress:"循环",learning_goal:"STM32",background_source:"self_report",updated_at:"now"}};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(loadLearningProfile).mockResolvedValue({complete:false,revision:0,profile:null});vi.mocked(saveLearningProfile).mockResolvedValue(saved);});
afterEach(cleanup);

async function choose(){
  await screen.findByRole("button",{name:"保存画像并进入"});
  fireEvent.click(screen.getByLabelText(/^刚入门/));
  fireEvent.click(screen.getByLabelText(/^能够独立实操/));
  fireEvent.click(screen.getByLabelText(/^按画像调整/));
  fireEvent.click(screen.getByLabelText(/先尝试，再讲解/));
  fireEvent.click(screen.getByLabelText(/^指出问题/));
  fireEvent.click(screen.getByLabelText(/仅手动复习/));
}
describe("explicit profile choices",()=>{
  it("requires every explicit choice without silently preselecting defaults",async()=>{
    render(<LearningProfileForm firstRun/>);
    const button=await screen.findByRole("button",{name:"保存画像并进入"});
    expect(button).toBeDisabled();
    expect(screen.getAllByRole("radio").every((el)=>(el as HTMLInputElement).checked===false)).toBe(true);
    fireEvent.click(screen.getByLabelText(/先讲解，再尝试/));
    expect(button).toBeDisabled();
  });
  it("persists choices and self-reported background before continuing",async()=>{
    const onSaved=vi.fn();render(<LearningProfileForm firstRun onSaved={onSaved}/>);await choose();
    fireEvent.change(screen.getByLabelText(/我的学习背景/),{target:{value:"学过 C，但是不懂指针"}});
    fireEvent.click(screen.getByRole("button",{name:"保存画像并进入"}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
    expect(saveLearningProfile).toHaveBeenCalledWith(expect.objectContaining({teaching_mode:"try_first",feedback_level:"locate",review_mode:"manual",background:"学过 C，但是不懂指针"}),0);
  });
  it("restores saved choices and sends the current revision when edited",async()=>{
    vi.mocked(loadLearningProfile).mockResolvedValue(saved);render(<LearningProfileForm/>);
    await screen.findByRole("button",{name:"保存学习偏好"});
    expect(screen.getByLabelText(/先尝试，再讲解/)).toBeChecked();
    fireEvent.click(screen.getByLabelText(/先讲解，再尝试/));fireEvent.click(screen.getByRole("button",{name:"保存学习偏好"}));
    await screen.findByText(/学习画像已保存/);
    expect(saveLearningProfile).toHaveBeenCalledWith(expect.objectContaining({teaching_mode:"explain_first"}),2);
  });
  it("keeps input and does not continue when saving fails",async()=>{
    vi.mocked(saveLearningProfile).mockRejectedValue(new Error("保存冲突"));
    const onSaved=vi.fn();render(<LearningProfileForm firstRun onSaved={onSaved}/>);await choose();
    fireEvent.change(screen.getByLabelText(/我目前学到哪里/),{target:{value:"正在学习循环"}});
    fireEvent.click(screen.getByRole("button",{name:"保存画像并进入"}));await screen.findByText("保存冲突");
    expect(screen.getByLabelText(/我目前学到哪里/)).toHaveValue("正在学习循环");expect(onSaved).not.toHaveBeenCalled();
  });
});
