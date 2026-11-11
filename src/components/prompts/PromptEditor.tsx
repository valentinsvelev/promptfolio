import { useState, type FormEvent } from 'react';
import { ArrowRight, ChevronDown, Lightbulb, X } from 'lucide-react';
import type { Prompt, PromptBody } from '../../types';
import { Button, Modal } from '../ui';

export type EditorMode='create'|'edit'|'suggest';
export type EditorState={mode:EditorMode; prompt?:Prompt};
export function PromptEditor({editor,body,teams,categoryNames,existingTitles,onClose,onSubmit,onAction,canManage,canDeprecate,saving}:{editor:EditorState;body:PromptBody;teams:{id:string;name:string}[];categoryNames:string[];existingTitles:string[];onClose:()=>void;onSubmit:(body:PromptBody,team:string|null,publish:boolean,note:string)=>Promise<void>;onAction:(action:'draft'|'share'|'archive'|'deprecate'|'trash')=>void;canManage:boolean;canDeprecate:boolean;saving:boolean}){
  const [draft,setDraft]=useState<PromptBody>(body);const [team,setTeam]=useState(editor.mode==='create'?'':editor.prompt?.owner_team_id||'');
  const [publish,setPublish]=useState(true);const [note,setNote]=useState('');const [error,setError]=useState('');const [categoryInput,setCategoryInput]=useState('');const [customCategory,setCustomCategory]=useState(false);
  const [tagsText,setTagsText]=useState(body.tags.join(', '));const [modelsText,setModelsText]=useState(body.compatible_models.join(', '));
  const set=(field:keyof PromptBody,value:string|string[])=>setDraft(old=>({...old,[field]:value}));
  const updateList=(field:'tags'|'compatible_models',value:string)=>{if(field==='tags')setTagsText(value);else setModelsText(value)};
  const similar = existingTitles.filter(t=>t.toLowerCase().trim()===draft.title.toLowerCase().trim()|| (draft.title.trim().length>10 && t.toLowerCase().includes(draft.title.toLowerCase().trim()))).slice(0,3);
  const title=editor.mode==='create'?'Create a prompt':editor.mode==='suggest'?'Suggest an improvement':'Edit prompt';
  async function submit(e:FormEvent){e.preventDefault();if(!draft.title.trim()||!draft.content.trim()){setError('A title and prompt text are required.');return}const category=customCategory?categoryInput.trim():draft.category;if(category.length<2||category.length>70){setError('Category must be between 2 and 70 characters.');return}setError('');await onSubmit({...draft,category,tags:tagsText.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean),compatible_models:modelsText.split(',').map(s=>s.trim()).filter(Boolean)},team||null,publish,note)}
  return <Modal onClose={onClose} wide><form className="editor" onSubmit={submit}>
    <div className="modal-header editor-modal-header"><div className="editor-header-content"><h2>{title}</h2>{editor.mode!=='create'&&canManage&&<div className="editor-header-actions">{editor.prompt?.lifecycle!=='draft'&&<button type="button" onClick={()=>onAction('draft')} disabled={saving}>Move to draft</button>}{editor.prompt?.owner_user_id&&<button type="button" onClick={()=>onAction('share')} disabled={saving}>Share to team</button>}{editor.prompt?.lifecycle!=='archived'&&<button type="button" onClick={()=>onAction('archive')} disabled={saving}>Archive</button>}{canDeprecate&&<button type="button" onClick={()=>onAction('deprecate')} disabled={saving}>Deprecate</button>}<button type="button" className="danger-text" onClick={()=>onAction('trash')} disabled={saving}>Delete</button></div>}</div><button className="round-icon pf-icon-tooltip" type="button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>
    <div className="editor-scroll">
      <div className="field-grid editor-primary-fields editor-three-column-fields">
        <label className="field"><span className="field-label">Prompt title<strong className="required">*</strong></span><input autoFocus required maxLength={150} value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Summarise a customer interview"/></label>
        <div className="field category-picker">
          <label className="field-label" htmlFor="prompt-category">Category</label>
          <div className="category-picker-control">
            {customCategory ? <>
              <input id="prompt-category" autoFocus required minLength={2} maxLength={70} placeholder="Enter new category name" value={categoryInput} onChange={e=>setCategoryInput(e.target.value)}/>
              <button type="button" className="category-picker-switch pf-icon-tooltip" aria-label="Choose an existing category" onClick={()=>{setCustomCategory(false);setCategoryInput('')}}><ChevronDown size={17}/></button>
            </> :
              <select id="prompt-category" value={draft.category} onChange={e=>{if(e.target.value==='__create__'){setCategoryInput('');setCustomCategory(true)}else{set('category',e.target.value)}}}>
                {[...new Set([...categoryNames,draft.category])].filter(Boolean).map(s=><option key={s} value={s}>{s}</option>)}
                <option value="__create__">+ Create a new category</option>
              </select>
            }
          </div>
        </div>
        <label className="field"><span className="field-label">Assign to team</span><select value={team} onChange={e=>setTeam(e.target.value)}>
          <option value="" disabled={!!editor.prompt?.owner_team_id}>{editor.prompt?.owner_team_id?'Select team':'Personal library (private)'}</option>
          {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
      </div>
      {similar.length>0&&editor.mode==='create'&&<p className="duplicate-hint"><Lightbulb size={15}/> Similar prompt already exists: {similar.join(', ')}. Check before duplicating.</p>}
      <div className="field-grid editor-secondary-fields">
        <label className="field"><span className="field-label">Tags <span className="hint">comma separated</span></span><input value={tagsText} onChange={e=>updateList('tags',e.target.value)} placeholder="writing, meetings"/></label>
        <label className="field"><span className="field-label">Compatible AI models <span className="hint">comma separated</span></span><input value={modelsText} onChange={e=>updateList('compatible_models',e.target.value)} placeholder="ChatGPT, Claude"/></label>
      </div>

    <label className="field"><span className="field-label">Prompt text <strong className="required">*</strong><span className="hint">Use # for headings, **bold** for emphasis, - for lists, and {'{{variable_name}}'} for fill-in fields.</span></span><textarea className="prompt-editor-textarea" required rows={9} value={draft.content} onChange={e=>set('content',e.target.value)} placeholder={'You are an expert at…\n\nReview {{document_text}} and return…'}/></label>
    <label className="field"><span className="field-label">Short description</span><textarea rows={2} value={draft.description} onChange={e=>set('description',e.target.value)} placeholder="What will this help someone achieve?"/></label>
    <label className="field"><span className="field-label">How to use</span><textarea rows={3} value={draft.usage_instructions} onChange={e=>set('usage_instructions',e.target.value)} placeholder="Tips for getting the best result"/></label>
    <div className="field-grid"><label className="field"><span className="field-label">Example input</span><textarea rows={2} value={draft.example_inputs} onChange={e=>set('example_inputs',e.target.value)}/></label><label className="field"><span className="field-label">Expected output</span><textarea rows={2} value={draft.expected_outputs} onChange={e=>set('expected_outputs',e.target.value)}/></label></div>
    {editor.mode==='create'&&<label className="toggle-line"><input type="checkbox" checked={publish} onChange={e=>setPublish(e.target.checked)}/><span><strong>Publish now</strong><small>Visibility follows the permissions of the selected library.</small></span></label>}
    {editor.mode==='suggest'&&editor.prompt?.owner_team_id&&team!==editor.prompt.owner_team_id&&<p className="field-hint">Changing the owning team requires a manager with approval rights in both teams. The prompt will remain in its current team until the proposal is approved.</p>}
    {editor.mode!=='create'&&<label className="field">{editor.mode==='suggest'?'Why is this improvement useful?':'What changed in this version?'}<input value={note} onChange={e=>setNote(e.target.value)} placeholder="A short explanation for reviewers"/></label>}
    {error&&<p className="form-error">{error}</p>}</div>
    <div className="modal-footer"><div><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving?'Saving…':editor.mode==='suggest'?'Submit suggestion':'Save prompt'} <ArrowRight size={16}/></Button></div></div>
  </form></Modal>;
}
