import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, RotateCcw, X } from 'lucide-react';
import { Button, Modal } from '../ui';
import type { Filter } from '../../types';
import {
  EXPLORE_TABS, moveExploreTab, type ExplorePreferences,
} from '../../utils/defaultExploreTab';

export function ExploreTabsDialog({preferences,demoMode,onSave,onClose}:{
  preferences:ExplorePreferences;demoMode:boolean;
  onSave:(next:ExplorePreferences)=>Promise<void>;
  onClose:()=>void;
}){
  const [tabOrder,setTabOrder]=useState<Filter[]>([...preferences.tabOrder]);
  const [defaultTab,setDefaultTab]=useState<Filter>(preferences.defaultTab);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const changed=defaultTab!==preferences.defaultTab || tabOrder.some((tab,i)=>tab!==preferences.tabOrder[i]);
  const close=()=>{if(!saving)onClose()};
  async function save(){
    if(!changed||saving)return;
    setSaving(true);setError('');
    try {await onSave({defaultTab,tabOrder});onClose();}
    catch(e){setError(e instanceof Error?e.message:'Could not save your Explore tabs.');}
    finally{setSaving(false);}
  }
  return <Modal onClose={close}>
    <div className="explore-order-dialog">
      <div className="modal-header">
        <div><h2>Customize Explore tabs</h2></div>
        <button className="round-icon pf-icon-tooltip" type="button" aria-label="Close tab editor" onClick={close} disabled={saving}><X size={19}/></button>
      </div>
      <div className="explore-order-body">
        {/* <div className="explore-order-head"><span>Tab order</span><span>Move</span></div> */}
        <div className="explore-order-list" aria-label="Explore tab order">
          {tabOrder.map((tab,index)=><div key={tab} className="explore-order-item">
            <GripVertical size={17} aria-hidden="true" className="explore-grip"/>
            <span className="explore-order-name">{tab}</span>
            <label className="explore-order-default">
              <input type="radio" name="explore-default" checked={defaultTab===tab} onChange={()=>setDefaultTab(tab)} disabled={saving} aria-label={`Make ${tab} the default tab`}/>
              <span>Start here</span>
            </label>
            <div className="explore-order-movers">
              <button type="button" className="pf-icon-tooltip" aria-label={`Move ${tab} up`} disabled={saving||index===0} onClick={()=>setTabOrder(order=>moveExploreTab(order,index,-1))}><ArrowUp size={16}/></button>
              <button type="button" className="pf-icon-tooltip" aria-label={`Move ${tab} down`} disabled={saving||index===tabOrder.length-1} onClick={()=>setTabOrder(order=>moveExploreTab(order,index,1))}><ArrowDown size={16}/></button>
            </div>
          </div>)}
        </div>
        {error&&<p role="alert" className="explore-pref-error">{error}</p>}
        {/* <p className="explore-order-hint">{demoMode?'Demo preferences are saved on this browser.':'Your choices will appear on every device where you sign in.'}</p> */}
      </div>
      <div className="explore-order-actions">
        <button type="button" className="explore-reset-order" disabled={saving} onClick={()=>{setTabOrder([...EXPLORE_TABS]);setDefaultTab('All prompts')}}><RotateCcw size={14}/> Reset</button>
        <div><Button variant="outline" type="button" disabled={saving} onClick={close}>Cancel</Button>
        <Button type="button" disabled={!changed||saving} onClick={()=>void save()}>{saving?'Saving…':<><Check size={15}/> Save changes</>}</Button></div>
      </div>
    </div>
  </Modal>;
}
