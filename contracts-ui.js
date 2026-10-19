/* АРМАДА — UI реестра договоров */
let contractEditorReturnTab='companies';

function contractCatalogSpaceId(){
  if(typeof isSuperAdmin==='function'&&isSuperAdmin()){
    const f=state.adminOwnerFilter||'all';
    if(f==='all') return null;
    if(f==='_none') return '_none';
    return f;
  }
  return typeof currentSpaceId==='function'?currentSpaceId():null;
}
/** Договор в журнале справочника: супер «Все кабинеты» — все; иначе spaceId договора или кабинет контрагента/нашей фирмы. */
function contractInCatalogScope(c){
  if(!c||!c.id) return false;
  const view=contractCatalogSpaceId();
  if(view===null) return true;
  if(view==='_none') return !c.spaceId;
  if(c.spaceId===view) return true;
  const cp=c.counterpartyId&&typeof findCompanyById==='function'?findCompanyById(c.counterpartyId):null;
  if(cp&&cp.spaceId===view) return true;
  const our=c.ourCompanyId&&typeof findCompanyById==='function'?findCompanyById(c.ourCompanyId):null;
  if(our&&our.spaceId===view) return true;
  return false;
}
function contractsInCatalogScope(){
  ensureContractsState();
  return (state.contracts||[]).filter(contractInCatalogScope);
}

function catalogContractsJournalHtml(){
  const list=contractsInCatalogScope();
  const rows=list.map(c=>{
    const cp=findCompanyById(c.counterpartyId);
    const our=findCompanyById(c.ourCompanyId);
    const meta=[
      contractTypeLabel(c.type),
      contractStatusLabel(c.status),
      cp?cp.name:'—',
      our?`наша: ${our.name}`:null,
      c.orderId?'заявка':null
    ].filter(Boolean).join(' · ');
    return `<div class="dense-row" data-contract-row="${esc(c.id)}">
      <button type="button" class="grow" data-open-contract="${esc(c.id)}">
        <div class="name">${esc(c.contractNumber||'—')} · ${esc(c.contractDate||'')}</div>
        <div class="meta">${esc(meta)}</div>
      </button>
    </div>`;
  }).join('')||'<div class="hint">Пока нет договоров — нажмите «+ Создать договор»</div>';
  return `<p class="cat-panel-hint">Журнал всех договоров в выбранном кабинете. Рамочные и договоры-заявки на рейсы.</p>
    <div class="row" style="gap:6px;flex-wrap:wrap">
      <input class="cat-search" id="contracts-journal-search" placeholder="Поиск: номер, контрагент…" style="flex:1;margin:0;min-width:140px" />
      <select id="contracts-journal-status" style="flex:0 0 auto">
        <option value="">Все статусы</option>
        <option value="draft">Черновик</option>
        <option value="active">Действует</option>
        <option value="terminated">Расторгнут</option>
      </select>
      <button type="button" class="primary cat-add-btn" id="contracts-journal-new" style="width:auto;flex:0 0 auto;padding:8px 12px!important">+ Создать</button>
    </div>
    <div class="cat-list" id="contracts-journal-list">${rows}</div>
    <div id="contract-editor" class="co-editor-box"></div>`;
}

