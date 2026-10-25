import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, Check, CheckCircle2, ChevronDown,
  ChevronRight, Clipboard, Clock3, Copy, FileClock, FileText, FolderClosed, Heart,
  LayoutGrid, Lightbulb, LockKeyhole, LogOut, Menu, MoreHorizontal, Plus, RotateCcw,
  Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Tag, Trash2, Users,
  X, type LucideIcon,
} from 'lucide-react';
import {accountAdmin, changePassword, client, demoIdentity, execute, favorite, guestSampleData, identity, isDemo, loadData, loadLikeCounts, resetPassword, signIn, signOut, signUp, updatePassword} from './api';
import {blankBody, emptyData, type AppData, type Filter, type Identity, type Member, type Prompt, type PromptBody, type PromptVersion, type Proposal, type ReviewItem, type View} from './types';
import packageInfo from '../package.json';

// Injected by Vite for both local development and GitHub Pages builds.
declare const __PROMPTFOLIO_BUILD_DATE__: string;

const categories: Record<string, { icon: LucideIcon; tone: string }> = {
  Writing: {icon: FileText, tone:'lilac'},
  Research: {icon: Search,tone:'sand'},
  Analysis: {icon: LayoutGrid,tone:'sky'},
  Engineering:{icon: Settings2,tone:'slate'},
  Marketing:{icon: Sparkles,tone:'peach'},
  Productivity:{icon: Clock3,tone:'mint'},
  General:{icon: Lightbulb,tone:'lilac'},
};
const when=(iso?:string)=>iso?new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso)):'—';
const initials=(name:string)=>name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
const varsIn=(text:string)=>[...new Set([...text.matchAll(/\{\{([A-Za-z][\w]*)\}\}/g)].map(m=>m[1]))];
const sanitize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'prompt';
const labelize=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function saveFile(name:string,text:string,type='text/plain') {const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}

function Logo(){return <span className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span><span>promptfolio<span className="brand-period">.</span></span></span>}
function Button({children,variant='primary',className='',...props}:{children:ReactNode;variant?:'primary'|'outline'|'ghost'|'soft';className?:string} & ButtonHTMLAttributes<HTMLButtonElement>){return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>}
function Modal({children,onClose,wide=false}:{children:ReactNode;onClose:()=>void;wide?:boolean}){
  useEffect(()=>{const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',f);document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',f);document.body.style.overflow=''}},[onClose]);
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true">{children}</section></div>;
}
function Avatar({name,small=false}:{name:string;small?:boolean}){return <span className={`avatar ${small?'avatar-small':''}`}>{initials(name)||'U'}</span>}
function Empty({title,description,icon:Icon=BookOpen,action}:{title:string;description:string;icon?:LucideIcon;action?:ReactNode}){return <div className="empty"><div className="empty-symbol"><Icon size={22}/></div><h3>{title}</h3><p>{description}</p>{action}</div>}
function Flag({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'green'|'violet'|'amber'}){return <span className={`flag flag-${tone}`}>{children}</span>}
function IconTile({category}:{category:string}){const item=categories[category]||categories.General;const Icon=item.icon;return <span className={`icon-tile tone-${item.tone}`}><Icon size={18} strokeWidth={1.8}/></span>}

function Auth({onLogin,onGuest,onDemo,busy,message,onNotice}:{onLogin:(u:Identity)=>void;onGuest:()=>void;onDemo:()=>void;busy:boolean;message:(s:string)=>void;onNotice:(s:string)=>void}){
  const [mode,setMode]=useState<'login'|'signup'|'reset'|'update'>('login');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [name,setName]=useState('');
  const [working,setWorking]=useState(false);
  useEffect(()=>{if(!client)return;const {data}=client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setMode('update')});return()=>data.subscription.unsubscribe()},[]);
  async function submit(e:FormEvent){e.preventDefault();setWorking(true);try{
    if(mode==='login'){if(isDemo){onDemo();return;}const res=await signIn(email,password);if(res.user)onLogin({id:res.user.id,email:res.user.email||email});}
    if(mode==='signup'){if(isDemo){onDemo();return;}await signUp(email,password,name);onNotice('Check your email to verify your new account, then sign in.');setMode('login');}
    if(mode==='reset'){if(isDemo){onNotice('Password resets require Supabase to be configured.');return;}await resetPassword(email);onNotice('If this account exists, a password reset link has been sent.');setMode('login');}
    if(mode==='update'){await updatePassword(password);onNotice('Password updated. Please sign in.');setMode('login');}
  }catch(err){message(err instanceof Error?err.message:'Unable to sign in.')}finally{setWorking(false)}}
  return <div className="auth-layout">
  <div className="auth-card"><div className="auth-mini-brand"><Logo/></div><h2>{mode==='login'?'Sign in to continue':mode==='signup'?'Create your account':mode==='reset'?'Reset your password':'Choose a new password'}</h2><p className="auth-sub">{mode==='login'?'Your prompt library is a sign-in away.':mode==='signup'?'Registration is invite-only. Use an approved email address.':'We’ll help you get back to your prompts.'}</p>
  <form onSubmit={submit} className="auth-form">{mode==='signup'&&<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Alex Morgan"/></label>}{mode!=='update'&&<label>Work email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label>}{mode!=='reset'&&<label>Password<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label>}
  <Button type="submit" disabled={working||busy}>{working?'One moment…':mode==='login'?'Sign in':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Update password'} <ArrowRight size={16}/></Button></form>
  <div className="auth-links"><button onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'New here? Create an account':'Back to sign in'}</button>{mode==='login'&&!isDemo&&<button onClick={()=>setMode('reset')}>Forgot password?</button>}</div><div className="guest-choice">{isDemo&&<button type="button" className="demo-entry" onClick={onDemo}><Sparkles size={15}/> Try the full demo workspace</button>}<span>or</span><button type="button" className="guest-button" onClick={onGuest}><BookOpen size={16}/> Continue as guest <ArrowRight size={15}/></button><p>Preview sample prompts without an account. Guest access is view-only; company libraries remain private.</p></div></div></div>;
}

