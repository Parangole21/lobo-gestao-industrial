/* Lobo Industrial — camada remota (etapa 1, não integrada à produção).
 * Supabase é a fonte única; este módulo NÃO lê nem sincroniza localStorage.
 * Usa token de sessão do Supabase Auth fornecido pelo chamador.
 */
export class LoboRemoteStore {
  constructor({url, publishableKey, getAccessToken}) {
    if (!url || !publishableKey || typeof getAccessToken !== 'function') throw new Error('Configuração incompleta.');
    this.url = url.replace(/\/$/, '');
    this.publishableKey = publishableKey;
    this.getAccessToken = getAccessToken;
  }
  static tables = Object.freeze(['fabric_purchases','fabric_receipts','production_lots','fabric_cuts','lot_movements','lot_costs']);
  // lot_costs usa lot_id na versão atual; demais tabelas usam id.
  static keys = Object.freeze({fabric_purchases:'id',fabric_receipts:'id',production_lots:'id',fabric_cuts:'id',lot_movements:'id',lot_costs:'lot_id'});
  checkTable(table) {
    if (!LoboRemoteStore.tables.includes(table)) throw new Error('Tabela não permitida: '+table);
  }
  async request(table, method, query='', data) {
    this.checkTable(table);
    const token = await this.getAccessToken();
    if (!token) throw new Error('Sessão expirada. Entre novamente antes de alterar dados.');
    const response = await fetch(this.url+'/rest/v1/'+table+query,{
      method,
      headers: {apikey:this.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json',Prefer:'return=representation'},
      ...(data === undefined ? {} : {body:JSON.stringify(data)}),
      cache:'no-store'
    });
    const raw=await response.text();
    let result;try{result=raw?JSON.parse(raw):null}catch{result=raw}
    if(!response.ok)throw new Error('Falha ao salvar no banco ('+response.status+'): '+(result?.message||result?.details||raw));
    return result;
  }
  async list(table) { return this.request(table,'GET','?select=*&limit=10000'); }
  key(table) { this.checkTable(table); return LoboRemoteStore.keys[table]; }
  async get(table,id) {
    const rows=await this.request(table,'GET','?'+this.key(table)+'=eq.'+encodeURIComponent(id)+'&select=*&limit=1');
    return rows[0]||null;
  }
  async create(table,record) {
    if(table==='lot_movements') {
      if(!record?.lot_id||!record?.stage)throw new Error('Movimentação exige lote e etapa.');
      if(record?.id && typeof record.id !== 'string')throw new Error('ID de movimentação inválido.');
    } else if(!record?.[this.key(table)])throw new Error('Identificador obrigatório para inclusão idempotente.');
    const result=await this.request(table,'POST','',record);
    if(result?.length!==1)throw new Error('Inclusão não confirmada pelo banco.');
    return result[0];
  }
  async update(table,id,updatedAt,patch) {
    if(table==='lot_movements') throw new Error('Movimentações são eventos: não é permitida edição por este método.');
    if(!updatedAt)throw new Error('Versão anterior obrigatória para edição segura.');
    const q='?'+this.key(table)+'=eq.'+encodeURIComponent(id)+'&updated_at=eq.'+encodeURIComponent(updatedAt);
    const result=await this.request(table,'PATCH',q,patch);
    if(result?.length!==1)throw new Error('Conflito: registro alterado ou excluído em outro computador. Recarregue antes de editar.');
    return result[0];
  }
  async remove(table,id,updatedAt) {
    if(table==='lot_movements') throw new Error('Movimentações exigem política de exclusão própria.');
    if(!updatedAt)throw new Error('Versão anterior obrigatória para exclusão segura.');
    const q='?'+this.key(table)+'=eq.'+encodeURIComponent(id)+'&updated_at=eq.'+encodeURIComponent(updatedAt);
    const result=await this.request(table,'DELETE',q);
    if(result?.length!==1)throw new Error('Conflito: registro alterado ou excluído em outro computador. Recarregue antes de excluir.');
    return result[0];
  }
}
