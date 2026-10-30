import {keys,defaults,servings,dateKey,range,totals} from './nutrition.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const labels={protein:'蛋白質',carbs:'碳水',veg:'蔬菜',water:'飲水',fat:'油脂'},icons={protein:'🥚',carbs:'🍙',veg:'🥦',water:'💧',fat:'🥑'},colors={protein:['#cb9c84','#f3e8df'],carbs:['#c2b06f','#f2efdf'],veg:['#94ab83','#eaf0e3'],water:['#8bafbe','#e5eef1'],fat:['#b6a2bc','#eee7f0']};
const LOCAL='nanitabeta-local-v1';
let isAdmin=false;
let authEpoch=0;
$('#upload-local').nextElementSibling.textContent='只有管理者核准的 Google 帳號可使用雲端同步；未核准者仍可使用本機紀錄。本機資料不自動上傳，核准登入後可按「合併」匯入。';
const accessPanel=document.createElement('section');accessPanel.id='access-panel';accessPanel.className='panel';accessPanel.hidden=true;
accessPanel.innerHTML='<h2>核准雲端同步帳號</h2><p class="muted">只有你能管理名單。核准後，各帳號仍只能讀寫自己的飲食紀錄。你的管理帳號永久保留同步資格。</p><form id="approval-form"><label>對方的 Google 帳號電子郵件<input id="approval-email" type="email" maxlength="254" required placeholder="friend@gmail.com"></label><button class="primary full-width">核准此帳號</button></form><p id="approval-status" role="status"></p><div id="approval-list"></div><p class="muted small">取消核准會停止對方雲端存取，不會刪除既有雲端紀錄；對方仍可使用本機功能。核准名單不會公開在 GitHub。</p>';
$('#settings .settings-grid').append(accessPanel);
let authInitializing=Boolean(localStorage.getItem('nanitabeta-firebase')||window.FIREBASE_CONFIG);
function ensureAuth(){if(authInitializing)throw Error('正在確認登入狀態，請稍候再儲存');}
function ask(message){return new Promise(resolve=>{const dialog=document.createElement('dialog');const p=document.createElement('p');p.textContent=message;const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:12px';const cancel=document.createElement('button'),ok=document.createElement('button');cancel.className='secondary';cancel.textContent='取消';ok.className='primary';ok.textContent='確認';actions.append(cancel,ok);dialog.append(p,actions);document.body.append(dialog);let result=false;ok.onclick=()=>{result=true;dialog.close();};cancel.onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();resolve(result);};dialog.showModal();cancel.focus();});}
let local=JSON.parse(localStorage.getItem(LOCAL)||'{"entries":[],"goals":null}'),entries=local.entries||[],goals={...defaults,...local.goals},user=null,cloud=null,unsubs=[],editing=null,ready=false;
const fmt=n=>Number(n.toFixed(2)).toLocaleString('zh-TW'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),unit=k=>k==='water'?'ml':'份';
function notify(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').style.display='none',4500);}
function localSave(){localStorage.setItem(LOCAL,JSON.stringify(local));}
function show(view){$$('.view').forEach(e=>e.hidden=e.id!==view);$$('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===view));$('#page-title').textContent={today:'今日の紀錄',history:'飲食回顧',settings:'目標與同步'}[view];render();window.scrollTo(0,0);}
$$('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));$('#settings-shortcut').onclick=$('#edit-goals').onclick=()=>show('settings');
$('#day').value=$('#history-day').value=dateKey();
for(const [id,delta] of [['prev-day',-1],['next-day',1]])$('#'+id).onclick=()=>{const d=new Date($('#day').value+'T12:00:00');d.setDate(d.getDate()+delta);$('#day').value=dateKey(d);render();};
$('#go-today').onclick=()=>{$('#day').value=dateKey();render();};
['day','history-day','period'].forEach(id=>$('#'+id).onchange=render);
function chips(e){const s=servings(e);return keys.filter(k=>s[k]>0).map(k=>`${labels[k]} ${fmt(s[k])}${unit(k)}`).join(' · ')||'尚未填寫營養素';}
function entryHTML(e,withDate=false){return `<article class="entry"><div class="food-icon">${e.meal==='飲水'?'💧':({'早餐':'🍞','午餐':'🍱','晚餐':'🍲','點心':'🍡'}[e.meal]||'🍽️')}</div><div class="entry-body">${withDate?`<div class="entry-date">${esc(e.date)} · ${esc(e.meal)}</div>`:''}<strong>${esc(e.name)}</strong><p>${chips(e)}</p>${e.note?`<p>${esc(e.note)}</p>`:''}${e.mode==='grams'?`<p>原始克數：蛋白質 ${fmt(e.protein)}g／碳水 ${fmt(e.carbs)}g／油脂 ${fmt(e.fat)}g · 基數 ${e.factor}</p>`:''}</div><div class="entry-actions"><button class="icon-button" data-edit="${esc(e.id)}" aria-label="編輯 ${esc(e.name)}">✎ 編輯</button><button class="icon-button" data-delete="${esc(e.id)}" aria-label="刪除 ${esc(e.name)}">×</button></div></article>`;}
function bindEntries(){ $$('[data-edit]').forEach(b=>b.onclick=()=>openEntry(entries.find(e=>e.id===b.dataset.edit)));$$('[data-delete]').forEach(b=>b.onclick=async()=>{if(!await ask('刪除這筆飲食紀錄？'))return;b.disabled=true;try{await removeEntry(b.dataset.delete);notify('已刪除紀錄');}catch(e){notify('刪除失敗：'+e.message);b.disabled=false;}}); }
function isWaterRecord(e){return e.meal==='飲水'||(Number(e.water)>0&&['protein','carbs','fat','veg'].every(k=>Number(e[k]||0)===0));}
function render(){
 const day=$('#day').value||dateKey(),selected=entries.filter(e=>e.date===day),total=totals(selected),food=selected.filter(e=>!isWaterRecord(e));
 $('#weekday').textContent=new Date(day+'T12:00:00').toLocaleDateString('zh-TW',{weekday:'long'});
 $('#rings').innerHTML=keys.map(k=>{const pct=total[k]/goals[k]*100;return `<div class="ring-card" style="--color:${colors[k][0]};--tint:${colors[k][1]};--percent:${Math.min(100,pct)}%"><div class="ring-title">${icons[k]} ${labels[k]}</div><div class="ring" role="img" aria-label="${labels[k]} ${fmt(total[k])}，目標 ${goals[k]}${unit(k)}"><div class="ring-value">${fmt(total[k])}<small>/ ${goals[k]} ${unit(k)}</small></div></div><div class="ring-meta">${pct>=100?'目標達成 ✓':`還差 ${fmt(Math.max(0,goals[k]-total[k]))} ${unit(k)}`}</div></div>`;}).join('');
 $('#entry-count').textContent=`${food.length} 筆紀錄`;
 $('#meals').innerHTML=food.length?['早餐','午餐','晚餐','點心'].map(m=>{const list=food.filter(e=>e.meal===m);return list.length?`<div class="meal-group"><h3>${m}</h3>${list.map(e=>entryHTML(e)).join('')}</div>`:'';}).join(''):'<div class="empty"><span class="empty-icon">🍽️</span>此日期尚無飲食紀錄。<br><button class="secondary add-entry">＋ 新增飲食紀錄</button></div>';
 const r=range($('#history-day').value||dateKey(),$('#period').value),history=entries.filter(e=>e.date>=r.from&&e.date<=r.to).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)),sum=totals(history),historyFood=history.filter(e=>!isWaterRecord(e));
 $('#range-label').textContent=`${r.from} — ${r.to} · 共 ${r.days} 天（包含無紀錄日；當期計算至今天）`;
 $('#averages').innerHTML=keys.map(k=>`<div class="average" style="--tint:${colors[k][1]}"><span>${icons[k]} ${labels[k]}</span><strong>${fmt(sum[k]/r.days)} <small>${unit(k)}／天</small></strong><small>期間合計 ${fmt(sum[k])} ${unit(k)}</small></div>`).join('');
 $('#history-count').textContent=`${historyFood.length} 筆`;
 $('#history-list').innerHTML=historyFood.length?historyFood.map(e=>entryHTML(e,true)).join(''):'<div class="empty">此期間無飲食紀錄</div>';
 $$('.add-entry').forEach(b=>b.onclick=()=>openEntry());bindEntries();
}
function renderGoals(){$('#goals-form').innerHTML=keys.map(k=>`<label>${icons[k]} ${labels[k]}（${unit(k)}）<input name="${k}" type="number" min="0.01" max="100000" step="any" value="${goals[k]}" required></label>`).join('')+'<button class="primary full">儲存每日目標</button>';}
$('#goals-form').onsubmit=async e=>{e.preventDefault();const next=Object.fromEntries(keys.map(k=>[k,Number(new FormData(e.target).get(k))]));try{ensureAuth();if(user){if(!ready)throw Error('雲端載入中，請稍候');await cloud.f.setDoc(cloud.f.doc(cloud.db,'foodUsers',user.uid,'settings','goals'),next);}else{local.goals=next;localSave();goals=next;}render();notify('營養目標已儲存');}catch(err){notify(err.message);}};
const form=$('#entry-form');
function openEntry(e){editing=e?.id||null;form.reset();form.elements.date.value=e?.date||$('#day').value||dateKey();if(e)for(const k of ['name','meal','mode','factor','note'])form.elements[k].value=e[k]??'';$('#form-title').textContent=e?'編輯紀錄':'新增紀錄';$('#form-error').textContent='';renderInputs(e);$('#entry-dialog').showModal();}
function renderInputs(e){
 const gram=form.elements.mode.value==='grams';$('#factor-label').hidden=!gram;
 $('#nutrient-inputs').innerHTML=['protein','carbs','fat','veg','water'].map(k=>{
  const value=e?.[k]??0,u=k==='water'?'ml':k==='veg'?'份':gram?'g':'份',id='nutrient-'+k;
  const quick=!gram||k==='water',choices=k==='water'?[250,500,750,1000]:[1,2,3,4],quantity=k==='water'?'量':'份數';
  const manual=quick&&Number(value)!==0&&!choices.includes(Number(value));
  return `<div class="nutrient-field" ${quick?`data-portion="${k}" data-unit="${u}" data-manual="${manual}"`:''}><label for="${id}">${icons[k]} ${labels[k]}（${u}）</label>${quick?`<div class="portion-choices" role="group" aria-label="${labels[k]}${quantity}">${choices.map(n=>`<button type="button" data-value="${n}" aria-label="${labels[k]} ${n}${u}" aria-pressed="false">${n}</button>`).join('')}<button type="button" data-manual-input aria-label="自行輸入${labels[k]}${quantity}" aria-pressed="false">輸入</button></div><span class="portion-value" aria-live="polite"></span>`:''}<input id="${id}" name="${k}" aria-label="${labels[k]}（${u}）" type="number" inputmode="decimal" min="0" max="100000" step="any" value="${value}" ${quick&&!manual?'hidden':''} required></div>`;
 }).join('');
 $$('[data-portion]').forEach(field=>{
  const input=field.querySelector('input');
  field.querySelectorAll('[data-value]').forEach(button=>button.onclick=()=>{
   input.value=field.dataset.manual!=='true'&&input.value===button.dataset.value?'0':button.dataset.value;
   field.dataset.manual='false';input.hidden=true;preview();
  });
  field.querySelector('[data-manual-input]').onclick=()=>{field.dataset.manual='true';input.hidden=false;preview();input.focus();input.select();};
 });
 preview();
}
function syncPortionControls(){
 $$('[data-portion]').forEach(field=>{
  const input=field.querySelector('input'),manual=field.dataset.manual==='true',value=Number(input.value)||0;
  field.querySelector('.portion-value').textContent=value===0?`0 ${field.dataset.unit} · 不計入`:`${fmt(value)} ${field.dataset.unit}`;
  field.querySelectorAll('[data-value]').forEach(button=>button.setAttribute('aria-pressed',String(!manual&&value===Number(button.dataset.value))));
  field.querySelector('[data-manual-input]').setAttribute('aria-pressed',String(manual));
 });
}
form.elements.mode.onchange=()=>{renderInputs();notify('已切換單位，營養數值已歸零，請重新輸入');};
function readForm(){const e=Object.fromEntries(new FormData(form));keys.forEach(k=>e[k]=Number(e[k]));e.factor=Number(e.factor);return e;}
function preview(){syncPortionControls();const e=readForm();$('#conversion-preview').textContent='換算份數：'+chips(e)+(e.mode==='grams'?'。扣除後小於0的蛋白質／油脂以0份計。':'');}
form.oninput=preview;form.elements.factor.onchange=preview;
$('#close-dialog').onclick=()=>$('#entry-dialog').close();
form.onsubmit=async event=>{event.preventDefault();$('#save-entry').disabled=true;try{const e={...readForm(),id:editing||crypto.randomUUID(),updatedAt:Date.now()};e.name=e.name.trim()||'未命名食物';if(!validEntry(e))throw Error('請確認日期、營養數值及名稱長度（最多100字）');await saveEntry(e);$('#entry-dialog').close();notify('已儲存紀錄');}catch(err){$('#form-error').textContent='儲存失敗：'+err.message;}finally{$('#save-entry').disabled=false;}};
function validEntry(e){return typeof e.id==='string'&&/^[\w-]{1,100}$/.test(e.id)&&typeof e.name==='string'&&e.name.trim().length>0&&e.name.length<=100&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&!isNaN(Date.parse(e.date))&&['早餐','午餐','晚餐','點心','飲水'].includes(e.meal)&&['grams','servings'].includes(e.mode)&&[3,5,10].includes(e.factor)&&keys.every(k=>Number.isFinite(e[k])&&e[k]>=0&&e[k]<=100000)&&(!e.note||typeof e.note==='string'&&e.note.length<=300);}
async function saveEntry(e){ensureAuth();if(user){if(!ready)throw Error('雲端尚未連線，請稍候');await cloud.f.setDoc(cloud.f.doc(cloud.db,'foodUsers',user.uid,'entries',e.id),e);}else{const next=local.entries.filter(x=>x.id!==e.id);next.push(e);const old=local.entries;local.entries=next;try{localSave();}catch(err){local.entries=old;throw err;}entries=local.entries;render();}}
async function removeEntry(id){ensureAuth();if(user){if(!ready)throw Error('雲端尚未連線');await cloud.f.deleteDoc(cloud.f.doc(cloud.db,'foodUsers',user.uid,'entries',id));}else{const old=local.entries;local.entries=old.filter(e=>e.id!==id);try{localSave();}catch(err){local.entries=old;throw err;}entries=local.entries;render();}}
$('#water-add').onclick=async()=>{try{await saveEntry({id:crypto.randomUUID(),date:$('#day').value,meal:'飲水',name:'喝一杯水',mode:'servings',factor:3,protein:0,carbs:0,fat:0,veg:0,water:250,note:'',updatedAt:Date.now()});notify('已新增飲水 250ml');}catch(e){notify(e.message);}};
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#backup').onclick=()=>download(`何食べた-${dateKey()}.json`,JSON.stringify({version:1,entries,goals},null,2),'application/json');
$('#export').onclick=()=>{const r=range($('#history-day').value,$('#period').value),cell=x=>'"'+String(x).replace(/"/g,'""')+'"',rows=[['日期','餐別','食物名稱',...keys.map(k=>labels[k]+'('+unit(k)+')'),'輸入方式','蛋白質原值','碳水原值','油脂原值','基數','備註'],...entries.filter(e=>e.date>=r.from&&e.date<=r.to).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{const s=servings(e);return [e.date,e.meal,e.name,...keys.map(k=>s[k]),e.mode,e.protein,e.carbs,e.fat,e.factor,e.note];})];download(`何食べた-${r.from}-${r.to}.csv`,'\ufeff'+rows.map(row=>row.map(x=>cell(/^[=+@\-\t\r]/.test(String(x))?'\''+x:x)).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
$('#restore').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>10000000)throw Error('檔案過大');const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.entries)||!data.entries.every(validEntry))throw Error('備份格式不正確');if(!await ask(`將合併 ${data.entries.length} 筆紀錄，相同 ID 保留現有內容。是否繼續？`))return;let count=0;for(const e of data.entries)if(!entries.some(x=>x.id===e.id)){await mergeEntry(e);count++;}notify(`已合併 ${count} 筆紀錄（每日目標保留目前設定）`);}catch(e){notify('還原失敗：'+e.message);}event.target.value='';};
async function mergeEntry(e){if(!user)return saveEntry(e);if(!ready)throw Error('雲端尚未連線');const ref=cloud.f.doc(cloud.db,'foodUsers',user.uid,'entries',e.id);await cloud.f.runTransaction(cloud.db,async tx=>{const existing=await tx.get(ref);if(!existing.exists())tx.set(ref,e);});}
$('#save-config').onclick=()=>{try{const c=JSON.parse($('#config').value);if(!['apiKey','authDomain','projectId','appId'].every(k=>typeof c[k]==='string'&&c[k]))throw Error('請包含 apiKey、authDomain、projectId、appId');if('private_key'in c)throw Error('請勿使用服務帳號金鑰');localStorage.setItem('nanitabeta-firebase',JSON.stringify(c));location.reload();}catch(e){notify('設定無效：'+e.message);}};
function syncStatus(s){$('#sync-status').textContent=s;$('#connection').textContent='● '+s;}
function localMode(account,message='本機儲存模式'){
 user=null;isAdmin=false;ready=false;entries=local.entries;goals={...defaults,...local.goals};accessPanel.hidden=true;
 $('#login').hidden=false;$('#login').textContent=account?'重新檢查同步資格':'使用 Google 登入';
 $('#logout').hidden=!account;$('#upload-local').hidden=true;$('#account-status').textContent='本機模式';
 syncStatus(message);renderGoals();render();
}
function renderApprovals(snap){
 $('#approval-status').textContent=snap.empty?'尚未核准其他帳號。':`已核准 ${snap.size} 個帳號`;
 $('#approval-list').innerHTML=snap.docs.map(d=>`<div class="entry"><div class="entry-body"><strong>${esc(d.id)}</strong></div><button class="secondary" data-revoke="${esc(d.id)}">取消核准</button></div>`).join('');
 $$('[data-revoke]').forEach(b=>b.onclick=async()=>{if(!await ask(`取消 ${b.dataset.revoke} 的雲端同步資格？既有紀錄會保留。`))return;b.disabled=true;try{await cloud.f.deleteDoc(cloud.f.doc(cloud.db,'syncApprovals',b.dataset.revoke));notify('已取消雲端同步資格');}catch(e){notify('取消失敗：'+e.message);b.disabled=false;}});
}
$('#approval-form').onsubmit=async event=>{
 event.preventDefault();if(!user||!isAdmin)return;const email=$('#approval-email').value.trim().toLowerCase();
 if(!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email))return notify('請輸入有效的 Google 帳號電子郵件');
 const button=event.target.querySelector('button');button.disabled=true;
 try{await cloud.f.setDoc(cloud.f.doc(cloud.db,'syncApprovals',email),{enabled:true});$('#approval-email').value='';notify('已核准此帳號的雲端同步');}catch(e){notify('核准失敗：'+e.message);}finally{button.disabled=false;}
};
async function initCloud(){
 let config;
 try{config=JSON.parse(localStorage.getItem('nanitabeta-firebase')||'null')||window.FIREBASE_CONFIG;}catch{authInitializing=false;notify('Firebase 設定無效，請重新設定');return;}
 if(!config){authInitializing=false;return;}
 $('#config').value=JSON.stringify(config,null,2);
 try{
  const base='https://www.gstatic.com/firebasejs/12.4.0/';
  const [a,auth,f]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
  const app=a.initializeApp(config),au=auth.getAuth(app),db=f.getFirestore(app);cloud={a,auth,f,au,db};
  await auth.setPersistence(au,auth.browserLocalPersistence);
  auth.onAuthStateChanged(au,async u=>{
   const epoch=++authEpoch;unsubs.forEach(fn=>fn());unsubs=[];user=null;isAdmin=false;ready=false;accessPanel.hidden=true;
   if(!u){authInitializing=false;localMode(null);return;}
   authInitializing=true;syncStatus('正在確認雲端同步資格…');
   try{
    const admin=(await f.getDocFromServer(f.doc(db,'syncAdmins',u.uid))).data()?.enabled===true,accessRef=u.email&&u.emailVerified?f.doc(db,'syncApprovals',u.email.toLowerCase()):null;
    const allowed=admin||(accessRef&&(await f.getDocFromServer(accessRef)).data()?.enabled===true);
    if(epoch!==authEpoch)return;
    authInitializing=false;
    if(!allowed){localMode(u,'此帳號尚未獲核准雲端同步，已使用本機紀錄。請洽網站管理者核准後重新檢查。');return;}
    user=u;isAdmin=admin;entries=[];goals={...defaults};
    $('#login').hidden=true;$('#logout').hidden=false;$('#upload-local').hidden=false;$('#account-status').textContent='已登入';
    renderGoals();render();syncStatus('雲端載入中…');
    const accessFailure=err=>{
     if(epoch!==authEpoch)return;
     ready=false;
     if(err.code==='permission-denied'){unsubs.forEach(fn=>fn());unsubs=[];localMode(u,'雲端同步資格已取消或尚未核准，目前使用本機紀錄。');}
     else syncStatus('同步失敗：'+err.message);
    };
    unsubs.push(f.onSnapshot(f.collection(db,'foodUsers',u.uid,'entries'),{includeMetadataChanges:true},snap=>{
     if(epoch!==authEpoch||!user)return;
     entries=snap.docs.map(d=>d.data()).filter(validEntry);ready=!snap.metadata.fromCache;
     syncStatus(snap.metadata.hasPendingWrites?'等待雲端確認…':snap.metadata.fromCache?'離線：顯示快取，請連線後再編輯':'雲端已同步');render();
    },accessFailure));
    unsubs.push(f.onSnapshot(f.doc(db,'foodUsers',u.uid,'settings','goals'),s=>{
     if(epoch!==authEpoch||!user)return;goals={...defaults,...(s.data()||{})};renderGoals();render();
    },accessFailure));
    if(admin){
     accessPanel.hidden=false;
     unsubs.push(f.onSnapshot(f.collection(db,'syncApprovals'),renderApprovals,err=>{$('#approval-status').textContent='名單載入失敗：'+err.message;}));
    }else{
     unsubs.push(f.onSnapshot(accessRef,s=>{
      if(epoch!==authEpoch||s.metadata.fromCache)return;
      if(s.data()?.enabled!==true){unsubs.forEach(fn=>fn());unsubs=[];localMode(u,'雲端同步資格已取消，目前使用本機紀錄。');}
     },accessFailure));
    }
   }catch(e){if(epoch!==authEpoch)return;authInitializing=false;localMode(u,'暫時無法確認雲端資格，已使用本機紀錄。請連線後重新檢查。');}
  });
 }catch(e){authInitializing=false;localMode(null,'Firebase 連線失敗，使用本機紀錄：'+e.message);}
}
$('#login').onclick=async()=>{if(!cloud){notify('請先設定獨立 Firebase 專案的 Web config');show('settings');return;}if(cloud.au.currentUser){location.reload();return;}try{await cloud.auth.signInWithPopup(cloud.au,new cloud.auth.GoogleAuthProvider());}catch(e){notify('登入失敗：'+e.message);}};
$('#logout').onclick=async()=>{try{await cloud.auth.signOut(cloud.au);}catch(e){notify(e.message);}};
$('#upload-local').onclick=async()=>{if(!user||!ready)return notify('請先登入並等待雲端載入');if(!await ask(`將本機 ${local.entries.length} 筆紀錄合併至目前 Google 帳號，相同 ID 保留雲端版本。`))return;$('#upload-local').disabled=true;try{for(const e of local.entries)await mergeEntry(e);notify('本機紀錄已合併至雲端，目標保留雲端設定');}catch(e){notify('合併未完成，可重試：'+e.message);}finally{$('#upload-local').disabled=false;}};
renderGoals();render();initCloud();
