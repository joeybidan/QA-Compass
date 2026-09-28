import React,{useEffect,useRef,useState} from 'react';
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
  const [mode,setMode]=useState(null);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [roster,setRoster]=useState([]);
  const [lobs,setLobs]=useState([]);
  const [archive,setArchive]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [refreshToken,setRefreshToken]=useState(0);
  const claiming=useRef(false);
  useEffect(()=>{
    if(!supabase){setLoading(false);return}
    let live=true;
    Promise.all([supabase.from('qa_auth_settings').select('mode').eq('id',1).single(),supabase.auth.getUser()])
      .then(([setting,auth])=>{
        if(!live)return;
        if(setting.error)throw setting.error;
        setMode(setting.data.mode);
        setUser(auth.error?null:auth.data.user);
      }).catch(e=>{if(live)setError(`Could not load sign-in settings: ${e.message}`)})
      .finally(()=>{if(live)setLoading(false)});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(live&&!claiming.current)setUser(session?.user||null);
    });
    return ()=>{live=false;subscription.unsubscribe()};
  },[]);
  useEffect(()=>{
    if(!supabase||!user||!mode){setProfile(null);setRoster([]);setLobs([]);setArchive([]);return}
    if(mode==='password'&&user.is_anonymous){supabase.auth.signOut();setUser(null);return}
    let live=true;
    setLoading(true);setError('');
    (async()=>{
      const {data:member,error:membershipError}=await supabase.from('qa_members').select('auditor_id,role,active,can_manage,qa_auditors(id,name)').eq('auth_user_id',user.id).maybeSingle();
      if(membershipError)throw membershipError;
      if(!member?.active){
        if(user.is_anonymous){if(live)setProfile(null);return}
        throw new Error('This account is not approved for QA Compass.');
      }
      const [agents,lines,audits]=await Promise.all([
        supabase.from('qa_agents').select('eid,agent_name,supervisor,lob').eq('active',true).order('agent_name'),
        supabase.from('qa_lobs').select('name').eq('active',true).order('name'),fetchAllAudits()
      ]);
      if(agents.error)throw agents.error;
      if(lines.error)throw lines.error;
      if(live){setProfile(member);setRoster((agents.data||[]).map(a=>({eid:a.eid,agentName:a.agent_name,supervisor:a.supervisor,lob:a.lob})));setLobs((lines.data||[]).map(x=>x.name));setArchive(audits)}
    })().catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
    return ()=>{live=false};
  },[user?.id,mode,refreshToken]);
  async function refreshRoster(){
    const [agents,lines]=await Promise.all([
      supabase.from('qa_agents').select('eid,agent_name,supervisor,lob').eq('active',true).order('agent_name'),
      supabase.from('qa_lobs').select('name').eq('active',true).order('name')
    ]);
    if(agents.error)throw agents.error;
    if(lines.error)throw lines.error;
    setRoster((agents.data||[]).map(a=>({eid:a.eid,agentName:a.agent_name,supervisor:a.supervisor,lob:a.lob})));
    setLobs((lines.data||[]).map(x=>x.name));
  }
  async function enterEmail(event){
    event.preventDefault();setError('');
    const address=email.trim().toLowerCase();
    if(!address.endsWith('@cognizant.com')){setError('Enter a Cognizant email address.');return}
    claiming.current=true;setLoading(true);
    try{
      let current=user;
      if(!current){
        const {data:existing}=await supabase.auth.getUser();
        current=existing?.user;
      }
      if(!current){
        const {data,error:signInError}=await supabase.auth.signInAnonymously();
        if(signInError)throw signInError;
        current=data.user;
      }
      const {error:claimError}=await supabase.rpc('claim_qa_email',{p_email:address});
      if(claimError)throw claimError;
      setUser(current);setRefreshToken(n=>n+1);
    }catch(e){setError(/anonymous.*(?:disabled|not enabled|not allowed)/i.test(e.message)?'The project owner needs to turn on Anonymous Sign-Ins in Supabase → Authentication → Sign In / Providers.':e.message)}
    finally{claiming.current=false;setLoading(false)}
  }
  async function enterPassword(event){
    event.preventDefault();setLoading(true);setError('');
    const {error:signInError}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
    if(signInError)setError(signInError.message);
    setPassword('');setLoading(false);
  }
  async function updateLoginMode(next){
    if(!profile?.can_manage)throw new Error('Only a directory manager can change sign-in settings.');
    const {error:updateError}=await supabase.from('qa_auth_settings').update({mode:next}).eq('id',1);
    if(updateError)throw updateError;
    setMode(next);
    if(next==='password')await supabase.auth.signOut();
  }
  async function saveAudits(rows){
    const entries=rows.map(fields=>({author_user_id:user.id,auditor_id:profile.auditor_id,client_key:auditKey(fields),fields}));
    const {error:saveError}=await supabase.from('qa_audits').upsert(entries,{onConflict:'author_user_id,client_key'});
    if(saveError)throw saveError;
    setArchive(await fetchAllAudits());
  }
  async function removeAudit(row){
    if(row._owner!==user.id)throw new Error('Only this browser session can remove the audit it saved.');
    const {error:deleteError}=await supabase.from('qa_audits').delete().eq('id',row._id);
    if(deleteError)throw deleteError;
    setArchive(current=>current.filter(x=>x._id!==row._id));
  }
  if(!supabase)return <main className="access-panel"><h1>QA Compass</h1><p>Cloud connection is not configured for this build.</p></main>;
  if(loading)return <div className="access-panel">Loading QA Compass…</div>;
  if(!mode)return <main className="access-panel"><h1>QA Compass</h1><p className="warning">{error||'Sign-in settings are unavailable.'}</p></main>;
  if(!profile){
    return <main className="access-panel"><h1>QA Compass</h1><h2>Auditor entry</h2>
      <p>{mode==='email'?'Enter your approved Cognizant email to open the workspace. No email message, password, or code is sent.':'Password mode is on. Sign in with your Cognizant email and the password created for your account.'}</p>
      <form onSubmit={mode==='email'?enterEmail:enterPassword}>
        <label>Cognizant email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@cognizant.com"/></label>
        {mode==='password'&&<label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
        <button className="primary">{mode==='email'?'Open QA Compass':'Sign in'}</button>
      </form>
      {mode==='email'&&<p className="entry-note">Email entry is self-reported. Only use it with your trusted QA team.</p>}
      {error&&<p className="warning" role="alert">{error}</p>}
    </main>;
  }
  const auditor=profile.qa_auditors;
  return <App cloud={{user,profile,auditor:auditor&&{id:profile.auditor_id,name:auditor.name},roster,lobs,archive,saveAudits,removeAudit,refreshRoster,loginMode:mode,updateLoginMode,signOut:()=>supabase.auth.signOut()}}/>;
}
