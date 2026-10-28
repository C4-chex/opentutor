import {API_BASE, buildSecureRequestInit, parseApiError} from "./client";
import {getLocale,uiText} from "@/lib/i18n";

export interface ClassroomNote {
  node_id: string;
  title: string;
  markdown: string;
  revision: number;
  updated_at: string | null;
}
export interface NoteOutline {markdown: string; ai_generated: true; lesson_revision: number | null; limited_scope: boolean}
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),method==="POST"?100_000:20_000);
  try {
    const response=await fetch(`${API_BASE}/notes/classroom/${path}`,{
      ...buildSecureRequestInit({method,...(body===undefined?{}:{body:JSON.stringify(body)})}),signal:controller.signal,
    });
    if (!response.ok) throw await parseApiError(response);
    return await response.json();
  } catch(error) {
    if((error as Error).name==="AbortError")throw new Error(uiText("Notebook request timed out. Your input is preserved."));
    if(error instanceof TypeError)throw new Error(uiText("Cannot connect to the local service. Check that the app is running."));
    throw error;
  } finally {clearTimeout(timer);}
}
export const loadClassroomNote=(courseId:string,nodeId:string)=>request<ClassroomNote>(`${courseId}/${nodeId}`);
export const listClassroomNotes=(courseId:string)=>request<ClassroomNote[]>(courseId);
export const saveClassroomNote=(courseId:string,nodeId:string,markdown:string,revision:number,saveId:string)=>
  request<ClassroomNote>(`${courseId}/${nodeId}`,"PUT",{markdown,revision,save_id:saveId});
export const outlineClassroomNote=(courseId:string,nodeId:string,markdown:string)=>
  request<NoteOutline>(`${courseId}/${nodeId}/outline`,"POST",{markdown,locale:getLocale()});
