/* АРМАДА — «Настройки кабинета»: сотрудники, парк, контрагенты */
let cabinetSettingsView='hub';
let cabinetSettingsFromHub=false;
let cabinetCounterpartyFilter='all';
let cabinetCounterpartySearch='';
let cabinetSettingsCounterpartyEdit=false;

function cabinetCounterpartiesInScope(){
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  return (state.companies||[]).filter(c=>inSpace(c)&&typeof companyHasRole==='function'&&!companyHasRole(c,'own'));
}

function cabinetCounterpartyMatchesFilter(c){
  const f=cabinetCounterpartyFilter||'all';
  const cust=typeof companyHasRole==='function'&&companyHasRole(c,'customer');
  const carr=typeof companyHasRole==='function'&&companyHasRole(c,'carrier');
  if(f==='all') return true;
  if(f==='customer') return cust;
  if(f==='carrier') return carr;
  if(f==='other') return !cust&&!carr;
  return true;
}

function cabinetCounterpartyRoleChips(c){
  const cust=typeof companyHasRole==='function'&&companyHasRole(c,'customer');
  const carr=typeof companyHasRole==='function'&&companyHasRole(c,'carrier');
  const chips=[];
  if(cust) chips.push('<span class="chip">заказчик</span>');
  if(carr) chips.push('<span class="chip">перевозчик</span>');
  if(!cust&&!carr) chips.push('<span class="chip">иное</span>');
  return chips.join(' ');
}

function cabinetSettingsStats(){
  const sid=typeof cabinetSettingsEffectiveSpaceId==='function'?cabinetSettingsEffectiveSpaceId():(typeof currentSpaceId==='function'?currentSpaceId():null);
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  const ownCo=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  const staff=(state.admins||[]).filter(a=>a&&a.spaceId===sid&&!a.isSuper);
  const superHere=isSuperAdmin()&&sid?1:0;
  const drv=ownCo&&typeof fleetDriversForCompany==='function'?fleetDriversForCompany(ownCo.id).length:0;
  const veh=ownCo&&typeof fleetVehiclesForCompany==='function'?fleetVehiclesForCompany(ownCo.id).length:0;
  const cps=(state.companies||[]).filter(c=>inSpace(c)&&typeof companyHasRole==='function'&&!companyHasRole(c,'own'));
  const customers=cps.filter(c=>companyHasRole(c,'customer')).length;
  const carriers=cps.filter(c=>companyHasRole(c,'carrier')).length;
  return {staff:staff.length+superHere, drv, veh, counterparties:cps.length, customers, carriers, ownCo};
}

function canAccessCabinetSettingsHub(){
  if(!currentAdmin) return false;
  if(typeof isSuperAdmin==='function'&&isSuperAdmin()) return true;
  const sid=typeof currentSpaceId==='function'?currentSpaceId():null;
  const sp=sid&&typeof findSpaceById==='function'?findSpaceById(sid):null;
  if(!sp) return true;
  if(!sp.adminId) return true;
  return sp.adminId===currentAdmin.id;
}

function markCabinetSettingsNavOn(){
  const gear=$('admin-cabinet-settings-btn');
  if(gear) gear.classList.add('on');
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b=>{
    b.classList.toggle('on', false);
  });
}

