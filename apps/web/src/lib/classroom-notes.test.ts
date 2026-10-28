import {afterEach,describe,expect,it} from "vitest";
import {lectureMarkdown,selectionMarkdown,removeGeneratedLessonLinks,codeExcerptMarkdown,annotatedExcerptMarkdown} from "./classroom-notes";
import type {GuidedLesson,GuidedTurn} from "@/lib/api/guided-learning";
import {setLocale} from "@/lib/i18n";
afterEach(()=>{document.body.innerHTML="";window.getSelection()?.removeAllRanges();});
describe("faithful classroom excerpts",()=>{
 it("preserves source Markdown code and LaTeX in a captured teaching point",()=>{
  setLocale("zh");const concept={title:"整数除法",explanation:"求完整组",worked_example:'```c\nint x=125/60;\n```\n\n$$x=2$$',is_supplement:false};
  const turn:GuidedTurn={role:"tutor",stage:"learn",text:"Intro",concepts:[concept]};
  const lesson={course_id:"course",node_id:"node",title:"Basics"} as GuidedLesson;
  const note=lectureMarkdown(lesson,turn,concept);expect(note).toContain(concept.worked_example);expect(note).toContain("AI 讲解摘录");expect(note).not.toContain("/course/course/unit/node");
 });
 it("captures code text without copy-button labels",()=>{
  const root=document.createElement("div");root.innerHTML='<div class="notebook-cell"><div>C<button>Copy code</button></div><pre data-language="c"><code>int x = 1;</code></pre></div>';document.body.append(root);
  const range=document.createRange();range.selectNodeContents(root);const selected=window.getSelection()!;selected.removeAllRanges();selected.addRange(range);
  const result=selectionMarkdown(selected);expect(result).toContain('```c\nint x = 1;\n```');expect(result).not.toContain("Copy code");
 });
 it("copies a formula once from the original TeX rather than both KaTeX trees",()=>{
  const root=document.createElement("div");root.innerHTML='<span class="katex-display"><span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">x=2</annotation></math></span><span class="katex-html">VISUAL_DUPLICATE</span></span></span>';document.body.append(root);
  const range=document.createRange();range.selectNodeContents(root);const selected=window.getSelection()!;selected.removeAllRanges();selected.addRange(range);
  expect(selectionMarkdown(selected)).toBe('$$\nx=2\n$$');
 });
});

it("cleans only generated backlinks for this chapter and preserves links inside code",()=>{
  const line="> [回到课堂](/course/course/unit/node)";
  const input=[line,"> AI lecture excerpt · [Back to lesson](/course/course/unit/node#guided-learning)","My own notes", "[my link](/course/course/unit/node)", "```md",line,"```","> [回到课堂](/course/other/unit/node)"].join("\n");
  const result=removeGeneratedLessonLinks(input,"course","node");
  expect(result).toContain("My own notes");expect(result).toContain("[my link]");
  expect(result).toContain("```md\n"+line+"\n```");
  expect(result).toContain("/course/other/unit/node");
  expect(result).toMatch(/^> AI lecture excerpt\n/);
});

it("keeps notebook-style fences when an old prose teaching example is saved as notes",()=>{
 const concept={title:"格式化输出",explanation:"最小宽度",worked_example:'- printf("%02d", hour); 输出 01。',is_supplement:false};
 const turn:GuidedTurn={role:"tutor",stage:"learn",text:"Intro",concepts:[concept]};
 const note=lectureMarkdown({course_id:"course",node_id:"node",title:"C"} as GuidedLesson,turn,concept);
 expect(note).toContain('```c\nprintf("%02d", hour);\n```');expect(note).toContain('```expected-output\n01\n```');
});

it("keeps embedded fences and blank code lines intact in annotated excerpts",()=>{
 setLocale("en");const code='const example = "```";\n\n\nreturn 1;';
 const fenced=codeExcerptMarkdown(code,"js");expect(fenced).toBe('````js\n'+code+'\n````');
 const root=document.createElement("div");const p=document.createElement("p");p.textContent="A lesson";
 const pre=document.createElement("pre");pre.dataset.language="js";pre.textContent=code;
 root.append(p,pre);document.body.append(root);
 const range=document.createRange();range.selectNodeContents(root);const selected=window.getSelection()!;selected.addRange(range);
 expect(selectionMarkdown(selected)).toContain(fenced);
 const note=annotatedExcerptMarkdown(fenced,"My own explanation","ai");
 expect(note).toContain('## AI lecture excerpt');expect(note).toContain(fenced);
 expect(note).toContain('### My understanding\n\nMy own explanation');expect(note).not.toContain('Back to lesson');
});
