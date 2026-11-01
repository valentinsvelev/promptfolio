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
assert.doesNotMatch(app,/className=\"active-filter-chip\"/);
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
assert.match(app,/RenameTeamDialog/);
assert.match(app,/execute\('rename_team'/);
assert.match(app,/onRenameTeam/);
assert.match(css,/html\[data-theme='dark'\]/);
console.log('PASS: UX, admin category editor, bulk alignment and hard-delete controls');

// Explore quick filters use the same state as the advanced Filters pop-up.
assert.match(app,/filter==='My teams' \? 'team'/);
assert.match(app,/filter==='All prompts' \|\| filter==='Personal'/);
assert.match(app,/className="prompt-quick-filters"/);
// The quick chips precede the Filters button, and no selected-filter bubbles appear above results.
const quickChipsPosition=app.indexOf('className="prompt-quick-filters"');
const filterButtonPosition=app.indexOf('data-tooltip="Filters"',quickChipsPosition);
assert.ok(quickChipsPosition>=0&&filterButtonPosition>quickChipsPosition);
assert.doesNotMatch(app,/active-filters-standalone/);
assert.match(app,/aria-pressed=\{selectedValue\}/);
assert.match(app,/onClick=\{\(\)=>facet\(quickFilterType,selectedValue\?'':option\.value\)\}/);
assert.match(css,/\.prompt-quick-filters\s*\{/);
assert.match(css,/html\[data-theme='dark'\] \.prompt-quick-filter/);

// Quick-select chips must represent categories/teams with visible prompts.
// Do not show an empty team or an unused configured category.
assert.match(app,/ownTeamList\.filter\(t=>quickFilterBase\.some\(p=>p\.owner_team_id===t\.id\)\)/);
assert.match(app,/const categoryOptions=\(prompts:Prompt\[\]\)=>/);
assert.match(app,/prompts\.map\(p=>official\(p\)\?\.category\)/);
assert.doesNotMatch(app,/\.\.\.data\.categories\.map\(c=>c\.name\)/);
assert.match(css,/\.prompt-quick-filters\s*\{[^}]*flex-wrap: wrap/s);
assert.match(css,/\.prompt-quick-filters\s*\{[^}]*overflow: visible/s);
assert.doesNotMatch(css,/\.prompt-quick-filters\s*\{[^}]*overflow-x:\s*auto/s);

console.log('PASS: direct category and team quick filters');

// 011: Team assignment and GitHub feedback must be server-mediated.
const apiSource=fs.readFileSync('src/api.ts','utf8');
const migration011=fs.readFileSync('supabase/011_team_transfer_and_feedback.sql','utf8');
const edgeSource=fs.readFileSync('supabase/functions/create-github-issue/index.ts','utf8');
// Create, Edit and Suggest: Title / Category / Team, then Tags / AI models.
assert.match(app,/editor-three-column-fields/);
assert.match(app,/editor-secondary-fields/);
const editorStart = app.indexOf('function PromptEditor(');
const editorEnd = app.indexOf('function PromptRow(', editorStart);
const editorSource = app.slice(editorStart, editorEnd);
const firstRow = editorSource.slice(editorSource.indexOf('className="field-grid editor-primary-fields'), editorSource.indexOf('className="field-grid editor-secondary-fields'));
const secondRow = editorSource.slice(editorSource.indexOf('className="field-grid editor-secondary-fields'), editorSource.indexOf('Prompt text <strong'));
assert.ok(firstRow.indexOf('Prompt title') < firstRow.indexOf('Category') && firstRow.indexOf('Category') < firstRow.indexOf('Assign to team'), 'First row should be title, category, team');
assert.ok(secondRow.indexOf('Tags') < secondRow.indexOf('Compatible AI models'), 'Second row should be tags then models');
assert.equal((editorSource.match(/Assign to team<\/span>/g) || []).length, 1, 'All modes share one team select');
assert.equal((secondRow.match(/Compatible AI models/g) || []).length, 1, 'All modes share one AI models field');
assert.match(css,/\.editor-primary-fields\.editor-three-column-fields/);
assert.match(css,/--pf-scrollbar-thumb/);
assert.match(app,/onAction\('draft'\)/);
assert.match(app,/propose_improvement_with_team/);
assert.match(app,/save_personal_prompt_and_team/);
assert.match(app,/localeCompare\(official\(b\)\?\.title/);
assert.match(app,/FeedbackDialog/);
assert.match(apiSource,/client\.functions\.invoke\('create-github-issue'/);
assert.match(migration011,/private\.is_manager\(pr\.target_team_id\)/);
assert.match(migration011,/private\.is_member\(target_team_id\)/);
assert.match(edgeSource,/auth\.auth\.getUser/);
assert.match(edgeSource,/github_issue_feedback_limits/);
assert.doesNotMatch(app,/GITHUB_ISSUES_TOKEN/);
console.log('PASS: team transfer approvals, alphabetical lists and secure feedback wiring');

// Favorites is a category-filtered library, and My teams supports a second,
// team-scoped category row without showing categories from unrelated teams.
assert.match(app,/filter==='All prompts' \|\| filter==='Personal' \|\| filter==='Favorites'/);
assert.match(app,/filter==='Favorites' \? accessible\.filter\(p=>data\.favorites\.some\(f=>f\.user_id===user\?\.id&&f\.prompt_id===p\.id\)\)/);
assert.match(app,/const selectedTeamCategories = quickFilterType==='team' && facets\.team/);
assert.match(app,/quickFilterBase\.filter\(p=>p\.owner_team_id===facets\.team\)/);
assert.match(app,/aria-label="Categories in selected team"/);
assert.match(app,/onClick=\{\(\)=>facet\('category',isSelected\?'':option\.value\)\}/);
assert.match(app,/k==='team'&&view==='explore'&&filter==='My teams'&&f\.team!==v/);
assert.match(app,/\.\.\.f,team:v,category:''/);
assert.match(css,/\.prompt-quick-filter-row\s*\{/);
assert.match(css,/\.prompt-quick-filter-subcategories\s*\{/);
console.log('PASS: Favorites categories and team-scoped secondary quick filters');