function openCabinetSettings(view){
  if(!currentAdmin){
    if(typeof fillAdminLoginSelect==='function') fillAdminLoginSelect();
    show('admin-pin');
    return;
  }
  if(typeof canAccessCabinetSettingsHub==='function'&&!canAccessCabinetSettingsHub()){
    alert('Настройки кабинета доступны владельцу кабинета или супер-админу');
    return;
  }
  let v=view||'hub';
  if(v==='partners-customers'){ cabinetCounterpartyFilter='customer'; v='counterparties'; }
  if(v==='partners-carriers'){ cabinetCounterpartyFilter='carrier'; v='counterparties'; }
  cabinetSettingsView=v;
  markCabinetSettingsNavOn();
  if(typeof paintCatalogOwnerFilters==='function') paintCatalogOwnerFilters();
  const form=$('cabinet-settings-form');
  const title=$('cabinet-settings-title');
  if(!form) return;
  if(title){
    const titles={
      hub:'Настройки кабинета',
      staff:'Сотрудники',
      fleet:'Свой автопарк',
      counterparties:'Контрагенты',
      theme:'Оформление'
    };
    title.textContent=titles[cabinetSettingsView]||titles.hub;
  }
  if(cabinetSettingsView==='hub') renderCabinetSettingsHub(form);
  else if(cabinetSettingsView==='staff') renderCabinetSettingsStaff(form);
  else if(cabinetSettingsView==='fleet') renderCabinetSettingsFleet(form);
  else if(cabinetSettingsView==='counterparties') renderCabinetSettingsCounterparties(form);
  else if(cabinetSettingsView==='theme'&&typeof renderCabinetSettingsTheme==='function') renderCabinetSettingsTheme(form);
  const back=$('cabinet-settings-back');
  if(back){
    back.onclick=()=>{
      if(cabinetSettingsView==='hub'){ show('admin'); renderAdmin(); }
      else openCabinetSettings('hub');
    };
  }
  show('admin-cabinet-settings-screen');
}

function cabinetBlockHtml(title, meta, hint, btnLabel, dataGo){
  return `<section class="cabinet-block">
    <button type="button" class="cabinet-block-open" data-cab-go="${esc(dataGo)}">
      <h3 class="cabinet-block-title">${esc(title)}</h3>
      <p class="cabinet-block-meta">${esc(meta)}</p>
      ${hint?`<p class="cabinet-block-hint">${hint}</p>`:''}
      <span class="cabinet-block-cta">${esc(btnLabel)} →</span>
    </button>
  </section>`;
}

function renderCabinetSettingsHub(form){
  const st=cabinetSettingsStats();
  const checklist=typeof pilotSetupChecklistHtml==='function'?pilotSetupChecklistHtml():'';
  let scopeHint='';
  if(typeof isSuperAdmin==='function'&&isSuperAdmin()&&(state.adminOwnerFilter||'all')==='all'){
    const eff=typeof cabinetSettingsEffectiveSpaceId==='function'?cabinetSettingsEffectiveSpaceId():null;
    const sp=eff&&typeof findSpaceById==='function'?findSpaceById(eff):null;
    if(sp&&sp.name) scopeHint=`<p class="hint super-cabinet-hub-scope">Показаны настройки кабинета «${esc(sp.name)}». В списке выше можно выбрать другой кабинет или «Все кабинеты» для справочника.</p>`;
  }
  form.innerHTML=`
    ${checklist}
    ${scopeHint}
    <p class="cat-panel-hint">Всё для настройки кабинета до работы с заказами. Парк, ЕТО и биржа — в меню слева.</p>
    ${cabinetBlockHtml(
      '1. Сотрудники',
      `${st.staff} в кабинете`,
      'Администратор, логисты, ваш профиль',
      'Открыть',
      'staff'
    )}
    ${cabinetBlockHtml(
      '2. Свой автопарк',
      st.ownCo?`${st.drv} вод. · ${st.veh} ТС · ${esc(st.ownCo.name)}`:'Фирма не задана',
      'Компания, водители, авто, тариф',
      'Открыть',
      'fleet'
    )}
    ${cabinetBlockHtml(
      '3. Контрагенты',
      `${st.counterparties} в журнале · ${st.customers} заказч. · ${st.carriers} перев.`,
      'Реквизиты, роли, портал /z, адреса, договоры',
      'Открыть',
      'counterparties'
    )}
    ${cabinetBlockHtml(
      '4. Оформление',
      'Тема, цвет, логотип',
      'Кабинет, водители, портал заказчика',
      'Открыть',
      'theme'
    )}
    ${cabinetBlockHtml(
      '5. Ссылки и входы',
      'Водитель /v · заказчик /z · админ /a',
      'QR и SMS для входа',
      'Открыть',
      'links'
    )}
  `;
  form.querySelectorAll('[data-cab-go]').forEach(b=>b.onclick=()=>{
    const go=b.dataset.cabGo;
    if(go==='links'){ cabinetSettingsFromHub=true; if(typeof openAdminLinks==='function') openAdminLinks(); return; }
    openCabinetSettings(go);
  });
}

