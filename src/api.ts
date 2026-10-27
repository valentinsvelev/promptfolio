import { createClient } from '@supabase/supabase-js';
import type { AppData, Identity, Prompt, PromptBody, PromptVersion, Proposal } from './types';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isDemo = !url || !key;
export const client = !isDemo ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export const demoIdentity: Identity = { id: '20000000-0000-4000-8000-000000000001', email: 'alex@example.com' };
const colleagueId = '20000000-0000-4000-8000-000000000002';
const operationsId = '10000000-0000-4000-8000-000000000001';
const strategyId = '10000000-0000-4000-8000-000000000002';
const keyDemo = 'promptfolio-react-demo-v3';
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function createDemo(): AppData {
  const items: Array<[string, string, string, string, string, string, string]> = [
    ['Turn meeting notes into action items', 'Transform scattered notes into decisions, owners and deadlines.', 'Writing', 'Operations', 'meetings', 'You are a focused meeting assistant. Analyse the following notes:\n\n{{meeting_notes}}\n\nReturn:\n1. A short summary\n2. Decisions made\n3. Action items with owners and due dates\n4. Open questions', operationsId],
    ['Explore a market opportunity', 'A structured first-pass market assessment for a new idea.', 'Research', 'Strategy', 'market-research', 'Evaluate {{market}} for {{company}}. Cover market size, audience segments, competitive landscape, key risks, and recommended next steps. Make assumptions explicit.', strategyId],
    ['Write clearer customer emails', 'Draft thoughtful replies that resolve customer requests.', 'Writing', 'Operations', 'communication', 'Reply to the following customer message:\n\n{{customer_message}}\n\nTone: {{tone}}\n\nBe concise, specific, friendly and action-oriented.', operationsId],
    ['Analyse survey responses', 'Turn raw answers into useful patterns and themes.', 'Analysis', 'Strategy', 'insights', 'Review the anonymised survey responses:\n\n{{responses}}\n\nIdentify recurring themes, supporting quotes, gaps in the data and recommendations.', strategyId],
    ['Plan a productive workshop', 'Create a practical agenda with clear outcomes.', 'Productivity', 'Operations', 'planning', 'Create a {{duration}}-minute workshop agenda about {{topic}} for {{audience}}. Include exercises, timings and measurable outcomes.', operationsId],
  ];
  const createdAt = now();
  const prompts: Prompt[] = [];
  const versions: PromptVersion[] = [];
  items.forEach(([title, description, category, , tag, content, teamId], index) => {
    const id = `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    const vid = `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    prompts.push({id, owner_user_id:null,owner_team_id:teamId,created_by: index % 2 ? colleagueId : demoIdentity.id,lifecycle:'published',official_version_id:vid,latest_version_id:vid,created_at:createdAt,updated_at:createdAt,deleted_at:null});
    versions.push({id:vid,prompt_id:id,version_number:1,title,description,category,content,tags:[tag],usage_instructions:'Fill in the template fields, then copy your finished prompt.',example_inputs:'',expected_outputs:'',compatible_models:['ChatGPT','Claude'],approval_status:'approved',decision:'',decision_reason:'',change_note:'First approved version',author_id:index % 2 ? colleagueId : demoIdentity.id,created_at:createdAt});
  });
  return {
    prompts, versions,
    teams:[{id:operationsId,name:'Operations',description:'Team processes, planning and daily operations.'},{id:strategyId,name:'Strategy',description:'Research, planning and strategic decisions.'}],
    members:[{team_id:operationsId,user_id:demoIdentity.id,role:'manager'},{team_id:strategyId,user_id:colleagueId,role:'manager'}],
    profiles:[{id:demoIdentity.id,email:demoIdentity.email,display_name:'Alex Morgan'},{id:colleagueId,email:'sam@example.com',display_name:'Sam Taylor'}],
    favorites:[],proposals:[],notifications:[],admins:[{user_id:demoIdentity.id}],audit:[],
    categories:['Writing','Research','Analysis','Engineering','Marketing','Productivity','General'].map(name=>({name})),
    recommendations:[],settings:[{id:true,retention_days:30,temporary_password_hours:48}],account_controls:[],
  };
}
function readDemo(): AppData { try { const s = localStorage.getItem(keyDemo); return s ? JSON.parse(s) as AppData : createDemo(); } catch { return createDemo(); } }
function saveDemo(data: AppData) { localStorage.setItem(keyDemo, JSON.stringify(data)); }

