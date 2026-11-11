const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const compiled=ts.transpileModule(read('src/utils/promptImpact.ts'),{fileName:'promptImpact.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandboxModule={exports:{}};
vm.runInNewContext(`(function(module,exports,require){${compiled}\n})`)(sandboxModule,sandboxModule.exports,(name)=>{
  if(name==='./usageStats')return {blankUsage:()=>({opens:0,copies:0,combines:0,unique_users:0,last_used:null})};
  throw new Error('Unexpected import '+name);
});
const {summarizeMyImpact}=sandboxModule.exports;
const now=new Date('2026-11-09T12:00:00Z').getTime();
const e=(prompt_id,actor_id,event_type,minutesAgo=2)=>({prompt_id,actor_id,event_type,occurred_at:new Date(now-minutesAgo*60000).toISOString()});
const prompts=[
  {id:'p1',created_by:'me',deleted_at:null},
  {id:'p2',created_by:'someone-else',deleted_at:null},
  {id:'p3',created_by:'someone-else',deleted_at:null},
  {id:'p4',created_by:'someone-else',deleted_at:null},
  {id:'p5',created_by:'me',deleted_at:new Date().toISOString()},
];
const versions=[{prompt_id:'p1',author_id:'me'},{prompt_id:'p2',author_id:'me'},{prompt_id:'p2',author_id:'me'}];
const proposals=[{prompt_id:'p3',author_id:'me',status:'accepted'},{prompt_id:'p4',author_id:'me',status:'rejected'}];
const events=[e('p1','me','open'),e('p1','other1','open'),e('p2','other1','copy'),e('p3','other2','combine'),e('p4','other1','copy'),e('p5','other2','open'),e('p1','other1','open',60000)];
const noSelf=summarizeMyImpact(events,prompts,versions,proposals,'me',false,30,now);
assert.deepEqual([noSelf.prompts_total,noSelf.prompts_created,noSelf.prompts_contributed],[3,1,2]);
assert.deepEqual([noSelf.opens,noSelf.copies,noSelf.combines,noSelf.unique_users],[1,1,1,2]);
const withSelf=summarizeMyImpact(events,prompts,versions,proposals,'me',true,30,now);
assert.deepEqual([withSelf.opens,withSelf.unique_users],[2,3]);
const noEvents=summarizeMyImpact(events,prompts,versions,proposals,'me',false,1,now-2*86400000);
assert.equal(noEvents.opens,0);
const sql=read('supabase/015_personal_prompt_impact.sql');
for(const t of ['get_my_prompt_impact','private.require_ready()','private.can_read_prompt(p.id)',"pr.status='accepted'",'count(distinct e.actor_id)','get_my_prompt_impact.include_self','grant execute on function public.get_my_prompt_impact'])assert.ok(sql.includes(t),`SQL missing ${t}`);
assert.doesNotMatch(sql,/grant select on public\.prompt_usage_events/i);
const app=read('src/App.tsx');
assert.doesNotMatch(app,/TeamUsageInsights|PromptUsageInsights/);
assert.match(app,/usageRevision=\{usageRevision\}/);
assert.match(app,/trackUsage\(p\.id,'open'\)/);
assert.match(app,/trackUsage\(p\.id,'copy'\)/);
assert.match(app,/trackUsage\(p\.id,'combine'\)/);
const detail=read('src/components/prompts/PromptDetail.tsx');
assert.doesNotMatch(detail,/PromptUsageInsights/);
assert.match(detail,/onTrackUsage\('copy'\)/);
const settings=read('src/components/account/AccountSettings.tsx');
assert.match(settings,/<MyImpactInsights revision=\{usageRevision\}\/>/);
const insights=read('src/components/insights/UsageInsights.tsx');
assert.match(insights,/Include my own activity/);
assert.doesNotMatch(insights,/export function (PromptUsageInsights|TeamUsageInsights)/);
for(const filename of ['src/App.tsx','src/components/account/AccountSettings.tsx','src/components/insights/UsageInsights.tsx','src/components/prompts/PromptDetail.tsx','src/services/usageInsights.ts','src/utils/promptImpact.ts','e2e/collections-usage.spec.ts']){
 const sf=ts.createSourceFile(filename,read(filename),ts.ScriptTarget.Latest,true,filename.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(sf.parseDiagnostics.length,0,`Syntax problem in ${filename}: ${sf.parseDiagnostics.map(x=>x.messageText).join(', ')}`);
}
console.log('PASS: aggregated personal impact, attribution, deduplication, privacy and TypeScript syntax');
