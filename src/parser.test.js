import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNotes,missingFields,csvFor,matchAgent} from './parser.js';
import {csvForSavedMonth,markdownLabels,rankAgents} from './analyticsData.js';
import fields from './data/fields.json' with {type:'json'};
const agents=[
  {agentName:'Sampleton, Alex',eid:'101',supervisor:'Lead One',lob:'CG Support'},
  {agentName:'Example, Bailey',eid:'102',supervisor:'Lead Two',lob:'B2B Care Advisor'},
  {agentName:'Testperson, Casey',eid:'103',supervisor:'Lead Three',lob:'Care Partner'}
];
test('score typos, missing event, fallback markdown, and duration',()=>{
 const r=parseNotes('Sampleton, CLX_Alex\n09/15/2026\n09:24:54 AM\n3:01\n80s',agents)[0];
 assert.equal(r.fields['Employee ID'],'101');
 assert.equal(r.fields['Audited Call AHT in Seconds'],181);
 assert.equal(r.fields['Call Event ID'],'');
 assert.equal(r.fields['Quality Score in Percentage'],'80');
 assert.deepEqual(r.fields['Quality Main Parameter'],['Professionalism / Soft Skills']);
 assert.deepEqual(r.fields['Quality Sub-parameter'],['Professional and personable']);
 assert.equal(r.fields['Supervisor Action Next Step'],'Coaching');
 assert.equal(missingFields(r,fields).length,0);
 assert.ok(r.notes.some(x=>x.includes('Interpreted')));
});
test('separate records, markdown categories, and safe CSV',()=>{
 const notes='Sampleton, CLX_Alex\n09/15/2026\n09:24:54 AM\n3:01\n10000000001\n100\n\nExample, CLX_Bailey\n09/14/2026\n10:31:28 AM\n7:58\n10000000002\nMarkdown: excessive hold\nMarkdown: did not deliver closing spiel\n89.4';
 const r=parseNotes(notes,agents);
 assert.equal(r.length,2);
 assert.equal(r[0].fields['Quality Score in Percentage'],'100');
 assert.equal(r[1].fields['Quality Score in Percentage'],'89.4');
 assert.deepEqual(r[1].fields['Quality Main Parameter'],['Hold/Transfer policy','Phone Etiquette']);
 assert.equal(r[1].fields['Caller Type'],'Caregiver');
 assert.ok(csvFor(r,fields).includes('10000000001'));
 assert.equal(matchAgent('Alex Sampleton',agents)?.eid,'101');
});
test('sentiment, scorecard, and severe issue',()=>{
 const r=parseNotes('Testperson, CLX_Casey\n09/17/2026\n11:44:08 AM\n9:10\n10000000003\nCaregiver caller\nMarkdown: missed the closing spiel and did not update CG summary\nEscalation needed\n90',agents)[0];
 assert.equal(r.fields['Sentiment Orientation'],'For Escalation and intervention needed');
 assert.equal(r.fields['Scorecard Type'],'D2C & B2B CA Poke CG- 8.2024');
 assert.ok(r.fields['Quality Sub-parameter'].includes('Caregiver summary updated'));
 const severe=parseNotes('Example, CLX_Bailey\n09/14/2026\n10:31:28 AM\n7:58\nMarkdown: invalid transfer\n90',agents)[0];
 assert.equal(severe.fields['Zero-Tolerance Standard'],'Invalid Transfer');
});
test('BGO markdown uses Caregiver Support completeness choices',()=>{
 const r=parseNotes('Sampleton, CLX_Alex\n09/21/2026\n10:39:18 AM\n9:15\n10006808857\nMarkdown: the agent was not able to advise about the expired BGO and ask permission for renewal\n80s',agents)[0];
 assert.equal(r.fields['Scorecard Type'],'Caregiver Support Call 10.2024');
 assert.deepEqual(r.fields['Quality Main Parameter'],['Resolution / Accountability']);
 assert.deepEqual(r.fields['Quality Sub-parameter'],['Completeness']);
 assert.equal(missingFields(r,fields).length,0);
 assert.ok(!r.notes.some(x=>x.includes('No confirmed parameter mapping')));
});
test('bottom and below-100 rankings retain each agent’s markdowns',()=>{
 const rows=[
  {'Employee ID':'1','Employee Name':'A','LOB':'CG Support','Quality Score in Percentage':'100','Quality Sub-parameter':['N/A']},
  {'Employee ID':'1','Employee Name':'A','LOB':'CG Support','Quality Score in Percentage':'80','Quality Sub-parameter':['Completeness']},
  {'Employee ID':'2','Employee Name':'B','LOB':'D2C','Quality Score in Percentage':'95','Quality Sub-parameter':['Hold policy']},
  {'Employee ID':'2','Employee Name':'B','LOB':'D2C','Quality Score in Percentage':'90','Quality Sub-parameter':['Complete closing spiel']}
 ];
 assert.deepEqual(rankAgents(rows,{ascending:true}).map(x=>x.id),['1','2']);
 assert.deepEqual(rankAgents(rows,{ascending:true,belowOnly:true}).map(x=>x.id),['1','2']);
 assert.deepEqual(markdownLabels(rankAgents(rows,{ascending:true})[1].audits),['Hold policy','Complete closing spiel']);
});
test('alternate agent names and QA: 100 use the shared roster',()=>{
 const roster=[...agents,
  {agentName:'Alit, Lorraine Grace ',eid:'824317',supervisor:'Lead Four',lob:'D2C Care Advisor'},
  {agentName:'Nemenzo, Louie',eid:'663794',supervisor:'Lead Five',lob:'B2B Care Advisor'}];
 const notes='Grace, CLX_Lorraine\n08/03/2026\n11:37:57 AM\n8:17\n10006849732\nQA: 100\n\nNemenzo, CLX_Louis\n08/12/2026\n07:14:40 PM\n8:45\n10006562263\n99.25';
 const rows=parseNotes(notes,roster);
 assert.equal(rows[0].fields['Employee ID'],'824317');
 assert.equal(rows[0].fields['Employee Name'],'Alit, Lorraine Grace');
 assert.equal(rows[0].fields['Quality Score in Percentage'],'100');
 assert.equal(rows[1].fields['Employee ID'],'663794');
 assert.equal(rows[1].fields.LOB,'B2B Care Advisor');
});
test('opening delay and Caregiver Support survey spiel map to the exact List choices',()=>{
 const notes='Sampleton, CLX_Alex\n08/05/2026\n10:20:00 AM\n4:02\nMarkdown: opening spiel at 21 seconds\nMarkdown: agent did not deliver survey spiel\n90';
 const cg=parseNotes(notes,agents)[0];
 assert.deepEqual(cg.fields['Quality Main Parameter'],['Phone Etiquette']);
 assert.deepEqual(cg.fields['Quality Sub-parameter'],['Preparedness to take the call','Complete closing spiel']);
 assert.equal(missingFields(cg,fields).length,0);
 const other=parseNotes(notes.replace('Sampleton, CLX_Alex','Example, CLX_Bailey'),agents)[0];
 assert.deepEqual(other.fields['Quality Sub-parameter'],['Preparedness to take the call']);
 assert.ok(other.notes.some(x=>x.includes('No confirmed parameter mapping')&&x.includes('survey spiel')));
});
test('monthly analytics CSV exports every saved field in Microsoft List order',()=>{
 const august={'Employee ID':'824317','Employee Name':'Alit, Lorraine Grace','Call Date':'08/03/2026','Quality Score in Percentage':'100','Quality Sub-parameter':['N/A'],'Quality Auditor Remarks':'the agent followed the SOP'};
 const september={'Employee ID':'663794','Employee Name':'Nemenzo, Louie','Call Date':'09/12/2026','Quality Score in Percentage':'90'};
 const csv=csvForSavedMonth([august,september],'2026-08',fields);
 assert.ok(csv.startsWith('\uFEFF"Employee ID","Employee Name","Supervisor","LOB","Call Date"'));
 assert.ok(csv.includes('"Alit, Lorraine Grace"'));
 assert.ok(!csv.includes('Nemenzo, Louie'));
 assert.equal(csv.trim().split('\r\n').length,2);
});