export async function identity(): Promise<Identity | null> {
  if(isDemo) return demoIdentity;
  const { data, error } = await client!.auth.getUser();
  if (error || !data.user) return null;
  return {id:data.user.id,email:data.user.email || ''};
}

export async function loadData(): Promise<AppData> {
  if(isDemo) return readDemo();
  const mappings = [
    ['prompts','prompts'], ['versions','prompt_versions'],['teams','teams'],['members','team_members'],
    ['profiles','profiles'],['favorites','favorites'],['proposals','improvement_proposals'],
    ['notifications','notifications'],['admins','app_admins'],['audit','audit_events'],
    ['categories','prompt_categories'],['recommendations','team_recommendations'],
    ['settings','app_settings'],['account_controls','account_controls'],
  ] as const;
  // Read every accessible page rather than silently dropping anything after row 1000.
  const result = await Promise.all(mappings.map(async ([alias, table]) => {
    const all: Record<string, unknown>[] = [];
    const pageSize = 500;
    for(let start=0;start<100000;start+=pageSize) {
      const { data, error } = await client!.from(table).select('*').range(start,start+pageSize-1);
      if(error) throw new Error(`${table}: ${error.message}`);
      all.push(...(data || []));
      if(!data || data.length < pageSize) break;
    }
    return [alias, all] as const;
  }));
  return Object.fromEntries(result) as AppData;
}

