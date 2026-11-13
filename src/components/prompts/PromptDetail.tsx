import { useState } from 'react';
import { X, ArrowUpRight, Check, ChevronDown, Clipboard, ClipboardPlus, Clock3, Copy, FileClock, Heart, Mail, Pencil, FolderPlus } from 'lucide-react';
import type { Prompt, PromptVersion } from '../../types';
import { Avatar, Flag } from '../ui/LibraryPrimitives';
import { when } from '../../utils/format';
import { varsIn, sanitize, saveFile, labelize } from '../../utils/prompt';
import { combineClipboardText } from '../../utils/sharing';
import '../../styles/promptDetailBadges.css';
import '../../styles/promptVersionHistory.css';
import type { UsageAction } from '../../services/usageInsights';
export function PromptDetail({prompt,version,latest,history,owner,creator,lastEditor,canEdit,canSuggest,saved,onFavorite,onDuplicate,onShareEmail,onEdit,onSuggest,onLifecycle,onDelete,onShare,onRequest,onRestore,onArchive,onCompare,onDeprecate,onRecommend,recommended,isManager,readOnly,onClose,onAddToCollection,onTrackUsage}:{
  prompt:Prompt;version:PromptVersion;latest:PromptVersion|undefined;history:PromptVersion[];owner:string;creator:string;lastEditor:string;canEdit:boolean;canSuggest:boolean;saved:boolean;
  onFavorite:()=>void;onDuplicate:()=>void;onShareEmail:()=>void;onEdit:()=>void;onSuggest:()=>void;onLifecycle:()=>void;onDelete:()=>void;onShare:()=>void;onRequest:(id:string)=>void;onRestore:()=>void;onArchive:()=>void;onCompare:(id:string)=>void;onDeprecate:()=>void;onRecommend:()=>void;recommended:boolean;isManager:boolean;readOnly:boolean;onClose:()=>void;onAddToCollection:()=>void;onTrackUsage:(action:UsageAction)=>void;
}){
  const [variables,setVariables]=useState<Record<string,string>>({});const [copied,setCopied]=useState(false);const [historyOpen,setHistoryOpen]=useState(false);
  const variableNames=varsIn(version.content);
  const pending=!!latest && latest.id!==version.id && latest.approval_status==='under_review';
  async function copyPrompt(){let output=version.content;for(const [k,v] of Object.entries(variables))if(v.trim())output=output.replaceAll(`{{${k}}}`,v.trim());try{await navigator.clipboard.writeText(output);onTrackUsage('copy');setCopied(true);setTimeout(()=>setCopied(false),2200)}catch{saveFile('prompt.txt',output)}}
  async function combinePrompt(){
    let output=version.content;
    for(const [k,v] of Object.entries(variables))if(v.trim())output=output.replaceAll(`{{${k}}}`,v.trim());
    try{const previous=await navigator.clipboard.readText();await navigator.clipboard.writeText(combineClipboardText(previous,output));onTrackUsage('combine');setCopied(true);setTimeout(()=>setCopied(false),2200)}
    catch{window.alert('Unable to read the clipboard. Allow clipboard access for this site and try again. Your clipboard was not replaced by Promptfolio.')}
  }
  const exports={...version,owner,prompt_id:prompt.id};
  return <div className="detail-inner" key={prompt.id+version.id}>
  <div className="detail-scroll"><div className="status-row"><Flag>{prompt.owner_team_id?`Team: ${owner}`:'Personal'}</Flag><Flag>Category: {version.category}</Flag>{version.approval_status==='approved'&&<span className="detail-approved-check pf-icon-tooltip" role="img" aria-label="Approved" data-tooltip="Approved" tabIndex={0}><Check size={18} strokeWidth={2.8}/></span>}<button type="button" className="detail-mobile-close" aria-label="Back" title="Back to prompts" onClick={onClose}><X size={20} strokeWidth={2} aria-hidden="true"/></button></div>
    <h2 className="detail-title">{version.title}</h2><p className="detail-description">{version.description}</p>
    <div className="detail-version-toolbar"><span className="detail-version-meta">V{version.version_number} <span className="meta-bullet">·</span> {when(version.created_at)}</span><div className="detail-icon-actions"><button type="button" className="pf-icon-tooltip" aria-label="Copy prompt" onClick={copyPrompt}>{copied?<Check size={16}/>:<Copy size={16}/>}</button><button type="button" className="pf-icon-tooltip" aria-label="Combine to Clipboard" onClick={combinePrompt}><ClipboardPlus size={16}/></button>{!readOnly&&<button type="button" className="pf-icon-tooltip" aria-label="Send via email" onClick={onShareEmail}><Mail size={16}/></button>}{canEdit&&!prompt.owner_team_id?<button type="button" className="pf-icon-tooltip" aria-label="Edit prompt" onClick={onEdit}><Pencil size={16}/></button>:canSuggest?<button type="button" className="pf-icon-tooltip" aria-label="Suggest an edit" onClick={onSuggest}><Pencil size={16}/></button>:null}{!readOnly&&<button type="button" className="pf-icon-tooltip" aria-label="Add to collection" onClick={onAddToCollection}><FolderPlus size={16}/></button>}{!readOnly&&<button type="button" className={`pf-icon-tooltip ${saved?'saved':''}`} aria-label={saved?'Remove favorite':'Add to favorites'} onClick={onFavorite}><Heart size={16} fill={saved?'currentColor':'none'}/></button>}</div></div>
    {pending&&<div className="review-alert"><Clock3 size={16}/><span>A newer version is awaiting approval. This is the current official version.</span></div>}
    <div className="detail-section-label"><span>The prompt</span></div><pre className="code-preview">{version.content}</pre>
    {variableNames.length>0&&<div className="variables"><div className="detail-section-label"><span>Customize the prompt</span><span>{variableNames.length} field{variableNames.length===1?'':'s'}</span></div><div className="variables-grid">{variableNames.map(n=><label className="field" key={n}>{labelize(n)}<input value={variables[n]||''} onChange={e=>setVariables(v=>({...v,[n]:e.target.value}))} placeholder={`Enter ${n.replaceAll('_',' ')}`}/></label>)}</div></div>}
    {version.usage_instructions&&<><div className="detail-section-label">How to use</div><p className="detail-body-copy">{version.usage_instructions}</p></>}
    {version.example_inputs&&<><div className="detail-section-label">Example input</div><p className="detail-body-copy">{version.example_inputs}</p></>}
    {version.expected_outputs&&<><div className="detail-section-label">Expected output</div><p className="detail-body-copy">{version.expected_outputs}</p></>}
    {(version.tags.length>0||version.compatible_models.length>0)&&<>
      {version.tags.length>0&&<h3 className="detail-section-label">Tags</h3>}
      <div className="tag-row" style={version.tags.length>0?{marginTop:0}:undefined}>{version.tags.map(t=><span className="tag" key={t}>#{t}</span>)}{version.compatible_models.map(m=><span className="tag tag-model" key={m}>{m}</span>)}</div>
    </>}
    <h3 className="detail-section-label detail-information-heading">Additional information</h3>
    <div className="author-line author-line-before-history"><Avatar name={creator} small/><span className="author-line-meta">{history.length>1?<><span>Created by: <strong>{creator}</strong></span><span className="meta-bullet">·</span><span>Last updated by: <strong>{lastEditor}</strong></span></>:<span>Created by: <strong>{creator}</strong></span>}</span></div>
    {canEdit&&history.length>1&&<section className="prompt-version-history" aria-label="Version history">
      <button type="button" className="prompt-version-history-toggle" aria-expanded={historyOpen} aria-controls={`prompt-history-${prompt.id}`} onClick={()=>setHistoryOpen(x=>!x)}>
        <FileClock size={17} aria-hidden="true"/><span className="prompt-version-history-title">Version history</span><span className="prompt-version-history-count">{history.length} versions</span><ChevronDown size={16} className={historyOpen?'rotated':''} aria-hidden="true"/>
      </button>
      {historyOpen&&<div id={`prompt-history-${prompt.id}`} className="history-list">{history.map(v=><div className="history-item" key={v.id}><span><strong>Version {v.version_number}</strong><small>{v.change_note||'No change note'} · {when(v.created_at)}</small></span><span className="history-right"><button className="text-button" onClick={()=>onCompare(v.id)}>Compare</button><Flag tone={v.approval_status==='approved'?'green':v.approval_status==='under_review'?'amber':'neutral'}>{v.id===prompt.official_version_id?'Official · ':''}{v.approval_status.replace('_',' ')}</Flag>{v.id===latest?.id&&v.approval_status==='experimental'&&prompt.owner_team_id&&<button className="text-button" onClick={()=>onRequest(v.id)}>Request review</button>}</span></div>)}</div>}
    </section>}
    <h3 className="detail-section-label detail-utilities-heading">Additional functionality</h3>
    <div className="detail-utilities"><button type="button" onClick={()=>saveFile(`${sanitize(version.title)}.json`,JSON.stringify(exports,null,2),'application/json')}><ArrowUpRight size={14}/> Export JSON</button><button type="button" onClick={()=>saveFile(`${sanitize(version.title)}.md`,`# ${version.title}\n\n${version.description}\n\n${version.content}\n`,'text/markdown')}><ArrowUpRight size={14}/> Export Markdown</button>{!readOnly&&<button type="button" onClick={onDuplicate}><Clipboard size={14}/> Duplicate</button>}{canEdit&&(!prompt.owner_team_id||isManager)&&<><button onClick={onLifecycle}>{prompt.lifecycle==='draft'?'Publish':prompt.lifecycle==='published'?'Move to draft':'Republish'}</button>{!!prompt.owner_user_id&&<button onClick={onShare}>Share to team</button>}{prompt.lifecycle!=='archived'&&<button onClick={onArchive}>Archive</button>}{isManager&&prompt.owner_team_id&&<><button onClick={onRecommend}>{recommended?'Remove recommendation':'Recommend'}</button><button className="danger-text" onClick={onDeprecate}>Deprecate</button></>}{prompt.deleted_at?<button onClick={onRestore}>Restore</button>:<button className="danger-text" onClick={onDelete}>Delete</button>}</>}</div>
  </div></div>;
}
