import React,{useState} from 'react';
import fields from './data/fields.json' with {type:'json'};
import {parseNotes,missingFields,csvFor} from './parser.js';
import FieldEditor from './components/FieldEditor.jsx';
import Analytics from './Analytics.jsx';
import Manage from './Manage.jsx';
import './styles.css';

function download(content, filename, type) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
const ready = record => missingFields(record,fields).length===0 && (record.notes.length===0 || record.reviewed);
const archiveKey='qa-compass-reviewed-v1';
function readArchive(){try{const data=JSON.parse(localStorage.getItem(archiveKey)||'[]');return Array.isArray(data)?data:[]}catch{return []}}
const identity=row=>[row['Employee ID'],row['Call Date'],row['Call Event ID'],row['Quality Score in Percentage'],row['Quality Auditor Remarks']].join('|');
export default function App({cloud=null}){
  const [page,setPage]=useState(cloud?.profile.role==='viewer'?'analytics':'workspace');
  const [localRoster,setRoster]=useState([]);
  const [localArchive,setArchive]=useState(readArchive);
  const [localAuditor,setLocalAuditor]=useState({id:'',name:''});
  const roster=cloud?.roster||localRoster;
  const archive=cloud?.archive||localArchive;
  const [notes,setNotes]=useState('');
  const [records,setRecords]=useState([]);
  const [selected,setSelected]=useState(0);
  const [filter,setFilter]=useState('all');
  const [query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const current=records[selected];
  const readyCount=records.filter(ready).length;
  const visible=records.map((record,index)=>({record,index})).filter(({record})=>{
    const complete=ready(record);
    return (filter==='all'||(filter==='ready'?complete:!complete))&&(!query||`${record.sourceName} ${record.fields['Call Event ID']} ${record.fields['Employee ID']}`.toLowerCase().includes(query.toLowerCase()));
  });
  function process(){
    if(!cloud&&(!localAuditor.id.trim()||!localAuditor.name.trim())){setMessage('Enter your auditor ID and name before processing notes. Local identity is self-reported.');return}
    if(!roster.length){setMessage('The employee roster is empty. Ask the owner to seed Supabase or load a roster for local mode.');return}
    const parsed=parseNotes(notes,roster);
    setRecords(parsed);setSelected(0);setFilter('all');
    setMessage(parsed.length?`${parsed.length} audit record${parsed.length===1?'':'s'} extracted. Review the required fields before export.`:'No audit blocks found. Paste records with an agent name and a date on separate lines.');
  }
  function update(label,value){setRecords(prev=>prev.map((r,i)=>i===selected?{...r,fields:{...r.fields,[label]:value},reviewed:false}:r));}
  function acknowledge(value){setRecords(prev=>prev.map((r,i)=>i===selected?{...r,reviewed:value}:r));}
  function exportCsv(completeOnly){
    const items=completeOnly?records.filter(ready):records;
    if(!items.length){setMessage('There are no complete records to export.');return;}
    download(csvFor(items,fields),`quality-compass-${completeOnly?'complete':'draft'}-${new Date().toISOString().slice(0,10)}.csv`,'text/csv;charset=utf-8');
    setMessage(`Downloaded ${items.length} ${completeOnly?'complete':'draft'} record${items.length===1?'':'s'}. This CSV is a staging file; it has not been submitted to Microsoft Lists.`);
  }
  async function loadRoster(file){
    if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(!Array.isArray(parsed)||!parsed.every(x=>x&&typeof x.agentName==='string'&&x.eid))throw new Error('Expected an array of agents with agentName and eid.');
      setRoster(parsed);setMessage(`Loaded ${parsed.length} agents for this tab. The roster is not saved or uploaded.`);
    }catch(e){setMessage(`Could not load roster: ${e.message}`)}
  }
  function saveArchive(next){try{localStorage.setItem(archiveKey,JSON.stringify(next));setArchive(next);return true}catch{setMessage('Browser storage is unavailable or full. No records were saved.');return false}}
  async function saveReviewed(){
    const rows=records.filter(ready).map(r=>structuredClone(r.fields));
    if(!rows.length){setMessage('Review and complete at least one audit first.');return}
    if(cloud){
      try{await cloud.saveAudits(rows);setMessage(`Saved ${rows.length} reviewed audit${rows.length===1?'':'s'} to shared analytics as ${cloud.auditor.name}.`)}
      catch(e){setMessage(`Could not sync audits: ${e.message}`)}
      return;
    }
    const next=new Map(archive.map(r=>[identity(r),r]));
    rows.forEach(r=>next.set(identity(r),{...r,_auditorId:localAuditor.id.trim(),_auditorName:localAuditor.name.trim()}));
    if(saveArchive([...next.values()]))setMessage(`Saved ${rows.length} reviewed audit${rows.length===1?'':'s'} for analytics on this browser.`);
  }
  async function importLocalArchive(){
    if(!cloud?.auditor||!localArchive.length)return;
    const rows=localArchive.map(row=>Object.fromEntries(fields.map(spec=>[spec.label,row[spec.label]??''])));
    try{await cloud.saveAudits(rows);setMessage(`Imported ${rows.length} local audit${rows.length===1?'':'s'} under ${cloud.auditor.name}. The local copy remains until you clear browser storage.`)}
    catch(e){setMessage(`Could not import local audits: ${e.message}`)}
  }
  async function removeSaved(row){
    if(cloud){try{await cloud.removeAudit(row)}catch(e){setMessage(e.message)}}
    else saveArchive(archive.filter(r=>r!==row));
  }
  return <>
    <header className="topbar"><div className="brand"><span className="mark" aria-hidden="true">▣</span><strong>QA Compass</strong><span className="brand-separator">—</span><span>Notes to records</span></div><nav aria-label="Pages">{cloud?.profile.role!=='viewer'&&<button className={page==='workspace'?'active':''} onClick={()=>setPage('workspace')}>Audit workspace</button>}<button className={page==='analytics'?'active':''} onClick={()=>setPage('analytics')}>Analytics</button>{cloud?.profile.can_manage&&<button className={page==='manage'?'active':''} onClick={()=>setPage('manage')}>Manage team</button>}</nav><div className="privacy"><span className="lock">◆</span> {cloud?`Signed in · ${cloud.auditor?.name||'Viewer'}`:'Browser processing · Local mode'} {cloud&&<button className="signout" onClick={cloud.signOut}>Sign out</button>}</div></header>
    <main>
      {cloud?.auditor&&localArchive.length>0&&<div className="roster-banner"><div><strong>Previous local audits</strong><span>{localArchive.length} reviewed record{localArchive.length===1?'':'s'} are still saved in this browser.</span></div><button className="secondary" onClick={importLocalArchive}>Import to shared analytics as {cloud.auditor.name}</button></div>}
      {page==='manage'&&cloud?.profile.can_manage?<Manage cloud={cloud}/>:page==='analytics'?<Analytics archive={archive} cloud={!!cloud} currentUserId={cloud?.user.id} onRemove={removeSaved} onClear={cloud?null:()=>{if(window.confirm('Remove all saved analytics records from this browser?'))saveArchive([])}}/>:<>
      <div className="roster-banner"><div><strong>Auditor identity</strong>{cloud?<span>{cloud.auditor?.name} · {cloud.auditor?.id} · verified by sign-in</span>:<><label>ID<input value={localAuditor.id} onChange={e=>setLocalAuditor(x=>({...x,id:e.target.value}))} placeholder="qa001"/></label><label>Name<input value={localAuditor.name} onChange={e=>setLocalAuditor(x=>({...x,name:e.target.value}))} placeholder="Your name"/></label><span>Local mode: self-reported identity</span></>}</div></div>
      <div className="roster-banner"><div><strong>Employee roster</strong><span>{cloud?`${roster.length} agents available to approved auditors`:roster.length?`${roster.length} agents loaded for this tab`:'Cloud sync is not configured yet. Load agents.json for local testing.'}</span></div>{!cloud&&<label className="secondary roster-upload">Choose agents.json<input type="file" accept=".json,application/json" onChange={e=>loadRoster(e.target.files?.[0])}/></label>}</div>
      <div className="workspace">
        <section className="panel paste-panel" aria-labelledby="paste-title">
          <div className="section-head"><div><h1 id="paste-title">1. Paste QA audit notes</h1><p>Paste one or more blocks from your notepad, then inspect each extracted audit.</p></div><button className="link" onClick={()=>{setNotes('');setRecords([]);setMessage('');}} type="button">Clear all</button></div>
          <textarea className="notes-box" spellCheck="false" aria-label="QA audit notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder={'Surname, CLX_Firstname\n09/15/2026\n09:24:54 AM\n3:01\n10000000000\n…\n100'} />
          <div className="paste-actions"><button className="primary" onClick={process}>Process notes</button><span>Notes are kept in this tab until you close or clear it.</span></div>
        </section>
        <section className="panel list-panel" aria-labelledby="review-title">
          <div className="section-head"><div><h2 id="review-title">2. Review parsed audit records {records.length>0&&<span>({records.length})</span>}</h2><p>{records.length?`${readyCount} complete · ${records.length-readyCount} need required fields`:'Parsed records appear here after processing.'}</p></div><div className="list-buttons"><button className="secondary" onClick={saveReviewed} disabled={!readyCount}>Save complete audits for analytics</button><button className="secondary" onClick={()=>exportCsv(true)} disabled={!readyCount}>Export complete CSV</button></div></div>
          <div className="toolbar"><div className="tabs" role="group" aria-label="Filter records">{[['all','All'],['ready','Complete'],['review','Needs review']].map(([k,l])=><button type="button" className={filter===k?'active':''} onClick={()=>setFilter(k)} key={k}>{l} {records.length?`(${k==='all'?records.length:k==='ready'?readyCount:records.length-readyCount})`:''}</button>)}</div><input aria-label="Search records" placeholder="Search agent, ID, or event…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <div className="table-scroll"><table><thead><tr><th>#</th><th>Status</th><th>Agent</th><th>Date</th><th>Score</th><th>Event ID</th><th>Missing</th></tr></thead><tbody>{visible.map(({record,index})=>{const missing=missingFields(record,fields);return <tr key={record.key} className={selected===index?'selected':''} onClick={()=>setSelected(index)}><td>{index+1}</td><td><span className={'status '+(!ready(record)?'needs':'complete')}>{!ready(record)?'Needs review':'Complete'}</span></td><td>{record.fields['Employee Name']||record.sourceName}</td><td>{record.fields['Call Date']||'—'}</td><td>{record.fields['Quality Score in Percentage']||'—'}</td><td>{record.fields['Call Event ID']||'—'}</td><td>{missing.length}</td></tr>})}</tbody></table>{!visible.length&&<div className="empty">{records.length?'No records match this filter.':'No records yet.'}</div>}</div>
          <div className="list-footer"><button className="link" onClick={()=>exportCsv(false)} disabled={!records.length}>Download draft CSV with blanks</button><span>Drafts need manual review before any upload.</span></div>
        </section>
      </div>
      <section className="panel inspector" aria-labelledby="inspector-title">
        <div className="section-head inspector-head"><div><h2 id="inspector-title">3. Inspect and correct fields</h2><p>{current?`Record ${selected+1} of ${records.length} · ${current.fields['Employee Name']||current.sourceName}`:'Select a parsed record to edit its List fields.'}</p></div>{current&&<span className={'status '+(!ready(current)?'needs':'complete')}>{!ready(current)?'Needs review':'Complete'}</span>}</div>
        {current?<>
          <div className="review-callout"><strong>{missingFields(current,fields).length} required fields still blank</strong><span>{missingFields(current,fields).join(' · ')||'All required fields have values. Confirm accuracy before export.'}</span>{current.notes.map((n,i)=><span className="warning" key={i}>{n}</span>)}{current.notes.length>0&&<label className="acknowledge"><input type="checkbox" checked={current.reviewed} onChange={e=>acknowledge(e.target.checked)}/> I checked the flagged source details and corrected the fields as needed.</label>}</div>
          <div className="inspector-layout"><div className="form-preview">
            <div className="form-preview-header"><h3>2026 Sharecare Quality Compass</h3><p>The Sharecare Quality Compass Tracker is a strategic quality management tool designed to align individual agent performance with organizational excellence.</p></div>
            <div className="form-fields">{fields.map(f=><FieldEditor key={f.internalName} spec={f} value={current.fields[f.label]} onChange={value=>update(f.label,value)}/>)}</div>
            <div className="form-field attachments"><div className="field-heading"><span>Attachments</span><small>Optional</small></div><p>Attachments are not included in the CSV workflow.</p></div>
          </div><aside className="evidence"><h3>Source notes</h3><pre>{current.source}</pre><h3>Extracted context</h3><dl><dt>Call time</dt><dd>{current.time||'—'}</dd><dt>Duration</dt><dd>{current.duration||'—'}</dd><dt>Other references</dt><dd>{current.references.join(' · ')||'—'}</dd></dl><p>Phone numbers and caller names remain in this review panel. They are not mapped to List fields because the supplied form has no matching column.</p></aside></div>
        </>:<div className="inspector-empty">Identify the auditor, then paste your audit notes above to start. Parsing stays in this tab until you save reviewed records.</div>}
      </section>
      </>}
      {message&&<div className="toast" role="status">{message}<button aria-label="Dismiss" onClick={()=>setMessage('')}>×</button></div>}
    </main>
  </>;
}
