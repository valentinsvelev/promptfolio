import { useState, type FormEvent } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button, Modal } from '../ui';

export type AccountStatistic = { label: string; value: number };
export function AccountSettings({name,email,statistics,onSaveName,onSavePassword,onClose}:{
  name:string;email:string;statistics:AccountStatistic[];
  onSaveName:(value:string)=>Promise<void>;onSavePassword:(value:string)=>Promise<void>;onClose:()=>void;
}) {
  const [displayName,setDisplayName]=useState(name);
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [working,setWorking]=useState<'name'|'password'|null>(null);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const close=()=>{if(!working)onClose()};
  async function saveName(event:FormEvent){
    event.preventDefault();const trimmed=displayName.trim();
    if(trimmed.length<2||trimmed.length>80){setError('Your name must be between 2 and 80 characters.');return;}
    setWorking('name');setError('');setFeedback('');
    try {await onSaveName(trimmed);setDisplayName(trimmed);setFeedback('Display name updated.');}
    catch(e){setError(e instanceof Error?e.message:'Could not update your name.');}
    finally{setWorking(null);}
  }
  async function savePassword(event:FormEvent){
    event.preventDefault();
    if(password.length<12){setError('Choose a password with at least 12 characters.');return;}
    if(password!==confirmPassword){setError('The passwords do not match.');return;}
    setWorking('password');setError('');setFeedback('');
    try {await onSavePassword(password);setPassword('');setConfirmPassword('');setFeedback('Password updated.');}
    catch(e){setError(e instanceof Error?e.message:'Could not update your password.');}
    finally{setWorking(null);}
  }
  return <Modal onClose={close} wide>
    <div className="settings-dialog">
      <div className="modal-header"><div><h2>Settings</h2><p>Account details and your Promptfolio library at a glance.</p></div>
        <button type="button" className="round-icon" aria-label="Close settings" onClick={close} disabled={!!working}><X size={19}/></button>
      </div>
      <div className="settings-dialog-scroll">
        <section aria-label="Portfolio statistics" className="settings-section">
          <div className="settings-section-heading"><h3>Library overview</h3><span>Only content you can access</span></div>
          <div className="settings-stat-grid">{statistics.map(s=><div className="settings-stat" key={s.label}><strong>{s.value.toLocaleString()}</strong><span>{s.label}</span></div>)}</div>
        </section>
        <div className="settings-forms">
          <form className="settings-form" onSubmit={saveName}>
            <h3>Personal details</h3><p>Update the name shown to your colleagues.</p>
            <label className="field">Display name<input required autoComplete="name" maxLength={80} minLength={2} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
            <label className="field">Email address<input type="email" value={email} readOnly aria-readonly="true" title="Email cannot be changed here"/></label>
            <Button type="submit" disabled={!!working||displayName.trim()===name}> {working==='name'?'Saving…':'Save name'} </Button>
          </form>
          <form className="settings-form" onSubmit={savePassword}>
            <h3>Security</h3><p>Choose a new password for your account.</p>
            <label className="field">New password<input type="password" required autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 12 characters"/></label>
            <label className="field">Confirm new password<input type="password" required autoComplete="new-password" minLength={12} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat your password"/></label>
            <Button type="submit" disabled={!!working||!password||!confirmPassword}> {working==='password'?'Updating…':'Update password'} </Button>
          </form>
        </div>
        {error&&<p role="alert" className="settings-feedback settings-feedback-error">{error}</p>}
        {feedback&&<p role="status" className="settings-feedback settings-feedback-success"><CheckCircle2 size={16}/>{feedback}</p>}
      </div>
    </div>
  </Modal>;
}
