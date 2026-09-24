'use strict';
/* netlib — бібліотека мережевих шаблонів. Офлайн-first PWA. */

const DEMO = /*DEMO*/[{"path":"templates/cisco/ebgp-peer.tpl","raw":"---\ntitle: eBGP пір з фільтрами\nvendor: cisco-iosxe\ntags: [bgp, ebgp, border]\nverify:\n  - show ip bgp summary\n  - show ip bgp neighbors {{peer_ip}} advertised-routes\n  - show ip bgp neighbors {{peer_ip}} received-routes\nnotes: |\n  Завжди вхідний і вихідний фільтр, інакше можна стати транзитом.\n  soft-reconfiguration inbound їсть пам'ять, на слабких ISR вмикай свідомо.\nvars:\n  local_as: {type: asn, hint: \"Локальний AS\", example: 65001}\n  peer_ip: {type: ipv4, hint: \"IP сусіда\", example: 192.0.2.1}\n  peer_as: {type: asn, hint: \"AS сусіда\", example: 64500}\n  peer_name: {type: text, hint: \"Опис сусіда\", example: ISP1}\n  pl_in: {type: text, hint: \"Prefix-list на вхід\", default: PL-ISP-IN}\n  pl_out: {type: text, hint: \"Prefix-list на вихід\", default: PL-OWN-OUT}\n---\nrouter bgp {{local_as}}\n bgp log-neighbor-changes\n neighbor {{peer_ip}} remote-as {{peer_as}}\n neighbor {{peer_ip}} description {{peer_name}}\n !\n address-family ipv4\n  neighbor {{peer_ip}} activate\n  neighbor {{peer_ip}} prefix-list {{pl_in}} in\n  neighbor {{peer_ip}} prefix-list {{pl_out}} out\n exit-address-family\n"},{"path":"templates/cisco/prefix-list-own.tpl","raw":"---\ntitle: Prefix-list власних мереж\nvendor: cisco-iosxe\ntags: [bgp, filter]\nverify:\n  - show ip prefix-list {{pl_name}}\nnotes: |\n  Останній рядок deny явний, щоб було видно в лічильниках.\nvars:\n  pl_name: {type: text, hint: \"Імʼя prefix-list\", default: PL-OWN-OUT}\n  own_net: {type: cidr, hint: \"Власний префікс\", example: 203.0.113.0/24}\n---\nip prefix-list {{pl_name}} seq 10 permit {{own_net}}\nip prefix-list {{pl_name}} seq 1000 deny 0.0.0.0/0 le 32\n"},{"path":"templates/cisco/vrrp-v3.tpl","raw":"---\ntitle: VRRPv3 на SVI\nvendor: cisco-iosxe\ntags: [fhrp, vrrp]\nverify:\n  - show vrrp brief\nnotes: |\n  На Catalyst 9200 спершу fhrp version vrrp v3 глобально.\nvars:\n  vlan: {type: int, hint: \"VLAN\", example: 10}\n  svi_ip: {type: ipv4, hint: \"IP інтерфейсу\"}\n  mask: {type: mask, hint: \"Маска\", default: 255.255.255.0}\n  vrid: {type: int, hint: \"VRID\", default: 1}\n  vip: {type: ipv4, hint: \"Віртуальний IP\"}\n  prio: {type: int, hint: \"Пріоритет\", default: 110}\n---\nfhrp version vrrp v3\ninterface Vlan{{vlan}}\n ip address {{svi_ip}} {{mask}}\n vrrp {{vrid}} address-family ipv4\n  address {{vip}} primary\n  priority {{prio}}\n  preempt delay minimum 30\n exit-vrrp\n"},{"path":"templates/mikrotik/ebgp-peer.tpl","raw":"---\ntitle: eBGP пір з фільтрами\nvendor: mikrotik-ros7\ntags: [bgp, ebgp, border]\nverify:\n  - /routing/bgp/session print\n  - /ip/route print where bgp\nnotes: |\n  RouterOS 7: фільтри через chain у /routing/filter/rule.\n  Без output.filter-chain роутер анонсує все з output.network.\nvars:\n  conn_name: {type: text, hint: \"Імʼя підключення\", example: isp1}\n  local_as: {type: asn, hint: \"Локальний AS\", example: 65001}\n  peer_ip: {type: ipv4, hint: \"IP сусіда\", example: 192.0.2.1}\n  peer_as: {type: asn, hint: \"AS сусіда\", example: 64500}\n  own_net: {type: cidr, hint: \"Власний префікс\", example: 203.0.113.0/24}\n---\n/ip/firewall/address-list add list=bgp-out address={{own_net}}\n/routing/filter/rule\nadd chain={{conn_name}}-in rule=\"if (dst-len > 24) { reject } else { accept }\"\nadd chain={{conn_name}}-out rule=\"if (dst in {{own_net}}) { accept } else { reject }\"\n/routing/bgp/connection\nadd name={{conn_name}} as={{local_as}} local.role=ebgp \\\n    remote.address={{peer_ip}} remote.as={{peer_as}} \\\n    input.filter={{conn_name}}-in output.filter-chain={{conn_name}}-out \\\n    output.network=bgp-out\n"}];