function wireCatalogContractsJournal(){
  const filter=()=>{
    const q=(($('contracts-journal-search')||{}).value||'').trim().toLowerCase();
    const st=(($('contracts-journal-status')||{}).value||'');
    document.querySelectorAll('#contracts-journal-list [data-contract-row]').forEach(row=>{
      const id=row.dataset.contractRow;
      const c=findContractById(id);
      const cp=c&&findCompanyById(c.counterpartyId);
      const text=`${c&&c.contractNumber||''} ${cp&&cp.name||''}`.toLowerCase();
      const okSt=!st||(c&&c.status===st);
      row.style.display=okSt&&(!q||text.includes(q))?'':'none';
    });
  };
  const search=$('contracts-journal-search');
  if(search) search.oninput=filter;
  const sel=$('contracts-journal-status');
  if(sel) sel.onchange=filter;
  const neu=$('contracts-journal-new');
  if(neu) neu.onclick=()=>{
    const list=(state.companies||[]).filter(c=>c&&c.id&&typeof companyHasRole==='function'&&!companyHasRole(c,'own')&&typeof companyInMySpace==='function'&&companyInMySpace(c));
    const cp=list[0];
    if(!cp){ alert('Сначала выберите кабинет и добавьте контрагента'); return; }
    openContractEditor(createMainContractDraft({counterpartyId:cp.id, spaceId:cp.spaceId}),{fromJournal:true});
  };
  document.querySelectorAll('[data-open-contract]').forEach(b=>{
    b.onclick=()=>openContractEditor(findContractById(b.dataset.openContract),{fromJournal:true});
  });
}

function counterpartyContractsTabHtml(companyId){
  const list=contractsForCounterparty(companyId);
  const cards=list.map(c=>`<div class="dense-row">
    <button type="button" class="grow" data-co-contract-open="${esc(c.id)}">
      <div class="name">${esc(c.contractNumber)} · ${esc(contractStatusLabel(c.status))}</div>
      <div class="meta">${esc(c.subject||'')}</div>
    </button>
  </div>`).join('')||'<p class="hint">Нет договоров с этим контрагентом.</p>';
  return `<div id="co-contracts-tab">
    <h4>Договоры</h4>
    <button type="button" class="secondary" id="co-contract-new" style="width:auto;margin-bottom:8px">+ Создать договор</button>
    <div class="cat-list">${cards}</div>
  </div>`;
}

function wireCounterpartyContractsTab(companyId){
  const neu=$('co-contract-new');
  if(neu) neu.onclick=()=>{
    const co=findCompanyById(companyId);
    openContractEditor(createMainContractDraft({counterpartyId:companyId, spaceId:co&&co.spaceId}),{companyId});
  };
  document.querySelectorAll('[data-co-contract-open]').forEach(b=>{
    b.onclick=()=>openContractEditor(findContractById(b.dataset.coContractOpen),{companyId});
  });
}

