import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { AppData, Prompt, PromptBody } from '../../types';
import { Button, Modal } from '../ui';
import { Flag } from '../ui/LibraryPrimitives';
import { labelize } from '../../utils/prompt';
export function CompareVersions({data,comparison,onClose,onRestore,note,setNote}:{data:AppData;comparison:{prompt:Prompt;versionId:string};onClose:()=>void;onRestore:(id:string)=>Promise<void>;note:string;setNote:(note:string)=>void}){
  const versions=data.versions.filter(v=>v.prompt_id===comparison.prompt.id).sort((a,b)=>b.version_number-a.version_number);
  const [left,setLeft]=useState(comparison.prompt.official_version_id||versions[0]?.id||'');
  const [right,setRight]=useState(comparison.versionId);
  const a=versions.find(v=>v.id===left),b=versions.find(v=>v.id===right);
  const fields:(keyof PromptBody)[]=['title','description','content','category','tags','usage_instructions','example_inputs','expected_outputs','compatible_models'];
  return <Modal wide onClose={onClose}><div className="confirm-modal"><div className="modal-header"><div><h2>Compare and restore</h2><p>For team prompts, restoring an old version creates a suggestion for manager review. Personal prompts can be restored directly.</p></div><button className="round-icon" onClick={onClose}><X size={18}/></button></div><div className="field-grid"><label className="field">Base version<select value={left} onChange={e=>setLeft(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>v{v.version_number} · {v.approval_status}</option>)}</select></label><label className="field">Compare version<select value={right} onChange={e=>setRight(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>v{v.version_number} · {v.approval_status}</option>)}</select></label></div><div className="version-diff">{fields.map(k=>{const one=Array.isArray(a?.[k])?(a?.[k] as string[]).join(', '):String(a?.[k]||'');const two=Array.isArray(b?.[k])?(b?.[k] as string[]).join(', '):String(b?.[k]||'');return <div key={k}><strong>{labelize(k)} {one!==two&&<Flag tone="amber">Changed</Flag>}</strong><div className="compare-grid"><pre>{one||'—'}</pre><pre>{two||'—'}</pre></div></div>})}</div><label className="field">Restoration note<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason for restoring this version"/></label><div className="confirm-actions"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={()=>onRestore(right)}><RotateCcw size={15}/> {comparison.prompt.owner_team_id?'Suggest restoration':'Restore selected version'}</Button></div></div></Modal>;
}
