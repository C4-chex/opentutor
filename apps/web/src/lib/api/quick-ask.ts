import {API_BASE,buildSecureRequestInit,parseApiError} from './client';
import {getLocale,uiText} from '@/lib/i18n';
export interface AskScope {course_id?:string;node_id?:string}
export interface QuickMessage {id:string;role:'user'|'assistant';content:string;excerpt?:string;request_id?:string;sources?:{node_id:string;title:string;url:string|null}[];limited_scope?:boolean;context_used?:boolean;provider?:string;created_at:string}
export interface QuickConversation {title:string;revision:number;messages:QuickMessage[];history_limit:number;earlier_cursor?:number;generation?:string|null}
export interface Question extends AskScope {message:string;excerpt:string;include_context:boolean;revision:number;request_id:string}
async function request<T>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
 const deadline=AbortSignal.timeout(90000);
 try{
  const response=await fetch(`${API_BASE}/quick-ask${path}`,{...buildSecureRequestInit({method,...(body===undefined?{}:{body:JSON.stringify(body)})}),signal:signal?AbortSignal.any([signal,deadline]):deadline});
  if(!response.ok)throw await parseApiError(response);return await response.json();
 }catch(error){
  if((error as Error).name==='TimeoutError')throw new Error(uiText('The assistant timed out. Your question is kept; retry to recover the result.'));
  if(error instanceof TypeError)throw new Error(uiText('Cannot connect to the local service. Check that the app is running.'));
  throw error;
 }
}
export const loadQuickConversation=(scope:AskScope)=>request<QuickConversation>('?'+new URLSearchParams(scope as Record<string,string>));
export const sendQuickQuestion=(question:Question,signal:AbortSignal)=>request<QuickConversation>('','POST',{...question,locale:getLocale()},signal);
export const resetQuickConversation=(scope:AskScope,revision:number)=>request<QuickConversation>('/reset','POST',{...scope,revision});
export const reportQuickAnswer=(scope:AskScope,message_id:string,report_id:string,kind:string,note:string)=>request('/report','POST',{...scope,message_id,report_id,kind,note});

export const loadEarlierQuickMessages=(scope:AskScope,before:number,generation:string)=>request<{messages:QuickMessage[];next_cursor:number}>('/history?'+new URLSearchParams({...scope,before:String(before),generation}));
