'use strict';
/* World Idle — site. Dados no Supabase; abas e avisos também ficam salvos no navegador. */
const SUPA_URL = 'https://laltcmotdwpeqcijcwwy.supabase.co';
const SUPA_KEY = 'sb_publishable_94JCRTPS_Dvb64qcbxELAg__muUcikw'; // chave pública (pode ficar no site)
const sb = window.supabase ? window.supabase.createClient(SUPA_URL, SUPA_KEY) : null;

const GROUPS = [['todos','Todos'],['poke','Poke idle'],['tibia','Tibia idle'],['franquia','Animes e franquias'],['mmo','MMO idle'],['gestao','RPG e gestão'],['incremental','Clickers e incrementais']];
const GNAME = Object.fromEntries(GROUPS);
const gOrder = k => GROUPS.findIndex(x => x[0] === k);
const MAX_TABS = 12;
const KEY = 'worldidle.site.v1';
const ICON = {
  catalogo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  ranking:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V11M12 21V4M19 21v-7"/></svg>',
  avisos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  perfil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  mercado:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/></svg>',
  estudios:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
};
ICON.biblioteca = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4v16M10 4v16M15 5l4 15"/></svg>';
ICON.info = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>';
ICON.heart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
ICON.play = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l14 8-14 8z"/></svg>';
ICON.playc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor"/></svg>';
const NAV = [['catalogo','Catálogo'],['biblioteca','Biblioteca'],['ranking','Ranking'],['avisos','Avisos'],['mercado','Mercado'],['estudios','Estúdios']];

let G = {};          // slug -> jogo (aprovados + os meus envios + todos, se admin)
let byDb = {};       // id do banco -> jogo
let rank = {};       // id do banco -> {media, votos}
let myRatings = {};  // slug -> {stars, text}
let reviews = {};    // slug -> [{stars, comment}]
let myClaims = {};   // slug -> pedido de reivindicação do usuário
let pendingClaims = []; // pedidos pendentes (só admin)
let user = null, isAdmin = false, nick = '';
let loading = true, loadError = '', query = '';