export async function execute(name: string, args: Record<string, unknown>): Promise<unknown> {
  if(!isDemo) {
    const { data, error } = await client!.rpc(name, args);
    if(error) throw error;
    return data;
  }
  const d = readDemo();
  const currentId = demoIdentity.id;
  const p = (id: unknown) => d.prompts.find(p => p.id === id);
  const manager = (teamId: string | null) => d.members.some(m=>m.team_id===teamId && m.user_id===currentId && m.role==='manager');
  const member = (teamId: string | null) => d.members.some(m=>m.team_id===teamId && m.user_id===currentId);
  const canEdit = (prompt: Prompt | undefined) => prompt && (prompt.owner_user_id===currentId || member(prompt.owner_team_id));
  const addVersion = (promptId: string, body: PromptBody, status: PromptVersion['approval_status'], note: string) => {
    const no = 1 + Math.max(0, ...d.versions.filter(v=>v.prompt_id===promptId).map(v=>v.version_number));
    const v:PromptVersion = {id:uuid(),prompt_id:promptId,version_number:no,...body,approval_status:status,decision:'',decision_reason:'',change_note:note,author_id:currentId,created_at:now()};
    d.versions.push(v);
    return v;
  };
  let result: unknown = null;
  if(name==='create_prompt') {
    const teamId = args.team_id as string | null;
    if(teamId && !member(teamId)) throw Error('You cannot save to another team.');
    const record:Prompt = {id:uuid(),owner_user_id:teamId?null:currentId,owner_team_id:teamId||null,created_by:currentId,lifecycle:args.publish?'published':'draft',official_version_id:null,latest_version_id:null,created_at:now(),updated_at:now(),deleted_at:null};
    d.prompts.push(record);
    const v=addVersion(record.id,args.payload as PromptBody,'experimental','Initial version');
    record.official_version_id=record.latest_version_id=v.id;
    result=record.id;
  } else if(name==='save_prompt_version') {
    const prompt = p(args.pid);
    if(!canEdit(prompt) || prompt?.owner_team_id) throw Error('Team prompt changes must be suggested and approved by the owning team manager.');
    const official = d.versions.find(v=>v.id===prompt!.official_version_id);
    const v=addVersion(prompt!.id,args.payload as PromptBody,official?.approval_status==='approved'?'under_review':'experimental',String(args.note||''));
    prompt!.latest_version_id=v.id;
    prompt!.updated_at=now();
    // Experimental prompts can show the latest; approved prompts retain the official pointer.
    if(official?.approval_status!=='approved') prompt!.official_version_id=v.id;
    result=v.id;
  } else if(name==='request_version_review') {
    const v=d.versions.find(v=>v.id===args.vid);
    if(!v || v.approval_status!=='experimental') throw Error('This version cannot be reviewed.');
    const prompt=p(v.prompt_id);
    if(!prompt?.owner_team_id || !member(prompt.owner_team_id)) throw Error('Team membership required.');
    v.approval_status='under_review';
  } else if(name==='review_prompt_version') {
    const v=d.versions.find(v=>v.id===args.vid);
    const prompt=v && p(v.prompt_id);
    if(!v || !prompt || !manager(prompt.owner_team_id)) throw Error('Only the owning manager can review.');
    if(args.approve) { v.approval_status='approved';prompt.official_version_id=v.id; }
    else { v.approval_status='deprecated';v.decision='rejected';v.decision_reason=String(args.reason||''); }
  } else if(name==='propose_improvement') {
    const prompt=p(args.pid);
    if(!prompt || !prompt.owner_team_id || prompt.deleted_at || prompt.lifecycle==='archived' || (!member(prompt.owner_team_id) && (prompt.lifecycle!=='published' || !d.members.some(m=>m.user_id===currentId)))) throw Error('You need access to this team prompt to suggest a change.');
    const proposal:Proposal={id:uuid(),prompt_id:prompt.id,author_id:currentId,proposed_content:args.payload as PromptBody,rationale:String(args.explanation||''),status:'open',created_at:now()};
    d.proposals.push(proposal);result=proposal.id;
  } else if(name==='review_improvement_proposal') {
    const proposal=d.proposals.find(p=>p.id===args.proposal_id);
    const prompt=proposal&&p(proposal.prompt_id);
    if(!proposal || !prompt || !manager(prompt.owner_team_id)) throw Error('Only the owning manager can review.');
    proposal.status=args.accept?'accepted':'rejected';proposal.decision_reason=String(args.reason||'');
    if(args.accept) { const v=addVersion(prompt.id,proposal.proposed_content,'under_review','Accepted improvement proposal');prompt.latest_version_id=v.id;result=v.id; }
  } else if(name==='copy_prompt' || name==='share_personal_prompt') {
    const prompt=p(args.pid); if(!prompt) throw Error('Prompt not found.');
    const source = d.versions.find(v=>v.id===prompt.official_version_id);
    if(!source) throw Error('Version not found.');
    const teamId = (name==='share_personal_prompt'?args.target_team_id:args.target_team_id||null) as string|null;
    if(teamId && !member(teamId)) throw Error('Not a member of this team.');
    const copy: Prompt = {id:uuid(),owner_user_id:teamId?null:currentId,owner_team_id:teamId||null,created_by:currentId,lifecycle:name==='share_personal_prompt'?'published':'draft',official_version_id:null,latest_version_id:null,source_prompt_id:prompt.id,created_at:now(),updated_at:now(),deleted_at:null};
    d.prompts.push(copy);
    const v=addVersion(copy.id,{title:source.title,description:source.description,content:source.content,category:source.category,tags:source.tags,usage_instructions:source.usage_instructions,example_inputs:source.example_inputs,expected_outputs:source.expected_outputs,compatible_models:source.compatible_models},'experimental','Copied from another prompt');
    copy.official_version_id=copy.latest_version_id=v.id;
    result=copy.id;
  } else if(name==='set_prompt_lifecycle') {
    const prompt=p(args.pid);
    if(!canEdit(prompt)) throw Error('Permission denied.');
    prompt!.lifecycle=args.new_status as Prompt['lifecycle'];
  } else if(name==='soft_delete_prompt') {
    const prompt=p(args.pid);
    if(!canEdit(prompt)) throw Error('Permission denied.');
    prompt!.deleted_at=args.recover?null:now();
  } else if(name==='create_category') {
    const nameValue=String(args.category_name||'').trim();
    if(nameValue.length<2) throw Error('Category must be at least 2 characters.');
    if(!d.categories.some(c=>c.name.toLowerCase()===nameValue.toLowerCase()))d.categories.push({name:nameValue});
  } else if(name==='mark_notification_read') {
    d.notifications=d.notifications.map(n=>n.recipient_id===currentId&&(!args.nid||args.nid===n.id)?{...n,read_at:now()}:n);
  } else if(name==='set_proposal_under_review') {
    const proposal=d.proposals.find(p=>p.id===args.proposal_id);const source=proposal&&p(proposal.prompt_id);
    if(!proposal||proposal.status!=='open'||!manager(source?.owner_team_id||null))throw Error('Manager review required');
    proposal.status='under_review';
  } else if(name==='restore_prompt_version') {
    const prompt=p(args.pid);const source=d.versions.find(v=>v.id===args.source_version_id&&v.prompt_id===prompt?.id);
    if(!canEdit(prompt)||!source||prompt?.owner_team_id)throw Error('Team version restorations require a manager-reviewed suggestion.');
    const approved=d.versions.find(v=>v.id===prompt!.official_version_id)?.approval_status==='approved';
    const payload:PromptBody={title:source.title,description:source.description,content:source.content,category:source.category,tags:source.tags,usage_instructions:source.usage_instructions,example_inputs:source.example_inputs,expected_outputs:source.expected_outputs,compatible_models:source.compatible_models};
    const v=addVersion(prompt!.id,payload,prompt!.owner_team_id&&approved?'under_review':'experimental',`Restored from v${source.version_number}: ${String(args.note||'')}`);
    prompt!.latest_version_id=v.id;if(!approved)prompt!.official_version_id=v.id;result=v.id;
  } else if(name==='deprecate_team_prompt') {
    const prompt=p(args.pid);if(!prompt||!manager(prompt.owner_team_id))throw Error('Manager required');
    const v=d.versions.find(v=>v.id===prompt.official_version_id);if(v){v.approval_status='deprecated';v.decision_reason=String(args.reason||'');}prompt.lifecycle='archived';
  } else if(name==='set_team_recommendation') {
    const prompt=p(args.pid);if(!prompt||!manager(prompt.owner_team_id))throw Error('Manager required');
    d.recommendations=d.recommendations.filter(r=>r.prompt_id!==prompt.id);
    if(args.recommend)d.recommendations.push({prompt_id:prompt.id,team_id:prompt.owner_team_id!,recommended_by:currentId});
  } else if(name==='update_app_settings') {
    if(!d.admins.some(a=>a.user_id===currentId))throw Error('Admin required');
    d.settings=[{id:true,retention_days:Number(args.days),temporary_password_hours:Number(args.password_hours)}];
  } else if(name==='remove_team') {
    if(!d.admins.some(a=>a.user_id===currentId))throw Error('Admin required');
    const t=String(args.tid);d.teams=d.teams.filter(x=>x.id!==t);d.members=d.members.filter(x=>x.team_id!==t);
    d.prompts.filter(x=>x.owner_team_id===t).forEach(x=>x.lifecycle='archived');
  } else if(name==='manage_team_member') {
    const teamId=args.tid as string;const userId=args.uid as string;
    if(!manager(teamId) && !d.admins.some(a=>a.user_id===currentId)) throw Error('Manager required.');
    if(args.operation==='add') { if(!d.members.some(m=>m.team_id===teamId&&m.user_id===userId)) d.members.push({team_id:teamId,user_id:userId,role:'member'}); }
    else d.members=d.members.filter(m=>!(m.team_id===teamId&&m.user_id===userId));
  } else if(name==='create_team') {
    if(!d.admins.some(a=>a.user_id===currentId)) throw Error('Admin required.');
    const teamId=uuid();d.teams.push({id:teamId,name:String(args.team_name),description:String(args.team_description||'')});d.members.push({team_id:teamId,user_id:String(args.first_manager),role:'manager'});result=teamId;
  } else if(name==='set_team_manager') {
    if(!d.admins.some(a=>a.user_id===currentId)) throw Error('Admin required.');
    const found=d.members.find(m=>m.team_id===args.tid&&m.user_id===args.uid);
    if(!found) throw Error('Member not found.');
    found.role=args.promote?'manager':'member';
  } else throw Error(`Operation not supported in preview: ${name}`);
  saveDemo(d);
  return result;
}

