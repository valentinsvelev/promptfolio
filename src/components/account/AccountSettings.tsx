import { useState, type FormEvent } from 'react';
import { Check, Compass, Heart, Layers, UserRound, Users, X, CheckCircle2 } from 'lucide-react';
import { Button, Modal } from '../ui';
import type { Filter } from '../../types';

const tabIcons = {
  'All prompts': Compass,
  'Personal': UserRound,
  'My teams': Users,
  'Other teams': Layers,
  'Favorites': Heart,
} satisfies Record<Filter, typeof Compass>;

export type AccountStatistic = { label: string; value: number };
export function AccountSettings({name,email,statistics,defaultExploreTab,tabOrder,onDefaultExploreTabChange,preferencesReady,onSaveName,onSavePassword,onClose}:{
  name:string;email:string;statistics:AccountStatistic[];
  defaultExploreTab:Filter;tabOrder:readonly Filter[];onDefaultExploreTabChange:(tab:Filter)=>Promise<void>;demoMode:boolean;preferencesReady:boolean;
  onSaveName:(value:string)=>Promise<void>;onSavePassword:(value:string)=>Promise<void>;onClose:()=>void;
}) {
  const [displayName,setDisplayName]=useState(name);
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [working,setWorking]=useState<'name'|'password'|null>(null);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const [preferenceBusy,setPreferenceBusy]=useState(false);
  const [preferenceError,setPreferenceError]=useState('');
  const [preferenceSaved,setPreferenceSaved]=useState(false);
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
  async function chooseDefault(tab:Filter){
    if(preferenceBusy||!preferencesReady||tab===defaultExploreTab)return;
    setPreferenceBusy(true);setPreferenceError('');setPreferenceSaved(false);
    try {await onDefaultExploreTabChange(tab);setPreferenceSaved(true);}
    catch(e){setPreferenceError(e instanceof Error?e.message:'Could not save Explore preference.');}
    finally{setPreferenceBusy(false);}
  }
  return <Modal onClose={close} wide>
    <div className="settings-dialog">
      <div className="modal-header"><div><h2>Settings</h2></div>
        <button type="button" className="round-icon" aria-label="Close settings" onClick={close} disabled={!!working}><X size={19}/></button>
      </div>
      <div className="settings-dialog-scroll">
        <section aria-label="Portfolio statistics" className="settings-section">
          <div className="settings-section-heading"><h3>Library overview</h3></div>
          <div className="settings-stat-grid">{statistics.map(s=><div className="settings-stat" key={s.label}><strong>{s.value.toLocaleString()}</strong><span>{s.label}</span></div>)}</div>
        </section>
        <section className="settings-section explore-settings" aria-label="Explore preferences">
          <div className="settings-section-heading explore-settings-header">
            <div><h3>Explore preferences</h3></div>
          </div>
          <div className="explore-preference-label">Select your starting tab</div>
          <div className="explore-default-options" role="radiogroup" aria-label="Default Explore tab">
            {tabOrder.map(tab=>{
              const Icon=tabIcons[tab];
              const active=defaultExploreTab===tab;
              return <button key={tab} type="button" role="radio" aria-checked={active}
                className={`explore-default-option ${active?'is-selected':''}`}
                disabled={!preferencesReady||preferenceBusy} onClick={()=>void chooseDefault(tab)}>
                <Icon size={17} aria-hidden="true"/><span>{tab}</span>
                <span className="explore-option-indicator" aria-hidden="true">{active?<Check size={13}/>:null}</span>
              </button>;
            })}
          </div>
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
