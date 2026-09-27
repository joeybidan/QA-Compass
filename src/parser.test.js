import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNotes,missingFields,csvFor,matchAgent} from './parser.js';
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
 const notes='Sampleton, CLX_Alex\n09/15/2026\n09:24:54 AM\n3:01\n10006773459\n100\n\nExample, CLX_Bailey\n09/14/2026\n10:31:28 AM\n7:58\n10006764708\nMarkdown: excessive hold\nMarkdown: did not deliver closing spiel\n89.4';
 const r=parseNotes(notes,agents);
 assert.equal(r.length,2);
 assert.equal(r[0].fields['Quality Score in Percentage'],'100');
 assert.equal(r[1].fields['Quality Score in Percentage'],'89.4');
 assert.deepEqual(r[1].fields['Quality Main Parameter'],['Hold/Transfer policy','Phone Etiquette']);
 assert.equal(r[1].fields['Caller Type'],'Caregiver');
 assert.ok(csvFor(r,fields).includes('10006773459'));
 assert.equal(matchAgent('Alex Sampleton',agents)?.eid,'101');
});
test('sentiment, scorecard, and severe issue',()=>{
 const r=parseNotes('Testperson, CLX_Casey\n09/17/2026\n11:44:08 AM\n9:10\n10006792822\nCaregiver caller\nMarkdown: missed the closing spiel and did not update CG summary\nEscalation needed\n90',agents)[0];
 assert.equal(r.fields['Sentiment Orientation'],'For Escalation and intervention needed');
 assert.equal(r.fields['Scorecard Type'],'D2C & B2B CA Poke CG- 8.2024');
 assert.ok(r.fields['Quality Sub-parameter'].includes('Caregiver summary updated'));
 const severe=parseNotes('Example, CLX_Bailey\n09/14/2026\n10:31:28 AM\n7:58\nMarkdown: invalid transfer\n90',agents)[0];
 assert.equal(severe.fields['Zero-Tolerance Standard'],'Invalid Transfer');
});
