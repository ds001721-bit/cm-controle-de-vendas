/* CM – Controle de Vendas
   Firebase is used for shared cloud data. Fill FIREBASE_CONFIG in index.html.
*/
const firebaseConfig = window.CM_FIREBASE_CONFIG || null;
let db=null, auth=null, currentUser=null;
const KEY='cm_local_fallback_v3';
let state={sales:[],cities:['Vigia','Cidade 2','Cidade 3','Cidade 4','Cidade 5'],theme:'dark'};
const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmt=d=>d?d.split('-').reverse().join('/'):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const daysTo=d=>{if(!d)return 9999;return Math.ceil((new Date(d+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000)};
function status(v){const r=Math.max(0,+v.valor-(+v.pago||0)); if(r<=0)return ['pago','Pago']; const n=daysTo(v.vencimento); if(n<0)return ['atrasado','Atrasado']; if(n<=5)return ['amarelo',n===0?'Vence hoje':n===1?'Vence amanhã':`Vence em ${n} dias`]; return ['pendente','Pendente'];}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x)state={...state,...x};}catch(e){} if(!state.cities.length)state.cities=['Vigia','Cidade 2','Cidade 3','Cidade 4','Cidade 5'];}
function saveLocal(){localStorage.setItem(KEY,JSON.stringify(state));}
async function initCloud(){
  if(!firebaseConfig || firebaseConfig.apiKey==='COLOQUE_SUA_API_KEY_AQUI'){return false}
  if(!window.firebase)return false;
  firebase.initializeApp(firebaseConfig); auth=firebase.auth(); db=firebase.firestore();
  auth.onAuthStateChanged(async u=>{currentUser=u;if(u){$('loginScreen').classList.remove('show');$('app').classList.add('show');await loadCloud();render();}else{currentUser=null;$('loginScreen').classList.add('show');$('app').classList.remove('show')}});
  return true;
}
async function loadCloud(){
  const doc=await db.collection('users').doc(currentUser.uid).get();
  if(doc.exists)state={...state,...doc.data(),sales:doc.data().sales||[],cities:doc.data().cities||state.cities};
  else await db.collection('users').doc(currentUser.uid).set(state);
}
async function persist(){saveLocal();if(db&&currentUser)await db.collection('users').doc(currentUser.uid).set(state,{merge:true});render();}
async function login(){
  const user=$('loginUser').value.trim(), pass=$('loginPass').value;
  if(!user||!pass){$('loginMsg').textContent='Informe usuário e senha.';return}
  if(!auth){$('loginMsg').textContent='Banco online ainda não configurado. Configure o Firebase para ativar o login compartilhado.';return}
  // Firebase Auth uses a hidden email derived from the username.
  try{await auth.signInWithEmailAndPassword(user.toLowerCase().replace(/\s+/g,'.')+'@cm.local',pass);}
  catch(e){$('loginMsg').textContent='Usuário ou senha incorretos.'}
}
async function createInitialUser(){
  if(!auth){alert('Configure o Firebase primeiro.');return}
  const user=$('loginUser').value.trim(), pass=$('loginPass').value;
  if(!user||!pass)return alert('Informe usuário e senha.');
  try{const c=await auth.createUserWithEmailAndPassword(user.toLowerCase().replace(/\s+/g,'.')+'@cm.local',pass);await db.collection('users').doc(c.user.uid).set(state);alert('Usuário criado.');}
  catch(e){alert(e.code==='auth/email-already-in-use'?'Esse usuário já existe.':'Não foi possível criar o usuário. '+e.message)}
}
async function logout(){if(auth)await auth.signOut();else{$('app').classList.remove('show');$('loginScreen').classList.add('show')}}
function applyTheme(){document.documentElement.dataset.theme=state.theme;localStorage.setItem('cm_theme',state.theme)}
function render(){
 const all=state.sales||[], q=($('globalSearch')?.value||'').toLowerCase(), filter=$('filter')?.value||'todos';
 let total=0,rec=0,paid=0,late=0;all.forEach(v=>{const r=Math.max(0,+v.valor-(+v.pago||0));total+=+v.valor||0;paid+=+v.pago||0;rec+=r;if(status(v)[0]==='atrasado')late+=r});
 $('total').textContent=money(total);$('receber').textContent=money(rec);$('recebido').textContent=money(paid);$('atrasado').textContent=money(late);
 let arr=all.filter(v=>(v.cliente+' '+(v.produto||'')+' '+(v.telefone||'')+' '+(v.cidade||'')).toLowerCase().includes(q)).filter(v=>filter==='todos'||status(v)[0]===filter);
 arr.sort((a,b)=>a.cliente.localeCompare(b.cliente,'pt-BR',{sensitivity:'base'}));
 $('rows').innerHTML=arr.map(v=>{const [s,t]=status(v),r=Math.max(0,+v.valor-(+v.pago||0));return `<tr><td><button class="linkname" onclick="openClient('${v.id}')"><b>${esc(v.cliente)}</b></button><br><small>${esc(v.telefone||'')}</small></td><td>${esc(v.produto)}<br><small>${esc(v.cidade||'')}</small></td><td>${money(v.valor)}</td><td class="green">${money(v.pago)}</td><td class="${r?'red':'green'}">${money(r)}</td><td>${fmt(v.vencimento)}</td><td><span class="pill ${s}">${t}</span></td><td><div class="actions"><button class="mini" onclick="payment('${v.id}')">💰</button><button class="mini" onclick="removeSale('${v.id}')">🗑</button></div></td></tr>`}).join('');
 $('empty').style.display=arr.length?'none':'block';
 const upcoming=all.filter(v=>status(v)[0]!=='pago').sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||'')).slice(0,8);
 $('dues').innerHTML=upcoming.length?upcoming.map(v=>{const [s,t]=status(v),r=+v.valor-(+v.pago||0);return `<div class="due ${s}"><div><b>${esc(v.cliente)}</b><small>${esc(v.cidade||'')} • ${fmt(v.vencimento)}</small></div><strong>${t} • ${money(r)}</strong></div>`}).join(''):'<div class="empty">Nenhum vencimento pendente.</div>';
 $('citiesMenu').innerHTML=state.cities.map(c=>`<button onclick="filterCity('${esc(c).replace(/'/g,"\\'")}')"><span>🏙️</span>${esc(c)} <small>(${all.filter(v=>v.cidade===c).length})</small></button>`).join('');
}
function filterCity(c){$('globalSearch').value=c;render()}
function openSale(editId=null){$('modalTitle').textContent=editId?'Editar venda':'Nova venda';$('editId').value=editId||'';$('modal').classList.add('show');const v=state.sales.find(x=>x.id===editId);if(v){for(const k of ['cliente','telefone','produto','valor','data','vencimento','pago','obs','cidade'])if($(k))$(k).value=v[k]??''}else{$('data').value=today();$('vencimento').value=today();$('pago').value=0;$('cliente').value='';$('telefone').value='';$('produto').value='';$('valor').value='';$('obs').value='';}fillCities();}
function fillCities(){const s=$('cidade');if(!s)return;s.innerHTML=state.cities.map(c=>`<option>${esc(c)}</option>`).join('')}
function closeModal(){$('modal').classList.remove('show')}
async function saveSale(){let id=$('editId').value, cliente=$('cliente').value.trim(),produto=$('produto').value.trim(),valor=+$('valor').value||0,pago=+$('pago').value||0;if(!cliente||!produto||valor<=0||!$('vencimento').value)return alert('Preencha cliente, produto, valor e vencimento.');if(pago>valor)return alert('O pagamento não pode ser maior que o valor.');let old=state.sales.find(v=>v.id===id);let v={...(old||{}),id:id||uid(),cliente,telefone:$('telefone').value.trim(),produto,valor,pago,data:$('data').value||today(),vencimento:$('vencimento').value,obs:$('obs').value.trim(),cidade:$('cidade').value||state.cities[0],history:old?.history||[]};if(!id&&pago>0)v.history.push({type:'pagamento',date:v.data,value:pago,note:'Pagamento inicial'});if(id){const i=state.sales.findIndex(x=>x.id===id);state.sales[i]=v}else state.sales.push(v);await persist();closeModal()}
async function payment(id){const v=state.sales.find(x=>x.id===id),r=Math.max(0,+v.valor-(+v.pago||0));let p=prompt(`Cliente: ${v.cliente}\nRestante: ${money(r)}\n\nValor recebido:`);if(p===null)return;p=+String(p).replace(',','.');if(!p||p<0||p>r)return alert('Valor inválido.');v.pago=(+v.pago||0)+p;v.history=v.history||[];v.history.push({type:'pagamento',date:today(),value:p,note:'Pagamento registrado'});await persist()}
async function reschedule(id){const v=state.sales.find(x=>x.id===id),d=prompt('Nova data de vencimento (AAAA-MM-DD):',v.vencimento);if(!d)return;v.history=v.history||[];v.history.push({type:'remarcacao',date:today(),from:v.vencimento,to:d});v.vencimento=d;await persist();openClient(id)}
async function markReturn(id){const v=state.sales.find(x=>x.id===id);if(!confirm('Registrar devolução? O histórico será mantido.'))return;v.returned=true;v.history=v.history||[];v.history.push({type:'devolucao',date:today(),note:'Produto devolvido'});await persist();openClient(id)}
async function removeSale(id){const v=state.sales.find(x=>x.id===id);if(!v)return;if(confirm('Mover este cliente para Devoluções/Arquivo sem apagar o histórico?')){v.archived=true;v.history=v.history||[];v.history.push({type:'arquivamento',date:today(),note:'Cliente arquivado'});await persist()}}
function openClient(id){const v=state.sales.find(x=>x.id===id);if(!v)return;const h=(v.history||[]).slice().reverse();$('clientBox').innerHTML=`<h2>${esc(v.cliente)}</h2><div class="clientgrid"><div><b>Cidade</b><br>${esc(v.cidade||'—')}</div><div><b>Telefone</b><br>${esc(v.telefone||'—')}</div><div><b>Produto</b><br>${esc(v.produto)}</div><div><b>Valor</b><br>${money(v.valor)}</div><div><b>Pago</b><br>${money(v.pago)}</div><div><b>Próximo vencimento</b><br>${fmt(v.vencimento)} — ${status(v)[1]}</div></div><div class="modalfoot"><button class="btn" onclick="payment('${v.id}')">💰 Registrar pagamento</button><button class="btn secondary" onclick="reschedule('${v.id}')">📅 Remarcar</button><button class="btn secondary" onclick="openSale('${v.id}')">✏️ Editar</button><button class="btn secondary" onclick="markReturn('${v.id}')">↩️ Devolução</button>${v.telefone?`<button class="btn" onclick="whatsapp('${v.id}')">🟢 WhatsApp</button>`:''}</div><h3>Histórico</h3><div class="history">${h.length?h.map(x=>x.type==='pagamento'?`<div>💰 Pagamento de <b>${money(x.value)}</b> em ${fmt(x.date)}</div>`:x.type==='remarcacao'?`<div>📅 Vencimento remarcado de <b>${fmt(x.from)}</b> para <b>${fmt(x.to)}</b> em ${fmt(x.date)}</div>`:`<div>↩️ ${esc(x.note||'Movimentação')} em ${fmt(x.date)}</div>`).join(''):'<div class="empty">Nenhum registro ainda.</div>'}</div>`;$('clientModal').classList.add('show')}
function closeClient(){$('clientModal').classList.remove('show')}
function whatsapp(id){const v=state.sales.find(x=>x.id===id);if(!v.telefone)return;const phone=v.telefone.replace(/\D/g,'');const msg=status(v)[0]==='atrasado'?`Olá, ${v.cliente}! Passando para lembrar que seu pagamento está pendente e vencido. Podemos combinar uma nova data?`: `Olá, ${v.cliente}! Seu próximo pagamento está previsto para ${fmt(v.vencimento)}. Se precisar remarcar, me avise.`;window.open('https://wa.me/55'+phone+'?text='+encodeURIComponent(msg),'_blank')}
function showPayments(){ $('filter').value='pendente';render();$('rows').scrollIntoView({behavior:'smooth'})}
function showReturns(){const arr=state.sales.filter(v=>v.returned);alert(arr.length?arr.map(v=>`${v.cliente} — devolução registrada`).join('\n'):'Nenhuma devolução registrada.')}
function addCity(){const c=prompt('Nome da cidade:');if(c&&c.trim()){state.cities.push(c.trim());persist()}}
function settings(){fillCities();$('settingsUser').value='Daniel Saulo';$('theme').value=state.theme;$('settingsModal').classList.add('show')}
function closeSettings(){$('settingsModal').classList.remove('show')}
async function saveSettings(){state.theme=$('theme').value;applyTheme();await persist();closeSettings()}
function exportCSV(){const lines=[['Cliente','Cidade','Telefone','Produto','Valor','Pago','Restante','Venda','Vencimento','Status']];state.sales.forEach(v=>lines.push([v.cliente,v.cidade,v.telefone,v.produto,v.valor,v.pago,Math.max(0,v.valor-v.pago),v.data,v.vencimento,status(v)[1]]));const csv=lines.map(r=>r.map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='CM-controle-vendas.csv';a.click()}
function setupEvents(){ $('loginBtn').onclick=login;$('createBtn').onclick=createInitialUser;$('logoutBtn').onclick=logout;$('newSaleBtn').onclick=()=>openSale();$('settingsBtn').onclick=settings;$('addCityBtn').onclick=addCity;$('returnsBtn').onclick=showReturns;$('paymentsBtn').onclick=showPayments;document.querySelectorAll('.closex').forEach(x=>x.onclick=()=>x.closest('.modal').classList.remove('show'));$('theme').onchange=e=>{state.theme=e.target.value;applyTheme()}; }
loadLocal();state.theme=localStorage.getItem('cm_theme')||state.theme;applyTheme();document.addEventListener('DOMContentLoaded',async()=>{setupEvents();fillCities();const ok=await initCloud();if(!ok){$('loginScreen').classList.remove('show');$('app').classList.add('show');render();$('cloudWarn').style.display='block'}});
