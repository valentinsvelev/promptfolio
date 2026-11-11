import { useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button, Modal } from '../ui';
import '../../styles/categoryManagement.css';

type DeleteRequest = { kind: 'single'; name: string } | { kind: 'unused' };

export function AdminCategories({categories,usedCategories,busy,onRename,onDelete,onDeleteUnused}:{
  categories:string[];
  usedCategories:string[];
  busy:boolean;
  onRename:(oldName:string,newName:string)=>Promise<boolean>;
  onDelete:(name:string)=>Promise<boolean>;
  onDeleteUnused:()=>Promise<number|null>;
}){
  const [selected,setSelected]=useState('');
  const [newName,setNewName]=useState('');
  const [pending,setPending]=useState<DeleteRequest|null>(null);
  const current=categories.includes(selected)?selected:'';
  const candidate=newName.trim();
  const used=new Set(usedCategories.map(name=>name.trim().toLocaleLowerCase()));
  const inUse=!!current&&used.has(current.trim().toLocaleLowerCase());
  const unusedCount=categories.filter(name=>!used.has(name.trim().toLocaleLowerCase())).length;

  async function rename(e:FormEvent){
    e.preventDefault();
    if(!current||candidate.length<2||candidate.length>70||candidate===current)return;
    const success=await onRename(current,candidate);
    if(success){setSelected(candidate);setNewName(candidate);}
  }
  async function confirmDeletion(){
    if(!pending||busy)return;
    if(pending.kind==='single'){
      const success=await onDelete(pending.name);
      if(!success)return;
      if(selected===pending.name){setSelected('');setNewName('');}
    }else{
      const removed=await onDeleteUnused();
      if(removed===null)return;
      setSelected('');setNewName('');
    }
    setPending(null);
  }

  return <section className="admin-card admin-category-management">
    <h3>Manage the categories.</h3>
    <p>Rename a category across prompts and versions, or delete categories that are no longer used.</p>
    <form className="admin-category-simple-form" onSubmit={rename}>
      <label className="field">Category
        <select aria-label="Select a category to rename" value={current} onChange={e=>{setSelected(e.target.value);setNewName(e.target.value)}}>
          <option value="">Select a category</option>
          {[...categories].sort((a,b)=>a.localeCompare(b)).map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {current&&<>
        <label className="field">New category name
          <input aria-label="New category name" required minLength={2} maxLength={70} value={newName} onChange={e=>setNewName(e.target.value)}/>
        </label>
        <div className="category-management-actions">
          <Button type="submit" variant="outline" disabled={busy||candidate.length<2||candidate.length>70||candidate===current}>Rename category</Button>
          <Button type="button" variant="outline" className="category-delete-button" disabled={busy||inUse} onClick={()=>setPending({kind:'single',name:current})}><Trash2 size={15}/> Delete category</Button>
        </div>
        <p className="category-usage-note" role="status">{inUse
          ? 'This category is used by a saved version or improvement proposal and cannot be deleted.'
          : 'No uses found in loaded data. The database will check all versions and proposals before deletion.'}</p>
      </>}
    </form>
    <div className="category-cleanup-row">
      <div><strong>Unused categories</strong><span>Removes only category names—not prompts, versions, or proposals.</span></div>
      <Button type="button" variant="outline" disabled={busy||unusedCount===0} onClick={()=>setPending({kind:'unused'})}>
        <Trash2 size={15}/> Delete unused {unusedCount>0?`(${unusedCount})`:''}
      </Button>
    </div>
    {pending&&<Modal onClose={()=>{if(!busy)setPending(null)}}>
      <div className="confirm-modal category-delete-confirm">
        <div className="modal-header"><div>
          <h2>{pending.kind==='single'?'Delete category?':'Delete unused categories?'}</h2>
          <p>{pending.kind==='single'
            ? <>Delete <strong>{pending.name}</strong> from the category list? This cannot be undone. The database will prevent deletion if any saved version or proposal uses it.</>
            : 'Remove every category that has no references in saved versions or improvement proposals? Prompt content and history will not be changed.'}</p>
        </div><button type="button" className="round-icon pf-icon-tooltip" aria-label="Close" disabled={busy} onClick={()=>setPending(null)}><X size={19}/></button></div>
        <div className="confirm-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={()=>setPending(null)}>Cancel</Button>
          <Button type="button" variant="outline" className="category-delete-button" disabled={busy} onClick={()=>void confirmDeletion()}><Trash2 size={15}/>{busy?'Deleting…':pending.kind==='single'?'Delete category':'Delete unused categories'}</Button>
        </div>
      </div>
    </Modal>}
  </section>;
}
