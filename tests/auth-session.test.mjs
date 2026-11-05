import test from 'node:test';
import assert from 'node:assert/strict';
import {readSession,saveSession,clearSession,getValidSession,verifyAdminSession} from '../src/auth-session.js';
const values=new Map();
globalThis.sessionStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
const url='https://example.supabase.co',key='public-key';
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('guarda apenas sessão de autenticação e recupera a mesma conta',()=>{
 clearSession();const s=saveSession({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'admin-1',email:'admin@exemplo.com'}});
 assert.equal(readSession().user_id,'admin-1');assert.equal(readSession().access_token,'access');assert.equal(s.email,'admin@exemplo.com');clearSession();assert.equal(readSession(),null);
});
test('não renova token válido',async()=>{
 clearSession();saveSession({access_token:'valid',refresh_token:'refresh',expires_in:3600,user:{id:'admin-1'}});
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('não deveria consultar rede')};
 try{assert.equal((await getValidSession(url,key)).access_token,'valid')}finally{globalThis.fetch=old;clearSession()}
});
test('renova sessão expirada e mantém identidade',async()=>{
 clearSession();saveSession({access_token:'old',refresh_token:'refresh',expires_in:0.001,user:{id:'admin-1'}});
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(u,opts)=>{calls++;assert.match(u,/refresh_token/);assert.equal(JSON.parse(opts.body).refresh_token,'refresh');return response({access_token:'new',refresh_token:'new-refresh',expires_in:3600,user:{id:'admin-1'}})};
 try{const [a,b]=await Promise.all([getValidSession(url,key),getValidSession(url,key)]);assert.equal(a.access_token,'new');assert.equal(b.access_token,'new');assert.equal(calls,1)}finally{globalThis.fetch=old;clearSession()}
});
test('rejeita renovação com identidade diferente',async()=>{
 clearSession();saveSession({access_token:'old',refresh_token:'refresh',expires_in:0.001,user:{id:'admin-1'}});
 const old=globalThis.fetch;globalThis.fetch=async()=>response({access_token:'wrong',refresh_token:'refresh2',expires_in:3600,user:{id:'other'}});
 try{await assert.rejects(getValidSession(url,key),/Sessão expirada/);assert.equal(readSession(),null)}finally{globalThis.fetch=old;clearSession()}
});
test('bloqueia perfil inativo mesmo com token válido',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>response([{active:false,role:'admin'}]);
 try{await assert.rejects(verifyAdminSession(url,key,{access_token:'token',user_id:'admin-1'}),/sem autorização/)}finally{globalThis.fetch=old}
});
test('autoriza somente perfil administrador ativo',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>response([{active:true,role:'admin'}]);
 try{assert.equal(await verifyAdminSession(url,key,{access_token:'token',user_id:'admin-1'}),true)}finally{globalThis.fetch=old}
});
