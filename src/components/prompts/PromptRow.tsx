import { ChevronRight, ClipboardPlus, Copy, Heart } from 'lucide-react';
import type { Prompt, PromptVersion } from '../../types';
import { when } from '../../utils/format';
import { IconTile } from './CategoryIcon';
export function PromptRow({prompt,version,active,onSelect,onCopy,onCombine,onDoubleClick,owner,likes,listified}:{prompt:Prompt;version:PromptVersion;active:boolean;onSelect:()=>void;onCopy:()=>void;onCombine:()=>void;onDoubleClick:()=>void;owner:string;likes:number;listified:boolean}){
  return <div className={`prompt-row-shell ${listified?'prompt-row-shell-listified':''}`}>
    {listified?<button type="button" className={`prompt-row prompt-row-listified ${active?'is-active':''}`} onClick={onSelect} onDoubleClick={onDoubleClick} aria-label={`Open ${version.title}`}><span className="row-listify-body"><strong className="row-title">{version.title}</strong><span className="row-listify-updated">Last updated: {when(prompt.updated_at)}</span></span></button>
      :<button type="button" className={`prompt-row ${active?'is-active':''}`} onClick={onSelect} onDoubleClick={onDoubleClick}><IconTile category={version.category}/><span className="row-body"><span className="row-caps">{version.category}<span className="caps-dot">·</span>{owner}</span><strong className="row-title">{version.title}</strong><span className="row-description">{version.description||'A ready-to-use prompt shared with the library.'}</span><span className="row-byline">{when(prompt.updated_at)}<span className="row-likes" aria-label={`${likes} likes`}><Heart size={13}/>{likes}</span></span></span><ChevronRight size={18} className="row-arrow"/></button>}
    <div className="row-clipboard-actions"><button type="button" className="row-copy-button pf-icon-tooltip" aria-label={`Copy ${version.title} to clipboard`} data-tooltip="Copy prompt text" onClick={onCopy}><Copy size={15}/></button>
      <button type="button" className="row-combine-button pf-icon-tooltip" aria-label={`Combine ${version.title} with clipboard`} data-tooltip="Combine to Clipboard" onClick={onCombine}><ClipboardPlus size={15}/></button></div>
  </div>;
}
