// Run locally with SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.
// The input JSON files and secret key must stay outside the public repository.
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';

const [rosterPath,auditorsPath]=process.argv.slice(2);
if(!rosterPath||!auditorsPath||!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY){
  console.error('Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node setup/seed-reference-data.mjs /path/agents.json /path/auditors.json');
  process.exit(1);
}
const roster=JSON.parse(await readFile(rosterPath,'utf8'));
const auditors=JSON.parse(await readFile(auditorsPath,'utf8'));
if(!Array.isArray(roster)||!roster.every(a=>a.eid&&a.agentName&&a.supervisor&&a.lob))throw new Error('Invalid agents.json: eid, agentName, supervisor, and lob are required.');
if(!Array.isArray(auditors)||!auditors.every(a=>a.id&&a.name))throw new Error('Invalid auditors.json: id and name are required.');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
for(const [table,rows,conflict] of [
  ['qa_auditors',auditors.map(a=>({id:String(a.id),name:String(a.name)})),'id'],
  ['qa_agents',roster.map(a=>({eid:String(a.eid),agent_name:String(a.agentName),supervisor:String(a.supervisor),lob:String(a.lob)})),'eid']
]){
  const {error}=await client.from(table).upsert(rows,{onConflict:conflict});
  if(error)throw new Error(`${table}: ${error.message}`);
  console.log(`Seeded ${rows.length} ${table} rows.`);
}
console.log('Now invite the auditor emails in Authentication > Users and link their Auth user UUIDs in qa_members.');
