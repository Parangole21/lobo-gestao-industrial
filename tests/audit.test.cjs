const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = process.env.LOBO_HTML || path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(file, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
function harness() {
 const nodes = new Map(), storage = new Map(), alerts = [], requests=[];
 class Node {
  constructor(id){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.style={};this.dataset={};this.disabled=false;this.checked=false;this.children=new Map();this.classes=new Set();this.classList={add:(x)=>this.classes.add(x),remove:(x)=>this.classes.delete(x),toggle:(x,b)=>b===undefined?(this.classes.has(x)?this.classes.delete(x):this.classes.add(x)):(b?this.classes.add(x):this.classes.delete(x))};}
  addEventListener(){} setAttribute(){} scrollIntoView(){} focus(){} reset(){} click(){} replaceChildren(){}
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node(selector));return this.children.get(selector);}
  querySelectorAll(){return [];} closest(){return null;}
 }
 const el = id => {if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const context = {console,Intl,Date,Number,JSON,Map,Set,URL,Blob,Math,Promise,
  crypto:{randomUUID:()=>`id-${++context.seq}`},seq:0,
  document:{getElementById:el,querySelector:el,querySelectorAll:()=>[],body:new Node('body'),addEventListener(){},visibilityState:'visible',createElement:()=>new Node('created')},
  window:{addEventListener(){},scrollTo(){}},history:{state:null,replaceState(){},pushState(){}},location:{href:'https://example.test/'},
  HTMLFormElement:{prototype:{reset(){}}},MutationObserver:class {observe(){}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,
  alert:m=>alerts.push(m),confirm:()=>true,
  fetch:async(url,options={})=>{requests.push({url,options});return {ok:true,status:200,json:async()=>[]};}
 };
 vm.createContext(context);vm.runInContext(script,context,{timeout:5000});
 return {context,el,nodes,storage,alerts,requests,run:code=>vm.runInContext(code,context),seed(data){context.seedData=structuredClone(data);vm.runInContext('for(const [k,v] of Object.entries(seedData))eval(k+"=seedData[k]")',context);}};
}
function item(id,value,qty,mode='individual'){return {id,label:id,value,qty,mode,total:Math.round((mode==='total'?value:value*qty)*100)/100};}
function setupCost(h,{history=[],good=90,damaged=5,pending=5}={}){
 h.seed({lots:[{id:'l1',quantity:100}],costData:{l1:{good,damaged,pending,history,items:history.at(-1)?.items||[]}}});
 h.el('cost-lot').value='l1';h.el('cost-good').value=String(good);h.el('cost-damaged').value=String(damaged);h.el('cost-pending').value=String(pending);
 h.context.mockItems=[item('malha',1000,0,'total'),item('costura',3,100),item('tag',0.5,good)];
 h.run('costModes=()=>COST_ITEMS.map(([id,label,mode])=>mockItems.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});calculateCost=()=>{};loadCost=()=>{}');
}
function clickSave(h){h.el('cost-save').onclick();}
function state(h){return JSON.parse(h.run('JSON.stringify({parents,records,cuts,lots,costData})'));}

test('complete script initializes without runtime errors',()=>{const h=harness();assert.equal(h.el('cloud-login-modal').style.display,undefined);});
test('money rounds each service subtotal to cents',()=>{const h=harness();assert.equal(h.run("costItemTotal('individual',0.1,3)"),0.3);assert.equal(h.run("costItemTotal('individual',1.005,1)"),1.01);assert.equal(h.run("costItemTotal('total',10.25,999)"),10.25);});
test('cut yield and available pieces use totals, not average yields',()=>{const h=harness();h.seed({cuts:[{parentId:'p',kg:20,pieces:80},{parentId:'p',kg:30,pieces:150}],lots:[{id:'a',parentId:'p',quantity:100},{id:'b',parentId:'p',quantity:50}]});assert.equal(h.run("cutPieces('p')"),230);assert.equal(h.run("availablePieces('p')"),80);assert.equal(h.run("availablePieces('p','a')"),180);});
test('stock uses received kg minus all cuts',()=>{const h=harness();h.seed({records:[{purchaseId:'p',materials:{malha:{kg:200}}}],cuts:[{parentId:'p',kg:40},{parentId:'p',kg:60}]});assert.equal(h.run("cutStock({id:'p'})"),100);});
test('first cost: fabric plus work on every cut piece plus tags on good pieces',()=>{const h=harness();setupCost(h);clickSave(h);const d=state(h).costData.l1;assert.equal(d.history.length,1);assert.equal(d.history[0].total,1345);assert.equal(h.run('costTotal(costData.l1)'),1345);assert.equal(d.good+d.damaged+d.pending,100);});
test('saving the same cost again updates its card without double charging',()=>{const h=harness();setupCost(h);clickSave(h);clickSave(h);const d=state(h).costData.l1;assert.equal(d.history.length,1);assert.equal(h.run('costTotal(costData.l1)'),1345);});
test('legacy repeated snapshots are revisions, not separate full-lot charges',()=>{const h=harness();h.context.example={history:[{total:1000},{total:1100,complements:[{additional:20}]}]};assert.equal(h.run('costTotal(example)'),1120);});
test('negative costs are rejected',()=>{const h=harness();setupCost(h);h.context.mockItems=[item('malha',-10,0,'total')];clickSave(h);assert.equal(state(h).costData.l1.history.length,0);assert.match(h.alerts.at(-1),/valores/);});
test('classified cost quantity can differ from the planned brand quantity',()=>{const h=harness();setupCost(h);h.el('cost-good').value='91';clickSave(h);assert.equal(state(h).costData.l1.history.length,1);assert.equal(state(h).costData.l1.good,91);assert.equal(state(h).lots[0].quantity,100);assert.equal(h.alerts.length,0);});
test('fractional piece counts are rejected',()=>{const h=harness();setupCost(h);h.el('cost-good').value='89.5';clickSave(h);assert.equal(state(h).costData.l1.history.length,0);assert.match(h.alerts.at(-1),/inteiras/);});
test('cost service quantity can exceed the brand lot',()=>{const h=harness();setupCost(h);h.context.mockItems=[item('costura',3,101)];clickSave(h);assert.equal(state(h).costData.l1.history.length,1);assert.equal(h.run('costTotal(costData.l1)'),303);assert.equal(state(h).lots[0].quantity,100);assert.equal(h.alerts.length,0);});
test('pending complement increases good pieces and only adds new spending',()=>{const h=harness();setupCost(h);clickSave(h);h.context.mockExtra=[item('tag',0.5,5)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();const d=state(h).costData.l1;assert.equal(d.good,95);assert.equal(d.pending,0);assert.equal(d.damaged,5);assert.equal(d.history.length,1);assert.equal(h.run('costTotal(costData.l1)'),1347.5);});
test('damage recovery decreases damaged count and preserves total pieces',()=>{const h=harness();setupCost(h);clickSave(h);h.context.mockExtra=[item('tag',0.5,5)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=true');h.el('extra-recovered').value='5';h.el('extra-save').onclick();const d=state(h).costData.l1;assert.equal(d.good,95);assert.equal(d.pending,5);assert.equal(d.damaged,0);assert.equal(d.good+d.pending+d.damaged,100);assert.equal(h.run('costTotal(costData.l1)'),1347.5);});
test('complement cannot recover more pieces than the pending balance',()=>{const h=harness();setupCost(h);clickSave(h);h.context.mockExtra=[];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='6';h.el('extra-save').onclick();assert.equal(state(h).costData.l1.good,90);assert.match(h.alerts.at(-1),/de 1 a 5/);});
test('editing the latest complement adjusts cost and pieces without duplication',()=>{const h=harness();setupCost(h);clickSave(h);h.context.mockExtra=[item('tag',0.5,5)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();h.run('editingCostComplement={i:0,j:0}');h.el('cost-complement-recovered').value='3';h.context.mockItems=[item('tag',0.5,3)];clickSave(h);const d=state(h).costData.l1;assert.equal(d.good,93);assert.equal(d.pending,2);assert.equal(d.history[0].complements.length,1);assert.equal(h.run('costTotal(costData.l1)'),1346.5);});
test('cost with zero good pieces never divides by zero',()=>{const h=harness();h.seed({lots:[{id:'l1',quantity:100}],costData:{}});h.el('cost-lot').value='l1';h.context.mockItems=[];h.run('costModes=()=>mockItems;calculateCost()');assert.equal(h.el('cost-unit').textContent,'—');});
test('indicators and cost summary use the same latest cost and complements',()=>{const h=harness();h.seed({parents:[],cuts:[],lots:[{id:'l1',quantity:100,status:'Costura',brand:'A'}],costData:{l1:{good:95,damaged:5,pending:0,items:[{total:99999}],history:[{total:1000},{total:1345,complements:[{additional:2.5}]}]}}});h.run('renderIndicators()');assert.match(h.el('ind-kpis').innerHTML,/1\.347,50/);assert.match(h.el('ind-cost-rows').innerHTML,/1\.347,50/);assert.doesNotMatch(h.el('ind-kpis').innerHTML,/99\.999/);});
test('weighted cost per good piece, damage percentage and delivered totals',()=>{const h=harness();h.seed({parents:[],cuts:[],lots:[{id:'a',quantity:100,status:'Entregue',brand:'A'},{id:'b',quantity:200,status:'Costura',brand:'B'}],costData:{a:{good:90,damaged:10,pending:0,history:[{total:900}]},b:{good:180,damaged:10,pending:10,history:[{total:1800}]}}});h.run('renderIndicators()');assert.match(h.el('ind-kpis').innerHTML,/Peças programadas<\/span><strong>300/);assert.match(h.el('ind-kpis').innerHTML,/Peças entregues<\/span><strong>100/);assert.match(h.el('ind-kpis').innerHTML,/6,7%/);assert.match(h.el('ind-kpis').innerHTML,/10,00/);});
test('on-time delivery includes the final millisecond of its deadline',()=>{const h=harness();h.context.testLot={id:'l',status:'Entregue',quantity:10,productionStart:'2026-11-01',productionEnd:'2026-11-05',history:[{status:'Entregue',at:new Date('2026-11-05T23:59:59.999').toISOString()}]};h.run('renderIndicatorTimes([testLot],new Date())');assert.match(h.el('ind-efficiency').innerHTML,/100,0%/);assert.match(h.el('ind-delivery-rows').innerHTML,/No prazo/);});
test('deleting receipt linked by purchaseId is blocked when cuts exist',async()=>{const h=harness();h.seed({records:[{id:'r1',purchaseId:'p1'}],cuts:[{id:'c1',parentId:'p1',kg:10,pieces:40}]});const button={dataset:{delete:'r1'}};await h.el('rows').onclick({target:{closest:s=>s==='[data-delete]'?button:null}});assert.equal(state(h).records.length,1);assert.match(h.alerts.at(-1),/vinculado/);assert.equal(h.requests.length,0);});
test('editing a fully consumed cut restores its selected purchase',async()=>{const h=harness();h.seed({parents:[{id:'p',kg:100}],records:[{purchaseId:'p',materials:{malha:{kg:100}}}],cuts:[{id:'c',parentId:'p',kg:100,pieces:400,date:'2026-11-05'}]});const b={dataset:{cutEdit:'c'}};await h.el('cut-list').onclick({target:{closest:()=>b}});assert.equal(h.el('cut-parent').value,'p');assert.match(h.el('cut-stock-info').textContent,/100 kg/);});
test('purchase editing keeps delivery status and rejects kg below receipts',()=>{const h=harness();h.seed({parents:[{id:'p',number:'MAL-0001',kg:200,deliveryStatus:'Em rota de entrega'}],records:[{purchaseId:'p',materials:{malha:{kg:100}}}]});h.run("editingParent='p'");h.el('parent-kg-input').value='50';h.el('parent-form').onsubmit({preventDefault(){}});assert.equal(state(h).parents[0].kg,200);h.el('parent-kg-input').value='150';h.el('parent-form').onsubmit({preventDefault(){}});assert.equal(state(h).parents[0].kg,150);assert.equal(state(h).parents[0].deliveryStatus,'Em rota de entrega');});
test('purchase input rejects infinity and negative order values',()=>{const h=harness();h.el('parent-kg-input').value='Infinity';h.el('parent-form').onsubmit({preventDefault(){}});assert.equal(state(h).parents.length,0);h.el('parent-kg-input').value='100';h.el('parent-order-value').value='-1';h.el('parent-form').onsubmit({preventDefault(){}});assert.equal(state(h).parents.length,0);});
test('cut larger than received kg is rejected',()=>{const h=harness();h.seed({parents:[{id:'p',kg:100}],records:[{purchaseId:'p',materials:{malha:{kg:20}}}]});h.el('cut-parent').value='p';h.el('cut-kg').value='21';h.el('cut-pieces').value='84';h.el('cut-form').onsubmit({preventDefault(){}});assert.equal(state(h).cuts.length,0);assert.match(h.alerts.at(-1),/Estoque insuficiente/);});
test('brand quantity can exceed remaining cut pieces without changing the cut count',()=>{const h=harness();h.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}],lots:[{id:'old',parentId:'p',quantity:80}]});h.el('child-parent-select').value='p';h.el('child-quantity').value='21';h.el('child-form').onsubmit({preventDefault(){}});assert.equal(state(h).lots.length,2);assert.equal(state(h).lots[1].quantity,21);assert.equal(h.run("availablePieces('p')"),-1);assert.equal(h.run("cutPieces('p')"),100);assert.equal(h.alerts.length,0);});
test('invalid complete backup never replaces loaded collections',async()=>{const h=harness();h.seed({parents:[{id:'keep'}],records:[{id:'rkeep'}]});const invalid=JSON.stringify({application:'lobo-industrial-v5',records:[{id:'bad'}],lots:[],parents:[{id:'bad'}]});await h.el('lot-import').onchange({target:{files:[{text:async()=>invalid}],value:'x'}});assert.equal(state(h).parents[0].id,'keep');assert.equal(state(h).records[0].id,'rkeep');});
test('retry button hidden when healthy and visible on error until successful retry',async()=>{const h=harness();h.run('refreshCloudSyncAlert()');assert.equal(h.el('cloud-sync-btn').classes.has('sync-retry'),false);h.el('cloud-sync-message').textContent='Falha ao sincronizar';h.run('refreshCloudSyncAlert()');assert.equal(h.el('cloud-sync-btn').classes.has('sync-retry'),true);h.el('cloud-sync-message').textContent='Sincronizando custos...';h.run('refreshCloudSyncAlert()');assert.equal(h.el('cloud-sync-btn').classes.has('sync-retry'),true);h.run("cloudSession={access_token:'test'};cloudSyncMaterials=async()=>{$('cloud-sync-message').textContent='Concluído'};cloudSyncCuts=cloudSyncMaterials;cloudSyncLots=cloudSyncMaterials;cloudSyncCosts=cloudSyncMaterials");await h.run('cloudSyncAll(true)');assert.equal(h.el('cloud-sync-btn').classes.has('sync-retry'),false);assert.equal(h.el('sync-problem-banner').style.display,'none');});
test('sync stops on an error and retains retry button',async()=>{const h=harness();h.context.order=[];h.run("cloudSession={access_token:'test'};cloudSyncMaterials=async()=>{order.push('materials');$('cloud-sync-message').textContent='Concluído'};cloudSyncCuts=async()=>{order.push('cuts');$('cloud-sync-message').textContent='Falha no corte'};cloudSyncLots=async()=>order.push('lots');cloudSyncCosts=async()=>order.push('costs')");await h.run('cloudSyncAll(true)');assert.deepEqual(h.context.order,['materials','cuts']);assert.equal(h.el('cloud-sync-btn').classes.has('sync-retry'),true);});
test('sync order respects dependencies: materials, cuts, brands, costs',async()=>{const h=harness();h.context.order=[];h.run("cloudSession={access_token:'test'};cloudSyncMaterials=async()=>{order.push('materials');$('cloud-sync-message').textContent='Concluído'};cloudSyncCuts=async()=>{order.push('cuts');$('cloud-sync-message').textContent='Concluído'};cloudSyncLots=async()=>{order.push('lots');$('cloud-sync-message').textContent='Concluído'};cloudSyncCosts=async()=>{order.push('costs');$('cloud-sync-message').textContent='Concluído'}");await h.run('cloudSyncAll(true)');assert.deepEqual(h.context.order,['materials','cuts','lots','costs']);});
test('cloud reads paginate beyond 1000 rows and order by the proper primary key',async()=>{const h=harness();const rows=Array.from({length:1201},(_,i)=>({id:String(i)}));h.context.fetch=async(url)=>{const u=new URL(url);const offset=Number(u.searchParams.get('offset'));assert.equal(u.searchParams.get('order'),'id.asc');return {ok:true,json:async()=>rows.slice(offset,offset+500)}};h.run("cloudSession={access_token:'test'};ensureCloudSession=async()=>{}");const result=await h.run("cloudMaterialsRequest('fabric_purchases','GET')");assert.equal(result.length,1201);assert.equal(result[1200].id,'1200');h.context.fetch=async(url)=>{assert.equal(new URL(url).searchParams.get('order'),'lot_id.asc');return {ok:true,json:async()=>[]}};await h.run("cloudMaterialsRequest('lot_costs','GET')");});
test('pagination failure is surfaced instead of returning an incomplete dataset',async()=>{const h=harness();let n=0;h.context.fetch=async()=>++n===1?{ok:true,json:async()=>Array.from({length:500},(_,i)=>({id:i}))}:{ok:false,status:403,json:async()=>({message:'denied'})};h.run("cloudSession={access_token:'test'};ensureCloudSession=async()=>{}");await assert.rejects(h.run("cloudMaterialsRequest('fabric_purchases','GET')"),/HTTP 403/);});
test('finishing service quantity can exceed good pieces for manual reconciliation',()=>{const h=harness();setupCost(h);h.context.mockItems=[item('tag',0.5,91)];clickSave(h);assert.equal(state(h).costData.l1.history.length,1);assert.equal(h.run('costTotal(costData.l1)'),45.5);assert.equal(state(h).costData.l1.good,90);assert.equal(h.alerts.length,0);});
test('changing cost form values previews draft totals without altering saved summary',()=>{const h=harness();h.seed({lots:[{id:'l',quantity:100}],costData:{l:{good:100,damaged:0,pending:0,history:[{total:1000,good:100}],items:[{total:1000}]}}});h.el('cost-lot').value='l';h.el('cost-good').value='100';h.context.mockItems=[{total:1500}];h.run('costModes=()=>mockItems;costDraftDirty=true;calculateCost()');assert.match(h.el('cost-total').textContent,/1\.500,00/);assert.match(h.el('cost-consolidated-detail').textContent,/1\.000,00/);assert.equal(h.run('costTotal(costData.l)'),1000);});
test('changing the selected lot does not mark a saved cost as an edited draft',()=>{const h=harness();h.run('costDraftDirty=false');h.el('page-custos').onchange({target:{id:'cost-lot'}});assert.equal(h.run('costDraftDirty'),false);});
test('confirmed lot deletion removes it from cloud and local baseline',async()=>{const h=harness(),lot={id:'l',number:'LOT-0001',parentId:'p',quantity:10};h.seed({lots:[lot],costData:{}});h.run("cloudSession={access_token:'test'}");h.storage.set('lobo-industrial-lotes-cloud-base-v1',JSON.stringify({l:JSON.stringify(lot)}));let exists=true;h.context.fetch=async(url,o={})=>{if(url.includes('/lot_costs'))return {ok:true,json:async()=>[]};if(o.method==='DELETE'){exists=false;return {ok:true,json:async()=>[{id:'l'}]}}return {ok:true,json:async()=>exists?[{id:'l',data:lot,updated_at:'v1'}]:[]}};h.context.lotInput=lot;assert.equal(await h.run('deleteProductionLot(lotInput)'),true);assert.equal(exists,false);assert.equal(state(h).lots.length,0);assert.deepEqual(JSON.parse(h.storage.get('lobo-industrial-lotes-cloud-base-v1')),{});assert.ok([...h.storage.keys()].some(k=>k.startsWith('lobo-exclusao-backup-production_lots-')));});
test('lot deletion with local financial costs is rejected before remote mutation',async()=>{const h=harness(),lot={id:'l'};h.seed({lots:[lot],costData:{l:{history:[{total:10}]}}});h.context.lotInput=lot;assert.equal(await h.run('deleteProductionLot(lotInput)'),false);assert.equal(state(h).lots.length,1);assert.equal(h.requests.length,0);});
test('remote financial cost added by another PC blocks lot deletion',async()=>{const h=harness(),lot={id:'l'};h.seed({lots:[lot],costData:{}});h.run("cloudSession={access_token:'test'}");let deletes=0;h.context.fetch=async(url,o={})=>{if(o.method==='DELETE')deletes++;return {ok:true,json:async()=>[{lot_id:'l',data:{history:[{total:123}]}}]}};h.context.lotInput=lot;assert.equal(await h.run('deleteProductionLot(lotInput)'),false);assert.equal(deletes,0);assert.equal(state(h).lots.length,1);});
test('unchanged remotely deleted lot disappears on another PC with backup',async()=>{const h=harness(),lot={id:'l',quantity:10,parentId:'p',number:'LOT-0001'};h.seed({lots:[lot],costData:{}});h.storage.set('lobo-industrial-lotes-cloud-base-v1',JSON.stringify({l:h.run('cloudLotJson('+JSON.stringify(lot)+')')}));h.run("cloudSession={access_token:'test'}");await h.run('cloudSyncLots(true)');assert.equal(state(h).lots.length,0);assert.ok([...h.storage.keys()].some(k=>k.startsWith('lobo-backup-lote-excluido-remoto-l-')));});
test('local edits survive a remote lot deletion and produce a visible conflict',async()=>{const h=harness(),lot={id:'l',quantity:10,parentId:'p',number:'LOT-0001'};h.seed({lots:[{...lot,quantity:20}],costData:{}});h.storage.set('lobo-industrial-lotes-cloud-base-v1',JSON.stringify({l:h.run('cloudLotJson('+JSON.stringify(lot)+')')}));h.run("cloudSession={access_token:'test'}");await h.run('cloudSyncLots(true)');assert.equal(state(h).lots[0].quantity,20);assert.match(h.el('cloud-sync-message').textContent,/conflito/);});
test('failed optimistic delete preserves the local lot',async()=>{const h=harness(),lot={id:'l'};h.seed({lots:[lot],costData:{}});h.run("cloudSession={access_token:'test'}");h.context.fetch=async(url,o={})=>({ok:true,json:async()=>url.includes('/lot_costs')?[]:o.method==='DELETE'?[]:[{id:'l',data:lot,updated_at:'v1'}]});h.context.lotInput=lot;assert.equal(await h.run('deleteProductionLot(lotInput)'),false);assert.equal(state(h).lots.length,1);assert.match(h.alerts.at(-1),/alterado/);});
test('receipt total uses invoice total once, with legacy item-total fallback',()=>{const h=harness();assert.equal(h.run('getTotal({invoiceTotal:500,materials:{a:{total:50},b:{total:30}}})'),500);assert.equal(h.run('getTotal({materials:{a:{total:50},b:{total:30}}})'),80);});
test('restoring a previous snapshot preserves its recovered pieces and extra costs',()=>{const h=harness();const first={good:70,damaged:10,pending:20,total:1000,items:[item('malha',1000,0,'total')],complements:[{origin:'pendente',recovered:20,additional:10,items:[item('tag',0.5,20)]}]};const latest={good:90,damaged:10,pending:0,total:1200,items:[item('malha',1200,0,'total')]};setupCost(h,{history:[first,latest],good:90,damaged:10,pending:0});h.el('cost-history').onclick({target:{closest:()=>({dataset:{costDelete:'1'}})}});const d=state(h).costData.l1;assert.equal(d.good,90);assert.equal(d.pending,0);assert.equal(d.damaged,10);assert.equal(h.run('costTotal(costData.l1)'),1010);assert.equal(d.items.reduce((n,x)=>n+x.total,0),1010);});

function materialServer(h,purchases,receipts=[]){
 h.context.mockPurchases=purchases.map(data=>({id:data.id,data,updated_at:'2026-11-06T12:00:00Z'}));
 h.context.mockReceipts=receipts.map(data=>({id:data.id,data,updated_at:'2026-11-06T12:00:00Z'}));
 h.context.sent=[];
 h.run("cloudSession={access_token:'test',user_id:'u'};cloudMaterialsRequest=async(table,method,body)=>{sent.push({table,method,body});if(method!=='GET')throw Error('Unexpected write');return table==='fabric_purchases'?mockPurchases:mockReceipts}");
}
function materialBase(h,purchases=[],receipts=[]){
 const section=rows=>Object.fromEntries(rows.map(p=>[p.id,h.run('cloudLotJson('+JSON.stringify(p)+')')]));
 h.storage.set('lobo-industrial-materiais-base-v61',JSON.stringify({purchases:section(purchases),receipts:section(receipts)}));
}
test('stale PC reconciles deleted MAL-0001 before checking reused cloud number',async()=>{
 const h=harness(),old={id:'old-purchase',number:'MAL-0001',kg:500},current={id:'current-purchase',number:'MAL-0001',kg:600};
 h.seed({parents:[old],records:[],cuts:[],lots:[],costData:{}});materialBase(h,[old]);materialServer(h,[current]);
 await h.run('cloudSyncMaterials(true)');
 assert.deepEqual(state(h).parents,[current]);assert.match(h.el('cloud-sync-message').textContent,/Concluído/);
 assert.ok([...h.storage.keys()].some(k=>k.startsWith('lobo-exclusao-remota-backup-fabric_purchases-old-purchase-')));
 assert.ok(h.context.sent.every(r=>r.method==='GET'));
 await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[current]);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('stale receipt is backed up while deleted purchase number is reused',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'},receipt={id:'receipt',purchaseId:'old',materials:{malha:{kg:10}}},current={id:'new',number:'MAL-0001'};
 h.seed({parents:[old],records:[receipt]});materialBase(h,[old],[receipt]);materialServer(h,[current]);await h.run('cloudSyncMaterials(true)');
 assert.deepEqual(state(h).parents,[current]);assert.deepEqual(state(h).records,[]);
 assert.ok([...h.storage.keys()].some(k=>k.startsWith('lobo-exclusao-remota-backup-fabric_receipts-receipt-')));
});
test('edited stale purchase is preserved for reconciliation, never discarded to reuse a number',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001',kg:500},edited={...old,kg:501},current={id:'new',number:'MAL-0001'};
 h.seed({parents:[edited]});materialBase(h,[old]);materialServer(h,[current]);await h.run('cloudSyncMaterials(true)');
 assert.deepEqual(state(h).parents,[edited]);assert.match(h.el('cloud-sync-message').textContent,/alterações locais/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('incoming cloud renumbering is reconciled before a number collision is reported',async()=>{
 const h=harness(),old={id:'p',number:'MAL-0001',kg:500},updated={...old,number:'MAL-0002'},newPurchase={id:'new',number:'MAL-0001',kg:600};
 h.seed({parents:[old]});materialBase(h,[old]);materialServer(h,[updated,newPurchase]);await h.run('cloudSyncMaterials(true)');
 assert.deepEqual(state(h).parents,[updated,newPurchase]);assert.match(h.el('cloud-sync-message').textContent,/Concluído/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('a genuinely new duplicate remains visible for explicit number repair',async()=>{
 const h=harness(),local={id:'unsynced',number:'MAL-0001'},remote={id:'cloud',number:'MAL-0001'};
 h.seed({parents:[local]});materialServer(h,[remote]);await h.run('cloudSyncMaterials(true)');
 assert.deepEqual(state(h).parents,[local]);assert.match(h.el('cloud-conflict-details').innerHTML,/Manter compras separadas/);assert.match(h.el('cloud-sync-message').textContent,/números repetidos/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('legacy baseline key order does not turn a stale purchase into a local edit',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001',kg:500},current={id:'new',number:'MAL-0001'};
 h.seed({parents:[old]});h.storage.set('lobo-industrial-materiais-base-v61',JSON.stringify({purchases:{old:JSON.stringify(old)},receipts:{}}));materialServer(h,[current]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[current]);
});
test('new receipt linked to missing purchase prevents automatic retirement',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'},receipt={id:'new-receipt',purchaseId:'old',materials:{malha:{kg:10}}};h.seed({parents:[old],records:[receipt]});materialBase(h,[old]);materialServer(h,[{id:'new',number:'MAL-0001'}]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.deepEqual(state(h).records,[receipt]);assert.match(h.el('cloud-sync-message').textContent,/alterações locais/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('new cut linked to missing purchase prevents automatic retirement',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'},cut={id:'new-cut',parentId:'old',kg:10,pieces:40};h.seed({parents:[old],cuts:[cut]});materialBase(h,[old]);materialServer(h,[{id:'new',number:'MAL-0001'}]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.deepEqual(state(h).cuts,[cut]);assert.match(h.el('cloud-sync-message').textContent,/alterações locais/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('edited known cut linked to missing purchase prevents automatic retirement',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'},cut={id:'cut',parentId:'old',kg:10,pieces:40};h.seed({parents:[old],cuts:[{...cut,pieces:41}]});h.storage.set('lobo-industrial-cortes-cloud-base-v1',JSON.stringify({cut:h.run('cloudLotJson('+JSON.stringify(cut)+')')}));materialBase(h,[old]);materialServer(h,[{id:'new',number:'MAL-0001'}]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.equal(state(h).cuts[0].pieces,41);assert.match(h.el('cloud-sync-message').textContent,/alterações locais/);
});
test('new brand linked to missing purchase prevents automatic retirement',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'},lot={id:'new-lot',parentId:'old',quantity:40};h.seed({parents:[old],lots:[lot]});materialBase(h,[old]);materialServer(h,[{id:'new',number:'MAL-0001'}]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.deepEqual(state(h).lots,[lot]);assert.match(h.el('cloud-sync-message').textContent,/alterações locais/);
});
test('edited receipt is preserved when its former purchase number is reused',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'},receipt={id:'r',purchaseId:'old',materials:{malha:{kg:10}},invoiceTotal:100};h.seed({parents:[old],records:[{...receipt,invoiceTotal:101}]});materialBase(h,[old],[receipt]);materialServer(h,[{id:'new',number:'MAL-0001'}]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.equal(state(h).records[0].invoiceTotal,101);assert.match(h.el('cloud-sync-message').textContent,/alterações locais/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('backup write failure prevents retirement and preserves the stale purchase',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'};h.seed({parents:[old]});materialBase(h,[old]);materialServer(h,[{id:'new',number:'MAL-0001'}]);const original=h.context.localStorage.setItem;h.context.localStorage.setItem=(key,value)=>{if(key.startsWith('lobo-exclusao-remota-backup-'))throw Error('disk full');original(key,value)};await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.match(h.el('cloud-sync-message').textContent,/disk full/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('failed remote read cannot be mistaken for an empty cloud dataset',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'};h.seed({parents:[old]});materialBase(h,[old]);h.run("cloudSession={access_token:'test'};cloudMaterialsRequest=async()=>{throw Error('network failure')}");await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.match(h.el('cloud-sync-message').textContent,/network failure/);
});
test('two-sided edits produce a field comparison rather than automatic number repair',async()=>{
 const h=harness(),base={id:'p',number:'MAL-0001',kg:500},local={...base,kg:501},remote={...base,number:'MAL-0002',kg:502};h.seed({parents:[local]});materialBase(h,[base]);materialServer(h,[remote,{id:'new',number:'MAL-0001'}]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[local]);assert.match(h.el('cloud-conflict-details').innerHTML,/Conflitos encontrados/);assert.match(h.el('cloud-sync-message').textContent,/divergentes/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});
test('corrupt baseline cannot trigger upload or retirement',async()=>{
 const h=harness(),old={id:'old',number:'MAL-0001'};h.seed({parents:[old]});h.storage.set('lobo-industrial-materiais-base-v61','invalid-json');materialServer(h,[{id:'new',number:'MAL-0001'}]);await h.run('cloudSyncMaterials(true)');assert.deepEqual(state(h).parents,[old]);assert.match(h.el('cloud-sync-message').textContent,/Falha/);assert.ok(h.context.sent.every(r=>r.method==='GET'));
});

test('quantity warning shows only the excess and never blocks submitting',()=>{const h=harness();h.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}],lots:[{id:'old',parentId:'p',quantity:80}]});h.el('child-parent-select').value='p';h.el('child-quantity').value='30';h.el('child-quantity').oninput();assert.match(h.el('child-piece-availability').textContent,/10 peças acima/);assert.equal(h.el('child-piece-availability').classes.has('allocation-warning'),true);h.el('child-quantity').value='20';h.el('child-quantity').oninput();assert.equal(h.el('child-piece-availability').classes.has('allocation-warning'),false);});
test('a new brand is accepted with zero remaining pieces',()=>{const h=harness();h.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}],lots:[{id:'old',parentId:'p',quantity:100}]});h.el('child-parent-select').value='p';h.el('child-quantity').value='10';h.el('child-form').onsubmit({preventDefault(){}});assert.equal(state(h).lots.length,2);assert.equal(h.run("availablePieces('p')"),-10);assert.equal(h.alerts.length,0);});
test('editing a brand can increase it above remaining pieces while preserving its ID',()=>{const h=harness();h.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}],lots:[{id:'old',number:'LOT-0001',parentId:'p',quantity:80,status:'Corte',history:[]}]});h.run("editingChild='old'");h.el('child-parent-select').value='p';h.el('child-status').value='Corte';h.el('child-quantity').value='150';h.el('child-form').onsubmit({preventDefault(){}});assert.equal(state(h).lots.length,1);assert.equal(state(h).lots[0].id,'old');assert.equal(state(h).lots[0].quantity,150);assert.equal(h.run("cutPieces('p')"),100);assert.equal(h.alerts.length,0);});
test('zero, negative and fractional brand quantities remain invalid',()=>{for(const value of ['0','-10','1.5']){const h=harness();h.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}]});h.el('child-parent-select').value='p';h.el('child-quantity').value=value;h.el('child-form').onsubmit({preventDefault(){}});assert.equal(state(h).lots.length,0);assert.match(h.alerts.at(-1),/quantidade de peças/);}});
test('a brand still requires a registered purchase',()=>{const h=harness();h.el('child-parent-select').value='missing';h.el('child-quantity').value='150';h.el('child-form').onsubmit({preventDefault(){}});assert.equal(state(h).lots.length,0);assert.match(h.alerts.at(-1),/lote principal/);});
test('existing costs still protect the brand quantity from inconsistent edits',()=>{const h=harness();h.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}],lots:[{id:'old',parentId:'p',quantity:80}],costData:{old:{history:[{total:100}]}}});h.run("editingChild='old'");h.el('child-parent-select').value='p';h.el('child-quantity').value='150';h.el('child-form').onsubmit({preventDefault(){}});assert.equal(state(h).lots[0].quantity,80);assert.match(h.alerts.at(-1),/custos registrados/);});
test('an additional partial cut can reduce a planned shortfall without covering all of it',()=>{const h=harness();h.seed({parents:[{id:'p',kg:100}],records:[{purchaseId:'p',materials:{malha:{kg:100}}}],cuts:[{id:'c',parentId:'p',kg:10,pieces:40}],lots:[{id:'l',parentId:'p',quantity:80}]});h.el('cut-parent').value='p';h.el('cut-kg').value='5';h.el('cut-pieces').value='20';h.el('cut-form').onsubmit({preventDefault(){}});assert.equal(state(h).cuts.length,2);assert.equal(h.run("cutPieces('p')"),60);assert.equal(h.run("availablePieces('p')"),-20);assert.equal(h.alerts.length,0);});
test('editing a cut cannot worsen an existing planned shortfall',()=>{const h=harness();h.seed({parents:[{id:'p',kg:100}],records:[{purchaseId:'p',materials:{malha:{kg:100}}}],cuts:[{id:'c',parentId:'p',kg:10,pieces:40}],lots:[{id:'l',parentId:'p',quantity:80}]});h.run("editingCut='c'");h.el('cut-parent').value='p';h.el('cut-kg').value='9';h.el('cut-pieces').value='35';h.el('cut-form').onsubmit({preventDefault(){}});assert.equal(h.run("cutPieces('p')"),40);assert.match(h.alerts.at(-1),/reduzir o corte/);});
test('quantity above cut balance synchronizes unchanged to a second instance',async()=>{const h=harness(),lot={id:'planned',number:'LOT-0001',parentId:'p',quantity:150};h.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}],lots:[lot]});h.context.written=[];h.run("cloudSession={access_token:'test',user_id:'u'};cloudMaterialsRequest=async(table,method,body)=>{if(method==='POST'){written.push(...body);return null}return []}");await h.run('cloudSyncLots(true)');assert.equal(h.context.written[0].data.quantity,150);const other=harness();other.context.remoteRows=JSON.parse(JSON.stringify(h.context.written));other.seed({parents:[{id:'p'}],cuts:[{parentId:'p',pieces:100}],lots:[]});other.run("cloudSession={access_token:'test',user_id:'u'};cloudMaterialsRequest=async()=>remoteRows");await other.run('cloudSyncLots(true)');assert.equal(state(other).lots[0].quantity,150);assert.equal(other.run("availablePieces('p')"),-50);});

