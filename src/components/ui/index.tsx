import { useEffect, type ReactNode, type ButtonHTMLAttributes } from 'react';

export function Logo(){return <span className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span><span>promptfolio<span className="brand-period">.</span></span></span>}

export function Button({children,variant='primary',className='',...props}:{children:ReactNode;variant?:'primary'|'outline'|'ghost'|'soft';className?:string} & ButtonHTMLAttributes<HTMLButtonElement>){return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>}

export function Modal({children,onClose,wide=false}:{children:ReactNode;onClose:()=>void;wide?:boolean}){
  useEffect(()=>{const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',f);document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',f);document.body.style.overflow=''}},[onClose]);
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true">{children}</section></div>;
}
