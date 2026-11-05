import test from 'node:test';
import assert from 'node:assert/strict';
import { LoboCloudController } from '../src/cloud-controller.js';

const url='https://example.supabase.co';
function mockServer(){
 const tables=new Map([['fabric_purchases',new Map()]]);
 const old=globalThis.fetch;
 const requests=[];
 globalThis.fetch=async (uri,options)=>{
  requests.push({uri,method:options.method});
  const u=new URL(uri),table=u.pathname.split('/').pop(),records=tables.get(table);
  if(!records)return {ok:false,status:404,text:async()=>JSON.stringify({message:'Tabela desconhecida'})};
  const id=u.searchParams.get('id')?.replace(/^eq\./,'');
  const version=u.searchParams.get('updated_at')?.replace(/^eq\./,'');
  let body=[],status=200;
  if(options.method==='GET')body=id?(records.has(id)?[records.get(id)]:[]):[...records.values()];
  if(options.method==='POST'){
   const r=JSON.parse(options.body);
   if(records.has(r.id)){status=409;body={message:'duplicado'}}
   else{const row={...r,updated_at:'2026-11-05T10:00:00.000Z'};records.set(r.id,row);body=[row];status=201}
  }
  if(options.method==='PATCH'){
   const current=records.get(id);
   if(current&&current.updated_at===version){const patch=JSON.parse(options.body);const row={...current,...patch};records.set(id,row);body=[row]}
  }
  if(options.method==='DELETE'){
   const current=records.get(id);
   if(current&&current.updated_at===version){records.delete(id);body=[current]}
  }
  return {ok:status<400,status,text:async()=>JSON.stringify(body)};
 };
 return {tables,requests,restore:()=>{globalThis.fetch=old}};
}
function controller(){return new LoboCloudController({url,publishableKey:'public',getAccessToken:async()=> 'token',getUserId:async()=> 'admin-1'})}
test('cadastro no banco aparece em outra instância e exclusão não ressuscita',async()=>{
 const server=mockServer();
 try{
  const pc1=controller(),pc2=controller();
  assert.deepEqual(await pc1.list('fabric_purchases'),[]);
  await pc1.save('fabric_purchases',{id:'p1',number:'LOTE-1',kg:200});
  assert.equal((await pc2.list('fabric_purchases'))[0].number,'LOTE-1');
  const fromPc2=(await pc2.list('fabric_purchases'))[0];
  await pc2.remove('fabric_purchases',fromPc2);
  assert.deepEqual(await pc1.list('fabric_purchases'),[]);
  assert.deepEqual(await pc2.list('fabric_purchases'),[]);
 }finally{server.restore()}
});
test('edição com versão antiga não sobrescreve o banco',async()=>{
 const server=mockServer();
 try{
  const pc1=controller(),pc2=controller();
  await pc1.save('fabric_purchases',{id:'p2',number:'A'});
  const a=(await pc1.list('fabric_purchases'))[0],b=(await pc2.list('fabric_purchases'))[0];
  await pc1.save('fabric_purchases',{...a,number:'B'});
  await assert.rejects(pc2.save('fabric_purchases',{...b,number:'C'}),/Conflito/);
  assert.equal((await pc1.list('fabric_purchases'))[0].number,'B');
 }finally{server.restore()}
});
test('repetir cadastro com mesmo ID não duplica registros',async()=>{
 const server=mockServer();
 try{
  const pc=controller();
  await pc.save('fabric_purchases',{id:'p3',number:'A'});
  await assert.rejects(pc.save('fabric_purchases',{id:'p3',number:'A'}),/409/);
  assert.equal((await pc.list('fabric_purchases')).length,1);
 }finally{server.restore()}
});
