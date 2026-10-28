interface LegacySegment {text:string; language?:string}
function legacyCallCells(line:string):LegacySegment[]|null {
  const source=line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
  const calls=/\b(printf|fprintf|sprintf|snprintf|puts|putchar|scanf|print|println|console\.log|Serial\.print(?:ln)?|System\.out\.println|std::printf)\s*\(/g;
  const segments:LegacySegment[]=[];let cursor=0;let found=false;let match:RegExpExecArray|null;
  while((match=calls.exec(source))){
    const opening=source.indexOf("(",match.index);let depth=0;let quote="";let escaped=false;let end=-1;
    for(let index=opening;index<source.length;index++){
      const character=source[index];
      if(quote){if(escaped)escaped=false;else if(character==="\\")escaped=true;else if(character===quote)quote="";continue;}
      if(character==='"'||character==="'"){quote=character;continue;}
      if(character==="(")depth++;
      else if(character===")"&&--depth===0){end=index+1;break;}
    }
    if(end<0)continue;
    const semicolon=source.slice(end).match(/^\s*;/);if(semicolon)end+=semicolon[0].length;
    const prose=source.slice(cursor,match.index).trim();
    // Never detach a call from its assignment or embed a source comment as prose.
    if(/[A-Za-z_]\w*\s*=(?!=)/.test(prose))return null;
    if(/^\s*\/\//.test(source.slice(end)))end=source.length;
    if(prose)segments.push({text:prose});
    const language=match[1]==="print"?"python":match[1]==="console.log"?"javascript":match[1]==="System.out.println"?"java":match[1].startsWith("Serial.")||match[1].startsWith("std::")?"cpp":"c";
    segments.push({text:source.slice(match.index,end),language});found=true;cursor=end;calls.lastIndex=end;
  }
  if(!found)return null;
  const tail=source.slice(cursor).trim();if(tail)segments.push({text:tail});
  return segments;
}

/** Presentation-only formatting for older plain-text lessons. Never evaluates code or rewrites arithmetic. */
export function prepareLessonMarkdown(content: string): string {
  const output: string[] = [];
  let fence: {character: string; size: number} | null = null;
  let displayMath = false;
  let calculations: string[] = [];
  const flush = () => {
    if (calculations.length) {
      output.push("", "```calculation", ...calculations, "```", "");
      calculations = [];
    }
  };
  for (const line of content.split("\n")) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      flush();
      if (!fence) fence = {character: marker[1][0], size: marker[1].length};
      else if (marker[1][0] === fence.character && marker[1].length >= fence.size) fence = null;
      output.push(line);
      continue;
    }
    if (fence) { output.push(line); continue; }
    if (line.trim().startsWith("$$")) {
      flush(); output.push(line);
      if ((line.match(/\$\$/g) || []).length % 2) displayMath = !displayMath;
      continue;
    }
    // Preserve existing math, inline code and indented code verbatim.
    if (displayMath || /[`$]/.test(line) || /^ {4}/.test(line)) {
      flush(); output.push(line); continue;
    }
    const cells=legacyCallCells(line);
    if(cells){
      flush();
      for(const cell of cells){
        if(cell.language)output.push("",`\`\`\`${cell.language}`,cell.text,"```","");
        else {
          const result=cell.text.match(/^(?:输出|预期输出|屏幕上显示|预期结果)[：:\s]*(.+?)([，。；][\s\S]*)?$/);
          if(result) {
            output.push("","```expected-output",result[1].trim(),"```","");
            const explanation=result[2]?.replace(/^[，。；]\s*/, "");if(explanation)output.push(explanation,"");
          }else output.push(cell.text,"");
        }
      }
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    const trimmed = (bullet ? bullet[1] : line).trim();
    const equation = trimmed.match(/^((?:(?:小时|分钟|秒|余数|零头|结果|Hour|Minute|Second)[：:]\s*)?[\dA-Za-z_(][\dA-Za-z_ \t.+\-*/%()=<>]*)/);
    if (equation && equation[1].includes("=") && /[+*/%\-]/.test(equation[1])) {
      const rest = trimmed.slice(equation[1].length);
      // A complete calculation line, or a calculation followed by Chinese prose.
      if (!rest || /^[，。；：]/.test(rest)) {
        calculations.push(equation[1].trim());
        const prose = rest.replace(/^[，。；：]\s*/, "");
        if (prose) { flush(); output.push(prose, ""); }
        continue;
      }
    }
    flush();
    if (bullet || /^\s*\d+[.)]\s/.test(line)) { output.push(line); continue; }
    // Isolated declarations/assignments are displayed as code, with original text intact.
    if (/^(?:(?:int|float|double|char|bool|long|unsigned)\s+)?[A-Za-z_]\w*\s*=(?!=).+;\s*(?:\/\/.*)?$/.test(trimmed)) {
      output.push("", "```", line, "```", "");
    } else {
      output.push(line);
    }
  }
  flush();
  return output.join("\n");
}
