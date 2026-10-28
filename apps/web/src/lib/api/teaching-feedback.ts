import { API_BASE, buildSecureRequestInit, parseApiError } from "./client";

export type FeedbackKind = "explanation" | "grading" | "question" | "source" | "other";
export interface TeachingReport {
  report_id:string;
  revision:number;
  kind:FeedbackKind;
  note:string;
  status:"recorded";
  created_at:string;
}
async function feedbackRequest<T>(courseId:string, nodeId:string, body?:unknown):Promise<T> {
  const response=await fetch(`${API_BASE}/guided-learning/${courseId}/${nodeId}/reports`, {
    ...buildSecureRequestInit(body ? {method:"POST",body:JSON.stringify(body)} : {method:"GET"}),
    cache:"no-store",signal:AbortSignal.timeout(20_000),
  });
  if(!response.ok)throw await parseApiError(response);
  return response.json();
}
export const loadTeachingReports=(courseId:string,nodeId:string)=>feedbackRequest<TeachingReport[]>(courseId,nodeId);
export const saveTeachingReport=(courseId:string,nodeId:string,body:{report_id:string;revision:number;kind:FeedbackKind;note:string})=>
  feedbackRequest<TeachingReport>(courseId,nodeId,body);