function MarkdownPreview({content}:{content:string}){
  return <div className="md-rendered">{content.split('\n').map((line,i)=>{
    if(line.startsWith('## '))return <h4 key={i}>{line.slice(3)}</h4>;
    if(line.startsWith('# '))return <h3 key={i}>{line.slice(2)}</h3>;
    if(line.startsWith('- '))return <div key={i} className="md-list">• {line.slice(2)}</div>;
    return <p key={i}>{line||'\u00a0'}</p>;
  })}</div>;
}
type EditorMode='create'|'edit'|'suggest';
type EditorState={mode:EditorMode; prompt?:Prompt};
function PromptEditor({editor,body,teams,categoryNames,existingTitles,onNewCategory,onClose,onSubmit,saving}:{editor:EditorState;body:PromptBody;teams:{id:string;name:string}[];categoryNames:string[];existingTitles:string[];onNewCategory:(name:string)=>Promise<void>;onClose:()=>void;onSubmit:(body:PromptBody,team:string|null,publish:boolean,note:string)=>Promise<void>;saving:boolean}){
  const [draft,setDraft]=useState<PromptBody>(body);const [team,setTeam]=useState(editor.mode==='create'?'':editor.prompt?.owner_team_id||'');
  const [publish,setPublish]=useState(true);const [note,setNote]=useState('');const [error,setError]=useState('');const [categoryInput,setCategoryInput]=useState('');
  const [tagsText,setTagsText]=useState(body.tags.join(', '));const [modelsText,setModelsText]=useState(body.compatible_models.join(', '));
  const set=(field:keyof PromptBody,value:string|string[])=>setDraft(old=>({...old,[field]:value}));
  const updateList=(field:'tags'|'compatible_models',value:string)=>{if(field==='tags')setTagsText(value);else setModelsText(value)};
  const similar = existingTitles.filter(t=>t.toLowerCase().trim()===draft.title.toLowerCase().trim()|| (draft.title.trim().length>10 && t.toLowerCase().includes(draft.title.toLowerCase().trim()))).slice(0,3);
  const title=editor.mode==='create'?'Create a prompt':editor.mode==='suggest'?'Suggest an improvement':'Edit prompt';
  const sub=editor.mode==='suggest'?'The original stays unchanged. A team manager will review your proposal.':editor.mode==='edit'?'Save a new version without losing the previous one.':'';
  async function submit(e:FormEvent){e.preventDefault();if(!draft.title.trim()||!draft.content.trim()){setError('A title and prompt text are required.');return}setError('');await onSubmit({...draft,tags:tagsText.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean),compatible_models:modelsText.split(',').map(s=>s.trim()).filter(Boolean)},team||null,publish,note)}
  return <Modal onClose={onClose} wide><form className="editor" onSubmit={submit}>
    <div className="modal-header"><div><h2>{title}</h2><p>{sub}</p></div><button className="round-icon" type="button" aria-label="Close" onClick={onClose}><X size={20}/></button></div>
    <div className="editor-scroll"><div className="field-grid"><label className="field"><span className="field-label">Prompt title<strong className="required">*</strong></span><input autoFocus required maxLength={150} value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Summarise a customer interview"/></label><label className="field">Category<select value={draft.category} onChange={e=>set('category',e.target.value)}>{[...new Set([...categoryNames,draft.category])].map(s=><option key={s}>{s}</option>)}</select></label></div>
    <div className="editor-create-category"><input aria-label="New category" placeholder="Custom category" value={categoryInput} onChange={e=>setCategoryInput(e.target.value)}/><Button type="button" variant="outline" onClick={async()=>{if(categoryInput.trim()){await onNewCategory(categoryInput.trim());set('category',categoryInput.trim());setCategoryInput('');}}}>Add category</Button></div>
    {similar.length>0&&editor.mode==='create'&&<p className="duplicate-hint"><Lightbulb size={15}/> Similar prompt already exists: {similar.join(', ')}. Check before duplicating.</p>}
    <label className="field"><span className="field-label">Short description</span><textarea rows={2} value={draft.description} onChange={e=>set('description',e.target.value)} placeholder="What will this help someone achieve?"/></label>
    {editor.mode==='create'&&<div className="field-grid"><label className="field">Save to<select value={team} onChange={e=>setTeam(e.target.value)}><option value="">Personal library (private)</option>{teams.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><label className="field"><span className="field-label">Tags <span className="hint">comma separated</span></span><input value={tagsText} onChange={e=>updateList('tags',e.target.value)} placeholder="writing, meetings"/></label></div>}
    {editor.mode!=='create'&&<label className="field"><span className="field-label">Tags <span className="hint">comma separated</span></span><input value={tagsText} onChange={e=>updateList('tags',e.target.value)} placeholder="writing, meetings"/></label>}

    <label className="field"><span className="field-label">Prompt text <strong className="required">*</strong><span className="hint">Use # for headings, **bold** for emphasis, - for lists, and {'{{variable_name}}'} for fill-in fields.</span></span><textarea className="prompt-editor-textarea" required rows={9} value={draft.content} onChange={e=>set('content',e.target.value)} placeholder={'You are an expert at…\n\nReview {{document_text}} and return…'}/></label>
    <div className="field-grid"><label className="field"><span className="field-label">How to use</span><textarea rows={3} value={draft.usage_instructions} onChange={e=>set('usage_instructions',e.target.value)} placeholder="Tips for getting the best result"/></label><label className="field"><span className="field-label">Compatible AI models</span><input value={modelsText} onChange={e=>updateList('compatible_models',e.target.value)} placeholder="ChatGPT, Claude"/></label></div>
    <div className="field-grid"><label className="field"><span className="field-label">Example input</span><textarea rows={2} value={draft.example_inputs} onChange={e=>set('example_inputs',e.target.value)}/></label><label className="field"><span className="field-label">Expected output</span><textarea rows={2} value={draft.expected_outputs} onChange={e=>set('expected_outputs',e.target.value)}/></label></div>
    {editor.mode==='create'&&<label className="toggle-line"><input type="checkbox" checked={publish} onChange={e=>setPublish(e.target.checked)}/><span><strong>Publish now</strong><small>Visibility follows the permissions of the selected library.</small></span></label>}
    {editor.mode!=='create'&&<label className="field">{editor.mode==='suggest'?'Why is this improvement useful?':'What changed in this version?'}<input value={note} onChange={e=>setNote(e.target.value)} placeholder="A short explanation for reviewers"/></label>}
    {error&&<p className="form-error">{error}</p>}</div>
    <div className="modal-footer"><div><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving?'Saving…':editor.mode==='suggest'?'Submit suggestion':'Save prompt'} <ArrowRight size={16}/></Button></div></div>
  </form></Modal>;
}

function PromptRow({prompt,version,active,onSelect,owner,likes}:{prompt:Prompt;version:PromptVersion;active:boolean;onSelect:()=>void;owner:string;likes:number}){
  return <button className={`prompt-row ${active?'is-active':''}`} onClick={onSelect}><IconTile category={version.category}/><span className="row-body"><span className="row-caps">{version.category}<span className="caps-dot">·</span>{owner}</span><strong className="row-title">{version.title}</strong><span className="row-description">{version.description||'A ready-to-use prompt shared with the library.'}</span><span className="row-byline">{when(prompt.updated_at)}<span className="row-likes" aria-label={`${likes} likes`}><Heart size={13}/>{likes}</span></span></span><ChevronRight size={18} className="row-arrow"/></button>;
}

