const field=(row,key)=>row[key]||'';
const score=row=>Number(field(row,'Quality Score in Percentage'));
export const markdownLabels=rows=>[...new Set(rows.flatMap(row=>{
  const value=field(row,'Quality Sub-parameter');
  return Array.isArray(value)?value.filter(x=>x&&x!=='N/A'):value&&value!=='N/A'?[value]:[];
}))];
export function rankAgents(rows,{belowOnly=false,ascending=false}={}){
  const map=new Map();
  for(const row of rows){
    const id=field(row,'Employee ID')||field(row,'Employee Name');
    const raw=field(row,'Quality Score in Percentage');
    if(!id||raw===''||!Number.isFinite(score(row)))continue;
    if(belowOnly&&score(row)>=100)continue;
    const entry=map.get(id)||{id,name:field(row,'Employee Name'),lob:field(row,'LOB'),sum:0,count:0,audits:[]};
    entry.sum+=score(row);entry.count++;entry.audits.push(row);map.set(id,entry);
  }
  return [...map.values()].sort((a,b)=>
    (ascending?1:-1)*(a.sum/a.count-b.sum/b.count)||b.count-a.count||a.name.localeCompare(b.name)
  );
}
