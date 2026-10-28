import {describe,it,expect} from "vitest";
import {prepareLessonMarkdown} from "./lesson";

describe("legacy lesson presentation",()=>{
 it("groups numeric steps while keeping integer division and modulo exactly as written",()=>{
  const input="仍用 tick = 5000：\n5000 % 3600 = 1400，这是剩余秒。\n分钟：(5000 % 3600) / 60 = 1400 / 60 = 23。\n秒：(5000 % 3600) % 60 = 1400 % 60 = 20。";
  const formatted=prepareLessonMarkdown(input);
  expect(formatted).toContain("```calculation");
  expect(formatted).toContain("分钟：(5000 % 3600) / 60 = 1400 / 60 = 23");
  expect(formatted).toContain("秒：(5000 % 3600) % 60 = 1400 % 60 = 20");
  expect(formatted).toContain("这是剩余秒。");
  expect(formatted).not.toContain("\\frac");
 });
 it("does not transform code, formulas, prose lists or inline expressions",()=>{
  const input="```c\nint x = 1400 / 60;\nprintf(\"%d\", x);\n```\n\n$$\nx = 1400 / 60\n$$\n\n`x = 1400 / 60`\n\n- Use integer division for full groups.";
  expect(prepareLessonMarkdown(input)).toBe(input);
 });
 it("supports longer Markdown fences and does not format fence contents",()=>{
  const input="````text\n```c\n1400 / 60 = 23\n```\n````";
  expect(prepareLessonMarkdown(input)).toBe(input);
 });
 it("displays a plain assignment separately without changing its contents",()=>{
  expect(prepareLessonMarkdown("声明变量：\nint tick = 5000;")).toContain("```\nint tick = 5000;\n```");
 });
 it("is safe to apply again to an already formatted lesson",()=>{
  const input="5000 % 3600 = 1400\n1400 % 60 = 20";
  const formatted=prepareLessonMarkdown(input);
  expect(prepareLessonMarkdown(formatted)).toBe(formatted);
 });
 it("separates the annotated bullet-list calculations from their explanations",()=>{
  const input="仍用 tick = 5000：\n\n- 5000 % 3600 = 1400，这是剩余秒。\n- 分钟：(5000 % 3600) / 60 = 1400 / 60 = 23。\n- 秒：(5000 % 3600) % 60 = 1400 % 60 = 20。";
  const formatted=prepareLessonMarkdown(input);
  expect(formatted).toContain("```calculation\n5000 % 3600 = 1400");
  expect(formatted).toContain("分钟：(5000 % 3600) / 60 = 1400 / 60 = 23");
  expect(formatted).toContain("这是剩余秒。");
 });

});

it("separates legacy printf lists into exact C code, expected output and explanation",()=>{
 const input='- printf("%02d", hour); 输出 01，不足两位补 0。\n于是整体若写成 printf("Current time: %02d-%02d-%02d", hour, min, sec); 屏幕上显示 Current time: 01-23-20。原因：只影响显示。';
 const result=prepareLessonMarkdown(input);
 expect(result).toContain('```c\nprintf("%02d", hour);\n```');
 expect(result).toContain('```expected-output\n01\n```');expect(result).toContain('不足两位补 0。');
 expect(result).toContain('```c\nprintf("Current time: %02d-%02d-%02d", hour, min, sec);\n```');
 expect(result).toContain('```expected-output\nCurrent time: 01-23-20\n```');expect(result).toContain('原因：只影响显示。');
 expect(prepareLessonMarkdown(result)).toBe(result);
});
it("keeps nested calls, quoted semicolons, escaped quotes and comments inside code",()=>{
 const code='printf("a); b\\\" %d", abs(x)); // comment';
 const result=prepareLessonMarkdown(code);expect(result).toContain('```c\n'+code+'\n```');
 expect(result.match(/```c/g)).toHaveLength(1);
});
it("does not detach a function call from its variable initialization",()=>{
 const input='int printed = printf("%d", 1);';
 const result=prepareLessonMarkdown(input);expect(result).toContain('```\n'+input+'\n```');
});
it("leaves existing inline-code descriptions and prose mentioning names unchanged",()=>{
 for(const input of ['`printf("%d", hour);` is an example.', 'printf 的格式串决定显示方式。','Use $f(x)=x^2$ here.'])expect(prepareLessonMarkdown(input)).toBe(input);
});