export async function favorite(promptId: string, userId: string, enabled: boolean) {
  if(isDemo) {
    const d=readDemo(); d.favorites=d.favorites.filter(f=>!(f.prompt_id===promptId&&f.user_id===userId));
    if(enabled) d.favorites.push({user_id:userId,prompt_id:promptId});
    saveDemo(d);return;
  }
  if(enabled) {
    const {error}=await client!.from('favorites').insert({user_id:userId,prompt_id:promptId});if(error) throw error;
  } else {
    const {error}=await client!.from('favorites').delete().eq('user_id',userId).eq('prompt_id',promptId);if(error) throw error;
  }
}
export async function signIn(email:string,password:string) {
  const {data,error}=await client!.auth.signInWithPassword({email,password});if(error) throw error;return data;
}
export async function signUp(email:string,password:string,name:string) {
  const {data,error}=await client!.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:window.location.origin+import.meta.env.BASE_URL}});
  if(error) throw error;return data;
}
export async function signOut() { const {error}=await client!.auth.signOut();if(error) throw error; }
export async function resetPassword(email:string) { const {error}=await client!.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+import.meta.env.BASE_URL});if(error) throw error; }
export async function updatePassword(password:string) { const {error}=await client!.auth.updateUser({password});if(error) throw error; }

export async function accountAdmin(action:string,payload:Record<string,unknown> = {}):Promise<{ok:boolean;user_id?:string;temporary_password?:string;expires_at?:string}>{
  if(isDemo) {
    if(action==='complete_temp_password')return {ok:true};
    if(action==='create_user')return {ok:true,user_id:uuid(),temporary_password:'DEMO-ONLY-not-a-real-password',expires_at:now()};
    return {ok:true,temporary_password:action==='reset_temp_password'?'DEMO-ONLY-not-a-real-password':undefined};
  }
  const {data,error}=await client!.functions.invoke('admin-accounts',{body:{action,...payload}});
  if(error)throw error;
  if(data?.error)throw Error(data.error);
  return data;
}
/** Update only the signed-in user's display name (never their role or email). */
export async function updateDisplayName(name:string):Promise<string>{
  const clean=name.trim();
  if(clean.length<2||clean.length>80)throw Error('Name must be between 2 and 80 characters.');
  if(isDemo){
    const data=readDemo();const mine=data.profiles.find(p=>p.id===demoIdentity.id);
    if(!mine)throw Error('Profile not found.');
    mine.display_name=clean;saveDemo(data);return clean;
  }
  const {data,error}=await client!.rpc('update_my_display_name',{new_display_name:clean});
  if(error)throw error;
  return String(data||clean);
}

