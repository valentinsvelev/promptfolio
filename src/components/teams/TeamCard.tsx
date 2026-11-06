import { useState } from 'react';
import { Pencil, Plus, Users, X } from 'lucide-react';
import type { AppData, Member, Prompt, PromptVersion } from '../../types';
import { Button } from '../ui';
import { Avatar, Flag } from '../ui/LibraryPrimitives';
export function TeamCard({team,members,profiles,prompts,versions,manager,onRename,onMember}:{team:{id:string;name:string;description:string};members:Member[];profiles:AppData['profiles'];prompts:Prompt[];versions:PromptVersion[];manager:boolean;onRename:()=>void;onMember:(email:string,action:'add'|'remove')=>Promise<void>}){
  const [open,setOpen]=useState(false);const [email,setEmail]=useState('');
  const published=prompts.filter(p=>p.lifecycle==='published').length;
  const drafts=prompts.filter(p=>p.lifecycle==='draft').length;
  const approved=prompts.filter(p=>versions.some(v=>v.id===p.official_version_id&&v.approval_status==='approved')).length;
  const categoryCounts=new Map<string,number>();
  for(const p of prompts){const v=versions.find(v=>v.id===p.official_version_id)||versions.find(v=>v.id===p.latest_version_id);const category=v?.category||'General';categoryCounts.set(category,(categoryCounts.get(category)||0)+1)}
  const categoriesByCount=[...categoryCounts.entries()].sort((a,b)=>b[1]-a[1]);
  return <section className="team-card"><div className="team-card-header"><div className="team-icon"><Users size={21}/></div><div><div className="team-name-row"><h3>{team.name}</h3>{manager&&<button type="button" className="team-rename-trigger" aria-label={`Rename ${team.name}`} title="Rename team" onClick={onRename}><Pencil size={15}/></button>}</div><p>{team.description}</p></div><Flag>{members.length} members</Flag></div>
  <div className="team-stats" aria-label={`${team.name} prompt statistics`}><div><strong>{prompts.length}</strong><span>Prompts</span></div><div><strong>{published}</strong><span>Published</span></div><div><strong>{drafts}</strong><span>Drafts</span></div><div><strong>{approved}</strong><span>Approved</span></div></div>
  <div className="team-category-section"><div className="team-section-title">Prompts by category</div>{categoriesByCount.length?<div className="team-categories">{categoriesByCount.map(([category,count])=><div className="team-category" key={category}><div className="team-category-label"><span>{category}</span><strong>{count}</strong></div><div className="team-category-track"><span style={{width:`${count/Math.max(prompts.length,1)*100}%`}}/></div></div>)}</div>:<p className="team-no-prompts">No prompts in this team yet.</p>}</div>
  <div className="team-section-title team-members-title">Members</div><div className="team-members">{members.map(m=>{const profile=profiles.find(p=>p.id===m.user_id);return <div className="member" key={m.user_id}><Avatar name={profile?.display_name||'Member'} small/><span><strong>{profile?.display_name||'Member'}</strong><small>{profile?.email||''}</small></span>{m.role==='manager'&&<Flag tone="violet">Manager</Flag>}{manager&&m.role!=='manager'&&<button title="Remove member" className="member-remove" onClick={()=>onMember(profile?.email||'','remove')}><X size={15}/></button>}</div>})}</div>{manager&&<><button className="add-member-toggle" onClick={()=>setOpen(s=>!s)}><Plus size={17}/> Add a team member</button>{open&&<form className="inline-form" onSubmit={async e=>{e.preventDefault();await onMember(email,'add');setEmail('');setOpen(false)}}><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="colleague@company.com"/><Button type="submit">Add member</Button></form>}</>}</section>;
}
