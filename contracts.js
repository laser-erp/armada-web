/* АРМАДА — реестр договоров contracts[] */
function normalizeContractPaymentTerms(raw){
  const p=raw&&typeof raw==='object'?raw:{};
  const days=+p.days;
  return {
    days:Number.isFinite(days)&&days>=0?Math.round(days):30,
    description:String(p.description||'').trim()||'Оплата в течение 30 дней'
  };
}
function normalizeContract(raw){
  const c=raw&&typeof raw==='object'?raw:{};
  const type=c.type==='services'||c.type==='agency'?c.type:'carriage';
  let status=c.status==='active'||c.status==='terminated'?c.status:'draft';
  const sig=c.signatureType==='ukep'||c.signatureType==='both'?c.signatureType:(c.signatureType==='paper'?'paper':'paper');
  const now=new Date().toISOString();
  return {
    id:c.id||uuid(),
    contractNumber:String(c.contractNumber||'').trim(),
    contractDate:c.contractDate||now.slice(0,10),
    ourCompanyId:c.ourCompanyId||null,
    counterpartyId:c.counterpartyId||null,
    type,
    subject:String(c.subject||'').trim()||'Перевозка грузов',
    paymentTerms:normalizeContractPaymentTerms(c.paymentTerms),
    status,
    signedAt:c.signedAt||null,
    fileUrl:c.fileUrl||null,
    signatureType:sig,
    edoId:c.edoId||null,
    parentContractId:c.parentContractId||null,
    orderId:c.orderId||null,
    spaceId:c.spaceId||null,
    migratedFrom:c.migratedFrom||null,
    createdAt:c.createdAt||now,
    updatedAt:c.updatedAt||now
  };
}
function ensureContractsState(){
  if(!Array.isArray(state.contracts)) state.contracts=[];
  if(!state.contractsCounter||typeof state.contractsCounter!=='object'){
    state.contractsCounter={year:new Date().getFullYear(), mainSeq:0, tripSeq:{}};
  }
  if(!state.contractsCounter.tripSeq||typeof state.contractsCounter.tripSeq!=='object') state.contractsCounter.tripSeq={};
}
function contractsCounterYear(){
  ensureContractsState();
  const y=new Date().getFullYear();
  if(state.contractsCounter.year!==y){
    state.contractsCounter.year=y;
    state.contractsCounter.mainSeq=0;
    state.contractsCounter.tripSeq={};
  }
  return y;
}
function nextMainContractNumber(){
  contractsCounterYear();
  state.contractsCounter.mainSeq=(state.contractsCounter.mainSeq||0)+1;
  const n=state.contractsCounter.mainSeq;
  const y=state.contractsCounter.year;
  return `${String(n).padStart(3,'0')}/${y}`;
}
function nextTripContractNumber(parentContract){
  if(!parentContract||!parentContract.id) return nextMainContractNumber();
  contractsCounterYear();
  const pid=parentContract.id;
  const tripSeq=state.contractsCounter.tripSeq;
  tripSeq[pid]=(tripSeq[pid]||0)+1;
  const n=tripSeq[pid];
  const base=String(parentContract.contractNumber||'').trim()||nextMainContractNumber();
  return `${base}-${String(n).padStart(2,'0')}`;
}
function bumpContractCounterFromNumber(contractNumber, isTrip){
  if(!contractNumber) return;
  const y=contractsCounterYear();
  const main=String(contractNumber).split('-')[0];
  const m=/^(\d+)\/(\d{4})$/.exec(main);
  if(m){
    const seq=+m[1];
    const yr=+m[2];
    if(yr===y&&seq>state.contractsCounter.mainSeq) state.contractsCounter.mainSeq=seq;
  }
  if(isTrip){
    const tm=/-(\d{2})$/.exec(String(contractNumber));
    if(tm){
      const tripN=+tm[1];
      const parent=state.contracts.find(c=>c.contractNumber===main);
      if(parent){
        const cur=state.contractsCounter.tripSeq[parent.id]||0;
        if(tripN>cur) state.contractsCounter.tripSeq[parent.id]=tripN;
      }
    }
  }
}
function findContractById(id){
  if(!id) return null;
  return (state.contracts||[]).find(c=>c.id===id)||null;
}
function upsertContract(raw){
  ensureContractsState();
  const c=normalizeContract(raw);
  const i=(state.contracts||[]).findIndex(x=>x.id===c.id);
  c.updatedAt=new Date().toISOString();
  if(i>=0) state.contracts[i]=Object.assign({}, state.contracts[i], c);
  else state.contracts.push(c);
  bumpContractCounterFromNumber(c.contractNumber, !!c.orderId);
  state.contracts.sort((a,b)=>String(b.contractDate).localeCompare(String(a.contractDate))||String(a.contractNumber).localeCompare(String(b.contractNumber),'ru'));
  return findContractById(c.id);
}
function contractsForCounterparty(companyId){
  if(!companyId) return [];
  return (state.contracts||[]).filter(c=>c.counterpartyId===companyId&&!c.orderId);
}
function contractsForOrder(orderId){
  return (state.contracts||[]).filter(c=>c.orderId===orderId);
}
function contractStatusLabel(st){
  if(st==='active') return 'Действует';
  if(st==='terminated') return 'Расторгнут';
  return 'Черновик';
}
function contractTypeLabel(t){
  if(t==='services') return 'Услуги';
  if(t==='agency') return 'Агентский';
  return 'Перевозка';
}
function resolveOurCompanyIdForSpace(spaceId){
  if(typeof ownCompanyForSpaceId==='function'&&spaceId){
    const co=ownCompanyForSpaceId(spaceId);
    if(co) return co.id;
  }
  const my=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  return my&&my.id||null;
}
function resolveExecutorOurCompanyIdForOrder(order){
  if(!order) return null;
  if(order.ownCompanyId) return order.ownCompanyId;
  const sid=order.partnerSpaceId||order.spaceId||null;
  return resolveOurCompanyIdForSpace(sid);
}
function mainCarrierContractsForOurCompany(carrierId, ourCompanyId){
  if(!carrierId) return [];
  return contractsForCounterparty(carrierId).filter(c=>!c.parentContractId&&(!ourCompanyId||c.ourCompanyId===ourCompanyId));
}
function findOrCreateMainCarrierContract(carrierId, ourCompanyId, spaceId){
  if(!carrierId||!ourCompanyId) return null;
  const list=mainCarrierContractsForOurCompany(carrierId, ourCompanyId);
  let parent=list.find(c=>c.status==='active')||list[0]||null;
  if(!parent) parent=createMainContractDraft({counterpartyId:carrierId, ourCompanyId, spaceId});
  return parent;
}
function frameworkStatusToContract(st){
  if(st==='signed') return 'active';
  if(st==='pending'||st==='pending_sign') return 'draft';
  return 'draft';
}
function migrateContractsRegistry(){
  ensureContractsState();
  let changed=false;
  (state.companies||[]).forEach(co=>{
    if(!co||!co.id||typeof companyHasRole!=='function') return;
    if(!companyHasRole(co,'customer')) return;
    const fc=co.frameworkContract;
    if(!fc||typeof fc!=='object') return;
    const migId=`ctr-mig-fw-${co.id}`;
    if(findContractById(migId)) return;
    const nfc=typeof normalizeFrameworkContract==='function'?normalizeFrameworkContract(fc):fc;
    const spaceId=co.spaceId||null;
    const ourId=resolveOurCompanyIdForSpace(spaceId);
    const sig=nfc.signMethod==='edo'?'ukep':(nfc.signMethod==='paper'?'paper':'paper');
    const ctr=upsertContract({
      id:migId,
      contractNumber:nextMainContractNumber(),
      contractDate:(nfc.signedAt||nfc.documentGeneratedAt||co.updatedAt||new Date().toISOString()).slice(0,10),
      ourCompanyId:ourId,
      counterpartyId:co.id,
      type:'carriage',
      subject:'Рамочный договор на перевозку грузов',
      paymentTerms:{days:30, description:'Оплата в течение 30 дней'},
      status:frameworkStatusToContract(nfc.status),
      signedAt:nfc.signedAt||null,
      signatureType:sig,
      edoId:nfc.edoOperator?String(nfc.edoOperator):null,
      spaceId,
      migratedFrom:'frameworkContract'
    });
    if(ctr) changed=true;
  });
  (state.orders||[]).forEach(o=>{
    if(!o||!o.id) return;
    const migId=`ctr-mig-trip-${o.id}`;
    if(findContractById(migId)) return;
    const app=o.transportApp;
    if(!app||typeof app!=='object') return;
    const spaceId=o.partnerSpaceId||o.spaceId||null;
    const ourId=resolveExecutorOurCompanyIdForOrder(o);
    const carrierId=o.carrierCompanyId||app.carrierCompanyId||null;
    const parent=findOrCreateMainCarrierContract(carrierId, ourId, spaceId);
    const ctr=upsertContract({
      id:migId,
      contractNumber:parent?nextTripContractNumber(parent):nextMainContractNumber(),
      contractDate:(app.signedAt||o.createdAt||new Date().toISOString()).slice(0,10),
      ourCompanyId:ourId,
      counterpartyId:carrierId||cpIdFromOrder(o),
      type:'carriage',
      subject:`Договор-заявка №${o.sequentialNumber||'—'} · ${app.route||''}`.trim(),
      paymentTerms:{days:30, description:'По условиям основного договора'},
      status:'active',
      signedAt:app.signedAt||null,
      signatureType:'paper',
      parentContractId:parent?parent.id:null,
      orderId:o.id,
      spaceId,
      migratedFrom:'transportApp'
    });
    if(ctr){
      if(!o.tripContractId) o.tripContractId=ctr.id;
      if(parent&&!o.carrierContractId) o.carrierContractId=parent.id;
      changed=true;
    }
  });
  if(changed&&typeof bumpDataEpoch==='function') bumpDataEpoch('contracts-registry');
  return changed;
}
function cpIdFromOrder(o){
  if(o.customerId) return o.customerId;
  const n=String(o.customer||'').trim();
  const hit=n&&typeof findCompanyByName==='function'?findCompanyByName(n):null;
  return hit&&hit.id||null;
}
function createMainContractDraft(opts){
  const ourId=opts.ourCompanyId||(typeof currentOwnCompany==='function'&&currentOwnCompany()&&currentOwnCompany().id);
  const cpId=opts.counterpartyId;
  if(!ourId||!cpId) return null;
  const co=findCompanyById(cpId);
  return upsertContract({
    id:uuid(),
    contractNumber:nextMainContractNumber(),
    contractDate:new Date().toISOString().slice(0,10),
    ourCompanyId:ourId,
    counterpartyId:cpId,
    type:opts.type||'carriage',
    subject:opts.subject||(co?`Договор с ${co.name}`:'Перевозка грузов'),
    paymentTerms:opts.paymentTerms,
    status:'draft',
    signatureType:'paper',
    spaceId:co&&co.spaceId||opts.spaceId||null
  });
}
function ensureTripContractFromTransportApp(order){
  if(!order||!order.id||!order.transportApp) return null;
  let trip=order.tripContractId?findContractById(order.tripContractId):findContractById(`ctr-mig-trip-${order.id}`);
  if(trip) return trip;
  migrateContractsRegistry();
  trip=order.tripContractId?findContractById(order.tripContractId):findContractById(`ctr-mig-trip-${order.id}`);
  if(trip) return trip;
  const app=order.transportApp;
  const carrierId=order.carrierCompanyId||app.carrierCompanyId||null;
  const spaceId=order.partnerSpaceId||order.spaceId||null;
  const ourCompanyId=resolveExecutorOurCompanyIdForOrder(order);
  const parent=findOrCreateMainCarrierContract(carrierId, ourCompanyId, spaceId);
  trip=upsertContract({
    id:`ctr-mig-trip-${order.id}`,
    contractNumber:parent?nextTripContractNumber(parent):nextMainContractNumber(),
    contractDate:(app.signedAt||new Date().toISOString()).slice(0,10),
    ourCompanyId:ourCompanyId,
    counterpartyId:carrierId||cpIdFromOrder(order),
    type:'carriage',
    subject:`Договор-заявка №${order.sequentialNumber||'—'}`,
    paymentTerms:{days:30, description:'По условиям основного договора'},
    status:'active',
    signedAt:app.signedAt||null,
    parentContractId:parent?parent.id:null,
    orderId:order.id,
    spaceId:spaceId,
    migratedFrom:'transportApp-live'
  });
  order.tripContractId=trip.id;
  if(parent) order.carrierContractId=parent.id;
  return trip;
}
function attachContractScanFile(contractId, dataUrl){
  const c=findContractById(contractId);
  if(!c) return null;
  const url=String(dataUrl||'').trim();
  if(!url) return null;
  if(url.length>900000){ alert('Файл слишком большой (до ~650 КБ)'); return null; }
  c.fileUrl=url;
  if(c.signatureType==='ukep') c.signatureType='both';
  else if(!c.edoId) c.signatureType='paper';
  c.updatedAt=new Date().toISOString();
  if(c.status==='draft'&&c.fileUrl) c.status='active';
  upsertContract(c);
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('contract-scan');
  if(typeof persist==='function') persist();
  return c;
}
function signContractViaEdo(contractId){
  const c=findContractById(contractId);
  if(!c) return null;
  const op=state.settings&&state.settings.epdOperator;
  if(!op){
    alert('ЭДО не подключён (оператор в «Активность»). Загрузите скан договора.');
    return null;
  }
  c.edoId=`edo-${op}-${c.id.slice(0,8)}`;
  c.signatureType=c.fileUrl?'both':'ukep';
  c.signedAt=c.signedAt||new Date().toISOString();
  c.status='active';
  upsertContract(c);
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('contract-edo');
  if(typeof persist==='function') persist();
  return c;
}
