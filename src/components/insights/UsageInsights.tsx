import {useEffect,useState} from 'react';
import {BarChart3,Check,ChevronDown,ClipboardPlus,Copy,Eye,Users} from 'lucide-react';
import {loadMyPromptImpact} from '../../services/usageInsights';
import type {PromptImpact} from '../../utils/promptImpact';

const periods=[7,30,90] as const;
function Metric({name,value,icon:Icon}:{name:string;value:number;icon:typeof Eye}){
  return <div className="usage-metric"><Icon size={16} aria-hidden="true"/><strong>{value.toLocaleString()}</strong><small>{name}</small></div>;
}
export function MyImpactInsights({revision=0}:{revision?:number}){
  const [days,setDays]=useState<number>(30);
  const [includeSelf,setIncludeSelf]=useState(false);
  const [stats,setStats]=useState<PromptImpact|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true;
    setStats(null);setError('');
    void loadMyPromptImpact(includeSelf,days).then(value=>{if(alive)setStats(value)})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:'Unable to load usage insights.');});
    return()=>{alive=false};
  },[days,includeSelf,revision]);
  return <section className="settings-section usage-settings-section" aria-label="Your prompt impact">
    <div className="settings-section-heading usage-settings-heading"><h3>Your prompt impact</h3></div>
    <p className="usage-intro">Combined engagement with prompts you created or contributed to.</p>
    <div className="usage-controls">
      <label className="usage-period-control" htmlFor="impact-period">
        <span>Period</span>
        <span className="usage-select-shell">
          <select id="impact-period" aria-label="Impact period" value={days} onChange={e=>setDays(Number(e.target.value))}>
            {periods.map(n=><option key={n} value={n}>Last {n} days</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true"/>
        </span>
      </label>
      <button type="button" className={`usage-creator-toggle ${includeSelf?'is-selected':''}`}
        aria-pressed={includeSelf} onClick={()=>setIncludeSelf(value=>!value)}>
        <span className="usage-toggle-indicator" aria-hidden="true">{includeSelf&&<Check size={12} strokeWidth={3}/>}</span>
        Include my own activity
      </button>
    </div>
    {error?<p role="alert" className="collection-error">{error}</p>:!stats?<p className="collection-muted" role="status">Loading your prompt impact…</p>:<>
      <div className="usage-metrics usage-impact-metrics">
        <Metric name="Opens" value={stats.opens} icon={Eye}/>
        <Metric name="Copies" value={stats.copies} icon={Copy}/>
        <Metric name="Combinations" value={stats.combines} icon={ClipboardPlus}/>
        <Metric name="Unique people" value={stats.unique_users} icon={Users}/>
      </div>
      <p className="usage-impact-scope">Engagement across <strong>{stats.prompts_total}</strong> prompt{stats.prompts_total===1?'':'s'} you created or contributed to <span className="usage-impact-breakdown">({stats.prompts_created} created · {stats.prompts_contributed} contributed to)</span>.</p>
      <p className="usage-footnote">{stats.last_used?`Latest interaction: ${new Date(stats.last_used).toLocaleDateString()}.`:'No recorded interactions in this period.'}</p>
    </>}
    <p className="usage-footnote">Your own actions are excluded by default. Only successful clipboard actions and deliberate prompt opens are counted; copying does not prove use in an AI assistant. Activity is aggregated—no member names or individual histories are shown.</p>
  </section>;
}
