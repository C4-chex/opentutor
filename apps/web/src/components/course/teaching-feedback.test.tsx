import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeachingFeedback } from "./teaching-feedback";
import { loadTeachingReports, saveTeachingReport } from "@/lib/api/teaching-feedback";
vi.mock("@/lib/api/teaching-feedback",()=>({loadTeachingReports:vi.fn(),saveTeachingReport:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(loadTeachingReports).mockResolvedValue([]);vi.mocked(saveTeachingReport).mockResolvedValue({report_id:"report",revision:3,kind:"other",note:"题目缺少输入范围",status:"recorded",created_at:"now"});});
afterEach(cleanup);
async function show(){render(<TeachingFeedback courseId="course" nodeId="node" revision={3}/>);fireEvent.click(screen.getByRole("button",{name:"反馈教学问题"}));await screen.findByText(/将当前教学内容/);}
describe("local teaching feedback",()=>{
 it("supports free-form issues and keeps a clear pending-review status",async()=>{
  await show();fireEvent.change(screen.getByLabelText("问题类型"),{target:{value:"other"}});
  expect(screen.getByRole("button",{name:"保存问题反馈"})).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/具体问题说明/),{target:{value:"题目缺少输入范围"}});
  fireEvent.click(screen.getByRole("button",{name:"保存问题反馈"}));
  await screen.findByText(/反馈已保存在本机，尚未复核/);
  expect(saveTeachingReport).toHaveBeenCalledWith("course","node",expect.objectContaining({revision:3,kind:"other",note:"题目缺少输入范围"}));
 });
 it("preserves the issue description if the local save fails",async()=>{
  vi.mocked(saveTeachingReport).mockRejectedValue(new Error("连接失败"));await show();
  fireEvent.change(screen.getByLabelText(/具体问题说明/),{target:{value:"判断依据与原文不符"}});
  fireEvent.click(screen.getByRole("button",{name:"保存问题反馈"}));
  await screen.findByText("连接失败");expect(screen.getByLabelText(/具体问题说明/)).toHaveValue("判断依据与原文不符");
 });
 it("reloads previously saved issue records",async()=>{
  vi.mocked(loadTeachingReports).mockResolvedValue([{report_id:"saved",revision:2,kind:"grading",note:"忽略了返回值",status:"recorded",created_at:"now"}]);
  await show();await waitFor(()=>expect(screen.getByText("忽略了返回值")).toBeInTheDocument());
 });
});
