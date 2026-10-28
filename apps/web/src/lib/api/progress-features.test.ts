import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReviewSession, getForgettingForecast } from "./progress";
import { getFeatureFlags } from "./features";
import { request } from "./client";

vi.mock("./features", () => ({ getFeatureFlags: vi.fn() }));
vi.mock("./client", () => ({ request: vi.fn() }));
const flags = { loom: false, lector: false, cat_pretest: false, browser: false, vision: false, notion_export: false };

beforeEach(() => { vi.mocked(request).mockReset(); vi.mocked(getFeatureFlags).mockReset(); });

describe("review availability", () => {
  it("does not call the experimental endpoint while it is disabled", async () => {
    vi.mocked(getFeatureFlags).mockResolvedValue(flags);
    expect(await getReviewSession("course-1")).toEqual({ course_id: "course-1", items: [], count: 0, available: false });
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the real review endpoint when the feature is enabled", async () => {
    vi.mocked(getFeatureFlags).mockResolvedValue({ ...flags, lector: true });
    const session = { course_id: "course-1", items: [], count: 0 };
    vi.mocked(request).mockResolvedValue(session);
    expect(await getReviewSession("course-1", 5)).toEqual(session);
    expect(request).toHaveBeenCalledWith("/progress/courses/course-1/review-session?max_items=5");
  });

  it("does not conceal a genuine failure of an enabled endpoint", async () => {
    vi.mocked(getFeatureFlags).mockResolvedValue({ ...flags, lector: true });
    vi.mocked(request).mockRejectedValue(new Error("service failed"));
    await expect(getReviewSession("course-1")).rejects.toThrow("service failed");
  });
});


describe("disabled LOOM features",()=>{
  it("does not request experimental forecasts while LOOM is disabled",async()=>{
    vi.mocked(getFeatureFlags).mockResolvedValue(flags);
    expect(await getForgettingForecast("course-1")).toMatchObject({available:false,predictions:[]});
    expect(request).not.toHaveBeenCalled();
  });
  it("still exposes genuine failures when LOOM is enabled",async()=>{
    vi.mocked(getFeatureFlags).mockResolvedValue({...flags,loom:true});
    vi.mocked(request).mockRejectedValue(new Error("forecast service failed"));
    await expect(getForgettingForecast("course-1")).rejects.toThrow("forecast service failed");
    expect(request).toHaveBeenCalledWith("/progress/courses/course-1/forgetting-forecast");
  });
});
