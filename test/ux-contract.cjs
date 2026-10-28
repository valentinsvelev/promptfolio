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
assert.match(app,/className=\"active-filter-chip\"/);
assert.match(app,/className="results-count"/);
assert.doesNotMatch(app,/className="results-in-heading"/);
assert.match(app,/className="prompt-toolbar"/);
assert.match(app,/data-tooltip="Filters"/);
assert.match(app,/data-tooltip="Keywords search"/);
assert.match(app,/data-tooltip=\{listified\?/);
assert.match(app,/data-tooltip=\{bulkExportOpen\?/);
assert.match(css,/--pf-result-toolbar-tooltip-delay/);
assert.match(app,/likes=\{guest\?0:likeCounts\[p\.id\]\|\|0\}/);
assert.match(app,/readOnly=\{guest\}/);
assert.match(css,/\.editor-scroll textarea\{min-height:88px/);
assert.match(sql,/where \(select auth\.uid\(\)\) is not null and private\.can_read_prompt\(p\.id\)/);
assert.match(sql,/grant execute on function public\.prompt_like_counts\(\) to authenticated/);
assert.doesNotMatch(sql,/grant execute[^;]+ to anon/i);
assert.match(app,/canSuggest=\{!guest&&canSuggest\(selected\)\}/);
assert.match(app,/Last updated by:/);
assert.match(app,/Prompts by category/);
assert.match(css,/\.admin-extras>\.admin-card>form/);
assert.match(app,/Create a new category/);
assert.doesNotMatch(app,/editor-create-category/);
assert.match(app,/onCopy=\{/);
assert.match(app,/view==='mine'&&\!mineTrash/);
assert.match(app,/function AdminCategories/);
assert.match(app,/detail-version-toolbar/);
// Compact category editor, aligned bulk text, safe permanent deletion and editor order.
assert.match(app,/className="admin-category-simple-form"/);
assert.match(app,/Select a category to rename/);
assert.match(app,/function askPermanentlyDelete/);
assert.match(app,/Delete permanently/);
assert.match(app,/permanently_delete_prompt/);
assert.match(css,/bulk-prompt-row\.is-selecting \.prompt-row-listified \.row-listify-body/);
assert.ok(app.indexOf('Prompt text <strong') < app.indexOf('Short description</span>'),'Description should follow prompt text');
assert.ok(app.indexOf('Export Markdown</button>') < app.indexOf('Duplicate</button>'),'Duplicate should follow Markdown export');
const hardDeleteSQL=fs.readFileSync('supabase/009_permanent_prompt_deletion.sql','utf8');
assert.match(hardDeleteSQL,/p\.deleted_at is null/);
assert.match(hardDeleteSQL,/private\.is_manager/);
assert.match(hardDeleteSQL,/revoke all on function public\.permanently_delete_prompt/);
console.log('PASS: UX, admin category editor, bulk alignment and hard-delete controls');

