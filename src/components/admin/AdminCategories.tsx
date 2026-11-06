import { useState, type FormEvent } from 'react';
import { Button } from '../ui';
export function AdminCategories({categories,busy,onRename}:{categories:string[];busy:boolean;onRename:(oldName:string,newName:string)=>Promise<boolean>}){
  const [selected,setSelected]=useState('');
  const [newName,setNewName]=useState('');
  const current=categories.includes(selected)?selected:'';
  const candidate=newName.trim();
  async function rename(e:FormEvent){
    e.preventDefault();
    if(!current||candidate.length<2||candidate.length>70||candidate===current)return;
    const success=await onRename(current,candidate);
    if(success){setSelected(candidate);setNewName(candidate);}
  }
  return <section className="admin-card admin-category-management">
    <h3>Manage the categories.</h3>
    <p>Choose a category to rename it across existing prompts and versions.</p>
    <form className="admin-category-simple-form" onSubmit={rename}>
      <label className="field">Category
        <select aria-label="Select a category to rename" value={current} onChange={e=>{setSelected(e.target.value);setNewName(e.target.value)}}>
          <option value="">Select a category</option>
          {[...categories].sort((a,b)=>a.localeCompare(b)).map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {current&&<><label className="field">New category name
        <input aria-label="New category name" required minLength={2} maxLength={70} value={newName} onChange={e=>setNewName(e.target.value)}/>
      </label>
      <Button type="submit" variant="outline" disabled={busy||candidate.length<2||candidate.length>70||candidate===current}>Rename category</Button></>}
    </form>
  </section>;
}
