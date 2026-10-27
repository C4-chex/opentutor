import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningProfileGate } from "./profile-gate";
import { loadLearningProfile } from "@/lib/api/learning-profile";
const mocks=vi.hoisted(()=>({path:"/",router:{replace:vi.fn()}}));
vi.mock("next/navigation",()=>({usePathname:()=>mocks.path,useRouter:()=>mocks.router}));
vi.mock("next/link",()=>({default:({children,href}:{children:React.ReactNode;href:string})=><a href={href}>{children}</a>}));
vi.mock("@/lib/api/learning-profile",()=>({loadLearningProfile:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();mocks.path="/";});afterEach(cleanup);
describe("first-run gate",()=>{
  it("blocks old routes and redirects unconfigured users even if they have courses",async()=>{
    mocks.path="/course/existing";vi.mocked(loadLearningProfile).mockResolvedValue({complete:false,revision:0,profile:null});
    render(<LearningProfileGate><p>课程内容</p></LearningProfileGate>);
    await waitFor(()=>expect(mocks.router.replace).toHaveBeenCalledWith("/welcome?next=%2Fcourse%2Fexisting"));
    expect(screen.queryByText("课程内容")).not.toBeInTheDocument();
  });
  it("allows saved users to open their page without a local browser flag",async()=>{
    vi.mocked(loadLearningProfile).mockResolvedValue({complete:true,revision:1,profile:null});
    render(<LearningProfileGate><p>课程内容</p></LearningProfileGate>);
    await screen.findByText("课程内容");expect(mocks.router.replace).not.toHaveBeenCalled();
  });
  it("keeps settings accessible when the profile or backend is unavailable",()=>{
    mocks.path="/settings";render(<LearningProfileGate><p>设置页面</p></LearningProfileGate>);
    expect(screen.getByText("设置页面")).toBeInTheDocument();expect(loadLearningProfile).not.toHaveBeenCalled();
  });
  it("shows a recoverable connection error instead of treating an outage as first run",async()=>{
    vi.mocked(loadLearningProfile).mockRejectedValueOnce(new Error("服务暂不可用")).mockResolvedValueOnce({complete:true,revision:1,profile:null});
    render(<LearningProfileGate><p>课程内容</p></LearningProfileGate>);
    await screen.findByText("服务暂不可用");expect(mocks.router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"重新连接"}));await screen.findByText("课程内容");
  });
});
