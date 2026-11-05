// Auditoria estática sem dependências: node tests/audit-static.mjs
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8');
const backup=readFileSync('.github/workflows/supabase-backup.yml','utf8');
const checks=[
 ['login Supabase Auth',()=>assert.match(html,/\/auth\/v1\/token\?grant_type=password/)],
 ['chave pública e sem credencial administrativa no frontend',()=>{assert.match(html,/SUPABASE_PUBLISHABLE_KEY/);assert.doesNotMatch(html,/sb_secret_|service_role|postgresql:\/\//i)}],
 ['bloqueio visual quando desautenticado',()=>assert.match(html,/document\.body\.classList\.add\('auth-locked'\)/)],
 ['sincronização periódica',()=>assert.match(html,/setInterval\(\(\)=>/)],
 ['controle de atualização concorrente',()=>assert.match(html,/updated_at=eq\./)],
 ['backup agendado e manual',()=>{assert.match(backup,/cron:/);assert.match(backup,/workflow_dispatch:/)}],
 ['backup usa segredo e não senha fixa',()=>assert.match(backup,/secrets\.SUPABASE_DB_URL/)],
 ['backup exporta roles, schema e dados',()=>{for(const p of ['--role-only','--data-only','schema.sql'])assert.ok(backup.includes(p))}],
 ['backup criptografado AES256',()=>assert.match(backup,/--cipher-algo AES256/)],
 ['backup sem plaintext como artefato',()=>{assert.match(backup,/supabase-backup\.tar\.gz\.gpg/);assert.match(backup,/rm -f roles\.sql schema\.sql data\.sql/)}],
 ['retenção de 15 dias',()=>assert.match(backup,/retention-days: 15/)]
];
let failed=0;
for(const [name,run] of checks){try{run();console.log('PASS',name)}catch(e){failed++;console.error('FAIL',name,e.message)}}
console.log(`Resultado: ${checks.length-failed}/${checks.length} verificações estáticas aprovadas`);
if(failed)process.exitCode=1;
