export function missingVerification(item, localOnly = false) {
  return {id:item.id,found:false,source:'none',verdict:'확인불가',officialRight:item.wrong,explain:'검증 응답을 받지 못해 원문을 유지합니다.',verificationFailed:true,localOnly};
}
export async function callAI(mode,text,contextBefore='',contextAfter='',options={}) {
  const response=await (options.fetcher||globalThis.fetch)('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,text,contextBefore,contextAfter,profile:options.profile||'fast'}),signal:options.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error){const error=new Error(data.error||('HTTP '+response.status));error.status=response.status;throw error;}
  const value=String(data.text||'');const a=value.indexOf('{'),b=value.lastIndexOf('}');
  if(a<0||b<=a)throw new Error('검사 결과 형식을 확인하지 못했습니다.');
  return JSON.parse(value.slice(a,b+1));
}
export async function verifyInBatches(stage,items,options={}) {
  const batches=[];for(let i=0;i<items.length;i+=6)batches.push(items.slice(i,i+6));
  const result=new Array(batches.length);let next=0;
  const worker=async()=>{while(next<batches.length){
    if(options.signal?.aborted)throw new DOMException('검사 취소','AbortError');
    const index=next++,batch=batches[index];let response=[];
    try{
      const res=await(options.fetcher||globalThis.fetch)('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,items:batch}),signal:options.signal});
      const data=await res.json();
      if(!res.ok||data.error||!Array.isArray(data.items))throw new Error('자료 대조 실패');
      response=data.items;
    }catch(error){if(options.signal?.aborted||error?.name==='AbortError')throw error;}
    result[index]=batch.map(item=>{const matches=response.filter(v=>v&&String(v.id)===String(item.id));return matches.length===1?{...matches[0],id:item.id,localOnly:stage==='local'}:missingVerification(item,stage==='local');});
    options.onBatch?.(result[index]);
  }};
  await Promise.all(Array.from({length:Math.min(3,batches.length)},worker));return result.flat();
}
export function applyVerifiedEdits(original,errors,map) {
  return errors.map(err=>{
    if(err.manual)return err;
    const valid=Number.isInteger(err.start)&&Number.isInteger(err.end)&&err.start>=0&&err.end>err.start&&err.end<=original.length&&original.slice(err.start,err.end)===err.wrong&&!err.overlap;
    if(!valid)return{...err,status:'needs_review'};
    const v=map[err.id];
    if(!v||v.source!=='nikl'||v.found!==true)return{...err,status:'needs_review'};
    if(v.verdict==='일치'&&v.officialRight===err.right)return{...err,status:'applied'};
    if(v.verdict==='둘다가능')return{...err,status:'kept'};
    if((v.verdict==='AI교정틀림'||v.verdict==='부분')&&typeof v.officialRight==='string'&&v.officialRight.trim()&&!/[\/\n\r]/.test(v.officialRight)&&!/\s또는\s/.test(v.officialRight)){
      if(v.officialRight===err.wrong)return{...err,status:'kept'};
      return{...err,aiRight:err.right,right:v.officialRight,status:'applied'};
    }
    return{...err,status:'needs_review'};
  });
}
