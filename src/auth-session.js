/* Sessão por aba: armazena somente credenciais temporárias, nunca registros industriais. */
const KEY='lobo-industrial-auth-session-v1';
const EXPIRY_MARGIN_MS=60000;
export function readSession(){
 try{
  const s=JSON.parse(sessionStorage.getItem(KEY)||'null');
  if(!s||typeof s.access_token!=='string'||typeof s.user_id!=='string'||!Number.isFinite(s.expires_at)){sessionStorage.removeItem(KEY);return null}
  return s;
 }catch{sessionStorage.removeItem(KEY);return null}
}
export function saveSession(auth){
 if(!auth?.access_token||!auth?.user?.id)throw Error('Resposta de autenticação inválida');
 const ttl=Number(auth.expires_in||3600);
 if(!Number.isFinite(ttl)||ttl<=0)throw Error('Prazo de sessão inválido.');
 const s={access_token:auth.access_token,refresh_token:auth.refresh_token||'',user_id:auth.user.id,email:auth.user.email||'',expires_at:Date.now()+ttl*1000};
 sessionStorage.setItem(KEY,JSON.stringify(s));return s;
}
export function clearSession(){sessionStorage.removeItem(KEY)}
let refreshPromise=null;
export async function getValidSession(url,key){
 const s=readSession();if(!s)return null;
 if(s.expires_at>Date.now()+EXPIRY_MARGIN_MS)return s;
 if(!s.refresh_token){clearSession();return null}
 if(refreshPromise)return refreshPromise;
 refreshPromise=(async()=>{
  try{
   const response=await fetch(url+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:s.refresh_token}),cache:'no-store'
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.access_token)throw Error(data.message||'Falha ao renovar sessão.');
   if(data.user?.id!==s.user_id)throw Error('Identidade da sessão mudou.');
   return saveSession(data);
  }catch(err){clearSession();throw new Error('Sessão expirada. Entre novamente. '+err.message)}
  finally{refreshPromise=null}
 })();
 return refreshPromise;
}
export async function verifyAdminSession(url,key,session){
 if(!session?.access_token||!session?.user_id)throw Error('Sessão não autenticada.');
 const response=await fetch(url+'/rest/v1/profiles?select=active,role&user_id=eq.'+encodeURIComponent(session.user_id),{
 headers:{apikey:key,Authorization:'Bearer '+session.access_token},cache:'no-store'
 });
 if(!response.ok)throw Error('Não foi possível verificar a permissão de acesso.');
 const profiles=await response.json();
 if(profiles.length!==1||profiles[0].active!==true||profiles[0].role!=='admin')throw Error('Perfil sem autorização ativa.');
 return true;
}
