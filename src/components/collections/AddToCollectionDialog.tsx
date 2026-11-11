import {useEffect,useState} from 'react';
import {FolderPlus,X} from 'lucide-react';
import type {AppData,Identity,Prompt} from '../../types';
import {Button,Modal} from '../ui';
import {addCollectionItem,loadCollections,type CollectionIndex} from '../../services/collections';

export function AddToCollectionDialog({prompt,user,data,onClose,onGoToCollections}: {
  prompt:Prompt;user:Identity;data:AppData;onClose:()=>void;onGoToCollections:()=>void;
}){
  const [index,setIndex]=useState<CollectionIndex|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState('');
  useEffect(()=>{let active=true;void loadCollections().then(value=>{if(active)setIndex(value)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load collections.');});return()=>{active=false}},[]);
  const permitted=index?.collections.filter(c=>{
    const manages=c.owner_user_id===user.id||!!c.team_id&&(
      data.members.some(m=>m.user_id===user.id&&m.team_id===c.team_id&&m.role==='manager'));
    return manages&&(!c.team_id||!!prompt.owner_team_id&&prompt.lifecycle==='published'&&!!prompt.official_version_id);
  })||[];
  async function add(id:string,name:string){setBusy(true);setError('');try{await addCollectionItem(id,prompt.id);setDone(`Added to ${name}.`);setIndex(await loadCollections());}catch(e){setError(e instanceof Error?e.message:'Could not add the prompt.')}finally{setBusy(false)}}
  return <Modal onClose={onClose}><div className="collection-modal"><div className="modal-header"><div><h2>Add to collection</h2><p>Place this prompt in a personal or team workflow.</p></div><button type="button" className="round-icon pf-icon-tooltip" aria-label="Close add to collection" onClick={onClose}><X size={18}/></button></div>
    <div className="collection-modal-fields">{error&&<p role="alert" className="collection-error">{error}</p>}{done&&<p role="status" className="collection-message">{done}</p>}
      {!index&&!error?<p className="collection-muted">Loading collections…</p>:permitted.length===0?<p className="collection-muted">No eligible collections yet. You can create one from the Collections page.</p>:<div className="collection-candidates">{permitted.map(c=>{
        const added=index?.items.some(i=>i.collection_id===c.id&&i.prompt_id===prompt.id);
        return <div className="collection-candidate" key={c.id}><span><strong>{c.name}</strong><small>{c.team_id?data.teams.find(t=>t.id===c.team_id)?.name||'Team':'Personal'}</small></span><Button variant="outline" disabled={busy||added} onClick={()=>void add(c.id,c.name)}>{added?'Added':'Add'}</Button></div>;
      })}</div>}
    </div><div className="confirm-actions"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onGoToCollections}><FolderPlus size={15}/> Manage collections</Button></div>
  </div></Modal>;
}
