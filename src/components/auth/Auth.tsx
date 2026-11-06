import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Sparkles } from 'lucide-react';
import { client, isDemo, resetPassword, signIn, signUp, updatePassword } from '../../services/api';
import { accessRequestMailto, isEmailAddress } from '../../utils/sharing';
import type { Identity } from '../../types';
import { Button, Logo } from '../ui';

export function Auth({authRoute,onModeChange,onLogin,onGuest,onDemo,busy,message,onNotice}:{authRoute:'login'|'signup';onModeChange:(mode:'login'|'signup')=>void;onLogin:(u:Identity)=>void;onGuest:()=>void;onDemo:()=>void;busy:boolean;message:(s:string)=>void;onNotice:(s:string)=>void}){
  const sharedLink = new URLSearchParams(window.location.search);
  const sharedPromptId = sharedLink.get('prompt');
  const sharedFrom = sharedLink.get('from') || '';
  const accessContact = isEmailAddress(sharedFrom) ? sharedFrom : null;
  const [mode,setMode]=useState<'login'|'signup'|'reset'|'update'>(authRoute);
  useEffect(()=>{setMode(authRoute)},[authRoute]);
  const openAuthPage=(next:'login'|'signup')=>{setMode(next);onModeChange(next)};
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [name,setName]=useState('');
  const [working,setWorking]=useState(false);
  useEffect(()=>{if(!client)return;const {data}=client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setMode('update')});return()=>data.subscription.unsubscribe()},[]);
  async function submit(e:FormEvent){e.preventDefault();setWorking(true);try{
    if(mode==='login'){if(isDemo){onDemo();return;}const res=await signIn(email,password);if(res.user)onLogin({id:res.user.id,email:res.user.email||email});}
    if(mode==='signup'){if(isDemo){onDemo();return;}await signUp(email,password,name);onNotice('Check your email to verify your new account, then sign in.');openAuthPage('login');}
    if(mode==='reset'){if(isDemo){onNotice('Password resets require Supabase to be configured.');return;}await resetPassword(email);onNotice('If this account exists, a password reset link has been sent.');openAuthPage('login');}
    if(mode==='update'){await updatePassword(password);onNotice('Password updated. Please sign in.');openAuthPage('login');}
  }catch(err){message(err instanceof Error?err.message:'Unable to sign in.')}finally{setWorking(false)}}
  return <div className="auth-layout">
  <div className="auth-card"><div className="auth-mini-brand"><Logo/></div><h2>{mode==='login'?'Sign in to continue':mode==='signup'?'Create your account':mode==='reset'?'Reset your password':'Choose a new password'}</h2><p className="auth-sub">{mode==='login'?'':mode==='signup'?'Registration is invite-only. Use an approved email address.':'We’ll help you get back to your prompts.'}</p>
  {sharedPromptId&&<div className="auth-share-access"><strong>A prompt was shared with you.</strong><p>Sign in to view it. Your account also needs permission to access the prompt's library.</p>
    {accessContact&&<a href={accessRequestMailto(accessContact,'a shared prompt')}>Request access by email <ArrowUpRight size={13}/></a>}
  </div>}
  <form onSubmit={submit} className="auth-form">{mode==='signup'&&<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Alex Morgan"/></label>}{mode!=='update'&&<label>Work email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label>}{mode!=='reset'&&<label>Password<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label>}
  <Button type="submit" disabled={working||busy}>{working?'One moment…':mode==='login'?'Sign in':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Update password'} <ArrowRight size={16}/></Button></form>
  <div className="auth-links"><button onClick={()=>openAuthPage(mode==='login'?'signup':'login')}>{mode==='login'?'New here? Create an account':'Back to sign in'}</button>{mode==='login'&&!isDemo&&<button onClick={()=>setMode('reset')}>Forgot password?</button>}</div><div className="guest-choice">{isDemo&&<button type="button" className="demo-entry" onClick={onDemo}><Sparkles size={15}/> Try the full demo workspace</button>}<span>or</span><button type="button" className="guest-button" onClick={onGuest}><BookOpen size={16}/> Continue as guest <ArrowRight size={15}/></button><p>Preview sample prompts without an account. Guest access is view-only; company libraries remain private.</p></div></div></div>;
}
