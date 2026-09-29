import {applyAuditRules} from './rules.js';

const clean = s => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/clx_/g, ' ').replace(/\bclx\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = s => clean(s).split(/\s+/).filter(Boolean);
const knownAliases={
  'grace lorraine':'alit lorraine grace',
  'nemenzo louis':'nemenzo louie'
};
export function matchAgent(raw, agents=[]) {
  const words = new Set(tokens(knownAliases[clean(raw)]||raw));
  if (!words.size) return null;
  const scored = agents.map(agent => {
    const roster = tokens(agent.agentName);
    const surnamePresent = words.has(roster[0]);
    const givenCount = roster.slice(1).filter(w => words.has(w)).length;
    const partial = roster.slice(1).some(w => [...words].some(n => n.length >= 3 && w.startsWith(n))) ? 0.25 : 0;
    return {agent, score:surnamePresent && (givenCount || partial) ? 2 + givenCount + partial : 0};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if (!scored.length || (scored[1] && scored[0].score===scored[1].score)) return null;
  return scored[0].agent;
}
const datePattern=/^\d{1,2}\/\d{1,2}\/\d{4}$/;
const timePattern=/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)$/i;
const durationPattern=/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/;
const eventPattern=/^1\d{10}$/;
const scorePattern=/^(?:QA(?:\s*Score)?\s*:\s*)?(100(?:\.0+)?|\d{1,2}(?:\.\d+)?)\s*%?$/i;
const vagueScorePattern=/^(?:QA(?:\s*Score)?\s*:\s*)?(\d{1,2})s\s*%?$/i;
function validDate(value) {
  if(!datePattern.test(value)) return false;
  const [m,d,y]=value.split('/').map(Number);
  const t=new Date(y,m-1,d);
  return t.getFullYear()===y&&t.getMonth()===m-1&&t.getDate()===d;
}
const lob = x => ({'After Hours Support':'After-Hours Support','CG Support':'Caregiver Support'})[x] || x || '';
export function parseNotes(input,agents=[]) {
  const lines=String(input).replace(/\r\n?/g,'\n').split('\n').map(s=>s.trim());
  const starts=[];
  for(let i=0;i<lines.length;i++) {
    const next=lines.slice(i+1).find(Boolean);
    if(/,/.test(lines[i]) && datePattern.test(next||'')) starts.push(i);
  }
  return starts.map((start,index)=>{
    const all=lines.slice(start,starts[index+1]??lines.length).filter(Boolean);
    const dateIndex=all.findIndex(x=>datePattern.test(x));
    const date=all[dateIndex]||'';
    const time=all.slice(dateIndex+1).find(x=>timePattern.test(x))||'';
    const duration=all.slice(dateIndex+1).find(x=>durationPattern.test(x)&&!timePattern.test(x))||'';
    const eventIndex=all.findIndex((x,i)=>i>dateIndex&&eventPattern.test(x));
    const scoreCandidates=all.map((x,i)=>i>dateIndex && (scorePattern.test(x)||vagueScorePattern.test(x))?i:-1).filter(i=>i>=0);
    const scoreIndex=scoreCandidates.at(-1)??-1;
    const block=scoreIndex>=0?all.slice(0,scoreIndex+1):all;
    const eventId=eventIndex>=0?all[eventIndex]:'';
    const scoreRaw=scoreIndex>=0?all[scoreIndex]:'';
    const scoreMatch=scoreRaw.match(scorePattern)||scoreRaw.match(vagueScorePattern);
    const score=scoreMatch && +scoreMatch[1]<=100?scoreMatch[1]:'';
    const agent=matchAgent(block[0],agents);
    const markdowns=block.filter(x=>/^markdown\s*:/i.test(x)).map(x=>x.replace(/^markdown\s*:\s*/i,''));
    const contextStart=eventIndex>=0?eventIndex+1:Math.max(dateIndex+1,block.findIndex(x=>x===duration)+1);
    const references=block.slice(contextStart,scoreIndex>=0?scoreIndex:undefined).filter(x=>!/^markdown\s*:/i.test(x)&&!timePattern.test(x)&&!durationPattern.test(x));
    const d=duration.match(durationPattern);
    const seconds=d?(d[3]?+d[1]*3600 + +d[2]*60 + +d[3]:+d[1]*60 + +d[2]):'';
    const record={key:`${index}-${eventId}`,source:block.join('\n'),sourceName:block[0],time,duration,references,
      fields:{'Employee ID':agent?.eid||'', 'Employee Name':agent?.agentName?.trim()||'',
        'Supervisor':agent?.supervisor||'', 'LOB':lob(agent?.lob), 'Call Date':validDate(date)?date:'',
        'Call Event ID':eventId,'Audited Call AHT in Seconds':seconds,'Caller Type':'','Contact Type':'',
        'Zero-Tolerance Standard':'','Quality Score in Percentage':score,'Scorecard Type':'',
        'Quality Main Parameter':[],'Quality Sub-parameter':[],'Repeat Caller?':'',
        'Sentiment Orientation':'','Supervisor Action Next Step':'','Kudos Call Verbatim':'',
        'Quality Auditor Remarks':''},
      notes:[...(agent?[]:['Agent name could not be uniquely matched to the loaded roster.']),
        ...(score?[]:[`Score “${scoreRaw||'missing'}” needs an exact number.`]),
        ...(validDate(date)?[]:['Call date is missing or invalid.']),
        ...(vagueScorePattern.test(scoreRaw)?[`Interpreted “${scoreRaw}” as ${score}%. Confirm this score.`]:[])],
      suggestions:[],reviewed:false};
    return applyAuditRules(record,markdowns);
  });
}
export function missingFields(record,fields){return fields.filter(f=>f.required&&f.label!=='Call Event ID'&&(Array.isArray(record.fields[f.label])?record.fields[f.label].length===0:String(record.fields[f.label]??'').trim()==='')).map(f=>f.label)}
export function csvFor(records,fields){
  const headers=fields.map(f=>f.label);
  const safe=value=>{
    let v=Array.isArray(value)?value.join('; '):String(value??'');
    if(/^[\s\uFEFF]*[=+@\-\t\r]/.test(v)&&!/^\d+(?:\.\d+)?$/.test(v)) v="'"+v;
    return '"'+v.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+[headers.map(safe).join(','),...records.map(r=>headers.map(h=>safe(r.fields[h])).join(','))].join('\r\n');
}
