import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import DashboardPage from "./page";
const mocks=vi.hoisted(()=>({push:vi.fn(),courses:[] as Array<{id:string;name:string;description:null;created_at:string}>,notifications:[] as Array<Record<string,unknown>>}));
vi.mock("./_hooks/use-dashboard-data",()=>({useDashboardData:()=>({router:{push:mocks.push},t:(key:string)=>key,courses:mocks.courses,loading:false,error:null,health:null,notifications:mocks.notifications})}));
vi.mock("@/components/learning-profile/learning-pace-button",()=>({LearningPaceButton:()=> <button>学习速度</button>}));
vi.mock("@/components/shared/runtime-alert",()=>({RuntimeAlert:()=>null}));
vi.mock("@/lib/i18n-context",()=>({useT:()=>((key:string)=>key)}));
beforeEach(()=>{vi.clearAllMocks();setLocale("en");mocks.courses=[];mocks.notifications=[];});afterEach(cleanup);
describe("focused learning home",()=>{
 it("keeps file and GitHub import, settings, and Agent Insight accessible",()=>{
  render(<DashboardPage/>);
  expect(screen.getByRole("button",{name:"学习速度"})).toBeInTheDocument();
  const imports=screen.getAllByRole("button",{name:/dashboard.create/});
  fireEvent.click(imports[0]);expect(mocks.push).toHaveBeenLastCalledWith("/new");
  fireEvent.click(screen.getByRole("button",{name:"Import a GitHub tutorial"}));expect(mocks.push).toHaveBeenLastCalledWith("/import/github");
  fireEvent.click(screen.getByRole("button",{name:"nav.settings"}));expect(mocks.push).toHaveBeenLastCalledWith("/settings");
  expect(screen.getByRole("button",{name:"home.agentInsights"})).toBeInTheDocument();
  expect(screen.getByText("home.agentInsights.empty")).toBeInTheDocument();
 });
 it("opens existing courses and Agent Insight actions",()=>{
  mocks.courses=[{id:"course-1",name:"C learning",description:null,created_at:"2026-10-18"}];
  mocks.notifications=[{id:"insight",title:"Review a concept",body:"A specific learning suggestion",read:false,category:"agent",course_id:"course-1",action_url:"/course/course-1/unit/node-1",action_label:"Continue lesson",data:null,created_at:"2026-10-18"}];
  render(<DashboardPage/>);
  fireEvent.click(screen.getByRole("button",{name:/C learning/}));expect(mocks.push).toHaveBeenLastCalledWith("/course/course-1");
  fireEvent.click(screen.getByRole("button",{name:"Continue lesson"}));expect(mocks.push).toHaveBeenLastCalledWith("/course/course-1/unit/node-1");
  expect(screen.queryByText("home.pendingApprovals.title")).not.toBeInTheDocument();
  expect(screen.queryByText("home.modeRecommendations.title")).not.toBeInTheDocument();
 });
});
