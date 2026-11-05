import { LoboRemoteStore } from './remote-store.js';

/**
 * Adaptador para o schema existente. NÃO sincroniza snapshots do navegador.
 * Esta implementação ainda precisa ser conectada às ações das telas.
 */
export class LoboIndustrialRepository {
  constructor(store) {
    if (!(store instanceof LoboRemoteStore)) throw new Error('Cliente remoto obrigatório.');
    this.store=store;
  }
  static entityTables=Object.freeze(['fabric_purchases','fabric_receipts','production_lots','fabric_cuts','lot_costs']);
  check(table) {
    if (!LoboIndustrialRepository.entityTables.includes(table)) throw new Error('Entidade inválida: '+table);
  }
  async list(table) {
    this.check(table);
    const rows=await this.store.list(table);
    if (!Array.isArray(rows)) throw new Error('Consulta inválida.');
    return rows.map(row=>({...row.data, id:table==='lot_costs'?row.lot_id:row.id, _updatedAt:row.updated_at}));
  }
  async create(table,entity,userId) {
    this.check(table);
    if (!userId) throw new Error('Identificação do usuário obrigatória.');
    const key=table==='lot_costs'?'lot_id':'id';
    const id=table==='lot_costs'?entity.lot_id||entity.id:entity.id;
    if (!id) throw new Error('Identificador obrigatório.');
    const { _updatedAt,...data }=entity;
    const row={ [key]:id, data, updated_by:userId };
    if (table==='fabric_receipts'||table==='fabric_cuts'||table==='production_lots') {
      const purchaseId=entity.purchase_id||entity.purchaseId||entity.parentId;
      if (!purchaseId) throw new Error('Vínculo com compra obrigatório.');
      row.purchase_id=purchaseId;
    }
    return this.store.create(table,row);
  }
  async update(table,entity,userId) {
    this.check(table);
    if (!userId) throw new Error('Identificação do usuário obrigatória.');
    const id=table==='lot_costs'?entity.lot_id||entity.id:entity.id;
    const {_updatedAt,...data}=entity;
    if (!id||!_updatedAt) throw new Error('ID e versão são obrigatórios para editar.');
    const patch={data,updated_by:userId};
    if (table==='fabric_receipts'||table==='fabric_cuts'||table==='production_lots') {
      const purchaseId=entity.purchase_id||entity.purchaseId||entity.parentId;
      if (!purchaseId) throw new Error('Vínculo com compra obrigatório.');
      patch.purchase_id=purchaseId;
    }
    return this.store.update(table,id,_updatedAt,patch);
  }
  async remove(table,entity) {
    this.check(table);
    const id=table==='lot_costs'?entity.lot_id||entity.id:entity.id;
    if (!id||!entity._updatedAt) throw new Error('ID e versão são obrigatórios para excluir.');
    return this.store.remove(table,id,entity._updatedAt);
  }
  async listMovements() { return this.store.list('lot_movements'); }
  async addMovement({lot_id,stage,occurred_at,note},userId) {
    if (!lot_id||!stage||!userId) throw new Error('Lote, etapa e usuário obrigatórios.');
    return this.store.create('lot_movements',{lot_id,stage,occurred_at:occurred_at||new Date().toISOString(),note:note||null,created_by:userId});
  }
}