function openContractEditor(contract, opts){
  opts=opts||{};
  const box=$('co-contract-editor')||$('contract-editor');
  if(!box){ alert('Редактор договоров недоступен'); return; }
  const c=contract?normalizeContract(contract):normalizeContract({
    id:uuid(),
    contractNumber:nextMainContractNumber(),
    contractDate:new Date().toISOString().slice(0,10),
    ourCompanyId:resolveOurCompanyIdForSpace(typeof catalogViewSpaceId==='function'?catalogViewSpaceId():currentSpaceId()),
    counterpartyId:opts.companyId||opts.counterpartyId||null,
    status:'draft',
    type:'carriage'
  });
  if(!c.ourCompanyId){
    const my=typeof currentOwnCompany==='function'?currentOwnCompany():null;
    if(my) c.ourCompanyId=my.id;
  }
  box.classList.add('show');
  const cp=findCompanyById(c.counterpartyId);
  const our=findCompanyById(c.ourCompanyId);
  const trips=(state.contracts||[]).filter(x=>x.parentContractId===c.id||x.orderId&&c.orderId===x.orderId);
  const linkedOrders=(state.orders||[]).filter(o=>o.contractId===c.id||o.tripContractId===c.id);
  box.innerHTML=`
    <div class="row" style="align-items:center;margin-bottom:6px">
      <h3 style="margin:0;flex:1;font-size:.95rem">Договор ${esc(c.contractNumber||'')}</h3>
      <button type="button" class="icon-btn" id="contract-editor-close" title="Закрыть">×</button>
    </div>
    <label>Номер</label><input id="ctr-number" value="${esc(c.contractNumber)}" />
    <label>Дата</label><input id="ctr-date" value="${esc(c.contractDate)}" placeholder="ГГГГ-ММ-ДД" />
    <label>Наша фирма</label><input id="ctr-our" value="${esc(our&&our.name||c.ourCompanyId||'')}" readonly />
    <label>Контрагент</label><input id="ctr-cp" value="${esc(cp&&cp.name||c.counterpartyId||'')}" readonly />
    <label>Тип</label>
    <select id="ctr-type">
      <option value="carriage" ${c.type==='carriage'?'selected':''}>Перевозка</option>
      <option value="services" ${c.type==='services'?'selected':''}>Услуги</option>
      <option value="agency" ${c.type==='agency'?'selected':''}>Агентский</option>
    </select>
    <label>Предмет</label><input id="ctr-subject" value="${esc(c.subject||'')}" />
    <label>Оплата, дней</label><input id="ctr-pay-days" inputmode="numeric" value="${esc(String(c.paymentTerms&&c.paymentTerms.days!=null?c.paymentTerms.days:30))}" />
    <label>Условия оплаты</label><input id="ctr-pay-desc" value="${esc(c.paymentTerms&&c.paymentTerms.description||'')}" />
    <label>Статус</label>
    <select id="ctr-status">
      <option value="draft" ${c.status==='draft'?'selected':''}>Черновик</option>
      <option value="active" ${c.status==='active'?'selected':''}>Действует</option>
      <option value="terminated" ${c.status==='terminated'?'selected':''}>Расторгнут</option>
    </select>
    <label>Подпись</label>
    <select id="ctr-sig-type">
      <option value="paper" ${c.signatureType==='paper'?'selected':''}>Бумага (скан)</option>
      <option value="ukep" ${c.signatureType==='ukep'?'selected':''}>УКЭП (ЭДО)</option>
      <option value="both" ${c.signatureType==='both'?'selected':''}>Скан + ЭДО</option>
    </select>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
      <label class="secondary" style="width:auto;cursor:pointer;padding:8px 12px">
        <input type="file" id="ctr-scan-file" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" hidden />
        Прикрепить скан (PDF/JPG)
      </label>
      <button type="button" class="secondary" id="ctr-edo-sign" style="width:auto">Подписать УКЭП (ЭДО)</button>
      ${c.fileUrl?'<button type="button" class="secondary" id="ctr-open-scan" style="width:auto">Открыть скан</button>':''}
    </div>
    <p class="hint">${c.fileUrl?'Скан прикреплён.':''}${c.edoId?` ЭДО: ${esc(c.edoId)}`:''}${c.signedAt?` · подписан ${esc(typeof dateTime==='function'?dateTime(c.signedAt):c.signedAt)}`:''}</p>
    ${linkedOrders.length?`<h4>Связанные заявки</h4><ul class="hint">${linkedOrders.slice(0,8).map(o=>`<li>№${esc(o.sequentialNumber)} ${esc(o.customer||'')}</li>`).join('')}</ul>`:''}
    ${trips.length?`<h4>Договоры-заявки</h4><ul class="hint">${trips.map(t=>`<li>${esc(t.contractNumber)}</li>`).join('')}</ul>`:''}
    <button type="button" class="primary cat-add-btn" id="ctr-save" style="margin-top:10px">Сохранить договор</button>
  `;
  $('contract-editor-close').onclick=()=>{ box.classList.remove('show'); box.innerHTML=''; };
  const fileIn=$('ctr-scan-file');
  if(fileIn){
    fileIn.onchange=()=>{
      const f=fileIn.files&&fileIn.files[0];
      if(!f) return;
      const reader=new FileReader();
      reader.onload=()=>{
        attachContractScanFile(c.id, reader.result);
        openContractEditor(findContractById(c.id), opts);
      };
      reader.readAsDataURL(f);
    };
  }
  $('ctr-edo-sign')&&($('ctr-edo-sign').onclick=()=>{
    signContractViaEdo(c.id);
    openContractEditor(findContractById(c.id), opts);
  });
  $('ctr-open-scan')&&($('ctr-open-scan').onclick=()=>{
    if(c.fileUrl&&typeof openPrintHtml==='function') openPrintHtml('Скан договора', `<img src="${c.fileUrl}" style="max-width:100%" alt="scan"/>`);
    else if(c.fileUrl) window.open(c.fileUrl,'_blank');
  });
  $('ctr-save').onclick=()=>{
    const saved=upsertContract({
      id:c.id,
      contractNumber:($('ctr-number').value||'').trim()||c.contractNumber,
      contractDate:($('ctr-date').value||'').trim()||c.contractDate,
      ourCompanyId:c.ourCompanyId,
      counterpartyId:c.counterpartyId,
      type:($('ctr-type').value||'carriage'),
      subject:($('ctr-subject').value||'').trim(),
      paymentTerms:{
        days:+($('ctr-pay-days').value||30),
        description:($('ctr-pay-desc').value||'').trim()
      },
      status:($('ctr-status').value||'draft'),
      signatureType:($('ctr-sig-type').value||'paper'),
      signedAt:c.signedAt,
      fileUrl:c.fileUrl,
      edoId:c.edoId,
      parentContractId:c.parentContractId,
      orderId:c.orderId,
      spaceId:c.spaceId
    });
    if(typeof persist==='function') persist();
    if(typeof flashCatOk==='function') flashCatOk('Договор сохранён');
    if(opts.fromJournal&&typeof openCatalogs==='function') openCatalogs();
    else openContractEditor(saved, opts);
  };
}

