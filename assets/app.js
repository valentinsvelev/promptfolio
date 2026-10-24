/* Promptfolio — static GitHub Pages frontend, Supabase Auth + Postgres backend.
 * All authorization of remote data MUST happen in database RLS and RPCs,
 * not through these UI conditions. Demo mode is browser-local/sample-only.
 */
'use strict';
const $ = id => document.getElementById(id);
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = iso => iso ? new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
const uid = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const labels = {Writing:'✎',Analysis:'▥',Engineering:'⌘',Research:'⌕',Marketing:'✳',Productivity:'◷',General:'◈'};
const readLocal=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))??def}catch{return def}};
const writeLocal=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const cfg=window.PROMPTFOLIO_SUPABASE||{};
const demo=!cfg.url?.trim()||!cfg.anonKey?.trim();
let sb=null;
let authMode='login';
const state={user:null,profile:null,view:'discover',prompts:[],versions:[],teams:[],members:[],profiles:[],favorites:[],proposals:[],notifications:[],admins:[],audit:[],selected:null,filter:'All',query:'',editorMode:'create',editorPromptId:null,authBusy:false};
const demoTeamA='10000000-0000-4000-8000-000000000001';
const demoTeamB='10000000-0000-4000-8000-000000000002';
const demoUser='20000000-0000-4000-8000-000000000001';
const demoColleague='20000000-0000-4000-8000-000000000002';
const demoNow=new Date().toISOString();
const sampleBodies=[
 ['Turn meeting notes into action items','Transform scattered notes into decisions, owners and deadlines.','Writing','Meetings','You are a focused meeting assistant. Analyse the following notes:\n\n{{meeting_notes}}\n\nReturn:\n1. A five-line summary\n2. Decisions taken\n3. Action items with owners and due dates\n4. Outstanding questions',demoTeamA],
 ['Explore a market opportunity','A structured first-pass market assessment for a new idea.','Research','Strategy','Evaluate {{market}} for {{company}}. Cover market size, customer segments, drivers, competitors, risks and recommended next steps. Flag assumptions explicitly.',demoTeamB],
 ['Write clearer customer emails','Draft a concise, friendly reply that resolves a customer request.','Writing','Communication','Write a clear reply to this customer message:\n\n{{customer_message}}\n\nTone: {{tone}}\n\nKeep it concise, specific and helpful.',demoTeamA],
 ['Analyse survey responses','Turn raw survey answers into patterns and actionable themes.','Analysis','Insights','Read these anonymised survey responses: {{responses}}. Identify the top themes, supporting examples, potential biases and practical recommendations.',demoTeamB]
];
function initialDemo(){let prompts=[],versions=[];sampleBodies.forEach((r,i)=>{let pid=`30000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;let vid=`40000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;prompts.push({id:pid,owner_user_id:null,owner_team_id:r[5],created_by:i%2?demoColleague:demoUser,lifecycle:'published',official_version_id:vid,latest_version_id:vid,created_at:demoNow,updated_at:demoNow,deleted_at:null});versions.push({id:vid,prompt_id:pid,version_number:1,title:r[0],description:r[1],content:r[4],category:r[2],tags:[r[3].toLowerCase()],usage_instructions:'Fill in the placeholders, then copy the result into your AI tool.',example_inputs:'',expected_outputs:'',compatible_models:['ChatGPT','Claude'],approval_status:'approved',decision:'',decision_reason:'',change_note:'Initial approved version',author_id:i%2?demoColleague:demoUser,created_at:demoNow})});return{prompts,versions,teams:[{id:demoTeamA,name:'Operations',description:'Operations and everyday workflows'},{id:demoTeamB,name:'Strategy',description:'Planning and research'}],members:[{team_id:demoTeamA,user_id:demoUser,role:'manager'},{team_id:demoTeamB,user_id:demoColleague,role:'manager'}],profiles:[{id:demoUser,display_name:'Alex Morgan',email:'alex@example.com'},{id:demoColleague,display_name:'Sam Taylor',email:'sam@example.com'}],favorites:[],proposals:[],notifications:[],admins:[],audit:[]}}
const DEMO_KEY='promptfolio-supabase-demo-v1';
let ds=readLocal(DEMO_KEY,null)||initialDemo();
function commitDemo(){writeLocal(DEMO_KEY,ds)}
const userId=()=>state.user?.id;
const isAdmin=()=>state.admins.some(a=>a.user_id===userId());
const ownTeams=()=>state.members.filter(m=>m.user_id===userId());
const isMember=id=>ownTeams().some(m=>m.team_id===id);
const isManager=id=>ownTeams().some(m=>m.team_id===id&&m.role==='manager');
const editAccess=p=>p&&(p.owner_user_id===userId()||(p.owner_team_id&&isMember(p.owner_team_id)));
const teamName=id=>id?state.teams.find(t=>t.id===id)?.name||'Other team':'Personal';
const personName=id=>state.profiles.find(p=>p.id===id)?.display_name||'Contributor';
const versionsOf=id=>state.versions.filter(v=>v.prompt_id===id).sort((a,b)=>b.version_number-a.version_number);
const official=p=>state.versions.find(v=>v.id===p?.official_version_id)||state.versions.find(v=>v.id===p?.latest_version_id);
const latest=p=>state.versions.find(v=>v.id===p?.latest_version_id);
function message(s){let toast=$('toast');toast.textContent=s;toast.classList.add('show');clearTimeout(message.t);message.t=setTimeout(()=>toast.classList.remove('show'),3600)}
function errorMessage(err){return err?.message||String(err)||'Something went wrong'}
async function call(name,args={}){if(demo)return demoRPC(name,args);const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
async function refresh(keep=true){
 if(demo){Object.entries(ds).forEach(([k,v])=>{state[k]=structuredClone(v)});state.profile=state.profiles.find(x=>x.id===demoUser);state.user={id:demoUser,email:'alex@example.com'}}
 else {
  const jobs={profiles:'id,email,display_name',teams:'*',team_members:'*',prompts:'*',prompt_versions:'*',favorites:'*',improvement_proposals:'*',notifications:'*',app_admins:'*',audit_events:'*'};
  const result=await Promise.all(Object.entries(jobs).map(async([name,cols])=>{
   const {data,error}=await sb.from(name).select(cols);if(error)throw new Error(`${name}: ${error.message}`);return[name,data||[]]}));
  const dict=Object.fromEntries(result);
  Object.assign(state,{profiles:dict.profiles,teams:dict.teams,members:dict.team_members,prompts:dict.prompts,versions:dict.prompt_versions,favorites:dict.favorites,proposals:dict.improvement_proposals,notifications:dict.notifications,admins:dict.app_admins,audit:dict.audit_events});
  state.profile=state.profiles.find(x=>x.id===userId())||null;
 }
 if(!keep||!state.prompts.some(p=>p.id===state.selected))state.selected=state.prompts[0]?.id||null;
 $('accountButton').textContent=(state.profile?.display_name||state.user?.email||'U').slice(0,2).toUpperCase();
 $('reviewNav').hidden=!ownTeams().some(m=>m.role==='manager');
 $('adminNav').hidden=!isAdmin();
 $('reviewCount').textContent=reviewQueue().length;
 $('totalCount').textContent=String(state.prompts.filter(p=>p.deleted_at===null||!p.deleted_at).length).padStart(2,'0');
 render();
}
function reviewQueue(){const teamIds=ownTeams().filter(m=>m.role==='manager').map(m=>m.team_id);
 return [...state.versions.filter(v=>v.approval_status==='under_review'&&state.prompts.some(p=>p.id===v.prompt_id&&p.latest_version_id===v.id&&teamIds.includes(p.owner_team_id))).map(v=>({kind:'version',record:v,prompt:state.prompts.find(p=>p.id===v.prompt_id)})),
 ...state.proposals.filter(pr=>['open','under_review'].includes(pr.status)&&state.prompts.some(p=>p.id===pr.prompt_id&&teamIds.includes(p.owner_team_id))).map(pr=>({kind:'proposal',record:pr,prompt:state.prompts.find(p=>p.id===pr.prompt_id)}))];
}
function setLoggedIn(logged){$('authPage').hidden=logged;$('appPage').hidden=!logged;$('mainNav').hidden=!logged;$('accountButton').hidden=!logged;$('openComposer').hidden=!logged;}
async function init(){
 if(demo){$('notice').hidden=false;$('notice').innerHTML='<strong>Interactive demo mode</strong> — No Supabase credentials configured. Changes are saved only in this browser. Configure <code>config.js</code> to connect a real shared database.';$('envLabel').textContent='Preview mode';setLoggedIn(true);await refresh(false)}
 else if(!window.supabase?.createClient){$('notice').hidden=false;$('notice').textContent='Unable to load the Supabase JavaScript SDK. Check your internet connection.';setLoggedIn(false)}
 else {
  sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data,error}=await sb.auth.getSession();if(error)message(errorMessage(error));state.user=data.session?.user||null;
  setLoggedIn(!!state.user);
  if(state.user)try{await refresh(false)}catch(err){message('Could not load your library: '+errorMessage(err));console.error(err)}
  sb.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'){authMode='update';setLoggedIn(false);renderAuth();return}
   const prev=state.user?.id;state.user=session?.user||null;
   setLoggedIn(!!state.user);if(state.user&&prev!==state.user.id) setTimeout(()=>refresh(false).catch(e=>message(errorMessage(e))),0);
  });
 }
 wire();renderAuth();
}
function wire(){
 document.querySelectorAll('[data-view]').forEach(x=>x.onclick=()=>switchView(x.dataset.view));
 $('query').oninput=e=>{state.query=e.target.value;renderExplore()};$('sortBy').onchange=renderExplore;
 $('openComposer').onclick=()=>openEditor();$('closeComposer').onclick=()=>$('composer').close();$('cancelComposer').onclick=()=>$('composer').close();
 $('promptForm').onsubmit=async e=>{e.preventDefault();await submitEditor()};
 $('composer').onclick=e=>{if(e.target===$('composer'))$('composer').close()};
 $('loginTab').onclick=()=>{authMode='login';renderAuth()};$('signupTab').onclick=()=>{authMode='signup';renderAuth()};
 $('forgotPassword').onclick=()=>{authMode='reset';renderAuth()};$('authForm').onsubmit=authSubmit;
 $('accountButton').onclick=()=>openAccount();$('closeAccount').onclick=()=>$('accountDialog').close();
 $('signOut').onclick=async()=>{if(demo){$('accountDialog').close();message('Demo mode: no account session');return}const{error}=await sb.auth.signOut();if(error)message(errorMessage(error));else{$('accountDialog').close();state.user=null;setLoggedIn(false);authMode='login';renderAuth()}};
 $('changePassword').onclick=()=>{if(demo){message('Password changes require a configured Supabase project');return}$('accountDialog').close();authMode='update';setLoggedIn(false);renderAuth()};
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();switchView('discover');$('query').focus()}});
}
function renderAuth(){let sign=authMode==='signup',reset=authMode==='reset',update=authMode==='update';
 $('loginTab').classList.toggle('active',!sign);$('signupTab').classList.toggle('active',sign);
 $('nameField').hidden=!sign;$('passwordField').hidden=reset;
 $('authHeading').textContent=sign?'Create your account':reset?'Reset your password':update?'Choose a new password':'Welcome back';
 $('authExplainer').textContent=sign?'New accounts start with a private personal library and no team access.':reset?'We’ll email you a password-reset link.':update?'Enter a new password for your account.':'Sign in to access your prompt library.';
 $('authSubmit').textContent=sign?'Create account':reset?'Send reset email':update?'Update password':'Sign in';
 $('authPassword').autocomplete=sign||update?'new-password':'current-password';$('authEmail').closest('label').hidden=update;
 $('forgotPassword').hidden=sign||reset||update;
 $('authMessage').textContent='';$('authMessage').classList.remove('error');
}
async function authSubmit(e){e.preventDefault();if(demo)return;const email=$('authEmail').value.trim(),password=$('authPassword').value,name=$('authName').value.trim();
 const el=$('authMessage');el.textContent='';el.classList.remove('error');$('authSubmit').disabled=true;
 try{
  let res;
  if(authMode==='signup')res=await sb.auth.signUp({email,password,options:{data:{display_name:name||email.split('@')[0]},emailRedirectTo:location.origin+location.pathname}});
  else if(authMode==='reset')res=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  else if(authMode==='update'){res=await sb.auth.updateUser({password});if(!res.error){authMode='login';renderAuth();setLoggedIn(!!state.user)}}
  else res=await sb.auth.signInWithPassword({email,password});
  if(res.error)throw res.error;
  if(authMode==='signup')el.textContent='Check your email to verify your account, then sign in.';
  else if(authMode==='reset')el.textContent='If this email is registered, a reset link has been sent.';
  else if(authMode==='login'&&res.data?.user){state.user=res.data.user;setLoggedIn(true);await refresh(false)}
  else el.textContent='Password updated.';
 }catch(err){el.textContent=errorMessage(err);el.classList.add('error')}
 finally{$('authSubmit').disabled=false}
}
function openAccount(){let unseen=state.notifications.filter(n=>!n.read_at).length;
 $('accountInfo').innerHTML=`<strong>${h(state.profile?.display_name||'Contributor')}</strong><div>${h(state.user?.email||'Demo account')}</div><div style="margin-top:12px">${ownTeams().length} team(s) · ${unseen} unread notification(s)</div>${state.notifications.slice(-4).reverse().map(n=>`<div style="border-top:1px solid #eee;padding:8px 0;font-size:12px">${h(n.message)}</div>`).join('')}`;
 $('signOut').textContent=demo?'Close preview':'Sign out';$('changePassword').hidden=demo;
 $('accountDialog').showModal();if(!demo&&unseen){sb.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',userId()).is('read_at',null).then(()=>{});}
}
function switchView(view){if(view==='admin'&&!isAdmin())return;if(view==='review'&&reviewQueue().length===0&&!ownTeams().some(m=>m.role==='manager'))return;
 state.view=view;$('exploreView').hidden=view!=='discover';$('simpleView').hidden=view==='discover';
 document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('detailPanel').classList.remove('mobile-open');render();}
function render(){if(state.view==='discover')renderExplore();else renderSimple()}
function filterPrompts(){let list=state.prompts.filter(p=>!p.deleted_at&&official(p));
 if(state.filter==='Personal')list=list.filter(p=>p.owner_user_id===userId());
 else if(state.filter==='My teams')list=list.filter(p=>p.owner_team_id&&isMember(p.owner_team_id));
 else if(state.filter==='Other teams')list=list.filter(p=>p.owner_team_id&&!isMember(p.owner_team_id));
 else if(state.filter==='Saved')list=list.filter(p=>state.favorites.some(f=>f.prompt_id===p.id&&f.user_id===userId()));
 const q=state.query.toLowerCase().trim();if(q)list=list.filter(p=>{const v=official(p);return[v.title,v.description,v.category,v.content,(v.tags||[]).join(' '),teamName(p.owner_team_id)].join(' ').toLowerCase().includes(q)});
 list.sort((a,b)=>$('sortBy').value==='title'?official(a).title.localeCompare(official(b).title):String(b.updated_at).localeCompare(String(a.updated_at)));
 return list;
}
function renderExplore(){let categories=['All','Personal','My teams','Other teams','Saved'];const filters=$('filters');filters.innerHTML='';for(let c of categories){let button=document.createElement('button');button.textContent=c;button.className='filter'+(state.filter===c?' active':'');button.onclick=()=>{state.filter=c;renderExplore()};filters.append(button)}
 let list=filterPrompts();$('resultCount').textContent=`${list.length} result${list.length===1?'':'s'}`;
 $('listHeading').textContent=state.filter==='All'?'All prompts':state.filter;
 $('loadingStatus').textContent=demo?'Sample library':'Access-controlled';
 if(!list.some(p=>p.id===state.selected))state.selected=list[0]?.id||null;
 const root=$('promptList');root.innerHTML='';if(!list.length)root.innerHTML=`<div class="empty-state"><h3>No matching prompts yet</h3><p>${!ownTeams().length?'You have no team access yet. Create personal prompts, or ask a manager to add you to a team.':'Try a different search, or create a new prompt.'}</p></div>`;
 list.forEach(p=>{let v=official(p);let row=document.createElement('button');row.type='button';row.className='prompt-item'+(state.selected===p.id?' selected':'');row.innerHTML=`<span class="category-icon ${h(v.category)}" aria-hidden="true">${labels[v.category]||'◈'}</span><span><div class="item-top">${h(v.category)} · ${h(teamName(p.owner_team_id))}</div><div class="item-title">${h(v.title)}</div><div class="item-desc">${h(v.description)}</div><div class="item-meta"><span>by ${h(personName(v.author_id))}</span><i></i><span>${h(today(p.updated_at))}</span></div></span><span class="item-arrow">›</span>`;
 row.onclick=()=>{state.selected=p.id;renderExplore();$('detailPanel').classList.add('mobile-open')};root.append(row)});
 renderDetail(list.find(p=>p.id===state.selected));
}
function varNames(text){return[...new Set([...String(text||'').matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g)].map(m=>m[1]))]}
function renderDetail(p){const root=$('detailContent');if(!p){root.innerHTML='<div class="preview-empty">Select a prompt to see its details.</div>';return}
 const v=official(p),last=latest(p),canEdit=editAccess(p),ownOtherTeam=p.owner_team_id&&!isMember(p.owner_team_id);
 const faved=state.favorites.some(f=>f.prompt_id===p.id&&f.user_id===userId());
 const reviewPending=canEdit&&last&&last.id!==v.id&&last.approval_status==='under_review';
 const vars=varNames(v.content),hist=canEdit?versionsOf(p.id):[v];
 root.innerHTML=`<div class="detail-top"><div><button class="mobile-back" id="mobileBack">← Back</button><span class="detail-eyebrow"><span class="dot"></span>PROMPT PREVIEW</span></div><button id="starBtn" class="review-link">${faved?'★ Saved':'☆ Save'}</button></div>
 <div class="detail-scroll"><div class="detail-meta-row"><span class="status-pill status-${h(p.lifecycle)}">${h(p.lifecycle)}</span><span class="meta-pill">${h(teamName(p.owner_team_id))}</span><span class="meta-pill">${h(v.approval_status)}</span></div>
 <h2>${h(v.title)}</h2><p class="detail-summary">${h(v.description)}</p><div class="byline"><span class="author-circle">${h(personName(v.author_id).slice(0,2).toUpperCase())}</span><span>by <strong>${h(personName(v.author_id))}</strong> · updated ${h(today(p.updated_at))}</span></div>
 ${reviewPending?'<div class="detail-banner">A newer version is under review. Everyone continues using the official version until a Team Manager approves it.</div>':''}
 <div class="detail-block-heading">THE PROMPT <span>v${v.version_number}</span></div><div class="prompt-code" id="promptCode">${h(v.content)}</div>
 ${vars.length?`<div class="var-fields"><div class="detail-block-heading">MAKE IT YOURS</div>${vars.map(n=>`<label class="var-field">${h(n.replaceAll('_',' '))}<input data-var="${h(n)}" placeholder="Enter ${h(n.replaceAll('_',' '))}"></label>`).join('')}</div>`:''}
 ${v.usage_instructions?`<div class="detail-block-heading">HOW TO USE</div><p class="usage">${h(v.usage_instructions)}</p>`:''}
 ${(v.example_inputs||v.expected_outputs)?`<div class="detail-block-heading">EXAMPLES</div><p class="usage">${h(v.example_inputs)} ${h(v.expected_outputs)}</p>`:''}
 <div class="tags">${(v.tags||[]).map(t=>`<span class="tag">#${h(t)}</span>`).join('')}</div>
 <div class="detail-actions"><button class="button secondary" id="copyPrompt">Copy prompt ↗</button><button class="button outline" id="copyLibrary">Duplicate</button>${canEdit?'<button class="button outline" id="editPrompt">Edit</button>':(ownOtherTeam?'<button class="button outline" id="suggestEdit">Suggest change</button>':'')}</div>
 ${canEdit?`<div class="prompt-version-list"><div class="detail-block-heading">VERSION HISTORY</div>${hist.map(x=>`<div class="version-row"><div>v${x.version_number} · ${h(x.approval_status)} ${x.decision==='rejected'?'(rejected)':''}<br><span>${h(today(x.created_at))} · ${h(x.change_note||'No change note')}</span></div><div>${x.approval_status==='experimental'&&p.owner_team_id&&x.id===p.latest_version_id?`<button class="tiny-button primary" data-request="${h(x.id)}">Request approval</button>`:''}${x.id===p.official_version_id?'<span>Official</span>':`<button class="tiny-button" data-version="${h(x.id)}">View</button>`}</div></div>`).join('')}</div>`:''}
 <div class="detail-block-heading">OPTIONS</div><div class="row-actions"><button class="tiny-button" id="exportJSON">Export JSON</button><button class="tiny-button" id="exportMD">Export Markdown</button>${canEdit?`<button class="tiny-button" id="toggleLifecycle">${p.lifecycle==='published'?'Move to draft':'Publish'}</button>${p.owner_user_id&&ownTeams().length?'<button class="tiny-button primary" id="sharePersonal">Share to team</button>':''}<button class="tiny-button danger" id="deletePrompt">Delete</button>`:''}</div>
 </div><div class="detail-bottom"><p class="helper">${canEdit?'Edits create a new version. Approved versions remain protected.':'You can copy this prompt or propose improvements without changing the original.'}</p></div>`;
 $('mobileBack').onclick=()=>$('detailPanel').classList.remove('mobile-open');
 $('starBtn').onclick=()=>action(async()=>{if(faved){if(demo)ds.favorites=ds.favorites.filter(x=>x.prompt_id!==p.id);else{const{error}=await sb.from('favorites').delete().eq('prompt_id',p.id).eq('user_id',userId());if(error)throw error}}else{if(demo)ds.favorites.push({user_id:userId(),prompt_id:p.id});else{const{error}=await sb.from('favorites').insert({user_id:userId(),prompt_id:p.id});if(error)throw error}}if(demo)commitDemo();await refresh();message(faved?'Removed from saved':'Saved to favorites')});
 $('copyPrompt').onclick=async()=>{let t=v.content;root.querySelectorAll('[data-var]').forEach(inp=>{if(inp.value.trim())t=t.replaceAll(`{{${inp.dataset.var}}}`,inp.value.trim())});try{await navigator.clipboard.writeText(t);message('Prompt copied to clipboard')}catch{message('Clipboard unavailable — select the text to copy')}};
 $('copyLibrary').onclick=()=>action(async()=>{const id=await call('copy_prompt',{pid:p.id,target_team_id:null});await refresh(false);state.selected=id;state.filter='Personal';switchView('discover');message('Independent copy saved to your personal library')});
 if(canEdit){$('editPrompt').onclick=()=>openEditor('edit',p);$('toggleLifecycle').onclick=()=>action(async()=>{await call('set_prompt_lifecycle',{pid:p.id,new_status:p.lifecycle==='published'?'draft':'published'});await refresh();message('Lifecycle updated')});
 if(p.owner_user_id&&ownTeams().length)$('sharePersonal').onclick=()=>{
  const available=ownTeams().map((m,i)=>`${i+1}. ${teamName(m.team_id)}`);
  const choice=prompt(`Share a separate copy to which team?\n${available.join('\n')}\nEnter the number:`);
  if(choice===null)return;const m=ownTeams()[Number(choice)-1];if(!m){message('Select a valid team number');return}
  action(async()=>{const id=await call('share_personal_prompt',{pid:p.id,target_team_id:m.team_id});await refresh(false);state.selected=id;renderExplore();message('Published an independent team copy')});
 };
 $('deletePrompt').onclick=()=>{if(confirm('Delete this prompt? You can restore it from My prompts within 30 days.'))action(async()=>{await call('soft_delete_prompt',{pid:p.id,recover:false});await refresh(false);message('Prompt moved to trash')})};
 root.querySelectorAll('[data-request]').forEach(b=>b.onclick=()=>action(async()=>{await call('request_version_review',{vid:b.dataset.request});await refresh();message('Submitted for manager review')}));
 root.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{const vv=state.versions.find(x=>x.id===b.dataset.version);if(!vv)return;const who=personName(vv.author_id);alert(`Version ${vv.version_number} · ${vv.approval_status}\nAuthor: ${who}\nChange note: ${vv.change_note||'—'}\n\n${vv.content}`)})}
 else if(ownOtherTeam)$('suggestEdit').onclick=()=>openEditor('propose',p);
 $('exportJSON').onclick=()=>download(`${safeFilename(v.title)}.json`,JSON.stringify({id:p.id,owner:teamName(p.owner_team_id),lifecycle:p.lifecycle,version:v},null,2),'application/json');
 $('exportMD').onclick=()=>download(`${safeFilename(v.title)}.md`,`# ${v.title}\n\n${v.description}\n\n## Prompt\n\n${v.content}\n\n## Usage\n\n${v.usage_instructions}\n`,'text/markdown');
}
function safeFilename(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'prompt'}
function download(filename,content,mime){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type:mime}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function action(fn){try{await fn()}catch(err){message(errorMessage(err));console.error(err)}}
function formPayload(){return{title:$('inputTitle').value.trim(),description:$('inputDescription').value.trim(),content:$('inputContent').value.trim(),category:$('inputCategory').value,tags:$('inputTags').value.split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean).slice(0,20),usage_instructions:$('inputUsage').value.trim(),example_inputs:$('inputExamples').value.trim(),expected_outputs:$('inputOutputs').value.trim(),compatible_models:$('inputModels').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12)}}
function openEditor(mode='create',p=null){state.editorMode=mode;state.editorPromptId=p?.id||null;$('promptForm').reset();$('composerMessage').textContent='';
 $('composerEyebrow').textContent=mode==='propose'?'CROSS-TEAM PROPOSAL':mode==='edit'?'NEW PROMPT VERSION':'PROMPT EDITOR';
 $('composerHeading').textContent=mode==='propose'?'Suggest an improvement':mode==='edit'?'Edit prompt':'Create a prompt';
 $('submitPrompt').textContent=mode==='propose'?'Send proposal':mode==='edit'?'Save new version':'Save prompt';
 $('changeNoteField').hidden=mode==='create';$('ownerField').hidden=mode!=='create';$('lifecycleField').hidden=mode!=='create';
 const selector=$('inputOwner');selector.innerHTML='<option value="">Personal · only me</option>'+ownTeams().map(m=>`<option value="${h(m.team_id)}">${h(teamName(m.team_id))} · team library</option>`).join('');
 if(p){const v=mode==='edit'?(latest(p)||official(p)):official(p);if(v){$('inputTitle').value=v.title;$('inputDescription').value=v.description;$('inputContent').value=v.content;$('inputCategory').value=v.category;$('inputTags').value=(v.tags||[]).join(', ');$('inputUsage').value=v.usage_instructions||'';$('inputExamples').value=v.example_inputs||'';$('inputOutputs').value=v.expected_outputs||'';$('inputModels').value=(v.compatible_models||[]).join(', ')}};
 $('composer').showModal();$('inputTitle').focus();}
