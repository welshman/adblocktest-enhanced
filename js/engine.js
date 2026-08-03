/**
 * AdBlock Test Enhanced — Main Engine
 * Self-contained: no build step, no external deps.
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 8000;
const FETCH_CONCURRENCY = 50;
const LS_KEY = 'abt_enhanced';
const MAX_HISTORY = 20;
const CIRCUMFERENCE = 2 * Math.PI * 52; // matches SVG r=52

// ── State ─────────────────────────────────────────────────────────────────────
let abt = { total: 0, blocked: 0, notblocked: 0, hosts: {}, cosmetic: {}, scripts: {}, extras: {} };
let testRunning = false;
let history = loadHistory();

// ── Utilities ─────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function setProgress(pct) {
  const bar = $('progress-bar');
  const lbl = $('progress-label');
  if (bar) { bar.style.setProperty('--pct', pct + '%'); bar.setAttribute('aria-valuenow', pct); }
  if (lbl) lbl.textContent = Math.round(pct) + '%';
}

function setScoreRing(pct) {
  const fill = $('ring-fill');
  const lbl = $('score-pct');
  if (!fill) return;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  fill.style.strokeDashoffset = offset;
  // colour transition based on score
  if (pct >= 70) fill.style.stroke = 'var(--green)';
  else if (pct >= 40) fill.style.stroke = 'var(--orange)';
  else fill.style.stroke = 'var(--red)';
  if (lbl) lbl.textContent = Math.round(pct) + '%';
}

function showToast(msg, type = 'success') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 2800);
}

async function copyText(str) {
  try {
    await navigator.clipboard.writeText(str);
    showToast('Copied to clipboard!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = str; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Copied to clipboard!');
  }
}

function fetchWithTimeout(url, opts, ms) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const p = ctrl
    ? fetch(url, { ...opts, signal: ctrl.signal })
    : fetch(url, opts);
  const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : setTimeout(() => {}, ms);
  return p.finally(() => clearTimeout(t));
}

// ── LocalStorage ──────────────────────────────────────────────────────────────
function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
  } catch { return []; }
}

function saveHistory() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(history.slice(-MAX_HISTORY))); } catch {}
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function initTheme() {
  const stored = localStorage.getItem('abt_theme');
  const sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', stored || sys);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('abt_theme', next);
}

// ── Score URL sharing ─────────────────────────────────────────────────────────
function encodeShare(data) {
  try { return btoa(JSON.stringify({ b: data.blocked, t: data.total, d: data.date })); } catch { return ''; }
}

function decodeShare(hash) {
  try { return JSON.parse(atob(hash.replace('#share=', ''))); } catch { return null; }
}

function loadSharedResult() {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return;
  const data = decodeShare(hash);
  if (!data) return;
  const pct = data.t > 0 ? Math.round((data.b / data.t) * 100) : 0;
  setScoreRing(pct);
  const sum = $('summary-bar');
  if (sum) {
    sum.style.display = 'flex';
    $('sum-total').textContent = '📋 Shared result from ' + (data.d || 'unknown date');
    $('sum-blocked').textContent = data.b + ' blocked';
    $('sum-failed').textContent = (data.t - data.b) + ' not blocked';
  }
  showToast('Loaded shared result from URL', 'success');
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadHostData() {
  const resp = await fetch('data/hosts.json');
  return resp.json();
}

// ── Cosmetic filter checks ─────────────────────────────────────────────────────
function checkCosmeticStatic() {
  return new Promise(resolve => {
    setTimeout(() => {
      const el = $('cts_test');
      const blocked = !el || !(el.clientHeight || el.offsetHeight);
      abt.cosmetic.static = blocked;
      const card = $('ct-static');
      const status = $('ct-static-status');
      if (card) card.className = 'test-block ' + (blocked ? 'pass' : 'fail');
      if (status) status.textContent = blocked ? '✓ Blocked' : '✗ Not blocked';
      if (blocked) abt.blocked++; else abt.notblocked++;
      resolve();
    }, 1300);
  });
}

function checkCosmeticDynamic() {
  return new Promise(resolve => {
    const existing = document.getElementById('ad_ctd');
    if (existing) existing.remove();
    const ad = document.createElement('div');
    ad.id = 'ad_ctd';
    ad.className = 'textads banner-ads banner_ads ad-unit afs_ads ad-zone ad-space adsbox';
    ad.innerHTML = '&nbsp;';
    const container = $('ctd_test');
    if (container) container.appendChild(ad);
    setTimeout(() => {
      const adt = document.getElementById('ad_ctd');
      const blocked = !adt || !(adt.offsetHeight || adt.clientHeight);
      abt.cosmetic.dynamic = blocked;
      const card = $('ct-dynamic');
      const status = $('ct-dynamic-status');
      if (card) card.className = 'test-block ' + (blocked ? 'pass' : 'fail');
      if (status) status.textContent = blocked ? '✓ Blocked' : '✗ Not blocked';
      if (blocked) abt.blocked++; else abt.notblocked++;
      resolve();
    }, 1300);
  });
}

// ── Script blocking checks ─────────────────────────────────────────────────────
function checkScripts() {
  const adsBlocked = typeof s_test_ads === 'undefined';
  const pageadBlocked = typeof s_test_pagead === 'undefined';
  abt.scripts = { ads: adsBlocked, pagead: pageadBlocked };

  const adsCard = $('sb-ads'), adsStatus = $('sb-ads-status');
  const pgCard = $('sb-pagead'), pgStatus = $('sb-pagead-status');

  if (adsCard) adsCard.className = 'test-block ' + (adsBlocked ? 'pass' : 'fail');
  if (adsStatus) adsStatus.textContent = adsBlocked ? '✓ Blocked' : '✗ Loaded';
  if (pgCard) pgCard.className = 'test-block ' + (pageadBlocked ? 'pass' : 'fail');
  if (pgStatus) pgStatus.textContent = pageadBlocked ? '✓ Blocked' : '✗ Loaded';

  abt.blocked += (adsBlocked ? 1 : 0) + (pageadBlocked ? 1 : 0);
  abt.notblocked += (adsBlocked ? 0 : 1) + (pageadBlocked ? 0 : 1);
}

// ── WebRTC leak check ─────────────────────────────────────────────────────────
function checkWebRTC() {
  return new Promise(resolve => {
    const statusEl = $('webrtc-status');
    const detailEl = $('webrtc-detail');
    const card = $('extra-webrtc');

    if (typeof RTCPeerConnection === 'undefined') {
      if (statusEl) statusEl.textContent = '✓ WebRTC unavailable (protected)';
      if (card) card.className = 'test-block pass';
      abt.extras.webrtc = { status: 'unavailable', ips: [] };
      abt.blocked++;
      return resolve();
    }

    const ips = [];
    let done = false;

    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('');
      pc.onicecandidate = e => {
        if (!e || !e.candidate || !e.candidate.candidate) {
          if (!done) { done = true; finalize(); }
          return;
        }
        const m = e.candidate.candidate.match(/([\d.]+|[a-f0-9:]+)/g);
        if (m) m.forEach(ip => {
          if ((ip.includes('.') || ip.includes(':')) && !ips.includes(ip)) ips.push(ip);
        });
      };
      pc.createOffer().then(o => pc.setLocalDescription(o));
      setTimeout(() => { if (!done) { done = true; finalize(); } pc.close(); }, 3000);
    } catch {
      if (statusEl) statusEl.textContent = '✓ WebRTC blocked (protected)';
      if (card) card.className = 'test-block pass';
      abt.extras.webrtc = { status: 'blocked', ips: [] };
      abt.blocked++;
      return resolve();
    }

    function finalize() {
      const privateRanges = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^127\./, /^::1$/, /^fc/, /^fd/];
      const localIps = ips.filter(ip => privateRanges.some(r => r.test(ip)));
      const hasLeak = localIps.length > 0;
      abt.extras.webrtc = { status: hasLeak ? 'leak' : 'ok', ips };

      if (hasLeak) {
        if (statusEl) statusEl.textContent = '⚠ Local IP exposed';
        if (detailEl) detailEl.textContent = localIps.join(', ');
        if (card) card.className = 'test-block fail';
        abt.notblocked++;
      } else {
        if (statusEl) statusEl.textContent = '✓ No local IP leak';
        if (card) card.className = 'test-block pass';
        abt.blocked++;
      }
      resolve();
    }
  });
}

// ── Canvas fingerprint check ──────────────────────────────────────────────────
function checkCanvasFingerprint() {
  const statusEl = $('canvas-status');
  const detailEl = $('canvas-detail');
  const card = $('extra-canvas');

  try {
    const c1 = document.createElement('canvas');
    const c2 = document.createElement('canvas');
    c1.width = c2.width = 200; c1.height = c2.height = 50;

    function drawCanvas(c) {
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('ABCDEFabcdef 🛡️', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('ABCDEFabcdef 🛡️', 4, 17);
      return c.toDataURL();
    }

    const d1 = drawCanvas(c1);
    const d2 = drawCanvas(c2);

    if (d1 !== d2) {
      // Randomised — fingerprint resistance active
      if (statusEl) statusEl.textContent = '✓ Randomised (protected)';
      if (detailEl) detailEl.textContent = 'Canvas API returns different values each call.';
      if (card) card.className = 'test-block pass';
      abt.extras.canvas = 'randomised';
      abt.blocked++;
    } else if (d1 === 'data:,') {
      // Blocked entirely
      if (statusEl) statusEl.textContent = '✓ Blocked (protected)';
      if (detailEl) detailEl.textContent = 'Canvas toDataURL() is blocked.';
      if (card) card.className = 'test-block pass';
      abt.extras.canvas = 'blocked';
      abt.blocked++;
    } else {
      if (statusEl) statusEl.textContent = '✗ Consistent fingerprint';
      if (detailEl) detailEl.textContent = 'Canvas returns identical data each call — fingerprintable.';
      if (card) card.className = 'test-block fail';
      abt.extras.canvas = 'exposed';
      abt.notblocked++;
    }
  } catch {
    if (statusEl) statusEl.textContent = '✓ Canvas blocked (protected)';
    if (card) card.className = 'test-block pass';
    abt.extras.canvas = 'blocked';
    abt.blocked++;
  }
}

// ── Host tests ────────────────────────────────────────────────────────────────
async function runHostTests(data) {
  const wrapper = $('host-tests');
  if (!wrapper) return;
  wrapper.innerHTML = '';

  const catKeys = Object.keys(data);
  let totalDone = 0;
  let allTasks = [];

  // Count total host tests for progress
  let hostTotal = 0;
  catKeys.forEach(cat => Object.values(data[cat]).forEach(arr => hostTotal += arr.length));

  for (const cat of catKeys) {
    abt.hosts[cat] = {};
    const catDiv = document.createElement('div');
    catDiv.className = 'host-category';
    const header = document.createElement('div');
    header.className = 'host-cat-header';
    header.innerHTML = `<span>${escHtml(cat)}</span><span class="host-cat-toggle">▶ expand</span>`;
    const body = document.createElement('div');
    body.className = 'host-cat-body';
    const subcatsDiv = document.createElement('div');
    subcatsDiv.className = 'host-subcats';
    body.appendChild(subcatsDiv);
    catDiv.appendChild(header);
    catDiv.appendChild(body);
    wrapper.appendChild(catDiv);

    header.addEventListener('click', () => {
      body.classList.toggle('open');
      header.querySelector('.host-cat-toggle').textContent = body.classList.contains('open') ? '▼ collapse' : '▶ expand';
    });

    const subcats = data[cat];
    for (const sub of Object.keys(subcats)) {
      abt.hosts[cat][sub] = {};
      const subDiv = document.createElement('div');
      subDiv.className = 'host-subcat';
      const subName = document.createElement('div');
      subName.className = 'host-subcat-name';
      subName.textContent = sub;
      const entriesDiv = document.createElement('div');
      entriesDiv.className = 'host-entries';
      subDiv.appendChild(subName);
      subDiv.appendChild(entriesDiv);
      subcatsDiv.appendChild(subDiv);

      const urls = subcats[sub];
      for (const url of urls) {
        abt.total++;
        allTasks.push(async () => {
          const entry = document.createElement('div');
          entry.className = 'host-entry';
          const dot = document.createElement('span');
          dot.className = 'dot';
          const lbl = document.createElement('span');
          lbl.textContent = url;
          entry.appendChild(dot);
          entry.appendChild(lbl);
          entriesDiv.appendChild(entry);

          let blocked = false;
          try {
            await fetchWithTimeout('https://' + url + '/fakepage.html', { method: 'HEAD', mode: 'no-cors' }, FETCH_TIMEOUT_MS);
            // Response received = NOT blocked
            blocked = false;
          } catch (e) {
            // Error = blocked or timed out = treat as blocked
            blocked = true;
          }

          entry.classList.add(blocked ? 'pass' : 'fail');
          abt.hosts[cat][sub][url] = blocked;
          if (blocked) { abt.blocked++; } else { abt.notblocked++; }

          // Update subcat border
          const vals = Object.values(abt.hosts[cat][sub]);
          const allPass = vals.every(Boolean);
          const anyFail = vals.some(v => v === false);
          subDiv.className = 'host-subcat ' + (anyFail ? 'fail' : allPass ? 'pass' : '');

          totalDone++;
          const pct = abt.total > 0 ? Math.round(((abt.blocked + abt.notblocked) / abt.total) * 100) : 0;
          setProgress(Math.min(pct, 100));
          updateScoreLive();
        });
      }
    }
  }

  // Run with concurrency
  await runConcurrent(allTasks, FETCH_CONCURRENCY);
}

async function runConcurrent(tasks, limit) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      await tasks[idx]();
    }
  });
  await Promise.all(workers);
}

function updateScoreLive() {
  const pct = abt.total > 0 ? Math.round((abt.blocked / abt.total) * 100) : 0;
  setScoreRing(pct);
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ── Category overview bars ────────────────────────────────────────────────────
function renderCategoryOverview() {
  const wrap = $('category-overview');
  if (!wrap) return;
  wrap.innerHTML = '';

  const cats = [
    { id: 'cosmetic', label: 'Cosmetic Filters', get: () => {
      const vals = Object.values(abt.cosmetic);
      return { pass: vals.filter(Boolean).length, total: vals.length };
    }},
    { id: 'scripts', label: 'Script Blocking', get: () => {
      const vals = Object.values(abt.scripts);
      return { pass: vals.filter(Boolean).length, total: vals.length };
    }},
    { id: 'extras', label: 'Privacy Extras', get: () => {
      const webrtc = abt.extras.webrtc ? (abt.extras.webrtc.status === 'leak' ? 0 : 1) : 0;
      const canvas = abt.extras.canvas === 'exposed' ? 0 : 1;
      return { pass: webrtc + canvas, total: 2 };
    }},
    ...Object.keys(abt.hosts).map(cat => ({
      id: cat,
      label: cat,
      get: () => {
        let pass = 0, total = 0;
        Object.values(abt.hosts[cat]).forEach(sub => {
          Object.values(sub).forEach(v => { total++; if (v) pass++; });
        });
        return { pass, total };
      }
    }))
  ];

  cats.forEach(({ label, get }) => {
    const { pass, total } = get();
    if (total === 0) return;
    const pct = Math.round((pass / total) * 100);
    const colorClass = pct >= 70 ? '' : pct >= 40 ? 'mid' : 'bad';
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-card-label">${escHtml(label)}</div>
      <div class="cat-bar-bg"><div class="cat-bar-fill ${colorClass}" style="width:${pct}%"></div></div>
      <div class="cat-score">${pass}/${total} (${pct}%)</div>
    `;
    wrap.appendChild(card);
  });
}

// ── History rendering ─────────────────────────────────────────────────────────
function renderHistory() {
  const list = $('history-list');
  if (!list) return;
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No tests run yet.</p>';
    renderHistoryChart([]);
    return;
  }
  [...history].reverse().forEach((entry, i) => {
    const pct = entry.total > 0 ? Math.round((entry.blocked / entry.total) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div>
        <div class="hi-score">${pct}%</div>
        <div class="hi-date">${escHtml(entry.date)}</div>
      </div>
      <div class="history-item-actions">
        <button class="hi-btn" data-action="share" data-idx="${history.length - 1 - i}" title="Share this result">Share</button>
        <button class="hi-btn" data-action="dl" data-idx="${history.length - 1 - i}" title="Download JSON">DL</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    const entry = history[idx];
    if (!entry) return;
    if (btn.dataset.action === 'share') {
      const hash = '#share=' + encodeShare(entry);
      copyText(window.location.href.split('#')[0] + hash);
    } else if (btn.dataset.action === 'dl') {
      downloadJSON(entry);
    }
  }, { once: false });

  renderHistoryChart(history);
}

function renderHistoryChart(data) {
  const canvas = $('history-chart');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth || 380;
  const H = canvas.height = 120;
  ctx.clearRect(0, 0, W, H);

  if (data.length < 2) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Run more tests to see trend', W / 2, H / 2);
    return;
  }

  const scores = data.map(d => d.total > 0 ? (d.blocked / d.total) * 100 : 0);
  const pad = { t: 10, r: 20, b: 30, l: 40 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4aa';
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#2a2f40';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';

  // Grid lines
  ctx.strokeStyle = muted;
  ctx.lineWidth = 1;
  [0, 25, 50, 75, 100].forEach(v => {
    const y = pad.t + chartH - (v / 100) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + chartW, y); ctx.stroke();
    ctx.fillStyle = textColor; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(v + '%', pad.l - 4, y + 3);
  });

  // Area fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
  grad.addColorStop(0, accent + '55');
  grad.addColorStop(1, accent + '00');
  ctx.beginPath();
  scores.forEach((s, i) => {
    const x = pad.l + (i / (scores.length - 1)) * chartW;
    const y = pad.t + chartH - (s / 100) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  const lastX = pad.l + chartW, firstX = pad.l;
  ctx.lineTo(lastX, pad.t + chartH);
  ctx.lineTo(firstX, pad.t + chartH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = accent; ctx.lineWidth = 2;
  scores.forEach((s, i) => {
    const x = pad.l + (i / (scores.length - 1)) * chartW;
    const y = pad.t + chartH - (s / 100) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  scores.forEach((s, i) => {
    const x = pad.l + (i / (scores.length - 1)) * chartW;
    const y = pad.t + chartH - (s / 100) * chartH;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#171b26';
    ctx.lineWidth = 2; ctx.stroke();
  });
}

function downloadJSON(entry) {
  const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'adblocktest_' + (entry.date || 'result').replace(/[/:]/g, '-').replace(/ /g, '_') + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Main test runner ──────────────────────────────────────────────────────────
async function runTest() {
  if (testRunning) return;
  testRunning = true;

  // Reset state
  abt = { total: 0, blocked: 0, notblocked: 0, hosts: {}, cosmetic: {}, scripts: {}, extras: {} };

  // UI: transition to running
  $('btn-run').style.display = 'none';
  $('btn-rerun').style.display = 'none';
  const progWrap = $('progress-wrap');
  if (progWrap) progWrap.style.display = 'flex';
  setProgress(0);
  setScoreRing(0);
  const resultsSection = $('results-section');
  if (resultsSection) resultsSection.style.display = 'block';

  try {
    const data = await loadHostData();

    // Count total: host tests + 2 cosmetic + 2 script + 2 extras
    let hostCount = 0;
    Object.values(data).forEach(cat => Object.values(cat).forEach(arr => hostCount += arr.length));
    abt.total = hostCount + 6;

    // Run all checks concurrently where possible
    await Promise.all([
      checkCosmeticStatic(),
      checkCosmeticDynamic(),
      Promise.resolve().then(() => checkScripts()),
      Promise.resolve().then(() => checkCanvasFingerprint()),
      checkWebRTC(),
      runHostTests(data)
    ]);

    // Final score
    const finalPct = abt.total > 0 ? Math.round((abt.blocked / abt.total) * 100) : 0;
    setScoreRing(finalPct);
    setProgress(100);
    renderCategoryOverview();

    // Summary bar
    const sumBar = $('summary-bar');
    if (sumBar) {
      sumBar.style.display = 'flex';
      $('sum-total').textContent = '📋 Total: ' + abt.total;
      $('sum-blocked').textContent = abt.blocked + ' blocked';
      $('sum-failed').textContent = abt.notblocked + ' not blocked';
    }

    // Save to history
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    history.push({ time: Date.now(), date: dateStr, blocked: abt.blocked, total: abt.total, notblocked: abt.notblocked });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    saveHistory();
    renderHistory();

  } catch (err) {
    console.error('AdBlockTest error:', err);
    showToast('Test encountered an error. Check console.', 'error');
  } finally {
    testRunning = false;
    if (progWrap) progWrap.style.display = 'none';
    $('btn-rerun').style.display = 'inline-flex';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSharedResult();
  renderHistory();

  $('theme-toggle').addEventListener('click', toggleTheme);

  $('btn-run').addEventListener('click', runTest);
  $('btn-rerun').addEventListener('click', () => window.location.reload());

  // History panel
  const panel = document.getElementById('panel-history');
  const overlay = $('history-overlay');
  $('btn-history').addEventListener('click', () => {
    panel.classList.add('open');
    overlay.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    $('btn-history').setAttribute('aria-expanded', 'true');
    renderHistory();
  });
  function closeHistory() {
    panel.classList.remove('open');
    overlay.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    $('btn-history').setAttribute('aria-expanded', 'false');
  }
  $('btn-close-history').addEventListener('click', closeHistory);
  overlay.addEventListener('click', closeHistory);
  $('btn-clear-history').addEventListener('click', () => {
    history = [];
    saveHistory();
    renderHistory();
    showToast('History cleared.');
  });

  // Share button
  $('btn-share').addEventListener('click', () => {
    if (abt.total === 0) { showToast('Run a test first!', 'error'); return; }
    const hash = '#share=' + encodeShare({ blocked: abt.blocked, total: abt.total, date: new Date().toLocaleDateString() });
    copyText(window.location.href.split('#')[0] + hash);
  });

  // Host list copy buttons
  const txtUrl = window.location.href.replace(/\/[^/]*$/, '') + '/host-lists/d3host.txt';
  const adblockUrl = window.location.href.replace(/\/[^/]*$/, '') + '/host-lists/d3host.adblock';
  $('copy-txt').addEventListener('click', () => copyText(txtUrl));
  $('copy-adblock').addEventListener('click', () => copyText(adblockUrl));

  // Keyboard: Escape closes panel
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) closeHistory();
  });
});