export async function changePassword(password:string){
  if(isDemo)return;
  const {error}=await client!.auth.updateUser({password});if(error)throw error;
}

/** A deliberately synthetic, read-only guest catalogue.
 * Never fetches privileged team data or bypasses Supabase RLS. */
export function guestSampleData(): AppData {
  const examples = createDemo();
  return {
    ...examples,
    prompts: examples.prompts.filter(p=>p.lifecycle==='published'),
    versions: examples.versions.filter(v=>examples.prompts.some(p=>p.id===v.prompt_id&&p.lifecycle==='published')),
    members: [], profiles: examples.profiles, admins:[], favorites:[], proposals:[], notifications:[], audit:[],
    account_controls:[], recommendations:[], settings:[],
  };
}

/** One favorite per user is counted as one like. The RPC only returns
 * totals for prompts the authenticated user is permitted to read. */
export async function loadLikeCounts(): Promise<Record<string,number>> {
  if (isDemo) {
    const counts: Record<string, number> = {};
    for (const row of readDemo().favorites) counts[row.prompt_id] = (counts[row.prompt_id] || 0) + 1;
    return counts;
  }
  const { data, error } = await client!.rpc('prompt_like_counts');
  if (error) {
    console.warn('Like totals are unavailable until the 003 migration is applied:', error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data || []) counts[String(row.prompt_id)] = Number(row.likes);
  return counts;
}