async function submitEditor(){const payload=formPayload();if(!payload.title||!payload.content){$('composerMessage').textContent='Title and prompt text are required.';return}
 $('submitPrompt').disabled=true;$('composerMessage').textContent='Saving…';
 try{let id;
 if(state.editorMode==='create')id=await call('create_prompt',{payload,team_id:$('inputOwner').value||null,publish:$('inputPublish').checked});
 else if(state.editorMode==='edit'){id=state.editorPromptId;await call('save_prompt_version',{pid:id,payload,note:$('inputChangeNote').value.trim()})}
 else{id=state.editorPromptId;await call('propose_improvement',{pid:id,payload,explanation:$('inputChangeNote').value.trim()})}
 $('composer').close();await refresh(false);if(state.prompts.some(x=>x.id===id))state.selected=id;state.filter='All';switchView('discover');
 message(state.editorMode==='propose'?'Improvement submitted for manager review':state.editorMode==='edit'?'New version saved':'Prompt saved to your library');
 }catch(err){$('composerMessage').textContent=errorMessage(err)}finally{$('submitPrompt').disabled=false}
}
function renderSimple(){const titles={mine:['PERSONAL WORKSPACE','My prompts.','Everything you own personally or co-manage through your teams.'],teams:['COLLABORATE','Your teams.','Shared libraries and membership. A user without membership sees no teams.'],review:['GOVERNANCE','Review queue.','Compare proposed changes against the official version before you approve.'],admin:['ADMINISTRATION','Manage your space.','Manage teams and members. Account administration happens in Supabase.']};
 const [ey,title,description]=titles[state.view]||titles.mine;$('simpleEyebrow').textContent=ey;$('simpleTitle').innerHTML=h(title.slice(0,-1))+'<span class="blue-period">.</span>';$('simpleDescription').textContent=description;
 const root=$('simpleContent');root.innerHTML='';if(state.view==='mine')renderMine(root);if(state.view==='teams')renderTeams(root);if(state.view==='review')renderReviews(root);if(state.view==='admin')renderAdmin(root);
}
function renderMine(root){const mine=state.prompts.filter(p=>!p.deleted_at&&editAccess(p));
 root.innerHTML=`<div class="section-line"><h2>${mine.length} editable prompt${mine.length!==1?'s':''}</h2><div class="row-actions"><button class="button primary" id="mineNew">+ New prompt</button><button class="button outline" id="importJSON">Import JSON</button><input type="file" id="importFile" hidden accept=".json,application/json"></div></div>`;
 $('mineNew').onclick=()=>openEditor();$('importJSON').onclick=()=>$('importFile').click();$('importFile').onchange=e=>action(async()=>{let file=e.target.files[0];if(!file)return;let value=JSON.parse(await file.text());let body=value.version||value;openEditor();$('inputTitle').value=body.title||'';$('inputDescription').value=body.description||'';$('inputContent').value=body.content||'';$('inputCategory').value=body.category||'General';$('inputTags').value=(body.tags||[]).join(', ');message('Imported into editor — review and save to publish')});
 const deleted=state.prompts.filter(p=>p.deleted_at&&editAccess(p));
 if(deleted.length){const trash=document.createElement('section');trash.innerHTML=`<div class="section-line"><h2>Recently deleted</h2><span class="helper-text">Recoverable for 30 days</span></div>${deleted.map(p=>`<div class="version-row"><span>Prompt ${h(p.id.slice(0,8))} · deleted ${h(today(p.deleted_at))}</span><button class="tiny-button" data-restore="${h(p.id)}">Restore</button></div>`).join('')}`;
 trash.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>action(async()=>{await call('soft_delete_prompt',{pid:b.dataset.restore,recover:true});await refresh();message('Prompt restored')}));root.append(trash)}
 if(!mine.length){root.insertAdjacentHTML('beforeend','<div class="muted-panel">No active prompts yet. Create a personal prompt to get started. It will not be visible to others until you share it with a team.</div>');return}
 const grid=document.createElement('div');grid.className='simple-grid';mine.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).forEach(p=>{let v=official(p);if(!v)return;let card=document.createElement('div');card.className='info-card';card.innerHTML=`<span class="pill">${h(teamName(p.owner_team_id))}</span><h3>${h(v.title)}</h3><p>${h(v.description||v.content.slice(0,130))}</p><div class="card-foot"><span class="pill ${p.lifecycle==='published'?'green':''}">${h(p.lifecycle)}</span><button class="tiny-button primary">Open ↗</button></div>`;card.querySelector('button').onclick=()=>{state.selected=p.id;state.filter='All';switchView('discover')};grid.append(card)});root.append(grid);
}
function renderTeams(root){if(!ownTeams().length&&!isAdmin()){root.innerHTML='<div class="muted-panel">You are not assigned to a team yet. Your personal library is available now. Ask a Team Manager or Administrator to add your registered account.</div>';return}
 const grid=document.createElement('div');grid.className='simple-grid';let visible=isAdmin()?state.teams:state.teams.filter(t=>isMember(t.id));
 for(let t of visible){let card=document.createElement('section');card.className='info-card';let mine=ownTeams().find(m=>m.team_id===t.id);let mgr=mine?.role==='manager'||isAdmin();let members=state.members.filter(m=>m.team_id===t.id);
 card.innerHTML=`<span class="pill blue">${mine?.role||'Administrator'}</span><h3>${h(t.name)}</h3><p>${h(t.description||'Team prompt library')}</p><div class="helper-text">${members.length} member${members.length===1?'':'s'} · ${state.prompts.filter(p=>p.owner_team_id===t.id).length} accessible prompts</div><div class="card-foot"><button class="tiny-button primary" data-team-open>View prompts ↗</button>${mgr?'<button class="tiny-button" data-team-manage>Manage members</button>':''}</div>${mgr?`<div data-member-panel hidden><div class="section-line"><strong style="font-size:12px">Team members</strong></div><div>${members.map(m=>`<div class="version-row"><span>${h(personName(m.user_id))} · ${h(m.role)}</span><button class="tiny-button danger" data-remove="${h(m.user_id)}">Remove</button></div>`).join('')}</div><div style="margin-top:12px"><input class="inline-input" data-member-email placeholder="Registered user's email"><button class="tiny-button primary" data-add>Add</button></div></div>`:''}`;
 card.querySelector('[data-team-open]').onclick=()=>{state.filter='My teams';state.query='';$('query').value='';switchView('discover')};
 if(mgr){card.querySelector('[data-team-manage]').onclick=()=>{const panel=card.querySelector('[data-member-panel]');panel.hidden=!panel.hidden};
 card.querySelector('[data-add]').onclick=()=>action(async()=>{let email=card.querySelector('[data-member-email]').value.trim().toLowerCase();let profile=state.profiles.find(p=>p.email===email);if(!profile)throw Error('User not found. They must register first.');await call('manage_team_member',{tid:t.id,uid:profile.id,operation:'add'});await refresh();message('Member added')});
 card.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(confirm('Remove this member from '+t.name+'?'))action(async()=>{await call('manage_team_member',{tid:t.id,uid:b.dataset.remove,operation:'remove'});await refresh();message('Member removed')})});}
 grid.append(card)}root.append(grid);
}
function renderReviews(root){const q=reviewQueue();root.innerHTML=`<div class="section-line"><h2>${q.length} item${q.length===1?'':'s'} awaiting review</h2><span class="helper-text">Only Team Managers can make final decisions.</span></div>`;
 if(!q.length){root.insertAdjacentHTML('beforeend','<div class="muted-panel">Everything is up to date. New version reviews and cross-team improvement proposals will appear here.</div>');return}
 for(let item of q){let {kind,record,prompt:p}=item,base=official(p),newer=kind==='version'?record:record.proposed_content;
 let card=document.createElement('article');card.className='review-card';card.innerHTML=`<span class="pill blue">${kind==='version'?'VERSION APPROVAL':'CROSS-TEAM PROPOSAL'}</span><h3>${h(newer.title||base?.title||'Untitled')}</h3><p>${kind==='version'?`Version ${record.version_number} · submitted by ${h(personName(record.author_id))}`:`Submitted by ${h(personName(record.author_id))} · ${h(record.rationale||'No explanation')}`}</p>
 <div class="review-compare"><div class="compare-col"><h4>Official version · v${base?.version_number||'?'}</h4><pre>${h(base?.content||'(not available)')}</pre></div><div class="compare-col"><h4>Proposed changes</h4><pre>${h(newer.content||'(not available)')}</pre></div></div>
 <div class="review-actions"><button class="button primary" data-approve>${kind==='proposal'?'Accept for version review':'Approve version'}</button><button class="button outline danger" data-reject>Reject</button></div>`;
 card.querySelector('[data-approve]').onclick=()=>action(async()=>{if(kind==='version')await call('review_prompt_version',{vid:record.id,approve:true,reason:''});else await call('review_improvement_proposal',{proposal_id:record.id,accept:true,reason:''});await refresh();message(kind==='version'?'Official version updated':'Proposal accepted; version now awaits approval')});
 card.querySelector('[data-reject]').onclick=()=>{const reason=prompt('Reason for rejection (required):');if(reason===null)return;if(reason.trim().length<3){message('Enter a reason of at least 3 characters');return}action(async()=>{if(kind==='version')await call('review_prompt_version',{vid:record.id,approve:false,reason});else await call('review_improvement_proposal',{proposal_id:record.id,accept:false,reason});await refresh();message('Rejected, with reason recorded')})};root.append(card)}
}
function renderAdmin(root){root.innerHTML=`<div class="simple-grid"><section class="info-card"><span class="pill blue">ADMIN ONLY</span><h3>Create a team</h3><p>Every new team needs at least one existing account as Team Manager.</p><form id="teamCreateForm"><label class="helper-text">Team name<input class="inline-input" id="newTeamName" required placeholder="e.g. Finance" style="width:100%;margin:8px 0"></label><label class="helper-text">Description<input class="inline-input" id="newTeamDesc" placeholder="What the team does" style="width:100%;margin:8px 0"></label><label class="helper-text">First manager's email<input class="inline-input" id="newTeamManager" type="email" required placeholder="colleague@company.com" style="width:100%;margin:8px 0"></label><button class="button primary" style="margin-top:13px" type="submit">Create team</button></form></section>
 <section class="info-card"><span class="pill">ACCOUNT SECURITY</span><h3>Account administration</h3><p>For this static proof of concept, creation of temporary passwords, account suspension and resets by an administrator are handled in the Supabase Dashboard, not in this browser.</p><p>Users can self-register and reset their own password through Promptfolio.</p><p class="helper-text">Admin status is granted manually in the SQL editor, never by the client.</p></section></div>
 <div class="section-line"><h2>Team manager roles</h2></div><div class="plain-table" id="adminMemberRows"><div class="table-head"><div>User</div><div>Team</div><div>Role</div><div>Action</div></div>${state.members.map(m=>`<div><strong>${h(personName(m.user_id))}</strong><span>${h(teamName(m.team_id))}</span><span>${h(m.role)}</span><div><button class="tiny-button" data-promote="${h(m.user_id)}" data-team="${h(m.team_id)}" data-mode="${m.role==='manager'?'off':'on'}">${m.role==='manager'?'Demote':'Promote'}</button></div></div>`).join('')}</div>
 <div class="section-line"><h2>Recent audit activity</h2></div><div class="plain-table">${state.audit.slice(-12).reverse().map(a=>`<div><strong>${h(a.event_type)}</strong><span>${h(personName(a.actor_id))}</span><small>${h(today(a.created_at))}</small><small>${h(a.description)}</small></div>`).join('')||'<div class="muted">No recorded activity yet.</div>'}</div>`;
 $('teamCreateForm').onsubmit=e=>{e.preventDefault();action(async()=>{let first=state.profiles.find(p=>p.email===$('newTeamManager').value.trim().toLowerCase());if(!first)throw Error('Manager must register an account first');await call('create_team',{team_name:$('newTeamName').value.trim(),team_description:$('newTeamDesc').value.trim(),first_manager:first.id});await refresh();message('Team created')})};
 root.querySelectorAll('[data-promote]').forEach(b=>b.onclick=()=>action(async()=>{await call('set_team_manager',{tid:b.dataset.team,uid:b.dataset.promote,promote:b.dataset.mode==='on'});await refresh();message('Manager role updated')}));
}

