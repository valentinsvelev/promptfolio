/* Dependency-light smoke test of the browser-local API adapter.
   Run after npm install: node test/demo-smoke.cjs */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/api.ts','utf8').replaceAll('import.meta.env','({})'),{
  fileName:'src/api.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true
}).outputText;
const memory=new Map();const apiExports={};
const context={exports:apiExports,require:(n)=> n==='@supabase/supabase-js'?{createClient:()=>{throw Error('Demo must not initialise client')}}:require(n),
  crypto:require('node:crypto').webcrypto,localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},console,Date,JSON,Promise};
vm.runInNewContext(code,context);
const api=apiExports;
const body={title:'Example prompt',description:'Sample',content:'Analyse {{notes}}',category:'Writing',tags:['test'],usage_instructions:'',example_inputs:'',expected_outputs:'',compatible_models:['ChatGPT']};
(async()=>{
 assert.equal(api.isDemo,true);
 const sample=await api.loadData();assert.ok(sample.prompts.length>=5);
 const id=await api.execute('create_prompt',{payload:body,team_id:null,publish:false});
 let d=await api.loadData();let prompt=d.prompts.find(p=>p.id===id);assert.equal(prompt.owner_user_id,api.demoIdentity.id);
 await api.execute('save_prompt_version',{pid:id,payload:{...body,content:'Updated content'},note:'Edit'});
 d=await api.loadData();prompt=d.prompts.find(p=>p.id===id);assert.equal(d.versions.find(v=>v.id===prompt.official_version_id).content,'Updated content');
 const v1=d.versions.find(v=>v.prompt_id===id&&v.version_number===1);
 await api.execute('restore_prompt_version',{pid:id,source_version_id:v1.id,note:'Undo'});
 d=await api.loadData();prompt=d.prompts.find(p=>p.id===id);assert.equal(d.versions.find(v=>v.id===prompt.latest_version_id).content,body.content);
 await api.execute('soft_delete_prompt',{pid:id,recover:false});
 d=await api.loadData();assert.ok(d.prompts.find(p=>p.id===id).deleted_at);
 await api.execute('soft_delete_prompt',{pid:id,recover:true});
 await assert.rejects(api.execute('permanently_delete_prompt',{pid:id}),/Trash/);
 await api.execute('create_category',{category_name:'Legal'});
 d=await api.loadData();assert.ok(d.categories.some(c=>c.name==='Legal'));
 await api.execute('update_app_settings',{days:45,password_hours:24});
 d=await api.loadData();assert.equal(d.settings[0].retention_days,45);
 // New categories are created on save and administrators can rename them globally.
 const customId=await api.execute('create_prompt',{payload:{...body,category:'DevOps'},team_id:null,publish:false});
 d=await api.loadData();assert.ok(d.categories.some(c=>c.name==='DevOps'));
 const renamed=await api.execute('rename_category',{old_name:'DevOps',new_name:'Platform Engineering'});
 assert.equal(renamed,'Platform Engineering');
 d=await api.loadData();assert.equal(d.versions.find(v=>v.prompt_id===customId).category,'Platform Engineering');
 assert.ok(d.categories.some(c=>c.name==='Platform Engineering'));
 assert.ok(!d.categories.some(c=>c.name==='DevOps'));
 await assert.rejects(api.execute('rename_category',{old_name:'Missing',new_name:'Other'}),/not found/);
 const dupeId=await api.execute('copy_prompt',{pid:customId,target_team_id:null});
 d=await api.loadData();assert.equal(d.versions.find(v=>v.prompt_id===dupeId).title,body.title+' - copy');
 // Existing team prompts cannot be directly edited, but managers review suggestions.
 const teamPrompt=d.prompts.find(p=>p.owner_team_id===d.members.find(m=>m.user_id===api.demoIdentity.id).team_id);
 const officialId=teamPrompt.official_version_id;
 await assert.rejects(api.execute('save_prompt_version',{pid:teamPrompt.id,payload:{...body,title:'Direct edit blocked'},note:'Direct edit'}),/suggested and approved/);
 const proposalId=await api.execute('propose_improvement',{pid:teamPrompt.id,payload:{...body,category:'Compliance',title:'Suggested revision'},explanation:'Improve clarity'});
 d=await api.loadData();assert.ok(d.categories.some(c=>c.name==='Compliance'));
 assert.equal(d.prompts.find(p=>p.id===teamPrompt.id).official_version_id,officialId);
 await api.execute('set_proposal_under_review',{proposal_id:proposalId});
 const newId=await api.execute('review_improvement_proposal',{proposal_id:proposalId,accept:true,reason:''});
 await api.execute('review_prompt_version',{vid:newId,approve:true,reason:''});
 d=await api.loadData();assert.equal(d.prompts.find(p=>p.id===teamPrompt.id).official_version_id,newId);
 // Hard-delete must require Trash, remove versions/proposals, and preserve independent copies.
 await assert.rejects(api.execute('permanently_delete_prompt',{pid:customId}),/Trash/);
 await api.execute('soft_delete_prompt',{pid:customId,recover:false});
 await api.execute('permanently_delete_prompt',{pid:customId});
 d=await api.loadData();
 assert.ok(!d.prompts.some(p=>p.id===customId));
 assert.ok(!d.versions.some(v=>v.prompt_id===customId));
 assert.ok(d.prompts.some(p=>p.id===dupeId));
 assert.equal(d.prompts.find(p=>p.id===dupeId).source_prompt_id,null);
 await api.execute('soft_delete_prompt',{pid:teamPrompt.id,recover:false});
 await api.execute('permanently_delete_prompt',{pid:teamPrompt.id});
 d=await api.loadData();
 assert.ok(!d.prompts.some(p=>p.id===teamPrompt.id));
 assert.ok(!d.versions.some(v=>v.prompt_id===teamPrompt.id));
 assert.ok(!d.proposals.some(pr=>pr.prompt_id===teamPrompt.id));

 console.log('PASS: demo CRUD, categories, copy suffix, team suggestions and permanent deletion');
})().catch(err=>{console.error(err);process.exitCode=1});
