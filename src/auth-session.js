/* Sessão por aba: somente token de autenticação, nunca registros industriais.
 * O Supabase continua sendo a fonte única dos dados de produção.
 */
const KEY='lobo-industrial-auth-session-v1';
export function readSession(){
 try{
  const s=JSON.parse(sessionStorage.getItem(KEY)||'null');
  if(!s||typeof s.access_token!=='string'||typeof s.user_id!=='string'||!Number.isFinite(s.expires_at))return null;
  if(s.expires_at<=Date.now()+60000){sessionStorage.removeItem(KEY);return null}
  return s;
 }catch{sessionStorage.removeItem(KEY);return null}
}
export function saveSession(auth){
 if(!auth?.access_token||!auth?.user?.id)throw Error('Resposta de autenticação inválida');
 const s={access_token:auth.access_token,user_id:auth.user.id,email:auth.user.email||'',expires_at:Date.now()+Number(auth.expires_in||3600)*1000};
 sessionStorage.setItem(KEY,JSON.stringify(s));return s;
}
export function clearSession(){sessionStorage.removeItem(KEY)}
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
