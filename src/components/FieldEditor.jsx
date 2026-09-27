import React from 'react';
const rosterFields=new Set(['Employee ID','Employee Name','Supervisor','LOB']);
const fromNotes=new Set(['Call Date','Call Event ID','Audited Call AHT in Seconds','Quality Score in Percentage','Quality Auditor Remarks']);
export default function FieldEditor({spec,value,onChange}){
  const id='field-'+spec.internalName;
  const filled=Array.isArray(value)?value.length>0:String(value??'').trim()!=='';
  const provenance=rosterFields.has(spec.label)?'Roster':fromNotes.has(spec.label)?'Notes':filled?'Rule':'Review';
  const common={id,value:value??'',onChange:e=>onChange(e.target.value)};
  let control;
  if(spec.type==='MultiChoice') control=<details className="multi-dropdown" id={id}><summary>{(value||[]).length?(value||[]).join(', '):'Select all missed parameters'}</summary><div className="multi-options">{spec.choices.map(c=><label key={c} className="multi-option"><input type="checkbox" checked={(value||[]).includes(c)} onChange={e=>onChange(e.target.checked?[...(value||[]),c]:(value||[]).filter(x=>x!==c))}/><span>{c}</span></label>)}</div></details>;
  else if(spec.choices.length) control=<select {...common}><option value="">Select…</option>{spec.choices.map(c=><option key={c} value={c}>{c}</option>)}</select>;
  else if(spec.type==='Note') control=<textarea {...common} rows="3" placeholder="Enter the verified audit text"/>;
  else control=<input {...common} type={spec.type==='Number'?'number':'text'} step={spec.label==='Quality Score in Percentage'?'0.01':undefined} placeholder={spec.label==='Call Date'?'MM/DD/YYYY':'Enter value'}/>;
  return <div className="form-field">
    <div className="field-heading"><label htmlFor={id}>{spec.label}{spec.required&&spec.label!=='Call Event ID'&&<span className="required"> *</span>}</label><small>{spec.label==='Call Event ID'?'Optional here':provenance}</small></div>
    {spec.description&&<p className="field-description">{spec.description}</p>}
    {control}
  </div>;
}
