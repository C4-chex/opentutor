"use client";

import {createContext,useContext} from "react";
export type ExcerptOrigin="ai"|"classroom";
export interface NotebookActions {
  capture:(markdown:string)=>void;
  annotate:(markdown:string,origin?:ExcerptOrigin)=>void;
}
export const NotebookContext=createContext<NotebookActions|null>(null);
export const useClassroomNotebook=()=>useContext(NotebookContext);
