import React,{useMemo,useState} from 'react';
import {agentYearRows,groupAuditsByAuditor,monthKeys} from './analyticsData.js';

const monthLabel=month=>new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined,{month:'short'});
const display=(row,key)=>{
  const value=row[key];
  return (Array.isArray(value)?value.join('; '):String(value??'')).trim()||'—';
};
const statusLabel={below:'Below 8',complete:'8, no duplicate','possible-duplicate':'Possible duplicate'};
const detailFields=[
  ['Audited Call AHT in Seconds','AHT',' seconds'],
  ['Quality Score in Percentage','Quality Score in Percentage','%'],
  ['Quality Main Parameter','Quality Main Parameter',''],
  ['Quality Sub-parameter','Quality Sub-parameter',''],
  ['Kudos Call Verbatim','Kudos Call Verbatim',''],
  ['Quality Auditor Remarks','Quality Auditor Remarks','']
];

export function YearNav({year,years,onChange}){
  const first=Number(years[0]||year)-1;
  const last=Number(years.at(-1)||year)+1;
  return <div className="year-nav" aria-label="Report year">
    <button type="button" className="secondary" disabled={Number(year)<=first} onClick={()=>onChange(String(Number(year)-1))}>← Previous year</button>
    <strong>{year}</strong>
    <button type="button" className="secondary" disabled={Number(year)>=last} onClick={()=>onChange(String(Number(year)+1))}>Next year →</button>
  </div>;
}

function AuditDetails({person,month,year,onClose}){
  return <tr className="agent-audit-detail"><td colSpan={14}>
    <div className="agent-detail-head"><strong>{person.name} · {monthLabel(month.month)} {year}</strong><button type="button" className="link" onClick={onClose}>Close details</button></div>
    {month.repeatedEventIds.length>0&&<p className="duplicate-note">Possible duplicate: a Call Event ID appears more than once in this month.</p>}
    {groupAuditsByAuditor(month.audits).map(([auditor,audits])=><section className="auditor-audit-group" key={auditor}>
      <h3>{auditor} · {audits.length} audit{audits.length===1?'':'s'}</h3>
      <div className="auditor-audit-list">{audits.map((audit,index)=><article key={audit._id||index}>
        <span className="audit-number">Audit {index+1}</span>
        <dl>{detailFields.map(([key,label,suffix])=><div key={key}><dt>{label}</dt><dd>{display(audit,key)}{display(audit,key)!=='—'?suffix:''}</dd></div>)}</dl>
      </article>)}</div>
    </section>)}
  </td></tr>;
}

export default function AgentYearTable({archive,roster,year,years,onYearChange}){
  const rows=useMemo(()=>agentYearRows(archive,roster,year),[archive,roster,year]);
  const [expanded,setExpanded]=useState(null);
  const months=monthKeys(year);
  const hasAudits=archive.some(row=>String(row['Call Date']||'').endsWith(`/${year}`));
  return <section className="panel agent-year-panel">
    <div className="section-head"><div><h2>Agent monthly QA averages</h2><p>All agents in alphabetical order. Each cell shows the average and saved audit count. Select a month to view its audits grouped by auditor.{!hasAudits?` No saved audits for ${year} yet.`:''}</p></div><YearNav year={year} years={years} onChange={onYearChange}/></div>
    <div className="coverage-legend"><span className="coverage below">Below 8</span><span className="coverage complete">8 audits, no repeated Event ID</span><span className="coverage possible-duplicate">More than 8 or repeated Event ID · possible duplicate</span></div>
    <div className="table-scroll agent-year-scroll"><table className="agent-year-table"><thead><tr><th>Agent</th><th>LOB</th>{months.map(month=><th key={month}>{monthLabel(month)}</th>)}</tr></thead><tbody>
      {rows.map(person=>{
        const openMonth=expanded?.year===year&&expanded.id===person.id?person.months.find(month=>month.month===expanded.month):null;
        return <React.Fragment key={person.id}><tr>
          <th scope="row" className="agent-name-cell">{person.name}<small>{person.id}</small></th><td>{person.lob||'—'}</td>
          {person.months.map(month=>{
            const open=openMonth?.month===month.month;
            const label=statusLabel[month.status];
            return <td key={month.month} className="agent-month-cell">{month.count?<button type="button" className={`month-average ${month.status} ${open?'selected':''}`} aria-expanded={open} aria-label={`${person.name}, ${monthLabel(month.month)} ${year}: ${month.average.toFixed(1)} percent, ${month.count} audits, ${label}. View audit details.`} onClick={()=>setExpanded(open?null:{id:person.id,month:month.month,year})}><strong>{month.average.toFixed(1)}%</strong><small>{month.count}/8 · {label}</small></button>:<span className="month-average below"><strong>—</strong><small>0/8 · Below 8</small></span>}</td>;
          })}
        </tr>{openMonth&&<AuditDetails person={person} month={openMonth} year={year} onClose={()=>setExpanded(null)}/>}</React.Fragment>;
      })}
    </tbody></table>{!rows.length&&<div className="chart-empty">No agents in the shared roster yet.</div>}</div>
  </section>;
}
