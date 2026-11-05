import { LoboRemoteStore } from './remote-store.js';
import { LoboIndustrialRepository } from './industrial-repository.js';

/**
 * Fachada cloud-first para telas novas: o navegador não é banco de dados.
 * Leituras sempre consultam Supabase. Escritas aguardam confirmação remota.
 */
export class LoboCloudController {
  constructor({url,publishableKey,getAccessToken,getUserId}) {
    this.store=new LoboRemoteStore({url,publishableKey,getAccessToken});
    this.repo=new LoboIndustrialRepository(this.store);
    this.getUserId=getUserId;
  }
  async list(table) { return this.repo.list(table); }
  async save(table,record) {
    if (!record || typeof record!=='object') throw new Error('Registro inválido.');
    const userId=await this.getUserId();
    if (!userId) throw new Error('Entre no sistema novamente.');
    if (record._updatedAt) return this.repo.update(table,record,userId);
    return this.repo.create(table,record,userId);
  }
  async remove(table,record) { return this.repo.remove(table,record); }
  async reloadAll() {
    const tables=LoboIndustrialRepository.entityTables;
    const pairs=await Promise.all(tables.map(async table=>[table,await this.list(table)]));
    const result=Object.fromEntries(pairs);
    result.lot_movements=await this.repo.listMovements();
    return result;
  }
  async addMovement(movement) {
    const userId=await this.getUserId();
    if (!userId) throw new Error('Entre no sistema novamente.');
    return this.repo.addMovement(movement,userId);
  }
}
