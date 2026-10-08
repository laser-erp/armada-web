/* АРМАДА — вход админа (изолирован от admin.js бизнес-логики). */
function normalizeLoginInn(raw){
  return String(raw||'').replace(/\D/g,'');
}
function spaceIdsForLoginInn(innRaw){
  const inn=normalizeLoginInn(innRaw);
  if(!inn) return new Set();
  const ids=new Set();
  (state.spaces||[]).forEach(s=>{
    if(normalizeLoginInn(s.inn)===inn) ids.add(s.id);
  });
  (state.companies||[]).forEach(c=>{
    if(!companyHasRole(c,'own')) return;
    if(normalizeLoginInn(c.inn)===inn && c.spaceId) ids.add(c.spaceId);
  });
  return ids;
}
function findAdminByInnAndPin(innRaw, pin){
  const pinStr=String(pin||'').trim();
  if(!pinStr) return null;
  const inn=normalizeLoginInn(innRaw);
  if(!inn) return null;
  const spaceIds=spaceIdsForLoginInn(inn);
  if(!spaceIds.size){
    // Пустая база / sync не подтянул фирмы — единственный супер с этим PIN
    const supers=(state.admins||[]).filter(a=>a.isSuper && String(a.pin||'').trim()===pinStr);
    if(supers.length===1) return supers[0];
    return null;
  }
  const matches=(state.admins||[]).filter(a=>{
    // Супер-админ с loginBy=phone всё равно может войти по ИНН организации
    if(a.loginBy==='phone' && !a.isSuper) return false;
    if(String(a.pin||'').trim()!==pinStr) return false;
    return !!(a.spaceId && spaceIds.has(a.spaceId));
  });
  if(matches.length===1) return matches[0];
  // Супер без spaceId — вход по ИНН любой нашей фирмы (единственный супер с этим PIN)
  const loose=(state.admins||[]).filter(a=>a.isSuper && String(a.pin||'').trim()===pinStr);
  if(loose.length===1) return loose[0];
  return null;
}
function adminLoginPhone(a){
  if(!a) return '';
  const own=typeof formatPhone==='function'?formatPhone(a.phone||''):String(a.phone||'').trim();
  if(own) return own;
  const drv=(state.drivers||[]).find(d=>samePersonName(d.name,a.name));
  return typeof formatPhone==='function'?formatPhone(drv&&drv.phone||''):String(drv&&drv.phone||'').trim();
}
function looksLikeAdminPhoneInput(raw){
  const s=String(raw||'').trim();
  if(!s) return false;
  if(s.startsWith('+')) return true;
  const d=s.replace(/\D/g,'');
  if(d.length===11 && d[0]==='7') return true;
  if(d.length===10 && d[0]==='9') return true;
  return false;
}
function findAdminByPhoneAndPin(phoneRaw, pin){
  const pinStr=String(pin||'').trim();
  if(!pinStr) return null;
  const phone=typeof formatPhone==='function'?formatPhone(phoneRaw):String(phoneRaw||'').trim();
  if(!phone) return null;
  const matches=(state.admins||[]).filter(a=>{
    if(a.loginBy!=='phone') return false;
    if(String(a.pin||'').trim()!==pinStr) return false;
    return adminLoginPhone(a)===phone;
  });
  return matches.length===1 ? matches[0] : null;
}
function findAdminByLoginAndPin(loginRaw, pin){
  const raw=String(loginRaw||'').trim();
  const pinStr=String(pin||'').trim();
  if(!raw || !pinStr) return null;
  if(looksLikeAdminPhoneInput(raw)){
    const byPhone=findAdminByPhoneAndPin(raw, pin);
    if(byPhone) return byPhone;
    const phone=typeof formatPhone==='function'?formatPhone(raw):String(raw||'').trim();
    const superByPhone=(state.admins||[]).filter(a=>{
      if(!a.isSuper || String(a.pin||'').trim()!==pinStr) return false;
      return adminLoginPhone(a)===phone;
    });
    if(superByPhone.length===1) return superByPhone[0];
  }
  const inn=normalizeLoginInn(raw);
  if(inn && (inn.length===10 || inn.length===12)){
    const byInn=findAdminByInnAndPin(inn, pin);
    if(byInn) return byInn;
    const spaceIds=spaceIdsForLoginInn(inn);
    const superByInn=(state.admins||[]).filter(a=>{
      if(!a.isSuper || String(a.pin||'').trim()!==pinStr) return false;
      return !!(a.spaceId && spaceIds.has(a.spaceId));
    });
    if(superByInn.length===1) return superByInn[0];
  }
  return findAdminByPhoneAndPin(raw, pin);
}
function fillAdminLoginSelect(){
  migrateAdmins();
  const sel=$('admin-name-select'); if(!sel) return;
  const list=state.admins.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  if(!list.length){
    sel.innerHTML='<option value="">— загрузка… —</option>';
  } else {
    sel.innerHTML=list.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  }
  const hint=$('pin-recovery-hint');
  if(hint){
    const msg=state.settings&&state.settings.superPinRecoveryNotice;
    if(msg){
      hint.textContent=msg;
      hint.style.display='block';
    }else{
      hint.textContent='';
      hint.style.display='none';
    }
  }
}
function saveAdminSession(){
  if(!currentAdmin){ try{ localStorage.removeItem(ADMIN_SESSION_KEY); }catch(_){} return; }
  try{
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      id:currentAdmin.id, name:currentAdmin.name, isSuper:!!currentAdmin.isSuper,
      spaceId:currentAdmin.spaceId||null, at:new Date().toISOString()
    }));
  }catch(_){}
}
function clearAdminSession(){
  try{ localStorage.removeItem(ADMIN_SESSION_KEY); }catch(_){}
}
function restoreAdminSession(){
  migrateAdmins();
  let raw=null;
  try{ raw=JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)||'null'); }catch(_){ raw=null; }
  if(!raw||(!raw.id && !raw.name)) return false;
  let adm=(state.admins||[]).find(a=>raw.id && a.id===raw.id);
  if(!adm && raw.name) adm=(state.admins||[]).find(a=>samePersonName(a.name, raw.name));
  if(!adm){ clearAdminSession(); return false; }
  currentAdmin={id:adm.id, name:adm.name, isSuper:!!adm.isSuper, spaceId:adm.spaceId||null};
  saveAdminSession();
  try{ touchAdminPresence('admin'); }catch(_){}
  try{ startPresenceHeartbeat(); }catch(_){}
  updateAdminChrome();
  seedAdminInboxNotifySnapshot();
  syncAdminNotifyToggle();
  return true;
}
function bumpAdminLoginListRefreshGen(){
  try{ globalThis.ARMADA_ADMIN_LIST_REFRESH_GEN=(globalThis.ARMADA_ADMIN_LIST_REFRESH_GEN||0)+1; }catch(_){}
}
function upsertAdminInStateWithoutPin(adm){
  if(!adm||!adm.id) return;
  const row={
    id:adm.id,
    name:adm.name,
    isSuper:!!adm.isSuper,
    spaceId:adm.spaceId||null,
    loginBy:adm.loginBy||null,
    mustChangePin:!!adm.mustChangePin
  };
  if(adm.phone) row.phone=adm.phone;
  const list=state.admins||[];
  const i=list.findIndex(a=>a&&a.id===row.id);
  if(i>=0){
    list[i]=Object.assign({}, list[i], row);
    delete list[i].pin;
  }else list.push(row);
  state.admins=list;
}
async function loginAdmin(){
  bumpAdminLoginListRefreshGen();
  const pinErr=$('pin-error');
  if(pinErr) pinErr.textContent='';
  const btn=$('pin-ok');
  if(btn) btn.disabled=true;
  try{
  const loginRaw=(($('admin-login-inn')||{}).value||'').trim();
  const pin=(($('pin-input')||{}).value||'').trim();
  if(!loginRaw){
    if(pinErr) pinErr.textContent='Укажите телефон или ИНН организации';
    return;
  }
  const inn=normalizeLoginInn(loginRaw);
  if(!looksLikeAdminPhoneInput(loginRaw) && inn && inn.length!==10 && inn.length!==12){
    if(pinErr) pinErr.textContent='ИНН: 10 цифр для организации или 12 для ИП';
    return;
  }
  const hasApiBase=typeof API_BASE==='string'&&!!API_BASE;
  let loginSyncOk=false;
  let loginSyncSlow=false;
  let adm=null;
  let verifiedByApi=false;
  let verifyRejected=false;
  if(navigator.onLine!==false && hasApiBase && typeof armadaApiVerifyAdmin==='function'){
    if(pinErr) pinErr.textContent='Проверка PIN…';
    const verified=await armadaApiVerifyAdmin(loginRaw, pin);
    if(verified&&verified.invalidCredentials){
      verifyRejected=true;
    }else if(verified&&verified.token){
      verifiedByApi=true;
      adm=verified.admin?{...verified.admin}:{id:verified.adminId||null, name:'', isSuper:!!verified.isSuper};
      if(!adm.id&&typeof decodeArmadaJwtPayload==='function'){
        const pl=decodeArmadaJwtPayload(verified.token);
        if(pl){
          adm.id=pl.adminId||pl.sub||adm.id;
          adm.isSuper=!!pl.isSuper;
          adm.spaceId=pl.spaceId||adm.spaceId||null;
        }
      }
      delete adm.pin;
      upsertAdminInStateWithoutPin(adm);
      persistLocalOnly();
    }
    if(pinErr&&pinErr.textContent==='Проверка PIN…') pinErr.textContent='';
  }
  if(verifyRejected){
    if(pinErr) pinErr.textContent='Неверный PIN для этой организации';
    return;
  }
  if(!verifiedByApi){
    const loginSyncHint='Загрузка данных…';
    if(pinErr) pinErr.textContent=loginSyncHint;
    try{
      if(navigator.onLine!==false && typeof fetchServerState==='function'){
        const rec=await fetchServerState(25000, { pin:'sync', meta: { role:'sync' } });
        if(rec&&rec.payload){
          loginSyncOk=true;
          pbRecordId=rec.id;
          if(typeof mergeLoginCatalogFromRemote==='function') mergeLoginCatalogFromRemote(rec.payload);
          mergeAdminAuthFromRemote(rec.payload, {remoteWinsAuth:true});
          migrateAdmins();
          migrateSpaces();
          migrateDriverPins();
          persistLocalOnly();
        }
      }
    }catch(_){
      loginSyncSlow=true;
    }
    if(pinErr&&pinErr.textContent===loginSyncHint) pinErr.textContent='';
    if(loginSyncSlow&&pinErr&&!loginSyncOk){
      pinErr.textContent='Медленный ответ сервера, продолжаем в фоне…';
    }
    migrateAdmins();
    if(!adm) adm=findAdminByLoginAndPin(loginRaw, pin);
  }
  if(!adm){
    if(pinErr){
      if(hasApiBase&&navigator.onLine!==false&&!verifiedByApi&&!loginSyncOk){
        pinErr.textContent='Сервер недоступен или отвечает слишком долго. Попробуйте позже.';
      }else if(hasApiBase&&navigator.onLine!==false&&!verifiedByApi&&loginSyncOk){
        if(looksLikeAdminPhoneInput(loginRaw)){
          const phone=typeof formatPhone==='function'?formatPhone(loginRaw):String(loginRaw||'').trim();
          const phoneKnown=(state.admins||[]).some(a=>adminLoginPhone(a)===phone);
          pinErr.textContent=phoneKnown
            ? 'Неверный PIN для этого телефона'
            : 'Телефон не найден или неверный PIN. Вход по телефону включает супер-админ в «Активность».';
        }else{
          pinErr.textContent=spaceIdsForLoginInn(inn).size
            ? 'Неверный PIN для этой организации'
            : 'Организация с таким ИНН не найдена. Проверьте цифры или обратитесь к супер-админу';
        }
      }else if(!loginSyncOk && navigator.onLine!==false){
        pinErr.textContent='Сессия с сервером устарела или сервер недоступен. Обновите страницу (Ctrl+F5) и войдите снова по телефону или ИНН и PIN';
      }else if(looksLikeAdminPhoneInput(loginRaw)){
        const phone=typeof formatPhone==='function'?formatPhone(loginRaw):String(loginRaw||'').trim();
        const phoneKnown=(state.admins||[]).some(a=>adminLoginPhone(a)===phone);
        pinErr.textContent=phoneKnown
          ? 'Неверный PIN для этого телефона'
          : 'Телефон не найден или неверный PIN. Вход по телефону включает супер-админ в «Активность».';
      }else{
        pinErr.textContent=spaceIdsForLoginInn(inn).size
          ? 'Неверный PIN для этой организации'
          : 'Организация с таким ИНН не найдена. Проверьте цифры или обратитесь к супер-админу';
      }
    }
    return;
  }
  if(pinErr&&pinErr.textContent.startsWith('Медленный ответ')) pinErr.textContent='';
  if(!verifiedByApi){
    const localPin=String(adm.pin||'').trim();
    if(localPin && pin!==localPin){
      if(pinErr) pinErr.textContent='Неверный PIN. Если доступ только что восстановили — обновите страницу (Ctrl+F5)';
      return;
    }
    if(hasApiBase&&navigator.onLine!==false&&!localPin){
      if(pinErr) pinErr.textContent='Сервер недоступен, попробуйте позже';
      return;
    }
  }else{
    delete adm.pin;
    upsertAdminInStateWithoutPin(adm);
  }
  if(adm.mustChangePin){
    alert('Смените PIN: «Активность» → блок администраторов. Слабый или устаревший PIN из истории проекта.');
  }
  currentAdmin={id:adm.id, name:adm.name, isSuper:!!adm.isSuper, spaceId:adm.spaceId||null};
  if(adm.isSuper&&adm.spaceId) state.adminOwnerFilter=adm.spaceId;
  saveAdminSession();
  markAdminPinOk();
  pushAdminLogin('login');
  touchAdminPresence('admin');
  startPresenceHeartbeat();
  rememberArmadaApiAuthOpts({ pin, meta: { role: 'admin', id: adm.id, spaceId: adm.spaceId || null } });
  (async ()=>{
    if(typeof armadaApiTokenRole==='function' && armadaApiTokenRole()!=='admin' && navigator.onLine!==false && typeof armadaApiVerifyAdmin==='function'){
      const loginRaw=(($('admin-login-inn')||{}).value||'').trim();
      if(loginRaw) await armadaApiVerifyAdmin(loginRaw, pin);
    }
    if(typeof pullRemoteUpdates==='function' && typeof armadaApiTokenRole==='function' && armadaApiTokenRole()==='admin'){
      try{ await pullRemoteUpdates('admin-login'); }catch(_){}
    }
    persist();
  })();
  updateAdminChrome();
  if(typeof clearEntrySkin==='function') clearEntrySkin();
  if(typeof finishSplashOnce==='function') finishSplashOnce('admin');
  else show('admin');
  renderAdmin();
  seedAdminInboxNotifySnapshot();
  syncAdminNotifyToggle();
  if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin();
  if(typeof maybeOpenAdminProfileOnLogin==='function') maybeOpenAdminProfileOnLogin(adm);
  }finally{
    if(btn) btn.disabled=false;
  }
}
async function logoutAdmin(){
  if(typeof armadaConfirm==='function'){
    const ok=await armadaConfirm({title:'Выйти из кабинета?', message:'', okLabel:'Выйти'});
    if(!ok) return;
  }
  if(currentAdmin){
    pushAdminLogin('logout');
    clearMyPresence();
    persist();
  }
  stopPresenceHeartbeat();
  currentAdmin=null;
  clearAdminSession();
  clearAdminPinOk();
  setArmadaApiToken('');
  updateAdminChrome();
  if(getEntryMode()==='admin') goEntryLanding('admin');
  else show('roles');
}
function migrateAdmins(){
  state.admins=(state.admins||[]).map(normalizeAdmin).filter(Boolean);
  // Вычистить удалённые тестовые учётки (Диспетчер и т.п.)
  state.admins=state.admins.filter(a=>{
    const nm=(a.name||'').trim().toLowerCase();
    return !RETIRED_ADMIN_IDS.has(a.id) && !RETIRED_ADMIN_NAMES.has(nm);
  });
  const hasApiBase=typeof API_BASE==='string'&&!!API_BASE;
  if(hasApiBase){
    (state.admins||[]).forEach((a)=>{
      if(!a||!a.id) return;
      if(a.id==='admin-super'||a.isSuper) delete a.pin;
    });
  }
  // Сид только офлайн без API; с armada-api админы приходят с сервера (без локального random PIN).
  if(!state.admins.length&&!hasApiBase){
    if(!state.settings||typeof state.settings!=='object') state.settings={};
    state.admins=[{
      id:'admin-super', name:'Наволоцкий Е.Н.', pin:null, isSuper:true, mustChangePin:true
    }];
  }
  state.admins.forEach(a=>{
    if(a.id==='admin-super' || (a.isSuper && (a.name||'').toLowerCase()==='супер админ')){
      a.name='Наволоцкий Е.Н.';
      if(a.id==='admin-super' || !a.id) a.id='admin-super';
      a.isSuper=true;
    }
    const pin=String(a.pin||'').trim();
    if(WEAK_ADMIN_PINS.has(pin)) a.mustChangePin=true;
    const drv=(state.drivers||[]).find(d=>samePersonName(d.name,a.name));
    if(!a.phone && drv&&drv.phone){
      const ph=typeof formatPhone==='function'?formatPhone(drv.phone):String(drv.phone||'').trim();
      if(ph) a.phone=ph;
    }
    if((a.id==='admin-super' || a.isSuper) && a.phone && a.loginBy!=='phone') a.loginBy='phone';
    if(!a.loginBy){
      if(samePersonName(a.name,'Нечаев А.С.') && (a.phone || (drv&&drv.phone))) a.loginBy='phone';
      else if(a.isSuper && a.phone) a.loginBy='phone';
      else a.loginBy='inn';
    }
  });
  if(!state.admins.some(a=>a.isSuper)){
    const first=state.admins[0];
    if(first) first.isSuper=true;
    else if(!hasApiBase){
      state.admins.push({id:'admin-super', name:'Наволоцкий Е.Н.', pin:null, isSuper:true, mustChangePin:true});
    }
  }
  state.adminLogins=Array.isArray(state.adminLogins)?state.adminLogins:[];
  state.adminPresence=Array.isArray(state.adminPresence)?state.adminPresence:[];
  stripRecoverParamFromUrl();
}
function stripRecoverParamFromUrl(){
  try{
    const u=new URL(location.href);
    if(!u.searchParams.has('recover') && !u.searchParams.has('reset')) return;
    u.searchParams.delete('recover');
    u.searchParams.delete('reset');
    const next=u.pathname+(u.search||'')+u.hash;
    history.replaceState(history.state,'',next);
  }catch(_){}
}
function isRecoveryOrWeakAdminPin(pin){
  const p=String(pin||'').trim();
  if(!p) return true;
  if(typeof WEAK_ADMIN_PINS!=='undefined' && WEAK_ADMIN_PINS.has(p)) return true;
  return false;
}
function markSuperPinChangedByUser(){
  if(!state.settings||typeof state.settings!=='object') state.settings={};
  state.settings.superPinChangedByUser=true;
  delete state.settings.superPinRecoveryNotice;
}
function mergeAdminAuthFromRemote(p, opts){
  const remoteWinsAuth=!!(opts&&opts.remoteWinsAuth);
  const remoteAdmins=(Array.isArray(p.admins)?p.admins:[]).map(normalizeAdmin).filter(Boolean)
    .filter(a=>!RETIRED_ADMIN_IDS.has(a.id) && !RETIRED_ADMIN_NAMES.has((a.name||'').trim().toLowerCase()));
  if(remoteAdmins.length){
    const localById=new Map((state.admins||[]).filter(a=>a&&a.id).map(a=>[a.id,a]));
    const merged=remoteAdmins.map(r=>{
      const loc=localById.get(r.id);
      if(!loc) return r;
      const locPin=String(loc.pin||'').trim();
      const remPin=String(r.pin||'').trim();
      // На другом устройстве в localStorage мог остаться старый PIN — при загрузке с сервера берём серверный.
      if(remoteWinsAuth) return r;
      if(locPin && locPin!==remPin && !isRecoveryOrWeakAdminPin(locPin)){
        const out={...r, pin:locPin};
        if(loc.mustChangePin) out.mustChangePin=true;
        else delete out.mustChangePin;
        return out;
      }
      return r;
    });
    localById.forEach((loc,id)=>{
      if(!merged.some(a=>a.id===id)) merged.push(loc);
    });
    state.admins=merged;
  }
  const byId=new Map();
  (state.adminLogins||[]).forEach(e=>{ if(e&&e.id) byId.set(e.id,e); });
  (Array.isArray(p.adminLogins)?p.adminLogins:[]).forEach(e=>{
    if(!e||!e.id) return;
    const prev=byId.get(e.id);
    if(!prev || Date.parse(e.at||0)>=Date.parse(prev.at||0)) byId.set(e.id,e);
  });
  state.adminLogins=[...byId.values()].sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0)).slice(0,120);
  const byDev=new Map();
  (state.adminPresence||[]).forEach(e=>{ if(e&&e.deviceId) byDev.set(e.deviceId,e); });
  (Array.isArray(p.adminPresence)?p.adminPresence:[]).forEach(e=>{
    if(!e||!e.deviceId) return;
    const prev=byDev.get(e.deviceId);
    if(!prev || Date.parse(e.lastSeen||0)>=Date.parse(prev.lastSeen||0)) byDev.set(e.deviceId,e);
  });
  // не затираем своё свежее присутствие
  const my=byDev.get(adminDeviceId());
  if(currentAdmin && my && Date.parse(my.lastSeen||0)<Date.now()-5000){
    byDev.set(adminDeviceId(), {
      deviceId:adminDeviceId(), adminId:currentAdmin.id, adminName:currentAdmin.name,
      isSuper:!!currentAdmin.isSuper, lastSeen:new Date().toISOString(), screen:my.screen||'admin'
    });
  }
  state.adminPresence=[...byDev.values()];
}
function openAdminLogin(){
  openAdminLoginAsync().catch(err=>console.warn('openAdminLogin', err));
}
async function openAdminLoginAsync(){
  migrateAdmins();
  if(currentAdmin && typeof isAdminPinOk==='function' && isAdminPinOk()){
    clearEntrySkin();
    show('admin');
    renderAdmin();
    if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin();
    return;
  }
  if(canAutoRestoreAdmin()){
    clearEntrySkin();
    show('admin');
    renderAdmin();
    if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin();
    return;
  }
  if(adminEntryRequiresPin() && !(typeof isAdminPinOk==='function' && isAdminPinOk())) currentAdmin=null;
  const innIn=$('admin-login-inn');
  const pinIn=$('pin-input');
  const hadInn=innIn&&innIn.value.trim();
  const hadPin=pinIn&&pinIn.value.trim();
  if(innIn&&!hadInn) innIn.value='';
  if(pinIn&&!hadPin) pinIn.value='';
  const pinErr=$('pin-error');
  if(pinErr) pinErr.textContent='';
  show('admin-pin');
  wireAdminLoginHandlers();
  try{ applyEntrySkin('admin-pin'); }catch(err){ console.warn('applyEntrySkin', err); }
  const btn=$('pin-ok');
  if(btn) btn.disabled=false;
  if(navigator.onLine!==false && typeof refreshAdminListForLogin==='function'){
    const listRefreshGen=globalThis.ARMADA_ADMIN_LIST_REFRESH_GEN||0;
    refreshAdminListForLogin().then(synced=>{
      if((globalThis.ARMADA_ADMIN_LIST_REFRESH_GEN||0)!==listRefreshGen) return;
      if(!synced&&pinErr&&!pinErr.textContent){
        pinErr.textContent='Не удалось обновить список с сервера — войдите по телефону или ИНН и PIN';
      }
    }).catch(err=>{
      console.warn('admin login list', err);
      if((globalThis.ARMADA_ADMIN_LIST_REFRESH_GEN||0)!==listRefreshGen) return;
      if(pinErr&&!pinErr.textContent){
        pinErr.textContent='Сервер не ответил — попробуйте войти по телефону или ИНН и PIN';
      }
    });
  }
}
function wireAdminLoginHandlers(){
  if(typeof loginAdmin!=='function') return;
  const ok=$('pin-ok');
  if(ok){
    ok.type='button';
    ok.onclick=()=>loginAdmin();
  }
  const pin=$('pin-input');
  if(pin){
    pin.onkeydown=e=>{
      if(e.key==='Enter'){ e.preventDefault(); loginAdmin(); }
    };
  }
  const inn=$('admin-login-inn');
  if(inn){
    inn.onkeydown=e=>{
      if(e.key==='Enter'){ e.preventDefault(); loginAdmin(); }
    };
  }
  const back=$('pin-back');
  if(back && typeof backFromEntryLogin==='function'){
    back.type='button';
    back.onclick=()=>backFromEntryLogin();
  }
}

async function armadaApiVerifyAdmin(login, pin){
  if(!API_BASE || !login || !pin) return null;
  try{
    const res=await fetchWithTimeout(`${API_BASE}/auth/verify-admin`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify({ login, pin })
    }, 25000);
    const data=await res.json().catch(()=>({}));
    if(res.status===401) return { invalidCredentials:true, error:data.error||'invalid_credentials' };
    if(res.ok && data.token){
      setArmadaApiToken(data.token);
      return data;
    }
    return { unavailable:true, status:res.status };
  }catch(err){
    console.warn('armada-api verify-admin', err);
    return { unavailable:true };
  }
}
