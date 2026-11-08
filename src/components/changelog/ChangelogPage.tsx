import { ArrowLeft } from 'lucide-react';
import packageInfo from '../../../package.json';
import { changelog } from './changelog';
import { when } from '../../utils/format';
import { Button } from '../ui';

export function ChangelogPage({onBack}:{onBack:()=>void}){
  return <section className="changelog-page" aria-label="Promptfolio changelog">
    <div className="changelog-topline"><Button type="button" variant="outline" onClick={onBack}><ArrowLeft size={15}/> Back to library</Button><span>Current version: v{packageInfo.version}</span></div>
    <div className="changelog-timeline">
      {changelog.map(entry=><article className={`changelog-release ${entry.status==='development'?'is-development':''}`} key={entry.version}>
        <div className="changelog-release-meta"><span className="changelog-version">v{entry.version}</span><span className={`changelog-status ${entry.status==='development'?'is-development':''}`}>{entry.status==='development'?'Development':'Release'}</span>{entry.version === packageInfo.version && (<span className="changelog-status is-current">Current</span>)}{entry.date&&<time dateTime={entry.date}>{when(entry.date+'T12:00:00Z')}</time>}</div>
        <h2>{entry.title}</h2>
        <ul>{entry.changes.map(change=><li key={change}>{change}</li>)}</ul>
      </article>)}
    </div>
  </section>;
}
