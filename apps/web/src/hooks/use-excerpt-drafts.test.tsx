import {act,cleanup,renderHook} from "@testing-library/react";
import {afterEach,beforeEach,expect,it} from "vitest";
import {useExcerptDrafts} from "./use-excerpt-drafts";
beforeEach(()=>localStorage.clear());afterEach(cleanup);
it("switches chapter drafts without writing the old chapter content under the new key",()=>{
 const {result,rerender}=renderHook(({node})=>useExcerptDrafts("course",node),{initialProps:{node:"one"}});
 act(()=>result.current.add("Original code","ai"));const id=result.current.drafts[0].id;
 act(()=>result.current.reflect(id,"Chapter one explanation"));
 rerender({node:"two"});expect(result.current.drafts).toHaveLength(0);
 act(()=>result.current.add("Second chapter"));rerender({node:"one"});
 expect(result.current.drafts[0].reflection).toBe("Chapter one explanation");
 expect(localStorage.getItem("opentutor:excerpt-drafts:course:two")).not.toContain("Original code");
});
it("enforces the pending size limit without replacing existing excerpts",()=>{
 const {result}=renderHook(()=>useExcerptDrafts("course","node"));
 act(()=>result.current.add("x".repeat(59999)));
 act(()=>result.current.add("Too much"));expect(result.current.full).toBe(true);
 expect(result.current.drafts).toHaveLength(1);expect(result.current.drafts[0].markdown).toHaveLength(59999);
 act(()=>result.current.remove([result.current.drafts[0].id]));expect(result.current.full).toBe(false);
 act(()=>result.current.add("A new small excerpt"));expect(result.current.drafts).toHaveLength(1);
});
