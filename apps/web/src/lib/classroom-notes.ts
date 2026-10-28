import type {GuidedLesson,GuidedTurn,FoundationConcept} from "@/lib/api/guided-learning";
import {prepareLessonMarkdown} from "@/lib/markdown/lesson";
import {uiText} from "@/lib/i18n";

export function lectureMarkdown(lesson:GuidedLesson,turn:GuidedTurn,concept?:FoundationConcept):string {
  const concepts=concept?[concept]:(turn.concepts||[]);
  const sections=[`## ${concept?.title||lesson.title}`,`> ${uiText("AI lecture excerpt")}`];
  if(!concept)sections.push(prepareLessonMarkdown(turn.text));
  for(const item of concepts){
    if(!concept)sections.push(`### ${item.title}`);
    if(item.is_supplement)sections.push(`> ${uiText("AI supplement: prerequisite knowledge not covered by the source.")}`);
    sections.push(prepareLessonMarkdown(item.explanation),`#### ${uiText("Worked example")}`,prepareLessonMarkdown(item.worked_example));
    if(item.common_mistake)sections.push(`#### ${uiText("Common pitfall")}`,item.common_mistake);
  }
  return sections.join("\n\n");
}

/** Extract a selection without copying controls or duplicating KaTeX's visual/accessible trees. */
export function selectionMarkdown(selection:Selection):string {
  if(!selection.rangeCount)return "";
  const range=selection.getRangeAt(0);
  const ancestor=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
  const containingCode=ancestor?.closest("pre");
  if(containingCode)return codeExcerptMarkdown(selection.toString(),containingCode.getAttribute("data-language")||"");
  const holder=document.createElement("div");holder.append(range.cloneContents());
  const codeBlocks:string[]=[];
  const marker=`excerpt-${crypto.randomUUID()}`;
  function read(node:Node):string {
    if(node.nodeType===Node.TEXT_NODE)return node.textContent||"";
    if(!(node instanceof Element))return Array.from(node.childNodes).map(read).join("");
    if(node.matches("button,script,style"))return "";
    if(node.matches(".notebook-cell")){const pre=node.querySelector("pre");if(pre)return read(pre);}
    if(node.matches(".katex-display,.katex")){
      const tex=node.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
      if(tex)return node.matches(".katex-display")?`\n\n$$\n${tex}\n$$\n\n`:`$${tex}$`;
    }
    if(node.tagName==="PRE"){
      const index=codeBlocks.push(codeExcerptMarkdown(node.textContent||"",node.getAttribute("data-language")||""))-1;
      return `\n\n${marker}:${index}\n\n`;
    }
    if(node.tagName==="CODE")return `\`${node.textContent||""}\``;
    const value=Array.from(node.childNodes).map(read).join("");
    if(/^H[1-6]$/.test(node.tagName))return `\n\n${"#".repeat(Number(node.tagName[1]))} ${value}\n\n`;
    if(node.tagName==="LI")return `\n- ${value}`;
    if(node.tagName==="BR")return "\n";
    if(/^(P|DIV|ARTICLE|SECTION|UL|OL|BLOCKQUOTE)$/.test(node.tagName))return `\n\n${value}\n\n`;
    return value;
  }
  let result=read(holder).replace(/\n{3,}/g,"\n\n").trim();
  codeBlocks.forEach((code,index)=>{result=result.replace(`${marker}:${index}`,()=>code);});
  return result;
}

export function downloadNotebook(title:string,markdown:string) {
  const url=URL.createObjectURL(new Blob([markdown],{type:"text/markdown;charset=utf-8"}));
  const anchor=document.createElement("a");anchor.href=url;anchor.download=(title.replace(/[<>:"/\\|?*\x00-\x1f]/g,"_")||"notes")+".md";
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}

/** Clean only the old generated classroom backlink, preserving user links and fenced code. */
export function removeGeneratedLessonLinks(markdown:string,courseId:string,nodeId:string):string {
  const target=`/course/${courseId}/unit/${nodeId}`;
  let fence:string|null=null;
  return markdown.split("\n").flatMap(line=>{
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);
    if(marker){if(fence===null)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;return [line];}
    if(fence!==null)return [line];
    const match=line.match(/^> (?:(AI 讲解摘录|AI lecture excerpt) · )?\[(回到课堂|Back to lesson)\]\(([^)]+)\)\s*$/);
    if(!match||![target,target+"#guided-learning"].includes(match[3]))return [line];
    return match[1]?[`> ${match[1]}`]:[];
  }).join("\n");
}

/** A source code excerpt stays a code block even if it contains Markdown fences. */
export function codeExcerptMarkdown(code:string,language=""):string {
  const longest=Math.max(2,...Array.from(code.matchAll(/`+/g),match=>match[0].length));
  const fence="`".repeat(longest+1);
  const label=language.replace(/[^a-zA-Z0-9_+#.\-]/g,"");
  return `${fence}${label}\n${code}\n${fence}`;
}

export function annotatedExcerptMarkdown(markdown:string,reflection:string,origin:"ai"|"classroom"="classroom"):string {
  const label=origin==="ai"?uiText("AI lecture excerpt"):uiText("Classroom excerpt");
  const parts=[`## ${label}`,markdown.trim()];
  if(reflection.trim())parts.push(`### ${uiText("My understanding")}`,reflection.trim());
  return parts.join("\n\n");
}
