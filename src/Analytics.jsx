import React,{useMemo,useState} from 'react';

const value=(row,key)=>row[key]||'';
const monthOf=row=>{const m=String(value(row,'Call Date')).match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);return m?`${m[2]}-${m[1].padStart(2,'0')}`:''};
const monthName=key=>new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined,{month:'short',year:'numeric'});
const unique=values=>[...new Set(values.filter(Boolean))].sort();
const countBy=(rows,key)=>{const counts=new Map();for(const row of rows)for(const item of (Array.isArray(row[key])?row[key]:[row[key]]))if(item&&item!=='N/A')counts.set(item,(counts.get(item)||0)+1);return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));};

export default function Analytics({archive,onRemove,onClear}){
  const months=useMemo(()=>unique(archive.map(monthOf)).reverse(),[archive]);
  const years=unique(months.map(x=>x.slice(0,4))).reverse();
  const [period,setPeriod]=useState('latest');
  const [lob,setLob]=useState('all');
  const [supervisor,setSupervisor]=useState('all');
  const [selectedMarkdown,setSelectedMarkdown]=useState('');
  const [metric,setMetric]=useState('Quality Sub-parameter');
  const periodKey=period==='latest'?months[0]:period;
  const inPeriod=archive.filter(r=>periodKey==='all'||periodKey?.length===4?periodKey==='all'||monthOf(r).startsWith(periodKey):monthOf(r)===periodKey);
  const lobs=unique(inPeriod.map(r=>value(r,'LOB')));
  const byLob=inPeriod.filter(r=>lob==='all'||value(r,'LOB')===lob);
  const supervisors=unique(byLob.map(r=>value(r,'Supervisor')));
  const filtered=byLob.filter(r=>supervisor==='all'||value(r,'Supervisor')===supervisor);
  const misses=filtered.filter(r=>Number(value(r,'Quality Score in Percentage'))<100);
  const ranking=countBy(misses,metric);
  const max=ranking[0]?.[1]||1;
  const drill=filtered.filter(r=>Array.isArray(r[metric])&&r[metric].includes(selectedMarkdown));
  const leaderboard=[...filtered.reduce((map,r)=>{const id=value(r,'Employee ID')||value(r,'Employee Name');if(!id)return map;const entry=map.get(id)||{name:value(r,'Employee Name'),lob:value(r,'LOB'),sum:0,count:0};entry.sum+=Number(value(r,'Quality Score in Percentage'))||0;entry.count++;map.set(id,entry);return map;},new Map()).values()].sort((a,b)=>b.sum/b.count-a.sum/a.count||b.count-a.count).slice(0,10);
  const trendMonths=months.filter(m=>periodKey==='all'||(periodKey?.length===4?m.startsWith(periodKey):true)).sort();
  const trend=trendMonths.map(m=>({month:m,count:archive.filter(r=>monthOf(r)===m&&(lob==='all'||value(r,'LOB')===lob)&&(supervisor==='all'||value(r,'Supervisor')===supervisor)&&Number(value(r,'Quality Score in Percentage'))<100).length}));
  const top=ranking.slice(0,6);
  const total=top.reduce((n,[,count])=>n+count,0);
  let offset=0;const pie=top.map(([,count],i)=>{const from=offset;offset+=count/Math.max(total,1)*100;return `var(--chart-${i}) ${from}% ${offset}%`;}).join(', ');
  return <section className="analytics">
    <div className="section-head"><div><h1>QA analytics</h1><p>Charts use reviewed records saved in this browser. Choose a month or year and narrow the view by LOB or supervisor.</p></div><span className="status complete">{archive.length} saved audits</span></div>
    <div className="analytics-filters"><label>Period<select value={period} onChange={e=>{setPeriod(e.target.value);setSelectedMarkdown('');}}><option value="latest">Latest month</option><option value="all">All available</option>{years.map(y=><option value={y} key={y}>{y}</option>)}{months.map(m=><option value={m} key={m}>{monthName(m)}</option>)}</select></label><label>LOB<select value={lob} onChange={e=>{setLob(e.target.value);setSupervisor('all');setSelectedMarkdown('');}}><option value="all">All LOBs</option>{lobs.map(x=><option key={x}>{x}</option>)}</select></label><label>Supervisor<select value={supervisor} onChange={e=>{setSupervisor(e.target.value);setSelectedMarkdown('');}}><option value="all">All supervisors</option>{supervisors.map(x=><option key={x}>{x}</option>)}</select></label><label>Markdown category<select value={metric} onChange={e=>{setMetric(e.target.value);setSelectedMarkdown('');}}><option>Quality Sub-parameter</option><option>Quality Main Parameter</option></select></label></div>
    {!archive.length?<div className="analytics-empty">Review notes on the Audit workspace, then select <strong>Save complete audits for analytics</strong>. Saved records remain on this browser until removed.</div>:<>
      <div className="summary-cards"><div><strong>{filtered.length}</strong><span>Audits in view</span></div><div><strong>{misses.length}</strong><span>Below 100</span></div><div><strong>{filtered.length?Math.round(filtered.reduce((sum,r)=>sum+(Number(value(r,'Quality Score in Percentage'))||0),0)/filtered.length*10)/10:0}%</strong><span>Average QA score</span></div></div>
      <div className="chart-grid"><section className="panel chart-panel"><h2>Top markdowns</h2><p>Each missed parameter is counted once per audit. Select a bar to see agents and remarks.</p><div className="bar-list">{ranking.slice(0,12).map(([name,count])=><button type="button" key={name} className={'bar-row '+(selectedMarkdown===name?'picked':'')} onClick={()=>setSelectedMarkdown(selectedMarkdown===name?'':name)}><span title={name}>{name}</span><div className="track"><i style={{width:`${count/max*100}%`}}/></div><strong>{count}</strong></button>)}{!ranking.length&&<p>No markdowns for these filters.</p>}</div></section>
      <section className="panel chart-panel"><h2>Markdown share</h2><p>Six most frequent categories in the selected period.</p>{total?<><div className="donut" style={{background:`conic-gradient(${pie})`}}><span>{total}<small>occurrences</small></span></div><div className="legend">{top.map(([name,count],i)=><div key={name}><i style={{background:`var(--chart-${i})`}}/>{name}<strong>{count}</strong></div>)}</div></>:<div className="chart-empty">No markdowns yet.</div>}</section>
      <section className="panel chart-panel"><h2>Monthly trend</h2><p>Audits below 100 by call month.</p><div className="trend">{trend.map(x=><div className="trend-col" key={x.month}><strong>{x.count}</strong><div><i style={{height:`${Math.max(x.count?6:0,x.count/Math.max(...trend.map(t=>t.count),1)*100)}%`}}/></div><span>{monthName(x.month)}</span></div>)}</div></section>
      <section className="panel chart-panel"><h2>Top QA scorers</h2><p>Average score per agent for the selected period and LOB. Audit count breaks ties.</p><div className="rank-list">{leaderboard.map((x,i)=><div key={`${x.name}-${i}`}><b>{i+1}</b><span>{x.name}<small>{x.lob} · {x.count} audit{x.count===1?'':'s'}</small></span><strong>{(x.sum/x.count).toFixed(1)}%</strong></div>)}{!leaderboard.length&&<p>No scores for these filters.</p>}</div></section></div>
      {selectedMarkdown&&<section className="panel drill-panel"><div className="section-head"><div><h2>{selectedMarkdown}</h2><p>{drill.length} audit{drill.length===1?'':'s'} with this markdown</p></div><button className="link" onClick={()=>setSelectedMarkdown('')}>Close details</button></div><div className="drill-list">{drill.map((r,i)=><article key={`${value(r,'Employee ID')}-${value(r,'Call Date')}-${i}`}><header><strong>{value(r,'Employee Name')}</strong><span>{value(r,'Call Date')} · {value(r,'LOB')} · {value(r,'Supervisor')} · {value(r,'Quality Score in Percentage')}%</span></header><p>{value(r,'Quality Auditor Remarks')}</p><button className="link" onClick={()=>onRemove(r)}>Remove saved audit</button></article>)}</div></section>}
      <div className="archive-actions"><button className="link" onClick={onClear}>Clear saved analytics records</button><span>Clearing removes them from this browser.</span></div>
    </>}
  </section>;
}
