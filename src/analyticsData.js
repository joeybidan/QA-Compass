import {csvFor} from './parser.js';

const field=(row,key)=>row[key]||'';
export const normalizeLob=name=>({'CG Support':'Caregiver Support','After Hours Support':'After-Hours Support'})[name]||name||'';
const score=row=>Number(field(row,'Quality Score in Percentage'));
export const monthOf=row=>{const match=String(field(row,'Call Date')).match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);return match?`${match[2]}-${match[1].padStart(2,'0')}`:''};
export const csvForSavedMonth=(archive,month,fields)=>csvFor(archive.filter(row=>monthOf(row)===month).map(row=>({fields:row})),fields);
export const monthKeys=year=>Array.from({length:12},(_,index)=>`${year}-${String(index+1).padStart(2,'0')}`);
const numericScore=row=>{
  const raw=field(row,'Quality Score in Percentage');
  return raw===''?null:Number.isFinite(Number(raw))?Number(raw):null;
};
export function monthlyComparison(archive,year,dimension,knownCategories=[]){
  const isMarkdown=dimension==='Quality Sub-parameter';
  const groups=new Map(knownCategories.filter(Boolean).map(name=>[name,new Map()]));
  for(const row of archive){
    const month=monthOf(row);
    if(!month.startsWith(`${year}-`))continue;
    const categories=isMarkdown?markdownLabels([row]):[dimension==='LOB'?normalizeLob(field(row,dimension)):field(row,dimension)].filter(Boolean);
    for(const category of categories){
      if(!groups.has(category))groups.set(category,new Map());
      const bucket=groups.get(category);
      const entry=bucket.get(month)||{sum:0,count:0};
      if(isMarkdown){entry.sum++;entry.count++}
      else{const score=numericScore(row);if(score===null)continue;entry.sum+=score;entry.count++}
      bucket.set(month,entry);
    }
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([name,buckets])=>({
    name,points:monthKeys(year).map(month=>{
      const entry=buckets.get(month);
      return {month,value:entry?.count?(isMarkdown?entry.sum:entry.sum/entry.count):null,count:entry?.count||0};
    })
  }));
}
export function auditMonthStatus(audits){
  const eventCounts=new Map();
  for(const row of audits){
    const event=String(field(row,'Call Event ID')).trim();
    if(event)eventCounts.set(event,(eventCounts.get(event)||0)+1);
  }
  const repeatedEventIds=[...eventCounts].filter(([,count])=>count>1).map(([event])=>event);
  const count=audits.length;
  const scores=audits.map(numericScore).filter(score=>score!==null);
  return {count,average:scores.length?scores.reduce((sum,score)=>sum+score,0)/scores.length:null,
    repeatedEventIds,status:count<8?'below':count>8||repeatedEventIds.length?'possible-duplicate':'complete'};
}
export function agentYearRows(archive,roster,year){
  const agents=new Map();
  for(const person of roster){
    const id=String(person.eid||'').trim();
    if(id)agents.set(id,{id,name:person.agentName?.trim()||id,lob:normalizeLob(person.lob),months:new Map()});
  }
  for(const row of archive){
    const id=String(field(row,'Employee ID')||field(row,'Employee Name')).trim();
    if(!id)continue;
    if(!agents.has(id))agents.set(id,{id,name:String(field(row,'Employee Name')).trim()||id,lob:field(row,'LOB'),months:new Map()});
    const month=monthOf(row);
    if(month.startsWith(`${year}-`)){
      const person=agents.get(id);
      if(!person.months.has(month))person.months.set(month,[]);
      person.months.get(month).push(row);
    }
  }
  return [...agents.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(person=>({
    ...person,months:monthKeys(year).map(month=>({month,audits:person.months.get(month)||[],...auditMonthStatus(person.months.get(month)||[])}))
  }));
}
export function groupAuditsByAuditor(audits){
  const groups=new Map();
  for(const audit of audits){
    const name=audit._auditorName||audit._auditorId||'Auditor not recorded';
    if(!groups.has(name))groups.set(name,[]);
    groups.get(name).push(audit);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b));
}
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