function renderCabinetSettingsStaff(form){
  const sid=currentSpaceId();
  const list=(state.admins||[]).filter(a=>a&&(a.spaceId===sid||a.isSuper&&isSuperAdmin()));
  const owner=typeof findSpaceById==='function'&&sid?(findSpaceById(sid)||{}).adminId:null;
  const rows=list.map(a=>{
    const isOwner=owner&&a.id===owner;
    const roleLbl=a.isSuper?'супер-админ':isOwner?'администратор кабинета':'логист';
    const self=currentAdmin&&a.id===currentAdmin.id;
    return `<div class="dense-row">
      <div class="grow">
        <div class="name">${esc(a.name)}${self?' <span class="chip hot">вы</span>':''}</div>
        <div class="meta">${esc(roleLbl)}${a.phone?` · ☎ ${esc(formatPhone(a.phone))}`:''}${a.skipDriverMirror?' · без профиля водителя':''}</div>
      </div>
    </div>`;
  }).join('')||`<div class="hint">Нет записей — обратитесь к администратору платформы для подключения кабинета.</div>`;
  form.innerHTML=`
    <p class="cat-panel-hint">Офисные сотрудники кабинета. Профиль водителя для логиста не создаётся автоматически.</p>
    <div class="cabinet-subnav">
      <button type="button" class="secondary" id="cab-my-profile">Мой профиль логиста</button>
    </div>
    <h4 class="form-section-title" style="margin-top:12px">В кабинете</h4>
    <div class="cat-list">${rows}</div>
    <p class="hint">Приглашение новых логистов — в следующем обновлении. Сейчас кабинет подключает супер-админ в «Активность».</p>
  `;
  const prof=$('cab-my-profile');
  if(prof) prof.onclick=()=>{
    cabinetSettingsOpenProfile=true;
    if(typeof openAdminProfile==='function') openAdminProfile();
  };
}

function renderCabinetSettingsFleet(form){
  const st=cabinetSettingsStats();
  const co=st.ownCo;
  form.innerHTML=`
    <p class="cat-panel-hint">${co?`Парк «${esc(co.name)}».`:''} Тоннаж, документы и ТО — в карточках водителя и авто.</p>
    <div class="cabinet-tiles">
      <button type="button" class="cabinet-tile" data-cat-from-cab="companies"><span class="cabinet-tile-n">🏢</span><b>Профиль компании</b><span class="meta">ИНН, банк, НДС</span></button>
      <button type="button" class="cabinet-tile" data-cat-from-cab="drivers"><span class="cabinet-tile-n">${st.drv}</span><b>Водители</b><span class="meta">PIN, документы</span></button>
      <button type="button" class="cabinet-tile" data-cat-from-cab="vehicles"><span class="cabinet-tile-n">${st.veh}</span><b>Авто</b><span class="meta">ТС, ТО, СТС</span></button>
      <button type="button" class="cabinet-tile" data-cat-from-cab="finance"><span class="cabinet-tile-n">₽</span><b>Тариф</b><span class="meta">₽/км, ₽/ч, пакет</span></button>
    </div>
    <p class="hint" style="margin-top:8px">Ссылки для водителей и заказчиков — в блоке <b>5. Ссылки и входы</b> на главной странице настроек.</p>
  `;
  form.querySelectorAll('[data-cat-from-cab]').forEach(b=>b.onclick=()=>openCatalogsFromCabinet(b.dataset.catFromCab));
}

