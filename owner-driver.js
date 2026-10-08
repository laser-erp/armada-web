/* Кабинет «Собственник-водитель» — только ?ownerDriverPreview=1 (sessionStorage). */
const OWNER_DRIVER_PREVIEW_KEY='armada_owner_driver_preview_v1';
const OWNER_DRIVER_PREVIEW_PARAM='ownerDriverPreview';

function captureOwnerDriverPreviewFromUrl(){
  try{
    const q=new URLSearchParams(location.search||'');
    if(q.get(OWNER_DRIVER_PREVIEW_PARAM)==='1') sessionStorage.setItem(OWNER_DRIVER_PREVIEW_KEY,'1');
    if(q.get(OWNER_DRIVER_PREVIEW_PARAM)==='0') sessionStorage.removeItem(OWNER_DRIVER_PREVIEW_KEY);
  }catch(_){}
}

function isOwnerDriverPreviewEnabled(){
  try{ return sessionStorage.getItem(OWNER_DRIVER_PREVIEW_KEY)==='1'; }catch(_){ return false; }
}

function isOwnerDriverCabinetActive(){
  if(!isOwnerDriverPreviewEnabled()) return false;
  return typeof isOwnerDriverCabinetMode==='function'&&isOwnerDriverCabinetMode();
}

function ownerDriverSpaceId(){
  const sp=ownerDriverSpaceForSession();
  if(sp&&sp.id) return sp.id;
  if(typeof spaceIdForDriverCompany==='function') return spaceIdForDriverCompany(DRIVER_COMPANY_ID);
  return null;
}

function ownerDriverSpaceForSession(){
  const sid=typeof spaceIdForDriverCompany==='function'?spaceIdForDriverCompany(DRIVER_COMPANY_ID):null;
  if(sid&&typeof findSpaceById==='function') return findSpaceById(sid);
  return null;
}

let ownerDriverEditCounterpartyId=null;

function ownerDriverCounterpartyModuleEnabled(){
  const sp=ownerDriverSpaceForSession();
  return typeof spaceModuleEnabled==='function'?spaceModuleEnabled(sp,'counterparties'):true;
}

function ownerDriverDocsModuleEnabled(){
  const sp=ownerDriverSpaceForSession();
  return typeof spaceModuleEnabled==='function'?spaceModuleEnabled(sp,'docs'):true;
}

function ownerDriverMaintenanceModuleEnabled(){
  const sp=ownerDriverSpaceForSession();
  return typeof spaceModuleEnabled==='function'?spaceModuleEnabled(sp,'maintenance'):true;
}

function ownerDriverFuelModuleEnabled(){
  const sp=ownerDriverSpaceForSession();
  return typeof spaceModuleEnabled==='function'?spaceModuleEnabled(sp,'fuel'):true;
}

function ownerDriverVehicleNavEnabled(){
  return ownerDriverMaintenanceModuleEnabled()||ownerDriverFuelModuleEnabled();
}

let ownerDriverSelectedVehicleId=null;
let ownerDriverFuelPeriodFrom=null;
let ownerDriverFuelPeriodTo=null;

function ownerDriverOwnCompany(){
  const sid=ownerDriverSpaceId();
  if(!sid) return null;
  if(typeof ownCompanyForSpaceId==='function'){
    const co=ownCompanyForSpaceId(sid);
    if(co) return co;
  }
  return (state.companies||[]).find(c=>c.spaceId===sid&&typeof companyHasRole==='function'&&companyHasRole(c,'own'))||null;
}

function ownerDriverCanManageCounterparty(c){
  if(!c||!c.id) return false;
  const sid=ownerDriverSpaceId();
  if(!sid||c.spaceId!==sid) return false;
  if(typeof companyHasRole==='function'&&companyHasRole(c,'own')) return false;
  return true;
}

