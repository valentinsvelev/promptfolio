/* Source and sample-data assertions for the new UX. Does not replace browser tests. */
const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm'),ts=require('typescript');
const app=fs.readFileSync('src/App.tsx','utf8');const css=fs.readFileSync('src/styles.css','utf8');
const sql=fs.readFileSync('supabase/003_guest_and_likes.sql','utf8');
for(const [name,text,opts] of [['App.tsx',app,{jsx:ts.JsxEmit.ReactJSX}],['api.ts',fs.readFileSync('src/api.ts','utf8'),{}]]){
 const result=ts.transpileModule(text,{fileName:name,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,...opts}});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`${name} must parse`);
}
assert.match(app,/\[guest,setGuest\]/);assert.match(app,/guestSampleData\(\)/);
assert.match(app,/const selected=selectedId\?searchable\.find/);
assert.doesNotMatch(app,/\|\|searchable\[0\]/);
assert.match(app,/aria-label=\{guest\?\'Sample prompt count\':\'Accessible prompt counts\'\}/);
assert.match(app,/\{!guest&&<><div className="hero-stat-row"/);
assert.match(app,/className=\"active-filter-chip\"/);
assert.match(app,/className=\"results-in-heading\"/);
assert.match(app,/likes=\{guest\?0:likeCounts\[p\.id\]\|\|0\}/);
assert.match(app,/readOnly=\{guest\}/);
assert.match(css,/\.editor-scroll textarea\{min-height:88px/);
assert.match(sql,/where \(select auth\.uid\(\)\) is not null and private\.can_read_prompt\(p\.id\)/);
assert.match(sql,/grant execute on function public\.prompt_like_counts\(\) to authenticated/);
assert.doesNotMatch(sql,/grant execute[^;]+ to anon/i);
console.log('PASS: new UX source, guest isolation, mandatory-field display, filters, unselected preview, likes policy');
