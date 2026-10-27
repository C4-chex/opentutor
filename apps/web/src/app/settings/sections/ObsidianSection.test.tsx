import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ObsidianSection} from './ObsidianSection';
import {getObsidianConfig,setObsidianConfig} from '@/lib/api/obsidian';
import {setLocale} from '@/lib/i18n';
vi.mock('@/lib/api/obsidian',()=>({getObsidianConfig:vi.fn(),setObsidianConfig:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();setLocale('zh');vi.mocked(getObsidianConfig).mockResolvedValue({vault_path:'',folder:'OpenTutor'});vi.mocked(setObsidianConfig).mockImplementation(async vault_path=>({vault_path,folder:'OpenTutor'}));});afterEach(cleanup);
it('configures a local path and disconnects without deleting files',async()=>{
 await act(async()=>{render(<ObsidianSection/>);});
 fireEvent.change(screen.getByLabelText('笔记库文件夹完整路径'),{target:{value:'D:\\Notes\\Vault'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'保存笔记库连接'}));});expect(setObsidianConfig).toHaveBeenCalledWith('D:\\Notes\\Vault');
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'断开连接'}));});expect(setObsidianConfig).toHaveBeenLastCalledWith('');expect(screen.getByRole('status')).toHaveTextContent('已有笔记文件仍然保留');
});
it('keeps typed path after a failed connection',async()=>{
 vi.mocked(setObsidianConfig).mockRejectedValue(new Error('目录不可访问'));await act(async()=>{render(<ObsidianSection/>);});
 fireEvent.change(screen.getByLabelText('笔记库文件夹完整路径'),{target:{value:'D:\\Missing'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'保存笔记库连接'}));});expect(screen.getByRole('alert')).toHaveTextContent('目录不可访问');expect(screen.getByLabelText('笔记库文件夹完整路径')).toHaveValue('D:\\Missing');
});
