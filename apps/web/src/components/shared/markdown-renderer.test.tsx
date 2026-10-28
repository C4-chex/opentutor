import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {MarkdownRenderer} from "./markdown-renderer";
import {setLocale} from "@/lib/i18n";

beforeEach(()=>{setLocale("en");});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe("readable code and math",()=>{
 it("renders a labeled code cell without nested pre tags and copies exact code",async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText}});
  const {container}=render(<MarkdownRenderer content={'Explain the variable.\n\n```c\nint tick = 5000;\nprintf("%d", tick % 60);\n```'}/>);
  expect(screen.getByText("Explain the variable.")).toBeInTheDocument();
  expect(screen.getByLabelText("C")).toBeInTheDocument();
  expect(container.querySelector("pre pre")).toBeNull();
  expect(container.querySelector(".code-token-keyword")).not.toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Copy code"}));
  await waitFor(()=>expect(writeText).toHaveBeenCalledWith('int tick = 5000;\nprintf("%d", tick % 60);'));
  expect(await screen.findByText("Copied")).toBeInTheDocument();
 });
 it("renders inline and display LaTeX with KaTeX",()=>{
  const {container}=render(<MarkdownRenderer content={'Use $t=5000$.\n\n$$\nr = 5000 \\bmod 3600 = 1400\n$$'}/>);
  expect(container.querySelectorAll(".katex")).toHaveLength(2);
  expect(container.querySelector(".katex-display")).not.toBeNull();
  expect(container.querySelector(".katex-error")).toBeNull();
 });
 it("keeps inline code inline, and separates output from code",()=>{
  const {container}=render(<MarkdownRenderer content={'Use `tick` here.\n\n```output\n01:23:20\n```'}/>);
  expect(container.querySelector("p code")?.textContent).toBe("tick");
  expect(screen.getByLabelText("Output / result")).toHaveTextContent("01:23:20");
 });
 it("formats existing calculations only in teaching mode",()=>{
  const {rerender}=render(<MarkdownRenderer content="分钟：1400 / 60 = 23。"/>);
  expect(screen.queryByLabelText("Calculation")).not.toBeInTheDocument();
  rerender(<MarkdownRenderer teaching content="分钟：1400 / 60 = 23。"/>);
  expect(screen.getByLabelText("Calculation")).toHaveTextContent("1400 / 60 = 23");
 });
 it("shows a usable fallback when clipboard access fails",async()=>{
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error("denied"))}});
  render(<MarkdownRenderer content={'```python\nprint(1)\n```'}/>);
  fireEvent.click(screen.getByRole("button",{name:"Copy code"}));
  expect(await screen.findByText("Copy failed. Select the text to copy.")).toBeInTheDocument();
 });
 it("displays untrusted markup as code without creating active elements",()=>{
  const {container}=render(<MarkdownRenderer content={'```html\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n```'}/>);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByLabelText("HTML").textContent).toContain("<script>alert(1)</script>");
 });
});

it("shows legacy worked examples as notebook code and expected-output cells",()=>{
 setLocale("zh");const input='在 5000 秒的例子里，hour = 1、min = 23、sec = 20。\n\n- printf("%d", hour); 输出 1，只占一格。\n- printf("%02d", hour); 输出 01，不足两位补 0。\n- printf("%02d", min); 输出 23，本身两位，不再补。\n- printf("%02d", sec); 输出 20。\n\n于是整体若写成 printf("Current time: %02d-%02d-%02d", hour, min, sec); 屏幕上显示 Current time: 01-23-20。原因：只影响显示。';
 const {container}=render(<MarkdownRenderer teaching content={input}/>);
 expect(container.querySelectorAll('.notebook-cell pre[data-language="c"]')).toHaveLength(5);
 expect(container.querySelectorAll('pre[data-language="expected-output"]')).toHaveLength(5);
 expect(screen.getAllByLabelText("预期输出")[1]).toHaveTextContent("01");
 expect(container.querySelector('pre[data-language="c"]')?.textContent).toBe('printf("%d", hour);');
 expect(container.querySelector("pre pre")).toBeNull();
 expect(container.textContent).toContain("原因：只影响显示。");
});
