import {uiText} from '@/lib/i18n';
import {API_BASE,buildSecureRequestInit,parseApiError} from './client';
export interface ObsidianConfig {vault_path:string;folder:string}
export interface ObsidianFile {path:string;uri:string;markdown:string;file_hash:string|null;exists:boolean;revision:number;external_changed:boolean}
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 try {const res=await fetch(`${API_BASE}/notes/obsidian/${path}`,{...buildSecureRequestInit({method,...(body===undefined?{}:{body:JSON.stringify(body)})}),signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw await parseApiError(res);return res.json();}catch(error){if(error instanceof TypeError||(error as Error).name==="TimeoutError")throw new Error(uiText("Obsidian request failed. Check that the local service is running."));throw error;}
}
export const getObsidianConfig=()=>request<ObsidianConfig>('settings');
export const setObsidianConfig=(vault_path:string)=>request<ObsidianConfig>('settings','PUT',{vault_path});
export const inspectObsidianNote=(course:string,node:string)=>request<ObsidianFile>(`${course}/${node}`);
export const exportObsidianNote=(course:string,node:string,revision:number)=>request<ObsidianFile>(`${course}/${node}/export`,'POST',{revision});
export const importObsidianNote=(course:string,node:string,revision:number,file_hash:string)=>request(`${course}/${node}/import`,'POST',{revision,file_hash});