function orderContractsDetailHtml(o){
  if(!o) return '';
  migrateContractsRegistry();
  const cpId=cpIdFromOrder(o);
  const mains=cpId?contractsForCounterparty(cpId):[];
  const curMain=o.contractId||'';
  const trip=o.tripContractId?findContractById(o.tripContractId):findContractById(`ctr-mig-trip-${o.id}`);
  const main=curMain?findContractById(curMain):mains.find(c=>c.status==='active')||mains[0];
  const pay=main&&main.paymentTerms?main.paymentTerms:(trip&&trip.paymentTerms);
  const opts=mains.map(c=>`<option value="${esc(c.id)}" ${c.id===curMain?'selected':''}>${esc(c.contractNumber)} · ${esc(contractStatusLabel(c.status))}</option>`).join('');
  return `<section class="form-section" id="order-contracts-section">
    <h2 class="form-section-title">Договоры</h2>
    <div class="form-fields">
      <label for="d-main-contract">Основной договор</label>
      <select id="d-main-contract">
        <option value="">— не выбран —</option>
        ${opts||''}
      </select>
      <p class="hint">Договор-заявка: <strong>${esc(trip&&trip.contractNumber||'—')}</strong>${trip&&trip.signedAt?` · ${esc(typeof dateTime==='function'?dateTime(trip.signedAt):trip.signedAt)}`:''}</p>
      ${pay?`<p class="hint">Оплата: ${esc(String(pay.days))} дн. — ${esc(pay.description||'')}</p>`:''}
      ${trip?`<button type="button" class="secondary" id="d-open-trip-contract" style="width:auto">Открыть договор-заявку</button>`:''}
      ${main?`<button type="button" class="secondary" id="d-open-main-contract" style="width:auto;margin-left:6px">Открыть основной договор</button>`:''}
    </div>
  </section>`;
}

function wireOrderContractsDetail(o){
  const mainSel=$('d-main-contract');
  if(mainSel) mainSel.onchange=()=>{ o.contractId=mainSel.value||null; };
  $('d-open-trip-contract')&&($('d-open-trip-contract').onclick=()=>{
    const t=o.tripContractId?findContractById(o.tripContractId):findContractById(`ctr-mig-trip-${o.id}`);
    if(t) openContractEditor(t,{});
  });
  $('d-open-main-contract')&&($('d-open-main-contract').onclick=()=>{
    const m=o.contractId?findContractById(o.contractId):null;
    if(m) openContractEditor(m,{});
  });
}
