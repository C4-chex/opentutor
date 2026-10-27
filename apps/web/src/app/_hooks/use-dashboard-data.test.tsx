import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/api";
const mocks=vi.hoisted(()=>({replace:vi.fn(),fetchCourses:vi.fn(async()=>undefined),state:{courses:[] as Array<{id:string;name:string}>,loading:false,error:null}}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:mocks.replace})}));
vi.mock("@/store/course",()=>({useCourseStore:Object.assign(()=>mocks.state,{getState:()=>({fetchCourses:mocks.fetchCourses})})}));
vi.mock("@/lib/i18n-context",()=>({useT:()=>((key:string)=>key)}));
vi.mock("@/lib/api",()=>({
 getHealthStatus:vi.fn(async()=>null),listNotifications:vi.fn(async()=>({notifications:[]})),
 getReviewSession:vi.fn(),listAgentTasks:vi.fn(),listStudyGoals:vi.fn(),getWeeklyReport:vi.fn(),getLearningOverview:vi.fn(),
}));
import { useDashboardData } from "./use-dashboard-data";
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();mocks.state={courses:[],loading:false,error:null};});afterEach(cleanup);
describe("minimal home data",()=>{
 it("leaves new-user routing to the profile gate and keeps the empty dashboard accessible",async()=>{
  renderHook(()=>useDashboardData());await waitFor(()=>expect(mocks.fetchCourses).toHaveBeenCalledOnce());
  expect(mocks.replace).not.toHaveBeenCalled();
 });
 it("does not load removed panel data even with multiple courses",async()=>{
  mocks.state.courses=[{id:"one",name:"C"},{id:"two",name:"STM32"}];
  renderHook(()=>useDashboardData());await waitFor(()=>expect(api.listNotifications).toHaveBeenCalledWith({unreadOnly:true,limit:5}));
  expect(api.getHealthStatus).toHaveBeenCalled();
  for(const method of [api.getReviewSession,api.listAgentTasks,api.listStudyGoals,api.getWeeklyReport,api.getLearningOverview])expect(method).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
 });
});
