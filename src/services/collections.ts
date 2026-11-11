import { client, demoIdentity, isDemo } from './api';

export type PromptCollection = {
  id: string;
  name: string;
  description: string;
  owner_user_id: string | null;
  team_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type CollectionItem = { collection_id: string; prompt_id: string; sort_order: number; added_at: string };
export type CollectionIndex = { collections: PromptCollection[]; items: CollectionItem[] };

const demoKey = 'promptfolio:collections-demo-v1';
const stamp = () => new Date().toISOString();
function readDemo(): CollectionIndex {
  try {
    const parsed = JSON.parse(localStorage.getItem(demoKey) || '{}') as Partial<CollectionIndex>;
    return { collections: Array.isArray(parsed.collections) ? parsed.collections : [], items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch { return { collections: [], items: [] }; }
}
function saveDemo(index: CollectionIndex): void { localStorage.setItem(demoKey, JSON.stringify(index)); }
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const {data,error}=await client!.rpc(name,args);
  if(error) throw new Error(error.message);
  return data as T;
}
async function readPages(table:'prompt_collections'|'prompt_collection_items',columns:string,orderColumn:string):Promise<Record<string,unknown>[]> {
  const records:Record<string,unknown>[]=[];
  const pageSize=500;
  // Supabase normally caps each SELECT response at 1,000 rows. Paginate to
  // keep larger collections complete instead of silently dropping items.
  for(let start=0;start<100000;start+=pageSize){
    const {data,error}=await client!.from(table).select('*').order(orderColumn,{ascending:true}).range(start,start+pageSize-1);
    if(error)throw new Error(`${table}: ${error.message}`);
    records.push(...(data||[]));
    if(!data||data.length<pageSize)break;
  }
  return records;
}
export async function loadCollections(): Promise<CollectionIndex> {
  if(isDemo) return readDemo();
  const [collections,items]=await Promise.all([
    readPages('prompt_collections','id,name,description,owner_user_id,team_id,created_by,created_at,updated_at','id'),
    readPages('prompt_collection_items','collection_id,prompt_id,sort_order,added_at','prompt_id'),
  ]);
  return {collections:collections as PromptCollection[],items:items as CollectionItem[]};
}
export async function createCollection(name:string,description:string,teamId:string|null):Promise<string> {
  if(!isDemo) return rpc<string>('create_prompt_collection',{collection_name:name,collection_description:description,collection_team_id:teamId});
  const index=readDemo(), id=crypto.randomUUID(), at=stamp();
  index.collections.push({id,name:name.trim(),description,owner_user_id:teamId?null:demoIdentity.id,team_id:teamId,created_by:demoIdentity.id,created_at:at,updated_at:at});
  saveDemo(index);return id;
}
export async function updateCollection(id:string,name:string,description:string):Promise<void> {
  if(!isDemo){await rpc<void>('update_prompt_collection',{cid:id,collection_name:name,collection_description:description});return;}
  const index=readDemo(), collection=index.collections.find(c=>c.id===id);
  if(!collection)throw new Error('Collection not found.');
  collection.name=name.trim();collection.description=description;collection.updated_at=stamp();saveDemo(index);
}
export async function deleteCollection(id:string):Promise<void> {
  if(!isDemo){await rpc<void>('delete_prompt_collection',{cid:id});return;}
  const index=readDemo();index.collections=index.collections.filter(c=>c.id!==id);
  index.items=index.items.filter(item=>item.collection_id!==id);saveDemo(index);
}
export async function addCollectionItem(id:string,promptId:string):Promise<void> {
  if(!isDemo){await rpc<void>('add_prompt_to_collection',{cid:id,pid:promptId});return;}
  const index=readDemo();if(!index.items.some(x=>x.collection_id===id&&x.prompt_id===promptId)){
    const sortOrder=Math.max(0,...index.items.filter(x=>x.collection_id===id).map(x=>x.sort_order))+100;
    index.items.push({collection_id:id,prompt_id:promptId,sort_order:sortOrder,added_at:stamp()});saveDemo(index);
  }
}
export async function removeCollectionItem(id:string,promptId:string):Promise<void> {
  if(!isDemo){await rpc<void>('remove_prompt_from_collection',{cid:id,pid:promptId});return;}
  const index=readDemo();index.items=index.items.filter(x=>x.collection_id!==id||x.prompt_id!==promptId);saveDemo(index);
}
export async function moveCollectionItem(id:string,promptId:string,direction:'up'|'down'):Promise<void> {
  if(!isDemo){await rpc<void>('move_prompt_in_collection',{cid:id,pid:promptId,move_direction:direction});return;}
  const index=readDemo(), items=index.items.filter(x=>x.collection_id===id).sort((a,b)=>a.sort_order-b.sort_order);
  const current=items.findIndex(x=>x.prompt_id===promptId), next=current+(direction==='up'?-1:1);
  if(current>=0&&next>=0&&next<items.length){
    const old=items[current].sort_order;items[current].sort_order=items[next].sort_order;items[next].sort_order=old;saveDemo(index);
  }
}
