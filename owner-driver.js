/* Кабинет собственника-водителя (/o/, JWT owner_driver). Preview-параметр — только для QA. */
const OWNER_DRIVER_PREVIEW_KEY='armada_owner_driver_preview_v1';
const OWNER_DRIVER_PREVIEW_PARAM='ownerDriverPreview';

function captureOwnerDriverPreviewFromUrl(){
  try{
    const q=new URLSearchParams(location.search||'');
    if(q.get(OWNER_DRIVER_PREVIEW_PARAM)==='1') sessionStorage.setItem(OWNER_DRIVER_PREVIEW_KEY,'1');
    if(q.get(OWNER_DRIVER_PREVIEW_PARAM)==='0') sessionStorage.removeItem(OWNER_DRIVER_PREVIEW_KEY);
  }catch(_){}
}

/** Устаревший флаг QA: не открывает чужой кабинет, только маркер для smoke/отладки. */
function isOwnerDriverPreviewEnabled(){
  try{ return sessionStorage.getItem(OWNER_DRIVER_PREVIEW_KEY)==='1'; }catch(_){ return false; }
}

function isOwnerDriverCabinetActive(){
  return typeof isOwnerDriverCabinetMode==='function'&&isOwnerDriverCabinetMode();
}

let ownerDriverHandoffToClassicUi=false;

const OWNER_DRIVER_DIR_LOCAL_MSG=
  'Сохранено только на этом устройстве. Контрагенты и тарифы из кабинета водителя на сервер не записываются — после обновления страницы подтянутся данные с сервера. Для постоянного сохранения используйте кабинет логиста (/a).';

function ownerDriverSpaceId(){
  if(typeof ownerDriverTrustedSpaceId==='function') return ownerDriverTrustedSpaceId();
  return null;
}

function ownerDriverSpaceForSession(){
  const sid=ownerDriverSpaceId();
  if(sid&&typeof findSpaceById==='function') return findSpaceById(sid);
  return null;
}

function ownerDriverMarkDirectoryLocalSave(){
  try{ sessionStorage.setItem('armada_od_dir_local_v1','1'); }catch(_){}
}

function ownerDriverConsumeDirectoryNotice(){
  try{
    if(sessionStorage.getItem('armada_od_dir_local_v1')==='1'){
      sessionStorage.removeItem('armada_od_dir_local_v1');
      return OWNER_DRIVER_DIR_LOCAL_MSG;
    }
  }catch(_){}
  return '';
}

function ownerDriverDirectoryNoticeHtml(){
  const msg=ownerDriverConsumeDirectoryNotice();
  if(!msg) return '';
  return `<p class="owner-driver-save-notice" role="status">${esc(msg)}</p>`;
}

