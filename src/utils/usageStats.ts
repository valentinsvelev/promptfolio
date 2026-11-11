// Aggregate-only outputs. In production this aggregation runs on Postgres;
// the same semantics are used for demo-mode data and standalone tests.
export type UsageAction='open'|'copy'|'combine';
export type UsageSample={prompt_id:string;actor_id:string;event_type:UsageAction;occurred_at:string};
export type UsageSummary={opens:number;copies:number;combines:number;unique_users:number;last_used:string|null};
export type UsageTopPrompt={prompt_id:string;title:string;opens:number;copies:number;combines:number};
export type TeamUsageSummary={summary:Omit<UsageSummary,'last_used'>;top_prompts:UsageTopPrompt[];not_copied:number};
export const blankUsage=():UsageSummary=>({opens:0,copies:0,combines:0,unique_users:0,last_used:null});
export function summarizeUsage(events:UsageSample[],creatorId:string,includeCreator:boolean,days:number,now=Date.now()):UsageSummary {
  const since=now-days*86400000, result=blankUsage(), people=new Set<string>();
  for(const e of events){
    const time=new Date(e.occurred_at).getTime();
    if(!Number.isFinite(time)||time<since||time>now||(!includeCreator&&e.actor_id===creatorId))continue;
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
export function summarizeTeamUsage(
  events:UsageSample[],prompts:{id:string;created_by:string;title:string}[],includeCreator:boolean,days:number,now=Date.now()
):TeamUsageSummary {
  const filtered=events.filter(e=>prompts.some(p=>p.id===e.prompt_id&&(
    includeCreator||p.created_by!==e.actor_id)) && new Date(e.occurred_at).getTime()>=now-days*86400000 &&
    new Date(e.occurred_at).getTime()<=now && ['open','copy','combine'].includes(e.event_type));
  const users=new Set(filtered.map(x=>x.actor_id));
  const top_prompts=prompts.map(p=>{
    const own=filtered.filter(e=>e.prompt_id===p.id);
    return {prompt_id:p.id,title:p.title,opens:own.filter(e=>e.event_type==='open').length,
      copies:own.filter(e=>e.event_type==='copy').length,combines:own.filter(e=>e.event_type==='combine').length};
  }).sort((a,b)=>b.copies-a.copies||b.opens-a.opens||a.title.localeCompare(b.title));
  return {summary:{opens:filtered.filter(e=>e.event_type==='open').length,copies:filtered.filter(e=>e.event_type==='copy').length,
    combines:filtered.filter(e=>e.event_type==='combine').length,unique_users:users.size},
    top_prompts:top_prompts.slice(0,5),not_copied:top_prompts.filter(p=>p.copies===0).length};
}
