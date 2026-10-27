import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it} from "vitest";
import {LessonSources} from "./lesson-sources";
import {setLocale} from "@/lib/i18n";

beforeEach(()=>setLocale("en"));
afterEach(cleanup);
describe("compact source links",()=>{
 const sources=[
  {node_id:"one",title:"README.md",url:"https://github.com/example/repo/blob/hash/lab-one/README.md"},
  {node_id:"two",title:"README.md",url:"https://github.com/example/repo/blob/hash/lab-two/README.md"},
 ];
 it("initially shows one entry, then distinct paths for files with the same title",()=>{
  render(<LessonSources courseId="course" sources={sources}/>);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"View source material (2)"}));
  expect(screen.getByRole("link",{name:"lab-one/README.md"})).toHaveAttribute("href",sources[0].url);
  expect(screen.getByRole("link",{name:"lab-two/README.md"})).toHaveAttribute("href",sources[1].url);
 });
 it("deduplicates identical URLs and preserves local source navigation",()=>{
  render(<LessonSources courseId="course" sources={[sources[0],sources[0],{node_id:"local",title:"Local material",url:null}]}/>);
  fireEvent.click(screen.getByRole("button",{name:"View source material (2)"}));
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(screen.getByRole("link",{name:"Local material"})).toHaveAttribute("href","/course/course/unit/local");
 });
 it("shows the entry and dialog in Chinese",()=>{
  setLocale("zh");render(<LessonSources courseId="course" sources={sources}/>);
  fireEvent.click(screen.getByRole("button",{name:"查看本轮原文 (2)"}));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("本轮讲解所依据的原始文件。点击链接即可查看，核对讲解内容。")).toBeInTheDocument();
 });
});
