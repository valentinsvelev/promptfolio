/** Shared prompt and download helpers. No UI state. */
export const varsIn=(text:string)=>[...new Set([...text.matchAll(/\{\{([A-Za-z][\w]*)\}\}/g)].map(m=>m[1]))];
export const sanitize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'prompt';
export const labelize=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function saveFile(name:string,text:string,type='text/plain') {const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
