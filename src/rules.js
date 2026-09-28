import fields from './data/fields.json' with {type:'json'};
const choice=name=>fields.find(x=>x.label===name)?.choices||[];
const cardChoices=choice('Scorecard Type');
const mainChoices=new Set(choice('Quality Main Parameter'));
const subChoices=new Set(choice('Quality Sub-parameter'));
const add=(record,main,sub)=>{
  if(!mainChoices.has(main)||!subChoices.has(sub)) throw new Error(`Unrecognized List choice: ${main} / ${sub}`);
  if(!record.fields['Quality Main Parameter'].includes(main)) record.fields['Quality Main Parameter'].push(main);
  if(!record.fields['Quality Sub-parameter'].includes(sub)) record.fields['Quality Sub-parameter'].push(sub);
};
const qualityRules=[
  [/excessive hold|hold (?:policy|time|too long)/i,'Hold/Transfer policy','Hold policy'],
  [/did not ask.{0,60}(?:other|further|additional) questions|did not offer (?:additional|further) assistance/i,'Phone Etiquette','Offering additional assistance'],
  [/no closing spiel|did not (?:deliver|use|give).{0,35}closing|not.{0,30}closure|missed (?:the )?closing spiel/i,'Phone Etiquette','Complete closing spiel'],
  [/delayed greeting|late greeting|opened the call at \d+ seconds|missing (?:the )?opening spiel|did not (?:deliver|use).{0,30}opening spiel/i,'Phone Etiquette','Complete and correct Call Opening spiel'],
  [/lack of empathy|did not.{0,25}empathy/i,'Professionalism / Soft Skills','Professional and personable'],
  [/dead air/i,'Professionalism / Soft Skills','Dead air'],
  [/verification (?:process|step)|did not verify/i,'Verification','Verification process followed'],
  [/incorrect (?:information|answer)|wrong information/i,'Information Accuracy','Correct information provided'],
  [/did not (?:log|document) (?:the )?call|no log.a.call|(?:missing|no|did not (?:create|update)) (?:the )?relationship notes/i,'Documentation','Correctly used log-a-call/relationship notes'],
  [/did not update (?:the )?(?:cg|caregiver) summary|(?:cg|caregiver) summary (?:not|was not) updated/i,'Documentation','Caregiver summary updated'],
  [/incomplete documentation|inaccurate notes|did not document.{0,40}(?:interaction|call)/i,'Documentation','Complete and accurate notes']
];
const zeroRules=[
  [/intentional falsification/i,'Intentional Falsification of Documentation'],
  [/abusive|threatening|aggressive language/i,'Abusive, Threatening, or Aggressive Language'],
  [/discrimination|harassment/i,'Discrimination or Harassment'],
  [/willful non.compliance.{0,40}(?:emergency|safety)/i,'Willful Non‑Compliance With Emergency or Safety Protocols'],
  [/unauthorized commitment|misrepresentation/i,'Unauthorized Commitments or Misrepresentation'],
  [/call dropping|improper release|hung up on (?:the )?caller/i,'Improper Release of Call (Call Dropping / Hanging Up)'],
  [/abandoned.{0,30}(?:emergency|escalation|safety)/i,'Call abandoned during emergency, escalation, or safety risk'],
  [/failure to escalate|failed to escalate/i,'Failure to Escalate'],
  [/data privacy.{0,30}breach|confidential information breach/i,'Data Privacy & Confidential Information Breach'],
  [/identity verification bypass|verification falsification/i,'Identity Verification Bypass or Falsification'],
  [/invalid transfer/i,'Invalid Transfer']
];
function scorecardFor(lob,member,source) {
  const explicit=cardChoices.find(x=>source.toLowerCase().includes(x.toLowerCase()));
  if(explicit) return explicit;
  if(lob==='After-Hours Support') return cardChoices[0];
  if(lob==='Caregiver Support') return 'Caregiver Support Call 10.2024';
  if(lob==='Care Partner') return 'D2C & B2B CA Poke CG- 8.2024';
  if(lob==='B2B Care Advisor'||lob==='D2C Care Advisor') return member?'D2C & B2B CA Retention - Fam 8.2024':'D2C & B2B CA Retention - CG 8.2024';
  return '';
}
export function applyAuditRules(record,markdowns) {
  const f=record.fields;
  const src=record.source;
  const context=record.references.join(' ');
  const member=/\b(?:family|fam|summary)\b/i.test(context);
  const namedCaller=src.match(/\bcaller\s*type\s*:\s*(member|caregiver)\b/i);
  const memberCalled=/\b(?:member|client|family) (?:called|caller)\b/i.test(src);
  const caregiverCalled=/\b(?:caregiver|cg) (?:called|caller)\b/i.test(src);
  f['Caller Type']=namedCaller?(namedCaller[1].toLowerCase()==='member'?'Member':'Caregiver'):memberCalled&&!caregiverCalled?'Member':caregiverCalled&&!memberCalled?'Caregiver':member?'Member':'Caregiver';
  if(f.LOB) f['Contact Type']=/^(Caregiver Support|After-Hours Support)$/.test(f.LOB)?'Inbound Call':'Outbound Call';
  f['Scorecard Type']=scorecardFor(f.LOB,member,src);
  if(markdowns.some(md=>/\bBGO\b/i.test(md))) f['Scorecard Type']='Caregiver Support Call 10.2024';
  const severe=zeroRules.filter(([pattern])=>pattern.test(src));
  f['Zero-Tolerance Standard']=severe.length===1?severe[0][1]:severe.length?'':'N/A';
  if(severe.length) record.notes.push('Potential zero-tolerance issue: confirm the exact standard against the call before submitting.');
  if(severe.length>1) record.notes.push('Multiple zero-tolerance terms matched; choose the applicable List value manually.');
  if(/\bnot (?:a )?repeat caller\b/i.test(src)) f['Repeat Caller?']='No';
  else f['Repeat Caller?']=/\brepeat(?:ed)? caller\b|\brepeat call\b/i.test(src)?'Yes':'N/A';
  const complaint=/\bcomplain(?:t|ing|ed|s)?\b/i.test(src);
  const kudos=/\bkudos\b/i.test(src);
  const escalation=/\bescalat(?:ion|ed|e|ing)\b/i.test(src);
  f['Sentiment Orientation']=escalation?'For Escalation and intervention needed':complaint?'Negative':kudos?'Positive Call Experience':'Neutral';
  if([complaint,kudos,escalation].filter(Boolean).length>1) record.notes.push('More than one sentiment signal appears; confirm the selected orientation.');
  const numeric=Number(f['Quality Score in Percentage']);
  if(f['Quality Score in Percentage']!=='') f['Supervisor Action Next Step']=numeric>=95?'N/A':'Coaching';
  f['Kudos Call Verbatim']='N/A';
  if(kudos){
    const lines=src.split('\n');
    const index=lines.findIndex(x=>/\bkudos(?:\s*verbatim)?\s*:/i.test(x));
    const line=index>=0?lines[index]:'';
    const inline=line.replace(/^.*?\bkudos(?:\s*verbatim)?\s*:\s*/i,'').trim();
    const quote=inline||((index>=0&&/^[“\"]/.test(lines[index+1]||''))?lines[index+1].trim():'');
    f['Kudos Call Verbatim']=quote||'';
    if(!quote) record.notes.push('Kudos is mentioned but no verbatim follows “Kudos verbatim:”.');
  }
  if(f['Quality Score in Percentage']!==''&&numeric===100){
    if(markdowns.length) record.notes.push('A 100% score and Markdown misses appear in the same audit; confirm both before submission.');
    f['Quality Main Parameter']=['N/A'];
    f['Quality Sub-parameter']=['N/A'];
    f['Quality Auditor Remarks']='the agent followed the SOP';
  } else {
    f['Quality Auditor Remarks']=markdowns.join('\n');
    for(const md of markdowns){
      if(/\bBGO\b/i.test(md)){
        add(record,'Resolution / Accountability','Completeness');
        continue;
      }
      const matched=qualityRules.filter(([pattern])=>pattern.test(md));
      for(const [,main,sub] of matched) add(record,main,sub);
      if(!matched.length) record.notes.push(`No confirmed parameter mapping for markdown: “${md}”`);
    }
    if(!markdowns.length&&f['Quality Score in Percentage']!==''&&numeric<100){
      add(record,'Professionalism / Soft Skills','Professional and personable');
      f['Quality Auditor Remarks']='Professionalism / Soft Skills — Professional and personable';
      record.notes.push('No Markdown line explains the score; the requested default is Professional and personable. Confirm against the call.');
    }
  }
  if(!f['Scorecard Type']) record.notes.push('Scorecard could not be determined from the roster and references.');
  return record;
}
