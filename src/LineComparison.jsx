import React,{useState} from 'react';

const colors=['#0c9e94','#2275b7','#e6a349','#8c69bb','#d77074','#477a50','#af6998','#427e96','#9d6a37','#555fa8','#ce7b52','#5b9183'];
const shortMonth=month=>new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined,{month:'short'});
const format=(value,unit)=>unit==='%'?`${value.toFixed(1)}%`:String(value);

export default function LineComparison({title,subtitle,series,unit,year}){
  const [hidden,setHidden]=useState([]);
  const visible=series.filter(item=>!hidden.includes(item.name));
  const values=visible.flatMap(item=>item.points.map(point=>point.value).filter(value=>value!==null));
  const hasData=values.length>0;
  const hasSavedData=series.some(item=>item.points.some(point=>point.value!==null));
  const min=unit==='%'&&hasData?Math.max(0,Math.floor(Math.min(...values)/5)*5-5):0;
  const max=unit==='%'?100:Math.max(2,Math.ceil(Math.max(0,...values)/2)*2);
  const left=48,top=14,width=654,height=196;
  const x=index=>left+index*width/11;
  const y=value=>top+(max-value)/(max-min)*height;
  const ticks=unit==='%'?[min,(min+max)/2,max]:[0,max/2,max];
  function toggle(name){setHidden(old=>old.includes(name)?old.filter(item=>item!==name):[...old,name])}
  return <section className="panel chart-panel comparison-panel">
    <h2>{title}</h2><p>{subtitle} · {year}</p>
    {hasData?<svg className="line-chart" viewBox="0 0 720 252" role="img" aria-label={`${title} for ${year}. Select View exact values below for a table.`}>
      {ticks.map((tick,index)=><g key={index}><line x1={left} x2={left+width} y1={y(tick)} y2={y(tick)} className="chart-gridline"/><text x={left-7} y={y(tick)+4} textAnchor="end" className="chart-axis-label">{unit==='%'?`${Number(tick.toFixed(1))}%`:tick}</text></g>)}
      {series[0]?.points.map((point,index)=><text key={point.month} x={x(index)} y={top+height+27} textAnchor="middle" className="chart-axis-label">{shortMonth(point.month)}</text>)}
      {visible.map(item=>{
        const color=colors[series.indexOf(item)%colors.length];
        const chunks=[];let current=[];
        item.points.forEach((point,index)=>{if(point.value===null){if(current.length)chunks.push(current);current=[]}else current.push([x(index),y(point.value)])});
        if(current.length)chunks.push(current);
        return <g key={item.name}>{chunks.filter(chunk=>chunk.length>1).map((chunk,index)=><polyline key={index} points={chunk.map(pair=>pair.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>)}{item.points.map((point,index)=>point.value===null?null:<circle key={point.month} cx={x(index)} cy={y(point.value)} r="4" fill={color} stroke="white" strokeWidth="1.5"><title>{`${item.name} · ${shortMonth(point.month)} ${year}: ${format(point.value,unit)}${unit==='%'?` from ${point.count} audit${point.count===1?'':'s'}`:` · ${point.count} occurrence${point.count===1?'':'s'}`}`}</title></circle>)}</g>
      })}
    </svg>:<div className="chart-empty">{hasSavedData?'All series are hidden. Select a name below to show it.':`No saved ${unit==='%'?'scores':'markdowns'} for ${year}.`}</div>}
    {!!series.length&&<><div className="comparison-legend" aria-label={`${title} series`}>{series.map((item,index)=><button type="button" key={item.name} className={hidden.includes(item.name)?'muted':''} aria-pressed={!hidden.includes(item.name)} onClick={()=>toggle(item.name)} title={item.name}><i style={{background:colors[index%colors.length]}}/>{item.name}</button>)}</div><details className="comparison-values"><summary>View exact monthly values</summary><div className="table-scroll"><table><thead><tr><th>Series</th>{series[0].points.map(point=><th key={point.month}>{shortMonth(point.month)}</th>)}</tr></thead><tbody>{series.map(item=><tr key={item.name}><th scope="row">{item.name}</th>{item.points.map(point=><td key={point.month}>{point.value===null?'—':format(point.value,unit)}</td>)}</tr>)}</tbody></table></div></details></>}
  </section>;
}