// ---------- helpers ----------
const $ = s => document.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
const b64enc = s => { let bin = ''; new TextEncoder().encode(s).forEach(b => bin += String.fromCharCode(b)); return btoa(bin); };
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = h('textarea', { style: 'position:absolute;left:-9999px' }); ta.value = text;
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); return ok;
  }
}

// ---------- mini YAML (підмножина для front matter) ----------
function splitFlow(s) {
  const out = []; let cur = '', depth = 0, q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function scalar(v) {
  v = v.trim();
  if (v.startsWith('[') && v.endsWith(']')) return splitFlow(v.slice(1, -1)).map(scalar);
  if (v.startsWith('{') && v.endsWith('}')) {
    const o = {};
    for (const part of splitFlow(v.slice(1, -1))) {
      const i = part.indexOf(':'); if (i < 0) continue;
      o[part.slice(0, i).trim()] = scalar(part.slice(i + 1));
    }
    return o;
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}
function yamlParse(text) {
  const lines = text.replace(/\t/g, '  ').split(/\r?\n/);
  let i = 0;
  const ind = l => l.match(/^ */)[0].length;
  function block(minInd) {
    let res = null;
    while (i < lines.length) {
      const l = lines[i], t = l.trim();
      if (!t || t.startsWith('#')) { i++; continue; }
      const d = ind(l); if (d < minInd) break;
      if (t === '-' || t.startsWith('- ')) { res = res || []; i++; res.push(scalar(t.slice(1))); continue; }
      const m = t.match(/^([^:]+?):(?:\s+(.*))?$/); i++;
      if (!m) continue;
      res = res || {};
      const k = m[1].trim(), v = (m[2] || '').trim();
      if (v === '|' || v === '>') {
        const buf = []; let bi = null;
        while (i < lines.length) {
          const L = lines[i];
          if (!L.trim()) { buf.push(''); i++; continue; }
          if (ind(L) <= d) break;
          if (bi === null) bi = ind(L);
          buf.push(L.slice(bi)); i++;
        }
        while (buf.length && buf[buf.length - 1] === '') buf.pop();
        res[k] = v === '|' ? buf.join('\n') : buf.join(' ');
      } else if (v === '') res[k] = block(d + 1) ?? '';
      else res[k] = scalar(v);
    }
    return res;
  }
  return block(0) || {};
}

// ---------- шаблони ----------
const PH = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g;
function varsIn(s) { return [...String(s).matchAll(PH)].map(m => m[1]); }

function parseTpl(path, raw) {
  let meta = {}, body = raw, error = null;
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
  if (m) { try { meta = yamlParse(m[1]); } catch (e) { error = 'Не вдалося розібрати заголовок: ' + e.message; } body = m[2]; }
  body = body.replace(/\s+$/, '');
  const verify = [].concat(meta.verify || []).map(String);
  const order = [...new Set([...varsIn(body), ...verify.flatMap(varsIn)])];
  const defs = typeof meta.vars === 'object' && meta.vars ? meta.vars : {};
  const vendor = meta.vendor || path.split('/').slice(-2, -1)[0] || 'інше';
  const tags = [].concat(meta.tags || []).map(String);
  return { path, raw, meta, body, verify, vars: order, defs, vendor, tags, title: meta.title || path.split('/').pop().replace(/\.tpl$/, ''), error };
}

// ---------- валідація ----------
const oct = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${oct}(\\.${oct}){3}$`);
function isIPv6(v) { if (!/^[0-9a-fA-F:.]+$/.test(v) || !v.includes(':')) return false; try { new URL(`http://[${v}]`); return true; } catch { return false; } }
function isMask(v) {
  if (!IPV4.test(v)) return false;
  const n = v.split('.').reduce((a, o) => (a << 8 | +o) >>> 0, 0);
  return ((~n >>> 0) & ((~n >>> 0) + 1)) === 0;
}
const VALID = {
  ipv4: v => IPV4.test(v) || 'це не валідна IPv4-адреса',
  ipv6: v => isIPv6(v) || 'це не валідна IPv6-адреса',
  ip: v => IPV4.test(v) || isIPv6(v) || 'це не валідна IP-адреса',
  cidr: v => { const [a, p] = v.split('/'); return (IPV4.test(a) && /^(\d|[12]\d|3[0-2])$/.test(p || '')) || (isIPv6(a) && /^\d{1,3}$/.test(p || '') && +p <= 128) || 'очікую префікс, наприклад 10.0.0.0/24'; },
  mask: v => isMask(v) || 'це не валідна маска',
  asn: v => (/^\d+$/.test(v) && +v >= 1 && +v <= 4294967295) || /^\d+\.\d+$/.test(v) || 'AS від 1 до 4294967295',
  int: v => /^\d+$/.test(v) || 'тільки ціле число',
  mac: v => /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(v) || /^([0-9a-f]{4}\.){2}[0-9a-f]{4}$/i.test(v) || 'це не валідна MAC-адреса',
  word: v => !/\s/.test(v) || 'без пробілів',
  text: () => true,
};
function validate(def, v) {
  if (v === '') return null;
  const t = (def && def.type) || 'text';
  const r = (VALID[t] || VALID.text)(v.trim());
  if (r !== true) return r;
  if (def && def.range) { const [a, b] = String(def.range).split('-').map(Number); if (+v < a || +v > b) return `діапазон ${a}–${b}`; }
  return true;
}

// ---------- IndexedDB ----------
const DB = {
  _db: null,
  open() {
    return this._db || (this._db = new Promise((res, rej) => {
      const r = indexedDB.open('netlib', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
};

// ---------- стан ----------
const S = {
  lib: null,
  drafts: {},
  settings: { repo: '', branch: 'main', source: 'release', token: '', theme: 'dark', mode: 'direct', apiBase: '/api/gh' },
  values: {},
  sel: null,
  q: '',
  parsed: new Map(),
};
const save = k => DB.set(k, S[k]).catch(e => toast('Не вдалося зберегти: ' + e.message));
let valTimer; const saveValues = () => { clearTimeout(valTimer); valTimer = setTimeout(() => save('values'), 400); };

function templates() {
  const src = S.lib && S.lib.templates.length ? S.lib.templates : DEMO;
  return src.map(t => {
    const key = t.path + '\n' + t.raw;
    if (!S.parsed.has(key)) S.parsed.set(key, Object.assign(parseTpl(t.path, t.raw), { sha: t.sha || null }));
    return S.parsed.get(key);
  });
}
const findTpl = path => templates().find(t => t.path === path);

// ---------- статус ----------
function renderStatus() {
  const on = navigator.onLine;
  $('#dot').classList.toggle('on', on);
  const tag = S.lib ? S.lib.tag : 'демо-бібліотека';
  $('#rel').textContent = on ? tag : `${tag}, офлайн`;
  $('#rel').parentElement.title = (on ? 'Онлайн' : 'Офлайн') + (S.lib ? `, ${S.lib.repo}, оновлено ${new Date(S.lib.fetchedAt).toLocaleString('uk')}` : '');
  const n = Object.keys(S.drafts).length, qd = Object.values(S.drafts).filter(d => d.queued).length;
  const p = $('#drafts'); p.hidden = !n; p.textContent = `${n} ${n === 1 ? 'чернетка' : n < 5 ? 'чернетки' : 'чернеток'}` + (qd ? `, ${qd} в черзі` : '');
}
function applyTheme() {
  const t = S.settings.theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : S.settings.theme;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#F6F7F9' : '#0F1419';
}

// ---------- список ----------
function match(t, q) {
  if (!q) return true;
  const hay = [t.title, t.path, t.vendor, ...t.tags].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
}
function renderList() {
  const nav = $('#list'); nav.replaceChildren();
  const sel = S.sel || {};
  const drafts = Object.values(S.drafts).map(d => Object.assign(parseTpl(d.path, d.raw), { draft: d })).filter(t => match(t, S.q));
  if (drafts.length) {
    nav.append(h('div', { class: 'grp', text: 'Чернетки' }));
    for (const t of drafts) nav.append(item(t, sel.kind === 'draft' && sel.id === t.draft.id, () => select({ kind: 'draft', id: t.draft.id }), t.draft));
  }
  const groups = {};
  for (const t of templates().filter(t => match(t, S.q))) (groups[t.vendor] = groups[t.vendor] || []).push(t);
  for (const v of Object.keys(groups).sort()) {
    nav.append(h('div', { class: 'grp', text: v }));
    for (const t of groups[v].sort((a, b) => a.title.localeCompare(b.title, 'uk')))
      nav.append(item(t, sel.kind === 'tpl' && sel.id === t.path, () => select({ kind: 'tpl', id: t.path })));
  }
  if (!nav.children.length) nav.append(h('p', { class: 'grp', text: 'Нічого не знайдено' }));
}
function item(t, selected, onclick, draft) {
  return h('button', { class: 'item' + (selected ? ' sel' : ''), onclick },
    h('div', { class: 't' }, h('span', { text: t.title }), draft && h('span', { class: 'pill', text: draft.conflict ? 'конфлікт' : draft.queued ? 'в черзі' : 'чернетка' })),
    h('div', { class: 'm', text: t.path.replace(/^templates\//, '') }));
}

// ---------- вибір ----------
function select(sel) {
  S.sel = sel; renderList(); renderMain();
  document.body.classList.add('detail');
  $('#main').scrollTop = 0; window.scrollTo(0, 0);
}

function renderMain() {
  const main = $('#main'); main.replaceChildren();
  const sel = S.sel;
  if (!sel) return main.append(emptyView());
  if (sel.kind === 'settings') return main.append(settingsView());
  if (sel.kind === 'edit') { const d = S.drafts[sel.id]; return d ? main.append(editorView(d)) : select(null); }
  if (sel.kind === 'draft') {
    const d = S.drafts[sel.id]; if (!d) return main.append(emptyView());
    return main.append(tplView(parseTpl(d.path, d.raw), d));
  }
  const t = findTpl(sel.id); if (!t) return main.append(emptyView());
  main.append(tplView(t));
}

function emptyView() {
  return h('div', { class: 'empty' },
    h('h1', { text: 'Обери шаблон зліва' }),
    h('p', { text: S.lib ? 'Поля в коді заповнюються прямо в рядку, однакові змінні синхронізуються, Copy віддає чистий конфіг.' : 'Зараз відкрита демо-бібліотека. Вкажи свій GitHub-репозиторій у налаштуваннях, і програма підтягне останній реліз шаблонів.' }),
    !S.lib && h('button', { class: 'ib', onclick: () => select({ kind: 'settings' }), text: 'Відкрити налаштування' }));
}

// ---------- перегляд шаблону ----------
function tplView(t, draft) {
  const key = draft ? 'draft:' + draft.id : t.path;
  const vals = S.values[key] = S.values[key] || {};
  for (const v of t.vars) if (vals[v] == null && t.defs[v] && t.defs[v].default != null) vals[v] = String(t.defs[v].default);

  const inputs = [];
  const tip = h('div', { class: 'tip' });
  const verifyBox = h('div', { class: 'verify' });

  function state(name) {
    const v = (vals[name] || '').trim();
    if (!v) return 'empty';
    return validate(t.defs[name], v) === true ? 'ok' : 'err';
  }
  function paint(name) {
    const st = state(name);
    for (const i of inputs) if (i.dataset.v === name) {
      if (i.value !== (vals[name] || '')) i.value = vals[name] || '';
      i.className = 'ph' + (st === 'empty' ? '' : ' ' + st);
      i.style.width = `calc(${Math.max((i.value || name).length, 3)}ch + ${st === 'empty' ? 16 : 6}px)`;
      i.setAttribute('aria-invalid', st === 'err');
    }
  }
  function showTip(name) {
    const d = t.defs[name] || {}, v = (vals[name] || '').trim();
    const r = validate(d, v);
    tip.replaceChildren(h('b', { text: name }), d.hint ? ` — ${d.hint}` : '', d.type ? ` (${d.type})` : '',
      d.example && !v ? `, приклад: ${d.example}` : '', typeof r === 'string' ? h('span', { class: 'e', text: `  ${r}` }) : '');
  }
  function fill(s) { return s.replace(PH, (m, n) => (vals[n] || '').trim() || m); }
  function renderVerify() {
    verifyBox.replaceChildren(...t.verify.map(c => h('div', { title: 'Скопіювати', text: fill(c), onclick: async () => toast(await copyText(fill(c)) ? 'Команду скопійовано' : 'Не вдалося скопіювати') })));
  }

  const pre = h('pre');
  t.body.split('\n').forEach((line, li) => {
    if (li) pre.append('\n');
    if (/^\s*[!#]/.test(line) && !varsIn(line).length) return pre.append(h('span', { class: 'cm', text: line }));
    let last = 0;
    for (const m of line.matchAll(PH)) {
      pre.append(line.slice(last, m.index));
      const name = m[1];
      const inp = h('input', { class: 'ph', 'data-v': name, placeholder: name, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': (t.defs[name] && t.defs[name].hint) || name });
      inp.addEventListener('input', () => { vals[name] = inp.value; paint(name); showTip(name); renderVerify(); saveValues(); });
      inp.addEventListener('focus', () => { showTip(name); inp.select(); });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); const n = inputs[inputs.indexOf(inp) + 1]; n ? n.focus() : copyBtn.focus(); }
      });
      inputs.push(inp); pre.append(inp);
      last = m.index + m[0].length;
    }
    pre.append(line.slice(last));
  });
  t.vars.forEach(paint);
  renderVerify();

  let armed = 0;
  async function doCopy() {
    const bad = t.vars.filter(n => state(n) !== 'ok');
    if (bad.length && Date.now() - armed > 3000) {
      armed = Date.now();
      const first = inputs.find(i => bad.includes(i.dataset.v)); if (first) first.focus();
      return toast(`Не заповнено або з помилкою: ${bad.join(', ')}. Натисни ще раз, щоб скопіювати як є`, 3500);
    }
    armed = 0;
    toast(await copyText(fill(t.body) + '\n') ? 'Конфіг скопійовано' : 'Не вдалося скопіювати');
  }
  const copyBtn = h('button', { class: 'cta', onclick: doCopy }, svgCopy(), 'Copy');

  const actions = h('div', { class: 'actions' }, copyBtn,
    h('button', { class: 'ib', text: 'Скинути значення', onclick: () => { delete S.values[key]; save('values'); renderMain(); } }));
  if (draft) {
    actions.append(
      h('button', { class: 'ib', text: 'Редагувати', onclick: () => select({ kind: 'edit', id: draft.id }) }),
      h('button', { class: 'ib', text: 'Push', onclick: () => push(draft) }));
  } else {
    actions.append(
      h('button', { class: 'ib', text: 'Зробити свій', onclick: () => newDraft(t, true) }),
      h('button', { class: 'ib', text: 'Редагувати', onclick: () => newDraft(t, false) }));
  }

  return h('div', {},
    h('div', { class: 'head' }, h('h1', { text: t.title }),
      h('div', { class: 'meta' }, h('span', { class: 'tag', text: t.vendor }), ...t.tags.map(x => h('span', { class: 'tag', text: x })),
        draft && h('span', { class: 'pill', text: draft.conflict ? 'конфлікт з репозиторієм' : draft.queued ? 'в черзі на push' : 'чернетка, не запушено' }))),
    t.error && h('p', { class: 'warn', text: t.error }),
    t.meta.notes && h('p', { class: 'notes', text: t.meta.notes }),
    h('div', { class: 'code' }, pre), tip, actions,
    t.verify.length > 0 && h('section', { class: 'sec' }, h('h2', { text: 'Перевірка' }), verifyBox),
    h('div', { class: 'meta' }, h('span', { text: t.path })));
}
function svgCopy() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.innerHTML = '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>';
  return s;
}

// ---------- чернетки ----------
const NEW_TPL = `---
title: Новий шаблон
vendor: cisco-iosxe
tags: []
verify:
  - show run | section {{name}}
notes: |
  Навіщо цей блок і на що звернути увагу.
vars:
  name: {type: word, hint: "Імʼя обʼєкта", example: EXAMPLE}
---
! тіло шаблону, змінні у форматі {{name}}
`;
function newDraft(t, asCopy) {
  if (!asCopy) {
    const ex = Object.values(S.drafts).find(d => d.path === t.path && d.baseSha === t.sha);
    if (ex) return select({ kind: 'edit', id: ex.id });
  }
  const id = 'd' + Date.now().toString(36);
  S.drafts[id] = t
    ? { id, path: asCopy ? t.path.replace(/\.tpl$/, '-my.tpl') : t.path, raw: t.raw, baseSha: asCopy ? null : t.sha, updatedAt: Date.now() }
    : { id, path: 'templates/cisco/new-template.tpl', raw: NEW_TPL, baseSha: null, updatedAt: Date.now() };
  if (asCopy) S.drafts[id].raw = t.raw.replace(/^(---[\s\S]*?\ntitle:\s*)(.*)$/m, '$1$2 (мій)');
  save('drafts'); renderStatus(); select({ kind: 'edit', id });
}

function editorView(d) {
  const path = h('input', { value: d.path, spellcheck: 'false', autocapitalize: 'off' });
  const ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off' }); ta.value = d.raw;
  const info = h('p', { class: 'tip' });
  function check() {
    const p = parseTpl(path.value, ta.value);
    const undeclared = p.vars.filter(v => !p.defs[v]);
    info.replaceChildren(p.error ? h('span', { class: 'e', text: p.error }) :
      `Змінних: ${p.vars.length}` + (undeclared.length ? `. Без опису у vars: ${undeclared.join(', ')}` : ''));
    if (!/^templates\/.+\.tpl$/.test(path.value)) info.append(h('span', { class: 'e', text: '  Шлях має бути templates/…/імʼя.tpl' }));
  }
  ta.addEventListener('input', check); path.addEventListener('input', check);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); }
  });
  function store() {
    d.path = path.value.trim(); d.raw = ta.value; d.updatedAt = Date.now();
    S.parsed.clear(); save('drafts');
  }
  check();
  return h('div', { class: 'ed' },
    h('div', { class: 'head' }, h('h1', { text: d.baseSha ? 'Редагування шаблону' : 'Новий шаблон' }),
      h('div', { class: 'meta' }, h('span', { class: 'pill', text: 'чернетка зберігається локально' }))),
    h('div', { class: 'row' }, h('label', { text: 'Шлях у репозиторії' }), path),
    h('div', { class: 'row' }, h('label', { text: 'Шаблон: заголовок між --- і тіло зі змінними {{name}}' }), ta),
    info,
    h('div', { class: 'actions' },
      h('button', { class: 'cta', text: 'Зберегти і переглянути', onclick: () => { store(); toast('Чернетку збережено'); select({ kind: 'draft', id: d.id }); } }),
      h('button', { class: 'ib', text: 'Push', onclick: () => { store(); push(d); } }),
      h('button', { class: 'ib', text: 'Видалити чернетку', onclick: () => {
        if (!confirm('Видалити чернетку? Незапушені зміни зникнуть.')) return;
        delete S.drafts[d.id]; delete S.values['draft:' + d.id]; save('drafts'); save('values'); renderStatus(); select(null);
      } })));
}

// ---------- GitHub (напряму з токеном або через свій сервер) ----------
class SessionError extends Error {}
const proxied = () => S.settings.mode === 'proxy';
function gh(path, opts = {}) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) };
  if (!proxied() && S.settings.token) headers.Authorization = 'Bearer ' + S.settings.token;
  const base = proxied() ? (S.settings.apiBase || '/api/gh').replace(/\/$/, '') : 'https://api.github.com';
  // через проксі редірект означає, що сесія входу (Cloudflare Access) закінчилась
  return fetch(base + path, { ...opts, headers, cache: 'no-store', redirect: proxied() ? 'manual' : 'follow', credentials: proxied() ? 'same-origin' : 'omit' })
    .then(r => { if (r.type === 'opaqueredirect') throw new SessionError('сесія входу закінчилась, онови сторінку і увійди знову'); return r; });
}
async function ghJson(path, opts) {
  const r = await gh(path, opts);
  if (r.status === 404) return null;
  if (!r.ok) {
    let msg = r.status + ''; try { msg = (await r.json()).message || msg; } catch {}
    if (r.status === 401) msg = 'токен недійсний';
    if (r.status === 403 && /rate limit/i.test(msg)) msg = 'вичерпано ліміт запитів GitHub, додай токен';
    if (r.status === 502 || r.status === 504) msg = 'сервер не достукався до GitHub';
    throw new Error(msg);
  }
  return r.json();
}
const encPath = p => p.split('/').map(encodeURIComponent).join('/');

let syncing = false;
async function sync(silent) {
  if (syncing) return;
  const { repo, source, branch } = S.settings;
  if (!navigator.onLine) return silent || toast('Немає мережі. Працюєш з локальною копією');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { if (!silent) { toast('Вкажи репозиторій у форматі owner/repo'); select({ kind: 'settings' }); } return; }
  syncing = true; $('#sync').classList.add('spin');
  try {
    let ref, label;
    if (source === 'release') {
      const rel = await ghJson(`/repos/${repo}/releases/latest`);
      if (!rel) throw new Error('у репозиторії ще немає релізу. Створи реліз або перемкни джерело на гілку');
      ref = rel.tag_name; label = rel.tag_name;
    } else {
      const c = await ghJson(`/repos/${repo}/commits/${encodeURIComponent(branch)}`);
      if (!c) throw new Error(`гілку ${branch} не знайдено`);
      ref = c.sha; label = `${branch}@${c.sha.slice(0, 7)}`;
    }
    if (S.lib && S.lib.repo === repo && S.lib.tag === label) { if (!silent) toast('Бібліотека вже актуальна'); return; }

    const tree = await ghJson(`/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    if (!tree) throw new Error('не вдалося прочитати дерево файлів');
    const files = tree.tree.filter(f => f.type === 'blob' && /^templates\/.+\.tpl$/.test(f.path));
    const old = new Map(((S.lib && S.lib.repo === repo && S.lib.templates) || []).map(t => [t.sha, t.raw]));
    let changed = 0;
    const out = [], queue = [...files];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const f = queue.shift();
        let raw = old.get(f.sha);
        if (raw == null) { const b = await ghJson(`/repos/${repo}/git/blobs/${f.sha}`); raw = b64dec(b.content); changed++; }
        out.push({ path: f.path, sha: f.sha, raw });
      }
    }));
    S.lib = { repo, source, tag: label, fetchedAt: Date.now(), templates: out };
    S.parsed.clear(); await save('lib');
    refresh();
    toast(`Оновлено до ${label}: шаблонів ${out.length}, нових або змінених ${changed}`, 3500);
  } catch (e) {
    if (!silent || e instanceof SessionError) toast('Синхронізація не вдалася: ' + e.message, 4500);
  } finally { syncing = false; $('#sync').classList.remove('spin'); }
}
function refresh() {
  renderStatus(); renderList();
  if (!S.sel || !['edit', 'settings'].includes(S.sel.kind)) renderMain();
}

function pushReady() {
  const { repo, token } = S.settings;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return 'не вказано репозиторій';
  if (!proxied() && !token) return 'потрібен токен або режим через сервер';
  return null;
}

// Push. Офлайн чернетка стає в чергу і відправляється сама, коли зʼявиться мережа.
async function push(d, auto) {
  const { repo, branch, source } = S.settings;
  if (!/^templates\/.+\.tpl$/.test(d.path)) return toast('Шлях має бути templates/…/імʼя.tpl');
  const p = parseTpl(d.path, d.raw); if (p.error) return toast(p.error);
  const why = pushReady();
  if (why) { toast('Push неможливий: ' + why); return select({ kind: 'settings' }); }
  if (!navigator.onLine) {
    d.queued = true; d.conflict = false; await save('drafts'); refresh();
    return toast('Немає мережі. Чернетка в черзі, відправлю, коли зʼявиться звʼязок', 3500);
  }
  try {
    const cur = await ghJson(`/repos/${repo}/contents/${encPath(d.path)}?ref=${encodeURIComponent(branch)}`);
    const remoteSha = cur && cur.sha;
    const clash = remoteSha && (!d.baseSha || remoteSha !== d.baseSha);
    if (clash) {
      if (auto) { d.queued = false; d.conflict = true; await save('drafts'); refresh(); return toast(`Конфлікт: ${d.path} змінився в репозиторії. Відкрий чернетку і вирішуй вручну`, 4500); }
      const q = d.baseSha ? 'Цей шаблон змінився в репозиторії після твоєї синхронізації. Перезаписати віддалену версію?' : `Файл ${d.path} вже є в ${branch}. Перезаписати?`;
      if (!confirm(q)) return;
    }
    const body = { message: `${remoteSha ? 'update' : 'add'} ${d.path.replace(/^templates\//, '')}`, content: b64enc(d.raw), branch };
    if (remoteSha) body.sha = remoteSha;
    const res = await ghJson(`/repos/${repo}/contents/${encPath(d.path)}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    if (!res) throw new Error('репозиторій або гілку не знайдено, перевір доступ');
    if (!S.lib) S.lib = { repo, source, tag: 'локально', fetchedAt: Date.now(), templates: [] };
    S.lib.templates = S.lib.templates.filter(t => t.path !== d.path).concat({ path: d.path, sha: res.content.sha, raw: d.raw });
    delete S.drafts[d.id]; delete S.values['draft:' + d.id];
    S.parsed.clear(); await Promise.all([save('lib'), save('drafts'), save('values')]);
    if (auto) refresh(); else { renderStatus(); select({ kind: 'tpl', id: d.path }); }
    toast(source === 'release' ? `Запушено в ${branch}. Для всіх пристроїв зʼявиться з наступним релізом` : `Запушено в ${branch}`, 4000);
  } catch (e) {
    if (auto && !(e instanceof SessionError)) return; // лишається в черзі, спробуємо пізніше
    toast('Push не вдався: ' + e.message, 4500);
  }
}
async function flushQueue() {
  if (!navigator.onLine || pushReady()) return;
  for (const d of Object.values(S.drafts).filter(d => d.queued)) await push(d, true);
}

// ---------- експорт / імпорт (обмін без інтернету) ----------
function exportAll() {
  const data = { format: 'netlib', version: 1, exportedAt: new Date().toISOString(), lib: S.lib, drafts: S.drafts };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  const a = h('a', { href: url, download: `netlib-${(S.lib && S.lib.tag) || 'demo'}-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function importFiles(files) {
  let tpl = 0, dr = 0, lib = false;
  for (const f of files) {
    const text = await f.text();
    if (f.name.endsWith('.tpl')) {
      const id = 'd' + Date.now().toString(36) + (tpl++);
      S.drafts[id] = { id, path: `templates/imported/${f.name}`, raw: text, baseSha: null, updatedAt: Date.now() };
      continue;
    }
    let data; try { data = JSON.parse(text); } catch { toast(`${f.name}: це не JSON і не .tpl`); continue; }
    if (data.format !== 'netlib') { toast(`${f.name}: не схоже на експорт netlib`); continue; }
    if (data.lib && confirm(`Замінити бібліотеку на ${data.lib.tag} з файлу? Чернетки залишаться.`)) { S.lib = data.lib; lib = true; }
    for (const d of Object.values(data.drafts || {})) if (!S.drafts[d.id]) { S.drafts[d.id] = d; dr++; }
  }
  S.parsed.clear(); await Promise.all([save('lib'), save('drafts')]); refresh();
  toast(`Імпортовано: ${lib ? 'бібліотеку, ' : ''}чернеток ${dr + tpl}`);
}

// ---------- налаштування ----------
function settingsView() {
  const s = S.settings;
  const f = {
    repo: h('input', { value: s.repo, placeholder: 'maskhav/netlib', spellcheck: 'false', autocapitalize: 'off' }),
    mode: h('select', {}, h('option', { value: 'direct', text: 'Напряму в GitHub з токеном на пристрої' }), h('option', { value: 'proxy', text: 'Через мій сервер (токен на сервері)' })),
    apiBase: h('input', { value: s.apiBase || '/api/gh', spellcheck: 'false', autocapitalize: 'off' }),
    source: h('select', {}, h('option', { value: 'release', text: 'Останній реліз' }), h('option', { value: 'branch', text: 'Гілка (найсвіжіше)' })),
    branch: h('input', { value: s.branch, placeholder: 'main', spellcheck: 'false', autocapitalize: 'off' }),
    token: h('input', { type: 'password', value: s.token, placeholder: 'github_pat_…', autocomplete: 'off' }),
    theme: h('select', {}, h('option', { value: 'dark', text: 'Темна' }), h('option', { value: 'light', text: 'Світла' }), h('option', { value: 'auto', text: 'Як у системі' })),
  };
  f.source.value = s.source; f.theme.value = s.theme; f.mode.value = s.mode || 'direct';
  f.theme.addEventListener('change', () => { s.theme = f.theme.value; applyTheme(); save('settings'); });
  const row = (label, el, hint) => h('div', { class: 'row' }, h('label', { text: label }), el, hint && h('small', { text: hint }));
  const tokenRow = row('Токен GitHub', f.token, 'Fine-grained token тільки на цей репозиторій, Contents: read and write. Зберігається лише на цьому пристрої');
  const proxyRow = row('Адреса проксі', f.apiBase, 'Шлях на тому ж домені, який nginx пересилає в api.github.com з токеном');
  const toggle = () => { const p = f.mode.value === 'proxy'; tokenRow.hidden = p; proxyRow.hidden = !p; };
  f.mode.addEventListener('change', toggle); toggle();
  const file = h('input', { type: 'file', accept: '.json,.tpl', multiple: true, hidden: true, onchange: e => { importFiles([...e.target.files]); e.target.value = ''; } });
  const queued = Object.values(S.drafts).filter(d => d.queued).length;
  return h('div', { class: 'set' },
    h('div', { class: 'head' }, h('h1', { text: 'Налаштування' })),
    row('Репозиторій з шаблонами', f.repo, 'Файли шукаються в templates/**/*.tpl'),
    row('Доступ до GitHub', f.mode), proxyRow, tokenRow,
    row('Джерело бібліотеки', f.source, 'Реліз дає зафіксовану версію, гілка дає все одразу після push'),
    row('Гілка для push', f.branch),
    row('Тема', f.theme),
    h('div', { class: 'actions' },
      h('button', { class: 'cta', text: 'Зберегти і синхронізувати', onclick: async () => {
        Object.assign(s, { repo: f.repo.value.trim(), mode: f.mode.value, apiBase: f.apiBase.value.trim() || '/api/gh', source: f.source.value, branch: f.branch.value.trim() || 'main', token: f.token.value.trim() });
        await save('settings'); toast('Налаштування збережено'); await sync(); flushQueue();
      } })),
    h('div', { class: 'head' }, h('h1', { style: 'font-size:17px;margin-top:24px', text: 'Без інтернету' })),
    h('p', { class: 'notes', text: 'Експорт зберігає бібліотеку і чернетки в один файл. Його можна перенести на інший пристрій або ноутбук без мережі й імпортувати. Імпорт також приймає окремі .tpl, вони стають чернетками.' + (queued ? `\nУ черзі на push: ${queued}.` : '') }),
    h('div', { class: 'actions' },
      h('button', { class: 'ib', text: 'Експорт у файл', onclick: exportAll }),
      h('button', { class: 'ib', text: 'Імпорт з файлу', onclick: () => file.click() }), file,
      S.lib && h('button', { class: 'ib', text: 'Повернути демо-бібліотеку', onclick: async () => {
        if (!confirm('Прибрати завантажену бібліотеку з пристрою? Чернетки залишаться.')) return;
        S.lib = null; S.parsed.clear(); await save('lib'); renderStatus(); renderList(); select(null);
      } })));
}

// ---------- старт ----------
async function init() {
  try {
    const [lib, drafts, settings, values] = await Promise.all(['lib', 'drafts', 'settings', 'values'].map(k => DB.get(k)));
    S.lib = lib || null; S.drafts = drafts || {}; Object.assign(S.settings, settings || {}); S.values = values || {};
  } catch (e) { toast('Локальне сховище недоступне, зміни не збережуться'); }
  applyTheme(); renderStatus(); renderList(); renderMain();

  $('#q').addEventListener('input', e => { S.q = e.target.value; renderList(); });
  $('#sync').addEventListener('click', () => sync(false));
  $('#settings').addEventListener('click', () => select({ kind: 'settings' }));
  $('#newtpl').addEventListener('click', () => newDraft(null));
  $('#back').addEventListener('click', () => { document.body.classList.remove('detail'); S.sel = null; renderList(); });
  addEventListener('online', async () => { renderStatus(); await sync(true); flushQueue(); });
  addEventListener('offline', renderStatus);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
  document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); $('#q').focus(); } });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (S.settings.repo) sync(true).then(flushQueue);
}
init();