// Demo simulation: never connects to a remote database and MUST NOT be used as
// a security implementation. Production rules are implemented in Supabase SQL.
function demoRPC(name,args){const id=()=>uid();const now=()=>new Date().toISOString();const getP=pid=>ds.prompts.find(p=>p.id===pid);const checkEdit=p=>p&&(p.owner_user_id===demoUser||p.owner_team_id===demoTeamA);let p,v,vid;
 const append=(pid,payload,status,note='')=>{let no=1+Math.max(0,...ds.versions.filter(x=>x.prompt_id===pid).map(x=>x.version_number));let z={id:id(),prompt_id:pid,version_number:no,...payload,approval_status:status,decision:'',decision_reason:'',change_note:note,author_id:demoUser,created_at:now()};ds.versions.push(z);return z.id};
 switch(name){
 case 'create_prompt':{p={id:id(),owner_user_id:args.team_id?null:demoUser,owner_team_id:args.team_id||null,created_by:demoUser,lifecycle:args.publish?'published':'draft',official_version_id:null,latest_version_id:null,created_at:now(),updated_at:now(),deleted_at:null};ds.prompts.push(p);vid=append(p.id,args.payload,'experimental','Created prompt');p.official_version_id=vid;p.latest_version_id=vid;commitDemo();return p.id}
 case 'save_prompt_version':{p=getP(args.pid);if(!checkEdit(p))throw Error('Not allowed');let before=ds.versions.find(x=>x.id===p.official_version_id);vid=append(p.id,args.payload,before?.approval_status==='approved'?'under_review':'experimental',args.note);p.latest_version_id=vid;p.updated_at=now();commitDemo();return vid}
 case 'request_version_review':{v=ds.versions.find(x=>x.id===args.vid);if(!v||v.approval_status!=='experimental')throw Error('Invalid version');v.approval_status='under_review';commitDemo();break}
 case 'review_prompt_version':{v=ds.versions.find(x=>x.id===args.vid);p=getP(v.prompt_id);if(!isManager(p.owner_team_id)||v.approval_status!=='under_review')throw Error('Manager review required');v.approval_status=args.approve?'approved':'deprecated';v.decision=args.approve?'':'rejected';v.decision_reason=args.reason||'';if(args.approve)p.official_version_id=v.id;commitDemo();break}
 case 'set_prompt_lifecycle':{p=getP(args.pid);if(!checkEdit(p))throw Error('Not allowed');p.lifecycle=args.new_status;commitDemo();break}
 case 'soft_delete_prompt':{p=getP(args.pid);if(!checkEdit(p))throw Error('Not allowed');p.deleted_at=args.recover?null:now();commitDemo();break}
 case 'copy_prompt':{p=getP(args.pid);v=ds.versions.find(x=>x.id===p.official_version_id);return demoRPC('create_prompt',{payload:{title:v.title+' (copy)',description:v.description,content:v.content,category:v.category,tags:v.tags,usage_instructions:v.usage_instructions,example_inputs:v.example_inputs,expected_outputs:v.expected_outputs,compatible_models:v.compatible_models},team_id:args.target_team_id||null,publish:false})}
 case 'propose_improvement':{p=getP(args.pid);if(isMember(p.owner_team_id))throw Error('Cross-team proposals only');let newID=id();ds.proposals.push({id:newID,prompt_id:p.id,author_id:demoUser,proposed_content:args.payload,rationale:args.explanation,status:'open',created_at:now()});commitDemo();return newID}
 case 'review_improvement_proposal':{let prop=ds.proposals.find(x=>x.id===args.proposal_id);p=getP(prop.prompt_id);if(!isManager(p.owner_team_id))throw Error('Manager only');prop.status=args.accept?'accepted':'rejected';if(args.accept){vid=append(p.id,prop.proposed_content,'under_review','Accepted proposal');p.latest_version_id=vid}commitDemo();return vid}
 case 'manage_team_member':{if(args.operation==='add')ds.members.push({team_id:args.tid,user_id:args.uid,role:'member'});else ds.members=ds.members.filter(m=>!(m.team_id===args.tid&&m.user_id===args.uid));commitDemo();break}
 case 'share_personal_prompt':{let newId=demoRPC('copy_prompt',{pid:args.pid,target_team_id:args.target_team_id});getP(newId).lifecycle='published';commitDemo();return newId}
 case 'create_team':{let tid=id();ds.teams.push({id:tid,name:args.team_name,description:args.team_description});ds.members.push({team_id:tid,user_id:args.first_manager,role:'manager'});commitDemo();return tid}
 case 'set_team_manager':{let m=ds.members.find(x=>x.team_id===args.tid&&x.user_id===args.uid);m.role=args.promote?'manager':'member';commitDemo();break}
 default:throw Error('Demo operation unavailable: '+name)
 }
 return null;
}
document.addEventListener('DOMContentLoaded',init);