function PromptDetail({prompt,version,latest,history,owner,creator,lastEditor,canEdit,canSuggest,saved,onFavorite,onDuplicate,onEdit,onSuggest,onLifecycle,onDelete,onShare,onRequest,onRestore,onArchive,onCompare,onDeprecate,onRecommend,recommended,isManager,readOnly,onClose}:{
  prompt:Prompt;version:PromptVersion;latest:PromptVersion|undefined;history:PromptVersion[];owner:string;creator:string;lastEditor:string;canEdit:boolean;canSuggest:boolean;saved:boolean;
  onFavorite:()=>void;onDuplicate:()=>void;onEdit:()=>void;onSuggest:()=>void;onLifecycle:()=>void;onDelete:()=>void;onShare:()=>void;onRequest:(id:string)=>void;onRestore:()=>void;onArchive:()=>void;onCompare:(id:string)=>void;onDeprecate:()=>void;onRecommend:()=>void;recommended:boolean;isManager:boolean;readOnly:boolean;onClose:()=>void;
}){
  const [variables,setVariables]=useState<Record<string,string>>({});const [copied,setCopied]=useState(false);const [historyOpen,setHistoryOpen]=useState(false);
  const variableNames=varsIn(version.content);
  const pending=!!latest && latest.id!==version.id && latest.approval_status==='under_review';
  async function copyPrompt(){let output=version.content;for(const [k,v] of Object.entries(variables))if(v.trim())output=output.replaceAll(`{{${k}}}`,v.trim());try{await navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),2200)}catch{saveFile('prompt.txt',output)}}
  const exports={...version,owner,prompt_id:prompt.id};
  return <div className="detail-inner" key={prompt.id+version.id}><div className="detail-header"><div className="detail-header-title"><button className="mobile-back" onClick={onClose}><ArrowLeft size={17}/> Back</button><span className="live-dot"/> <span>Prompt preview</span></div>{!readOnly&&<button className={`save-button ${saved?'saved':''}`} onClick={onFavorite} title={saved?'Remove from saved':'Save prompt'}><Heart size={16} fill={saved?'currentColor':'none'}/>{saved?'Favorited':'Favorite'}</button>}</div>
  <div className="detail-scroll"><div className="status-row"><Flag tone={prompt.lifecycle==='published'?'green':'amber'}>{prompt.lifecycle}</Flag><Flag>{owner}</Flag>{version.approval_status==='approved'&&<Flag tone="violet"><Check size={12}/> Approved</Flag>}</div>
    <h2 className="detail-title">{version.title}</h2><p className="detail-description">{version.description}</p><div className="author-line"><Avatar name={creator} small/><span className="author-line-meta">{history.length>1?<><span>Created by: <strong>{creator}</strong></span><span className="meta-bullet">·</span><span>Last updated by: <strong>{lastEditor}</strong></span></>:<span>Created by: <strong>{creator}</strong></span>}<span className="meta-bullet">·</span><span>{when(prompt.updated_at)}</span></span></div>
    {pending&&<div className="review-alert"><Clock3 size={16}/><span>A newer version is awaiting approval. This is the current official version.</span></div>}
    <div className="detail-section-label"><span>The prompt</span><span>v{version.version_number}</span></div><pre className="code-preview">{version.content}</pre>
    {variableNames.length>0&&<div className="variables"><div className="detail-section-label"><span>Make it yours</span><span>{variableNames.length} field{variableNames.length===1?'':'s'}</span></div><div className="variables-grid">{variableNames.map(n=><label className="field" key={n}>{labelize(n)}<input value={variables[n]||''} onChange={e=>setVariables(v=>({...v,[n]:e.target.value}))} placeholder={`Enter ${n.replaceAll('_',' ')}`}/></label>)}</div></div>}
    {version.usage_instructions&&<><div className="detail-section-label">How to use</div><p className="detail-body-copy">{version.usage_instructions}</p></>}
    {version.example_inputs&&<><div className="detail-section-label">Example input</div><p className="detail-body-copy">{version.example_inputs}</p></>}
    {version.expected_outputs&&<><div className="detail-section-label">Expected output</div><p className="detail-body-copy">{version.expected_outputs}</p></>}
    <div className="tag-row">{version.tags.map(t=><span className="tag" key={t}>#{t}</span>)}{version.compatible_models.map(m=><span className="tag tag-model" key={m}>{m}</span>)}</div>
    <div className="detail-cta"><Button onClick={copyPrompt}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied!':'Copy prompt'}</Button>{!readOnly&&<Button variant="outline" onClick={onDuplicate}><Clipboard size={16}/> Duplicate</Button>}{canEdit&&!prompt.owner_team_id&&<Button variant="outline" onClick={onEdit}>Edit</Button>}{canSuggest&&<Button variant="outline" onClick={onSuggest}>Suggest edit</Button>}</div>
    {canEdit&&<><button className="disclosure" onClick={()=>setHistoryOpen(x=>!x)}><FileClock size={17}/> Version history <span>{history.length}</span><ChevronDown size={16} className={historyOpen?'rotated':''}/></button>{historyOpen&&<div className="history-list">{history.map(v=><div className="history-item" key={v.id}><span><strong>Version {v.version_number}</strong><small>{v.change_note||'No change note'} · {when(v.created_at)}</small></span><span className="history-right"><button className="text-button" onClick={()=>onCompare(v.id)}>Compare</button><Flag tone={v.approval_status==='approved'?'green':v.approval_status==='under_review'?'amber':'neutral'}>{v.id===prompt.official_version_id?'Official · ':''}{v.approval_status.replace('_',' ')}</Flag>{v.id===latest?.id&&v.approval_status==='experimental'&&prompt.owner_team_id&&<button className="text-button" onClick={()=>onRequest(v.id)}>Request review</button>}</span></div>)}</div>}</>}
    <div className="detail-utilities"><button onClick={()=>saveFile(`${sanitize(version.title)}.json`,JSON.stringify(exports,null,2),'application/json')}><ArrowUpRight size={14}/> Export JSON</button><button onClick={()=>saveFile(`${sanitize(version.title)}.md`,`# ${version.title}\n\n${version.description}\n\n${version.content}\n`,'text/markdown')}><ArrowUpRight size={14}/> Export Markdown</button>{canEdit&&(!prompt.owner_team_id||isManager)&&<><button onClick={onLifecycle}>{prompt.lifecycle==='draft'?'Publish':prompt.lifecycle==='published'?'Move to draft':'Republish'}</button>{!!prompt.owner_user_id&&<button onClick={onShare}>Share to team</button>}{prompt.lifecycle!=='archived'&&<button onClick={onArchive}>Archive</button>}{isManager&&prompt.owner_team_id&&<><button onClick={onRecommend}>{recommended?'Remove recommendation':'Recommend'}</button><button className="danger-text" onClick={onDeprecate}>Deprecate</button></>}{prompt.deleted_at?<button onClick={onRestore}>Restore</button>:<button className="danger-text" onClick={onDelete}>Move to trash</button>}</>}</div>
  </div></div>;
}

export default function App(){
  const [user,setUser]=useState<Identity|null>(null);
  const [guest,setGuest]=useState(false);
  const [likeCounts,setLikeCounts]=useState<Record<string,number>>({});
  const [data,setData]=useState<AppData>(emptyData());
  const [ready,setReady]=useState(false); const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState(''); const [view,setView]=useState<View>('explore');
  const [filter,setFilter]=useState<Filter>('All prompts');const [query,setQuery]=useState('');
  const [searchExpanded,setSearchExpanded]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null); const [showMobileDetail,setShowMobileDetail]=useState(false);
  const [editor,setEditor]=useState<EditorState|null>(null);const [confirm,setConfirm]=useState<null|{title:string;description:string;confirm:string;run:()=>Promise<void>}>(null);
  const [shareId,setShareId]=useState<string|null>(null);const [shareTeam,setShareTeam]=useState('');
  const [mineTrash,setMineTrash]=useState(false);
  const importRef=useRef<HTMLInputElement|null>(null);
  const searchInputRef=useRef<HTMLInputElement|null>(null);
  const [accountOpen,setAccountOpen]=useState(false);
  const accountMenuRef=useRef<HTMLDivElement|null>(null);
  const accountTriggerRef=useRef<HTMLButtonElement|null>(null);
  const [noticeOpen,setNoticeOpen]=useState(false);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [facets,setFacets]=useState({team:'',owner:'',category:'',tag:'',lifecycle:'',approval:'',updated:''});
  const [recommendOnly,setRecommendOnly]=useState(false);
  const [compare,setCompare]=useState<{prompt:Prompt;versionId:string}|null>(null);
  const [restoreNote,setRestoreNote]=useState('');
  const [changePasswordOpen,setChangePasswordOpen]=useState(false);
  const [newPassword,setNewPassword]=useState('');
  const [recoveryMode,setRecoveryMode]=useState(false);

  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setView('explore');setSearchExpanded(true)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
  useEffect(()=>{if(searchExpanded)searchInputRef.current?.focus()},[searchExpanded,view]);
  // Dismiss the account dropdown when clicking elsewhere or pressing Escape.
  useEffect(()=>{
    if(!accountOpen)return;
    const onOutsidePointer=(event:PointerEvent)=>{
      if(accountMenuRef.current&&!accountMenuRef.current.contains(event.target as Node))setAccountOpen(false);
    };
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        setAccountOpen(false);
        accountTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown',onOutsidePointer);
    document.addEventListener('keydown',onEscape);
    return()=>{
      document.removeEventListener('pointerdown',onOutsidePointer);
      document.removeEventListener('keydown',onEscape);
    };
  },[accountOpen]);
  const [reviewReason,setReviewReason]=useState<Record<string,string>>({});
  const notify=useCallback((m:string)=>{setToast(m);setTimeout(()=>setToast(''),4200)},[]);
  const reload=useCallback(async()=>{const [records,counts]=await Promise.all([loadData(),loadLikeCounts()]);setData(records);setLikeCounts(counts);},[]);
  useEffect(()=>{
    let active=true;
    (async()=>{try{if(isDemo){setReady(true);return;}const me=await identity();if(!active)return;setUser(me);if(me)await reload();}catch(e){notify(e instanceof Error?e.message:'Unable to load library.')}finally{if(active)setReady(true)}})();
    if(isDemo||!client)return()=>{active=false};
    const {data:sub}=client.auth.onAuthStateChange((_event,session)=>{
      if(!active)return;
      if(_event==='PASSWORD_RECOVERY')setRecoveryMode(true);
      const next=session?.user?{id:session.user.id,email:session.user.email||''}:null;
      setUser(next);
      if(next){setGuest(false);setTimeout(()=>reload().catch(e=>notify(e instanceof Error?e.message:'Could not refresh data')),0);}
      else setData(emptyData());
    });
    return()=>{active=false;sub.subscription.unsubscribe()};
  },[reload,notify]);
  const doAction=useCallback(async(fn:()=>Promise<unknown>,success?:string)=>{setBusy(true);try{const result=await fn();await reload();if(success)notify(success);return result}catch(e){notify(e instanceof Error?e.message:'Something went wrong.');return null}finally{setBusy(false)}},[reload,notify]);
  const myTeams=useMemo(()=>data.members.filter(m=>m.user_id===user?.id),[data.members,user]);
  const isMember=(teamId:string|null)=>!!teamId&&myTeams.some(t=>t.team_id===teamId);
  const isManager=(teamId:string|null)=>!!teamId&&myTeams.some(t=>t.team_id===teamId&&t.role==='manager');
  const isAdmin=data.admins.some(a=>a.user_id===user?.id);
  const ownTeamList=data.teams.filter(t=>isMember(t.id));
  const person=(id:string)=>data.profiles.find(p=>p.id===id)?.display_name||'Contributor';
  const owner=(p:Prompt)=>p.owner_team_id?data.teams.find(t=>t.id===p.owner_team_id)?.name||'Team':'Personal';
  const history=(id:string)=>data.versions.filter(v=>v.prompt_id===id).sort((a,b)=>b.version_number-a.version_number);
  const canEdit=(p:Prompt)=>p.owner_user_id===user?.id||isMember(p.owner_team_id);
  const canSuggest=(p:Prompt)=>!!user && !!p.owner_team_id && p.lifecycle!=='archived' && (isMember(p.owner_team_id) || (myTeams.length>0 && p.lifecycle==='published'));
  const visible=(p:Prompt)=>!!p.owner_user_id&&p.owner_user_id===user?.id||!!p.owner_team_id&&(isMember(p.owner_team_id)||myTeams.length>0&&p.lifecycle==='published');
  const official=(p:Prompt):PromptVersion|undefined=>{
    const o=data.versions.find(v=>v.id===p.official_version_id);
    const last=data.versions.find(v=>v.id===p.latest_version_id);
    // Team members see pending changes in history, not as the public official version.
    if(o?.approval_status==='approved'||o?.approval_status==='deprecated')return o;
    return canEdit(p)?last||o:o||last;
  };
  const reviewQueue=useMemo<ReviewItem[]>(()=>{
    const managerTeams=myTeams.filter(m=>m.role==='manager').map(m=>m.team_id);
    const items:ReviewItem[]=[];
    for(const v of data.versions){const p=data.prompts.find(p=>p.id===v.prompt_id);if(p&&p.latest_version_id===v.id&&v.approval_status==='under_review'&&p.owner_team_id&&managerTeams.includes(p.owner_team_id))items.push({kind:'version',record:v,prompt:p});}
    for(const pr of data.proposals){const p=data.prompts.find(p=>p.id===pr.prompt_id);if(p&&['open','under_review'].includes(pr.status)&&p.owner_team_id&&managerTeams.includes(p.owner_team_id))items.push({kind:'proposal',record:pr,prompt:p});}
    return items;
  },[data,myTeams]);
  const accessible=useMemo(()=>data.prompts.filter(p=>!p.deleted_at&&(guest?(p.lifecycle==='published'):visible(p))&&!!official(p)),[data,user,myTeams,guest]);
  const searchable=useMemo(()=>{
    let found=accessible;
    if(view==='mine') found=found.filter(p=>canEdit(p));
    if(view==='explore'){
      if(filter==='Personal')found=found.filter(p=>p.owner_user_id===user?.id);
      if(filter==='My teams')found=found.filter(p=>isMember(p.owner_team_id));
      if(filter==='Other teams')found=found.filter(p=>!!p.owner_team_id&&!isMember(p.owner_team_id));
      if(filter==='Favorites')found=found.filter(p=>data.favorites.some(f=>f.user_id===user?.id&&f.prompt_id===p.id));
    }
    if(facets.team)found=found.filter(p=>p.owner_team_id===facets.team);
    if(facets.owner)found=found.filter(p=>p.created_by===facets.owner||p.owner_user_id===facets.owner);
    if(facets.category)found=found.filter(p=>official(p)?.category===facets.category);
    if(facets.tag)found=found.filter(p=>official(p)?.tags.includes(facets.tag));
    if(facets.lifecycle)found=found.filter(p=>p.lifecycle===facets.lifecycle);
    if(facets.approval)found=found.filter(p=>official(p)?.approval_status===facets.approval);
    if(facets.updated)found=found.filter(p=>new Date(p.updated_at)>=new Date(facets.updated));
    if(recommendOnly)found=found.filter(p=>data.recommendations.some(r=>r.prompt_id===p.id));
    const q=query.trim().toLowerCase();if(q)found=found.filter(p=>{const v=official(p);return [v?.title,v?.description,v?.category,v?.content,v?.tags.join(' '),owner(p)].join(' ').toLowerCase().includes(q)});
    return [...found].sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  },[accessible,view,filter,query,data.favorites,data.recommendations,user,facets,recommendOnly]);
  const selected=selectedId?searchable.find(p=>p.id===selectedId)||null:null;
  const selectedVersion=selected?official(selected):undefined;
  const selectedLatest=selected?data.versions.find(v=>v.id===selected.latest_version_id):undefined;
  const currentEditorVersion=editor?.prompt?(editor.mode==='suggest'?official(editor.prompt):data.versions.find(v=>v.id===editor.prompt!.latest_version_id)||official(editor.prompt)):undefined;
  const editorBody:PromptBody=currentEditorVersion?{title:currentEditorVersion.title,description:currentEditorVersion.description,content:currentEditorVersion.content,category:currentEditorVersion.category,tags:currentEditorVersion.tags,usage_instructions:currentEditorVersion.usage_instructions,example_inputs:currentEditorVersion.example_inputs,expected_outputs:currentEditorVersion.expected_outputs,compatible_models:currentEditorVersion.compatible_models}:blankBody();
  const hasExplore=view==='explore'||view==='mine';
  const blocked=data.account_controls.find(c=>c.user_id===user?.id);
  const categoryNames=data.categories.map(c=>c.name);
  const facet=(k:keyof typeof facets,v:string)=>{setFacets(f=>({...f,[k]:v}));setSelectedId(null)};
  async function submitEditor(payload:PromptBody,teamId:string|null,publish:boolean,note:string){
    const result=await doAction(async()=>{
      if(editor?.mode==='create')return execute('create_prompt',{payload,team_id:teamId,publish});
      if(editor?.mode==='suggest'||editor?.prompt?.owner_team_id)return execute('propose_improvement',{pid:editor.prompt!.id,payload,explanation:note});
      return execute('save_prompt_version',{pid:editor!.prompt!.id,payload,note});
    },editor?.mode==='suggest'?'Suggestion submitted for review.':editor?.mode==='edit'?'New version saved.':'Your prompt was saved.');
    if(result){setEditor(null);if(typeof result==='string'&&editor?.mode==='create'){setSelectedId(result);setFilter('All prompts');setView('explore')}}
  }
  function askDelete(p:Prompt){setConfirm({title:'Move prompt to trash?',description:'This prompt will be hidden from your library. You can restore it during the retention period.',confirm:'Move to trash',run:async()=>{await doAction(()=>execute('soft_delete_prompt',{pid:p.id,recover:false}),'Prompt moved to trash.');setConfirm(null)}})}
  function askReview(item:ReviewItem,approve:boolean){const reason=reviewReason[item.record.id]||'';
    if(!approve&&reason.trim().length<3){notify('Please provide a rejection reason (at least 3 characters).');return;}
    setConfirm({title:approve?'Approve these changes?':'Reject this submission?',description:approve?'The decision will be recorded. Version approvals replace the official prompt; accepted improvement proposals enter version review.':'The author will be notified and the decision saved.',confirm:approve?'Approve':'Reject',run:async()=>{await doAction(()=>item.kind==='version'?execute('review_prompt_version',{vid:item.record.id,approve,reason}):execute('review_improvement_proposal',{proposal_id:item.record.id,accept:approve,reason}),approve?'Review completed.':'Submission rejected.');setConfirm(null)}});
  }
  async function copySelected(p:Prompt){const id=await doAction(()=>execute('copy_prompt',{pid:p.id,target_team_id:null}),'Saved a personal copy.');if(typeof id==='string'){setSelectedId(id);setView('mine');setFilter('All prompts')}}
  async function toggleFavorite(p:Prompt){if(!user)return;const saved=data.favorites.some(f=>f.prompt_id===p.id&&f.user_id===user.id);await doAction(()=>favorite(p.id,user.id,!saved),saved?'Removed from saved.':'Added to saved.');}
  async function importPrompt(file:File | undefined){
    if(!file)return;
    try{
      const text=await file.text();
      let raw:Record<string,unknown>;
      if(file.name.toLowerCase().endsWith('.md')) {
        const lines=text.split('\n');
        const first=lines[0]?.startsWith('# ')?lines.shift()!.replace(/^# /,''):file.name.replace(/\.md$/i,'');
        raw={title:first,content:lines.join('\n').trim(),category:'General'};
      } else raw=JSON.parse(text) as Record<string,unknown>;
      if(typeof raw.title!=='string'||typeof raw.content!=='string'||!raw.title.trim()||!raw.content.trim())throw Error('The file needs a title and prompt text.');
      const body:PromptBody={title:raw.title.slice(0,150),content:raw.content.slice(0,30000),description:String(raw.description||''),category:String(raw.category||'General'),tags:Array.isArray(raw.tags)?raw.tags.filter(x=>typeof x==='string').slice(0,20):[],usage_instructions:String(raw.usage_instructions||''),example_inputs:String(raw.example_inputs||''),expected_outputs:String(raw.expected_outputs||''),compatible_models:Array.isArray(raw.compatible_models)?raw.compatible_models.filter(x=>typeof x==='string').slice(0,12):[]};
      await doAction(()=>execute('create_prompt',{payload:body,team_id:null,publish:false}),'Imported as a private draft.');
    } catch(e){notify(e instanceof Error?e.message:'Could not import the file.');}
  }
  function navigate(v:View){setView(v);setSelectedId(null);setShowMobileDetail(false);setQuery('');setSearchExpanded(false);setAdvancedOpen(false);if(v==='mine')setMineTrash(false);}
  if(!ready)return <div className="boot"><Logo/><div className="loading-line"/></div>;
  if(user&&(recoveryMode||blocked?.must_change_password))return <div className="session-gate"><Logo/><form onSubmit={async e=>{e.preventDefault();try{if(blocked?.must_change_password)await accountAdmin('complete_temp_password',{password:newPassword});else await updatePassword(newPassword);setNewPassword('');setRecoveryMode(false);await reload();notify('Password updated.');}catch(err){notify(err instanceof Error?err.message:'Password update failed');}}}><h2>{blocked?.must_change_password?'Change your temporary password':'Reset your password'}</h2><p>{blocked?.must_change_password?'A personal password is required before you can access company prompts.':'Choose your new account password.'}</p><label className="field">New password<input type="password" required minLength={12} value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></label><Button type="submit">Update password <ArrowRight size={16}/></Button></form>{toast&&<div className="toast">{toast}</div>}</div>;
  return <div className="app"><header className="topbar"><div className="container topbar-in"><a href={import.meta.env.BASE_URL} className="brand-link" onClick={e=>{e.preventDefault();navigate('explore')}}><Logo/></a>
    {(user||guest)&&<nav className="main-nav" aria-label="Main navigation">{(guest?[['explore','Explore']] as [View,string][]:[['explore','Explore'],['mine','My prompts'],['teams','Teams'],['reviews','Reviews']] as [View,string][]).map(([v,t])=><button key={v} className={`nav-link ${view===v?'active':''}`} onClick={()=>navigate(v)}>{t}{v==='reviews'&&reviewQueue.length>0&&<span className="nav-bubble">{reviewQueue.length}</span>}</button>)}{isAdmin&&<button className={`nav-link ${view==='admin'?'active':''}`} onClick={()=>navigate('admin')}>Admin</button>}</nav>}
    <div className="topbar-right">{user?<><button className="notice-trigger" aria-label="Open notifications" onClick={()=>setNoticeOpen(true)}><Bell size={17}/>{data.notifications.filter(n=>n.recipient_id===user.id&&!n.read_at).length>0&&<b>{data.notifications.filter(n=>n.recipient_id===user.id&&!n.read_at).length}</b>}</button><Button onClick={()=>setEditor({mode:'create'})} className="top-new"><Plus size={17}/> New prompt</Button><div className="account-wrap" ref={accountMenuRef}><button type="button" ref={accountTriggerRef} className="profile-button" title="Open account menu" aria-expanded={accountOpen} aria-haspopup="true" onClick={()=>setAccountOpen(s=>!s)}><Avatar name={person(user.id)}/><ChevronDown size={14}/></button>{accountOpen&&<div className="account-menu"><div className="account-menu-head"><strong>{person(user.id)}</strong><span>{user.email}</span></div><div className="menu-separator"/><div className="account-menu-stats"><Users size={16}/>{myTeams.length} team{myTeams.length===1?'':'s'}</div><button onClick={()=>{setNoticeOpen(true);setAccountOpen(false)}}><Bell size={16}/>{data.notifications.filter(n=>n.recipient_id===user.id&&!n.read_at).length} unread notifications</button><button onClick={()=>{setChangePasswordOpen(true);setAccountOpen(false)}}><LockKeyhole size={16}/> Change password</button><button onClick={async()=>{if(!isDemo)await signOut();setUser(null);setData(emptyData());setAccountOpen(false);setSelectedId(null)}}><LogOut size={16}/> Sign out</button><div className="account-menu-note">{isDemo?'Local demo data, not shared online.':'Access is governed by team permissions.'}</div></div>}</div></>:guest?<Button variant="outline" onClick={()=>{setGuest(false);setData(emptyData());setSelectedId(null)}}>Sign in <ArrowRight size={15}/></Button>:null}</div></div></header>

  {!user&&!guest?<main className="container"><Auth onLogin={async u=>{setGuest(false);setUser(u);await reload()}} onDemo={async()=>{setUser(demoIdentity);await reload()}} onGuest={()=>{setData(guestSampleData());setGuest(true);setView('explore');setSelectedId(null)}} busy={busy} message={notify} onNotice={notify}/></main>:<main className="container app-main">
  {hasExplore?<><section className="hero"><div><h1>{view==='mine'?<>Manage your prompts<span className="accent-dot">.</span></>:<>Collaborative prompt portfolio<span className="accent-dot">.</span></>}</h1><p>{view==='mine'?'Get an overview of all your personal promts and the prompts from your teams.':guest?'Preview sample prompts without an account. Sign in for your team library.':'Discover what others have built, adapt it to your work, and share what works.'}</p></div></section>
  <div className="filters-bar"><div className="filter-list">{view==='explore'?(['All prompts','Personal','My teams','Other teams','Favorites'] as Filter[]).filter(x=>!guest||x==='All prompts').map(x=><button className={`filter-chip ${filter===x?'selected':''}`} key={x} onClick={()=>{setFilter(x);setSelectedId(null)}}>{x}</button>):<><button className={`filter-chip ${!mineTrash?'selected':''}`} onClick={()=>setMineTrash(false)}>My library</button><button className={`filter-chip ${mineTrash?'selected':''}`} onClick={()=>setMineTrash(true)}>Trash</button></>}</div>{view==='mine'&&<button className="import-control" onClick={()=>importRef.current?.click()}><Plus size={13}/> Import prompt</button>}</div>
  <div className="filter-controls"><button className={`filters-button ${advancedOpen?'is-open':''}`} aria-label="Filters" title="Filters" aria-haspopup="dialog" aria-expanded={advancedOpen} onClick={()=>{setSearchExpanded(false);setAdvancedOpen(true)}}><SlidersHorizontal size={16}/><span className="filter-control-label">Filters</span>{Object.values(facets).filter(Boolean).length+(recommendOnly?1:0)>0&&<span className="active-filter-count">{Object.values(facets).filter(Boolean).length+(recommendOnly?1:0)}</span>}</button>
  <button type="button" className={`filters-button keyword-search-trigger ${searchExpanded?'is-open':''}`} aria-label="Keywords search" title="Keywords search" aria-haspopup="dialog" aria-expanded={searchExpanded} onClick={()=>{setAdvancedOpen(false);setSearchExpanded(true)}}><Search size={16}/><span className="filter-control-label">Keywords search</span>{query.trim()&&<span className="search-active-dot" aria-label="Active keyword search"/>}</button>
  <div className="active-filters">{(Object.entries(facets) as [keyof typeof facets,string][]).filter(([,v])=>!!v).map(([key,value])=>{const label=key==='team'?data.teams.find(t=>t.id===value)?.name||value:key==='owner'?data.profiles.find(t=>t.id===value)?.display_name||value:value;return <button key={key} className="active-filter-chip" onClick={()=>facet(key,'')} aria-label={`Remove ${key} filter`}><span>{labelize(key)}: {label}</span><X size={13}/></button>})}{recommendOnly&&<button className="active-filter-chip" onClick={()=>setRecommendOnly(false)}>Recommended <X size={13}/></button>}</div></div>
  {view==='mine'&&mineTrash?<div className="trash-container"><div className="list-top"><h2>Recently deleted</h2></div>{data.prompts.filter(p=>p.deleted_at&&canEdit(p)).map(p=><div className="trash-item" key={p.id}><Trash2 size={18}/><div><strong>{official(p)?.title||'Untitled prompt'}</strong><p>Deleted {when(p.deleted_at||undefined)}</p></div><Button variant="outline" onClick={()=>doAction(()=>execute('soft_delete_prompt',{pid:p.id,recover:true}),'Prompt restored.')}><RotateCcw size={15}/> Restore</Button></div>)}{!data.prompts.some(p=>p.deleted_at&&canEdit(p))&&<Empty title="Your trash is empty" description="Deleted prompts will appear here while they can still be restored." icon={Trash2}/>}</div>:<div className="workspace"><div className="prompt-results"><div className="list-top"><h2>{view==='mine'?'Your prompts':filter==='All prompts'?'All prompts':filter}<span className="results-in-heading">· {searchable.length} {searchable.length===1?'result':'results'}</span></h2></div><div className="rows">{searchable.map(p=>{const v=official(p);return v&&<PromptRow key={p.id} prompt={p} version={v} owner={owner(p)} likes={guest?0:likeCounts[p.id]||0} active={selected?.id===p.id} onSelect={()=>{setSelectedId(p.id);setShowMobileDetail(true)}}/>})}{searchable.length===0&&<Empty title="No prompts found" description="Try a different search, or be the first to add a prompt." action={guest?undefined:<Button onClick={()=>setEditor({mode:'create'})}><Plus size={16}/> Create prompt</Button>}/>}</div></div><aside className={`detail-panel ${showMobileDetail?'mobile-visible':''}`}>{selected&&selectedVersion?<PromptDetail key={selected.id+selectedVersion.id} prompt={selected} version={selectedVersion} latest={selectedLatest} history={history(selected.id)} owner={owner(selected)} creator={person(selected.created_by)} lastEditor={person(selectedLatest?.author_id||selectedVersion.author_id)} canEdit={!guest&&canEdit(selected)} canSuggest={!guest&&canSuggest(selected)} saved={!guest&&data.favorites.some(f=>f.user_id===user?.id&&f.prompt_id===selected.id)} onClose={()=>setShowMobileDetail(false)} recommended={data.recommendations.some(r=>r.prompt_id===selected.id)} isManager={!guest&&isManager(selected.owner_team_id)} readOnly={guest} onCompare={versionId=>setCompare({prompt:selected,versionId})} onDeprecate={()=>{const reason=window.prompt("Why should this prompt be deprecated?");if(reason&&reason.trim().length>=3)void doAction(()=>execute('deprecate_team_prompt',{pid:selected.id,reason}),'Team prompt deprecated.')}} onRecommend={()=>doAction(()=>execute('set_team_recommendation',{pid:selected.id,recommend:!data.recommendations.some(r=>r.prompt_id===selected.id)}),'Recommendation updated.')} onFavorite={()=>{if(guest){notify('Sign in to like or save a prompt.');return;}void toggleFavorite(selected)}} onDuplicate={()=>{if(guest){notify('Sign in to duplicate prompts.');return;}void copySelected(selected)}} onEdit={()=>setEditor({mode:selected.owner_team_id?'suggest':'edit',prompt:selected})} onSuggest={()=>setEditor({mode:'suggest',prompt:selected})} onLifecycle={()=>doAction(()=>execute('set_prompt_lifecycle',{pid:selected.id,new_status:selected.lifecycle==='published'?'draft':'published'}),'Lifecycle updated.')} onDelete={()=>askDelete(selected)} onRequest={id=>doAction(()=>execute('request_version_review',{vid:id}),'Sent for review.')} onArchive={()=>doAction(()=>execute('set_prompt_lifecycle',{pid:selected.id,new_status:'archived'}),'Prompt archived.')} onRestore={()=>doAction(()=>execute('soft_delete_prompt',{pid:selected.id,recover:true}),'Prompt restored.')} onShare={()=>{setShareId(selected.id);setShareTeam(ownTeamList[0]?.id||'')}}/>:<Empty title="Select a prompt" description="Choose a prompt from the list to preview it here."/>}</aside></div>}</>:<><section className="subhero"><h1>{view==='teams'?'Manage your teams':view==='reviews'?'Review queue':'Manage promptfolio'}<span className="accent-dot">.</span></h1><p>{view==='teams'?'Get an overview of the teams you are in.':view==='reviews'?'GitHub pull requests for your prompts!':'Control how promptfolio works.'}</p></section>
  {view==='teams'&&<div className="teams-layout">{ownTeamList.length===0&&!isAdmin&&<Empty title="You're not part of a team yet" description="Your personal prompts are ready. Ask a manager to add you to a shared library." icon={LockKeyhole}/>} {ownTeamList.map(t=><TeamCard key={t.id} team={t} prompts={data.prompts.filter(p=>p.owner_team_id===t.id&&!p.deleted_at)} versions={data.versions} members={data.members.filter(m=>m.team_id===t.id)} profiles={data.profiles} manager={isManager(t.id)||isAdmin} onMember={async(email,action)=>{const found=data.profiles.find(p=>p.email.toLowerCase()===email.toLowerCase());if(!found){notify('That person needs to register an account first.');return}await doAction(()=>execute('manage_team_member',{tid:t.id,uid:found.id,operation:action}),action==='add'?'Member added.':'Member removed.')}}/>)}</div>}
  {view==='reviews'&&<div className="reviews-layout"><div className="review-summary"><span><Clock3 size={18}/> Needs your attention</span><strong>{reviewQueue.length} pending</strong></div>{reviewQueue.map(item=>{const current=official(item.prompt);const proposed=item.kind==='version'?item.record as PromptVersion:(item.record as Proposal).proposed_content;const changed=item.kind==='version'?(item.record as PromptVersion).content:(item.record as Proposal).proposed_content.content;return <article className="review-card" key={item.record.id}><div className="review-card-header"><div><h3>{current?.title||proposed.title}</h3><p>{owner(item.prompt)} · submitted by {person(item.kind==='proposal'?(item.record as Proposal).author_id:(item.record as PromptVersion).author_id)}</p></div><Flag tone="amber">{item.kind==='proposal'?(item.record as Proposal).status.replace('_',' '):'Under review'}</Flag></div><div className="compare-grid"><div><div className="compare-label">Current official version</div><pre>{current?.content||'No approved version yet'}</pre></div><div><div className="compare-label">Proposed version</div><pre>{changed}</pre></div></div>{item.kind==='proposal'&&(item.record as Proposal).rationale&&<p className="review-rationale">Reason: {(item.record as Proposal).rationale}</p>}<div className="review-structured"><strong>Other fields</strong><div className="compare-grid"><div><small>Current · title / category / tags</small><p>{current?.title||'—'} · {current?.category||'—'} · {current?.tags.join(', ')||'—'}</p></div><div><small>Proposed · title / category / tags</small><p>{proposed.title} · {proposed.category} · {proposed.tags.join(', ')}</p></div></div></div><div className="review-footer"><input aria-label="Rejection reason" placeholder="Reason if rejecting…" value={reviewReason[item.record.id]||''} onChange={e=>setReviewReason(s=>({...s,[item.record.id]:e.target.value}))}/>{item.kind==='proposal'&&(item.record as Proposal).status==='open'&&<Button variant="outline" onClick={()=>doAction(()=>execute('set_proposal_under_review',{proposal_id:item.record.id}),'Proposal moved to Under Review.')}>Start review</Button>}<Button variant="outline" onClick={()=>askReview(item,false)}>Reject</Button><Button onClick={()=>askReview(item,true)}><Check size={15}/>{item.kind==='proposal'?'Accept proposal':'Approve version'}</Button></div></article>})}{reviewQueue.length===0&&<Empty title="All caught up" description="When your team needs an approval, it will appear here." icon={CheckCircle2}/>}</div>}
  {view==='admin'&&isAdmin&&<AdminSection data={data} busy={busy} onCreate={async(team,description,email)=>{const target=data.profiles.find(p=>p.email.toLowerCase()===email.toLowerCase());if(!target){notify('The manager must have an account first.');return}await doAction(()=>execute('create_team',{team_name:team,team_description:description,first_manager:target.id}),'Team created.')}} onManager={(tid,uid,promote)=>doAction(()=>execute('set_team_manager',{tid,uid,promote}),'Team role updated.')}/>}
  {view==='admin'&&isAdmin&&<AdminAdvanced data={data} busy={busy} executeAction={async(name,args)=>await doAction(()=>execute(name,args),'Updated successfully.')} onIdentity={accountAdmin} onRefresh={reload} notify={notify}/>}
  </>}
  </main>}
  <footer className="footer"><div className="container"><span>© Promptfolio</span><span className="footer-build-info"><span>v{packageInfo.version}</span><span className="footer-dot">·</span><span>Last updated: {when(__PROMPTFOLIO_BUILD_DATE__)}</span></span></div></footer>
  <input aria-label="Import prompt file" type="file" accept=".json,.md,application/json,text/markdown" ref={importRef} hidden onChange={e=>{void importPrompt(e.target.files?.[0]);e.target.value=''}}/>
  {searchExpanded&&<Modal onClose={()=>setSearchExpanded(false)}><div className="search-dialog">
    <div className="modal-header"><div><h2>Keywords search</h2><p>Find prompts by title, content, tags, or team.</p></div><button className="round-icon" type="button" aria-label="Close keywords search" onClick={()=>setSearchExpanded(false)}><X size={19}/></button></div>
    <form role="search" className="search-dialog-form" onSubmit={e=>{e.preventDefault();setSearchExpanded(false)}}>
      <label className="field" htmlFor="promptSearch">Keywords</label>
      <div className="search-dialog-input"><Search size={18} aria-hidden="true"/><input ref={searchInputRef} id="promptSearch" autoFocus type="search" aria-label="Search prompt keywords" placeholder="Search prompts, tags, teams…" value={query} onChange={e=>{setQuery(e.target.value);setSelectedId(null)}}/></div>
      <p className="search-dialog-hint">Results update while you type. Search only includes prompts you can access.</p>
      <div className="search-dialog-actions"><Button type="button" variant="outline" onClick={()=>{setQuery('');setSelectedId(null)}} disabled={!query}>Clear search</Button><Button type="submit">Show results <ArrowRight size={15}/></Button></div>
    </form>
  </div></Modal>}
  {advancedOpen&&<Modal wide onClose={()=>setAdvancedOpen(false)}><div className="filters-dialog">
    <div className="modal-header"><div><h2>Filters</h2><p>Refine the prompts shown in your library.</p></div><button className="round-icon" type="button" aria-label="Close filters" onClick={()=>setAdvancedOpen(false)}><X size={19}/></button></div>
    <div className="filters-dialog-scroll"><div className="advanced-filters"><label>Team<select value={facets.team} onChange={e=>facet('team',e.target.value)}><option value="">Any team</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Owner<select value={facets.owner} onChange={e=>facet('owner',e.target.value)}><option value="">Any owner</option>{data.profiles.map(pr=><option key={pr.id} value={pr.id}>{pr.display_name}</option>)}</select></label><label>Category<select value={facets.category} onChange={e=>facet('category',e.target.value)}><option value="">Any category</option>{categoryNames.map(c=><option key={c}>{c}</option>)}</select></label><label>Tag<select value={facets.tag} onChange={e=>facet('tag',e.target.value)}><option value="">Any tag</option>{[...new Set(data.versions.flatMap(v=>v.tags))].sort().map(t=><option key={t}>{t}</option>)}</select></label><label>Lifecycle<select value={facets.lifecycle} onChange={e=>facet('lifecycle',e.target.value)}><option value="">Any status</option>{['draft','published','archived'].map(v=><option key={v}>{v}</option>)}</select></label><label>Approval<select value={facets.approval} onChange={e=>facet('approval',e.target.value)}><option value="">Any approval</option>{['experimental','under_review','approved','deprecated'].map(v=><option key={v}>{v}</option>)}</select></label><label>Updated after<input type="date" value={facets.updated} onChange={e=>facet('updated',e.target.value)}/></label><label className="check-filter"><input type="checkbox" checked={recommendOnly} onChange={e=>setRecommendOnly(e.target.checked)}/> Manager recommended</label></div></div>
    <div className="filters-dialog-actions"><Button variant="outline" type="button" onClick={()=>{setFacets({team:'',owner:'',category:'',tag:'',lifecycle:'',approval:'',updated:''});setRecommendOnly(false);setSelectedId(null)}}>Clear filters</Button><Button type="button" onClick={()=>setAdvancedOpen(false)}>Show results <ArrowRight size={15}/></Button></div>
  </div></Modal>}
  {editor&&<PromptEditor editor={editor} body={editorBody} teams={ownTeamList} categoryNames={categoryNames} existingTitles={accessible.filter(p=>p.id!==editor.prompt?.id).map(p=>official(p)?.title||'')} onNewCategory={async name=>{await doAction(()=>execute('create_category',{category_name:name}),'Category added.')}} onClose={()=>setEditor(null)} onSubmit={submitEditor} saving={busy}/>}
  {confirm&&<Modal onClose={()=>setConfirm(null)}><div className="confirm-modal"><div className="modal-header"><div><h2>{confirm.title}</h2><p>{confirm.description}</p></div><button className="round-icon" onClick={()=>setConfirm(null)}><X size={20}/></button></div><div className="confirm-actions"><Button variant="outline" onClick={()=>setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={()=>confirm.run()}>{busy?'Working…':confirm.confirm}</Button></div></div></Modal>}
  {shareId&&<Modal onClose={()=>setShareId(null)}><div className="confirm-modal"><div className="modal-header"><div><h2>Share a separate copy</h2><p>Your personal prompt remains private. The shared copy is published to the chosen team.</p></div><button className="round-icon" onClick={()=>setShareId(null)}><X size={20}/></button></div><label className="field">Team<select value={shareTeam} onChange={e=>setShareTeam(e.target.value)}>{ownTeamList.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="confirm-actions"><Button variant="outline" onClick={()=>setShareId(null)}>Cancel</Button><Button disabled={!shareTeam||busy} onClick={async()=>{await doAction(()=>execute('share_personal_prompt',{pid:shareId,target_team_id:shareTeam}),'Shared to your team.');setShareId(null)}}>Share copy <ArrowRight size={16}/></Button></div></div></Modal>}
  {noticeOpen&&<Modal onClose={()=>setNoticeOpen(false)}><div className="confirm-modal"><div className="modal-header"><div><h2>Notifications</h2><p>Team reviews and decisions that matter to you.</p></div><button className="round-icon" onClick={()=>setNoticeOpen(false)}><X size={19}/></button></div><div className="notification-list">{data.notifications.filter(n=>n.recipient_id===user?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(n=><button key={n.id} className={`notification-item ${n.read_at?'is-read':''}`} onClick={async()=>{await doAction(()=>execute('mark_notification_read',{nid:n.id}));setNoticeOpen(false);if(n.prompt_id){setView('explore');setSelectedId(n.prompt_id)}}}><span><Bell size={16}/></span><span><strong>{n.message}</strong><small>{when(n.created_at)} {n.read_at?'':'· Unread'}</small></span></button>)}{data.notifications.filter(n=>n.recipient_id===user?.id).length===0&&<Empty title="All caught up" description="Review updates will appear here." icon={Bell}/>}</div><div className="confirm-actions"><Button variant="outline" onClick={()=>setNoticeOpen(false)}>Close</Button><Button onClick={()=>doAction(()=>execute('mark_notification_read',{nid:null}),'All notifications marked read.')}>Mark all read</Button></div></div></Modal>}
  {compare&&<CompareVersions data={data} comparison={compare} onClose={()=>setCompare(null)} onRestore={async versionId=>{const original=data.versions.find(v=>v.id===versionId&&v.prompt_id===compare.prompt.id);if(!original){notify('Version not found.');return}const result=compare.prompt.owner_team_id?await doAction(()=>execute('propose_improvement',{pid:compare.prompt.id,payload:{title:original.title,description:original.description,content:original.content,category:original.category,tags:original.tags,usage_instructions:original.usage_instructions,example_inputs:original.example_inputs,expected_outputs:original.expected_outputs,compatible_models:original.compatible_models},explanation:`Suggest restoring v${original.version_number}. ${restoreNote}`.trim()}),'Restoration suggested to team managers.'):await doAction(()=>execute('restore_prompt_version',{pid:compare.prompt.id,source_version_id:versionId,note:restoreNote}),'Old version restored as a new version.');if(result)setCompare(null)}} note={restoreNote} setNote={setRestoreNote}/>}
  {changePasswordOpen&&<Modal onClose={()=>setChangePasswordOpen(false)}><div className="confirm-modal"><h2>Change password</h2><p>Choose a new password of at least 12 characters.</p><form onSubmit={async e=>{e.preventDefault();await doAction(()=>changePassword(newPassword),'Password updated.');setNewPassword('');setChangePasswordOpen(false)}}><label className="field">New password<input type="password" minLength={12} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><div className="confirm-actions"><Button type="button" variant="outline" onClick={()=>setChangePasswordOpen(false)}>Cancel</Button><Button type="submit">Change password</Button></div></form></div></Modal>}
  {toast&&<div className="toast" role="status"><CheckCircle2 size={17}/>{toast}<button onClick={()=>setToast('')} aria-label="Dismiss"><X size={14}/></button></div>}
  </div>;
}

function CompareVersions({data,comparison,onClose,onRestore,note,setNote}:{data:AppData;comparison:{prompt:Prompt;versionId:string};onClose:()=>void;onRestore:(id:string)=>Promise<void>;note:string;setNote:(note:string)=>void}){
  const versions=data.versions.filter(v=>v.prompt_id===comparison.prompt.id).sort((a,b)=>b.version_number-a.version_number);
  const [left,setLeft]=useState(comparison.prompt.official_version_id||versions[0]?.id||'');
  const [right,setRight]=useState(comparison.versionId);
  const a=versions.find(v=>v.id===left),b=versions.find(v=>v.id===right);
  const fields:(keyof PromptBody)[]=['title','description','content','category','tags','usage_instructions','example_inputs','expected_outputs','compatible_models'];
  return <Modal wide onClose={onClose}><div className="confirm-modal"><div className="modal-header"><div><h2>Compare and restore</h2><p>For team prompts, restoring an old version creates a suggestion for manager review. Personal prompts can be restored directly.</p></div><button className="round-icon" onClick={onClose}><X size={18}/></button></div><div className="field-grid"><label className="field">Base version<select value={left} onChange={e=>setLeft(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>v{v.version_number} · {v.approval_status}</option>)}</select></label><label className="field">Compare version<select value={right} onChange={e=>setRight(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>v{v.version_number} · {v.approval_status}</option>)}</select></label></div><div className="version-diff">{fields.map(k=>{const one=Array.isArray(a?.[k])?(a?.[k] as string[]).join(', '):String(a?.[k]||'');const two=Array.isArray(b?.[k])?(b?.[k] as string[]).join(', '):String(b?.[k]||'');return <div key={k}><strong>{labelize(k)} {one!==two&&<Flag tone="amber">Changed</Flag>}</strong><div className="compare-grid"><pre>{one||'—'}</pre><pre>{two||'—'}</pre></div></div>})}</div><label className="field">Restoration note<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason for restoring this version"/></label><div className="confirm-actions"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={()=>onRestore(right)}><RotateCcw size={15}/> {comparison.prompt.owner_team_id?'Suggest restoration':'Restore selected version'}</Button></div></div></Modal>;
}

function AdminAdvanced({data,busy,executeAction,onIdentity,onRefresh,notify}:{data:AppData;busy:boolean;executeAction:(name:string,args:Record<string,unknown>)=>Promise<unknown>;onIdentity:typeof accountAdmin;onRefresh:()=>Promise<void>;notify:(s:string)=>void}){
 const [email,setEmail]=useState('');const [displayName,setDisplayName]=useState('');const [credential,setCredential]=useState<{password:string;expires:string}|null>(null);
 const [target,setTarget]=useState('');const [retention,setRetention]=useState(data.settings[0]?.retention_days||30);
 const [hours,setHours]=useState(data.settings[0]?.temporary_password_hours||48);
 const [working,setWorking]=useState(false);
 async function act(action:string,payload:Record<string,unknown>){setWorking(true);try{const r=await onIdentity(action,payload);if(r.temporary_password)setCredential({password:r.temporary_password,expires:r.expires_at||''});await onRefresh();notify('Identity operation completed.')}catch(e){notify(e instanceof Error?e.message:'Account operation failed')}finally{setWorking(false)}}
 return <div className="admin-extras"><section className="admin-card"><h3>Manage accounts.</h3><p>Credentials are generated server-side and displayed once.</p><form onSubmit={async e=>{e.preventDefault();await act('create_user',{email,display_name:displayName});setEmail('');setDisplayName('')}}><label className="field">Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="colleague@company.com"/></label><label className="field">Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} required/></label><Button type="submit" disabled={busy||working}>Create user with temporary password</Button></form>
 <label className="field">Existing user<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Select an account</option>{data.profiles.map(pr=><option key={pr.id} value={pr.id}>{pr.display_name} ({pr.email})</option>)}</select></label><div className="admin-actions"><Button variant="outline" disabled={!target||working} onClick={()=>act('reset_temp_password',{user_id:target})}>Reset password</Button><Button variant="outline" disabled={!target||working} onClick={()=>act('disable_user',{user_id:target})}>Disable</Button><Button variant="outline" disabled={!target||working} onClick={()=>act('enable_user',{user_id:target})}>Reactivate</Button></div>
 {credential&&<div className="one-time-secret"><strong>Temporary password — shown once</strong><code>{credential.password}</code><small>Expires: {credential.expires||'Demo only'}</small><Button variant="outline" onClick={()=>{void navigator.clipboard.writeText(credential.password);setCredential(null)}}>Copy and hide</Button><button className="text-button" onClick={()=>setCredential(null)}>Hide now</button></div>}</section>
 <section className="admin-card"><h3>Manage the portfolio.</h3><label className="field">Deleted prompt retention (days)<input type="number" min={1} max={365} value={retention} onChange={e=>setRetention(Number(e.target.value))}/></label><label className="field">Temporary password validity (hours)<input type="number" min={1} max={168} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label><Button disabled={busy} onClick={()=>executeAction('update_app_settings',{days:retention,password_hours:hours})}>Save settings</Button><div className="divider-line"/><p>Removing a team revokes its memberships and archives its existing prompts while keeping audit history.</p><div className="admin-team-actions">{data.teams.map(t=><div key={t.id}><strong>{t.name}</strong><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm(`Remove ${t.name}? Members will lose access and prompts will be archived.`))void executeAction('remove_team',{tid:t.id})}}>Remove team</Button></div>)}</div></section></div>
}

