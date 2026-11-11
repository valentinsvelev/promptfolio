import type {Prompt,PromptVersion,Proposal} from '../types';
import {type UsageSample,type UsageSummary,blankUsage} from './usageStats';

export type PromptImpact = UsageSummary & {
  prompts_total:number;
  prompts_created:number;
  prompts_contributed:number;
};
export const blankImpact=():PromptImpact=>({...blankUsage(),prompts_total:0,prompts_created:0,prompts_contributed:0});

// Demo data uses the same definition as the SQL RPC: creation, authorship of
// at least one version, or an accepted improvement proposal. A prompt only
// appears once, no matter how often the person has contributed to it.
export function summarizeMyImpact(
  events:UsageSample[],prompts:Prompt[],versions:PromptVersion[],proposals:Proposal[],
  userId:string,includeSelf:boolean,days:number,now=Date.now()
):PromptImpact {
  const result=blankImpact();
  const authoredIds=new Set(versions.filter(v=>v.author_id===userId).map(v=>v.prompt_id));
  const acceptedIds=new Set(proposals.filter(p=>p.author_id===userId&&p.status==='accepted').map(p=>p.prompt_id));
  const eligible=new Set<string>();
  for(const p of prompts){
    if(p.deleted_at||!(p.created_by===userId||authoredIds.has(p.id)||acceptedIds.has(p.id)))continue;
    eligible.add(p.id);
    if(p.created_by===userId)result.prompts_created++;
    else result.prompts_contributed++;
  }
  result.prompts_total=eligible.size;
  const people=new Set<string>();
  const since=now-days*86400000;
  for(const e of events){
    const time=new Date(e.occurred_at).getTime();
    if(!eligible.has(e.prompt_id)||!Number.isFinite(time)||time<since||time>now||(!includeSelf&&e.actor_id===userId))continue;
    if(e.event_type==='open')result.opens++;
    else if(e.event_type==='copy')result.copies++;
    else if(e.event_type==='combine')result.combines++;
    else continue;
    people.add(e.actor_id);
    if(result.last_used===null||e.occurred_at>result.last_used)result.last_used=e.occurred_at;
  }
  result.unique_users=people.size;
  return result;
}
