export function MarkdownPreview({content}:{content:string}){
  return <div className="md-rendered">{content.split('\n').map((line,i)=>{
    if(line.startsWith('## '))return <h4 key={i}>{line.slice(3)}</h4>;
    if(line.startsWith('# '))return <h3 key={i}>{line.slice(2)}</h3>;
    if(line.startsWith('- '))return <div key={i} className="md-list">• {line.slice(2)}</div>;
    return <p key={i}>{line||'\u00a0'}</p>;
  })}</div>;
}
