import type { ReactNode } from 'react';
import { BookOpen, type LucideIcon } from 'lucide-react';
const initials=(name:string)=>name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
export function Avatar({name,small=false}:{name:string;small?:boolean}){return <span className={`avatar ${small?'avatar-small':''}`}>{initials(name)||'U'}</span>}

export function Empty({title,description,icon:Icon=BookOpen,action}:{title:string;description:string;icon?:LucideIcon;action?:ReactNode}){return <div className="empty"><div className="empty-symbol"><Icon size={22}/></div><h3>{title}</h3><p>{description}</p>{action}</div>}

export function Flag({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'green'|'violet'|'amber'}){return <span className={`flag flag-${tone}`}>{children}</span>}