/** Контрагенты только своего space (без «нашей фирмы»). */
function ownerDriverCounterparties(){
  if(!ownerDriverCounterpartyModuleEnabled()) return [];
  const sid=ownerDriverSpaceId();
  if(!sid) return [];
  return (state.companies||[]).filter(c=>{
    if(!c||c.spaceId!==sid) return false;
    if(typeof companyHasRole==='function'&&companyHasRole(c,'own')) return false;
    return true;
  }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru'));
}

function ownerDriverSyncModuleNav(){
  const cp=$('od-nav-counterparties');
  if(cp) cp.hidden=!ownerDriverCounterpartyModuleEnabled();
  const veh=$('od-nav-vehicle');
  if(veh) veh.hidden=!ownerDriverVehicleNavEnabled();
}

function ownerDriverNavIds(){
  return ['od-nav-home','od-nav-trips','od-nav-create','od-nav-vehicle','od-nav-counterparties','od-nav-settings'];
}

function ownerDriverFleetVehicles(){
  const co=ownerDriverOwnCompany();
  const sid=ownerDriverSpaceId();
  if(!co||typeof fleetVehiclesForCompany!=='function') return [];
  return fleetVehiclesForCompany(co.id).filter(v=>{
    if(!v||!v.plate) return false;
    if(sid&&v.spaceId&&v.spaceId!==sid) return false;
    return true;
  }).sort((a,b)=>String(a.plate||'').localeCompare(String(b.plate||''),'ru'));
}

function ownerDriverResolveVehicleId(){
  const list=ownerDriverFleetVehicles();
  if(!list.length) return null;
  if(ownerDriverSelectedVehicleId&&list.some(v=>v.id===ownerDriverSelectedVehicleId)) return ownerDriverSelectedVehicleId;
  const plate=(state.shift&&state.shift.vehiclePlate)||'';
  const hit=plate?list.find(v=>v.plate===plate):null;
  return (hit||list[0]).id;
}

function ownerDriverFuelDayIso(){
  return new Date().toISOString().slice(0,10);
}

function ownerDriverOrderDayIso(o){
  const raw=o&&(o.closedAt||o.endAt||o.createdAt);
  return raw?String(raw).slice(0,10):'';
}

/** Итоги топлива по закрытым рейсам (поля при закрытии заказа). */
function ownerDriverFuelAggregate(fromDay, toDay){
  let liters=0;
  let cost=0;
  let trips=0;
  const from=fromDay?String(fromDay).slice(0,10):null;
  const to=toDay?String(toDay).slice(0,10):null;
  ownerDriverMyOrders().forEach(o=>{
    if(typeof looksClosedOrder==='function'&&!looksClosedOrder(o)) return;
    const day=ownerDriverOrderDayIso(o);
    if(from&&day&&day<from) return;
    if(to&&day&&day>to) return;
    const fl=o.fuelLiters!=null?+o.fuelLiters:null;
    const fc=o.fuelTotalCost!=null?+o.fuelTotalCost:null;
    if(fl==null&&fc==null) return;
    if(fl!=null&&!Number.isNaN(fl)) liters+=fl;
    if(fc!=null&&!Number.isNaN(fc)) cost+=fc;
    else if(fl!=null&&o.fuelPricePerLiter!=null) cost+=fl*(+o.fuelPricePerLiter);
    trips+=1;
  });
  const r2=typeof round2==='function'?round2:x=>Math.round(x*100)/100;
  return {liters:r2(liters), cost:r2(cost), trips};
}

function ownerDriverTripDocsHtml(o){
  if(!ownerDriverDocsModuleEnabled()||!o||!o.id) return '';
  const id=esc(o.id);
  let html=`<div class="owner-driver-trip-docs">
    <button type="button" class="secondary od-doc-print" data-id="${id}" data-kind="application">Накладная</button>
    <button type="button" class="secondary od-doc-print" data-id="${id}" data-kind="paperTn">ТН</button>`;
  const sid=ownerDriverSpaceId();
  const et=sid&&typeof billingCanUseEtrn==='function'?billingCanUseEtrn(sid):{ok:false};
  if(et.ok){
    html+=`<button type="button" class="secondary od-doc-etrn" data-id="${id}">ЭТрН</button>`;
  }
  html+='</div>';
  return html;
}

function ownerDriverWireTripDocs(root){
  if(!root) return;
  root.querySelectorAll('.od-doc-print').forEach(b=>{
    b.onclick=()=>{
      const orderId=b.dataset.id;
      const kind=b.dataset.kind;
      if(orderId&&kind&&typeof printOrderDoc==='function') printOrderDoc(orderId, kind, b.dataset.audience||'customer');
    };
  });
  root.querySelectorAll('.od-doc-etrn').forEach(b=>{
    b.onclick=()=>{
      const orderId=b.dataset.id;
      if(!orderId||typeof openEtrnPrint!=='function') return;
      const o=(state.orders||[]).find(x=>x.id===orderId);
      if(o&&!o.etrn&&typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
      if(typeof upsertOrder==='function') upsertOrder(o);
      openEtrnPrint(orderId);
    };
  });
}

function ownerDriverParseNum(raw){
  const n=+String(raw||'').replace(',','.').trim();
  return n>0&&!Number.isNaN(n)?n:null;
}

function ownerDriverMyOrders(){
  const list=typeof allOrders==='function'?allOrders():[];
  return list.filter(o=>o&&typeof orderBelongsToDriver==='function'&&orderBelongsToDriver(o)&&!o.onExchange);
}

function ownerDriverOrderKm(o){
  if(!o) return null;
  if(o.loadedKm!=null) return o.loadedKm;
  if(o.startOdometer!=null&&o.endOdometer!=null) return Math.max(0,o.endOdometer-o.startOdometer);
  if(o.departOdometer!=null&&o.endOdometer!=null) return Math.max(0,o.endOdometer-o.departOdometer);
  return null;
}

function ownerDriverOrderPriceLabel(o){
  const r=typeof selectedRate==='function'?selectedRate(o):(o.rateCash!=null?o.rateCash:null);
  if(r==null||r==='') return '—';
  return typeof fmt==='function'?`${fmt(r)} ₽`:String(r);
}

function upgradeOwnerDriverNavIfNeeded(){
  const nav=document.querySelector('.owner-driver-nav');
  if(!nav||($('od-nav-settings')&&$('od-nav-vehicle'))) return;
  nav.innerHTML=`
      <button type="button" id="od-nav-home" class="on" aria-current="page"><span class="tab-ico" aria-hidden="true">●</span>Главная</button>
      <button type="button" id="od-nav-trips"><span class="tab-ico" aria-hidden="true">☰</span>Рейсы</button>
      <button type="button" id="od-nav-create"><span class="tab-ico" aria-hidden="true">＋</span>Создать</button>
      <button type="button" id="od-nav-vehicle" hidden><span class="tab-ico" aria-hidden="true">🚛</span>Машина</button>
      <button type="button" id="od-nav-counterparties"><span class="tab-ico" aria-hidden="true">◎</span>Контраг.</button>
      <button type="button" id="od-nav-settings"><span class="tab-ico" aria-hidden="true">⚙</span>Настройки</button>`;
  $('od-nav-home').onclick=()=>ownerDriverShowView('home');
  $('od-nav-trips').onclick=()=>ownerDriverShowView('trips');
  $('od-nav-create').onclick=()=>ownerDriverShowView('create');
  $('od-nav-vehicle').onclick=()=>ownerDriverShowView('vehicle');
  $('od-nav-counterparties').onclick=()=>ownerDriverShowView('counterparties');
  $('od-nav-settings').onclick=()=>ownerDriverShowView('settings');
  ownerDriverSyncModuleNav();
}

function ensureOwnerDriverShellDom(){
  const driver=$('driver');
  if(!driver) return;
  upgradeOwnerDriverNavIfNeeded();
  if($('owner-driver-main')) return;
  const main=document.createElement('div');
  main.id='owner-driver-main';
  main.className='owner-driver-main';
  main.hidden=true;
  main.innerHTML='<div id="owner-driver-view" class="owner-driver-view"></div>';
  const chat=$('chat');
  if(chat&&chat.parentNode) chat.parentNode.insertBefore(main, chat);
  else driver.appendChild(main);

  let nav=driver.querySelector('.owner-driver-nav');
  if(!nav){
    nav=document.createElement('nav');
    nav.className='driver-tabbar driver-nav owner-driver-nav';
    nav.setAttribute('aria-label','Собственник');
    nav.hidden=true;
    nav.innerHTML=`
      <button type="button" id="od-nav-home" class="on" aria-current="page"><span class="tab-ico" aria-hidden="true">●</span>Главная</button>
      <button type="button" id="od-nav-trips"><span class="tab-ico" aria-hidden="true">☰</span>Рейсы</button>
      <button type="button" id="od-nav-create"><span class="tab-ico" aria-hidden="true">＋</span>Создать</button>
      <button type="button" id="od-nav-vehicle" hidden><span class="tab-ico" aria-hidden="true">🚛</span>Машина</button>
      <button type="button" id="od-nav-counterparties"><span class="tab-ico" aria-hidden="true">◎</span>Контраг.</button>
      <button type="button" id="od-nav-settings"><span class="tab-ico" aria-hidden="true">⚙</span>Настройки</button>`;
    driver.appendChild(nav);
    $('od-nav-home').onclick=()=>ownerDriverShowView('home');
    $('od-nav-trips').onclick=()=>ownerDriverShowView('trips');
    $('od-nav-create').onclick=()=>ownerDriverShowView('create');
    $('od-nav-vehicle').onclick=()=>ownerDriverShowView('vehicle');
    $('od-nav-counterparties').onclick=()=>ownerDriverShowView('counterparties');
    $('od-nav-settings').onclick=()=>ownerDriverShowView('settings');
  }
  ownerDriverSyncModuleNav();
}

function ownerDriverSetNav(activeId){
  ownerDriverNavIds().forEach(id=>{
    const b=$(id); if(!b) return;
    const on=id===activeId;
    b.classList.toggle('on', on);
    if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
}

function ownerDriverActivateUi(){
  const driver=$('driver');
  if(!driver) return;
  driver.classList.add('owner-driver-active');
  const nav=driver.querySelector('.owner-driver-nav');
  if(nav) nav.hidden=false;
  const main=$('owner-driver-main');
  if(main) main.hidden=false;
  ownerDriverSyncModuleNav();
  ownerDriverShowView('home');
}

function ownerDriverDeactivateUi(){
  const driver=$('driver');
  if(!driver) return;
  driver.classList.remove('owner-driver-active');
  const nav=driver.querySelector('.owner-driver-nav');
  if(nav) nav.hidden=true;
  const main=$('owner-driver-main');
  if(main) main.hidden=true;
}

function ownerDriverShowView(view){
  const v=view||'home';
  if((v==='counterparties'||v==='counterparty-edit')&&!ownerDriverCounterpartyModuleEnabled()){
    ownerDriverShowView('home');
    return;
  }
  if(v==='vehicle'&&!ownerDriverVehicleNavEnabled()){
    ownerDriverShowView('home');
    return;
  }
  const navId=
    v==='home'?'od-nav-home':
    v==='trips'?'od-nav-trips':
    v==='create'?'od-nav-create':
    v==='vehicle'?'od-nav-vehicle':
    v==='settings'?'od-nav-settings':
    'od-nav-counterparties';
  ownerDriverSetNav(navId);
  if(v==='home') renderOwnerDriverHome();
  else if(v==='trips') renderOwnerDriverTrips();
  else if(v==='create') renderOwnerDriverCreateForm();
  else if(v==='vehicle') renderOwnerDriverVehicle();
  else if(v==='settings') renderOwnerDriverSettings();
  else if(v==='counterparty-edit') renderOwnerDriverCounterpartyForm(ownerDriverEditCounterpartyId);
  else renderOwnerDriverCounterparties();
}

function renderOwnerDriverHome(){
  const el=$('owner-driver-view');
  if(!el) return;
  const st=typeof driverHomeStats==='function'?driverHomeStats():{pay:0,km:0,kmHint:'',done:0,activeCount:0,shiftVal:'—',shiftCls:''};
  const pay=st.pay?((typeof fmt==='function'?fmt(st.pay):st.pay)+' ₽'):'—';
  const kmHtml=typeof driverDayKmHtml==='function'?driverDayKmHtml({km:st.km,hint:st.kmHint}):`<b>${typeof esc==='function'?esc(st.km!=null?st.km:'—'):'—'}</b>`;
  el.innerHTML=`
    <h2 class="owner-driver-h2">Главная</h2>
    <p class="hint owner-driver-hint">Предпросмотр кабинета собственника.</p>
    <div class="driver-home-summary owner-driver-summary">
      <div class="m"><span>Смена</span><b class="${esc(st.shiftCls||'')}">${esc(st.shiftVal||'—')}</b></div>
      <div class="m"><span>Км сегодня</span>${kmHtml}</div>
      <div class="m"><span>Закрыто заказов</span><b>${esc(String(st.done!=null?st.done:0))}</b></div>
      <div class="m"><span>Заработок сегодня</span><b class="accent">${esc(pay)}</b></div>
    </div>`;
}

function renderOwnerDriverTrips(){
  const el=$('owner-driver-view');
  if(!el) return;
  const rows=ownerDriverMyOrders();
  if(!rows.length){
    el.innerHTML='<h2 class="owner-driver-h2">Рейсы</h2><p class="hint">Пока нет заказов. Создайте заказ во вкладке «Создать».</p>';
    return;
  }
  const html=rows.map(o=>{
    const route=typeof routeText==='function'?routeText(o):`${o.loading||''} → ${o.unloading||''}`;
    const st=typeof statusText==='function'?statusText(o):'—';
    const km=ownerDriverOrderKm(o);
    const kmLbl=km!=null?(typeof fmt==='function'?fmt(km):km):'—';
    const cust=esc(o.customer||'—');
    return `<article class="owner-driver-trip" data-order-id="${esc(o.id)}">
      <div class="owner-driver-trip-head"><b>№${esc(o.sequentialNumber)}</b><span class="st">${esc(st)}</span></div>
      <div class="meta">${esc(route)}</div>
      <div class="meta">Заказчик: ${cust} · ${esc(kmLbl)} км · ${esc(ownerDriverOrderPriceLabel(o))}</div>
      ${ownerDriverTripDocsHtml(o)}
    </article>`;
  }).join('');
  el.innerHTML=`<h2 class="owner-driver-h2">Рейсы</h2><div class="owner-driver-trip-list">${html}</div>`;
  ownerDriverWireTripDocs(el);
}

function ownerDriverSetFormError(msg){
  const e=$('od-form-error');
  if(e) e.textContent=msg||'';
}

function renderOwnerDriverCreateForm(){
  const el=$('owner-driver-view');
  if(!el) return;
  const choices=ownerDriverCounterparties();
  const opts=choices.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  el.innerHTML=`
    <h2 class="owner-driver-h2">Создать заказ</h2>
    <p class="hint">Как у водителя: нужна открытая смена и завершённое ЕТО.</p>
    <form id="owner-driver-create-form" class="owner-driver-form">
      <label class="fld"><span>Заказчик из справочника</span>
        <select id="od-customer-select"><option value="">— новый —</option>${opts}</select></label>
      <label class="fld"><span>Или новый заказчик</span>
        <input id="od-customer-new" type="text" placeholder="Название" autocomplete="organization"/></label>
      <label class="fld"><span>Цена, ₽</span>
        <input id="od-price" type="text" inputmode="decimal" placeholder="15000"/></label>
      <label class="fld"><span>Адрес загрузки</span>
        <input id="od-loading" type="text" placeholder="Город, улица, дом"/></label>
      <label class="fld"><span>Адрес выгрузки</span>
        <input id="od-unloading" type="text" placeholder="Город, улица, дом"/></label>
      <div id="od-form-error" class="error" aria-live="polite"></div>
      <button type="submit" class="primary">Создать заказ</button>
    </form>`;
  const form=$('owner-driver-create-form');
  if(form) form.onsubmit=e=>{ e.preventDefault(); ownerDriverSubmitCreateOrder(); };
}

function renderOwnerDriverCounterparties(){
  const el=$('owner-driver-view');
  if(!el) return;
  const list=ownerDriverCounterparties();
  const rows=list.map(c=>`
    <button type="button" class="owner-driver-list-row" data-cp-id="${esc(c.id)}">
      <b>${esc(c.name)}</b>
      ${c.inn?`<span class="meta">ИНН ${esc(c.inn)}</span>`:''}
    </button>`).join('');
  el.innerHTML=`
    <h2 class="owner-driver-h2">Контрагенты</h2>
    <p class="hint">Только ваша фирма (space). Чужие кабинеты не показываются.</p>
    <button type="button" class="primary" id="od-cp-add">Добавить</button>
    <div class="owner-driver-list">${rows||'<p class="hint">Пока нет контрагентов.</p>'}</div>`;
  $('od-cp-add').onclick=()=>{ ownerDriverEditCounterpartyId=null; ownerDriverShowView('counterparty-edit'); };
  el.querySelectorAll('[data-cp-id]').forEach(b=>{
    b.onclick=()=>{ ownerDriverEditCounterpartyId=b.dataset.cpId; ownerDriverShowView('counterparty-edit'); };
  });
}

function renderOwnerDriverCounterpartyForm(companyId){
  const el=$('owner-driver-view');
  if(!el) return;
  const sid=ownerDriverSpaceId();
  let c=companyId&&typeof findCompanyById==='function'?findCompanyById(companyId):null;
  if(c&&!ownerDriverCanManageCounterparty(c)) c=null;
  if(!c){
    c={id:typeof uuid==='function'?uuid():String(Date.now()), name:'', inn:'', note:'', roles:['customer'], spaceId:sid};
  }
  const phone=(c.contacts&&c.contacts[0]&&c.contacts[0].phones&&c.contacts[0].phones[0])?c.contacts[0].phones[0].number:'';
  el.innerHTML=`
    <h2 class="owner-driver-h2">${companyId?'Контрагент':'Новый контрагент'}</h2>
    <form id="owner-driver-cp-form" class="owner-driver-form">
      <label class="fld"><span>Название</span><input id="od-cp-name" value="${esc(c.name||'')}" required /></label>
      <label class="fld"><span>ИНН</span><input id="od-cp-inn" inputmode="numeric" value="${esc(c.inn||'')}" /></label>
      <label class="fld"><span>Телефон</span><input id="od-cp-phone" inputmode="tel" value="${esc(typeof formatPhone==='function'?formatPhone(phone):phone)}" /></label>
      <label class="fld"><span>Примечание</span><input id="od-cp-note" value="${esc(c.note||'')}" /></label>
      <div id="od-cp-error" class="error" aria-live="polite"></div>
      <button type="submit" class="primary">Сохранить</button>
      <button type="button" class="secondary" id="od-cp-cancel">Отмена</button>
    </form>`;
  $('od-cp-cancel').onclick=()=>ownerDriverShowView('counterparties');
  $('owner-driver-cp-form').onsubmit=e=>{
    e.preventDefault();
    ownerDriverSaveCounterparty(c.id);
  };
}

function ownerDriverSaveCounterparty(prevId){
  const err=$('od-cp-error');
  const setErr=m=>{ if(err) err.textContent=m||''; };
  const sid=ownerDriverSpaceId();
  if(!sid){ setErr('Не определён кабинет'); return; }
  const name=String(($('od-cp-name')||{}).value||'').trim();
  if(!name){ setErr('Укажите название'); return; }
  const existing=prevId&&typeof findCompanyById==='function'?findCompanyById(prevId):null;
  if(existing&&!ownerDriverCanManageCounterparty(existing)){ setErr('Нельзя менять чужую фирму'); return; }
  const phone=typeof formatPhone==='function'?formatPhone(($('od-cp-phone')||{}).value||''):'';
  const contacts=phone?[{id:typeof uuid==='function'?uuid():'1', name:'', title:'', phones:[{id:typeof uuid==='function'?uuid():'1', number:phone, label:''}], isPrimary:true}]:[];
  const saved=typeof upsertCompany==='function'?upsertCompany({
    id:prevId||undefined,
    name,
    inn:String(($('od-cp-inn')||{}).value||'').replace(/\D/g,''),
    note:String(($('od-cp-note')||{}).value||'').trim(),
    roles:['customer'],
    spaceId:sid,
    contacts
  }):null;
  if(saved&&saved.spaceId!==sid){ setErr('Сохранение отклонено: другой кабинет'); return; }
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('owner-driver-cp');
  if(typeof persist==='function') persist();
  ownerDriverEditCounterpartyId=null;
  ownerDriverShowView('counterparties');
}

function renderOwnerDriverSettings(){
  const el=$('owner-driver-view');
  if(!el) return;
  const co=ownerDriverOwnCompany();
  if(!co){
    el.innerHTML='<h2 class="owner-driver-h2">Настройки</h2><p class="hint">Не найдена «наша фирма» для вашего кабинета.</p>';
    return;
  }
  const fin=typeof financeForCompanyId==='function'?financeForCompanyId(co.id):normalizeFinance(state.finance);
  el.innerHTML=`
    <h2 class="owner-driver-h2">Настройки расчёта</h2>
    <p class="hint">Только фирма <b>${esc(co.name)}</b>. Тарифы других кабинетов здесь не меняются.</p>
    <form id="owner-driver-settings-form" class="owner-driver-form">
      <label class="fld"><span>₽/км сверх пакета</span><input id="od-fin-km" inputmode="decimal" value="${esc(String(fin.defaultRatePerKmCash??''))}" /></label>
      <label class="fld"><span>₽/час работы</span><input id="od-fin-hour" inputmode="decimal" value="${esc(String(fin.defaultRatePerHourWork??''))}" /></label>
      <label class="fld"><span>Мин. часы работы</span><input id="od-fin-hours" inputmode="decimal" value="${esc(String(fin.minWorkHours??''))}" /></label>
      <label class="fld"><span>Часы подачи</span><input id="od-fin-podacha" inputmode="decimal" value="${esc(String(fin.podachaHours??''))}" /></label>
      <label class="fld"><span>Пакет, км</span><input id="od-fin-citykm" inputmode="decimal" value="${esc(String(fin.cityKmThreshold??''))}" /></label>
      <label class="fld"><span>Наценка, %</span><input id="od-fin-markup" inputmode="decimal" value="${esc(String(fin.markupPercent??''))}" /></label>
      <div id="od-fin-error" class="error" aria-live="polite"></div>
      <button type="submit" class="primary">Сохранить</button>
    </form>
    <p class="hint">Тарифы по типам кузова — в кабинете логиста (/a), раздел «Тариф».</p>`;
  $('owner-driver-settings-form').onsubmit=e=>{
    e.preventDefault();
    ownerDriverSaveSettings();
  };
}

function ownerDriverSaveSettings(){
  const err=$('od-fin-error');
  const setErr=m=>{ if(err) err.textContent=m||''; };
  const co=ownerDriverOwnCompany();
  if(!co){ setErr('Нет своей фирмы'); return; }
  const sid=ownerDriverSpaceId();
  if(co.spaceId!==sid){ setErr('Фирма не из вашего кабинета'); return; }
  const prev=typeof financeForCompanyId==='function'?financeForCompanyId(co.id):normalizeFinance(state.finance);
  const next=normalizeFinance(Object.assign({}, prev, {
    defaultRatePerKmCash:ownerDriverParseNum($('od-fin-km')&&$('od-fin-km').value)||prev.defaultRatePerKmCash,
    defaultRatePerHourWork:ownerDriverParseNum($('od-fin-hour')&&$('od-fin-hour').value),
    minWorkHours:ownerDriverParseNum($('od-fin-hours')&&$('od-fin-hours').value)||prev.minWorkHours,
    podachaHours:ownerDriverParseNum($('od-fin-podacha')&&$('od-fin-podacha').value)||prev.podachaHours,
    cityKmThreshold:ownerDriverParseNum($('od-fin-citykm')&&$('od-fin-citykm').value)||prev.cityKmThreshold,
    markupPercent:ownerDriverParseNum($('od-fin-markup')&&$('od-fin-markup').value)||prev.markupPercent
  }));
  const idx=(state.companies||[]).findIndex(c=>c.id===co.id);
  if(idx<0){ setErr('Компания не найдена'); return; }
  state.companies[idx].finance=next;
  state.finance=Object.assign({}, next);
  if(typeof recalculateOrderTariffsForCompany==='function') recalculateOrderTariffsForCompany(co.id);
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('owner-driver-finance');
  if(typeof persist==='function') persist();
  setErr('');
  renderOwnerDriverSettings();
}

function ownerDriverSubmitCreateOrder(){
  ownerDriverSetFormError('');
  if(typeof canDepartMessage==='function'){
    const gate=canDepartMessage();
    if(gate){ ownerDriverSetFormError(gate); return; }
  }
  if(typeof syncOpenShiftRuntime==='function') syncOpenShiftRuntime();
  const shift=state.shift||(typeof findOpenShift==='function'?findOpenShift():null);
  if(!shift||typeof isEtoDone!=='function'||!isEtoDone(shift)){
    ownerDriverSetFormError('Сначала откройте смену и завершите ЕТО');
    return;
  }
  const sid=ownerDriverSpaceId();
  if(!sid){ ownerDriverSetFormError('Не определён кабинет фирмы'); return; }

  const loading=String(($('od-loading')||{}).value||'').trim();
  const unloading=String(($('od-unloading')||{}).value||'').trim();
  const priceRaw=String(($('od-price')||{}).value||'').replace(',','.').trim();
  const price=+priceRaw;
  const pickId=String(($('od-customer-select')||{}).value||'').trim();
  const newName=String(($('od-customer-new')||{}).value||'').trim();

  if(!loading||!unloading){ ownerDriverSetFormError('Укажите адреса загрузки и выгрузки'); return; }
  if(!(price>0)){ ownerDriverSetFormError('Укажите цену больше нуля'); return; }

  let customer='';
  let customerId=null;
  if(pickId){
    const co=typeof findCompanyById==='function'?findCompanyById(pickId):null;
    if(!co||co.spaceId!==sid){ ownerDriverSetFormError('Заказчик не из вашей фирмы'); return; }
    customer=co.name||'';
    customerId=co.id;
  } else if(newName){
    customer=newName;
    if(typeof upsertCompany==='function'){
      const co=upsertCompany({name:newName, roles:['customer'], spaceId:sid});
      if(co){ customerId=co.id; customer=co.name||newName; }
    }
  } else {
    ownerDriverSetFormError('Выберите заказчика или введите нового');
    return;
  }

  state.draft={
    dayNumber:1,
    plate:shift.vehiclePlate||'',
    loading,
    unloading,
    transportDocMode:'paper_tn'
  };
  const ok=ownerDriverFinishOrder(unloading, {customer, customerId, rateCash:price});
  if(!ok) return;
  ownerDriverShowView('trips');
}

/** Как finishOrder в driver.js + заказчик и цена (существующие поля заказа). */
function ownerDriverFinishOrder(unloading, extra){
  extra=extra||{};
  const d=state.draft;
  if(!d||!DRIVER){ ownerDriverSetFormError('Нет сессии водителя'); return false; }
  const seqNo=typeof nextSequentialNumber==='function'?nextSequentialNumber():1;
  const createdAt=new Date().toISOString();
  const plate=d.plate||(state.shift&&state.shift.vehiclePlate)||'';
  const bind=typeof resolveDriverOrderBinding==='function'?resolveDriverOrderBinding(DRIVER, plate):{};
  if(DRIVER_COMPANY_ID){
    const rec=typeof findDriverRecord==='function'?findDriverRecord(DRIVER, DRIVER_COMPANY_ID):null;
    bind.ownCompanyId=DRIVER_COMPANY_ID;
    if(rec){
      bind.ownCompanyName=rec.companyName||bind.ownCompanyName;
      bind.spaceId=rec.spaceId||bind.spaceId;
      bind.ownerAdminId=rec.ownerAdminId||bind.ownerAdminId;
      bind.ownerAdminName=rec.ownerAdminName||bind.ownerAdminName;
    } else {
      const co=typeof findCompanyById==='function'?findCompanyById(DRIVER_COMPANY_ID):null;
      if(co){ bind.ownCompanyName=co.name; bind.spaceId=co.spaceId||bind.spaceId; }
    }
  }
  if(state.shift&&state.shift.ownCompanyId){
    bind.ownCompanyId=state.shift.ownCompanyId;
    bind.ownCompanyName=state.shift.ownCompanyName||bind.ownCompanyName;
    bind.spaceId=state.shift.spaceId||bind.spaceId;
    bind.ownerAdminId=state.shift.ownerAdminId||bind.ownerAdminId;
    bind.ownerAdminName=state.shift.ownerAdminName||bind.ownerAdminName;
  }
  const order={
    id:typeof uuid==='function'?uuid():String(Date.now()),
    sequentialNumber:seqNo,
    dayNumber:d.dayNumber,
    createdAt,
    source:'driver',
    vehiclePlate:plate,
    startOdometer:null,
    departOdometer:null,
    previousOdometer:null,
    loadingAddress:d.loading,
    unloadingAddress:unloading,
    loading:d.loading,
    unloading:unloading,
    routePoints:typeof defaultRoutePoints==='function'?defaultRoutePoints(d.loading,unloading):[],
    driverName:DRIVER,
    customer:extra.customer||'',
    customerId:extra.customerId||null,
    rateCash:extra.rateCash!=null?extra.rateCash:null,
    emptyKmBefore:null,
    driverPercent:typeof driverPercent==='function'?driverPercent(DRIVER, bind.ownCompanyId||DRIVER_COMPANY_ID):null,
    ownerAdminId:bind.ownerAdminId,
    ownerAdminName:bind.ownerAdminName,
    spaceId:bind.spaceId,
    ownCompanyId:bind.ownCompanyId||DRIVER_COMPANY_ID,
    ownCompanyName:bind.ownCompanyName,
    executorType:'own',
    onExchange:false,
    transportDocMode:(d.transportDocMode==='paper_tn'||d.transportDocMode==='etrn')?d.transportDocMode:'paper_tn'
  };
  if(typeof stampOrderDriverPhone==='function') stampOrderDriverPhone(order);
  if(typeof ensureRoutePoints==='function') ensureRoutePoints(order);
  if(typeof recomputeOrderTimes==='function') recomputeOrderTimes(order);
  if(!state.shift.orders) state.shift.orders=[];
  state.shift.orders.push(order);
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('owner-driver-create-order');
  if(typeof upsertOrder==='function') upsertOrder(order);
  if(typeof upsertShift==='function') upsertShift();
  if(typeof persist==='function') persist();
  state.draft={};
  state.orderStep='idle';
  state.error='';
  if(typeof renderInput==='function') renderInput();
  if(typeof renderDriverHome==='function') renderDriverHome();
  return true;
}

function ownerDriverVehicleStateIndex(vehicleId){
  const list=ownerDriverFleetVehicles();
  const v=list.find(x=>x.id===vehicleId);
  if(!v) return -1;
  return (state.vehicles||[]).findIndex(x=>x.id===v.id||(x.plate===v.plate&&x.companyId===v.companyId));
}

function ownerDriverMaintenanceLogHtml(v){
  const logs=[...(v.maintenanceLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));
  if(!logs.length) return '<p class="hint">Записей ТО/ремонта пока нет.</p>';
  const fmtN=typeof fmt==='function'?fmt:x=>String(x);
  const kl=typeof kindLabel==='function'?kindLabel:k=>k;
  return logs.map(l=>{
    const mats=(l.materials||[]).map(m=>`${m.name}${m.qty&&m.qty!==1?' ×'+m.qty:''}`).join('; ');
    return `<div class="owner-driver-svc-log" data-log="${esc(l.id)}">
      <div class="owner-driver-svc-log-head"><b>${esc(kl(l.kind))}: ${esc(l.title)}</b>
        <button type="button" class="icon-btn danger od-del-log" data-log-id="${esc(l.id)}" title="Удалить">×</button></div>
      <div class="meta">${esc(l.date)}${l.odometer!=null?' · одометр '+fmtN(l.odometer):''}</div>
      <div class="meta">Итого ${fmtN(l.total)} ₽</div>
      ${mats?`<div class="meta">${esc(mats)}</div>`:''}
    </div>`;
  }).join('');
}

function renderOwnerDriverVehicle(){
  const el=$('owner-driver-view');
  if(!el) return;
  if(!ownerDriverVehicleNavEnabled()){
    el.innerHTML='<h2 class="owner-driver-h2">Машина</h2><p class="hint">Раздел недоступен в вашем тарифе.</p>';
    return;
  }
  const fleet=ownerDriverFleetVehicles();
  const vid=ownerDriverResolveVehicleId();
  ownerDriverSelectedVehicleId=vid;
  const vi=vid?ownerDriverVehicleStateIndex(vid):-1;
  const v=vi>=0?state.vehicles[vi]:null;
  const pickOpts=fleet.map(f=>`<option value="${esc(f.id)}" ${f.id===vid?'selected':''}>${esc(f.plate)}${f.makeModel?' · '+esc(f.makeModel):''}</option>`).join('');
  const today=ownerDriverFuelDayIso();
  const from=ownerDriverFuelPeriodFrom||today;
  const to=ownerDriverFuelPeriodTo||today;
  const dayAgg=ownerDriverFuelAggregate(today, today);
  const periodAgg=ownerDriverFuelAggregate(from, to);
  const fmtN=typeof fmt==='function'?fmt:x=>String(x);
  const fuelBlock=ownerDriverFuelModuleEnabled()?`
    <section class="owner-driver-section">
      <h3 class="owner-driver-h3">Топливо по рейсам</h3>
      <p class="hint">Из данных при закрытии заказа (литры и сумма заправки).</p>
      <div class="owner-driver-fuel-summary">
        <div class="m"><span>Сегодня</span><b>${fmtN(dayAgg.liters)} л · ${fmtN(dayAgg.cost)} ₽</b><span class="meta">${dayAgg.trips} рейс.</span></div>
      </div>
      <div class="owner-driver-form owner-driver-fuel-period">
        <label class="fld"><span>Период с</span><input type="date" id="od-fuel-from" value="${esc(from)}"/></label>
        <label class="fld"><span>по</span><input type="date" id="od-fuel-to" value="${esc(to)}"/></label>
        <button type="button" class="secondary" id="od-fuel-apply">Показать</button>
      </div>
      <p class="meta">За период: <b>${fmtN(periodAgg.liters)} л</b> · <b>${fmtN(periodAgg.cost)} ₽</b> (${periodAgg.trips} рейс.)</p>
    </section>`:'';
  const maintBlock=ownerDriverMaintenanceModuleEnabled()&&v?`
    <section class="owner-driver-section">
      <h3 class="owner-driver-h3">ТО и ремонт</h3>
      <div class="owner-driver-svc-logs">${ownerDriverMaintenanceLogHtml(v)}</div>
      <div class="owner-driver-form" id="od-maint-form">
        <label class="fld"><span>Тип</span>
          <select id="od-log-kind"><option value="repair">Ремонт</option><option value="service" selected>ТО</option><option value="parts">Материалы</option></select></label>
        <label class="fld"><span>Дата</span><input id="od-log-date" type="date" value="${new Date().toISOString().slice(0,10)}"/></label>
        <label class="fld"><span>Что сделали</span><input id="od-log-title" placeholder="ТО-1, замена масла…"/></label>
        <label class="fld"><span>Одометр</span><input id="od-log-odo" inputmode="numeric" value="${v.currentOdometer??''}"/></label>
        <label class="fld"><span>Стоимость работ, ₽</span><input id="od-log-work" inputmode="decimal" placeholder="0"/></label>
        <label class="fld"><span>Материалы (название; кол-во; цена)</span>
          <textarea id="od-log-mats" rows="2" placeholder="Масло; 1; 4500"></textarea></label>
        <label class="fld"><span>Заметка</span><input id="od-log-note" placeholder="необязательно"/></label>
        <button type="button" class="primary" id="od-log-add">Добавить запись</button>
      </div>
    </section>`:(ownerDriverMaintenanceModuleEnabled()?'<p class="hint">Нет своих ТС в парке.</p>':'');
  el.innerHTML=`
    <h2 class="owner-driver-h2">Машина</h2>
    ${fleet.length?`<label class="fld"><span>Автомобиль</span><select id="od-vehicle-pick">${pickOpts}</select></label>`:'<p class="hint">В парке нет ТС вашей фирмы.</p>'}
    ${fuelBlock}
    ${maintBlock}`;
  $('od-vehicle-pick')&&($('od-vehicle-pick').onchange=()=>{
    ownerDriverSelectedVehicleId=$('od-vehicle-pick').value;
    renderOwnerDriverVehicle();
  });
  $('od-fuel-apply')&&($('od-fuel-apply').onclick=()=>{
    ownerDriverFuelPeriodFrom=($('od-fuel-from')||{}).value||today;
    ownerDriverFuelPeriodTo=($('od-fuel-to')||{}).value||today;
    renderOwnerDriverVehicle();
  });
  $('od-log-add')&&($('od-log-add').onclick=()=>ownerDriverAddMaintenanceLog(vi));
  el.querySelectorAll('.od-del-log').forEach(b=>{
    b.onclick=()=>ownerDriverDeleteMaintenanceLog(vi, b.dataset.logId);
  });
}

function ownerDriverAddMaintenanceLog(vi){
  if(vi<0) return;
  const v=state.vehicles[vi];
  if(!v) return;
  const title=String(($('od-log-title')||{}).value||'').trim();
  if(!title){ alert('Укажите, что сделали'); return; }
  const matsRaw=String(($('od-log-mats')||{}).value||'').split(/\n/).map(s=>s.trim()).filter(Boolean);
  const materials=matsRaw.map(line=>{
    const parts=line.split(';').map(x=>x.trim());
    const name=parts[0]||'';
    const qty=+String(parts[1]||'1').replace(',','.')||1;
    const unitCost=+String(parts[2]||'0').replace(',','.')||0;
    return typeof normalizeMaterialLine==='function'?normalizeMaterialLine({name, qty, unitCost}):{name, qty, unitCost, sum:qty*unitCost};
  }).filter(Boolean);
  const workCost=+String(($('od-log-work')||{}).value||'0').replace(',','.')||0;
  const odometer=typeof numOrNull==='function'?numOrNull(($('od-log-odo')||{}).value):null;
  const log=typeof normalizeMaintenanceLog==='function'?normalizeMaintenanceLog({
    date:String(($('od-log-date')||{}).value||'').trim()||new Date().toISOString().slice(0,10),
    odometer,
    kind:String(($('od-log-kind')||{}).value||'repair'),
    title,
    materials,
    workCost,
    note:String(($('od-log-note')||{}).value||'').trim()
  }):{id:String(Date.now()), date:new Date().toISOString().slice(0,10), title, workCost, materials, total:workCost};
  v.maintenanceLogs=v.maintenanceLogs||[];
  v.maintenanceLogs.unshift(log);
  if(odometer!=null) v.currentOdometer=odometer;
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('owner-driver-maint');
  if(typeof persist==='function') persist();
  renderOwnerDriverVehicle();
}

function ownerDriverDeleteMaintenanceLog(vi, logId){
  if(vi<0||!logId) return;
  const v=state.vehicles[vi];
  if(!v||!confirm('Удалить запись?')) return;
  v.maintenanceLogs=(v.maintenanceLogs||[]).filter(x=>x.id!==logId);
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('owner-driver-maint-del');
  if(typeof persist==='function') persist();
  renderOwnerDriverVehicle();
}

function patchHideDriverPanelsForOwner(){
  if(typeof hideDriverPanels!=='function'||hideDriverPanels.__ownerPatch) return;
  const prev=hideDriverPanels;
  hideDriverPanels=function(){
    prev();
    const p=$('owner-driver-panel');
    if(p) p.classList.remove('show');
  };
  hideDriverPanels.__ownerPatch=true;
}

function syncOwnerDriverChrome(){
  if(!isOwnerDriverCabinetActive()) return;
  const onDriver=!!(typeof DRIVER!=='undefined'&&DRIVER&&document.querySelector('#driver.show'));
  if(onDriver) ownerDriverActivateUi();
  else ownerDriverDeactivateUi();
}

function wrapEnterAsDriverForOwnerCabinet(){
  if(typeof enterAsDriver!=='function'||enterAsDriver.__ownerDriverWrap) return;
  const prev=enterAsDriver;
  const wrapped=async function(rec){
    await prev(rec);
    if(isOwnerDriverCabinetActive()){
      ensureOwnerDriverShellDom();
      syncOwnerDriverChrome();
    }
  };
  wrapped.__ownerDriverWrap=true;
  enterAsDriver=wrapped;
}

function wrapLeaveDriverForOwnerCabinet(){
  if(typeof leaveDriverMode!=='function'||leaveDriverMode.__ownerLeaveWrap) return;
  const prev=leaveDriverMode;
  leaveDriverMode=async function(...args){
    ownerDriverDeactivateUi();
    return prev.apply(this, args);
  };
  leaveDriverMode.__ownerLeaveWrap=true;
}

function initOwnerDriverShell(){
  ensureOwnerDriverShellDom();
  patchHideDriverPanelsForOwner();
  wrapEnterAsDriverForOwnerCabinet();
  wrapLeaveDriverForOwnerCabinet();
  syncOwnerDriverChrome();
}

captureOwnerDriverPreviewFromUrl();
if(isOwnerDriverPreviewEnabled()) initOwnerDriverShell();
