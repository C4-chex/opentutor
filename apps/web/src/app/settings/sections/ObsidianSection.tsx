"use client";
import {useEffect,useState} from 'react';
import {useUiText} from '@/hooks/use-ui-text';
import {getObsidianConfig,setObsidianConfig} from '@/lib/api/obsidian';
export function ObsidianSection(){
 const ui=useUiText();const [path,setPath]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 useEffect(()=>{let live=true;getObsidianConfig().then(c=>{if(live)setPath(c.vault_path);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 async function save(value:string){setBusy(true);setError('');setMessage('');try{const c=await setObsidianConfig(value);setPath(c.vault_path);setMessage(ui(value?'Vault connected. Open classroom notes to sync a chapter.':'Vault disconnected. Existing files are kept.'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section id="obsidian" className="rounded-2xl border border-border bg-card p-5 space-y-3">
  <h2 className="font-semibold">{ui('Obsidian notebook')}</h2>
  <p className="text-sm text-muted-foreground">{ui('Connect an existing local vault. Notes go into its OpenTutor folder; no plugin or API key is needed.')}</p>
  <label className="block text-sm">{ui('Vault folder path')}<input value={path} onChange={e=>setPath(e.target.value)} disabled={loading||busy} placeholder={'D:\\Notes\\MyVault'} className="mt-2 w-full rounded-lg border border-border bg-background p-3"/></label>
  <p className="text-xs text-muted-foreground">{ui('In Obsidian, open your vault folder in File Explorer and copy its full path. The folder must already contain .obsidian.')}</p>
  <div className="flex gap-3 text-sm"><button type="button" disabled={loading||busy||!path.trim()} onClick={()=>void save(path)} className="rounded-lg bg-brand px-4 py-2 text-brand-foreground disabled:opacity-50">{ui(busy?'Connecting...':'Save vault connection')}</button><button type="button" disabled={loading||busy} onClick={()=>void save('')} className="underline disabled:opacity-50">{ui('Disconnect vault')}</button></div>
  <p className="text-xs text-muted-foreground">{ui('Sync is manual. External edits require a preview before importing. Disconnecting never deletes notes.')}</p>
  {message&&<p role="status" className="text-sm text-brand">{message}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </section>;
}
