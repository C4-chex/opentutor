import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { LearningPaceButton } from "./learning-pace-button";
import { loadLearningProfile,updateLearningPace,type LearningProfileState } from "@/lib/api/learning-profile";
import { setLocale,t } from "@/lib/i18n";
vi.mock("@/lib/api/learning-profile",()=>({loadLearningProfile:vi.fn(),updateLearningPace:vi.fn()}));
vi.mock("@/lib/i18n-context",()=>({useT:()=>t}));
const profile:LearningProfileState={complete:true,revision:4,profile:{teaching_mode:"try_first",feedback_level:"hint",review_mode:"manual",
 background:"学过一些 C",current_progress:"数组",learning_goal:"独立编程",learning_pace:"adaptive",foundation_level:"some",learning_depth:"applied",
 background_source:"self_report",updated_at:"now"},pace_plan:{mode:"adaptive",foundation_level:"some",learning_depth:"applied",concepts_per_step:2,
 target_explanation_chars:320,practice_tasks:1,transfer_tasks:1,adjustment_reason:"profile",requires_verification:true}};
beforeEach(()=>{vi.clearAllMocks();setLocale("zh");vi.mocked(loadLearningProfile).mockResolvedValue(profile);});
afterEach(cleanup);
async function open(){render(<LearningPaceButton/>);await waitFor(()=>expect(loadLearningProfile).toHaveBeenCalled());
 fireEvent.click(screen.getByRole("button",{name:"调节学习速度"}));await screen.findByRole("button",{name:"快一点"});}
describe("home learning speed",()=>{
 it("shows the saved pace and the profile basis",async()=>{
  await open();await waitFor(()=>expect(screen.getByRole("button",{name:"按画像调整"})).toHaveAttribute("aria-pressed","true"));
  expect(screen.getByText(/有一些基础/)).toBeInTheDocument();expect(screen.getByText(/能够独立实操/)).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"修改学习基础与学习要求"})).toHaveAttribute("href","/settings#learning-profile");
 });
 it("saves only the pace with the current revision and shows the server result",async()=>{
  vi.mocked(updateLearningPace).mockResolvedValue({...profile,revision:5,profile:{...profile.profile!,learning_pace:"fast"},pace_plan:{...profile.pace_plan!,mode:"fast",concepts_per_step:3}});
  await open();await waitFor(()=>expect(screen.getByRole("button",{name:"快一点"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"快一点"}));
  await screen.findByText(/速度已保存/);
  expect(updateLearningPace).toHaveBeenCalledWith("fast",4);
  expect(screen.getByRole("button",{name:"快一点"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByText(/每步约 3 个相关小概念/)).toBeInTheDocument();
 });
 it("keeps the saved setting if the update fails",async()=>{
  vi.mocked(updateLearningPace).mockRejectedValue(new Error("画像版本已变化"));
  await open();await waitFor(()=>expect(screen.getByRole("button",{name:"快一点"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"快一点"}));await screen.findByText("画像版本已变化");
  expect(screen.getByRole("button",{name:"按画像调整"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("button",{name:"重新读取画像"})).toBeInTheDocument();
 });
 it("requires profile setup rather than silently creating background assumptions",async()=>{
  vi.mocked(loadLearningProfile).mockResolvedValue({complete:false,revision:0,profile:null});
  await open();await screen.findByText(/先设置学习画像/);
  expect(screen.getByRole("button",{name:"快一点"})).toBeDisabled();expect(updateLearningPace).not.toHaveBeenCalled();
 });
});
