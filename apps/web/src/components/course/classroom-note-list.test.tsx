import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ClassroomNoteList} from "./classroom-note-list";
import {listClassroomNotes} from "@/lib/api/classroom-notes";
import {setLocale} from "@/lib/i18n";
vi.mock("@/lib/api/classroom-notes",()=>({listClassroomNotes:vi.fn()}));
vi.mock("@/components/shared/markdown-renderer",()=>({MarkdownRenderer:({content}:{content:string})=><p>{content}</p>}));
beforeEach(()=>{vi.clearAllMocks();setLocale("zh");});afterEach(cleanup);
it("lists classroom notebooks without rendering all their contents until requested",async()=>{
 vi.mocked(listClassroomNotes).mockResolvedValue([{node_id:"chapter",title:"整除与取余",markdown:"我自己写的理解",revision:3,updated_at:null}]);
 await act(async()=>{render(<ClassroomNoteList courseId="course"/>);});
 expect(screen.queryByText("我自己写的理解")).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"整除与取余"}));
 expect(screen.getByText("我自己写的理解")).toBeInTheDocument();expect(screen.getByRole("link",{name:"回到课堂"})).toHaveAttribute("href","/course/course/unit/chapter?notes=1");
});
