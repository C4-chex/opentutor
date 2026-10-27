import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {QuickAssistant} from './quick-assistant';
import {setLocale} from '@/lib/i18n';
let path='/';
vi.mock('next/navigation',()=>({usePathname:()=>path}));
vi.mock('next/dynamic',()=>({default:()=>function Agent(){return <p>legacy course agent</p>;}}));
vi.mock('@/lib/api',()=>({getHealthStatus:vi.fn(async()=>({llm_status:'ready'}))}));
vi.mock('./quick-ask-panel',()=>({QuickAskPanel:({scope,excerpt}:{scope:{node_id?:string};excerpt:string})=><p data-testid="quick-content">{scope.node_id||'general'} {excerpt}</p>}));
beforeEach(()=>{path='/';setLocale('zh');});afterEach(cleanup);
it('offers one small assistant on the home page and can minimize it',async()=>{
 render(<QuickAssistant/>);expect(screen.queryByRole('region',{name:'随问助手面板'})).not.toBeInTheDocument();
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'打开随问助手'}));});expect(screen.getByTestId('quick-content')).toHaveTextContent('general');
 fireEvent.click(screen.getAllByRole('button',{name:'收起随问助手'})[0]);expect(screen.queryByRole('region',{name:'随问助手面板'})).not.toBeInTheDocument();
});
it('passes the current chapter context and keeps the original course agent available',async()=>{
 path='/course/1234/unit/5678';render(<QuickAssistant/>);await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'打开随问助手'}));});expect(screen.getByTestId('quick-content')).toHaveTextContent('5678');
 fireEvent.click(screen.getByRole('button',{name:'课程 Agent'}));expect(screen.getByText('legacy course agent')).toBeInTheDocument();
});
it('accepts a selected code excerpt without automatically sending it',async()=>{
 path='/course/1234/unit/5678';render(<QuickAssistant/>);await act(async()=>{window.dispatchEvent(new CustomEvent('opentutor:ask-selection',{detail:{courseId:'1234',nodeId:'5678',markdown:'int x = 1;'}}));});
 expect(screen.getByTestId('quick-content')).toHaveTextContent('int x = 1;');
});