function renderCabinetSettingsCounterparties(form){
  const f=cabinetCounterpartyFilter||'all';
  const list=cabinetCounterpartiesInScope().filter(cabinetCounterpartyMatchesFilter);
  const q=(cabinetCounterpartySearch||'').trim().toLowerCase();
  const filterBtn=(key,label)=>`<button type="button" class="${f===key?'on':''}" data-cp-filter="${key}">${label}</button>`;
  const tabs=`
    <div class="cabinet-partner-tabs">
      ${filterBtn('all','Все')}
      ${filterBtn('customer','Заказчики')}
      ${filterBtn('carrier','Перевозчики')}
      ${filterBtn('other','Иные')}
    </div>`;
  const cards=list.map(c=>{
    const fcSt=typeof companyHasRole==='function'&&companyHasRole(c,'customer')&&typeof customerFrameworkContractStatus==='function'?customerFrameworkContractStatus(c):null;
    const fcBadge=fcSt==='signed'?'<span class="chip ok">договор</span>':fcSt==='pending'?'<span class="chip">договор…</span>':'';
    const nDrv=typeof companyHasRole==='function'&&companyHasRole(c,'carrier')&&typeof fleetDriversForCompany==='function'?fleetDriversForCompany(c.id).length:0;
    const nVeh=typeof companyHasRole==='function'&&companyHasRole(c,'carrier')&&typeof fleetVehiclesForCompany==='function'?fleetVehiclesForCompany(c.id).length:(c.vehicles||[]).length;
    const nAddr=((c.loadingAddresses||[]).length+(c.unloadingAddresses||[]).length);
    const metaBits=[
      c.inn?`ИНН ${c.inn}`:null,
      companyHasRole(c,'customer')&&c.portalEnabled?'портал /z':null,
      nAddr?`${nAddr} адр.`:null,
      nDrv?`вод. ${nDrv}`:null,
      nVeh?`ТС ${nVeh}`:null
    ].filter(Boolean).join(' · ');
    const hay=[c.name,c.inn,c.ogrn].filter(Boolean).join(' ').toLowerCase();
    const hidden=q&&!hay.includes(q);
    return `<div class="dense-row" data-co-row="${esc(c.id)}" data-cp-search="${esc(hay)}" style="${hidden?'display:none':''}">
      <button type="button" class="grow" data-edit-cp="${esc(c.id)}">
        <div class="name">${esc(c.name)} ${fcBadge}</div>
        <div class="meta">${cabinetCounterpartyRoleChips(c)}${metaBits?` · ${esc(metaBits)}`:''}</div>
      </button>
      <button type="button" class="icon-btn danger" data-del-cp="${esc(c.id)}" title="Удалить">×</button>
    </div>`;
  }).join('')||`<div class="hint">Пока нет контрагентов — добавьте кнопкой ниже</div>`;
  form.innerHTML=`
    ${tabs}
    <p class="cat-panel-hint">Журнал всех контрагентов кабинета (кроме вашей фирмы). Нажмите строку — карточка с реквизитами, ролями, порталом заказчика, адресами и договорами.</p>
    <input class="cat-search" id="cab-cp-search" placeholder="Поиск: название или ИНН…" value="${esc(cabinetCounterpartySearch||'')}" style="margin:8px 0" />
    <div class="row" style="gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button type="button" class="primary cat-add-btn" id="cab-cp-new" style="width:auto;flex:0 0 auto;padding:8px 14px!important">+ Добавить контрагента</button>
      <button type="button" class="secondary" id="cab-contracts-all" style="width:auto;flex:1">Все договоры</button>
    </div>
    <div class="cat-list" id="cab-cp-list">${cards}</div>
  `;
  form.querySelectorAll('[data-cp-filter]').forEach(b=>b.onclick=()=>{
    cabinetCounterpartyFilter=b.dataset.cpFilter||'all';
    openCabinetSettings('counterparties');
  });
  const searchEl=$('cab-cp-search');
  if(searchEl){
    searchEl.oninput=()=>{
      cabinetCounterpartySearch=searchEl.value||'';
      const qq=cabinetCounterpartySearch.trim().toLowerCase();
      document.querySelectorAll('#cab-cp-list [data-co-row]').forEach(row=>{
        const hay=row.getAttribute('data-cp-search')||'';
        row.style.display=!qq||hay.includes(qq)?'':'none';
      });
    };
  }
  $('cab-cp-new')&&($('cab-cp-new').onclick=()=>openCounterpartyEditorFromCabinet(null, defaultRoleForCounterpartyFilter()));
  document.querySelectorAll('[data-edit-cp]').forEach(b=>b.onclick=()=>{
    openCounterpartyEditorFromCabinet(findCompanyById(b.dataset.editCp), null);
  });
  document.querySelectorAll('[data-del-cp]').forEach(b=>b.onclick=()=>{
    if(!confirm('Удалить контрагента из справочника?')) return;
    state.companies=(state.companies||[]).filter(c=>c.id!==b.dataset.delCp);
    bumpDataEpoch('del-company');
    persist();
    openCabinetSettings('counterparties');
  });
  const ca=$('cab-contracts-all');
  if(ca) ca.onclick=()=>{
    cabinetSettingsCounterpartyEdit=false;
    openCatalogsFromCabinet('contracts');
  };
}