function freeCost(h,{planned=276,good=290,damaged=5,pending=5}={}){setupCost(h,{good,damaged,pending});h.run('lots[0].quantity='+planned);h.context.mockItems=[item('malha',3000,0,'total'),item('costura',4,good+damaged+pending),item('tag',0.2,good)];}
test('costs accept 300 classified pieces on a brand planned for 276',()=>{const h=harness();freeCost(h);clickSave(h);const d=state(h).costData.l1;assert.equal(h.run('costQuantity(costData.l1)'),300);assert.equal(h.run('costTotal(costData.l1)'),4258);assert.equal(state(h).lots[0].quantity,276);assert.equal(d.good,290);assert.equal(h.alerts.length,0);});
test('costs accept fewer classified pieces than the brand quantity',()=>{const h=harness();freeCost(h,{good:200,damaged:5,pending:5});clickSave(h);assert.equal(h.run('costQuantity(costData.l1)'),210);assert.equal(state(h).lots[0].quantity,276);assert.equal(h.run('costTotal(costData.l1)'),3880);assert.equal(h.alerts.length,0);});
test('an empty cost quantity is rejected instead of saving a zero-piece apuration',()=>{const h=harness();freeCost(h,{good:0,damaged:0,pending:0});clickSave(h);assert.equal(state(h).costData.l1.history.length,0);assert.match(h.alerts.at(-1),/pelo menos uma peça/);});
test('general service quantity can exceed the free apuration quantity',()=>{const h=harness();freeCost(h,{good:90,damaged:5,pending:5});h.context.mockItems=[item('costura',4,101)];clickSave(h);assert.equal(state(h).costData.l1.history.length,1);assert.equal(h.run('costTotal(costData.l1)'),404);assert.equal(h.run('costQuantity(costData.l1)'),100);assert.equal(h.alerts.length,0);});
test('automatic general-service quantities follow good plus damaged plus pending',()=>{const h=harness();h.el('cost-good').value='300';h.el('cost-damaged').value='10';h.el('cost-pending').value='20';h.run('calculateCost=()=>{}');h.el('page-custos').oninput({target:{id:'cost-good',closest:()=>null,matches:()=>false}});for(const id of ['corte','costura','serigrafia','bordado'])assert.equal(Number(h.el('cost-row-'+id).querySelector('[data-cost-qty]').value),330);for(const id of ['tag','lacre','entretela','saquinhos','composicao'])assert.equal(Number(h.el('cost-row-'+id).querySelector('[data-cost-qty]').value),300);});
test('manual service quantities remain unchanged when the free apuration changes',()=>{const h=harness();h.el('cost-good').value='300';h.el('cost-damaged').value='10';h.el('cost-pending').value='20';const qty=h.el('cost-row-costura').querySelector('[data-cost-qty]');qty.value='200';qty.dataset.manual='1';h.run('syncCostAutoQuantities()');assert.equal(qty.value,'200');assert.equal(Number(h.el('cost-row-corte').querySelector('[data-cost-qty]').value),330);});
test('saving a revised free quantity updates one existing card',()=>{const h=harness();setupCost(h);clickSave(h);h.run('lots[0].quantity=276');h.el('cost-good').value='300';h.el('cost-damaged').value='0';h.el('cost-pending').value='0';h.context.mockItems=[item('malha',1000,0,'total'),item('costura',3,300),item('tag',0.5,300)];clickSave(h);assert.equal(state(h).costData.l1.history.length,1);assert.equal(h.run('costQuantity(costData.l1)'),300);assert.equal(h.run('costTotal(costData.l1)'),2050);assert.equal(state(h).lots[0].quantity,276);});
test('inline historical cost editor accepts a free quantity too',()=>{const h=harness();setupCost(h);clickSave(h);h.run('lots[0].quantity=276');const host=h.el('[data-history-editor="0"]');host.querySelector('[data-hgood]').value='300';host.querySelector('[data-hdamaged]').value='0';host.querySelector('[data-hpending]').value='0';host.querySelector('[data-hitem="malha"]').querySelector('[data-hvalue]').value='1000';host.querySelector('[data-hitem="costura"]').querySelector('[data-hvalue]').value='4';host.querySelector('[data-hitem="costura"]').querySelector('[data-hqty]').value='300';h.el('cost-history').onclick({target:{closest:()=>({dataset:{hsave:'0'}})}});assert.equal(h.run('costQuantity(costData.l1)'),300);assert.equal(h.run('costTotal(costData.l1)'),2200);assert.equal(h.alerts.length,0);});
test('a complement to a free apuration preserves its own piece total',()=>{const h=harness();setupCost(h);h.run('lots[0].quantity=276');clickSave(h);h.context.mockExtra=[item('tag',0.5,5)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();h.run('editingCostComplement={i:0,j:0}');h.el('cost-complement-recovered').value='3';h.context.mockItems=[item('tag',0.5,3)];clickSave(h);assert.equal(h.run('costQuantity(costData.l1)'),100);assert.equal(state(h).costData.l1.good,93);assert.equal(state(h).costData.l1.pending,2);assert.equal(h.run('costTotal(costData.l1)'),1346.5);});
test('editing the free base with recovered pieces preserves the complement',()=>{const h=harness();setupCost(h);h.run('lots[0].quantity=276');clickSave(h);h.context.mockExtra=[item('tag',0.5,5)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();h.run('editingCostHistory=0');h.el('cost-good').value='100';h.el('cost-damaged').value='5';h.el('cost-pending').value='5';h.context.mockItems=[item('malha',1000,0,'total'),item('costura',3,110),item('tag',0.5,100)];clickSave(h);const d=state(h).costData.l1;assert.equal(d.good,105);assert.equal(d.pending,0);assert.equal(h.run('costQuantity(costData.l1)'),110);assert.equal(h.run('costTotal(costData.l1)'),1382.5);assert.equal(d.history[0].complements.length,1);});
test('a free base edit cannot undo already recovered pending pieces',()=>{const h=harness();setupCost(h);h.run('lots[0].quantity=276');clickSave(h);h.context.mockExtra=[item('tag',0.5,5)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();h.run('editingCostHistory=0');h.el('cost-good').value='100';h.el('cost-damaged').value='0';h.el('cost-pending').value='0';clickSave(h);assert.equal(state(h).costData.l1.good,95);assert.match(h.alerts.at(-1),/preservar as peças recuperadas/);});
test('damage percentage uses the apuration quantity instead of the planned brand count',()=>{const h=harness();h.seed({parents:[],cuts:[],lots:[{id:'l1',quantity:276,brand:'A',status:'Costura'}],costData:{l1:{good:90,damaged:5,pending:5,history:[{total:1000,good:90,damaged:5,pending:5}]}}});h.run('renderIndicators()');assert.match(h.el('ind-cost-rows').innerHTML,/5,0%/);assert.doesNotMatch(h.el('ind-cost-rows').innerHTML,/1,8%/);});
test('the screen identifies the independent apuration and planned brand quantities',()=>{const h=harness();h.seed({lots:[{id:'l1',quantity:276}],costData:{}});h.el('cost-lot').value='l1';h.el('cost-good').value='300';h.el('cost-damaged').value='10';h.el('cost-pending').value='20';h.context.mockItems=[];h.run('costModes=()=>mockItems;calculateCost()');assert.match(h.el('cost-count-info').textContent,/apuração: 330/);assert.match(h.el('cost-count-info').textContent,/marca: 276/);});
test('a free cost quantity synchronizes unchanged to another instance',async()=>{const h=harness();freeCost(h);clickSave(h);h.context.written=[];h.run("cloudSession={access_token:'test',user_id:'u'};cloudMaterialsRequest=async(table,method,body)=>{if(method==='POST'){written.push(...body);return null}return table==='production_lots'?[{id:'l1'}]:[]}");await h.run('cloudSyncCosts(true)');assert.equal(h.context.written.length,1);const other=harness();other.seed({lots:[{id:'l1',quantity:276}],costData:{}});other.context.remoteCosts=JSON.parse(JSON.stringify(h.context.written));other.run("cloudSession={access_token:'test',user_id:'u'};cloudMaterialsRequest=async(table)=>table==='lot_costs'?remoteCosts:[{id:'l1'}]");await other.run('cloudSyncCosts(true)');assert.equal(other.run('costQuantity(costData.l1)'),300);assert.equal(other.run('costTotal(costData.l1)'),4258);assert.equal(state(other).lots[0].quantity,276);});

test('187 good pieces can retain manual service and finishing quantities of 276',()=>{const h=harness();freeCost(h,{good:187,damaged:0,pending:0});h.context.mockItems=[item('malha',3000,0,'total'),item('costura',4,276),item('tag',0.2,276)];clickSave(h);const d=state(h).costData.l1;assert.equal(d.good,187);assert.equal(d.items.find(x=>x.id==='costura').qty,276);assert.equal(d.items.find(x=>x.id==='tag').qty,276);assert.equal(h.run('costTotal(costData.l1)'),4159.2);assert.equal(h.alerts.length,0);});
test('editing manual service quantities above the apuration updates the same card',()=>{const h=harness();setupCost(h);clickSave(h);h.context.mockItems=[item('costura',4,276),item('tag',0.2,276)];clickSave(h);assert.equal(state(h).costData.l1.history.length,1);assert.equal(h.run('costTotal(costData.l1)'),1159.2);assert.equal(h.alerts.length,0);});
test('inline history editing accepts service and finishing quantities above its counts',()=>{const h=harness();setupCost(h);clickSave(h);const host=h.el('[data-history-editor="0"]');host.querySelector('[data-hgood]').value='90';host.querySelector('[data-hdamaged]').value='5';host.querySelector('[data-hpending]').value='5';for(const id of ['costura','tag']){const row=host.querySelector('[data-hitem="'+id+'"]');row.querySelector('[data-hvalue]').value='1';row.querySelector('[data-hqty]').value='276'}h.el('cost-history').onclick({target:{closest:()=>({dataset:{hsave:'0'}})}});assert.equal(h.run('costTotal(costData.l1)'),552);assert.equal(state(h).costData.l1.history.length,1);assert.equal(h.alerts.length,0);});
test('a complement can charge more service units than recovered pieces',()=>{const h=harness();setupCost(h);clickSave(h);h.context.mockExtra=[item('tag',0.5,276)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();assert.equal(state(h).costData.l1.good,95);assert.equal(h.run('costTotal(costData.l1)'),1483);assert.equal(state(h).costData.l1.history[0].complements[0].items[0].qty,276);assert.equal(h.alerts.length,0);});
test('editing a complement accepts manual service quantities above recovery',()=>{const h=harness();setupCost(h);clickSave(h);h.context.mockExtra=[item('tag',0.5,5)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();h.run('editingCostComplement={i:0,j:0}');h.el('cost-complement-recovered').value='5';h.context.mockItems=[item('tag',0.5,276)];clickSave(h);assert.equal(state(h).costData.l1.good,95);assert.equal(state(h).costData.l1.history[0].complements.length,1);assert.equal(h.run('costTotal(costData.l1)'),1483);assert.equal(h.alerts.length,0);});
test('invalid service numbers stay blocked while high valid quantities are allowed',()=>{for(const invalid of [{value:-1,qty:10,total:-10},{value:Infinity,qty:1,total:Infinity},{value:1,qty:-1,total:-1},{value:1,qty:1.5,total:1.5},{value:NaN,qty:1,total:NaN}]){const h=harness();setupCost(h);h.context.mockItems=[{id:'costura',mode:'individual',label:'costura',...invalid}];clickSave(h);assert.equal(state(h).costData.l1.history.length,0);assert.match(h.alerts.at(-1),/valores válidos/);}});
test('inline history editor still rejects fractional service quantities',()=>{const h=harness();setupCost(h);clickSave(h);const before=JSON.stringify(state(h).costData.l1);const host=h.el('[data-history-editor="0"]');host.querySelector('[data-hgood]').value='90';host.querySelector('[data-hdamaged]').value='5';host.querySelector('[data-hpending]').value='5';const row=host.querySelector('[data-hitem="costura"]');row.querySelector('[data-hvalue]').value='1';row.querySelector('[data-hqty]').value='1.5';h.el('cost-history').onclick({target:{closest:()=>({dataset:{hsave:'0'}})}});assert.equal(JSON.stringify(state(h).costData.l1),before);assert.match(h.alerts.at(-1),/Revise valores/);});
test('complement still rejects negative and fractional service quantities',()=>{for(const value of [-1,1.5]){const h=harness();setupCost(h);clickSave(h);h.context.mockExtra=[item('tag',0.5,value)];h.run('extraItems=()=>COST_ITEMS.map(([id,label,mode])=>mockExtra.find(x=>x.id===id)||{id,label,mode,value:0,qty:0,total:0});extraFromAvaria=false');h.el('extra-recovered').value='5';h.el('extra-save').onclick();assert.equal(state(h).costData.l1.good,90);assert.match(h.alerts.at(-1),/valores e quantidades/);}});


test('brands on the same purchase display its MAL code without collapsing distinct records',()=>{
  const h=harness();
  h.seed({parents:[{id:'p1',number:'MAL-0001'},{id:'p2',number:'MAL-0002'}],lots:[
    {id:'brand1',parentId:'p1',number:'LOT-0001',brand:'A',quantity:100},
    {id:'brand2',parentId:'p1',number:'LOT-0002',brand:'B',quantity:200},
    {id:'brand3',parentId:'p2',number:'LOT-0003',brand:'C',quantity:300}
  ]});
  h.run('showCostPage()');
  assert.match(h.el('cost-lot').innerHTML,/value="brand1">A — MAL-0001/);
  assert.match(h.el('cost-lot').innerHTML,/value="brand2">B — MAL-0001/);
  assert.match(h.el('cost-lot').innerHTML,/value="brand3">C — MAL-0002/);
  assert.equal(h.run('lots[1].number'),'LOT-0002');
});

test('movement history groups all brand timelines by purchase and searches by MAL or invoice',()=>{
 const h=harness();
 const movement=(status,at)=>({status,at});
 h.seed({
  parents:[
   {id:'p1',number:'MAL-0001',invoice:'10042',fabricBrand:'Caiman'},
   {id:'p2',number:'MAL-0002',invoice:'10042',fabricBrand:'Outro fornecedor'}
  ],
  lots:[
   {id:'a',parentId:'p1',number:'LOT-0001',brand:'Nato',client:'Cliente A',history:[
    movement('Costura','2026-11-03T11:00:00Z'),movement('Corte','2026-11-02T11:00:00Z')
   ]},
   {id:'b',parentId:'p1',number:'LOT-0002',brand:'Lobo',history:[movement('Embalagem','2026-11-04T11:00:00Z')]},
   {id:'c',parentId:'p2',number:'LOT-0003',brand:'Terceira'},
   {id:'legacy',number:'LOT-0004',brand:'Marca antiga'}
  ]
 });
 const render=query=>{
  h.el('history-search').value=query;
  h.el('history-search').oninput();
  return h.el('lot-history').innerHTML;
 };
 const all=render('');
 assert.equal((all.match(/<details class="history-group"/g)||[]).length,3);
 assert.doesNotMatch(all,/data-history-group="[^"]+" open/);
 assert.match(all,/LOT-0004/);
 const byCode=render('mal-0001');
 assert.match(byCode,/data-history-group="purchase:p1" open/);
 assert.match(byCode,/NF 10042 · Caiman/);
 assert.match(byCode,/2 marcas/);
 assert.match(byCode,/<h4>Nato<\/h4>/);
 assert.match(byCode,/<h4>Lobo<\/h4>/);
 assert.match(byCode,/<strong>Corte<\/strong>[\s\S]*<strong>Costura<\/strong>/);
 assert.match(byCode,/<strong>Embalagem<\/strong>/);
 assert.doesNotMatch(byCode,/Terceira/);
 const byInvoice=render('10042');
 assert.equal((byInvoice.match(/<details class="history-group"/g)||[]).length,2);
 assert.match(byInvoice,/Terceira/);
 assert.doesNotMatch(byInvoice,/Marca antiga/);
 const byClient=render('cliente a');
 assert.match(byClient,/<h4>Nato<\/h4>/);
 assert.doesNotMatch(byClient,/<h4>Lobo<\/h4>/);
 assert.match(render('inexistente'),/Nenhum lote de marca encontrado/);
});

test('sewing plan caps 8,400 pieces at 8,000 and changing priorities changes the overflow lot',()=>{
 const h=harness();
 h.seed({
  parents:[{id:'a',number:'MAL-0001',invoice:'10'},{id:'b',number:'MAL-0002',invoice:'11'}],
  cuts:[{parentId:'a',pieces:5000},{parentId:'b',pieces:3400}],
  lots:[{parentId:'b',brand:'Marca B',model:'Polo',quantity:3400,status:'Corte'}]
 });
 h.context.plan={daily:400,days:20,queue:['a','b'],estimates:{}};
 const allocate=()=>JSON.parse(h.run('JSON.stringify({...allocateSewing(plan,sewingStock(plan)),selected:[...allocateSewing(plan,sewingStock(plan)).selected]})'));
 let result=allocate();
 assert.equal(result.capacity,8000);
 assert.equal(result.ready,8000);
 assert.equal(result.overflow,400);
 assert.equal(result.free,0);
 assert.equal(result.selected[1][1].lines[0].plannedReady,3000);
 h.context.plan.queue.reverse();
 result=allocate();
 assert.equal(result.selected[0][1].ready,3400);
 assert.equal(result.selected[1][1].outside,400);
});

test('sewing stock counts receipts, cuts and post-sewing pieces once and adjusts estimates as cuts are recorded',()=>{
 const h=harness();
 h.seed({
  parents:[{id:'p',number:'MAL-0001',invoice:'123'},{id:'open',number:'MAL-0002',kg:100}],
  records:[{purchaseId:'p',invoice:'123',materials:{malha:{kg:80}}},{purchaseId:'p',invoice:'124',materials:{malha:{kg:20}}}],
  cuts:[{parentId:'p',kg:40,pieces:160}],
  lots:[
   {parentId:'p',brand:'Já costurada',quantity:60,status:'Embalagem'},
   {parentId:'p',brand:'Em costura',model:'Polo',quantity:120,status:'Costura'},
   {parentId:'p',brand:'Planejada',model:'Camiseta',quantity:200,status:'Corte'}
  ]
 });
 h.context.plan={daily:100,days:2,queue:['p'],estimates:{p:{pieces:250,cutAtEntry:120}}};
 const stock=JSON.parse(h.run('JSON.stringify(sewingStock(plan))'));
 assert.equal(stock.length,1);
 assert.deepEqual(stock[0].invoices,['123','124']);
 assert.equal(stock[0].uncutKg,60);
 assert.equal(stock[0].ready,100);
 assert.equal(stock[0].estimate,210);
 assert.equal(stock[0].lines[0].label,'Em costura · Polo');
 assert.equal(stock[0].lines[0].ready,100);
 const allocated=JSON.parse(h.run("JSON.stringify(allocateSewing(plan,sewingStock(plan)).selected.get('p'))"));
 assert.equal(allocated.ready,100);
 assert.equal(allocated.estimate,100);
 assert.equal(allocated.outside,110);
 assert.equal(allocated.lines[0].plannedEstimate,20);
 assert.equal(allocated.lines[1].plannedEstimate,80);
 h.run("cuts.push({parentId:'p',kg:60,pieces:210})");
 assert.equal(h.run('sewingStock(plan)[0].estimate'),0);
 assert.equal(h.run('sewingStock(plan)[0].ready'),310);
});

test('sewing planner UI keeps capacity and simulations per period and restores navigation',()=>{
 const h=harness();
 const date=h.el('plan-period-date'),type=h.el('plan-period-type');
 date.value='2026-11-11';type.value='month';
 h.run("planToday=()=> '2026-11-11'");
 h.seed({
  parents:[{id:'x',number:'MAL-0001',invoice:'123'}],
  records:[{purchaseId:'x',materials:{malha:{kg:30}}}]
 });
 h.run('showSewingPlan()');
 assert.equal(h.el('page-planejamento').style.display,'block');
 assert.equal(h.el('plan-period-label').textContent,'01/11/2026 a 30/11/2026');
 assert.match(h.el('plan-stock').innerHTML,/MAL-0001[\s\S]*NF 123[\s\S]*A cortar/);
 const preventDefault=()=>{};
 h.el('plan-daily').value='400';
 h.el('plan-capacity-form').onsubmit({preventDefault});
 h.el('plan-stock').onsubmit({preventDefault,target:{closest:()=>({dataset:{planEstimate:'x'},querySelector:()=>({value:'8400'})})}});
 h.el('plan-add-all').onclick();
 assert.match(h.el('plan-stock').innerHTML,/5\.200 peças no plano/);
 assert.match(h.el('plan-stock').innerHTML,/3\.200 passam para o mês seguinte/);
 type.value='week';type.onchange();
 assert.equal(h.el('plan-period-label').textContent,'09/11/2026 a 15/11/2026');
 assert.match(h.el('plan-output-summary').innerHTML,/Dias de produção restantes<\/span><strong>3/);
 assert.doesNotMatch(h.el('plan-stock').innerHTML,/5\.200 peças no plano/);
 type.value='month';type.onchange();
 assert.match(h.el('plan-stock').innerHTML,/5\.200 peças no plano/);
 h.run('showCutPage()');
 assert.equal(h.el('page-planejamento').style.display,'none');
});

test('daily sewing progress carries a surplus or shortfall into the remaining target',()=>{
 const h=harness();
 const progress=pieces=>JSON.parse(h.run(`JSON.stringify(sewingProgress({daily:400,days:5},[['2024-04-01',${pieces}]],productionDates(planPeriod('week','2024-04-01')), '2024-04-01'))`));
 assert.deepEqual(progress(450),{produced:450,daysLeft:4,targetLeft:1550,budget:1550,gap:0});
 assert.deepEqual(progress(350),{produced:350,daysLeft:4,targetLeft:1650,budget:1600,gap:50});
 assert.deepEqual(progress(0),{produced:0,daysLeft:4,targetLeft:2000,budget:1600,gap:400});
 assert.deepEqual(progress(2100),{produced:2100,daysLeft:4,targetLeft:0,budget:0,gap:0});
});

test('saving, correcting and deleting a daily sewing total updates its week and month',()=>{
 const h=harness();
 h.seed({parents:[{id:'p',number:'MAL-0001'}],cuts:[{parentId:'p',pieces:2200}]});
 h.el('plan-period-type').value='week';
 h.el('plan-period-date').value='2024-04-01';
 h.run("planToday=()=> '2024-04-01'");
 h.run('showSewingPlan()');
 const preventDefault=()=>{};
 h.el('plan-daily').value='400';
 h.el('plan-capacity-form').onsubmit({preventDefault});
 h.el('plan-add-all').onclick();
 const outputDate=h.el('plan-output-date'),pieces=h.el('plan-output-pieces');
 outputDate.value='2024-04-01';outputDate.onchange();
 pieces.value='450';h.el('plan-output-form').onsubmit({preventDefault});
 assert.match(h.el('plan-output-summary').innerHTML,/Faltam para a meta<\/span><strong>1\.550/);
 assert.match(h.el('plan-output-summary').innerHTML,/Meta diária necessária<\/span><strong>388/);
 assert.match(h.el('plan-stock').innerHTML,/1\.550 peças no plano/);
 pieces.value='460';h.el('plan-output-form').onsubmit({preventDefault});
 assert.match(h.el('plan-output-summary').innerHTML,/1\.540/);
 assert.equal((h.el('plan-output-entries').innerHTML.match(/class="plan-output-entry"/g)||[]).length,1);
 h.el('plan-period-type').value='month';h.el('plan-period-type').onchange();
 assert.match(h.el('plan-output-entries').innerHTML,/01\/04\/2024[\s\S]*460 peças/);
 h.el('plan-output-entries').onclick({target:{closest:()=>({dataset:{outputDelete:'2024-04-01'}})}});
 assert.match(h.el('plan-output-entries').innerHTML,/Nenhuma produção lançada/);
 h.el('plan-period-type').value='week';h.el('plan-period-type').onchange();
 assert.match(h.el('plan-stock').innerHTML,/2\.000 peças no plano/);
});

test('production calendar skips elapsed dates, Sundays and holidays and supports selected work dates',()=>{
 const h=harness();
 h.run("planToday=()=> '2026-11-19'");
 h.el('plan-period-type').value='week';
 h.el('plan-period-date').value='2026-11-19';
 h.run('showSewingPlan()');
 assert.match(h.el('plan-calendar-list').innerHTML,/data-work-date="2026-11-20" >[\s\S]*Consciência Negra/);
 assert.match(h.el('plan-output-summary').innerHTML,/Dias de produção restantes<\/span><strong>1/);
 h.el('plan-calendar-saturdays').onchange({target:{checked:true}});
 assert.match(h.el('plan-output-summary').innerHTML,/Dias de produção restantes<\/span><strong>2/);
 h.el('plan-calendar-list').onchange({target:{closest:()=>({dataset:{workDate:'2026-11-20'},checked:true})}});
 assert.match(h.el('plan-output-summary').innerHTML,/Dias de produção restantes<\/span><strong>3/);
 h.el('plan-period-type').value='month';h.el('plan-period-type').onchange();
 assert.match(h.el('plan-calendar-list').innerHTML,/data-work-date="2026-11-20" checked/);
 assert.match(h.el('plan-calendar-list').innerHTML,/data-work-date="2026-11-21" checked/);
 h.run("planToday=()=> '2026-12-01'; renderSewingPlan()");
 assert.match(h.el('plan-output-summary').innerHTML,/Dias de produção restantes<\/span><strong>0/);
});

test('calendar uses Bahia local dates and the movable holidays for Feira de Santana',()=>{
 const h=harness();
 assert.equal(h.run("planToday(new Date('2026-11-20T02:59:59Z'))"),'2026-11-19');
 assert.equal(h.run("planToday(new Date('2026-11-20T03:00:00Z'))"),'2026-11-20');
 const holidays=JSON.parse(h.run('JSON.stringify(planMovableHolidays(2026))'));
 assert.deepEqual(holidays,{'2026-04-03':'Sexta-feira da Paixão','2026-06-04':'Corpus Christi'});
 assert.equal(h.run("productionDates(planPeriod('week','2026-07-02')).find(day=>day.date==='2026-07-02').working"),false);
});

test('monthly target and queue only count remaining production dates and update when a holiday is selected',()=>{
 const h=harness();
 h.run("planToday=()=> '2026-11-11'");
 h.el('plan-period-type').value='month';
 h.el('plan-period-date').value='2026-11-11';
 h.run('showSewingPlan()');
 h.el('plan-daily').value='400';
 h.el('plan-capacity-form').onsubmit({preventDefault(){}});
 assert.match(h.el('plan-capacity').innerHTML,/Meta dos dias restantes<\/span><strong>5\.200<\/strong><span>400 peças\/dia × 13 dias/);
 assert.match(h.el('plan-output-summary').innerHTML,/Faltam para a meta<\/span><strong>5\.200/);
 h.el('plan-calendar-list').onchange({target:{closest:()=>({dataset:{workDate:'2026-11-20'},checked:true})}});
 assert.match(h.el('plan-capacity').innerHTML,/5\.600<\/strong><span>400 peças\/dia × 14 dias/);
 assert.match(h.el('plan-output-summary').innerHTML,/Faltam para a meta<\/span><strong>5\.600/);
 h.el('plan-output-pieces').value='450';
 h.el('plan-output-form').onsubmit({preventDefault(){}});
 assert.match(h.el('plan-capacity').innerHTML,/5\.200<\/strong><span>400 peças\/dia × 13 dias/);
 assert.match(h.el('plan-output-summary').innerHTML,/Faltam para a meta<\/span><strong>5\.150/);
});

test('monthly overflow follows the queue across several months without allocating the same stock twice',()=>{
 const h=harness();
 h.run("planToday=()=> '2026-11-30'");
 h.seed({
  parents:[{id:'first',number:'MAL-0001'},{id:'second',number:'MAL-0002'}],
  cuts:[{parentId:'first',pieces:250},{parentId:'second',pieces:50}]
 });
 h.run(`localStorage.setItem(planStorageKey(),JSON.stringify({
  'month:2026-11-01':{daily:100,queue:['first']},
  'month:2026-12-01':{daily:5,queue:['second','first']},
  'month:2027-01-01':{daily:100,queue:['first','second']}
 }))`);
 const project=()=>JSON.parse(h.run(`JSON.stringify([...projectSewingMonths(planPeriod('month','2026-11-01'),planPeriod('month','2027-02-01'),planToday()).values()].map(month=>({
  selected:[...month.allocation.selected].map(([id,lot])=>[id,lot.ready,lot.outside]),
  carried:[...month.carried],capacity:month.allocation.capacity
 })))`));
 let [nov,dec,jan,feb]=project();
 assert.deepEqual(nov.selected,[['first',100,150]]);
 assert.deepEqual(dec.selected,[['first',110,40],['second',0,50]]);
 assert.deepEqual(dec.carried,['first']);
 assert.deepEqual(jan.selected,[['first',40,0],['second',50,0]]);
 assert.deepEqual(feb.selected,[]);
 h.run(`localStorage.setItem(planStorageKey()+':calendario',JSON.stringify({'2026-12-25':true}))`);
 [,dec,jan]=project();
 assert.equal(dec.capacity,115);
 assert.deepEqual(jan.selected,[['first',35,0],['second',50,0]]);
});

test('future months can be opened and show inherited estimated pieces and capacity',()=>{
 const h=harness();
 h.run("planToday=()=> '2026-11-30'");
 h.seed({
  parents:[{id:'x',number:'MAL-0001',invoice:'123'}],
  records:[{purchaseId:'x',materials:{malha:{kg:100}}}]
 });
 h.el('plan-period-type').value='month';
 h.el('plan-period-date').value='2026-11-30';
 h.run('showSewingPlan()');
 const preventDefault=()=>{};
 h.el('plan-daily').value='100';
 h.el('plan-capacity-form').onsubmit({preventDefault});
 h.el('plan-stock').onsubmit({preventDefault,target:{closest:()=>({dataset:{planEstimate:'x'},querySelector:()=>({value:'260'})})}});
 h.el('plan-add-all').onclick();
 assert.match(h.el('plan-stock').innerHTML,/160 passam para o mês seguinte/);
 assert.match(h.el('plan-upcoming-list').innerHTML,/dezembro de 2026[\s\S]*Capacidade<\/dt><dd>2\.200<\/dd>[\s\S]*Programadas<\/dt><dd>160/);
 h.el('plan-upcoming-list').onclick({target:{closest:()=>({dataset:{planOpenMonth:'2026-12-01'}})}});
 assert.equal(h.el('plan-daily').value,100);
 assert.match(h.el('plan-stock').innerHTML,/160 peças no plano[\s\S]*Saldo de meses anteriores/);
 assert.doesNotMatch(h.el('plan-stock').innerHTML,/Incluir na fila/);
 h.el('plan-month-nav').onclick({target:{closest:()=>({dataset:{planMonthStep:'1'}})}});
 assert.equal(h.el('plan-period-date').value,'2027-01-01');
 assert.match(h.el('plan-stock').innerHTML,/260 peças programadas em meses anteriores/);
 h.run("planToday=()=> '2026-12-01'; renderSewingPlan()");
 assert.match(h.el('plan-stock').innerHTML,/260 peças programadas em meses anteriores/);
 assert.equal(h.run("loadPlans()['month:2026-12-01']"),undefined);
});
