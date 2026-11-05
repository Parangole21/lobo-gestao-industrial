import test from 'node:test';
import assert from 'node:assert/strict';
import { LoboRemoteStore } from '../src/remote-store.js';
import { LoboIndustrialRepository } from '../src/industrial-repository.js';

function mockStore(responses) {
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async (url,options)=>{
    calls.push({url,options});
    const next=responses.shift();
    if (!next) throw Error('Resposta mock ausente');
    return {ok:next.status<400,status:next.status,text:async()=>JSON.stringify(next.body)};
  };
  const store=new LoboRemoteStore({url:'https://example.supabase.co',publishableKey:'public-key',getAccessToken:async()=> 'token'});
  return {store,calls,restore:()=>{globalThis.fetch=original}};
}

test('consulta lê diretamente da nuvem e não do navegador',async()=>{
  const m=mockStore([{status:200,body:[{id:'p1',data:{id:'p1',number:'MAL-0001'},updated_at:'2026-11-05T12:00:00Z'}]}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    const rows=await repo.list('fabric_purchases');
    assert.equal(rows[0].number,'MAL-0001');
    assert.equal(rows[0]._updatedAt,'2026-11-05T12:00:00Z');
    assert.match(m.calls[0].url,/fabric_purchases\?select=/);
  }finally{m.restore()}
});

test('inclusão aguarda confirmação do banco e envia autor',async()=>{
  const m=mockStore([{status:201,body:[{id:'p2'}]}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    await repo.create('fabric_purchases',{id:'p2',number:'MAL-0002'},'user-1');
    const sent=JSON.parse(m.calls[0].options.body);
    assert.equal(sent.updated_by,'user-1');
    assert.equal(sent.data.number,'MAL-0002');
    assert.equal(m.calls[0].options.method,'POST');
  }finally{m.restore()}
});

test('conflito de edição não é tratado como sucesso',async()=>{
  const m=mockStore([{status:200,body:[]}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    await assert.rejects(()=>repo.update('fabric_purchases',{id:'p1',number:'MAL-0001',_updatedAt:'2026-11-05T12:00:00Z'},'user-1'),/Conflito/);
    assert.match(m.calls[0].url,/updated_at=eq\./);
  }finally{m.restore()}
});

test('edição avança a versão para prevenir sobrescrita entre computadores',async()=>{
  const m=mockStore([{status:200,body:[{id:'p1',updated_at:'2026-11-05T13:00:00Z'}]}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    await repo.update('fabric_purchases',{id:'p1',number:'MAL-001',_updatedAt:'2026-11-05T12:00:00Z'},'user-1');
    const patch=JSON.parse(m.calls[0].options.body);
    assert.ok(Date.parse(patch.updated_at)>Date.parse('2026-11-05T12:00:00Z'));
    assert.equal(patch.updated_by,'user-1');
  }finally{m.restore()}
});

test('exclusão remota só confirma se uma linha foi excluída',async()=>{
  const m=mockStore([{status:200,body:[{id:'p1'}]}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    await repo.remove('fabric_purchases',{id:'p1',_updatedAt:'2026-11-05T12:00:00Z'});
    assert.equal(m.calls[0].options.method,'DELETE');
  }finally{m.restore()}
});

test('custos utilizam lot_id e não id',async()=>{
  const m=mockStore([{status:200,body:[{lot_id:'lot1'}]}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    await repo.remove('lot_costs',{id:'lot1',_updatedAt:'2026-11-05T12:00:00Z'});
    assert.match(m.calls[0].url,/lot_costs\?lot_id=eq\.lot1/);
  }finally{m.restore()}
});

test('movimentação usa created_by e UUID do banco',async()=>{
  const m=mockStore([{status:201,body:[{id:'a-valid-uuid',lot_id:'lot1'}]}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    await repo.addMovement({lot_id:'lot1',stage:'Corte'},'user-1');
    const sent=JSON.parse(m.calls[0].options.body);
    assert.equal(sent.created_by,'user-1');
    assert.equal(sent.id,undefined);
  }finally{m.restore()}
});

test('falha HTTP não é mascarada',async()=>{
  const m=mockStore([{status:403,body:{message:'RLS negou gravação'}}]);
  try{
    const repo=new LoboIndustrialRepository(m.store);
    await assert.rejects(()=>repo.create('fabric_purchases',{id:'p1'},'user-1'),/403/);
  }finally{m.restore()}
});
