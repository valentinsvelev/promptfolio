// Standalone tests that do not require a Supabase project.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('src/utils/usageStats.ts');
const compiled=ts.transpileModule(source,{fileName:'usageStats.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandboxModule={exports:{}};vm.runInNewContext(`(function(module,exports){${compiled}\n})`)(sandboxModule,sandboxModule.exports);
const {summarizeUsage,summarizeTeamUsage}=sandboxModule.exports;
const now=new Date('2026-11-09T12:00:00Z').getTime();
const e=(prompt_id,actor_id,event_type,minutesAgo=2)=>({prompt_id,actor_id,event_type,occurred_at:new Date(now-minutesAgo*60000).toISOString()});
const events=[e('p1','creator','open'),e('p1','u1','open'),e('p1','u1','copy'),e('p1','u2','combine'),e('p2','u1','open'),e('p2','u1','copy'),e('p1','u1','copy',45000)];
const filtered=summarizeUsage(events.filter(x=>x.prompt_id==='p1'),'creator',false,30,now);
assert.equal(filtered.opens,1);assert.equal(filtered.copies,1);assert.equal(filtered.combines,1);assert.equal(filtered.unique_users,2);
assert.equal(summarizeUsage(events.filter(x=>x.prompt_id==='p1'),'creator',true,30,now).opens,2);
const team=summarizeTeamUsage(events,[{id:'p1',created_by:'creator',title:'Alpha'},{id:'p2',created_by:'u2',title:'Beta'},{id:'p3',created_by:'u3',title:'Never used'}],false,30,now);
assert.equal(team.summary.opens,2);assert.equal(team.summary.copies,2);assert.equal(team.summary.unique_users,2);
assert.equal(team.not_copied,1);assert.equal(team.top_prompts[0].title,'Alpha');
const sql=read('supabase/014_collections_and_usage_insights.sql');
for(const phrase of ['enable row level security','collection_items_read','collection_read','create function public.create_prompt_collection','create function public.record_prompt_usage','create function public.get_prompt_usage_insights','create function public.get_team_usage_insights','grant select on public.prompt_collections,public.prompt_collection_items','revoke all on public.prompt_usage_events','e.actor_id<>p.created_by','create function public.purge_old_prompt_usage_events'])assert.ok(sql.includes(phrase),`Missing SQL: ${phrase}`);
assert.doesNotMatch(sql,/grant select on public\.prompt_usage_events/i,'Raw events must not be readable');
const app=read('src/App.tsx');
assert.match(app,/onSelect=\{\(\)=>\{setSelectedId\(p\.id\);setShowMobileDetail\(true\);trackUsage\(p\.id,'open'\)/);
assert.match(app,/trackUsage\(p\.id,'copy'\)/);
assert.match(app,/trackUsage\(p\.id,'combine'\)/);
assert.match(app,/view==='collections'&&user&&<CollectionsPage/);
assert.doesNotMatch(app,/TeamUsageInsights/);
const detail=read('src/components/prompts/PromptDetail.tsx');
assert.match(detail,/onTrackUsage\('copy'\)/);assert.match(detail,/onTrackUsage\('combine'\)/);
assert.doesNotMatch(detail,/PromptUsageInsights/);
const files=['src/App.tsx','src/types/index.ts','src/utils/routes.ts','src/services/collections.ts','src/services/usageInsights.ts','src/utils/usageStats.ts','src/components/collections/CollectionsPage.tsx','src/components/collections/AddToCollectionDialog.tsx','src/components/insights/UsageInsights.tsx','src/components/account/AccountSettings.tsx','src/utils/promptImpact.ts','src/components/prompts/PromptDetail.tsx','e2e/collections-usage.spec.ts'];
for(const filename of files){
  const text=read(filename),sf=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true,filename.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(sf.parseDiagnostics.length,0,`TypeScript syntax errors in ${filename}: ${sf.parseDiagnostics.map(d=>d.messageText).join(', ')}`);
}
console.log('PASS: legacy aggregation utilities, SQL 014 privacy contracts, event tracking and TypeScript syntax');
