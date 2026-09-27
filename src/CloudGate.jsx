import React,{useEffect,useState} from 'react';
import App from './App.jsx';
import {supabase} from './supabase.js';

const auditKey=fields=>[fields['Employee ID'],fields['Call Date'],fields['Call Event ID'],fields['Quality Score in Percentage'],fields['Quality Auditor Remarks']].join('|');
async function fetchAllAudits(){
  const rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await supabase.from('qa_audits').select('id,author_user_id,auditor_id,fields,created_at,qa_auditors(name)').order('created_at',{ascending:false}).range(from,from+999);
    if(error)throw error;
    rows.push(...data);
    if(data.length<1000)break;
  }
  return rows.map(row=>({...row.fields,_id:row.id,_owner:row.author_user_id,_auditorId:row.auditor_id,_auditorName:row.qa_auditors?.name||''}));
}

export default function CloudGate(){
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [roster,setRoster]=useState([]);
  const [archive,setArchive]=useState([]);
  const [loading,setLoading]=useState(!!supabase);
  const [error,setError]=useState('');
  const [email,setEmail]=useState('');
  const [sent,setSent]=useState(false);
  useEffect(()=>{
    if(!supabase)return;
    let live=true;
    supabase.auth.getUser().then(({data,error})=>{if(live){setUser(error?null:data.user);setLoading(false)}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(live)setUser(session?.user||null)});
    return ()=>{live=false;subscription.unsubscribe()};
  },[]);
  useEffect(()=>{
    if(!supabase||!user){setProfile(null);setRoster([]);setArchive([]);return}
    let live=true;
    setLoading(true);setError('');
    (async()=>{
      const {data:member,error:membershipError}=await supabase.from('qa_members').select('auditor_id,role,active,qa_auditors(id,name)').eq('auth_user_id',user.id).maybeSingle();
      if(membershipError)throw membershipError;
      if(!member?.active)throw new Error('Your account is not on the active QA Compass access list. Ask the project owner to link your Auth user ID.');
      const [agents,audits]=await Promise.all([
        supabase.from('qa_agents').select('eid,agent_name,supervisor,lob').eq('active',true).order('agent_name'),
        fetchAllAudits()
      ]);
      if(agents.error)throw agents.error;
      if(live){setProfile(member);setRoster((agents.data||[]).map(a=>({eid:a.eid,agentName:a.agent_name,supervisor:a.supervisor,lob:a.lob})));setArchive(audits)}
    })().catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
    return ()=>{live=false};
  },[user?.id]);
  async function sendLink(event){
    event.preventDefault();setError('');
    const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin}});
    if(error)setError(error.message);else setSent(true);
  }
  async function saveAudits(rows){
    const entries=rows.map(fields=>({author_user_id:user.id,auditor_id:profile.auditor_id,client_key:auditKey(fields),fields}));
    const {error}=await supabase.from('qa_audits').upsert(entries,{onConflict:'author_user_id,client_key'});
    if(error)throw error;
    setArchive(await fetchAllAudits());
  }
  async function removeAudit(row){
    if(row._owner!==user.id)throw new Error('Only the auditor who saved this record can remove it.');
    const {error}=await supabase.from('qa_audits').delete().eq('id',row._id);
    if(error)throw error;
    setArchive(current=>current.filter(x=>x._id!==row._id));
  }
  if(!supabase)return <App/>;
  if(loading)return <div className="access-panel">Loading QA Compass access…</div>;
  if(!user)return <main className="access-panel"><h1>QA Compass</h1><h2>Auditor sign-in</h2><p>Use the email account that the project owner invited to Supabase. Your auditor ID and name are assigned to that account.</p><form onSubmit={sendLink}><label>Work email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/></label><button className="primary">Send sign-in link</button></form>{sent&&<p>Check your email for a one-time sign-in link.</p>}{error&&<p className="warning">{error}</p>}</main>;
  if(!profile)return <main className="access-panel"><h1>QA Compass</h1><p>{error||'Your account is not linked to an auditor profile yet.'}</p><button className="secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button></main>;
  const auditor=profile.qa_auditors;
  return <App cloud={{user,profile,auditor:auditor&&{id:profile.auditor_id,name:auditor.name},roster,archive,saveAudits,removeAudit,signOut:()=>supabase.auth.signOut()}}/>;
}
