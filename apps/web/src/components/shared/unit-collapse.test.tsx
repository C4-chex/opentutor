import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {OriginalMaterial} from "@/app/course/[id]/unit/[nodeId]/_components/content-block";
import {SubsectionsNav} from "@/app/course/[id]/unit/[nodeId]/_components/unit-navigation";
import {setLocale} from "@/lib/i18n";
import type {ContentNode} from "@/lib/api";
vi.mock("@/components/shared/markdown-renderer",()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
const node:ContentNode={id:"node",title:"labs",content:"SOURCE_TEXT",level:0,order_index:0,source_type:"url",children:[]};
beforeEach(()=>setLocale("zh"));afterEach(cleanup);
it("defaults chapter source to collapsed without rendering its large body",()=>{
 render(<OriginalMaterial node={node} title="原始资料"/>);
 const button=screen.getByRole("button",{name:"展开 原始资料"});expect(button).toHaveAttribute("aria-expanded","false");
 expect(screen.queryByText("SOURCE_TEXT")).not.toBeInTheDocument();
 fireEvent.click(button);expect(screen.getByText("SOURCE_TEXT")).toBeVisible();expect(screen.getByRole("button",{name:"收起 原始资料"})).toHaveAttribute("aria-expanded","true");
 fireEvent.click(button);expect(screen.queryByText("SOURCE_TEXT")).not.toBeInTheDocument();
});
it("defaults the subsections to collapsed and keeps the chapter navigation usable",()=>{
 render(<SubsectionsNav courseId="course" subsections={[{...node,id:"child",title:"实验一"}]} t={()=>"子章节"}/>);
 expect(screen.queryByRole("link",{name:"实验一"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"展开 子章节"}));
 expect(screen.getByRole("link",{name:"实验一"})).toHaveAttribute("href","/course/course/unit/child");
 fireEvent.click(screen.getByRole("button",{name:"收起 子章节"}));expect(screen.queryByRole("link",{name:"实验一"})).not.toBeInTheDocument();
});
