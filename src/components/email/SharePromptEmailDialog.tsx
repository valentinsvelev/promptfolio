import { useState } from 'react';
import { Check, CheckCircle2, Copy, RotateCcw, X } from 'lucide-react';
import { generatePromptEmail, type GeneratedPromptEmail, type PromptEmailTemplate, type PromptEmailTone } from './emailTemplates';
import type { Prompt, PromptVersion } from '../../types';
import { Button, Modal } from '../ui';

export function SharePromptEmailDialog({prompt,version,versions,senderEmail,senderName,onClose}:{
  prompt:Prompt;version:PromptVersion;versions:PromptVersion[];senderEmail:string;senderName:string;onClose:()=>void;
}){
  const [recipientName,setRecipientName]=useState('');
  const [tone,setTone]=useState<PromptEmailTone>('formal');
  const [template,setTemplate]=useState<PromptEmailTemplate>('share');
  const [versionId,setVersionId]=useState(version.id);
  const [draft,setDraft]=useState<GeneratedPromptEmail|null>(null);
  const [isOutdated,setIsOutdated]=useState(false);
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const chosenVersion=versions.find(v=>v.id===versionId)||version;

  function changeOptions(){
    setStatus('');
    setError('');
    setIsOutdated(current=>current||!!draft);
  }

  function generatePreview(){
    setError('');
    setStatus('');
    try{
      const link=new URL(import.meta.env.BASE_URL,window.location.origin);
      link.searchParams.set('prompt',prompt.id);
      link.searchParams.set('from',senderEmail);
      setDraft(generatePromptEmail({
        recipientName,tone,template,title:chosenVersion.title,
        description:chosenVersion.description,content:chosenVersion.content,
        versionNumber:chosenVersion.version_number,
        officialVersionNumber:version.version_number,
        promptUrl:link.toString(),senderName,
      }));
      setIsOutdated(false);
    }catch(err){setError(err instanceof Error?err.message:'Could not generate the preview.');}
  }

  async function copyDraft(){
    if(!draft||!draft.body.trim())return;
    setError('');setStatus('');
    try{
      await navigator.clipboard.writeText(draft.body);
      setStatus('Email text copied to the clipboard.');
    }catch{
      setError('Clipboard access was blocked. Select the email message above and copy it manually.');
    }
  }

  const previewState=isOutdated?'outdated':draft?'ready':'idle';
  return <Modal onClose={onClose} wide>
    <section className="share-email-dialog" aria-label="Generate email for prompt">
      <div className="modal-header"><div><h2>Generate an email for the selected prompt</h2></div><button type="button" className="round-icon pf-icon-tooltip" aria-label="Close email generator" onClick={onClose}><X size={19}/></button></div>
      <div className="share-email-body">
        <div className="share-email-control-row">
          <label className="field">Recipient name
            <input autoFocus type="text" value={recipientName} onChange={e=>{setRecipientName(e.target.value);changeOptions()}} maxLength={100} placeholder="e.g. Alex" autoComplete="off"/>
          </label>
          <div className="field share-email-tone-field"><span>Tone</span><div className="share-email-tone" role="group" aria-label="Email tone">
            <button type="button" aria-pressed={tone==='formal'} className={tone==='formal'?'is-selected':''} onClick={()=>{setTone('formal');changeOptions()}}>Formal</button>
            <button type="button" aria-pressed={tone==='casual'} className={tone==='casual'?'is-selected':''} onClick={()=>{setTone('casual');changeOptions()}}>Casual</button>
          </div></div>
          <label className="field">Prompt version
            <select value={versionId} onChange={e=>{setVersionId(e.target.value);changeOptions()}}>
              {versions.map(v=><option value={v.id} key={v.id}>Version {v.version_number}{v.id===prompt.official_version_id?' · official':''}</option>)}
            </select>
          </label>
          <div className="field share-email-preview-field"><span>Preview</span>
            {previewState==='outdated'
              ? <button type="button" className="share-email-refresh-button" onClick={generatePreview} disabled={!recipientName.trim()} title="Refresh preview" aria-label="Refresh preview"><RotateCcw size={16}/> Refresh preview</button>
              : <button type="button" className={`share-email-preview-trigger pf-icon-tooltip ${previewState==='ready'?'is-active':''}`} aria-label={previewState==='ready'?'Email preview generated':'Generate email preview'} onClick={generatePreview} disabled={!recipientName.trim()}><Check size={21}/></button>}
          </div>
        </div>
        <div className="field share-email-template-field"><span>Template</span><div className="share-email-template-options" role="group" aria-label="Email template">
          <button type="button" className={template==='share'?'is-selected':''} aria-pressed={template==='share'} onClick={()=>{setTemplate('share');changeOptions()}}>Share a prompt</button>
          <button type="button" className={template==='feedback'?'is-selected':''} aria-pressed={template==='feedback'} onClick={()=>{setTemplate('feedback');changeOptions()}}>Ask for feedback</button>
          <button type="button" className={template==='collaborate'?'is-selected':''} aria-pressed={template==='collaborate'} onClick={()=>{setTemplate('collaborate');changeOptions()}}>Invite to collaborate</button>
        </div></div>
        {draft&&<div className="share-email-editable">
          {isOutdated&&<p className="share-email-outdated" role="status">Your options changed. Refresh the preview to update the email while keeping your current edits visible until then.</p>}
          <label className="field">Email message<textarea rows={12} value={draft.body} onChange={e=>{setDraft(old=>old?{...old,body:e.target.value}:old);setStatus('')}} aria-label="Edit email message"/></label>
        </div>}
        {status&&<p className="share-email-status" role="status"><CheckCircle2 size={16}/>{status}</p>}
        {error&&<p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="modal-footer share-email-footer"><Button type="button" disabled={!draft||!draft.body.trim()} onClick={()=>void copyDraft()}><Copy size={16}/> Copy to Clipboard</Button></div>
    </section>
  </Modal>;
}
