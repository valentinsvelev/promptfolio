import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Bell, Check, CheckCircle2, ChevronDown, Clock3, Download, FileClock,
  List, LockKeyhole, LogOut, MessageSquarePlus, Moon, Plus, RotateCcw,
  Search, Settings2, SlidersHorizontal, Sun, Trash2, X, Pencil,
} from 'lucide-react';
import {accountAdmin, changePassword, client, demoIdentity, execute, favorite, guestSampleData, identity, isDemo, loadData, loadLikeCounts, signOut, updatePassword, updateDisplayName, loadListifyPreference, saveListifyPreference} from './services/api';
import {blankBody, emptyData, type AppData, type Filter, type Identity, type Prompt, type PromptBody, type PromptVersion, type Proposal, type ReviewItem, type View} from './types';
import packageInfo from '../package.json';
import { Button, Logo, Modal } from './components/ui';
import { AccountSettings, type AccountStatistic } from './components/account/AccountSettings';
import { ChangelogPage } from './components/changelog/ChangelogPage';
import { RenameTeamDialog } from './components/teams/RenameTeamDialog';
import { FeedbackDialog } from './components/feedback/FeedbackDialog';
import { Auth } from './components/auth/Auth';
import { PromptEditor, type EditorState } from './components/prompts/PromptEditor';
import { SharePromptEmailDialog } from './components/email/SharePromptEmailDialog';
import { when } from './utils/format';
import { Avatar, Empty, Flag } from './components/ui/LibraryPrimitives';
import { PromptRow } from './components/prompts/PromptRow';
import { PromptDetail } from './components/prompts/PromptDetail';
import { CompareVersions } from './components/prompts/CompareVersions';
import { AdminCategories } from './components/admin/AdminCategories';
import { deleteCategory, deleteUnusedCategories } from './services/categoryMaintenance';
import { AdminAdvanced } from './components/admin/AdminAdvanced';
import { AdminSection } from './components/admin/AdminSection';
import { TeamCard } from './components/teams/TeamCard';
import { saveFile } from './utils/prompt';
import { combineClipboardText } from './utils/sharing';
import { useHashRoute } from './hooks/useHashRoute';
import { isAuthRoute, viewFromHash } from './utils/routes';
import { defaultExplorePreferences, type ExplorePreferences } from './utils/defaultExploreTab';
import { loadExplorePreferences, saveExplorePreferences } from './services/explorePreferences';
import { ExploreTabsDialog } from './components/prompts/ExploreTabsDialog';
import { WorkflowMasthead } from './components/ui/WorkflowMasthead';
import { CollectionsPage } from './components/collections/CollectionsPage';
import { AddToCollectionDialog } from './components/collections/AddToCollectionDialog';
import { recordPromptUsage, type UsageAction } from './services/usageInsights';
import './styles/collectionsUsage.css';

// Injected by Vite for both local development and GitHub Pages builds.
declare const __PROMPTFOLIO_BUILD_DATE__: string;

