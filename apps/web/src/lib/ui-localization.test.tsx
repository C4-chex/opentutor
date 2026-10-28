import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { setLocale, uiText } from "./i18n";
import { useUiText } from "@/hooks/use-ui-text";
import { LocaleProvider } from "./i18n-context";
import { localizeApiMessage } from "./ui-errors";
import { parseApiError } from "./api/client";
import { TemplatePicker } from "@/app/course/[id]/_components/template-picker";

beforeEach(() => { localStorage.clear(); setLocale("en"); });
afterEach(() => { cleanup(); act(() => setLocale("en")); localStorage.clear(); });

describe("supplementary UI localization", () => {
  it("updates existing components when the language changes", () => {
    const { result } = renderHook(() => useUiText());
    expect(result.current("Start Learning")).toBe("Start Learning");
    act(() => setLocale("zh"));
    expect(result.current("Start Learning")).toBe("开始学习");
    expect(uiText("My own English course title")).toBe("My own English course title");
    act(() => setLocale("en"));
    expect(result.current("Start Learning")).toBe("Start Learning");
  });

  it("shows Chinese template labels while preserving the selected template ID", () => {
    setLocale("zh");
    const onApply = vi.fn();
    render(<LocaleProvider><TemplatePicker onApplyTemplate={onApply} /></LocaleProvider>);
    expect(screen.getByText("理工科学习")).toBeInTheDocument();
    expect(screen.getByText("空白工作区")).toBeInTheDocument();
    expect(screen.queryByText("STEM Student")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /理工科学习/ }));
    expect(onApply).toHaveBeenCalledWith("stem_student");
  });

  it("localizes backend errors while retaining original diagnostic detail", async () => {
    setLocale("zh");
    const raw = "LECTOR semantic review is experimental. Set ENABLE_EXPERIMENTAL_LECTOR=true to enable.";
    const error = await parseApiError(new Response(JSON.stringify({ detail: raw }), { status: 404 }));
    expect(error.message).toContain("尚未启用");
    expect(error.originalDetail).toBe(raw);
    expect(localizeApiMessage("Internal Server Error", 500)).toContain("服务");
    setLocale("en");
    expect(localizeApiMessage(raw, 404)).toBe(raw);
  });
});