function defaultRoleForCounterpartyFilter(){
  const f=cabinetCounterpartyFilter||'all';
  if(f==='customer') return 'customer';
  if(f==='carrier') return 'carrier';
  return 'customer';
}

function sid(){
  if(typeof cabinetSettingsEffectiveSpaceId==='function') return cabinetSettingsEffectiveSpaceId();
  return typeof currentSpaceId==='function'?currentSpaceId():null;
}

function openCounterpartyEditorFromCabinet(company, newRoleHint){
  cabinetSettingsFromHub=true;
  cabinetSettingsCounterpartyEdit=true;
  cabinetSettingsPartnerRole=newRoleHint||defaultRoleForCounterpartyFilter();
  if(typeof openCatalogs==='function'){
    catalogTab='companies';
    openCatalogs();
    if(company) setTimeout(()=>{
      const btn=document.querySelector(`[data-edit-co="${company.id}"]`);
      if(btn) btn.click();
      else {
        const c=findCompanyById(company.id);
        if(c&&typeof catalogCompanyIsPartnerCustomer==='function'&&catalogCompanyIsPartnerCustomer(c)){
          catalogTab='customers';
          showCatalogTab&&showCatalogTab('customers');
        }
        const btn2=document.querySelector(`[data-edit-co="${company.id}"]`);
        if(btn2) btn2.click();
      }
    }, 80);
    else setTimeout(()=>{ $('co-new')&&$('co-new').click(); }, 80);
  }
}

/** @deprecated use openCounterpartyEditorFromCabinet */
function openPartnerEditorFromCabinet(company, role){
  openCounterpartyEditorFromCabinet(company, role);
}

let cabinetSettingsPartnerRole=null;
let cabinetSettingsOpenProfile=false;

function openCatalogsFromCabinet(tab){
  cabinetSettingsFromHub=true;
  if(tab!=='contracts') cabinetSettingsCounterpartyEdit=false;
  catalogTab=tab||'companies';
  if(typeof openCatalogs==='function') openCatalogs();
}

function cabinetSettingsBackFromCatalogs(){
  cabinetSettingsFromHub=false;
  if(catalogTab==='contracts'||cabinetSettingsCounterpartyEdit){
    cabinetSettingsCounterpartyEdit=false;
    cabinetSettingsPartnerRole=null;
    openCabinetSettings('counterparties');
  }
  else if(catalogTab==='companies'||catalogTab==='finance') openCabinetSettings('fleet');
  else if(catalogTab==='drivers'||catalogTab==='vehicles') openCabinetSettings('fleet');
  else openCabinetSettings('hub');
}

function catalogTabsVisibleFromCabinetHub(){
  if(!cabinetSettingsFromHub) return null;
  const t=catalogTab||'companies';
  if(t==='contracts') return ['contracts'];
  if(cabinetSettingsCounterpartyEdit||t==='customers') return ['companies'];
  return ['companies','drivers','vehicles','finance'];
}

function shouldHideAdminCatalogsNav(){
  if(!currentAdmin) return true;
  if(typeof catalogAllCabinetsOpen==='function'&&catalogAllCabinetsOpen()) return false;
  return true;
}

function shouldHideAdminLinksNav(){
  if(!currentAdmin) return true;
  return true;
}

function cabinetSettingsBackTargetForCatalog(){
  if(!cabinetSettingsFromHub) return null;
  if(catalogTab==='contracts'||cabinetSettingsCounterpartyEdit) return 'counterparties';
  if(catalogTab==='drivers'||catalogTab==='vehicles'||catalogTab==='finance'||catalogTab==='companies') return 'fleet';
  return 'hub';
}