function TeamCard({team,members,profiles,prompts,versions,manager,onMember}:{team:{id:string;name:string;description:string};members:Member[];profiles:AppData['profiles'];prompts:Prompt[];versions:PromptVersion[];manager:boolean;onMember:(email:string,action:'add'|'remove')=>Promise<void>}){
  const [open,setOpen]=useState(false);const [email,setEmail]=useState('');
  const published=prompts.filter(p=>p.lifecycle==='published').length;
  const drafts=prompts.filter(p=>p.lifecycle==='draft').length;
  const approved=prompts.filter(p=>versions.some(v=>v.id===p.official_version_id&&v.approval_status==='approved')).length;
  const categoryCounts=new Map<string,number>();
  for(const p of prompts){const v=versions.find(v=>v.id===p.official_version_id)||versions.find(v=>v.id===p.latest_version_id);const category=v?.category||'General';categoryCounts.set(category,(categoryCounts.get(category)||0)+1)}
  const categoriesByCount=[...categoryCounts.entries()].sort((a,b)=>b[1]-a[1]);
  return <section className="team-card"><div className="team-card-header"><div className="team-icon"><Users size={21}/></div><div><h3>{team.name}</h3><p>{team.description}</p></div><Flag>{members.length} members</Flag></div>
  <div className="team-stats" aria-label={`${team.name} prompt statistics`}><div><strong>{prompts.length}</strong><span>Prompts</span></div><div><strong>{published}</strong><span>Published</span></div><div><strong>{drafts}</strong><span>Drafts</span></div><div><strong>{approved}</strong><span>Approved</span></div></div>
  <div className="team-category-section"><div className="team-section-title">Prompts by category</div>{categoriesByCount.length?<div className="team-categories">{categoriesByCount.map(([category,count])=><div className="team-category" key={category}><div className="team-category-label"><span>{category}</span><strong>{count}</strong></div><div className="team-category-track"><span style={{width:`${count/Math.max(prompts.length,1)*100}%`}}/></div></div>)}</div>:<p className="team-no-prompts">No prompts in this team yet.</p>}</div>
  <div className="team-section-title team-members-title">Members</div><div className="team-members">{members.map(m=>{const profile=profiles.find(p=>p.id===m.user_id);return <div className="member" key={m.user_id}><Avatar name={profile?.display_name||'Member'} small/><span><strong>{profile?.display_name||'Member'}</strong><small>{profile?.email||''}</small></span>{m.role==='manager'&&<Flag tone="violet">Manager</Flag>}{manager&&m.role!=='manager'&&<button title="Remove member" className="member-remove" onClick={()=>onMember(profile?.email||'','remove')}><X size={15}/></button>}</div>})}</div>{manager&&<><button className="add-member-toggle" onClick={()=>setOpen(s=>!s)}><Plus size={17}/> Add a team member</button>{open&&<form className="inline-form" onSubmit={async e=>{e.preventDefault();await onMember(email,'add');setEmail('');setOpen(false)}}><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="colleague@company.com"/><Button type="submit">Add member</Button></form>}</>}</section>;
}
function AdminSection({data,busy,onCreate,onManager}:{data:AppData;busy:boolean;onCreate:(team:string,description:string,email:string)=>Promise<void>;onManager:(team:string,user:string,promote:boolean)=>Promise<unknown>}){
  const [name,setName]=useState('');const [description,setDescription]=useState('');const [email,setEmail]=useState('');
  return <div className="admin-layout"><section className="admin-card"><h3>Create a team.</h3><p>Create a team and appoint its manager. The manager must already have an account.</p><form onSubmit={async e=>{e.preventDefault();await onCreate(name,description,email);setName('');setDescription('');setEmail('')}}><label className="field">Team name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Finance"/></label><label className="field">Description<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="What is this team for?"/></label><label className="field">Manager email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="manager@company.com"/></label><Button type="submit" disabled={busy}>Create team <ArrowRight size={15}/></Button></form></section><section className="admin-card"><h3>Manage approvals.</h3><p>Team managers can review official versions and improvement proposals.</p><div className="admin-member-list">{data.members.map(m=><div key={`${m.user_id}-${m.team_id}`}><span><strong>{data.profiles.find(p=>p.id===m.user_id)?.display_name||'User'}</strong><small>{data.teams.find(t=>t.id===m.team_id)?.name} · {m.role}</small></span><Button variant="outline" onClick={()=>onManager(m.team_id,m.user_id,m.role!=='manager')}>{m.role==='manager'?'Demote':'Make manager'}</Button></div>)}</div></section></div>;
}