function fresh(){ return {view:'catalogo', page:null, active:null, filter:'todos', sessions:[], library:[], favs:[], authMode:'criar', stats:{answered:0, maxTabs:0, multi:false}}; }
function loadLocal(){
  try{ const d = JSON.parse(localStorage.getItem(KEY)); if(d && Array.isArray(d.sessions)) return Object.assign(fresh(), d); }catch(e){}
  return fresh();
}
let state = loadLocal();
function save(){
  state.stats.maxTabs = Math.max(state.stats.maxTabs, state.sessions.length);
  const per = {}; state.sessions.forEach(s => per[s.game] = (per[s.game] || 0) + 1);
  if(Object.values(per).some(n => n >= 2)) state.stats.multi = true;
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){}
}

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sess = id => state.sessions.find(s => s.id === id);
const label = s => G[s.game].name + (s.acc > 1 ? ' · conta ' + s.acc : '');
const mono = g => g.name.split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
const cover = (g, lg) => `<span class="cover${lg ? ' lg' : ''}" style="--h:${Number(g.hue) || 0}" aria-hidden="true">${esc(mono(g))}</span>`;
const limit = g => g.maxAcc || 1;
const catalog = () => Object.values(G).filter(g => g.status === 'aprovado').sort((a,b) => gOrder(a.group) - gOrder(b.group) || a.dbId - b.dbId);
const starsTxt = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const fmtMedia = m => m.toFixed(1).replace('.', ',');
function fmt(ms){
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h}h ${String(m).padStart(2,'0')}min` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function toast(msg){
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 6000);
}
const safePath = p => typeof p === 'string' && /^[A-Za-z0-9_\-./]+$/.test(p) ? p : '';
const mediaUrl = p => !safePath(p) ? '' : p.startsWith('site/') ? 'media/' + p.slice(5) : SUPA_URL + '/storage/v1/object/public/media/' + p;
const artStyle = g => `--h:${Number(g.hue) || 0}` + (mediaUrl(g.cover) ? `;background-image:url('${mediaUrl(g.cover)}')` : '');
const ytId = u => { const m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/.exec(u || ''); return m ? m[1] : null; };
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'jogo';

/* ---------- dados ---------- */
function mapGame(r){
  return {id:r.slug, dbId:r.id, name:r.name, url:r.url, group:r.category, hue:r.hue, tags:r.tags || [], desc:r.short_desc, long:r.long_desc,
    maxAcc:r.max_accounts, market:r.has_market, studio:r.studio, embed:r.embed_ok, status:r.status, mine: !!user && r.owner_id === user.id,
    cover:r.cover_path, images:r.images || [], video:r.video_url, videoFile:r.video_path, test:r.is_test, owner:r.owner_id};
}
async function loadGames(){
  const {data, error} = await sb.from('games').select('*').order('id');
  if(error){ loadError = 'Não consegui carregar os jogos. Recarregue a página.'; return; }
  loadError = ''; G = {}; byDb = {};
  data.forEach(r => { const g = mapGame(r); G[g.id] = g; byDb[g.dbId] = g; });
  state.sessions = state.sessions.filter(s => G[s.game] && G[s.game].status === 'aprovado');
  state.library = state.library.filter(id => G[id]);
}
async function loadRank(){
  const {data} = await sb.from('game_rank').select('*');
  rank = {}; (data || []).forEach(r => { rank[r.game_id] = {media:Number(r.media), votos:r.votos}; });
}
const iso = t => t ? new Date(t).toISOString() : null;
const rowOf = s => ({game_id:G[s.game].dbId, account:s.acc, seen_at:iso(s.seenAt), alarm_set:iso(s.alarmSet), alarm_at:iso(s.alarmAt)});
async function mergeSessions(rows){
  const server = rows.map(x => {
    const g = byDb[x.game_id]; if(!g || g.status !== 'aprovado') return null;
    const at = x.alarm_at ? Date.parse(x.alarm_at) : 0;
    return {id:g.id + '~' + x.account, game:g.id, acc:x.account, seenAt:Date.parse(x.seen_at), alarmSet:x.alarm_set ? Date.parse(x.alarm_set) : 0, alarmAt:at, due: !!at && Date.now() >= at};
  }).filter(Boolean);
  const ids = new Set(server.map(s => s.id));
  const extra = state.sessions.filter(s => !ids.has(s.id));
  if(extra.length) await sb.from('user_games').upsert(extra.map(rowOf), {onConflict:'user_id,game_id,account', ignoreDuplicates:true});
  state.sessions = server.concat(extra);
  state.sessions.forEach(s => { if(!state.library.includes(s.game)) state.library.push(s.game); });
}
let claimsRes = null;
async function loadUserData(){
  myRatings = {}; isAdmin = false; nick = ''; myClaims = {}; pendingClaims = [];
  if(!user) return;
  const [p, r, ug, adm] = await Promise.all([
    sb.from('profiles').select('nick').eq('id', user.id).maybeSingle(),
    sb.from('ratings').select('game_id,stars,comment').eq('user_id', user.id),
    sb.from('user_games').select('game_id,account,alarm_set,alarm_at,seen_at'),
    sb.rpc('am_i_admin'),
    sb.from('game_claims').select('id,game_id,user_id,code,contact,status'),
  ]).then(res => { claimsRes = res[4]; return res; });
  nick = p.data ? p.data.nick : '';
  (r.data || []).forEach(x => { const g = byDb[x.game_id]; if(g) myRatings[g.id] = {stars:x.stars, text:x.comment}; });
  isAdmin = adm.data === true;
  ((claimsRes && claimsRes.data) || []).forEach(c => {
    const g = byDb[c.game_id]; if(!g) return;
    if(c.user_id === user.id) myClaims[g.id] = c;
    if(c.status === 'pendente') pendingClaims.push(c);
  });
  if(!isAdmin) pendingClaims = [];
  if(!ug.error) await mergeSessions(ug.data || []);
}
function pushSession(s){
  if(!user) return;
  sb.from('user_games').upsert(rowOf(s), {onConflict:'user_id,game_id,account'}).then(({error}) => { if(error) toast('Não consegui salvar na sua conta: ' + error.message); });
}
function dropSession(s){
  if(!user || !G[s.game]) return;
  sb.from('user_games').delete().eq('user_id', user.id).eq('game_id', G[s.game].dbId).eq('account', s.acc).then(() => {});
}
async function loadReviews(slug){
  const g = G[slug]; if(!g) return;
  const {data} = await sb.from('ratings').select('stars,comment,updated_at').eq('game_id', g.dbId).neq('comment', '').order('updated_at', {ascending:false}).limit(10);
  reviews[slug] = data || [];
  if(state.view === 'jogo' && state.page === slug && !state.active) render();
}

/* ---------- conquistas ---------- */
const ACH = [
  {t:'Primeira aba',   d:'Abra um jogo dentro do World Idle.',                    ok:() => state.library.length >= 1},
  {t:'Multitarefa',    d:'Mantenha 3 jogos abertos ao mesmo tempo.',              ok:() => state.stats.maxTabs >= 3},
  {t:'Duas contas',    d:'Abra duas contas do mesmo jogo.',                       ok:() => state.stats.multi},
  {t:'Colecionador',   d:'Tenha 5 jogos na sua biblioteca.',                      ok:() => state.library.length >= 5},
  {t:'Volta ao mundo', d:'Tenha na biblioteca jogos de 3 categorias diferentes.', ok:() => new Set(state.library.map(id => G[id] && G[id].group)).size >= 3},
  {t:'Pontual',        d:'Volte a um jogo depois que o aviso tocar.',             ok:() => state.stats.answered >= 1},
];

/* ---------- telas ---------- */
function renderNav(){
  const due = state.sessions.filter(s => s.due).length;
  $('#nav').innerHTML = NAV.map(([v,t]) =>
    `<button data-act="nav" data-v="${v}" ${!state.active && state.view === v ? 'aria-current="page"' : ''}>${ICON[v]}<span>${t}</span>${v === 'avisos' && due ? `<span class="badge">${due}</span>` : ''}</button>`).join('');
  const nome = user ? (nick || user.email.split('@')[0]) : '';
  $('#account').innerHTML = user
    ? `<button class="acct" data-act="nav" data-v="perfil"><span class="avatar">${esc(nome[0].toUpperCase())}</span><span class="acct-name">${esc(nome)}</span></button>`
    : `<button class="btn primary" data-act="auth" data-mode="criar">Criar conta</button><button class="btn" data-act="auth" data-mode="entrar">Entrar</button>`;
  $('#topright').innerHTML = `<button class="icon-btn" data-act="nav" data-v="avisos" aria-label="Avisos">${ICON.avisos}${due ? `<span class="badge">${due}</span>` : ''}</button>` +
    (user ? `<button class="avatar only-phone" data-act="nav" data-v="perfil" aria-label="Perfil" style="border:0">${esc(nome[0].toUpperCase())}</button>`
          : `<button class="btn primary only-phone" data-act="auth" data-mode="criar">Criar conta</button>`);
}
function renderTabs(){
  const tabs = state.sessions.map(s => {
    return `<span class="tab${s.due ? ' due' : ''}" aria-selected="${state.active === s.id}">
      <button class="tab-main" data-act="focus" data-s="${esc(s.id)}"><i class="dot"></i><span>${esc(label(s))}</span>${s.alarmAt ? `<span class="tab-time" data-count="${esc(s.id)}"></span>` : ''}</button>
      <button class="tab-x" data-act="close" data-s="${esc(s.id)}" aria-label="Fechar ${esc(label(s))}">&times;</button></span>`;
  }).join('');
  $('#tabs').innerHTML = `<button class="tab home" aria-selected="${!state.active}" data-act="nav" data-v="catalogo">${ICON.catalogo}<span>Catálogo</span></button>` + tabs +
    `<button class="tab add" data-act="nav" data-v="catalogo" aria-label="Abrir outro jogo">+</button>`;
}
function cardsHTML(list, vazio){
  if(!list.length) return `<div class="empty">${vazio}</div>`;
  return `<div class="grid">` + list.map(g => {
    const open = state.sessions.some(s => s.game === g.id), rk = rank[g.dbId], fav = state.favs.includes(g.id);
    const sub = (g.tags.length >= 2 ? [GNAME[g.group]].concat(g.tags.slice(0, 2)).join(' • ') : g.desc) + (rk ? ' • ★ ' + fmtMedia(rk.media) : '') + (g.embed === false ? ' • Abre em outra aba' : '');
    return `<article class="card">
      <div class="card-art${mediaUrl(g.cover) ? ' has-img' : ''}" style="${artStyle(g)}" aria-hidden="true">${mediaUrl(g.cover) ? '' : esc(mono(g))}${g.test ? '<span class="pill test">Em teste</span>' : open ? '<span class="pill"><i></i>Em execução</span>' : ''}</div>
      <div class="card-body"><h3>${esc(g.name)}</h3><p class="card-sub" title="${esc(g.desc)}">${esc(sub)}</p>
        <div class="card-actions">
          <button class="btn primary" data-act="open" data-g="${esc(g.id)}">${open ? 'Continuar' : 'Jogar'}</button>
          <button class="icon-btn" data-act="page" data-g="${esc(g.id)}" aria-label="Sobre ${esc(g.name)}">${ICON.info}</button>
          <button class="icon-btn heart${fav ? ' on' : ''}" data-act="fav" data-g="${esc(g.id)}" aria-label="${fav ? 'Tirar dos favoritos' : 'Favoritar'}" aria-pressed="${fav}">${ICON.heart}</button>
        </div></div>
    </article>`;
  }).join('') + `</div>`;
}
function gridHTML(){
  const q = query.trim().toLowerCase();
  const list = catalog().filter(g => (state.filter === 'todos' || g.group === state.filter) &&
    (!q || (g.name + ' ' + g.desc + ' ' + g.tags.join(' ')).toLowerCase().includes(q)));
  return cardsHTML(list, 'Nenhum jogo com esse nome. Tente outro termo.');
}
const cats = () => GROUPS.map(([k,t]) => `<button data-act="filter" data-f="${k}" aria-pressed="${state.filter === k}">${k === 'incremental' ? 'Clickers' : t}</button>`).join('');
const chips = () => GROUPS.map(([k,t]) => `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${state.filter === k}">${t}</button>`).join('');
function featured(){
  const list = catalog().filter(g => !g.test); if(!list.length) return null;
  const ranked = list.filter(g => rank[g.dbId]).sort((a,b) => rank[b.dbId].media - rank[a.dbId].media || rank[b.dbId].votos - rank[a.dbId].votos);
  return ranked[0] || list.find(g => g.embed === true) || list[0];
}
function viewCatalogo(){
  const f = featured(), n = state.sessions.length;
  const fOpen = f && state.sessions.some(s => s.game === f.id);
  return `<div class="wrap">
    <div class="head"><span class="label">Catálogo</span><h1>Encontre seu próximo idle.</h1></div>
    <div class="hero-row">
      ${f ? `<section class="hero${mediaUrl(f.cover) ? ' has-img' : ''}" style="${artStyle(f)}">
        <div class="hero-art" aria-hidden="true">${mediaUrl(f.cover) ? '' : esc(mono(f))}</div>
        <div class="hero-text"><span class="label">Em destaque</span><h2 class="hero-title">${esc(f.name)}</h2><p>${esc(f.desc)}</p>
          <div class="row"><button class="btn primary big" data-act="open" data-g="${esc(f.id)}">${fOpen ? 'Continuar' : 'Jogar agora'}</button></div></div>
      </section>` : ''}
      <aside class="running"><span class="label">${ICON.playc}Em execução</span>
        ${n ? state.sessions.slice(0, 4).map(s => `<div class="run-item">${cover(G[s.game])}
          <div class="grow"><b>${esc(label(s))}</b><span class="run-state${s.due ? ' due' : ''}"><i></i>${s.due ? 'Hora de voltar' : 'Em execução'}${s.alarmAt && !s.due ? ` · <span class="num" data-count="${esc(s.id)}"></span>` : ''}</span></div>
          <button class="play" data-act="focus" data-s="${esc(s.id)}" aria-label="Ir pra ${esc(label(s))}">${ICON.play}</button></div>`).join('')
          : `<p class="muted">Nenhum jogo aberto ainda. Escolha um no catálogo e ele continua rodando aqui enquanto você abre outros.</p>`}
        <p class="foot">${n} jogo${n === 1 ? '' : 's'} aberto${n === 1 ? '' : 's'}</p>
      </aside>
    </div>
    <div class="catbar"><div class="cats">${cats()}</div>
      <input class="search" id="busca" type="search" placeholder="Buscar jogo..." aria-label="Buscar jogo" value="${esc(query)}"></div>
    <div id="grid">${gridHTML()}</div>
  </div>`;
}
function viewBiblioteca(){
  const favs = catalog().filter(g => state.favs.includes(g.id));
  const lib = catalog().filter(g => state.library.includes(g.id) && !state.favs.includes(g.id));
  return `<div class="wrap">
    <div class="head"><span class="label">Biblioteca</span><h1>Seus jogos.</h1></div>
    <h2>Favoritos</h2>${cardsHTML(favs, 'Nenhum favorito ainda. Toque no coração de um jogo pra guardar aqui.')}
    <h2>Já abertos</h2>${cardsHTML(lib, 'Os jogos que você abrir pelo World Idle aparecem aqui.')}
  </div>`;
}
function viewConta(){
  const m = state.authMode === 'entrar' ? 'entrar' : 'criar';
  return `<div class="wrap narrow">
    <div class="head"><h1>${m === 'criar' ? 'Crie sua conta' : 'Entre na sua conta'}</h1>
      <p class="muted">Com a conta você salva suas abas e avisos, avalia os jogos e envia o seu. É grátis.</p></div>
    <div class="seg"><button class="chip" data-act="auth" data-mode="criar" aria-pressed="${m === 'criar'}">Criar conta</button>
      <button class="chip" data-act="auth" data-mode="entrar" aria-pressed="${m === 'entrar'}">Já tenho conta</button></div>
    <form class="auth" data-form="login" data-mode="${m}">
      <div class="f"><label class="label" for="auth-email">E-mail</label><input id="auth-email" type="email" autocomplete="email" required></div>
      <div class="f"><label class="label" for="auth-senha">Senha${m === 'criar' ? ' (mínimo 6 caracteres)' : ''}</label><input id="auth-senha" type="password" autocomplete="${m === 'criar' ? 'new-password' : 'current-password'}" minlength="6" required></div>
      <button class="btn primary big">${m === 'criar' ? 'Criar conta' : 'Entrar'}</button>
    </form>
  </div>`;
}
function alarmRow(s){
  const on = !!s.alarmAt;
  return `<div class="row">
    <span class="muted">Me avise em</span>
    ${[[15,'15 min'],[60,'1 h'],[240,'4 h']].map(([m,t]) => `<button class="chip" data-act="alarm" data-s="${esc(s.id)}" data-m="${m}">${t}</button>`).join('')}
    <form class="inline-form" data-form="custom" data-s="${esc(s.id)}">
      <input id="min-${esc(s.id)}" type="number" min="1" max="1440" inputmode="numeric" placeholder="min" aria-label="Outro tempo em minutos">
      <button class="chip">Definir</button></form>
    <span class="clock${s.due ? ' due' : ''}">${on ? `<span data-count="${esc(s.id)}"></span>` : ''}</span>
    ${on ? `<button class="btn" data-act="clear" data-s="${esc(s.id)}">Cancelar aviso</button>` : ''}
  </div>`;
}
function viewStage(s){
  const g = G[s.game], n = state.sessions.filter(x => x.game === g.id).length, emb = g.embed !== false;
  const head = `<div class="stage-head">${cover(g, true)}
      <div class="grow"><h1>${esc(label(s))}</h1>
        <p class="muted">Contas abertas: ${n} de ${limit(g)}${g.maxAcc ? '' : ' (limite a informar pelo estúdio)'} · Última visita há <span class="num" data-away="${esc(s.id)}"></span></p></div>
      <div class="row">${n < limit(g) ? `<button class="btn" data-act="newacc" data-g="${esc(g.id)}">Outra conta</button>` : ''}
        <a class="btn" href="${esc(g.url)}" target="_blank" rel="noopener" data-act="played" data-s="${esc(s.id)}">Abrir em outra aba</a>
        <button class="btn" data-act="close" data-s="${esc(s.id)}">Fechar aba</button></div>
    </div>`;
  if(emb) return `<div class="wrap tight">${head}${alarmRow(s)}
    ${g.embed == null ? '<p class="muted">Se a tela abaixo ficar em branco, este jogo não permite abrir aqui dentro. Use "Abrir em outra aba".</p>' : ''}</div>`;
  return `<div class="wrap">${head}
    <div class="screen"><span class="label">Tela do jogo</span>
      <p>Este jogo ainda não permite rodar dentro de outro site. Ele abre em outra aba do navegador, e o aviso de retorno continua valendo aqui.</p>
      <a class="btn primary big" href="${esc(g.url)}" target="_blank" rel="noopener" data-act="played" data-s="${esc(s.id)}">Jogar agora</a></div>
    <div class="panel"><div class="panel-top"><h2>Aviso de retorno</h2></div>
      <div class="orbit${s.alarmAt ? '' : ' off'}"><i data-sun="${esc(s.id)}"></i></div>${alarmRow(s)}</div>
  </div>`;
}
function viewAvisos(){
  const list = [...state.sessions].sort((a,b) => (b.due - a.due) || ((a.alarmAt || Infinity) - (b.alarmAt || Infinity)));
  return `<div class="wrap">
    <div class="head"><h1>Avisos</h1><p class="muted">Cada aba tem o próprio relógio. Quando ele zera, o jogo te chama.</p></div>
    ${list.length ? `<div class="list">` + list.map(s => `<div class="item${s.due ? ' due' : ''}">${cover(G[s.game])}
        <div class="grow"><b>${esc(label(s))}</b><span class="muted">${s.due ? 'Hora de voltar' : s.alarmAt ? 'Volta em' : 'Sem aviso definido'}</span></div>
        ${s.alarmAt ? `<span class="clock${s.due ? ' due' : ''}" data-count="${esc(s.id)}"></span>` : ''}
        <button class="btn" data-act="focus" data-s="${esc(s.id)}">Abrir aba</button></div>`).join('') + `</div>`
      : `<div class="empty">Nenhum jogo aberto. Abra um no catálogo pra definir um aviso.</div>`}
  </div>`;
}
function viewPerfil(){
  if(!user) return viewConta();
  const got = ACH.filter(a => a.ok()).length;
  return `<div class="wrap">
    <div class="head"><h1>Perfil</h1><p class="muted">${user ? 'Suas abas, avisos e notas ficam salvos na sua conta.' : 'Entre pra salvar suas abas e avisos na conta, avaliar jogos e enviar o seu.'}</p></div>
    ${`<div class="field"><span class="label">Conta</span><b>${esc(user.email)}</b></div>
      <div class="field"><label class="label" for="nick">Apelido</label>
        <input id="nick" type="text" maxlength="24" placeholder="Como te chamam nos jogos" value="${esc(nick)}"></div>
      <div class="row"><button class="btn" data-act="logout">Sair da conta</button></div>`}
    <div class="stats">
      <div class="stat"><span class="num">${state.library.length}</span><span class="muted">jogos na biblioteca</span></div>
      <div class="stat"><span class="num">${state.sessions.length}</span><span class="muted">abas abertas</span></div>
      <div class="stat"><span class="num">${state.stats.answered}</span><span class="muted">avisos atendidos</span></div>
      <div class="stat"><span class="num">${got}/${ACH.length}</span><span class="muted">conquistas</span></div>
    </div>
    <h2>Conquistas entre jogos</h2>
    <div class="list">${ACH.map(a => `<div class="item ach${a.ok() ? ' ok' : ''}"><span class="mark" aria-hidden="true"></span>
      <div class="grow"><b>${a.t}</b><span class="muted">${a.d}</span></div><span class="muted">${a.ok() ? 'Liberada' : 'Bloqueada'}</span></div>`).join('')}</div>
  </div>`;
}
function viewMercado(){
  return `<div class="wrap">
    <span class="soon">Em breve</span>
    <div class="head"><h1>Mercado unificado</h1>
      <p class="muted">Hoje cada jogo tem o próprio mercado e a própria carteira. Aqui vai ser um balcão só, com Pix, pra comprar e vender itens de todos os jogos parceiros.</p></div>
    <ol class="steps">
      <li>O estúdio parceiro conecta o jogo ao World Idle.</li>
      <li>O jogador anuncia um item e o comprador paga por Pix.</li>
      <li>O World Idle confirma o pagamento e o jogo entrega o item.</li>
    </ol>
    <p class="muted">Depende de parceria com cada estúdio. Entra depois que o launcher tiver jogadores.</p>
  </div>`;
}
function viewJogo(){
  const g = G[state.page]; if(!g) return viewCatalogo();
  const open = state.sessions.filter(s => s.game === g.id).length, rk = rank[g.dbId], mine = myRatings[g.id], rv = reviews[g.id];
  const tbd = '<span class="muted">A informar pelo estúdio</span>';
  return `<div class="wrap">
    <button class="btn back" data-act="nav" data-v="catalogo">&larr; Catálogo</button>
    <div class="stage-head">${cover(g, true)}
      <div class="grow"><span class="label">${GNAME[g.group]}</span><h1>${esc(g.name)}</h1></div>
      <div class="row">${g.status === 'aprovado' ? `<button class="btn primary" data-act="open" data-g="${esc(g.id)}">${open ? 'Ir pra aba' : 'Abrir no launcher'}</button>` : ''}
        <a class="btn" href="${esc(g.url)}" target="_blank" rel="noopener">Site oficial</a></div>
    </div>
    ${g.test ? '<div class="banner">Em teste: este jogo ainda está em desenvolvimento e pode mudar bastante.</div>' : ''}
    ${gallery(g)}
    <div class="cols">
      <div class="about"><h2>Sobre o jogo</h2><p>${esc(g.long || g.desc)}</p>
        <div class="tags">${g.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
      <dl class="ficha">
        <dt>Categoria</dt><dd>${GNAME[g.group]}</dd>
        <dt>Nota</dt><dd>${rk ? `${fmtMedia(rk.media)} de 5 · ${rk.votos} voto${rk.votos > 1 ? 's' : ''}` : '<span class="muted">Sem votos ainda</span>'}</dd>
        <dt>Roda no launcher</dt><dd>${g.embed === true ? 'Sim' : g.embed === false ? 'Abre em outra aba' : '<span class="muted">A testar</span>'}</dd>
        <dt>Contas por jogador</dt><dd>${g.maxAcc ? g.maxAcc : tbd}</dd>
        <dt>Mercado entre jogadores</dt><dd>${g.market === true ? 'Sim' : g.market === false ? 'Não' : tbd}</dd>
        <dt>Estúdio</dt><dd>${g.studio ? esc(g.studio) : tbd}</dd>
      </dl>
    </div>
    ${ownerBlock(g)}
    <div class="panel">
      <div class="panel-top"><h2>Sua avaliação</h2><span class="muted">${mine ? mine.stars + ' de 5' : 'Ainda sem nota'}</span></div>
      <div class="row stars">${[1,2,3,4,5].map(n => `<button class="star${mine && mine.stars >= n ? ' on' : ''}" data-act="rate" data-g="${esc(g.id)}" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
      ${mine ? `<div class="f"><label class="label" for="rev-${esc(g.id)}">Comentário</label>
        <input class="rev" id="rev-${esc(g.id)}" data-g="${esc(g.id)}" maxlength="200" placeholder="O que você achou do jogo?" value="${esc(mine.text)}"></div>`
        : `<p class="muted">Só avalia quem abriu o jogo pelo World Idle.</p>`}
    </div>
    ${rv && rv.length ? `<h2>Comentários</h2><div class="list">${rv.map(x => `<div class="review"><span class="starline">${starsTxt(x.stars)}</span><div>${esc(x.comment)}</div></div>`).join('')}</div>` : ''}
  </div>`;
}
function gallery(g){
  const vid = ytId(g.video), imgs = [g.cover].concat(g.images).map(mediaUrl).filter(Boolean);
  const arq = mediaUrl(g.videoFile);
  if(!vid && !arq && !imgs.length) return '';
  return `<div class="gallery">${arq ? `<video class="shot" controls preload="metadata" src="${arq}"${imgs[0] ? ` poster="${imgs[0]}"` : ''}></video>` : ''}${vid ? `<iframe class="shot" src="https://www.youtube-nocookie.com/embed/${vid}" title="Vídeo de ${esc(g.name)}" allow="fullscreen; picture-in-picture" loading="lazy"></iframe>` : ''}${imgs.map((u,i) => `<img class="shot" src="${u}" alt="Imagem ${i + 1} de ${esc(g.name)}" loading="lazy">`).join('')}</div>`;
}
function ownerBlock(g){
  if(g.mine || isAdmin) return `<div class="note2"><span>${g.mine ? 'Você é o dono desta página.' : 'Você pode editar esta página como administrador.'}</span><button class="btn primary" data-act="edit" data-g="${esc(g.id)}">Editar página</button></div>`;
  if(g.owner) return '';
  const c = myClaims[g.id];
  if(c){
    const st = {pendente:['analise','Em conferência'], verificado:['aprovado','Confirmado'], recusado:['recusado','Recusado']}[c.status];
    return `<div class="panel"><div class="panel-top"><h2>Seu pedido de dono da página</h2><span class="st ${st[0]}">${st[1]}</span></div>
      <p>Código de verificação: <b class="num">${esc(c.code)}</b></p>
      <p class="muted">Coloque esse código em um lugar visível do site do jogo (rodapé ou página "sobre") ou envie pelo contato oficial do jogo. A equipe do World Idle confere e libera a edição da página.</p></div>`;
  }
  return `<div class="note2"><span>Página ainda não reivindicada pelo estúdio.</span><button class="btn" data-act="claim" data-g="${esc(g.id)}">Sou o dono deste jogo</button></div>`;
}
function viewEditar(){
  const g = G[state.page]; if(!g || !(g.mine || isAdmin)) return viewJogo();
  return `<div class="wrap">
    <button class="btn back" data-act="page" data-g="${esc(g.id)}">&larr; Voltar pra página</button>
    <div class="head"><h1>Editar ${esc(g.name)}</h1><p class="muted">As mudanças aparecem na hora na página do jogo.</p></div>
    <form class="form" data-form="editar" data-g="${esc(g.id)}">
      <div class="f wide"><label class="label" for="ed-curta">Descrição curta</label><input id="ed-curta" maxlength="140" required value="${esc(g.desc)}"></div>
      <div class="f wide"><label class="label" for="ed-longa">Descrição completa</label><textarea id="ed-longa" rows="5" maxlength="1200">${esc(g.long)}</textarea></div>
      <div class="f"><label class="label" for="ed-contas">Contas por jogador</label><input id="ed-contas" type="number" min="1" max="20" value="${g.maxAcc || ''}" placeholder="Quantas o jogo permite"></div>
      <div class="f"><label class="label" for="ed-estudio">Estúdio</label><input id="ed-estudio" maxlength="40" value="${esc(g.studio)}"></div>
      <div class="f wide"><label class="label" for="ed-videoarq">Vídeo do jogo (MP4 ou WebM, até 25 MB)</label><input id="ed-videoarq" type="file" accept="video/mp4,video/webm">
        <span class="muted">${g.videoFile ? 'Já tem vídeo enviado. Envie outro pra trocar.' : 'Um trailer curto, de uns 30 a 60 segundos.'}</span></div>
      <div class="f wide"><label class="label" for="ed-video">Ou link de um vídeo do YouTube</label><input id="ed-video" type="url" placeholder="https://www.youtube.com/watch?v=..." value="${esc(g.video || '')}"></div>
      <div class="f"><label class="label" for="ed-capa">Capa (16:9, até 3 MB)</label><input id="ed-capa" type="file" accept="image/png,image/jpeg,image/webp">
        <span class="muted">${g.cover ? 'Já tem capa. Envie outra pra trocar.' : 'Ainda sem capa.'}</span></div>
      <div class="f"><label class="label" for="ed-imagens">Imagens do jogo (até 8)</label><input id="ed-imagens" type="file" accept="image/png,image/jpeg,image/webp" multiple>
        <span class="muted">${g.images.length ? g.images.length + ' imagem(ns) na página. Enviar novas substitui as atuais.' : 'Ainda sem imagens.'}</span></div>
      <label class="check wide"><input id="ed-mercado" type="checkbox" ${g.market ? 'checked' : ''}> O jogo tem mercado entre jogadores</label>
      <div class="wide"><button class="btn primary">Salvar página</button></div>
    </form>
  </div>`;
}
function viewRanking(){
  const all = catalog().filter(g => state.filter === 'todos' || g.group === state.filter);
  const rated = all.filter(g => rank[g.dbId]).sort((a,b) => rank[b.dbId].media - rank[a.dbId].media || rank[b.dbId].votos - rank[a.dbId].votos);
  const rest = all.filter(g => !rank[g.dbId]);
  const row = (g, i) => `<div class="item"><span class="pos num">${i || '–'}</span>${cover(g)}
    <div class="grow"><b>${esc(g.name)}</b><span class="muted">${GNAME[g.group]}</span></div>
    ${i ? `<span class="starline">★ ${fmtMedia(rank[g.dbId].media)}</span><span class="muted">${rank[g.dbId].votos} voto${rank[g.dbId].votos > 1 ? 's' : ''}</span>` : '<span class="muted">Sem votos</span>'}
    <button class="btn" data-act="page" data-g="${esc(g.id)}">${i ? 'Ver página' : 'Avaliar'}</button></div>`;
  return `<div class="wrap">
    <div class="head"><h1>Ranking</h1><p class="muted">Média das notas de quem abriu cada jogo pelo World Idle.</p></div>
    <div class="row">${chips()}</div>
    <div class="list">${rated.map((g,i) => row(g, i + 1)).join('')}${rest.map(g => row(g, 0)).join('')}</div>
  </div>`;
}
function viewEstudios(){
  const kit = [['Nome e link do jogo','endereço onde o jogo roda, com https'],['Categoria','uma das categorias do catálogo'],['Descrição curta','até 140 caracteres'],
    ['Descrição completa','o que o jogo tem e pra quem é'],['Contas por jogador','quantas o jogo permite abrir ao mesmo tempo'],['Mercado entre jogadores','se tem ou não'],['Contato','e-mail ou Discord do estúdio']];
  const meus = Object.values(G).filter(g => g.mine);
  const stName = {analise:'Em análise', aprovado:'Aprovado', recusado:'Recusado'};
  return `<div class="wrap">
    <div class="head"><h1>Coloque seu idle no World Idle</h1>
      <p class="muted">Todo jogo ganha uma página de apresentação no mesmo padrão e pode rodar dentro do launcher.</p></div>
    <h2>O que o estúdio ganha</h2>
    <ul class="gains">
      <li>Jogadores que já gostam de idle e estão procurando o próximo.</li>
      <li>Página própria com descrição, nota e comentários.</li>
      <li>Avisos de retorno que trazem o jogador de volta pro jogo.</li>
      <li>Perfil e conquistas que ligam o seu jogo aos outros.</li>
    </ul>
    <h2>O que informar</h2>
    <dl class="ficha">${kit.map(([a,b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
    <p class="muted">Pra o jogo rodar dentro do World Idle, o site dele precisa permitir abrir dentro de outra página. É uma configuração do lado do jogo.</p>
    <div class="note2"><span>Seu jogo já está no catálogo? Abra a página dele e clique em "Sou o dono deste jogo" pra assumir e colocar capa, imagens e vídeo.</span><button class="btn" data-act="nav" data-v="catalogo">Ver catálogo</button></div>
    <h2>Enviar meu jogo</h2>
    ${user ? `<form class="form" data-form="envio">
      <div class="f"><label class="label" for="env-nome">Nome do jogo</label><input id="env-nome" maxlength="40" required></div>
      <div class="f"><label class="label" for="env-url">Link do jogo</label><input id="env-url" type="url" placeholder="https://" required></div>
      <div class="f"><label class="label" for="env-cat">Categoria</label><select id="env-cat">${GROUPS.slice(1).map(([k,t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
      <div class="f"><label class="label" for="env-contas">Contas por jogador</label><input id="env-contas" type="number" min="1" max="20" value="1" required></div>
      <div class="f wide"><label class="label" for="env-curta">Descrição curta</label><input id="env-curta" maxlength="140" required></div>
      <div class="f wide"><label class="label" for="env-longa">Descrição completa</label><textarea id="env-longa" rows="4" maxlength="1200"></textarea></div>
      <div class="f"><label class="label" for="env-estudio">Estúdio</label><input id="env-estudio" maxlength="40"></div>
      <div class="f"><label class="label" for="env-contato">Contato</label><input id="env-contato" maxlength="60" placeholder="E-mail ou Discord"></div>
      <label class="check wide"><input id="env-mercado" type="checkbox"> O jogo tem mercado entre jogadores</label>
      <div class="wide"><button class="btn primary">Enviar pra análise</button></div>
    </form>` : `<div class="empty">Crie sua conta ou entre pra enviar um jogo. <button class="btn primary" data-act="auth" data-mode="criar">Criar conta</button></div>`}
    ${user ? `<h2>Meus envios</h2>
    ${meus.length ? `<div class="list">` + meus.map(c => `<div class="item">${cover(c)}
        <div class="grow"><b>${esc(c.name)}</b><span class="muted">${GNAME[c.group]} · ${limit(c)} conta${limit(c) > 1 ? 's' : ''} por jogador</span></div>
        <span class="st ${c.status}">${stName[c.status]}</span>
        ${c.status === 'aprovado' ? `<button class="btn" data-act="page" data-g="${esc(c.id)}">Ver página</button>` : ''}</div>`).join('') + `</div>`
      : `<div class="empty">Nenhum jogo enviado ainda.</div>`}` : ''}
    ${isAdmin ? `<div class="row"><button class="btn" data-act="nav" data-v="analise">Abrir fila de análise</button></div>` : ''}
  </div>`;
}
function viewAnalise(){
  if(!isAdmin) return viewEstudios();
  const fila = Object.values(G).filter(c => c.status === 'analise');
  return `<div class="wrap">
    <button class="btn back" data-act="nav" data-v="estudios">&larr; Estúdios</button>
    <div class="head"><h1>Fila de análise</h1><p class="muted">O jogo só entra no catálogo depois de aprovado.</p></div>
    ${fila.length ? `<div class="list">` + fila.map(c => `<div class="item">${cover(c)}
        <div class="grow"><b>${esc(c.name)}</b><span class="muted">${GNAME[c.group]} · ${limit(c)} conta${limit(c) > 1 ? 's' : ''} por jogador${c.studio ? ' · ' + esc(c.studio) : ''}</span>
          <span class="muted">${esc(c.desc)}</span></div>
        <div class="row"><a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">Testar o jogo</a>
          <button class="btn primary" data-act="approve" data-g="${esc(c.id)}">Aprovar</button>
          <button class="btn" data-act="reject" data-g="${esc(c.id)}">Recusar</button></div></div>`).join('') + `</div>`
      : `<div class="empty">Nenhum jogo esperando análise.</div>`}
    <h2>Pedidos de dono de página</h2>
    ${pendingClaims.length ? `<div class="list">` + pendingClaims.map(c => { const g = byDb[c.game_id]; return !g ? '' : `<div class="item">${cover(g)}
        <div class="grow"><b>${esc(g.name)}</b><span class="muted">Código: <span class="num">${esc(c.code)}</span>${c.contact ? ' · ' + esc(c.contact) : ''}</span></div>
        <div class="row"><a class="btn" href="${esc(g.url)}" target="_blank" rel="noopener">Conferir no site</a>
          <button class="btn primary" data-act="claim-ok" data-c="${c.id}">Confirmar dono</button>
          <button class="btn" data-act="claim-no" data-c="${c.id}">Recusar</button></div></div>`; }).join('') + `</div>`
      : `<div class="empty">Nenhum pedido pendente.</div>`}
  </div>`;
}

/* ---------- jogos rodando dentro do launcher ---------- */
function syncFrames(){
  const host = $('#frames'), keep = new Set();
  for(const s of state.sessions){
    const g = G[s.game]; if(!g || g.embed === false) continue;
    keep.add(s.id);
    let f = [...host.children].find(x => x.dataset.s === s.id);
    if(!f && s.id === state.active){
      f = document.createElement('iframe');
      f.dataset.s = s.id; f.title = label(s); f.src = g.url;
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
      f.setAttribute('allow', 'fullscreen');
      host.appendChild(f);
    }
    if(f) f.hidden = s.id !== state.active;
  }
  [...host.children].forEach(f => { if(!keep.has(f.dataset.s)) f.remove(); });
  const act = state.active && sess(state.active);
  $('.main').classList.toggle('staging', !!(act && G[act.game] && G[act.game].embed !== false));
}

function render(){
  if(loading || loadError){
    // os jogos ainda não chegaram do banco: não desenha abas nem telas que dependem deles
    $('#view').innerHTML = `<div class="wrap"><div class="empty">${loading ? 'Carregando jogos…' : esc(loadError)}</div></div>`;
    return;
  }
  const s = state.active && sess(state.active);
  if(!s) state.active = null;
  renderNav(); renderTabs(); syncFrames();
  const views = {editar:viewEditar, biblioteca:viewBiblioteca, conta:viewConta, catalogo:viewCatalogo, avisos:viewAvisos, perfil:viewPerfil, mercado:viewMercado, estudios:viewEstudios, jogo:viewJogo, analise:viewAnalise, ranking:viewRanking};
  let html;
  if(loading) html = `<div class="wrap"><div class="empty">Carregando jogos…</div></div>`;
  else if(loadError) html = `<div class="wrap"><div class="empty">${esc(loadError)}</div></div>`;
  else html = s ? viewStage(s) : (views[state.view] || viewCatalogo)();
  $('#view').innerHTML = html;
  $('#view').scrollTop = 0;
  tick();
}
function tick(){
  if(loading || loadError) return;
  const now = Date.now(); let fired = false;
  for(const s of state.sessions){
    if(s.alarmAt && !s.due && now >= s.alarmAt){ s.due = true; fired = true; toast(label(s) + ': hora de voltar.'); }
  }
  if(fired){ save(); render(); return; }
  document.querySelectorAll('[data-count]').forEach(el => { const s = sess(el.dataset.count); if(s && s.alarmAt) el.textContent = s.due ? 'agora' : fmt(s.alarmAt - now); });
  document.querySelectorAll('[data-away]').forEach(el => { const s = sess(el.dataset.away); if(s) el.textContent = fmt(now - s.seenAt); });
  document.querySelectorAll('[data-sun]').forEach(el => { const s = sess(el.dataset.sun);
    const p = s && s.alarmAt ? Math.min(1, Math.max(0, (now - s.alarmSet) / (s.alarmAt - s.alarmSet))) : 0; el.style.setProperty('--p', p); });
}

/* ---------- ações ---------- */
function visit(s){
  s.seenAt = Date.now();
  if(s.due){ state.stats.answered++; s.due = false; s.alarmAt = 0; s.alarmSet = 0; }
  pushSession(s);
}
function openSession(gameId, forceNew){
  const g = G[gameId]; if(!g || g.status !== 'aprovado') return;
  const mine = state.sessions.filter(s => s.game === gameId);
  if(mine.length && !forceNew){ state.active = mine[0].id; visit(mine[0]); return; }
  if(mine.length >= limit(g)){
    toast(g.maxAcc ? `${g.name} permite ${g.maxAcc} conta${g.maxAcc > 1 ? 's' : ''} por jogador.` : `${g.name}: o estúdio ainda não informou quantas contas permite. Liberada 1 por enquanto.`);
    return;
  }
  if(state.sessions.length >= MAX_TABS){ toast('Limite de ' + MAX_TABS + ' abas. Feche uma pra abrir outra.'); return; }
  let acc = 1; while(mine.some(s => s.acc === acc)) acc++;
  const s = {id:gameId + '~' + acc, game:gameId, acc, seenAt:Date.now(), alarmSet:0, alarmAt:0, due:false};
  state.sessions.push(s);
  if(!state.library.includes(gameId)) state.library.push(gameId);
  state.active = s.id; pushSession(s);
}
function setAlarm(s, min){
  const now = Date.now();
  s.alarmSet = now; s.alarmAt = now + min * 60000; s.due = false; pushSession(s);
  toast('Aviso definido: ' + label(s) + ' em ' + fmt(min * 60000) + '.');
}
async function rate(slug, n){
  if(!user){ toast('Crie sua conta ou entre pra avaliar.'); state.authMode = 'criar'; state.view = 'conta'; state.active = null; render(); return; }
  const g = G[slug], cur = myRatings[slug]; if(!g) return;
  let error;
  if(cur){
    ({error} = await sb.from('ratings').update({stars:n, updated_at:new Date().toISOString()}).eq('user_id', user.id).eq('game_id', g.dbId));
  }else{
    if(!state.sessions.some(s => s.game === slug)){ toast('Abra o jogo pelo World Idle antes de avaliar.'); return; }
    ({error} = await sb.from('ratings').insert({game_id:g.dbId, stars:n}));
  }
  if(error){ toast('Não consegui salvar a nota: ' + error.message); return; }
  myRatings[slug] = {stars:n, text:cur ? cur.text : ''};
  await loadRank(); render();
}
async function review(admin, slug){
  const g = G[slug]; if(!g || !isAdmin) return;
  const {error} = await sb.from('games').update({status: admin === 'approve' ? 'aprovado' : 'recusado', reviewed_at:new Date().toISOString()}).eq('id', g.dbId);
  if(error){ toast('Não consegui salvar: ' + error.message); return; }
  toast(admin === 'approve' ? g.name + ' aprovado. Já está no catálogo.' : g.name + ' recusado.');
  await loadGames(); save(); render();
}

async function claim(slug){
  const g = G[slug]; if(!g) return;
  if(!user){ toast('Crie sua conta ou entre pra assumir a página do seu jogo.'); state.authMode = 'criar'; state.view = 'conta'; state.active = null; render(); return; }
  const {data, error} = await sb.from('game_claims').insert({game_id:g.dbId}).select('id,game_id,user_id,code,contact,status').single();
  if(error){ toast('Não consegui registrar o pedido: ' + error.message); return; }
  myClaims[slug] = data; toast('Pedido registrado. Veja o código de verificação na página.'); render();
}
async function decideClaim(id, ok){
  const c = pendingClaims.find(x => x.id === id); if(!c || !isAdmin) return;
  if(ok){
    const r = await sb.from('games').update({owner_id:c.user_id}).eq('id', c.game_id);
    if(r.error){ toast('Não consegui passar a página: ' + r.error.message); return; }
  }
  const {error} = await sb.from('game_claims').update({status: ok ? 'verificado' : 'recusado'}).eq('id', id);
  if(error){ toast('Não consegui salvar: ' + error.message); return; }
  toast(ok ? 'Dono confirmado. Ele já pode editar a página.' : 'Pedido recusado.');
  await refreshAll();
}
const EXT = {'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'video/mp4':'mp4', 'video/webm':'webm'};
async function uploadImg(g, file, nome){
  const video = file.type.startsWith('video/');
  if(!EXT[file.type] || video !== (nome === 'video')) throw new Error(nome === 'video' ? 'Use vídeo MP4 ou WebM.' : 'Use imagens JPG, PNG ou WebP.');
  if(video && file.size > 25 * 1024 * 1024) throw new Error('O vídeo pode ter até 25 MB.');
  if(!video && file.size > 3 * 1024 * 1024) throw new Error('Cada imagem pode ter até 3 MB.');
  const path = `${g.dbId}/${nome}-${Date.now()}.${EXT[file.type]}`;
  const {error} = await sb.storage.from('media').upload(path, file, {contentType:file.type, cacheControl:'3600'});
  if(error) throw new Error(error.message);
  return path;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if(!el) return;
  const a = el.dataset.act, s = el.dataset.s && sess(el.dataset.s);
  if(a === 'nav'){ state.view = el.dataset.v; state.active = null; }
  else if(a === 'focus' && s){ state.active = s.id; visit(s); }
  else if(a === 'open'){ openSession(el.dataset.g, false); }
  else if(a === 'newacc'){ openSession(el.dataset.g, true); }
  else if(a === 'page'){ state.view = 'jogo'; state.page = el.dataset.g; state.active = null; loadReviews(el.dataset.g); }
  else if(a === 'close' && s){ dropSession(s); state.sessions = state.sessions.filter(x => x !== s); if(state.active === s.id){ state.active = null; state.view = 'catalogo'; } }
  else if(a === 'auth'){ state.authMode = el.dataset.mode; state.view = user ? 'perfil' : 'conta'; state.active = null; }
  else if(a === 'fav'){ const g = el.dataset.g; state.favs = state.favs.includes(g) ? state.favs.filter(x => x !== g) : state.favs.concat(g); }
  else if(a === 'played' && s){ visit(s); }
  else if(a === 'alarm' && s){ setAlarm(s, Number(el.dataset.m)); }
  else if(a === 'clear' && s){ s.alarmAt = 0; s.alarmSet = 0; s.due = false; pushSession(s); }
  else if(a === 'filter'){ state.filter = el.dataset.f; }
  else if(a === 'rate'){ rate(el.dataset.g, Number(el.dataset.n)); return; }
  else if(a === 'edit'){ state.view = 'editar'; state.page = el.dataset.g; state.active = null; }
  else if(a === 'claim'){ claim(el.dataset.g); return; }
  else if(a === 'claim-ok' || a === 'claim-no'){ decideClaim(Number(el.dataset.c), a === 'claim-ok'); return; }
  else if(a === 'approve' || a === 'reject'){ review(a, el.dataset.g); return; }
  else if(a === 'logout'){ sb.auth.signOut(); return; }
  else return;
  save(); render();
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]'); if(!f) return;
  e.preventDefault();
  const kind = f.dataset.form;
  if(kind === 'custom'){
    const s = sess(f.dataset.s), min = Math.round(Number(f.querySelector('input').value));
    if(!s) return;
    if(!(min >= 1 && min <= 1440)){ toast('Digite um tempo entre 1 e 1440 minutos.'); return; }
    setAlarm(s, min); save(); render();
  }else if(kind === 'login'){
    const email = $('#auth-email').value.trim(), password = $('#auth-senha').value;
    const mode = f.dataset.mode;
    if(mode === 'criar'){
      const {data, error} = await sb.auth.signUp({email, password, options:{emailRedirectTo: location.origin + location.pathname}});
      if(error){ toast('Não consegui criar a conta: ' + error.message); return; }
      toast(data.session ? 'Conta criada. Você já está dentro.' : 'Conta criada. Confirme pelo link que enviamos pro seu e-mail e depois entre.');
    }else{
      const {error} = await sb.auth.signInWithPassword({email, password});
      if(error){ toast(/confirm/i.test(error.message) ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : 'E-mail ou senha incorretos.'); return; }
      toast('Você entrou.'); state.view = 'catalogo'; save();
    }
  }else if(kind === 'editar'){
    const g = G[f.dataset.g]; if(!g || !(g.mine || isAdmin)) return;
    const v = id => f.querySelector('#ed-' + id).value.trim();
    const n = v('contas') ? Math.round(Number(v('contas'))) : null;
    if(!v('curta')){ toast('A descrição curta não pode ficar vazia.'); return; }
    if(n !== null && !(n >= 1 && n <= 20)){ toast('Contas por jogador: de 1 a 20.'); return; }
    if(v('video') && !ytId(v('video'))){ toast('O vídeo precisa ser um link do YouTube.'); return; }
    const patch = {short_desc:v('curta'), long_desc:v('longa'), max_accounts:n, studio:v('estudio'), has_market:f.querySelector('#ed-mercado').checked,
      video_url: v('video') ? 'https://www.youtube.com/watch?v=' + ytId(v('video')) : null};
    const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Salvando…';
    try{
      const capa = f.querySelector('#ed-capa').files[0], imgs = [...f.querySelector('#ed-imagens').files];
      if(imgs.length > 8) throw new Error('Envie no máximo 8 imagens.');
      if(capa) patch.cover_path = await uploadImg(g, capa, 'capa');
      const varq = f.querySelector('#ed-videoarq').files[0];
      if(varq){ btn.textContent = 'Enviando vídeo…'; patch.video_path = await uploadImg(g, varq, 'video'); }
      if(imgs.length){ patch.images = []; let i = 0; for(const im of imgs) patch.images.push(await uploadImg(g, im, 'img' + (++i))); }
      const {error} = await sb.from('games').update(patch).eq('id', g.dbId);
      if(error) throw new Error(error.message);
    }catch(err){ toast('Não consegui salvar: ' + err.message); btn.disabled = false; btn.textContent = 'Salvar página'; return; }
    toast('Página salva.');
    await loadGames(); state.view = 'jogo'; save(); render();
  }else if(kind === 'envio'){
    if(!user){ toast('Entre na sua conta pra enviar um jogo.'); return; }
    const v = id => f.querySelector('#env-' + id).value.trim();
    let url = null; try{ url = new URL(v('url')); }catch(err){}
    if(!url || url.protocol !== 'https:'){ toast('O link do jogo precisa começar com https://'); return; }
    const n = Math.round(Number(v('contas'))), name = v('nome');
    if(!name || !v('curta') || !(n >= 1 && n <= 20)){ toast('Preencha nome, descrição curta e contas por jogador (1 a 20).'); return; }
    let h = 0; for(const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const market = f.querySelector('#env-mercado').checked;
    const {data, error} = await sb.from('games').insert({slug: slugify(name) + '-' + Math.random().toString(36).slice(2,6), name, url:url.href, category:v('cat'),
      short_desc:v('curta'), long_desc:v('longa'), tags:[], max_accounts:n, has_market:market, studio:v('estudio'), hue:h}).select('id').single();
    if(error){ toast('Não consegui enviar: ' + error.message); return; }
    if(v('contato')) await sb.from('game_contacts').insert({game_id:data.id, contact:v('contato')});
    toast(name + ' enviado pra análise.');
    await loadGames(); save(); render();
  }
});
document.addEventListener('input', e => {
  if(e.target.id === 'busca'){ query = e.target.value; $('#grid').innerHTML = gridHTML(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if(t.id === 'nick' && user){
    const {error} = await sb.from('profiles').update({nick:t.value.trim()}).eq('id', user.id);
    if(error) toast('Não consegui salvar o apelido.'); else { nick = t.value.trim(); toast('Apelido salvo.'); }
  }else if(t.classList.contains('rev') && user){
    const slug = t.dataset.g, g = G[slug], r = myRatings[slug]; if(!g || !r) return;
    const {error} = await sb.from('ratings').update({comment:t.value.trim(), updated_at:new Date().toISOString()}).eq('user_id', user.id).eq('game_id', g.dbId);
    if(error) toast('Não consegui salvar o comentário.'); else { r.text = t.value.trim(); delete reviews[slug]; loadReviews(slug); toast('Comentário salvo.'); }
  }
});

async function refreshAll(){
  await loadGames();
  await Promise.all([loadRank(), loadUserData()]);
  loading = false; save(); render();
}
async function boot(){
  render();
  if(!sb){ loading = false; loadError = 'Não consegui carregar o World Idle. Verifique a internet e recarregue.'; render(); return; }
  try{
    const {data} = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    await refreshAll();
  }catch(err){ loading = false; loadError = 'Não consegui carregar o World Idle. Recarregue a página.'; render(); }
  sb.auth.onAuthStateChange((ev, session) => {
    const u = session ? session.user : null;
    if((u && u.id) === (user && user.id)) return;
    user = u; setTimeout(refreshAll, 0);
  });
}
boot();
setInterval(tick, 1000);
