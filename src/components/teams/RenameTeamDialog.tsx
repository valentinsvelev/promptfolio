import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button, Modal } from '../ui';

export function RenameTeamDialog({team,onClose,onSave}:{team:{id:string;name:string};onClose:()=>void;onSave:(name:string)=>Promise<boolean>}){
  const [name,setName]=useState(team.name);
  const [saving,setSaving]=useState(false);
  const candidate=name.trim();
  async function submit(e:FormEvent){
    e.preventDefault();
    if(candidate.length<2||candidate.length>80||candidate===team.name)return;
    setSaving(true);
    try{if(await onSave(candidate))onClose();}finally{setSaving(false);}
  }
  return <Modal onClose={()=>{if(!saving)onClose()}}>
    <form className="rename-team-dialog" onSubmit={submit}>
      <div className="modal-header"><div><h2>Rename team</h2><p>Update the name shown throughout Promptfolio. Existing prompts and memberships stay unchanged.</p></div><button type="button" className="round-icon pf-icon-tooltip" aria-label="Close rename team dialog" onClick={onClose} disabled={saving}><X size={19}/></button></div>
      <div className="rename-team-body"><label className="field">Team name<input autoFocus required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label></div>
      <div className="modal-footer"><div><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving||candidate.length<2||candidate.length>80||candidate===team.name}>{saving?'Renaming…':'Save name'}</Button></div></div>
    </form>
  </Modal>;
}
