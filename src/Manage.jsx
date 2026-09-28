import React,{useEffect,useState} from 'react';
import {supabase} from './supabase.js';

const emptyAgent={eid:'',agent_name:'',supervisor:'',lob:''};
const nextQaId=auditors=>{
  const last=Math.max(0,...auditors.map(a=>Number(/^qa(\d+)$/i.exec(a.id)?.[1]||0)));
  return `qa${String(last+1).padStart(3,'0')}`;
};

export default function Manage({cloud}){
  const [data,setData]=useState({auditors:[],emails:[],agents:[],supervisors:[],lobs:[]});
  const [qa,setQa]=useState({id:'',name:'',email:''});
  const [agent,setAgent]=useState(emptyAgent);
  const [editing,setEditing]=useState(null);
  const [deleting,setDeleting]=useState(null);
  const [lastDeleted,setLastDeleted]=useState(null);
  const [supervisor,setSupervisor]=useState('');
  const [lob,setLob]=useState('');
  const [busy,setBusy]=useState(false);
  const [passwordReady,setPasswordReady]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  async function reload(){
    const names=['qa_auditors','qa_allowed_emails','qa_agents','qa_supervisors','qa_lobs'];
    const rows=await Promise.all(names.map(name=>supabase.from(name).select('*')));
    const failure=rows.find(r=>r.error);
    if(failure)throw failure.error;
    const [auditors,emails,agents,supervisors,lobs]=rows.map(r=>r.data||[]);
    setData({
      auditors:auditors.sort((a,b)=>a.id.localeCompare(b.id)),
      emails,agents:agents.sort((a,b)=>a.agent_name.localeCompare(b.agent_name)),
      supervisors:supervisors.sort((a,b)=>a.name.localeCompare(b.name)),
      lobs:lobs.sort((a,b)=>a.name.localeCompare(b.name))
    });
    setQa(old=>({...old,id:old.id||nextQaId(auditors)}));
  }
  useEffect(()=>{reload().catch(e=>setError(e.message))},[]);
  async function run(action,success){
    setBusy(true);setError('');setMessage('');setLastDeleted(null);
    try{await action();await reload();setMessage(success)}
    catch(e){setError(e.message)}
    finally{setBusy(false)}
  }
  function addQa(event){
    event.preventDefault();
    const entry={id:qa.id.trim().toLowerCase(),name:qa.name.trim(),email:qa.email.trim().toLowerCase()};
    run(async()=>{
      const {error}=await supabase.rpc('add_qa_auditor',{p_id:entry.id,p_name:entry.name,p_email:entry.email});
      if(error)throw error;
      setQa({id:'',name:'',email:''});
    },`${entry.name} is approved. They can enter with ${entry.email}.`);
  }
  function saveAgent(event){
    event.preventDefault();
    const entry={eid:agent.eid.trim(),agent_name:agent.agent_name.trim(),supervisor:agent.supervisor,lob:agent.lob,active:true};
    run(async()=>{
      const {error}=await supabase.from('qa_agents').upsert(entry,{onConflict:'eid'});
      if(error)throw error;
      setAgent(emptyAgent);
      await cloud.refreshRoster();
    },`${entry.agent_name} is saved in the global employee roster.`);
  }
  function saveEdit(event){
    event.preventDefault();
    const original=editing.originalEid;
    const entry={eid:editing.eid.trim(),agent_name:editing.agent_name.trim(),supervisor:editing.supervisor,lob:editing.lob};
    run(async()=>{
      const {error}=await supabase.from('qa_agents').update(entry).eq('eid',original);
      if(error)throw error;
      await cloud.refreshRoster();
      setEditing(null);
    },`${entry.agent_name} was updated.`);
  }
  function deleteAgent(){
    const row=deleting;
    run(async()=>{
      const {error}=await supabase.from('qa_agents').update({active:false}).eq('eid',row.eid);
      if(error)throw error;
      await cloud.refreshRoster();
      setDeleting(null);
      setLastDeleted(row.eid);
    },`${row.agent_name} was removed from the active roster. You can undo this.`);
  }
  function undoAgent(row){
    run(async()=>{
      const {error}=await supabase.from('qa_agents').update({active:true}).eq('eid',row.eid);
      if(error)throw error;
      await cloud.refreshRoster();
      if(lastDeleted===row.eid)setLastDeleted(null);
    },`${row.agent_name} is back in the active roster.`);
  }
  function addCategory(event,table,value,setValue,label){
    event.preventDefault();
    const name=value.trim();
    run(async()=>{
      const {error}=await supabase.from(table).insert({name});
      if(error)throw error;
      setValue('');
      if(table==='qa_lobs')await cloud.refreshRoster();
    },`${label} “${name}” is now available in the agent form.`);
  }
  function changeLoginMode(){
    const next=cloud.loginMode==='email'?'password':'email';
    run(()=>cloud.updateLoginMode(next),next==='password'?'Password mode is enabled. Sign in with the password accounts configured in Supabase.':'Email-only entry is enabled again.');
  }
  return <section className="manage">
    <div className="manage-heading"><h1>Manage team directory</h1><p>Changes here are saved to Supabase and shared with both auditors. Add supervisors and LOBs first, then assign them to agents.</p></div>
    {error&&<p className="manage-alert" role="alert">{error}</p>}
    {message&&<p className="manage-success" role="status">{message}{lastDeleted&&<button type="button" className="link" disabled={busy} onClick={()=>{const row=data.agents.find(a=>a.eid===lastDeleted);if(row)undoAgent(row)}}>Undo</button>}</p>}
    <section className="panel manage-card manage-login-settings">
      <h2>Sign-in mode</h2>
      <p>Current mode: <strong>{cloud.loginMode==='email'?'Cognizant email entry':'Email and password'}</strong>. Email entry is self-reported. Use password mode later when every auditor has a password account in Supabase.</p>
      {cloud.loginMode==='email'&&<label className="manage-confirm"><input type="checkbox" checked={passwordReady} onChange={e=>setPasswordReady(e.target.checked)}/> I have created password accounts for every auditor and am ready to change the sign-in screen.</label>}
      <button type="button" className="secondary" disabled={busy||(cloud.loginMode==='email'&&!passwordReady)} onClick={changeLoginMode}>{cloud.loginMode==='email'?'Switch to password mode':'Switch to email entry'}</button>
    </section>
    <div className="manage-grid">
      <section className="panel manage-card">
        <h2>Add an auditor</h2><p>Give the new QA an ID and Cognizant email. In email-entry mode, no message or password is needed.</p>
        <form onSubmit={addQa} className="manage-form">
          <label>QA ID<input required pattern="qa[0-9]{3,}" value={qa.id} onChange={e=>setQa({...qa,id:e.target.value})} placeholder="qa003"/></label>
          <label>Full name<input required value={qa.name} onChange={e=>setQa({...qa,name:e.target.value})} placeholder="Surname, First name"/></label>
          <label>Cognizant email<input required type="email" pattern=".+@cognizant\.com" value={qa.email} onChange={e=>setQa({...qa,email:e.target.value})} placeholder="name@cognizant.com"/></label>
          <button className="primary" disabled={busy}>Add QA</button>
        </form>
        <div className="manage-list"><h3>Approved auditors ({data.auditors.length})</h3>
          {data.auditors.map(a=><div key={a.id}><strong>{a.id}</strong><span>{a.name}</span><small>{data.emails.find(e=>e.auditor_id===a.id)?.email||'Email not linked'}</small></div>)}
        </div>
      </section>
      <section className="panel manage-card">
        <h2>Add an agent</h2><p>The employee ID, name, supervisor, and LOB will be used when parsing notes. Use Edit in the roster to change an existing agent.</p>
        <form onSubmit={saveAgent} className="manage-form">
          <label>Employee ID<input required value={agent.eid} onChange={e=>setAgent({...agent,eid:e.target.value})} placeholder="Employee ID"/></label>
          <label>Agent name<input required value={agent.agent_name} onChange={e=>setAgent({...agent,agent_name:e.target.value})} placeholder="Surname, First name"/></label>
          <label>Supervisor<select required value={agent.supervisor} onChange={e=>setAgent({...agent,supervisor:e.target.value})}><option value="">Choose supervisor</option>{data.supervisors.filter(x=>x.active).map(x=><option key={x.name}>{x.name}</option>)}</select></label>
          <label>LOB<select required value={agent.lob} onChange={e=>setAgent({...agent,lob:e.target.value})}><option value="">Choose LOB</option>{data.lobs.filter(x=>x.active).map(x=><option key={x.name}>{x.name}</option>)}</select></label>
          <div className="manage-actions"><button className="primary" disabled={busy}>Save agent</button><button type="button" className="secondary" onClick={()=>setAgent(emptyAgent)}>Clear form</button></div>
        </form>
      </section>
      <section className="panel manage-card">
        <h2>Supervisors</h2>
        <form onSubmit={e=>addCategory(e,'qa_supervisors',supervisor,setSupervisor,'Supervisor')} className="manage-form-inline"><input aria-label="New supervisor" required value={supervisor} onChange={e=>setSupervisor(e.target.value)} placeholder="Supervisor name"/><button className="primary" disabled={busy}>Add supervisor</button></form>
        <div className="manage-chip-list">{data.supervisors.map(x=><span key={x.name}>{x.name}</span>)}</div>
      </section>
      <section className="panel manage-card">
        <h2>Lines of business</h2>
        <form onSubmit={e=>addCategory(e,'qa_lobs',lob,setLob,'LOB')} className="manage-form-inline"><input aria-label="New LOB" required value={lob} onChange={e=>setLob(e.target.value)} placeholder="LOB name"/><button className="primary" disabled={busy}>Add LOB</button></form>
        <div className="manage-chip-list">{data.lobs.map(x=><span key={x.name}>{x.name}</span>)}</div>
      </section>
    </div>
    <section className="panel manage-card manage-agent-list"><h2>Employee roster ({data.agents.filter(a=>a.active).length} active)</h2><p>Delete hides an agent from new audits. Existing audit records stay intact; use Undo to restore the agent.</p><div className="table-scroll"><table><thead><tr><th>Employee ID</th><th>Agent</th><th>Supervisor</th><th>LOB</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.agents.map(a=><tr key={a.eid}><td>{a.eid}</td><td>{a.agent_name}</td><td>{a.supervisor}</td><td>{a.lob}</td><td>{a.active?'Active':'Deleted'}</td><td><button type="button" className="link" disabled={busy} onClick={()=>setEditing({...a,originalEid:a.eid})}>Edit</button>{a.active?<button type="button" className="link danger-link" disabled={busy} onClick={()=>setDeleting(a)}>Delete</button>:<button type="button" className="link" disabled={busy} onClick={()=>undoAgent(a)}>Undo</button>}</td></tr>)}</tbody></table></div></section>
    {editing&&<div className="manage-modal-backdrop" onClick={()=>!busy&&setEditing(null)}><div className="manage-modal panel" role="dialog" aria-modal="true" aria-labelledby="edit-agent-title" onClick={e=>e.stopPropagation()}><h2 id="edit-agent-title">Edit {editing.agent_name}</h2><p>Save the individual changes to the shared roster.</p><form onSubmit={saveEdit} className="manage-form"><label>Employee ID<input required value={editing.eid} onChange={e=>setEditing({...editing,eid:e.target.value})}/></label><label>Agent name<input required value={editing.agent_name} onChange={e=>setEditing({...editing,agent_name:e.target.value})}/></label><label>Supervisor<select required value={editing.supervisor} onChange={e=>setEditing({...editing,supervisor:e.target.value})}>{data.supervisors.map(x=><option key={x.name}>{x.name}</option>)}</select></label><label>LOB<select required value={editing.lob} onChange={e=>setEditing({...editing,lob:e.target.value})}>{data.lobs.map(x=><option key={x.name}>{x.name}</option>)}</select></label><div className="manage-actions"><button className="primary" disabled={busy}>Save changes</button><button type="button" className="secondary" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></div></form></div></div>}
    {deleting&&<div className="manage-modal-backdrop" onClick={()=>!busy&&setDeleting(null)}><div className="manage-modal panel" role="alertdialog" aria-modal="true" aria-labelledby="delete-agent-title" aria-describedby="delete-agent-description" onClick={e=>e.stopPropagation()}><h2 id="delete-agent-title">Delete {deleting.agent_name}?</h2><p id="delete-agent-description">This agent will disappear from the active roster. Old audits remain available, and you can undo the deletion at any time.</p><div className="manage-actions"><button type="button" className="danger-button" disabled={busy} onClick={deleteAgent}>Delete agent</button><button type="button" className="secondary" disabled={busy} onClick={()=>setDeleting(null)}>Cancel</button></div></div></div>}
  </section>;
}