export default function App(){
  const [user,setUser]=useState<Identity|null>(null);
  const [guest,setGuest]=useState(false);
  const [likeCounts,setLikeCounts]=useState<Record<string,number>>({});
  const [data,setData]=useState<AppData>(emptyData());
  const [ready,setReady]=useState(false); const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState(''); const [view,setView,replaceView]=useHashRoute();
  const [filter,setFilter]=useState<Filter>('All prompts');const [query,setQuery]=useState('');
  const [explorePrefs,setExplorePrefs]=useState<ExplorePreferences>(defaultExplorePreferences);
  const [explorePrefsReady,setExplorePrefsReady]=useState(false);
  const [exploreTabEditorOpen,setExploreTabEditorOpen]=useState(false);
  const explicitExploreSelection=useRef(false);
  const defaultExploreTab=explorePrefs.defaultTab;
  // Explore tabs show their prompt lists directly.
  const [listified,setListified]=useState(false);
  const [listifyLoadedFor,setListifyLoadedFor]=useState<string|null>(null);
  // Serialize saves so rapid toggles cannot overwrite a newer choice.
  const listifySaveQueue=useRef<Promise<void>>(Promise.resolve());
  // Bulk exports use the versions already visible and authorised in this session.
  const [bulkExportOpen,setBulkExportOpen]=useState(false);
  const [exportIds,setExportIds]=useState<string[]>([]);
  const [searchExpanded,setSearchExpanded]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null); const [showMobileDetail,setShowMobileDetail]=useState(false);
  const [editor,setEditor]=useState<EditorState|null>(null);const [confirm,setConfirm]=useState<null|{title:string;description:string;confirm:string;run:()=>Promise<void>}>(null);
  const [emailSharePrompt,setEmailSharePrompt]=useState<Prompt|null>(null);
  const [collectionPrompt,setCollectionPrompt]=useState<Prompt|null>(null);
  const [usageRevision,setUsageRevision]=useState(0);
  const [shareId,setShareId]=useState<string|null>(null);const [shareTeam,setShareTeam]=useState('');
  const [mineTrash,setMineTrash]=useState(false);
  const importRef=useRef<HTMLInputElement|null>(null);
  const searchInputRef=useRef<HTMLInputElement|null>(null);
  const [accountOpen,setAccountOpen]=useState(false);
  const accountMenuRef=useRef<HTMLDivElement|null>(null);
  const accountTriggerRef=useRef<HTMLButtonElement|null>(null);
  const [noticeOpen,setNoticeOpen]=useState(false);
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  // Theme is a presentation preference; it does not affect Supabase data or permissions.
  const [darkMode,setDarkMode]=useState<boolean>(()=>{
    try{return window.localStorage.getItem('promptfolio:theme')==='dark'}catch{return false}
  });
  useEffect(()=>{
    document.documentElement.dataset.theme=darkMode?'dark':'light';
    try{window.localStorage.setItem('promptfolio:theme',darkMode?'dark':'light')}catch{/* Storage may be unavailable. */}
  },[darkMode]);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [facets,setFacets]=useState({team:'',owner:'',category:'',tag:'',lifecycle:'',approval:'',updated:''});
  const [recommendOnly,setRecommendOnly]=useState(false);
  const [compare,setCompare]=useState<{prompt:Prompt;versionId:string}|null>(null);
  const [restoreNote,setRestoreNote]=useState('');
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [teamToRename,setTeamToRename]=useState<{id:string;name:string}|null>(null);
  const [newPassword,setNewPassword]=useState('');
  const [recoveryMode,setRecoveryMode]=useState(false);

  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setView('explore');setFilter('All prompts');setSelectedId(null);setSearchExpanded(true)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
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
  // Load the signed-in account's Explore preferences from Supabase.
  // Guests get the standard ordering; demo users are saved locally.
  useEffect(()=>{
    let active=true;
    explicitExploreSelection.current=false;
    setExplorePrefs(defaultExplorePreferences());
    setExplorePrefsReady(!user);
    setFilter('All prompts');
    if(!user)return()=>{active=false};
    const uid=user.id;
    void loadExplorePreferences(uid).then(preferences=>{
      if(!active)return;
      setExplorePrefs(preferences);
      // Do not overwrite a manual choice made while the preference was loading.
      if(!explicitExploreSelection.current)setFilter(preferences.defaultTab);
    }).catch(error=>{
      if(!active)return;
      notify(error instanceof Error?`Could not load Explore preferences: ${error.message}`:'Could not load Explore preferences.');
    }).finally(()=>{if(active)setExplorePrefsReady(true)});
    return()=>{active=false};
  },[user?.id]);
  const [reviewReason,setReviewReason]=useState<Record<string,string>>({});
  const notify=useCallback((m:string)=>{setToast(m);setTimeout(()=>setToast(''),4200)},[]);
  // Usage instrumentation is intentionally best-effort: failed telemetry must
  // never prevent users from opening or copying a prompt.
  const trackUsage=useCallback((pid:string,action:UsageAction)=>{
    if(!user||guest)return;
    void recordPromptUsage(pid,action).then(()=>setUsageRevision(v=>v+1)).catch(()=>{});
  },[user?.id,guest]);
  const reload=useCallback(async()=>{const [records,counts]=await Promise.all([loadData(),loadLikeCounts()]);setData(records);setLikeCounts(counts);},[]);
  // User-specific preference loads from Supabase after authentication; not browser cache.
  useEffect(()=>{
    let active=true;
    setListifyLoadedFor(null);
    setListified(false);
    if(!user){return()=>{active=false};}
    const uid=user.id;
    void loadListifyPreference(uid).then(enabled=>{
      if(!active)return;
      setListified(enabled);
      setListifyLoadedFor(uid);
    }).catch(error=>{
      if(!active)return;
      setListifyLoadedFor(uid);
      notify(error instanceof Error?`Could not load Listify preference: ${error.message}`:'Could not load Listify preference.');
    });
    return()=>{active=false};
  },[user?.id,notify]);
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
  // Shared URLs do not bypass RLS. Resolve the prompt only after the user and
  // their accessible library are loaded; otherwise show the ordinary sign-in UI.
  const sharedPromptPending=useRef<string|null>(new URLSearchParams(window.location.search).get('prompt'));
  useEffect(()=>{
    if(!user || !data.profiles.some(p=>p.id===user.id) || !sharedPromptPending.current)return;
    const id=sharedPromptPending.current;
    sharedPromptPending.current=null;
    if(accessible.some(p=>p.id===id)){
      explicitExploreSelection.current=true;
      setView('explore');setFilter('All prompts');setSelectedId(id);setShowMobileDetail(true);
    }else notify('This shared prompt is not available to your account. Request access from the sender.');
  },[user?.id,data.profiles,accessible,notify]);
  const settingsStatistics=useMemo<AccountStatistic[]>(()=>{
    // Respect Supabase RLS: these totals include only prompts visible to this account.
    const allowed=data.prompts.filter(p=>!p.deleted_at&&visible(p));
    const ids=new Set(allowed.map(p=>p.id));
    const usedCategories=new Set(data.versions.filter(v=>ids.has(v.prompt_id)&&
      allowed.some(p=>p.id===v.prompt_id&&p.official_version_id===v.id)).map(v=>v.category));
    return [
      {label:'Total accessible prompts',value:allowed.length},
      {label:'Personal prompts',value:allowed.filter(p=>p.owner_user_id===user?.id).length},
      {label:'Team prompts',value:allowed.filter(p=>p.owner_team_id&&isMember(p.owner_team_id)).length},
      {label:'Teams joined',value:myTeams.length},
      {label:'Categories in use',value:usedCategories.size},
      {label:'Saved prompts',value:data.favorites.filter(f=>f.user_id===user?.id&&ids.has(f.prompt_id)).length},
    ];
  },[data,user,myTeams]);
  const searchable=useMemo(()=>{
    let found=accessible;
    if(view==='mine') found=found.filter(p=>p.owner_user_id===user?.id||p.created_by===user?.id);
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
    return [...found].sort((a,b)=>{
      const byTitle=(official(a)?.title||'').localeCompare(official(b)?.title||'',undefined,{sensitivity:'base',numeric:true});
      return byTitle||a.id.localeCompare(b.id);
    });
  },[accessible,view,filter,query,data.favorites,data.recommendations,user,facets,recommendOnly]);
  // Quick filters use the exact same facet state as the advanced Filters dialog.
  // Derive choices from this tab's accessible prompts, before applying filters.
  const quickFilterType = view==='explore' && filter==='My teams' ? 'team'
    : (view==='mine' && !mineTrash) || (view==='explore' && filter!=='My teams') ? 'category' : null;
  const quickFilterBase = view==='mine'
    ? accessible.filter(p=>p.owner_user_id===user?.id||p.created_by===user?.id)
    : filter==='Personal' ? accessible.filter(p=>p.owner_user_id===user?.id)
    : filter==='My teams' ? accessible.filter(p=>isMember(p.owner_team_id))
    : filter==='Other teams' ? accessible.filter(p=>!!p.owner_team_id&&!isMember(p.owner_team_id))
    : filter==='Favorites' ? accessible.filter(p=>data.favorites.some(f=>f.user_id===user?.id&&f.prompt_id===p.id))
    : accessible;
  // Show only choices backed by accessible prompts in this tab. Compute these
  // before applying search/facets so choosing one never hides other options.
  const categoryOptions=(prompts:Prompt[])=>[...new Set(prompts.map(p=>official(p)?.category)
    .filter((v):v is string=>!!v))].sort((a,b)=>a.localeCompare(b)).map(value=>({value,label:value}));
  const quickFilterOptions = quickFilterType==='team'
    ? ownTeamList.filter(t=>quickFilterBase.some(p=>p.owner_team_id===t.id))
        .map(t=>({value:t.id,label:t.name}))
        .sort((a,b)=>a.label.localeCompare(b.label))
    : quickFilterType==='category' ? categoryOptions(quickFilterBase) : [];
  // A second quick-select row appears only after choosing a team. It lists
  // categories belonging to that team, not categories from other teams.
  const selectedTeamCategories = quickFilterType==='team' && facets.team &&
    ownTeamList.some(t=>t.id===facets.team)
      ? categoryOptions(quickFilterBase.filter(p=>p.owner_team_id===facets.team)) : [];
  const selected=selectedId?searchable.find(p=>p.id===selectedId)||null:null;
  const selectedVersion=selected?official(selected):undefined;
  const selectedLatest=selected?data.versions.find(v=>v.id===selected.latest_version_id):undefined;
  const currentEditorVersion=editor?.prompt?(editor.mode==='suggest'?official(editor.prompt):data.versions.find(v=>v.id===editor.prompt!.latest_version_id)||official(editor.prompt)):undefined;
  const editorBody:PromptBody=currentEditorVersion?{title:currentEditorVersion.title,description:currentEditorVersion.description,content:currentEditorVersion.content,category:currentEditorVersion.category,tags:currentEditorVersion.tags,usage_instructions:currentEditorVersion.usage_instructions,example_inputs:currentEditorVersion.example_inputs,expected_outputs:currentEditorVersion.expected_outputs,compatible_models:currentEditorVersion.compatible_models}:blankBody();
  const hasExplore=view==='explore'||view==='mine';
  const blocked=data.account_controls.find(c=>c.user_id===user?.id);
  const categoryNames=data.categories.map(c=>c.name);
  const facet=(k:keyof typeof facets,v:string)=>{
    setFacets(f=>k==='team'&&view==='explore'&&filter==='My teams'&&f.team!==v
      ? {...f,team:v,category:''} : {...f,[k]:v});
    setSelectedId(null);
  };
  // Shared by the manual-search card and the existing Filters dialog.
  const filterControls=<div className="advanced-filters"><label>Team<select value={facets.team} onChange={e=>facet('team',e.target.value)}><option value="">Any team</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Owner<select value={facets.owner} onChange={e=>facet('owner',e.target.value)}><option value="">Any owner</option>{data.profiles.map(pr=><option key={pr.id} value={pr.id}>{pr.display_name}</option>)}</select></label><label>Category<select value={facets.category} onChange={e=>facet('category',e.target.value)}><option value="">Any category</option>{categoryNames.map(c=><option key={c}>{c}</option>)}</select></label><label>Tag<select value={facets.tag} onChange={e=>facet('tag',e.target.value)}><option value="">Any tag</option>{[...new Set(data.versions.flatMap(v=>v.tags))].sort().map(t=><option key={t}>{t}</option>)}</select></label><label>Lifecycle<select value={facets.lifecycle} onChange={e=>facet('lifecycle',e.target.value)}><option value="">Any status</option>{['draft','published','archived'].map(v=><option key={v}>{v}</option>)}</select></label><label>Approval<select value={facets.approval} onChange={e=>facet('approval',e.target.value)}><option value="">Any approval</option>{['experimental','under_review','approved','deprecated'].map(v=><option key={v}>{v}</option>)}</select></label><label>Updated after<input type="date" value={facets.updated} onChange={e=>facet('updated',e.target.value)}/></label><label className="check-filter"><input type="checkbox" checked={recommendOnly} onChange={e=>setRecommendOnly(e.target.checked)}/> Manager recommended</label></div>;
  async function submitEditor(payload:PromptBody,teamId:string|null,publish:boolean,note:string){
    const result=await doAction(async()=>{
      if(editor?.mode==='create')return execute('create_prompt',{payload,team_id:teamId,publish});
      if(editor?.mode==='suggest'||editor?.prompt?.owner_team_id)return execute('propose_improvement_with_team',{pid:editor.prompt!.id,payload,explanation:note,target_team_id:teamId});
      return execute('save_personal_prompt_and_team',{pid:editor!.prompt!.id,payload,note,target_team_id:teamId});
    },editor?.mode==='suggest'?'Suggestion submitted for review.':editor?.mode==='edit'?'New version saved.':'Your prompt was saved.');
    if(result){setEditor(null);if(typeof result==='string'&&editor?.mode==='create'){setSelectedId(result);setFilter('All prompts');setView('explore')}}
  }
  function askPermanentlyDelete(p:Prompt){
    const promptTitle=official(p)?.title||'this prompt';
    setConfirm({
      title:'Permanently delete prompt?',
      description:`This will permanently remove “${promptTitle}” and all of its versions and suggestions. This action cannot be undone.`,
      confirm:'Delete permanently',
      run:async()=>{
        setBusy(true);
        try{
          await execute('permanently_delete_prompt',{pid:p.id});
          await reload();
          if(selectedId===p.id)setSelectedId(null);
          setConfirm(null);
          notify('Prompt permanently deleted.');
        }catch(e){notify(e instanceof Error?e.message:'Unable to permanently delete prompt.');}
        finally{setBusy(false);}
      }
    });
  }
  function askDelete(p:Prompt){setConfirm({title:'Move prompt to trash?',description:'This prompt will be hidden from your library. You can restore it during the retention period.',confirm:'Delete',run:async()=>{await doAction(()=>execute('soft_delete_prompt',{pid:p.id,recover:false}),'Prompt moved to trash.');setConfirm(null)}})}
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
  function resetDiscovery(){
    setQuery('');setSearchExpanded(false);setAdvancedOpen(false);
    setFacets({team:'',owner:'',category:'',tag:'',lifecycle:'',approval:'',updated:''});
    setRecommendOnly(false);setSelectedId(null);setShowMobileDetail(false);
    setBulkExportOpen(false);setExportIds([]);
  }
  // Double-click respects the same write permissions as the prompt detail action.
  function openEditorForPrompt(p:Prompt){
    if(guest||!user||busy)return;
    if(p.owner_team_id){
      if(canSuggest(p))setEditor({mode:'suggest',prompt:p});
    }else if(p.owner_user_id===user.id){
      setEditor({mode:'edit',prompt:p});
    }
  }
  function toggleListify(){
    if(user && listifyLoadedFor!==user.id)return; // Avoid overwriting an unhydrated preference.
    const next=!listified;
    setListified(next);
    if(!user)return; // Guest preview has no Supabase identity.
    const uid=user.id;
    const pending=listifySaveQueue.current.catch(()=>undefined).then(()=>saveListifyPreference(uid,next));
    listifySaveQueue.current=pending;
    void pending.catch(error=>notify(error instanceof Error?`Could not save Listify preference: ${error.message}`:'Could not save Listify preference.'));
  }
  const visibleExportRecords=searchable.filter(p=>exportIds.includes(p.id)).map(p=>({prompt:p,version:official(p)})).filter((item):item is {prompt:Prompt;version:PromptVersion}=>!!item.version);
  function exportSelected(format:'json'|'markdown'){
    if(!visibleExportRecords.length)return;
    const entries=visibleExportRecords.map(({prompt,version})=>({
      prompt_id:prompt.id,source_prompt_id:prompt.source_prompt_id||null,
      owner:owner(prompt),created_at:prompt.created_at,updated_at:prompt.updated_at,
      lifecycle:prompt.lifecycle,version:version.version_number,
      approval_status:version.approval_status,title:version.title,description:version.description,
      content:version.content,category:version.category,tags:version.tags,
      usage_instructions:version.usage_instructions,example_inputs:version.example_inputs,
      expected_outputs:version.expected_outputs,compatible_models:version.compatible_models,
    }));
    const stamp=new Date().toISOString().slice(0,10);
    if(format==='json'){
      saveFile(`promptfolio-export-${stamp}.json`,JSON.stringify({exported_at:new Date().toISOString(),prompts:entries},null,2),'application/json');
    }else{
      const content=entries.map(e=>[
        `# ${e.title}`,`**Owner:** ${e.owner}  `,`**Category:** ${e.category}  `,
        `**Version:** ${e.version}  `,`**Status:** ${e.lifecycle} / ${e.approval_status}  `,
        `**Tags:** ${e.tags.join(', ')||'—'}  `,e.description,`## Prompt`,e.content,
        e.usage_instructions?`## How to use\n${e.usage_instructions}`:'',
        e.example_inputs?`## Example input\n${e.example_inputs}`:'',
        e.expected_outputs?`## Expected output\n${e.expected_outputs}`:'',
      ].filter(Boolean).join('\n\n')).join('\n\n---\n\n');
      saveFile(`promptfolio-export-${stamp}.md`,content,'text/markdown');
    }
    notify(`Exported ${entries.length} prompt${entries.length===1?'':'s'} as ${format==='json'?'JSON':'Markdown'}.`);
  }
  // Back/Forward and manual hash navigation should reset transient discovery state,
  // just like clicking an app navigation tab. Programmatic setView calls do not
  // emit these browser events, preserving selection from shared-prompt links.
  useEffect(()=>{
    const onHistoryNavigation=()=>{
      resetDiscovery();
      if(viewFromHash(window.location.hash)==='explore')setFilter(user?defaultExploreTab:'All prompts');
      if(viewFromHash(window.location.hash)==='mine')setMineTrash(false);
    };
    window.addEventListener('popstate',onHistoryNavigation);
    window.addEventListener('hashchange',onHistoryNavigation);
    return()=>{
      window.removeEventListener('popstate',onHistoryNavigation);
      window.removeEventListener('hashchange',onHistoryNavigation);
    };
  },[user?.id,defaultExploreTab]);
  // A read-only guest cannot navigate to signed-in sections; never reveal
  // privileged sections to an account without the admin role.
  useEffect(()=>{
    if(guest && isAuthRoute(view)){setGuest(false);setData(emptyData());setSelectedId(null)}
    else if(guest && view!=='explore' && view!=='changelog')replaceView('explore');
    else if(user && view==='admin' && !isAdmin && data.profiles.some(p=>p.id===user.id))replaceView('explore');
  },[guest,user,view,isAdmin,data.profiles,replaceView]);
  // Auth URLs are public entry points, not authenticated workspace screens.
  useEffect(()=>{
    if(user && isAuthRoute(view))replaceView('explore');
  },[user,view,replaceView]);
  function openCollectionPrompt(prompt:Prompt){
    resetDiscovery();setMineTrash(false);
    const personallyOwned=prompt.owner_user_id===user?.id;
    setView(personallyOwned?'mine':'explore');setFilter('All prompts');
    setSelectedId(prompt.id);setShowMobileDetail(true);
    trackUsage(prompt.id,'open');
  }
  function navigate(v:View){
    setView(v);resetDiscovery();
    if(v==='explore')setFilter(user?defaultExploreTab:'All prompts');
    if(v==='mine')setMineTrash(false);
  }
  async function saveExploreChoice(preferences:ExplorePreferences):Promise<void>{
    if(!user)throw new Error('Sign in to save Explore preferences.');
    await saveExplorePreferences(user.id,preferences);
    setExplorePrefs(preferences);
    if(view==='explore'&&defaultExploreTab!==preferences.defaultTab){
      setFilter(preferences.defaultTab);resetDiscovery();
    }
  }
  async function changeDefaultExploreTab(next:Filter):Promise<void>{
    await saveExploreChoice({...explorePrefs,defaultTab:next});
  }
  if(!ready)return <div className="boot"><Logo/><div className="loading-line"/></div>;
  if(user&&(recoveryMode||blocked?.must_change_password))return <div className="session-gate"><Logo/><form onSubmit={async e=>{e.preventDefault();try{if(blocked?.must_change_password)await accountAdmin('complete_temp_password',{password:newPassword});else await updatePassword(newPassword);setNewPassword('');setRecoveryMode(false);await reload();notify('Password updated.');}catch(err){notify(err instanceof Error?err.message:'Password update failed');}}}><h2>{blocked?.must_change_password?'Change your temporary password':'Reset your password'}</h2><p>{blocked?.must_change_password?'A personal password is required before you can access company prompts.':'Choose your new account password.'}</p><label className="field">New password<input type="password" required minLength={12} value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></label><Button type="submit">Update password <ArrowRight size={16}/></Button></form>{toast&&<div className="toast">{toast}</div>}</div>;
  return <div className="app"><header className="topbar"><div className="container topbar-in"><a href={`${import.meta.env.BASE_URL}#/${user||guest?'explore':'sign-in'}`} className="brand-link" onClick={e=>{e.preventDefault();if(user||guest)navigate('explore');else setView('sign-in')}}><Logo/></a>
    {(user||guest)&&<nav className="main-nav" aria-label="Main navigation">{(guest?[['explore','Explore']] as [View,string][]:[['explore','Explore'],['mine','My prompts'],['collections','Collections'],['teams','Teams'],['reviews','Reviews']] as [View,string][]).map(([v,t])=><button key={v} className={`nav-link ${view===v?'active':''}`} onClick={()=>navigate(v)}>{t}{v==='reviews'&&reviewQueue.length>0&&<span className="nav-bubble">{reviewQueue.length}</span>}</button>)}{isAdmin&&<button className={`nav-link ${view==='admin'?'active':''}`} onClick={()=>navigate('admin')}>Admin</button>}</nav>}
    <div className="topbar-right">{user&&<button type="button" className="feedback-trigger pf-icon-tooltip" aria-label="Report an issue or suggest an improvement" data-tooltip="Report an issue / Make a suggestion" onClick={()=>setFeedbackOpen(true)}><MessageSquarePlus size={17}/></button>}<button type="button" className="theme-toggle pf-icon-tooltip" aria-label={darkMode?'Switch to light mode':'Switch to dark mode'} aria-pressed={darkMode} onClick={()=>setDarkMode(v=>!v)}>{darkMode?<Sun size={17}/>:<Moon size={17}/>}</button>{user?<><button className="notice-trigger pf-icon-tooltip" aria-label="Open notifications" onClick={()=>setNoticeOpen(true)}><Bell size={17}/>{data.notifications.filter(n=>n.recipient_id===user.id&&!n.read_at).length>0&&<b>{data.notifications.filter(n=>n.recipient_id===user.id&&!n.read_at).length}</b>}</button><Button onClick={()=>setEditor({mode:'create'})} className="top-new"><Plus size={17}/> New prompt</Button><div className="account-wrap" ref={accountMenuRef}><button type="button" ref={accountTriggerRef} className="profile-button pf-icon-tooltip" aria-label="Open account menu" aria-expanded={accountOpen} aria-haspopup="true" onClick={()=>setAccountOpen(s=>!s)}><Avatar name={person(user.id)}/><ChevronDown size={14}/></button>{accountOpen&&<div className="account-menu"><div className="account-menu-head"><strong>{person(user.id)}</strong><span>{user.email}</span></div><div className="menu-separator"/><button onClick={()=>{setSettingsOpen(true);setAccountOpen(false)}}><Settings2 size={16}/> Settings</button><button onClick={()=>{navigate('changelog');setAccountOpen(false)}} aria-current={view==='changelog'?'page':undefined}><FileClock size={16}/> Changelog</button><button onClick={async()=>{if(!isDemo)await signOut();setUser(null);setData(emptyData());setAccountOpen(false);setSelectedId(null);setView('sign-in')}}><LogOut size={16}/> Sign out</button></div>}</div></>:guest?<Button variant="outline" onClick={()=>{setGuest(false);setData(emptyData());setSelectedId(null);setView('sign-in')}}>Sign in <ArrowRight size={15}/></Button>:null}</div></div></header>

  {!user&&(!guest||isAuthRoute(view))&&view!=='changelog'?<main className="container"><Auth authRoute={view==='sign-up'?'signup':'login'} onModeChange={mode=>setView(mode==='signup'?'sign-up':'sign-in')} onLogin={async u=>{setGuest(false);setUser(u);await reload()}} onDemo={async()=>{setGuest(false);setUser(demoIdentity);await reload()}} onGuest={()=>{setData(guestSampleData());setGuest(true);setView('explore');setSelectedId(null)}} busy={busy} message={notify} onNotice={notify}/></main>:<main className="container app-main">
  {/* One consistent separator for every content page; authentication screens use their own layout. */}
  <WorkflowMasthead kind={view==='mine'?'mine':view==='collections'?'collections':view==='teams'?'teams':view==='reviews'?'reviews':view==='admin'?'admin':view==='changelog'?'changelog':'explore'}/>
  {hasExplore?<>
  <div className="filters-bar"><div className="filter-list">{view==='explore'?(guest?(['All prompts'] as Filter[]):explorePrefs.tabOrder).map(x=><button className={`filter-chip ${filter===x?'selected':''}`} key={x} onClick={()=>{explicitExploreSelection.current=true;setFilter(x);resetDiscovery()}}>{x}</button>):<><button className={`filter-chip ${!mineTrash?'selected':''}`} onClick={()=>setMineTrash(false)}>My library</button><button className={`filter-chip ${mineTrash?'selected':''}`} onClick={()=>setMineTrash(true)}>Trash</button></>}</div>{view==='explore'&&user&&<button type="button" className="explore-edit-tabs" aria-label="Edit Explore tabs" title="Customize Explore tabs" onClick={()=>setExploreTabEditorOpen(true)} disabled={!explorePrefsReady}><Pencil size={14}/> Edit</button>}{view==='mine'&&<button className="import-control" onClick={()=>importRef.current?.click()}><Plus size={13}/> Import prompt</button>}</div>

  {view==='mine'&&mineTrash?<div className="trash-container"><div className="list-top"><h2>Recently deleted</h2></div>{data.prompts.filter(p=>p.deleted_at&&(p.owner_user_id===user?.id||p.created_by===user?.id)).map(p=><div className="trash-item" key={p.id}><Trash2 size={18}/><div><strong>{official(p)?.title||'Untitled prompt'}</strong><p>Deleted {when(p.deleted_at||undefined)}</p></div><div className="trash-item-actions"><Button variant="outline" disabled={busy} onClick={()=>doAction(()=>execute('soft_delete_prompt',{pid:p.id,recover:true}),'Prompt restored.')}><RotateCcw size={15}/> Restore</Button>{(p.owner_user_id===user?.id||(p.owner_team_id&&(isManager(p.owner_team_id)||isAdmin)))&&<Button variant="outline" className="trash-delete-forever" disabled={busy} onClick={()=>askPermanentlyDelete(p)}><Trash2 size={15}/> Delete permanently</Button>}</div></div>)}{!data.prompts.some(p=>p.deleted_at&&(p.owner_user_id===user?.id||p.created_by===user?.id))&&<Empty title="Your trash is empty" description="Deleted prompts will appear here while they can still be restored." icon={Trash2}/>}</div>:<div className="workspace"><div className="prompt-results"><div className="list-top list-top-tools">
    <span className="results-count" role="status">{searchable.length} {searchable.length===1?'result':'results'}</span>
    <div className="prompt-toolbar" role="toolbar" aria-label="Prompt actions">
      {quickFilterType&&quickFilterOptions.length>0&&<div className="prompt-quick-filters" role="group" aria-label={quickFilterType==='team'?'Quick team filters':'Quick category filters'}>
        <div className="prompt-quick-filter-row" role="group" aria-label={quickFilterType==='team'?'Select a team':'Select a category'}>
          {quickFilterOptions.map(option=>{const selectedValue=facets[quickFilterType]===option.value;return <button key={option.value} type="button" className={`prompt-quick-filter ${selectedValue?'is-active':''}`} aria-pressed={selectedValue} title={`${selectedValue?'Clear':'Show'} ${quickFilterType}: ${option.label}`} onClick={()=>facet(quickFilterType,selectedValue?'':option.value)}>{option.label}</button>})}
        </div>
        {selectedTeamCategories.length>0&&<div className="prompt-quick-filter-row prompt-quick-filter-subcategories" role="group" aria-label="Categories in selected team">
          {selectedTeamCategories.map(option=>{const isSelected=facets.category===option.value;return <button key={option.value} type="button" className={`prompt-quick-filter ${isSelected?'is-active':''}`} aria-pressed={isSelected} title={`${isSelected?'Clear':'Show'} category: ${option.label}`} onClick={()=>facet('category',isSelected?'':option.value)}>{option.label}</button>})}
        </div>}
      </div>}
      <div className="prompt-toolbar-actions" role="group" aria-label="Filter, search, view and export actions">
      <button type="button" className={`prompt-toolbar-button ${advancedOpen?'is-open':''}`} data-tooltip="Filters" aria-label="Filters" aria-haspopup="dialog" aria-expanded={advancedOpen} onClick={()=>{setSearchExpanded(false);setAdvancedOpen(true)}}><SlidersHorizontal size={16}/>{Object.values(facets).filter(Boolean).length+(recommendOnly?1:0)>0&&<span className="active-filter-count">{Object.values(facets).filter(Boolean).length+(recommendOnly?1:0)}</span>}</button>
      <button type="button" className={`prompt-toolbar-button ${searchExpanded?'is-open':''}`} data-tooltip="Keywords search" aria-label="Keywords search" aria-haspopup="dialog" aria-expanded={searchExpanded} onClick={()=>{setAdvancedOpen(false);setSearchExpanded(true)}}><Search size={16}/>{query.trim()&&<span className="search-active-dot" aria-hidden="true"/>}</button>
      {(view==='explore'||(view==='mine'&&!mineTrash))&&<button type="button" className={`prompt-toolbar-button ${listified?'is-open':''}`} data-tooltip={listified?'Detailed view':'Listify'} aria-label={listified?'Detailed view':'Listify'} onClick={toggleListify} disabled={!!user&&listifyLoadedFor!==user.id} aria-pressed={listified}><List size={16}/></button>}
      <button type="button" className={`prompt-toolbar-button ${bulkExportOpen?'is-open':''}`} data-tooltip={bulkExportOpen?'Cancel bulk selection':'Export multiple prompts'} aria-label={bulkExportOpen?'Cancel bulk selection':'Export multiple prompts'} aria-pressed={bulkExportOpen} onClick={()=>{setBulkExportOpen(x=>!x);setExportIds([])}}><Download size={16}/></button>
      </div>
    </div>
  </div>
  {bulkExportOpen&&<div className="bulk-export-toolbar" role="group" aria-label="Export multiple prompts">
    <label className="bulk-select-all"><input type="checkbox" checked={searchable.length>0&&searchable.every(p=>exportIds.includes(p.id))} disabled={!searchable.length} onChange={e=>setExportIds(e.target.checked?searchable.map(p=>p.id):[])}/> Select all shown</label>
    <span className="bulk-export-count">{visibleExportRecords.length} selected</span>
    <div className="bulk-export-actions"><Button variant="outline" disabled={!visibleExportRecords.length} onClick={()=>exportSelected('json')}>Export JSON</Button><Button variant="outline" disabled={!visibleExportRecords.length} onClick={()=>exportSelected('markdown')}>Export Markdown</Button></div>
  </div>}
  <div className="rows">{searchable.map(p=>{const v=official(p);return v&&<div key={p.id} className={`bulk-prompt-row ${bulkExportOpen?'is-selecting':''}`}>
    {bulkExportOpen&&<label className="bulk-prompt-checkbox"><input type="checkbox" aria-label={`Select ${v.title} for export`} checked={exportIds.includes(p.id)} onChange={e=>setExportIds(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/></label>}
    <PromptRow prompt={p} version={v} onDoubleClick={()=>openEditorForPrompt(p)} onCopy={()=>{void navigator.clipboard.writeText(v.content).then(()=>{trackUsage(p.id,'copy');notify('Prompt copied to clipboard.')}).catch(()=>notify('Unable to copy prompt to clipboard.'))}} onCombine={()=>{void navigator.clipboard.readText().then(old=>navigator.clipboard.writeText(combineClipboardText(old,v.content))).then(()=>{trackUsage(p.id,'combine');notify('Combined with clipboard.')}).catch(()=>notify('Clipboard access was denied. Allow clipboard reading and try again.'))}} listified={listified} owner={owner(p)} likes={guest?0:likeCounts[p.id]||0} active={selected?.id===p.id} onSelect={()=>{setSelectedId(p.id);setShowMobileDetail(true);trackUsage(p.id,'open')}}/>
  </div>})}
  {searchable.length===0&&<Empty title="No prompts found" description="Try a different search, or be the first to add a prompt." action={guest?undefined:<Button onClick={()=>setEditor({mode:'create'})}><Plus size={16}/> Create prompt</Button>}/>}
  </div></div><aside className={`detail-panel ${showMobileDetail?'mobile-visible':''}`}>{selected&&selectedVersion?<PromptDetail key={selected.id+selectedVersion.id} prompt={selected} version={selectedVersion} latest={selectedLatest} history={history(selected.id)} owner={owner(selected)} creator={person(selected.created_by)} lastEditor={person(selectedLatest?.author_id||selectedVersion.author_id)} canEdit={!guest&&canEdit(selected)} canSuggest={!guest&&canSuggest(selected)} saved={!guest&&data.favorites.some(f=>f.user_id===user?.id&&f.prompt_id===selected.id)} onClose={()=>setShowMobileDetail(false)} recommended={data.recommendations.some(r=>r.prompt_id===selected.id)} isManager={!guest&&isManager(selected.owner_team_id)} readOnly={guest} onTrackUsage={action=>trackUsage(selected.id,action)} onAddToCollection={()=>setCollectionPrompt(selected)} onCompare={versionId=>setCompare({prompt:selected,versionId})} onDeprecate={()=>{const reason=window.prompt("Why should this prompt be deprecated?");if(reason&&reason.trim().length>=3)void doAction(()=>execute('deprecate_team_prompt',{pid:selected.id,reason}),'Team prompt deprecated.')}} onRecommend={()=>doAction(()=>execute('set_team_recommendation',{pid:selected.id,recommend:!data.recommendations.some(r=>r.prompt_id===selected.id)}),'Recommendation updated.')} onFavorite={()=>{if(guest){notify('Sign in to like or save a prompt.');return;}void toggleFavorite(selected)}} onDuplicate={()=>{if(guest){notify('Sign in to duplicate prompts.');return;}void copySelected(selected)}} onShareEmail={()=>setEmailSharePrompt(selected)} onEdit={()=>setEditor({mode:selected.owner_team_id?'suggest':'edit',prompt:selected})} onSuggest={()=>setEditor({mode:'suggest',prompt:selected})} onLifecycle={()=>doAction(()=>execute('set_prompt_lifecycle',{pid:selected.id,new_status:selected.lifecycle==='published'?'draft':'published'}),'Lifecycle updated.')} onDelete={()=>askDelete(selected)} onRequest={id=>doAction(()=>execute('request_version_review',{vid:id}),'Sent for review.')} onArchive={()=>doAction(()=>execute('set_prompt_lifecycle',{pid:selected.id,new_status:'archived'}),'Prompt archived.')} onRestore={()=>doAction(()=>execute('soft_delete_prompt',{pid:selected.id,recover:true}),'Prompt restored.')} onShare={()=>{setShareId(selected.id);setShareTeam(ownTeamList[0]?.id||'')}}/>:<Empty title="Select a prompt" description="Choose a prompt from the list to preview it here."/>}</aside></div>}</>:<>
  {view==='changelog'&&<ChangelogPage onBack={()=>user||guest?navigate('explore'):setView('sign-in')}/>}
  {view==='collections'&&user&&<CollectionsPage data={data} user={user} onOpenPrompt={openCollectionPrompt}/>}
  {view==='teams'&&<div className="teams-layout">{ownTeamList.length===0&&!isAdmin&&<Empty title="You're not part of a team yet" description="Your personal prompts are ready. Ask a manager to add you to a shared library." icon={LockKeyhole}/>} {ownTeamList.map(t=><TeamCard key={t.id} team={t} prompts={data.prompts.filter(p=>p.owner_team_id===t.id&&!p.deleted_at)} versions={data.versions} members={data.members.filter(m=>m.team_id===t.id)} profiles={data.profiles} manager={isManager(t.id)||isAdmin} onRename={()=>setTeamToRename({id:t.id,name:t.name})} onMember={async(email,action)=>{const found=data.profiles.find(p=>p.email.toLowerCase()===email.toLowerCase());if(!found){notify('That person needs to register an account first.');return}await doAction(()=>execute('manage_team_member',{tid:t.id,uid:found.id,operation:action}),action==='add'?'Member added.':'Member removed.')}}/>)}</div>}
  {view==='reviews'&&<div className="reviews-layout"><div className="review-summary"><span><Clock3 size={18}/> Needs your attention</span><strong>{reviewQueue.length} pending</strong></div>{reviewQueue.map(item=>{const current=official(item.prompt);const proposed=item.kind==='version'?item.record as PromptVersion:(item.record as Proposal).proposed_content;const changed=item.kind==='version'?(item.record as PromptVersion).content:(item.record as Proposal).proposed_content.content;return <article className="review-card" key={item.record.id}><div className="review-card-header"><div><h3>{current?.title||proposed.title}</h3><p>{owner(item.prompt)} · submitted by {person(item.kind==='proposal'?(item.record as Proposal).author_id:(item.record as PromptVersion).author_id)}</p></div><Flag tone="amber">{item.kind==='proposal'?(item.record as Proposal).status.replace('_',' '):'Under review'}</Flag></div><div className="compare-grid"><div><div className="compare-label">Current official version</div><pre>{current?.content||'No approved version yet'}</pre></div><div><div className="compare-label">Proposed version</div><pre>{changed}</pre></div></div>{item.kind==='proposal'&&(item.record as Proposal).rationale&&<p className="review-rationale">Reason: {(item.record as Proposal).rationale}</p>}{item.kind==='proposal'&&((item.record as Proposal).target_team_id)&&((item.record as Proposal).target_team_id!==item.prompt.owner_team_id)&&<p className="review-rationale">Requested team transfer: {owner(item.prompt)} → {data.teams.find(t=>t.id===(item.record as Proposal).target_team_id)?.name||'Unknown team'}. Approval requires management rights in both teams.</p>}<div className="review-structured"><strong>Other fields</strong><div className="compare-grid"><div><small>Current · title / category / tags</small><p>{current?.title||'—'} · {current?.category||'—'} · {current?.tags.join(', ')||'—'}</p></div><div><small>Proposed · title / category / tags</small><p>{proposed.title} · {proposed.category} · {proposed.tags.join(', ')}</p></div></div></div><div className="review-footer"><input aria-label="Rejection reason" placeholder="Reason if rejecting…" value={reviewReason[item.record.id]||''} onChange={e=>setReviewReason(s=>({...s,[item.record.id]:e.target.value}))}/>{item.kind==='proposal'&&(item.record as Proposal).status==='open'&&<Button variant="outline" onClick={()=>doAction(()=>execute('set_proposal_under_review',{proposal_id:item.record.id}),'Proposal moved to Under Review.')}>Start review</Button>}<Button variant="outline" onClick={()=>askReview(item,false)}>Reject</Button><Button disabled={item.kind==='proposal'&&!!(item.record as Proposal).target_team_id&&(item.record as Proposal).target_team_id!==item.prompt.owner_team_id&&!isManager((item.record as Proposal).target_team_id||null)&&!isAdmin} onClick={()=>askReview(item,true)}><Check size={15}/>{item.kind==='proposal'?'Accept proposal':'Approve version'}</Button></div></article>})}{reviewQueue.length===0&&<Empty title="All caught up" description="When your team needs an approval, it will appear here." icon={CheckCircle2}/>}</div>}
  {view==='admin'&&isAdmin&&<AdminSection data={data} busy={busy} onCreate={async(team,description,email)=>{const target=data.profiles.find(p=>p.email.toLowerCase()===email.toLowerCase());if(!target){notify('The manager must have an account first.');return}await doAction(()=>execute('create_team',{team_name:team,team_description:description,first_manager:target.id}),'Team created.')}} onManager={(tid,uid,promote)=>doAction(()=>execute('set_team_manager',{tid,uid,promote}),'Team role updated.')}/>}
  {view==='admin'&&isAdmin&&<AdminCategories
    categories={categoryNames}
    usedCategories={[...data.versions.map(v=>v.category),...data.proposals.map(p=>p.proposed_content.category)]}
    busy={busy}
    onRename={async(oldName,newName)=>{const result=await doAction(()=>execute('rename_category',{old_name:oldName,new_name:newName}),'Category renamed.');return result!==null}}
    onDelete={async name=>{const result=await doAction(()=>deleteCategory(name),'Category deleted.');return result!==null}}
    onDeleteUnused={async()=>{const count=await doAction(deleteUnusedCategories);if(typeof count!=='number')return null;notify(count===0?'No unused categories found.':`${count} unused categor${count===1?'y':'ies'} deleted.`);return count}}
  />}
  {view==='admin'&&isAdmin&&<AdminAdvanced data={data} busy={busy} executeAction={async(name,args)=>await doAction(()=>execute(name,args),'Updated successfully.')} onIdentity={accountAdmin} onRefresh={reload} notify={notify} onRenameTeam={team=>setTeamToRename(team)}/>}
  </>}
  </main>}
   {teamToRename&&<RenameTeamDialog team={teamToRename} onClose={()=>setTeamToRename(null)} onSave={async newName=>{
     const result=await doAction(()=>execute('rename_team',{tid:teamToRename.id,new_name:newName}),'Team renamed.');
     return result!==null;
   }}/>}
   <footer className="footer"><div className="container"><span>© Promptfolio</span><span className="footer-build-info"><a href={`${import.meta.env.BASE_URL}#/changelog`} aria-label={`View changelog for v${packageInfo.version}`} title="View changelog" style={{textDecoration:'underline',textUnderlineOffset:3}} onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate('changelog')}}>v{packageInfo.version}</a><span className="footer-dot">·</span><span>Last updated: {when(__PROMPTFOLIO_BUILD_DATE__)}</span><span className="footer-dot">·</span><a href="https://github.com/valentinsvelev/promptfolio" target="_blank" rel="noopener noreferrer" aria-label="View Promptfolio on GitHub" title="GitHub repository" style={{textDecoration:'underline',textUnderlineOffset:3}}>GitHub</a></span></div></footer>
  <input aria-label="Import prompt file" type="file" accept=".json,.md,application/json,text/markdown" ref={importRef} hidden onChange={e=>{void importPrompt(e.target.files?.[0]);e.target.value=''}}/>
  {searchExpanded&&<Modal onClose={()=>setSearchExpanded(false)}><div className="search-dialog">
    <div className="modal-header"><div><h2>Keywords search</h2><p>Find prompts by title, content, tags, or team.</p></div><button className="round-icon pf-icon-tooltip" type="button" aria-label="Close keywords search" onClick={()=>setSearchExpanded(false)}><X size={19}/></button></div>
    <form role="search" className="search-dialog-form" onSubmit={e=>{e.preventDefault();setSearchExpanded(false)}}>
      <label className="field" htmlFor="promptSearch">Keywords</label>
      <div className="search-dialog-input"><Search size={18} aria-hidden="true"/><input ref={searchInputRef} id="promptSearch" autoFocus type="search" aria-label="Search prompt keywords" placeholder="Search prompts, tags, teams…" value={query} onChange={e=>{setQuery(e.target.value);setSelectedId(null)}}/></div>
      <p className="search-dialog-hint">Results update while you type. Search only includes prompts you can access.</p>
      <div className="search-dialog-actions"><Button type="button" variant="outline" onClick={()=>{setQuery('');setSelectedId(null)}} disabled={!query}>Clear search</Button><Button type="submit">Show results <ArrowRight size={15}/></Button></div>
    </form>
  </div></Modal>}
  {advancedOpen&&<Modal wide onClose={()=>setAdvancedOpen(false)}><div className="filters-dialog">
    <div className="modal-header"><div><h2>Filters</h2><p>Refine the prompts shown in your library.</p></div><button className="round-icon pf-icon-tooltip" type="button" aria-label="Close filters" onClick={()=>setAdvancedOpen(false)}><X size={19}/></button></div>
    <div className="filters-dialog-scroll">{filterControls}</div>
    <div className="filters-dialog-actions"><Button variant="outline" type="button" onClick={()=>{setFacets({team:'',owner:'',category:'',tag:'',lifecycle:'',approval:'',updated:''});setRecommendOnly(false);setSelectedId(null)}}>Clear filters</Button><Button type="button" onClick={()=>setAdvancedOpen(false)}>Show results <ArrowRight size={15}/></Button></div>
  </div></Modal>}
  {editor&&<PromptEditor editor={editor} body={editorBody} teams={editor.mode==='create'?ownTeamList:[...ownTeamList,...data.teams.filter(t=>t.id===editor.prompt?.owner_team_id&&!ownTeamList.some(ot=>ot.id===t.id))]} categoryNames={categoryNames} existingTitles={accessible.filter(p=>p.id!==editor.prompt?.id).map(p=>official(p)?.title||'')} onClose={()=>setEditor(null)} onSubmit={submitEditor} saving={busy} canManage={!!editor.prompt&&(editor.prompt.owner_user_id===user?.id||isManager(editor.prompt.owner_team_id))} canDeprecate={!!editor.prompt?.owner_team_id&&isManager(editor.prompt.owner_team_id)} onAction={action=>{
    const p=editor.prompt;if(!p)return;
    if(action==='share'){setShareId(p.id);setShareTeam(ownTeamList[0]?.id||'');setEditor(null);return}
    if(action==='deprecate'){const reason=window.prompt('Why should this prompt be deprecated?');if(reason&&reason.trim().length>=3){void doAction(()=>execute('deprecate_team_prompt',{pid:p.id,reason}),'Team prompt deprecated.');setEditor(null)}return}
    if(action==='trash'){askDelete(p);setEditor(null);return}
    void doAction(()=>execute('set_prompt_lifecycle',{pid:p.id,new_status:action==='draft'?'draft':'archived'}),action==='draft'?'Moved to draft.':'Prompt archived.');setEditor(null);
  }}/>}
  {confirm&&<Modal onClose={()=>setConfirm(null)}><div className="confirm-modal"><div className="modal-header"><div><h2>{confirm.title}</h2><p>{confirm.description}</p></div><button className="round-icon pf-icon-tooltip" onClick={()=>setConfirm(null)}><X size={20}/></button></div><div className="confirm-actions"><Button variant="outline" onClick={()=>setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={()=>confirm.run()}>{busy?'Working…':confirm.confirm}</Button></div></div></Modal>}
  {shareId&&<Modal onClose={()=>setShareId(null)}><div className="confirm-modal"><div className="modal-header"><div><h2>Share a separate copy</h2><p>Your personal prompt remains private. The shared copy is published to the chosen team.</p></div><button className="round-icon pf-icon-tooltip" onClick={()=>setShareId(null)}><X size={20}/></button></div><label className="field">Team<select value={shareTeam} onChange={e=>setShareTeam(e.target.value)}>{ownTeamList.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="confirm-actions"><Button variant="outline" onClick={()=>setShareId(null)}>Cancel</Button><Button disabled={!shareTeam||busy} onClick={async()=>{await doAction(()=>execute('share_personal_prompt',{pid:shareId,target_team_id:shareTeam}),'Shared to your team.');setShareId(null)}}>Share copy <ArrowRight size={16}/></Button></div></div></Modal>}
  {collectionPrompt&&user&&!guest&&<AddToCollectionDialog key={collectionPrompt.id} prompt={collectionPrompt} user={user} data={data} onClose={()=>setCollectionPrompt(null)} onGoToCollections={()=>{setCollectionPrompt(null);navigate('collections')}}/>}
  {emailSharePrompt&&user&&<SharePromptEmailDialog prompt={emailSharePrompt} version={official(emailSharePrompt)!} versions={history(emailSharePrompt.id)} senderEmail={user.email} senderName={data.profiles.find(p=>p.id===user.id)?.display_name||user.email} onClose={()=>setEmailSharePrompt(null)}/>}
  {feedbackOpen&&user&&<FeedbackDialog onClose={()=>setFeedbackOpen(false)} onSubmitted={()=>notify('GitHub issue created.')}/>}
  {noticeOpen&&<Modal onClose={()=>setNoticeOpen(false)}><div className="confirm-modal"><div className="modal-header"><div><h2>Notifications</h2><p>Team reviews and decisions that matter to you.</p></div><button className="round-icon pf-icon-tooltip" onClick={()=>setNoticeOpen(false)}><X size={19}/></button></div><div className="notification-list">{data.notifications.filter(n=>n.recipient_id===user?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(n=><button key={n.id} className={`notification-item ${n.read_at?'is-read':''}`} onClick={async()=>{await doAction(()=>execute('mark_notification_read',{nid:n.id}));setNoticeOpen(false);if(n.prompt_id){setView('explore');setSelectedId(n.prompt_id)}}}><span><Bell size={16}/></span><span><strong>{n.message}</strong><small>{when(n.created_at)} {n.read_at?'':'· Unread'}</small></span></button>)}{data.notifications.filter(n=>n.recipient_id===user?.id).length===0&&<Empty title="All caught up" description="Review updates will appear here." icon={Bell}/>}</div><div className="confirm-actions"><Button variant="outline" onClick={()=>setNoticeOpen(false)}>Close</Button><Button onClick={()=>doAction(()=>execute('mark_notification_read',{nid:null}),'All notifications marked read.')}>Mark all read</Button></div></div></Modal>}
  {compare&&<CompareVersions data={data} comparison={compare} onClose={()=>setCompare(null)} onRestore={async versionId=>{const original=data.versions.find(v=>v.id===versionId&&v.prompt_id===compare.prompt.id);if(!original){notify('Version not found.');return}const result=compare.prompt.owner_team_id?await doAction(()=>execute('propose_improvement',{pid:compare.prompt.id,payload:{title:original.title,description:original.description,content:original.content,category:original.category,tags:original.tags,usage_instructions:original.usage_instructions,example_inputs:original.example_inputs,expected_outputs:original.expected_outputs,compatible_models:original.compatible_models},explanation:`Suggest restoring v${original.version_number}. ${restoreNote}`.trim()}),'Restoration suggested to team managers.'):await doAction(()=>execute('restore_prompt_version',{pid:compare.prompt.id,source_version_id:versionId,note:restoreNote}),'Old version restored as a new version.');if(result)setCompare(null)}} note={restoreNote} setNote={setRestoreNote}/>}
  {settingsOpen&&user&&<AccountSettings
    name={person(user.id)} email={user.email} statistics={settingsStatistics} usageRevision={usageRevision}
    defaultExploreTab={defaultExploreTab} tabOrder={explorePrefs.tabOrder} onDefaultExploreTabChange={changeDefaultExploreTab}
    demoMode={isDemo} preferencesReady={explorePrefsReady}
    onSaveName={async name=>{await updateDisplayName(name);await reload()}}
    onSavePassword={changePassword}
    onClose={()=>setSettingsOpen(false)}
  />}
  {exploreTabEditorOpen&&user&&<ExploreTabsDialog preferences={explorePrefs} demoMode={isDemo} onSave={saveExploreChoice} onClose={()=>setExploreTabEditorOpen(false)}/>}
  {toast&&<div className="toast" role="status"><CheckCircle2 size={17}/>{toast}<button className="pf-icon-tooltip" onClick={()=>setToast('')} aria-label="Dismiss notification"><X size={14}/></button></div>}
  </div>;
}




