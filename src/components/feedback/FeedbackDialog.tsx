import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import { submitGithubIssue } from '../../services/api';
import { Button, Modal } from '../ui';

export function FeedbackDialog({onClose,onSubmitted}:{onClose:()=>void;onSubmitted:(url:string)=>void}){
  const [kind,setKind]=useState<'bug'|'enhancement'>('bug');
  const [title,setTitle]=useState('');const [description,setDescription]=useState('');
  const [submitting,setSubmitting]=useState(false);const [error,setError]=useState('');const [issueUrl,setIssueUrl]=useState('');
  async function submit(e:FormEvent){
    e.preventDefault();setSubmitting(true);setError('');
    try{const url=await submitGithubIssue(kind,title.trim(),description.trim());setIssueUrl(url);onSubmitted(url)}
    catch(err){setError(err instanceof Error?err.message:'Could not create the GitHub issue.')}
    finally{setSubmitting(false)}
  }
  return <Modal onClose={()=>{if(!submitting)onClose()}}>
    <form className="feedback-dialog" onSubmit={submit}>
      <div className="modal-header"><div><h2>Report an issue or idea</h2><p>Your feedback will become an issue in the Promptfolio GitHub repository.</p></div><button type="button" className="round-icon pf-icon-tooltip" onClick={onClose} disabled={submitting} aria-label="Close"><X size={18}/></button></div>
      <div className="feedback-fields">
        <label className="field">Feedback type<select value={kind} onChange={e=>setKind(e.target.value as 'bug'|'enhancement')}><option value="bug">Report an issue</option><option value="enhancement">Suggest a feature</option></select></label>
        <label className="field">Short title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} minLength={5} required placeholder="Describe the issue or idea"/></label>
        <label className="field">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} minLength={15} required rows={5} placeholder="What happened, or what would you like improved?"/></label>
        <p className="feedback-privacy">GitHub issues in this repository are public. Do not include passwords, customer data, private prompt text, or other confidential information.</p>
        {issueUrl&&<p role="status" className="feedback-success">Issue created! <a href={issueUrl} target="_blank" rel="noopener noreferrer">View it on GitHub <ArrowUpRight size={14}/></a></p>}
        {error&&<p role="alert" className="form-error">{error}</p>}
      </div>
      <div className="modal-footer"><div><Button type="button" variant="outline" disabled={submitting} onClick={onClose}>{issueUrl?'Close':'Cancel'}</Button>{!issueUrl&&<Button disabled={submitting||title.trim().length<5||description.trim().length<15} type="submit">{submitting?'Submitting…':'Create GitHub issue'} <ArrowRight size={16}/></Button>}</div></div>
    </form>
  </Modal>;
}