function ownerDriverPersistDirectoryLocalOnly(){
  if(typeof persistLocalOnly==='function') persistLocalOnly();
  ownerDriverMarkDirectoryLocalSave();
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

function ownerDriverExchangeModuleEnabled(){
  const sp=ownerDriverSpaceForSession();
  return sp&&typeof spaceModuleEnabled==='function'?spaceModuleEnabled(sp,'exchange'):false;
}

const OWNER_DRIVER_EXCHANGE_LOCK_MSG=
  'Биржа доступна на тарифе «Средний». Чтобы сменить тариф, обратитесь к администратору.';

function ownerDriverEntitlementsForSession(){
  const sp=ownerDriverSpaceForSession();
  if(!sp||typeof resolveEntitlements!=='function') return {modules:{}, tariffId:null, maxVehicles:null};
  return resolveEntitlements(OWNER_DRIVER_ROLE, sp);
}

function ownerDriverIsMyFirmOrder(o){
  const co=ownerDriverOwnCompany();
  const sid=ownerDriverSpaceId();
  if(!o) return false;
  if(co&&o.ownCompanyId&&o.ownCompanyId===co.id) return true;
  return !!(sid&&o.spaceId===sid);
}

function ownerDriverLinkedAdmin(){
  const rec=typeof ownerDriverSessionRecord==='function'?ownerDriverSessionRecord():null;
  if(!rec||!rec.ownerAdminId) return null;
  return (state.admins||[]).find(a=>a&&a.id===rec.ownerAdminId)||null;
}

function ownerDriverSupportContactsHtml(){
  const plat=state.platform&&typeof state.platform==='object'?state.platform:{};
  const phone=String(plat.supportPhone||plat.operatorPhone||'').trim();
  const mail=String(plat.supportEmail||'').trim()||(typeof armadaMail==='function'?armadaMail('support'):'');
  const parts=[];
  if(phone) parts.push(`тел. <a href="tel:${esc(phone.replace(/\s/g,''))}">${esc(phone)}</a>`);
  if(mail) parts.push(`<a href="mailto:${esc(mail)}">${esc(mail)}</a>`);
  if(!parts.length) return '';
  return `<p class="hint">Поддержка: ${parts.join(' · ')}</p>`;
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
  const ex=$('od-nav-exchange');
  if(ex) ex.hidden=false;
  ownerDriverSyncMoreMenuModules();
}

function ownerDriverNavIds(){
  return ['od-nav-home','od-nav-trips','od-nav-create','od-nav-exchange','od-nav-vehicle','od-nav-counterparties','od-nav-tariff','od-nav-profile','od-nav-more'];
}

function ownerDriverEnsureMoreMenu(anchor){
  let menu=$('od-nav-more-menu');
  if(menu) return menu;
  menu=document.createElement('div');
  menu.id='od-nav-more-menu';
  menu.className='owner-driver-nav-more-menu';
  menu.hidden=true;
  menu.innerHTML=`
    <button type="button" data-od-more-view="vehicle" id="od-nav-more-vehicle" hidden>Машина</button>
    <button type="button" data-od-more-view="counterparties" id="od-nav-more-counterparties" hidden>Контрагенты</button>
    <button type="button" data-od-more-view="tariff" id="od-nav-more-tariff">Тариф</button>`;
  const host=anchor&&anchor.parentElement?anchor.parentElement:document.body;
  host.appendChild(menu);
  menu.querySelectorAll('[data-od-more-view]').forEach(btn=>{
    btn.onclick=()=>{
      menu.hidden=true;
      const v=btn.getAttribute('data-od-more-view');
      if(v&&typeof ownerDriverShowView==='function') ownerDriverShowView(v);
    };
  });
  return menu;
}

function ownerDriverSyncMoreMenuModules(){
  const veh=$('od-nav-more-vehicle');
  const cp=$('od-nav-more-counterparties');
  if(veh) veh.hidden=!ownerDriverVehicleNavEnabled();
  if(cp) cp.hidden=!ownerDriverCounterpartyModuleEnabled();
}

const OWNER_DRIVER_DESKTOP_MQ='(min-width: 1024px)';

function ownerDriverIsDesktop(){
  try{ return window.matchMedia(OWNER_DRIVER_DESKTOP_MQ).matches; }catch(_){ return false; }
}

function ownerDriverFormatDay(iso){
  if(!iso) return '—';
  const s=String(iso).slice(0,10);
  const p=s.split('-');
  return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:s;
}

function ownerDriverSyncSidebarHead(){
  const head=$('owner-driver-sidebar-head');
  if(!head) return;
  const co=ownerDriverOwnCompany();
  const fleet=ownerDriverFleetVehicles();
  const vid=ownerDriverResolveVehicleId();
  const veh=fleet.find(v=>v.id===vid)||null;
  const name=typeof DRIVER!=='undefined'&&DRIVER?esc(DRIVER):'—';
  const firm=co?esc(co.name||'—'):'—';
  const vehLine=veh
    ?`${esc(veh.plate||'—')}${veh.makeModel?' · '+esc(veh.makeModel):''}`
    :'—';
  head.innerHTML=`
    <p class="owner-driver-sidebar-role hint">Частный перевозчик</p>
    <div class="owner-driver-sidebar-name">${name}</div>
    <div class="owner-driver-sidebar-firm">${firm}</div>
    <div class="owner-driver-sidebar-veh">${vehLine}</div>`;
}

function ownerDriverSetHandoffClass(on){
  const driver=$('driver');
  if(driver) driver.classList.toggle('owner-driver-handoff', !!on);
}

function ownerDriverTripsTableHtml(rows){
  const body=rows.map(o=>{
    const route=typeof routeText==='function'?routeText(o):`${o.loading||''} → ${o.unloading||''}`;
    const st=typeof statusText==='function'?statusText(o):'—';
    const day=ownerDriverFormatDay(ownerDriverOrderDayIso(o)||o.createdAt);
    const cust=esc(o.customer||'—');
    const open=typeof looksClosedOrder==='function'?!looksClosedOrder(o):false;
    const acts=open?`<button type="button" class="primary od-trip-continue" data-id="${esc(o.id)}">Продолжить</button>`:'';
    return `<tr class="owner-driver-trip-row" data-order-id="${esc(o.id)}">
      <td><b>№${esc(o.sequentialNumber)}</b></td>
      <td>${esc(day)}</td>
      <td>${esc(route)}</td>
      <td>${cust}</td>
      <td>${esc(ownerDriverOrderPriceLabel(o))}</td>
      <td><span class="st">${esc(st)}</span></td>
      <td class="owner-driver-td-docs">${ownerDriverTripDocsHtml(o)}${acts}</td>
    </tr>`;
  }).join('');
  return `<table class="owner-driver-data-table"><thead><tr>
    <th>№</th><th>Дата</th><th>Маршрут</th><th>Заказчик</th><th>Сумма</th><th>Статус</th><th>Документы</th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

function ownerDriverCounterpartiesTableHtml(list){
  if(!list.length) return '<p class="hint">Пока нет контрагентов.</p>';
  const body=list.map(c=>`<tr class="owner-driver-cp-row" data-cp-id="${esc(c.id)}" tabindex="0" role="button">
    <td><b>${esc(c.name)}</b></td>
    <td>${c.inn?esc(c.inn):'—'}</td>
  </tr>`).join('');
  return `<table class="owner-driver-data-table owner-driver-cp-table"><thead><tr>
    <th>Название</th><th>ИНН</th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

function ownerDriverMaintenanceTableHtml(v){
  const logs=[...(v.maintenanceLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));
  if(!logs.length) return '<p class="hint">Записей ТО/ремонта пока нет.</p>';
  const fmtN=typeof fmt==='function'?fmt:x=>String(x);
  const kl=typeof kindLabel==='function'?kindLabel:k=>k;
  const body=logs.map(l=>`<tr data-log="${esc(l.id)}">
    <td>${esc(l.date)}</td>
    <td>${esc(kl(l.kind))}</td>
    <td>${esc(l.title)}</td>
    <td>${l.odometer!=null?fmtN(l.odometer):'—'}</td>
    <td>${fmtN(l.total)} ₽</td>
    <td><button type="button" class="icon-btn danger od-del-log" data-log-id="${esc(l.id)}" title="Удалить">×</button></td>
  </tr>`).join('');
  return `<table class="owner-driver-data-table owner-driver-maint-table"><thead><tr>
    <th>Дата</th><th>Тип</th><th>Работы</th><th>Одометр</th><th>Сумма</th><th></th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

function ownerDriverFuelOrdersInPeriod(fromDay, toDay){
  const from=fromDay?String(fromDay).slice(0,10):null;
  const to=toDay?String(toDay).slice(0,10):null;
  return ownerDriverMyOrders().filter(o=>{
    if(typeof looksClosedOrder==='function'&&!looksClosedOrder(o)) return false;
    const day=ownerDriverOrderDayIso(o);
    if(from&&day&&day<from) return false;
    if(to&&day&&day>to) return false;
    const fl=o.fuelLiters!=null?+o.fuelLiters:null;
    const fc=o.fuelTotalCost!=null?+o.fuelTotalCost:null;
    return fl!=null||fc!=null;
  }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}

function ownerDriverFuelTableHtml(fromDay, toDay){
  const rows=ownerDriverFuelOrdersInPeriod(fromDay, toDay);
  if(!rows.length) return '<p class="hint">За период нет рейсов с данными по топливу.</p>';
  const fmtN=typeof fmt==='function'?fmt:x=>String(x);
  const body=rows.map(o=>{
    const day=ownerDriverFormatDay(ownerDriverOrderDayIso(o)||o.createdAt);
    const route=typeof routeText==='function'?routeText(o):`${o.loading||''} → ${o.unloading||''}`;
    const liters=o.fuelLiters!=null?fmtN(o.fuelLiters):'—';
    const cost=o.fuelTotalCost!=null?fmtN(o.fuelTotalCost):(o.fuelLiters!=null&&o.fuelPricePerLiter!=null?fmtN(o.fuelLiters*+o.fuelPricePerLiter):'—');
    return `<tr><td>№${esc(o.sequentialNumber)}</td><td>${esc(day)}</td><td>${esc(route)}</td><td>${liters}</td><td>${cost} ₽</td></tr>`;
  }).join('');
  return `<table class="owner-driver-data-table owner-driver-fuel-table"><thead><tr>
    <th>№</th><th>Дата</th><th>Маршрут</th><th>Литры</th><th>Сумма</th>
  </tr></thead><tbody>${body}</tbody></table>`;
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
  if(!nav) return;
  if($('od-nav-exchange')&&$('od-nav-profile')&&$('od-nav-more')) return;
  delete nav.dataset.odWired;
  nav.innerHTML=`
      <button type="button" id="od-nav-home" class="on" aria-current="page"><span class="tab-ico" aria-hidden="true">●</span>Главная</button>
      <button type="button" id="od-nav-trips"><span class="tab-ico" aria-hidden="true">☰</span>Рейсы</button>
      <button type="button" id="od-nav-create"><span class="tab-ico" aria-hidden="true">＋</span>Создать</button>
      <button type="button" id="od-nav-exchange"><span class="tab-ico" aria-hidden="true">⇄</span>Биржа</button>
      <button type="button" id="od-nav-vehicle" class="owner-driver-nav-in-more" hidden><span class="tab-ico" aria-hidden="true">🚛</span>Машина</button>
      <button type="button" id="od-nav-counterparties" class="owner-driver-nav-in-more" hidden><span class="tab-ico" aria-hidden="true">◎</span>Контр.</button>
      <button type="button" id="od-nav-tariff" class="owner-driver-nav-in-more owner-driver-only-desktop"><span class="tab-ico" aria-hidden="true">★</span>Тариф</button>
      <button type="button" id="od-nav-profile"><span class="tab-ico" aria-hidden="true">👤</span>Профиль</button>
      <button type="button" id="od-nav-more" class="owner-driver-only-mobile" aria-expanded="false"><span class="tab-ico" aria-hidden="true">⋯</span>Ещё</button>`;
  ownerDriverWireNavButtons(nav);
  ownerDriverEnsureMoreMenu(nav);
  ownerDriverSyncModuleNav();
}

function ownerDriverWireNavButtons(nav){
  if(!nav) return;
  nav.dataset.odWired='1';
  $('od-nav-home').onclick=()=>ownerDriverShowView('home');
  $('od-nav-trips').onclick=()=>ownerDriverShowView('trips');
  $('od-nav-create').onclick=()=>ownerDriverShowView('create');
  $('od-nav-exchange').onclick=()=>ownerDriverShowView('exchange');
  $('od-nav-vehicle').onclick=()=>ownerDriverShowView('vehicle');
  $('od-nav-counterparties').onclick=()=>ownerDriverShowView('counterparties');
  $('od-nav-tariff').onclick=()=>ownerDriverShowView('tariff');
  $('od-nav-profile').onclick=()=>ownerDriverShowView('profile');
  const more=$('od-nav-more');
  const menu=ownerDriverEnsureMoreMenu(nav);
  if(more&&menu){
    more.onclick=(e)=>{
      e.stopPropagation();
      const open=menu.hidden;
      menu.hidden=!open;
      more.setAttribute('aria-expanded',open?'true':'false');
    };
  }
  ownerDriverSyncMoreMenuModules();
}

function ownerDriverEnsureSidebarFoot(sidebar){
  if(!sidebar) return;
  let foot=sidebar.querySelector('.owner-driver-sidebar-foot');
  if(!foot){
    foot=document.createElement('div');
    foot.className='owner-driver-sidebar-foot';
    foot.innerHTML='<button type="button" class="secondary owner-driver-logout" id="od-nav-logout">Выход</button>';
    sidebar.appendChild(foot);
    const btn=$('od-nav-logout');
    if(btn) btn.onclick=()=>{ if(typeof leaveDriverMode==='function') leaveDriverMode(); };
  }
}

function ownerDriverEnsureLayoutShell(driver){
  let shell=$('owner-driver-shell');
  if(!shell){
    shell=document.createElement('div');
    shell.id='owner-driver-shell';
    shell.className='owner-driver-shell';
    const sidebar=document.createElement('aside');
    sidebar.className='owner-driver-sidebar';
    sidebar.setAttribute('aria-label','Меню частного перевозчика');
    const head=document.createElement('div');
    head.id='owner-driver-sidebar-head';
    head.className='owner-driver-sidebar-head';
    sidebar.appendChild(head);
    ownerDriverEnsureSidebarFoot(sidebar);
    shell.appendChild(sidebar);
    let main=$('owner-driver-main');
    if(!main){
      main=document.createElement('div');
      main.id='owner-driver-main';
      main.className='owner-driver-main';
      main.hidden=true;
      main.innerHTML='<div id="owner-driver-view" class="owner-driver-view"></div>';
    }
    shell.appendChild(main);
    const chat=$('chat');
    if(chat&&chat.parentNode) chat.parentNode.insertBefore(shell, chat);
    else driver.appendChild(shell);
  } else {
    const sidebar=shell.querySelector('.owner-driver-sidebar');
    ownerDriverEnsureSidebarFoot(sidebar);
    const main=$('owner-driver-main');
    if(main&&main.parentElement!==shell) shell.appendChild(main);
  }
  const sidebar=shell.querySelector('.owner-driver-sidebar');
  const nav=driver.querySelector('.owner-driver-nav');
  if(sidebar&&nav&&nav.parentElement!==sidebar){
    const foot=sidebar.querySelector('.owner-driver-sidebar-foot');
    sidebar.insertBefore(nav, foot);
  }
  ownerDriverSyncSidebarHead();
}

function ensureOwnerDriverShellDom(){
  const driver=$('driver');
  if(!driver) return;
  upgradeOwnerDriverNavIfNeeded();
  ownerDriverEnsureLayoutShell(driver);

  let nav=driver.querySelector('.owner-driver-nav');
  if(!nav){
    nav=document.createElement('nav');
    nav.className='driver-tabbar driver-nav owner-driver-nav';
    nav.setAttribute('aria-label','Частный перевозчик');
    nav.hidden=true;
    nav.innerHTML=`
      <button type="button" id="od-nav-home" class="on" aria-current="page"><span class="tab-ico" aria-hidden="true">●</span>Главная</button>
      <button type="button" id="od-nav-trips"><span class="tab-ico" aria-hidden="true">☰</span>Рейсы</button>
      <button type="button" id="od-nav-create"><span class="tab-ico" aria-hidden="true">＋</span>Создать</button>
      <button type="button" id="od-nav-exchange"><span class="tab-ico" aria-hidden="true">⇄</span>Биржа</button>
      <button type="button" id="od-nav-vehicle" class="owner-driver-nav-in-more" hidden><span class="tab-ico" aria-hidden="true">🚛</span>Машина</button>
      <button type="button" id="od-nav-counterparties" class="owner-driver-nav-in-more" hidden><span class="tab-ico" aria-hidden="true">◎</span>Контр.</button>
      <button type="button" id="od-nav-tariff" class="owner-driver-nav-in-more owner-driver-only-desktop"><span class="tab-ico" aria-hidden="true">★</span>Тариф</button>
      <button type="button" id="od-nav-profile"><span class="tab-ico" aria-hidden="true">👤</span>Профиль</button>
      <button type="button" id="od-nav-more" class="owner-driver-only-mobile" aria-expanded="false"><span class="tab-ico" aria-hidden="true">⋯</span>Ещё</button>`;
    const sidebar=$('owner-driver-shell')?.querySelector('.owner-driver-sidebar');
    if(sidebar){
      const foot=sidebar.querySelector('.owner-driver-sidebar-foot');
      sidebar.insertBefore(nav, foot);
    } else driver.appendChild(nav);
  }
  ownerDriverWireNavButtons(nav);
  ownerDriverEnsureMoreMenu(nav);
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
  ensureOwnerDriverShellDom();
  driver.classList.add('owner-driver-active');
  ownerDriverSetHandoffClass(false);
  const nav=driver.querySelector('.owner-driver-nav');
  if(nav) nav.hidden=false;
  const main=$('owner-driver-main');
  if(main) main.hidden=false;
  ownerDriverSyncModuleNav();
  ownerDriverSyncSidebarHead();
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
    v==='exchange'?'od-nav-exchange':
    v==='vehicle'?'od-nav-vehicle':
    v==='tariff'?(ownerDriverIsDesktop()?'od-nav-tariff':'od-nav-profile'):
    v==='profile'?'od-nav-profile':
    v==='settings'?'od-nav-profile':
    'od-nav-counterparties';
  ownerDriverSetNav(navId);
  if(v==='home') renderOwnerDriverHome();
  else if(v==='trips') renderOwnerDriverTrips();
  else if(v==='create') renderOwnerDriverCreateForm();
  else if(v==='exchange') renderOwnerDriverExchange();
  else if(v==='vehicle') renderOwnerDriverVehicle();
  else if(v==='tariff') renderOwnerDriverTariff();
  else if(v==='profile') renderOwnerDriverProfile();
  else if(v==='theme'&&typeof renderOwnerDriverTheme==='function') renderOwnerDriverTheme();
  else if(v==='settings') renderOwnerDriverSettings();
  else if(v==='counterparty-edit') renderOwnerDriverCounterpartyForm(ownerDriverEditCounterpartyId);
  else renderOwnerDriverCounterparties();
}

function renderOwnerDriverHome(){
  const el=$('owner-driver-view');
  if(!el) return;
  const co=ownerDriverOwnCompany();
  const fleet=ownerDriverFleetVehicles();
  const vid=ownerDriverResolveVehicleId();
  const veh=fleet.find(v=>v.id===vid)||null;
  const st=typeof driverHomeStats==='function'?driverHomeStats():{pay:0,km:0,kmHint:'',done:0,activeCount:0,shiftVal:'—',shiftCls:''};
  const pay=st.pay?((typeof fmt==='function'?fmt(st.pay):st.pay)+' ₽'):'—';
  const kmHtml=typeof driverDayKmHtml==='function'?driverDayKmHtml({km:st.km,hint:st.kmHint}):`<b>${typeof esc==='function'?esc(st.km!=null?st.km:'—'):'—'}</b>`;
  const firmLine=co?`<p class="hint owner-driver-hint">Фирма: <b>${esc(co.name||'—')}</b></p>`:'';
  const vehLine=veh?`<p class="hint owner-driver-hint">Авто: <b>${esc(veh.plate||'—')}</b>${veh.makeModel?' · '+esc(veh.makeModel):''}</p>`:(fleet.length?'<p class="hint">Выберите авто во вкладке «Машина».</p>':'<p class="hint">В парке пока нет ТС вашей фирмы.</p>');
  const activeHint=st.activeCount?`<p class="hint">Активных рейсов: <b>${esc(String(st.activeCount))}</b> — продолжите во вкладке «Рейсы».</p>`:'';
  const noShift=!st.s||String(st.shiftVal||'')==='Нет';
  const emptyHint=!st.activeCount&&noShift?'<p class="hint owner-driver-empty">Нет рейсов. Откройте смену во вкладке «Рейсы» или создайте заказ.</p>':'';
  el.innerHTML=`
    <h2 class="owner-driver-h2">Главная</h2>
    ${firmLine}
    ${vehLine}
    ${emptyHint}
    ${activeHint}
    <div class="driver-home-summary owner-driver-summary">
      <div class="m"><span>Смена</span><b class="${esc(st.shiftCls||'')}">${esc(st.shiftVal||'—')}</b></div>
      <div class="m"><span>Км сегодня</span>${kmHtml}</div>
      <div class="m"><span>Закрыто заказов</span><b>${esc(String(st.done!=null?st.done:0))}</b></div>
      <div class="m"><span>Заработок сегодня</span><b class="accent">${esc(pay)}</b></div>
    </div>`;
  ownerDriverSyncSidebarHead();
}

function renderOwnerDriverTrips(){
  const el=$('owner-driver-view');
  if(!el) return;
  const rows=ownerDriverMyOrders();
  if(!rows.length){
    el.innerHTML=`${ownerDriverDirectoryNoticeHtml()}<h2 class="owner-driver-h2">Рейсы</h2><p class="hint">Пока нет заказов. Создайте заказ во вкладке «Создать».</p>`;
    return;
  }
  const html=rows.map(o=>{
    const route=typeof routeText==='function'?routeText(o):`${o.loading||''} → ${o.unloading||''}`;
    const st=typeof statusText==='function'?statusText(o):'—';
    const km=ownerDriverOrderKm(o);
    const kmLbl=km!=null?(typeof fmt==='function'?fmt(km):km):'—';
    const cust=esc(o.customer||'—');
    const open=typeof looksClosedOrder==='function'?!looksClosedOrder(o):false;
    const acts=open?`<button type="button" class="primary od-trip-continue" data-id="${esc(o.id)}">Продолжить рейс</button>`:'';
    return `<article class="owner-driver-trip" data-order-id="${esc(o.id)}">
      <div class="owner-driver-trip-head"><b>№${esc(o.sequentialNumber)}</b><span class="st">${esc(st)}</span></div>
      <div class="meta">${esc(route)}</div>
      <div class="meta">Заказчик: ${cust} · ${esc(kmLbl)} км · ${esc(ownerDriverOrderPriceLabel(o))}</div>
      ${acts}
      ${ownerDriverTripDocsHtml(o)}
    </article>`;
  }).join('');
  el.classList.remove('owner-driver-narrow');
  el.innerHTML=`${ownerDriverDirectoryNoticeHtml()}<h2 class="owner-driver-h2">Рейсы</h2><p class="hint">Закрытые — здесь; активный рейс — «Продолжить рейс» (смена, одометры, ЕТО).</p>
    <div class="owner-driver-trip-list owner-driver-only-mobile">${html}</div>
    <div class="owner-driver-table-wrap owner-driver-only-desktop">${ownerDriverTripsTableHtml(rows)}</div>`;
  ownerDriverWireTripDocs(el);
  el.querySelectorAll('.od-trip-continue').forEach(b=>{
    b.onclick=()=>ownerDriverEnterDriverWorkflow(b.dataset.id);
  });
}

function ownerDriverEnsureReturnBar(){
  const driver=$('driver');
  if(!driver||$('od-return-cabinet')) return;
  const bar=document.createElement('div');
  bar.id='od-return-cabinet';
  bar.className='owner-driver-return-bar';
  bar.hidden=true;
  bar.innerHTML='<button type="button" class="secondary" id="od-return-cabinet-btn">← Кабинет частного перевозчика</button>';
  driver.insertBefore(bar, driver.firstChild);
  $('od-return-cabinet-btn').onclick=()=>ownerDriverReturnToCabinet();
}

function ownerDriverSyncReturnBar(){
  const bar=$('od-return-cabinet');
  if(!bar) return;
  const show=ownerDriverHandoffToClassicUi&&isOwnerDriverCabinetActive()&&document.querySelector('#driver.show');
  bar.hidden=!show;
}

function ownerDriverEnterDriverWorkflow(orderId){
  if(!orderId) return;
  ownerDriverHandoffToClassicUi=true;
  ownerDriverSetHandoffClass(true);
  ownerDriverDeactivateUi();
  ownerDriverSyncReturnBar();
  if(typeof showOrders==='function') showOrders();
  else if(typeof showDriverHome==='function') showDriverHome();
  const card=document.querySelector(`#orders-list [data-order-id="${orderId}"]`)||document.querySelector(`#orders-list .drv-order-card`);
  if(card&&card.scrollIntoView) card.scrollIntoView({block:'nearest'});
}

function ownerDriverReturnToCabinet(){
  ownerDriverHandoffToClassicUi=false;
  ownerDriverSetHandoffClass(false);
  ownerDriverSyncReturnBar();
  if(typeof hideDriverPanels==='function') hideDriverPanels();
  ownerDriverActivateUi();
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
  el.classList.add('owner-driver-narrow');
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
  el.classList.remove('owner-driver-narrow');
  el.innerHTML=`
    ${ownerDriverDirectoryNoticeHtml()}
    <h2 class="owner-driver-h2">Контрагенты</h2>
    <p class="hint">Только ваша фирма (space). Чужие кабинеты не показываются.</p>
    <button type="button" class="primary" id="od-cp-add">Добавить</button>
    <div class="owner-driver-list owner-driver-only-mobile">${rows||'<p class="hint">Пока нет контрагентов.</p>'}</div>
    <div class="owner-driver-table-wrap owner-driver-only-desktop">${ownerDriverCounterpartiesTableHtml(list)}</div>`;
  $('od-cp-add').onclick=()=>{ ownerDriverEditCounterpartyId=null; ownerDriverShowView('counterparty-edit'); };
  const openCp=(id)=>{ ownerDriverEditCounterpartyId=id; ownerDriverShowView('counterparty-edit'); };
  el.querySelectorAll('[data-cp-id]').forEach(b=>{
    b.onclick=()=>openCp(b.dataset.cpId);
  });
  el.querySelectorAll('.owner-driver-cp-row').forEach(row=>{
    row.onclick=()=>openCp(row.dataset.cpId);
    row.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openCp(row.dataset.cpId); } };
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
  el.classList.add('owner-driver-narrow');
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
  ownerDriverPersistDirectoryLocalOnly();
  setErr('');
  ownerDriverEditCounterpartyId=null;
  ownerDriverShowView('counterparties');
}

function ownerDriverOpenExchangeOrders(){
  if(typeof exchangeOrders!=='function') return [];
  const sid=ownerDriverSpaceId();
  return exchangeOrders().filter(o=>!ownerDriverIsMyFirmOrder(o));
}

function ownerDriverMyOrdersOnExchange(){
  return (state.orders||[]).filter(o=>{
    if(!o||!o.onExchange||o.closedAt||o.startOdometer!=null) return false;
    return ownerDriverIsMyFirmOrder(o);
  });
}

function ownerDriverPublishableOrders(){
  const sid=ownerDriverSpaceId();
  return (state.orders||[]).filter(o=>{
    if(!o||o.onExchange||o.closedAt||o.startOdometer!=null||o.cancelledAt) return false;
    if(!ownerDriverIsMyFirmOrder(o)) return false;
    if(sid&&o.spaceId&&o.spaceId!==sid) return false;
    return true;
  });
}

function ownerDriverClaimExchangeOrder(orderId){
  const o=(state.orders||[]).find(x=>x&&x.id===orderId);
  if(!o||!o.onExchange){ alert('Заказ уже недоступен'); return; }
  if(ownerDriverIsMyFirmOrder(o)){ alert('Это ваш заказ — снимите с биржи или назначьте себе в рейсах'); return; }
  const sid=ownerDriverSpaceId();
  if(!sid){ alert('Не определён кабинет'); return; }
  const guard=typeof billingGuard==='function'?billingGuard(sid,'claim_exchange'):{ok:true};
  const run=()=>{
    if(!guard.ok){ alert(guard.message||OWNER_DRIVER_EXCHANGE_LOCK_MSG); return; }
    const myCo=ownerDriverOwnCompany();
    if(!myCo){ alert('Сначала нужна ваша фирма'); return; }
    const driver=typeof DRIVER!=='undefined'?DRIVER:'';
    if(!driver){ alert('Нет сессии водителя'); return; }
    const fleet=ownerDriverFleetVehicles();
    const plate=(state.shift&&state.shift.vehiclePlate)||(fleet[0]&&fleet[0].plate)||'';
    const veh=fleet.find(v=>v.plate===plate)||fleet[0];
    if(!veh||!plate){ alert('Выберите авто в смене или во вкладке «Машина»'); return; }
    if(typeof vehicleFitsOrder==='function'&&!vehicleFitsOrder(veh,o)){ alert('Авто не подходит по требованиям заявки'); return; }
    const adm=ownerDriverLinkedAdmin();
    const customerCo=typeof findCompanyById==='function'?findCompanyById(o.ownCompanyId):null;
    o.transportApp={
      id:typeof uuid==='function'?uuid():String(Date.now()),
      signedAt:new Date().toISOString(),
      customerCompanyId:o.ownCompanyId||null,
      customerCompanyName:o.ownCompanyName||(customerCo&&customerCo.name)||'',
      carrierCompanyId:myCo.id,
      carrierCompanyName:myCo.name,
      customerAdminId:o.ownerAdminId||null,
      carrierAdminId:adm&&adm.id||null,
      driverName:driver,
      vehiclePlate:plate,
      vehiclePayloadTons:veh.payloadTons||null,
      vehicleBodyLengthM:veh.bodyLengthM||null,
      vehicleBodyWidthM:veh.bodyWidthM||null,
      vehicleBodyHeightM:veh.bodyHeightM||null,
      reqPayloadTons:o.reqPayloadTons||null,
      reqLengthM:o.reqLengthM||null,
      reqWidthM:o.reqWidthM||null,
      reqHeightM:o.reqHeightM||null,
      route:typeof routeText==='function'?routeText(o):'',
      orderSequentialNumber:o.sequentialNumber
    };
    o.onExchange=false;
    o.executorType='partner';
    o.carrierCompanyId=myCo.id;
    o.carrierCompanyName=myCo.name;
    o.driverName=driver;
    o.vehiclePlate=plate;
    o.driverPercent=typeof driverPercent==='function'?driverPercent(driver,myCo.id):null;
    o.driverPhone=typeof driverPhone==='function'?driverPhone(driver,myCo.id):'';
    o.partnerSpaceId=sid;
    o.wasOnExchange=true;
    o.executorAdminId=adm&&adm.id||null;
    if(o.transportApp) o.transportApp.driverPhone=o.driverPhone||'';
    if(typeof stampOrderDriverPhone==='function') stampOrderDriverPhone(o);
    if(typeof syncOrderDocsOnAssign==='function'){
      syncOrderDocsOnAssign(o);
      if(typeof ensureOrderDocs==='function') ensureOrderDocs(o);
      if(o.transportApp&&o.transportApp.signedAt&&o.docs&&o.docs.transportApp){
        o.docs.transportApp.status='signed';
        o.docs.transportApp.updatedAt=o.transportApp.signedAt;
      }
    }
    if(typeof ensureTripContractFromTransportApp==='function') ensureTripContractFromTransportApp(o);
    if(typeof bumpDataEpoch==='function') bumpDataEpoch('owner-claim-exchange');
    if(typeof upsertOrder==='function') upsertOrder(o);
    if(typeof persist==='function') persist();
    renderOwnerDriverExchange();
    alert('Заказ взят. Продолжите рейс во вкладке «Рейсы».');
  };
  if(typeof billingGuardWithServer==='function'){
    billingGuardWithServer(sid,'claim_exchange').then(g=>{
      if(!g.ok){ alert(g.message||OWNER_DRIVER_EXCHANGE_LOCK_MSG); return; }
      run();
    });
    return;
  }
  run();
}

function ownerDriverPublishOrderToExchange(orderId){
  const o=(state.orders||[]).find(x=>x&&x.id===orderId);
  if(!o||o.closedAt||o.startOdometer!=null){ alert('Нельзя выставить на биржу'); return; }
  if(!ownerDriverIsMyFirmOrder(o)){ alert('Чужой заказ'); return; }
  const sid=ownerDriverSpaceId();
  if(!sid) return;
  const prep=()=>{
    if(!(typeof orderCarrierPriceBase==='function'?orderCarrierPriceBase(o):0)&&o.rateCash>0) o.priceForCarrier=+o.rateCash;
    const fleet=ownerDriverFleetVehicles();
    const veh=fleet.find(v=>v.plate===o.vehiclePlate)||fleet[0];
    if(!o.reqPayloadTons&&veh&&veh.payloadTons) o.reqPayloadTons=veh.payloadTons;
    if(!(typeof orderCarrierPriceBase==='function'?orderCarrierPriceBase(o):0)){
      alert('Укажите цену перевозчику (сумма в заказе)'); return;
    }
    if(!confirm('Выставить заказ на биржу? Партнёр повезёт, вы остаётесь заказчиком перевозки.')) return;
    o.onExchange=true;
    o.exchangeListedAt=new Date().toISOString();
    o.wasOnExchange=true;
    o.executorType='exchange';
    o.driverName='Биржа';
    o.vehiclePlate='—';
    o.transportApp=null;
    o.partnerSpaceId=null;
    o.executorAdminId=null;
    if(typeof clearOrderBooking==='function') clearOrderBooking(o);
    if(typeof bumpDataEpoch==='function') bumpDataEpoch('owner-publish-exchange');
    if(typeof upsertOrder==='function') upsertOrder(o);
    if(typeof persist==='function') persist();
    renderOwnerDriverExchange();
  };
  if(typeof billingGuardWithServer==='function'){
    billingGuardWithServer(sid,'publish_exchange').then(g=>{
      if(!g.ok){ alert(g.message||OWNER_DRIVER_EXCHANGE_LOCK_MSG); return; }
      prep();
    });
    return;
  }
  const g=typeof billingGuard==='function'?billingGuard(sid,'publish_exchange'):{ok:true};
  if(!g.ok){ alert(g.message); return; }
  prep();
}

function renderOwnerDriverExchange(){
  const el=$('owner-driver-view');
  if(!el) return;
  el.classList.remove('owner-driver-narrow');
  if(!ownerDriverExchangeModuleEnabled()){
    el.innerHTML=`<h2 class="owner-driver-h2">Биржа</h2>
      <p class="owner-driver-save-notice" role="status">${esc(OWNER_DRIVER_EXCHANGE_LOCK_MSG)}</p>`;
    return;
  }
  const board=ownerDriverOpenExchangeOrders();
  const mineOn=ownerDriverMyOrdersOnExchange();
  const toPub=ownerDriverPublishableOrders();
  const boardHtml=board.length?board.map(o=>{
    const route=typeof routeText==='function'?routeText(o):`${o.loading||''} → ${o.unloading||''}`;
    return `<article class="owner-driver-trip">
      <div class="owner-driver-trip-head"><b>№${esc(o.sequentialNumber)}</b><span class="st">На бирже</span></div>
      <div class="meta">${esc(route)}</div>
      <div class="meta">${o.vehicleAt&&typeof formatRuDateTimeAt==='function'?`Подача ${esc(formatRuDateTimeAt(o.vehicleAt))}`:''}</div>
      <button type="button" class="primary od-ex-claim" data-id="${esc(o.id)}">Взять</button>
    </article>`;
  }).join(''):'<p class="hint">Сейчас нет чужих заявок на бирже.</p>';
  const mineHtml=mineOn.length?mineOn.map(o=>{
    const route=typeof routeText==='function'?routeText(o):'';
    return `<article class="owner-driver-trip"><div class="meta"><b>№${esc(o.sequentialNumber)}</b> · ${esc(route)} — ждём перевозчика</div></article>`;
  }).join(''):'<p class="hint">Ваших заявок на бирже нет.</p>';
  const pubHtml=toPub.length?`<ul class="owner-driver-mod-list">${toPub.map(o=>{
    const route=typeof routeText==='function'?routeText(o):'';
    return `<li><b>№${esc(o.sequentialNumber)}</b> ${esc(route)}
      <button type="button" class="secondary od-ex-publish" data-id="${esc(o.id)}" style="margin-top:6px">Выставить на биржу</button></li>`;
  }).join('')}</ul>`:'<p class="hint">Нет своих открытых рейсов для биржи — создайте заказ.</p>';
  el.innerHTML=`<h2 class="owner-driver-h2">Биржа</h2>
    <p class="hint">Чужие заявки — «Взять». Свои открытые рейсы — «Выставить на биржу».</p>
    <h3 class="owner-driver-h3">Открытые заказы</h3>${boardHtml}
    <h3 class="owner-driver-h3">Мои на бирже</h3>${mineHtml}
    <h3 class="owner-driver-h3">Выставить мой заказ</h3>${pubHtml}`;
  el.querySelectorAll('.od-ex-claim').forEach(b=>{ b.onclick=()=>ownerDriverClaimExchangeOrder(b.dataset.id); });
  el.querySelectorAll('.od-ex-publish').forEach(b=>{ b.onclick=()=>ownerDriverPublishOrderToExchange(b.dataset.id); });
}

function renderOwnerDriverTariff(){
  const el=$('owner-driver-view');
  if(!el) return;
  el.classList.add('owner-driver-narrow');
  const sp=ownerDriverSpaceForSession();
  const ent=ownerDriverEntitlementsForSession();
  const tariffId=ent.tariffId||'';
  const tariff=typeof platformTariffById==='function'?platformTariffById(tariffId):null;
  const tariffLabel=(tariff&&tariff.labelRu)||tariffId||'—';
  const maxV=ent.maxVehicles!=null?ent.maxVehicles:'—';
  const fleet=ownerDriverFleetVehicles();
  const vehCount=fleet.length;
  const modList=SPACE_MODULE_IDS.map(mid=>{
    const on=ent.modules[mid]!==false;
    const lab=SPACE_MODULE_LABELS[mid]||mid;
    return `<li class="${on?'':'off'}">${esc(lab)} — ${on?'включён':'нет'}</li>`;
  }).join('');
  let paidBlock='<p class="hint">Оплата: не задана (уточните у администратора).</p>';
  if(sp&&typeof ownerSubscriptionStatusForSpace==='function'){
    const st=ownerSubscriptionStatusForSpace(sp);
    const iso=typeof ownerPaidUntilIsoFromSpace==='function'?ownerPaidUntilIsoFromSpace(sp):null;
    const fmt=iso&&typeof formatBillingDate==='function'?formatBillingDate(iso):(iso?iso.slice(0,10):'—');
    if(st.phase==='active') paidBlock=`<p><span class="lbl">Оплачено до:</span> <b>${esc(fmt)}</b> (осталось ${esc(String(st.daysLeft))} дн.)</p>`;
    else if(st.phase==='grace') paidBlock=`<p class="owner-driver-save-notice">Оплачено до ${esc(fmt)} — льготный период, осталось ${esc(String(st.daysLeft))} дн.</p>`;
    else if(st.phase==='expired') paidBlock=`<p class="error">Подписка закончилась ${esc(fmt)}. Обратитесь к администратору.</p>`;
  }
  el.innerHTML=`<h2 class="owner-driver-h2">Мой тариф</h2>
    <p><b>${esc(tariffLabel)}</b></p>
    <p class="hint">Машин: <b>${esc(String(vehCount))}</b> из <b>${esc(String(maxV))}</b></p>
    ${paidBlock}
    <h3 class="owner-driver-h3">Модули</h3>
    <ul class="owner-driver-mod-list">${modList}</ul>
    <button type="button" class="secondary" id="od-tariff-change">Сменить тариф</button>
    <div id="od-tariff-change-hint" class="hint" hidden style="margin-top:10px">
      <p>Чтобы сменить тариф, обратитесь к администратору.</p>
      ${ownerDriverSupportContactsHtml()}
    </div>`;
  const btn=$('od-tariff-change');
  const hint=$('od-tariff-change-hint');
  if(btn&&hint) btn.onclick=()=>{ hint.hidden=false; };
}

function renderOwnerDriverProfile(){
  const el=$('owner-driver-view');
  if(!el) return;
  el.classList.add('owner-driver-narrow');
  const name=typeof DRIVER!=='undefined'&&DRIVER?esc(DRIVER):'—';
  el.innerHTML=`<h2 class="owner-driver-h2">Профиль</h2>
    <p class="hint">${name}</p>
    <div class="owner-driver-list">
      <button type="button" class="owner-driver-list-row" id="od-prof-tariff">Мой тариф</button>
      <button type="button" class="owner-driver-list-row" id="od-prof-branding">Оформление кабинета</button>
      <button type="button" class="owner-driver-list-row" id="od-prof-settings">Настройки расчёта</button>
    </div>`;
  $('od-prof-tariff').onclick=()=>ownerDriverShowView('tariff');
  const br=$('od-prof-branding');
  if(br) br.onclick=()=>ownerDriverShowView('theme');
  $('od-prof-settings').onclick=()=>ownerDriverShowView('settings');
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
  el.classList.add('owner-driver-narrow');
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
  ownerDriverPersistDirectoryLocalOnly();
  if(err){
    err.textContent=OWNER_DRIVER_DIR_LOCAL_MSG;
    err.classList.remove('error');
    err.classList.add('owner-driver-save-notice');
  }
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
      if(co){
        customerId=co.id;
        customer=co.name||newName;
        ownerDriverPersistDirectoryLocalOnly();
      }
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
  const trustedCid=typeof ownerDriverTrustedCompanyId==='function'?ownerDriverTrustedCompanyId():null;
  const bindCompanyId=trustedCid||(typeof DRIVER_COMPANY_ID!=='undefined'?DRIVER_COMPANY_ID:null);
  if(bindCompanyId){
    const rec=typeof findDriverRecord==='function'?findDriverRecord(DRIVER, bindCompanyId):null;
    bind.ownCompanyId=bindCompanyId;
    if(rec){
      bind.ownCompanyName=rec.companyName||bind.ownCompanyName;
      bind.spaceId=rec.spaceId||bind.spaceId;
      bind.ownerAdminId=rec.ownerAdminId||bind.ownerAdminId;
      bind.ownerAdminName=rec.ownerAdminName||bind.ownerAdminName;
    } else {
      const co=typeof findCompanyById==='function'?findCompanyById(bindCompanyId):null;
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
    driverPercent:typeof driverPercent==='function'?driverPercent(DRIVER, bind.ownCompanyId||bindCompanyId):null,
    ownerAdminId:bind.ownerAdminId,
    ownerAdminName:bind.ownerAdminName,
    spaceId:bind.spaceId,
    ownCompanyId:bind.ownCompanyId||bindCompanyId,
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
      <div class="owner-driver-table-wrap owner-driver-only-desktop">${ownerDriverFuelTableHtml(from, to)}</div>
    </section>`:'';
  const maintBlock=ownerDriverMaintenanceModuleEnabled()&&v?`
    <section class="owner-driver-section">
      <h3 class="owner-driver-h3">ТО и ремонт</h3>
      <div class="owner-driver-svc-logs owner-driver-only-mobile">${ownerDriverMaintenanceLogHtml(v)}</div>
      <div class="owner-driver-table-wrap owner-driver-only-desktop">${ownerDriverMaintenanceTableHtml(v)}</div>
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
  el.classList.remove('owner-driver-narrow');
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

/** Идемпотентно: кабинет собственника на экране #driver.show (не в handoff к наёмному UI). */
function ownerDriverMaybeActivateCabinetUi(){
  if(ownerDriverHandoffToClassicUi) return;
  if(typeof isOwnerDriverCabinetActive==='function'&&!isOwnerDriverCabinetActive()) return;
  if(typeof DRIVER==='undefined'||!DRIVER) return;
  if(!document.querySelector('#driver.show')) return;
  ensureOwnerDriverShellDom();
  ownerDriverActivateUi();
}

function syncOwnerDriverChrome(){
  if(!isOwnerDriverCabinetActive()) return;
  if(ownerDriverHandoffToClassicUi) return;
  const onDriver=!!(typeof DRIVER!=='undefined'&&DRIVER&&document.querySelector('#driver.show'));
  if(onDriver) ownerDriverMaybeActivateCabinetUi();
}

function patchShowForOwnerDriverCabinet(){
  if(typeof show!=='function'||show.__ownerDriverShowPatch) return;
  const prev=show;
  show=function(id){
    prev(id);
    if(id==='driver') ownerDriverMaybeActivateCabinetUi();
  };
  show.__ownerDriverShowPatch=true;
}

function wrapEnterAsDriverForOwnerCabinet(){
  if(typeof enterAsDriver!=='function'||enterAsDriver.__ownerDriverWrap) return;
  const prev=enterAsDriver;
  const wrapped=async function(rec){
    await prev(rec);
    if(
      (rec&&String(rec.accountKind||'')==='owner_driver')||
      (typeof isOwnerDriverCabinetActive==='function'&&isOwnerDriverCabinetActive())
    ){
      ownerDriverMaybeActivateCabinetUi();
    }
  };
  wrapped.__ownerDriverWrap=true;
  enterAsDriver=wrapped;
}

function wrapLeaveDriverForOwnerCabinet(){
  if(typeof leaveDriverMode!=='function'||leaveDriverMode.__ownerLeaveWrap) return;
  const prev=leaveDriverMode;
  leaveDriverMode=async function(...args){
    ownerDriverHandoffToClassicUi=false;
    ownerDriverSetHandoffClass(false);
    ownerDriverDeactivateUi();
    ownerDriverSyncReturnBar();
    return prev.apply(this, args);
  };
  leaveDriverMode.__ownerLeaveWrap=true;
}

function patchUpdateDriverChromeForOwner(){
  if(typeof updateDriverChrome!=='function'||updateDriverChrome.__odPatch) return;
  const prev=updateDriverChrome;
  updateDriverChrome=function(){
    prev();
    ownerDriverMaybeActivateCabinetUi();
    ownerDriverSyncReturnBar();
  };
  updateDriverChrome.__odPatch=true;
}

function initOwnerDriverShell(){
  captureOwnerDriverPreviewFromUrl();
  ensureOwnerDriverShellDom();
  ownerDriverEnsureReturnBar();
  patchHideDriverPanelsForOwner();
  patchShowForOwnerDriverCabinet();
  patchUpdateDriverChromeForOwner();
  wrapEnterAsDriverForOwnerCabinet();
  wrapLeaveDriverForOwnerCabinet();
  syncOwnerDriverChrome();
  ownerDriverSyncReturnBar();
}

initOwnerDriverShell();
