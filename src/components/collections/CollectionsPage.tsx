import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {ArrowDown,ArrowUp,FolderPlus,Plus,Trash2,X} from 'lucide-react';
import type {AppData,Identity,Prompt,PromptVersion} from '../../types';
import {Button,Modal} from '../ui';
import {addCollectionItem,createCollection,deleteCollection,loadCollections,moveCollectionItem,removeCollectionItem,updateCollection,
  type CollectionIndex,type CollectionItem,type PromptCollection} from '../../services/collections';

type Props={data:AppData;user:Identity;onOpenPrompt:(prompt:Prompt)=>void};
const emptyIndex:CollectionIndex={collections:[],items:[]};
const sortByName=(a:PromptCollection,b:PromptCollection)=>a.name.localeCompare(b.name);
function resolvedVersion(data:AppData,p:Prompt):PromptVersion|undefined{
  return data.versions.find(v=>v.id===p.official_version_id)||data.versions.find(v=>v.id===p.latest_version_id);
}
export function CollectionsPage({data,user,onOpenPrompt}:Props){
  const [index,setIndex]=useState<CollectionIndex>(emptyIndex);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [editing,setEditing]=useState<PromptCollection|'new'|null>(null);
  const [deleting,setDeleting]=useState<PromptCollection|null>(null);
  const [adding,setAdding]=useState(false);
  const [search,setSearch]=useState('');
  const [name,setName]=useState('');const [description,setDescription]=useState('');const [teamId,setTeamId]=useState('');
  const managerTeams=data.teams.filter(t=>data.members.some(m=>m.user_id===user.id&&m.team_id===t.id&&m.role==='manager'));
  const refresh=useCallback(async()=>{const next=await loadCollections();setIndex(next);setSelectedId(old=>old&&next.collections.some(c=>c.id===old)?old:next.collections[0]?.id||null);},[]);
  useEffect(()=>{let alive=true;void loadCollections().then(next=>{if(!alive)return;setIndex(next);setSelectedId(next.collections[0]?.id||null)}).catch(e=>{if(alive)setMessage(e instanceof Error?e.message:'Could not load collections.');}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[]);
  const selected=index.collections.find(c=>c.id===selectedId)||null;
  const manageable=(c:PromptCollection)=>c.owner_user_id===user.id||!!c.team_id&&(
    data.members.some(m=>m.user_id===user.id&&m.team_id===c.team_id&&m.role==='manager'));
  const items=useMemo(()=>selected?index.items.filter(i=>i.collection_id===selected.id).sort((a,b)=>a.sort_order-b.sort_order)
    .map(i=>({item:i,prompt:data.prompts.find(p=>p.id===i.prompt_id)})).filter((x):x is {item:CollectionItem;prompt:Prompt}=>!!x.prompt&&!x.prompt.deleted_at):[],[index,selected,data.prompts]);
  const candidates=useMemo(()=>{
    if(!selected)return [];
    const existing=new Set(index.items.filter(i=>i.collection_id===selected.id).map(i=>i.prompt_id));
    const term=search.toLowerCase().trim();
    return data.prompts.filter(p=>!p.deleted_at&&!existing.has(p.id)&&(!selected.team_id||
      !!p.owner_team_id&&p.lifecycle==='published'&&!!p.official_version_id))
      .map(p=>({prompt:p,version:resolvedVersion(data,p)})).filter((x):x is {prompt:Prompt;version:PromptVersion}=>!!x.version)
      .filter(({prompt,version})=>!term||[version.title,version.category,data.teams.find(t=>t.id===prompt.owner_team_id)?.name||'Personal'].join(' ').toLowerCase().includes(term))
      .sort((a,b)=>a.version.title.localeCompare(b.version.title)).slice(0,80);
  },[selected,index.items,search,data]);
  async function act(fn:()=>Promise<unknown>,success:string){setBusy(true);setMessage('');try{await fn();await refresh();setMessage(success);return true}catch(e){setMessage(e instanceof Error?e.message:'Operation failed.');return false}finally{setBusy(false)}}
  function openEditor(c:PromptCollection|'new'){
    setEditing(c);setName(c==='new'?'':c.name);setDescription(c==='new'?'':c.description);setTeamId(c==='new'?'':c.team_id||'');setMessage('');
  }
  async function submitEditor(e:FormEvent){e.preventDefault();if(name.trim().length<2||name.trim().length>80)return;
    if(editing==='new'){
      let createdId:string|null=null;
      const done=await act(async()=>{createdId=await createCollection(name,description,teamId||null)},'Collection created.');
      if(done){if(createdId)setSelectedId(createdId);setEditing(null)}
    }else if(editing){const done=await act(()=>updateCollection(editing.id,name,description),'Collection updated.');if(done)setEditing(null)}
  }
  return <section className="collections-workspace" aria-label="Prompt collections">
    {message&&<p className="collection-message" role="status">{message}</p>}
    {loading?<p className="collection-muted">Loading collections…</p>:<div className="collections-layout">
      <div className="collections-left-rail">
        <div className="collections-create-action"><Button type="button" onClick={()=>openEditor('new')}><FolderPlus size={16}/> New collection</Button></div>
        <aside className="collections-sidebar" aria-label="Your collections">
        <h3>Your collections</h3>
        {index.collections.length===0?<div className="collections-empty"><p>No collections yet.</p><p>Create one to group prompts into a repeatable workflow.</p></div>:null}
        {[...index.collections].sort((a,b)=>Number(!!b.owner_user_id)-Number(!!a.owner_user_id)||sortByName(a,b)).map(c=>{
          const label=c.team_id?data.teams.find(t=>t.id===c.team_id)?.name||'Team':'Personal';
          const count=index.items.filter(i=>i.collection_id===c.id&&data.prompts.some(p=>p.id===i.prompt_id&&!p.deleted_at)).length;
          return <button key={c.id} type="button" aria-pressed={c.id===selectedId} className={`collection-sidebar-item ${c.id===selectedId?'selected':''}`} onClick={()=>setSelectedId(c.id)}>
            <strong>{c.name}</strong><small>{label} · {count} prompt{count===1?'':'s'}</small>
          </button>;
        })}
        </aside>
      </div>
      <div className="collection-content">
        {!selected?<div className="collections-empty"><h3>Organize a workflow</h3><p>Create a personal collection, or a shared team collection if you're a team manager.</p></div>:<>
          <div className="collection-detail-head"><div><span className="collection-scope">{selected.team_id?data.teams.find(t=>t.id===selected.team_id)?.name||'Team':'Personal'} collection</span><h3>{selected.name}</h3><p>{selected.description||'An ordered group of prompts you can return to any time.'}</p></div>
            {manageable(selected)&&<div className="collection-detail-actions"><Button variant="outline" onClick={()=>openEditor(selected)} disabled={busy}>Edit</Button><Button variant="outline" className="pf-icon-tooltip" onClick={()=>setDeleting(selected)} disabled={busy} aria-label={`Delete ${selected.name}`} data-tooltip="Delete collection"><Trash2 size={15}/></Button></div>}
          </div>
          <div className="collection-items-head"><h4>Prompts in this collection <span>{items.length}</span></h4>{manageable(selected)&&<Button variant="outline" disabled={busy} onClick={()=>{setSearch('');setAdding(true)}}><Plus size={15}/> Add prompts</Button>}</div>
          {items.length===0?<div className="collections-empty"><p>This collection is empty, or its prompts are no longer accessible.</p>{manageable(selected)&&<button className="text-button" type="button" onClick={()=>setAdding(true)}>Add your first prompt</button>}</div>:<div className="collection-item-list">{items.map(({item,prompt},i)=>{
            const version=resolvedVersion(data,prompt);if(!version)return null;
            return <div className="collection-item" key={prompt.id}><span className="collection-order">{i+1}</span><button type="button" className="collection-item-main" onClick={()=>onOpenPrompt(prompt)}><strong>{version.title}</strong><small>{data.teams.find(t=>t.id===prompt.owner_team_id)?.name||'Personal'} · {version.category}</small></button>
              {manageable(selected)&&<div className="collection-item-controls"><button type="button" className="pf-icon-tooltip" aria-label={`Move ${version.title} up`} data-tooltip="Move up" disabled={busy||i===0} onClick={()=>void act(()=>moveCollectionItem(selected.id,item.prompt_id,'up'),'Order updated.')}><ArrowUp size={16}/></button><button type="button" className="pf-icon-tooltip" aria-label={`Move ${version.title} down`} data-tooltip="Move down" disabled={busy||i===items.length-1} onClick={()=>void act(()=>moveCollectionItem(selected.id,item.prompt_id,'down'),'Order updated.')}><ArrowDown size={16}/></button><button type="button" className="pf-icon-tooltip" aria-label={`Remove ${version.title} from collection`} data-tooltip="Remove from collection" disabled={busy} onClick={()=>void act(()=>removeCollectionItem(selected.id,item.prompt_id),'Prompt removed from collection.')}><X size={16}/></button></div>}
            </div>;
          })}</div>}
        </>}
      </div>
    </div>}
    {editing&&<Modal onClose={()=>setEditing(null)}><form className="collection-modal" onSubmit={e=>void submitEditor(e)}>
      <div className="modal-header"><div><h2>{editing==='new'?'Create a collection':'Edit collection'}</h2></div><button type="button" className="round-icon pf-icon-tooltip" aria-label="Close collection editor" onClick={()=>setEditing(null)}><X size={18}/></button></div>
      <div className="collection-modal-fields"><label className="field">Collection name<input required autoFocus minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Customer research workflow"/></label>
        <label className="field">Description<textarea maxLength={500} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe how to use this collection"/></label>
        {editing==='new'&&<label className="field">Collection visibility<select value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="">Personal — only me</option>{managerTeams.map(t=><option key={t.id} value={t.id}>{t.name} — shared with team</option>)}</select></label>}
        {editing==='new'&&teamId&&<p className="collection-muted">Team collections can include published team prompts. Members can view them; managers can edit them.</p>}
      </div><div className="confirm-actions"><Button type="button" variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button type="submit" disabled={busy||name.trim().length<2||name.trim().length>80}>{busy?'Saving…':'Save collection'}</Button></div>
    </form></Modal>}
    {deleting&&<Modal onClose={()=>setDeleting(null)}><div className="collection-modal"><div className="modal-header"><div><h2>Delete collection?</h2><p>Delete “{deleting.name}”? The prompts themselves will not be deleted.</p></div></div><div className="confirm-actions"><Button variant="outline" onClick={()=>setDeleting(null)}>Cancel</Button><Button disabled={busy} onClick={()=>void act(()=>deleteCollection(deleting.id),'Collection deleted.').then(ok=>{if(ok)setDeleting(null)})}>Delete collection</Button></div></div></Modal>}
    {adding&&selected&&<Modal onClose={()=>setAdding(false)}><div className="collection-modal"><div className="modal-header"><div><h2>Add prompts</h2><p>Add existing prompts to “{selected.name}”.</p></div><button type="button" aria-label="Close add prompts" className="round-icon pf-icon-tooltip" onClick={()=>setAdding(false)}><X size={18}/></button></div>
      <div className="collection-modal-fields"><label className="field">Find prompts<input autoFocus placeholder="Search title, category, or team" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="collection-candidates" role="list">{candidates.length===0?<p className="collection-muted">No eligible prompts to add.</p>:candidates.map(({prompt,version})=><div className="collection-candidate" key={prompt.id} role="listitem"><span><strong>{version.title}</strong><small>{data.teams.find(t=>t.id===prompt.owner_team_id)?.name||'Personal'} · {version.category}</small></span><Button variant="outline" disabled={busy} onClick={()=>void act(()=>addCollectionItem(selected.id,prompt.id),'Prompt added to collection.')}>Add</Button></div>)}</div></div>
      <div className="confirm-actions"><Button onClick={()=>setAdding(false)}>Done</Button></div>
    </div></Modal>}
  </section>;
}
