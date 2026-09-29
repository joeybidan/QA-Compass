import test from 'node:test';
import assert from 'node:assert/strict';
import {agentYearRows,auditMonthStatus,groupAuditsByAuditor,monthlyComparison} from './analyticsData.js';

const audit=(id,date,score,event,markdown='N/A')=>({
  'Employee ID':id,'Employee Name':id==='1'?'Alit, Lorraine Grace':'Nemenzo, Louie',
  'Call Date':date,'Call Event ID':event,'Quality Score in Percentage':score,
  'LOB':id==='1'?'Caregiver Support':'B2B Care Advisor','Supervisor':'Lead One',
  'Quality Sub-parameter':[markdown]
});

test('monthly lines use actual score denominators and count each markdown once per audit',()=>{
  const rows=[audit('1','08/02/2026',80,'10000000001','Completeness'),audit('1','08/03/2026',100,'10000000002','Completeness'),audit('2','09/01/2026',90,'10000000003','Hold policy')];
  const lob=monthlyComparison(rows,'2026','LOB',['Caregiver Support','B2B Care Advisor']);
  assert.equal(lob.find(item=>item.name==='Caregiver Support').points[7].value,90);
  assert.equal(lob.find(item=>item.name==='Caregiver Support').points[6].value,null);
  assert.equal(lob.find(item=>item.name==='B2B Care Advisor').points[8].value,90);
  const markdown=monthlyComparison(rows,'2026','Quality Sub-parameter');
  assert.equal(markdown.find(item=>item.name==='Completeness').points[7].value,2);
  assert.equal(markdown.find(item=>item.name==='Hold policy').points[8].value,1);
});

test('agent year table includes roster agents, sorts names, and distinguishes audit coverage',()=>{
  const roster=[{eid:'2',agentName:'Nemenzo, Louie',lob:'B2B Care Advisor'},{eid:'1',agentName:'Alit, Lorraine Grace',lob:'CG Support'}];
  const august=Array.from({length:8},(_,index)=>audit('1','08/02/2026',index?100:80,String(10000000000+index)));
  const september=Array.from({length:9},(_,index)=>audit('2','09/02/2026',90,String(10000000100+index)));
  const rows=agentYearRows([...august,...september],roster,'2026');
  assert.deepEqual(rows.map(row=>row.name),['Alit, Lorraine Grace','Nemenzo, Louie']);
  assert.equal(rows[0].lob,'Caregiver Support');
  assert.equal(rows[0].months[7].status,'complete');
  assert.equal(rows[0].months[7].average,97.5);
  assert.equal(rows[0].months[0].status,'below');
  assert.equal(rows[1].months[8].status,'possible-duplicate');
  assert.equal(auditMonthStatus([...august.slice(0,7),august[0]]).status,'possible-duplicate');
  assert.equal(auditMonthStatus(august.slice(0,7)).status,'below');
  const grouped=groupAuditsByAuditor([{...august[0],_auditorName:'QA Two'},{...august[1],_auditorName:'QA One'},{...august[2],_auditorName:'QA One'}]);
  assert.deepEqual(grouped.map(([name,audits])=>[name,audits.length]),[['QA One',2],['QA Two',1]]);
});
