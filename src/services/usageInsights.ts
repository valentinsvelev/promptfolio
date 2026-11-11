import {client,demoIdentity,isDemo,loadData} from './api';
import {type UsageAction,type UsageSample} from '../utils/usageStats';
import {summarizeMyImpact,type PromptImpact} from '../utils/promptImpact';
export type {UsageAction} from '../utils/usageStats';
export type {PromptImpact} from '../utils/promptImpact';

const demoKey='promptfolio:usage-demo-v1';
function readEvents():UsageSample[]{
  try{const value=JSON.parse(localStorage.getItem(demoKey)||'[]') as unknown;return Array.isArray(value)?value as UsageSample[]:[];}
  catch{return [];}
}
const number=(v:unknown)=>typeof v==='number'?v:Number(v)||0;
function asImpact(row:Record<string,unknown>|null|undefined):PromptImpact {
  return {
    prompts_total:number(row?.prompts_total),prompts_created:number(row?.prompts_created),
    prompts_contributed:number(row?.prompts_contributed),
    opens:number(row?.opens),copies:number(row?.copies),combines:number(row?.combines),
    unique_users:number(row?.unique_users),last_used:typeof row?.last_used==='string'?row.last_used:null,
  };
}
export async function recordPromptUsage(promptId:string,action:UsageAction):Promise<void> {
  if(isDemo){
    const events=readEvents(),at=new Date().toISOString();
    const gap=action==='open'?10000:2000;
    const recent=events.some(e=>e.prompt_id===promptId&&e.actor_id===demoIdentity.id&&e.event_type===action&&
      Date.now()-new Date(e.occurred_at).getTime()<gap);
    if(!recent){events.push({prompt_id:promptId,actor_id:demoIdentity.id,event_type:action,occurred_at:at});
      localStorage.setItem(demoKey,JSON.stringify(events.slice(-5000)));}
    return;
  }
  const {error}=await client!.rpc('record_prompt_usage',{pid:promptId,usage_action:action});
  if(error)throw new Error(error.message);
}
export async function loadMyPromptImpact(includeSelf:boolean,days:number):Promise<PromptImpact> {
  if(isDemo){
    const data=await loadData();
    return summarizeMyImpact(readEvents(),data.prompts,data.versions,data.proposals,demoIdentity.id,includeSelf,days);
  }
  const {data,error}=await client!.rpc('get_my_prompt_impact',{include_self:includeSelf,days});
  if(error)throw new Error(error.message);
  return asImpact(data as Record<string,unknown>|null);
}
