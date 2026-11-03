/* Ponderada 1 — circuito RC de carga: esquema, calculadora, previsão, coleta, gráfico e relatório */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { wire: '#8c84a3', text2: '#dedde6', muted: '#a9a3bd', mint: '#80e6c6', orange: '#ff9148', blue: '#7caaff', red: '#ff5d5d' };
  const KEY = 'ponderada-1-rascunho';

  // Números: aceita vírgula decimal; exibe em pt-BR
  const num = s => { const v = parseFloat(String(s ?? '').trim().replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
  const fmt = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtSig = v => {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    return fmt(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
  };
  const fmtTime = ms => !Number.isFinite(ms) ? '—' : ms >= 1000 ? `${fmtSig(ms / 1000)} s` : `${fmtSig(ms)} ms`;
  const nowStr = iso => new Date(iso).toLocaleString('pt-BR');

  function S(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  }
  const wire = (g, d, col) => S('path', { d, fill: 'none', stroke: col || C.wire, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  const txt = (g, x, y, t, o = {}) => S('text', { x, y, text: t, fill: o.fill || C.muted, 'font-size': o.size || 13, 'text-anchor': o.anchor || 'middle', 'font-family': 'IBM Plex Mono, monospace', 'font-weight': o.weight || 500 }, g);
  const gnd = (g, x, y) => wire(g, `M${x - 14} ${y} H${x + 14} M${x - 8} ${y + 6} H${x + 8} M${x - 3} ${y + 12} H${x + 3}`);

  /* ---------------- Esquema elétrico animado ---------------- */
  const svg = document.getElementById('schematic');
  if (svg) {
    S('rect', { x: 20, y: 30, width: 150, height: 240, rx: 12, fill: '#11606b', stroke: '#0c4a53', 'stroke-width': 2 }, svg);
    txt(svg, 80, 150, 'UNO', { fill: 'rgba(255,255,255,.6)', size: 22, weight: 700 });
    txt(svg, 80, 172, 'U1', { fill: 'rgba(255,255,255,.5)', size: 12 });
    [['D8', 90], ['A0', 190], ['GND', 250]].forEach(([n, y]) => {
      S('rect', { x: 164, y: y - 4, width: 8, height: 8, fill: '#ddd' }, svg);
      txt(svg, 156, y + 4, n, { fill: '#fff', size: 12, anchor: 'end', weight: 600 });
    });

    // D8 → R → nó
    const d8 = wire(svg, 'M172 90 H230 M310 90 H380', C.wire);
    S('path', { d: 'M230 90 l5 -10 l10 20 l10 -20 l10 20 l10 -20 l10 20 l10 -20 l10 20 l5 -10', fill: 'none', stroke: C.blue, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    txt(svg, 270, 68, 'R1', { fill: C.blue, size: 12, weight: 600 });
    // nó → C → GND
    wire(svg, 'M380 90 H450 V150 M450 166 V240');
    S('line', { x1: 428, y1: 150, x2: 472, y2: 150, stroke: C.orange, 'stroke-width': 4 }, svg);
    S('path', { d: 'M428 168 Q450 160 472 168', fill: 'none', stroke: C.orange, 'stroke-width': 4 }, svg);
    txt(svg, 480, 140, '+', { fill: C.orange, size: 14, anchor: 'start', weight: 700 });
    txt(svg, 486, 164, 'C1', { fill: C.orange, size: 12, anchor: 'start', weight: 600 });
    gnd(svg, 450, 240);
    wire(svg, 'M172 250 H200 V258'); gnd(svg, 200, 258);
    // nó → A0
    wire(svg, 'M172 190 H380 V90');
    S('circle', { cx: 380, cy: 90, r: 5, fill: C.text2 }, svg);
    txt(svg, 392, 210, 'leitura de VC', { size: 11, anchor: 'start' });

    // Barra de carga ao lado do capacitor
    S('rect', { x: 330, y: 228, width: 80, height: 10, rx: 5, fill: '#1d1729', stroke: C.wire }, svg);
    const bar = S('rect', { x: 330, y: 228, width: 0, height: 10, rx: 5, fill: C.orange }, svg);
    txt(svg, 370, 256, 'VC / VS', { size: 10 });

    const hint = document.getElementById('schemHint');
    const CH = 6000, DIS = 2000, TAU = 1000; // animação: 6 τ de carga, 2 s de descarga (τ = 1 s)
    const t0 = performance.now();
    (function loop(now) {
      const ph = (now - t0) % (CH + DIS);
      const charging = ph < CH;
      const frac = charging ? 1 - Math.exp(-ph / TAU) : (1 - Math.exp(-CH / TAU)) * Math.exp(-(ph - CH) / 300);
      bar.setAttribute('width', 80 * frac);
      d8.setAttribute('stroke', charging ? C.mint : C.wire);
      hint.textContent = charging
        ? `D8 em HIGH · t = ${fmt(ph / TAU, 1)} τ · VC = ${fmt(5 * frac, 2)} V (${fmt(100 * frac, 0)} % de VS)`
        : `D8 em LOW · descarregando · VC = ${fmt(5 * frac, 2)} V`;
      requestAnimationFrame(loop);
    })(t0);
  }

  /* ---------------- Copiar / baixar ---------------- */
  function download(name, data, type = 'text/plain') {
    const a = document.createElement('a');
    a.href = data instanceof Blob ? URL.createObjectURL(data) : URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const codeText = id => document.getElementById(id).textContent;
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const t = codeText(b.dataset.copy);
    try { await navigator.clipboard.writeText(t); }
    catch (_) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    const old = b.textContent; b.textContent = 'Copiado!'; setTimeout(() => (b.textContent = old), 1400);
  }));
  document.querySelectorAll('[data-download]').forEach(b => b.addEventListener('click', () => download(b.dataset.name, codeText(b.dataset.download))));

  /* ---------------- Calculadora RC ---------------- */
  const cIds = ['cR', 'cRu', 'cC', 'cCu', 'cVs', 'cT', 'cV'];
  const cEl = Object.fromEntries(cIds.map(id => [id, document.getElementById(id)]));
  function calc() {
    const R = num(cEl.cR.value) * num(cEl.cRu.value);
    const Cf = num(cEl.cC.value) * num(cEl.cCu.value);
    const vs = num(cEl.cVs.value), t = num(cEl.cT.value), v = num(cEl.cV.value);
    const tau = +(R * Cf * 1000).toPrecision(12); // ms
    const vt = vs * (1 - Math.exp(-t / tau));
    const tv = v > 0 && v < vs ? -tau * Math.log(1 - v / vs) : NaN;
    document.getElementById('outTau').innerHTML =
      `τ = R × C<b>${fmtTime(tau)}</b><span>= ${fmtSig(tau)} ms · carga completa em 5 τ = ${fmtTime(5 * tau)}</span>`;
    document.getElementById('outVt').innerHTML =
      `V<sub>C</sub> no instante t = ${fmtTime(t)}<b>${fmt(vt, 3)} V</b><span>${fmt(100 * vt / vs, 1)} % de V<sub>S</sub> · esse instante equivale a ${fmt(t / tau, 2)} τ</span>`;
    document.getElementById('outTv').innerHTML = Number.isFinite(tv)
      ? `Instante em que V<sub>C</sub> = ${fmt(v, 2)} V<b>${fmtTime(tv)}</b><span>equivale a ${fmt(tv / tau, 2)} τ</span>`
      : `Instante em que V<sub>C</sub> = ${fmt(v, 2)} V<b>nunca</b><span>V precisa ser menor que V<sub>S</sub></span>`;
  }
  cIds.forEach(id => cEl[id].addEventListener('input', calc));
  calc();

  /* ---------------- Estado do relatório ---------------- */
  const form = document.getElementById('labForm');
  const F = form.elements;
  const state = { data: [], lockedAt: null, firstLockAt: null, edits: [], dirty: false, firstDataAt: null };

  const theory = () => {
    const R = num(F.ctx_r.value), Cu = num(F.ctx_c.value), vs = num(F.ctx_vs.value);
    const tau = +(R * Cu * 1e-3).toPrecision(12); // Ω · µF → ms
    return { R, Cu, vs, tau, ok: tau > 0 && vs > 0 };
  };
  const vTheory = (t, th) => th.vs * (1 - Math.exp(-t / th.tau));
  const sortedData = () => state.data.filter(p => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);

  function collect() {
    const o = {};
    for (const el of F) {
      if (!el.name) continue;
      if (el.type === 'checkbox') o[el.name] = el.checked ? 'sim' : 'não';
      else o[el.name] = el.value.trim();
    }
    return o;
  }
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (_) {}
    }, 300);
  }
  const snapshot = () => ({ fields: collect(), data: state.data, lockedAt: state.lockedAt, firstLockAt: state.firstLockAt, edits: state.edits, dirty: state.dirty, firstDataAt: state.firstDataAt });
  function restore(snap) {
    let d = snap || null;
    if (!d) try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!d) return;
    for (const el of F) {
      if (!el.name || !d.fields || !(el.name in d.fields)) continue;
      if (el.type === 'checkbox') el.checked = d.fields[el.name] === 'sim';
      else el.value = d.fields[el.name];
    }
    state.data = Array.isArray(d.data) ? d.data : [];
    state.lockedAt = d.lockedAt || null;
    state.firstLockAt = d.firstLockAt || d.lockedAt || null;
    state.edits = d.edits || [];
    state.dirty = !!d.dirty;
    state.firstDataAt = d.firstDataAt || null;
  }

  // Confirmação em dois cliques no próprio botão (confirm() é bloqueado em alguns previews)
  function twoStep(btn, armedLabel, fn) {
    if (btn.dataset.armed) {
      clearTimeout(btn._armT); delete btn.dataset.armed; btn.textContent = btn.dataset.orig; fn(); return;
    }
    btn.dataset.armed = '1'; btn.dataset.orig = btn.textContent; btn.textContent = armedLabel;
    btn._armT = setTimeout(() => { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; }, 4000);
  }

  /* ---------------- 1 · Previsão (registro com horário; os campos nunca travam) ---------------- */
  const stepCtx = document.getElementById('stepCtx');
  const ctxInputs = [...stepCtx.querySelectorAll('input, textarea, select')];
  const btnLock = document.getElementById('btnLock');
  const lockStatus = document.getElementById('lockStatus');

  function applyLock() {
    const reg = !!state.lockedAt, ok = reg && !state.dirty;
    btnLock.textContent = reg ? 'Registrar de novo' : 'Registrar previsão';
    btnLock.className = ok ? 'btn ghost' : 'btn orange';
    lockStatus.className = 'lock-status' + (ok ? ' on' : '');
    lockStatus.textContent = !reg ? 'Previsão ainda não registrada.'
      : state.dirty ? `! Previsão alterada depois do registro de ${nowStr(state.lockedAt)}. Clique em Registrar de novo (a alteração fica no relatório).`
      : `✓ Previsão registrada em ${nowStr(state.lockedAt)}.${state.edits.length ? ` Alterada ${state.edits.length}× depois do primeiro registro.` : ''}`;
  }
  btnLock.addEventListener('click', () => {
    const bad = ctxInputs.filter(el => !el.checkValidity());
    if (bad.length) {
      stepCtx.classList.add('was-validated');
      bad[0].focus();
      lockStatus.className = 'lock-status';
      lockStatus.textContent = `Preencha os ${bad.length} campo(s) obrigatório(s) destacados antes de registrar.`;
      return;
    }
    state.lockedAt = new Date().toISOString();
    if (!state.firstLockAt) state.firstLockAt = state.lockedAt;
    state.dirty = false;
    applyLock(); updateAll(); save();
  });
  stepCtx.addEventListener('input', () => {
    if (state.lockedAt && !state.dirty) { state.dirty = true; state.edits.push(new Date().toISOString()); applyLock(); }
  });

  function ctxCheck() {
    const th = theory(), out = [];
    if (th.ok) {
      const tauAluno = num(F.ctx_tau.value), vAluno = num(F.ctx_v_tau.value);
      const v1 = vTheory(th.tau, th);
      if (Number.isFinite(tauAluno)) {
        const ok = Math.abs(tauAluno - th.tau) <= 0.01 * th.tau;
        out.push(ok ? `<span class="ok">✓ τ confere com R · C = ${fmtTime(th.tau)}</span>`
                    : `<span class="bad">! Seu τ (${fmtTime(tauAluno)}) não é igual a R × C com os valores de R e C acima. τ não é um instante da curva: multiplique R (Ω) por C (µF), o resultado sai em µs; divida por 1000 para ms.</span>`);
      }
      if (Number.isFinite(vAluno)) {
        const ok = Math.abs(vAluno - v1) <= 0.02 * th.vs;
        out.push(ok ? '<span class="ok">✓ Tensão esperada em t = τ confere com 0,632 · VS</span>'
                    : `<span class="bad">! A tensão em t = τ deve ser VS × (1 − e⁻¹) ≈ 0,632 × VS.${vAluno > 0 && vAluno < th.vs ? ` O valor informado (${fmt(vAluno, 3)} V) corresponde a t = ${fmt(-Math.log(1 - vAluno / th.vs), 2)} τ, não a t = 1 τ.` : ''}</span>`);
      }
      if (th.tau < 500 || th.tau > 5000) out.push(`<span class="bad">! τ = ${fmtTime(th.tau)} está fora da faixa recomendada (0,5 s a 5 s).</span>`);
    }
    document.getElementById('ctxCheck').innerHTML = out.join('');
  }

  /* ---------------- 3 · Tabela de dados ---------------- */
  const tbody = document.querySelector('#dataTable tbody');
  function markFirstData() {
    if (!state.firstDataAt && sortedData().length) state.firstDataAt = new Date().toISOString();
  }
  function renderTable() {
    tbody.innerHTML = '';
    state.data.forEach((p, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td>
        <td><input inputmode="decimal" data-i="${i}" data-k="t" value="${Number.isFinite(p.t) ? String(p.t).replace('.', ',') : ''}" aria-label="tempo do ponto ${i + 1} em ms"></td>
        <td><input inputmode="decimal" data-i="${i}" data-k="v" value="${Number.isFinite(p.v) ? String(p.v).replace('.', ',') : ''}" aria-label="tensão do ponto ${i + 1} em V"></td>
        <td class="vt"></td><td class="dv"></td>
        <td><button type="button" class="del" data-del="${i}" aria-label="remover ponto ${i + 1}">×</button></td>`;
      tbody.appendChild(tr);
    });
    updateRows();
  }
  function updateRows() {
    const th = theory();
    [...tbody.rows].forEach((tr, i) => {
      const p = state.data[i];
      const vt = th.ok && Number.isFinite(p.t) ? vTheory(p.t, th) : NaN;
      tr.querySelector('.vt').textContent = fmt(vt, 3);
      tr.querySelector('.dv').textContent = Number.isFinite(vt) && Number.isFinite(p.v) ? fmt(p.v - vt, 3) : '—';
      tr.classList.toggle('early', th.ok && p.t <= th.tau);
    });
  }
  tbody.addEventListener('input', e => {
    const el = e.target; if (!el.dataset.k) return;
    state.data[+el.dataset.i][el.dataset.k] = num(el.value);
    markFirstData(); updateRows(); updateAll(); save();
  });
  tbody.addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    state.data.splice(+b.dataset.del, 1); renderTable(); updateAll(); save();
  });
  document.getElementById('btnAddRow').addEventListener('click', () => {
    state.data.push({ t: NaN, v: NaN }); renderTable();
    const ins = tbody.querySelectorAll('input'); ins[ins.length - 2].focus();
  });
  document.getElementById('btnClearData').addEventListener('click', e => {
    if (!state.data.length) return;
    twoStep(e.currentTarget, 'Clique de novo para apagar', () => { state.data = []; renderTable(); updateAll(); save(); });
  });
  function parsePaste(text) {
    const pts = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      let parts;
      if (/[;\t]/.test(line)) parts = line.split(/[;\t]/).map(s => s.trim().replace(',', '.'));
      else if ((line.match(/,/g) || []).length === 1) parts = line.split(',');
      else parts = line.split(/\s+/);
      const t = num(parts[0]), v = num(parts[1]);
      if (Number.isFinite(t) && Number.isFinite(v)) pts.push({ t, v });
    }
    return pts;
  }
  document.getElementById('btnImport').addEventListener('click', e => {
    const box = document.getElementById('pasteBox');
    const pts = parsePaste(box.value);
    if (!pts.length) {
      document.getElementById('dataCheck').innerHTML = '<span class="bad">! Nenhum ponto reconhecido. Use uma linha por ponto: tempo em ms e tensão em V.</span>';
      return;
    }
    const go = () => { state.data = pts; box.value = ''; markFirstData(); renderTable(); updateAll(); save(); };
    if (state.data.length) twoStep(e.currentTarget, `Clique de novo: substituir ${state.data.length} pontos por ${pts.length}`, go);
    else go();
  });

  function dataCheck() {
    const th = theory(), pts = sortedData(), out = [];
    if (!pts.length) { document.getElementById('dataCheck').innerHTML = ''; return; }
    if (!state.lockedAt) out.push('<span class="bad">! Você está registrando dados sem a previsão registrada. Previsão entregue depois da medição recebe zero.</span>');
    out.push(`<span>${pts.length} pontos · de ${fmtTime(pts[0].t)} a ${fmtTime(pts[pts.length - 1].t)}</span>`);
    if (th.ok) {
      const early = pts.filter(p => p.t <= th.tau).length;
      out.push(`<span class="${early >= 10 ? 'ok' : 'bad'}">${early >= 10 ? '✓' : '!'} ${early} pontos até 1 τ teórico (${fmt(100 * early / pts.length, 0)} % do total)${early < 10 ? ': concentre mais pontos no trecho inicial' : ''}</span>`);
      const last = pts[pts.length - 1].t;
      if (last < 3 * th.tau) out.push(`<span class="bad">! A coleta termina em ${fmt(last / th.tau, 1)} τ; vá até pelo menos 3 τ (ideal 5 τ) para ver a curva estabilizar.</span>`);
    }
    if (pts.length < 15) out.push('<span class="bad">! Poucos pontos para descrever a curva.</span>');
    document.getElementById('dataCheck').innerHTML = out.join('');
  }

  /* ---------------- 4 · τ experimental ---------------- */
  function tauExperimental() {
    const th = theory();
    const vsMed = num(F.cons_vs_med.value);
    const vs = vsMed > 0 ? vsMed : th.vs;
    const pts = sortedData();
    const res = { vs, vsFrom: vsMed > 0 ? 'medida' : 'nominal', lin: NaN, r2: NaN, nLin: 0, p63: NaN };
    if (!(vs > 0) || pts.length < 3) return res;
    // Método 2: y = −ln(1 − V/Vs) = t/τ, reta pela origem
    const use = pts.filter(p => p.t > 0 && p.v > 0.02 * vs && p.v < 0.95 * vs);
    if (use.length >= 3) {
      let stt = 0, sty = 0;
      const ys = use.map(p => -Math.log(1 - p.v / vs));
      use.forEach((p, i) => { stt += p.t * p.t; sty += p.t * ys[i]; });
      const k = sty / stt; res.lin = 1 / k; res.nLin = use.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let ssr = 0, sst = 0;
      use.forEach((p, i) => { ssr += (ys[i] - k * p.t) ** 2; sst += (ys[i] - my) ** 2; });
      res.r2 = sst > 0 ? 1 - ssr / sst : NaN;
    }
    // Método 1: cruzamento de 0,632 · Vs
    const alvo = (1 - Math.exp(-1)) * vs;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.v < alvo && b.v >= alvo) { res.p63 = a.t + (alvo - a.v) * (b.t - a.t) / (b.v - a.v); break; }
    }
    return res;
  }
  function confrontOut(ex) {
    const th = theory();
    document.getElementById('tauOut').innerHTML = `
      <div class="out">τ teórico (R · C)<b>${th.ok ? fmtTime(th.tau) : '—'}</b><span>da previsão</span></div>
      <div class="out">τ exp · linearização<b>${fmtTime(ex.lin)}</b><span>${ex.nLin ? `${ex.nLin} pontos · R² = ${fmt(ex.r2, 4)}` : 'precisa de 3 pontos abaixo de 95 % de VS'}</span></div>
      <div class="out">τ exp · ponto de 63,2 %<b>${fmtTime(ex.p63)}</b><span>${Number.isFinite(ex.p63) ? `VC = ${fmt(0.632 * ex.vs, 3)} V` : 'os dados não cruzam 0,632 · VS'}</span></div>
      <div class="out">V<sub>S</sub> usada no cálculo<b>${fmt(ex.vs, 3)} V</b><span>${ex.vsFrom === 'medida' ? 'medida na bancada' : 'nominal: informe a medida no Construir'}</span></div>`;
    const tauA = num(F.conf_tau_exp.value), tol = num(F.ctx_tol.value), out = [];
    if (th.ok && tauA > 0) {
      const div = 100 * (tauA - th.tau) / th.tau;
      const inside = Number.isFinite(tol) ? Math.abs(div) <= tol : null;
      out.push(`<span class="${inside === false ? 'bad' : 'ok'}">Divergência: (τexp − τteo) / τteo = ${div >= 0 ? '+' : ''}${fmt(div, 1)} %${inside === null ? '' : inside ? ` · dentro da tolerância de ${fmt(tol, 0)} %` : ` · fora da tolerância de ${fmt(tol, 0)} %`}</span>`);
      const ref = [ex.lin, ex.p63].filter(Number.isFinite);
      if (ref.length && !ref.some(r => Math.abs(tauA - r) <= 0.05 * r))
        out.push('<span class="bad">! O τ adotado não corresponde a nenhum dos valores extraídos dos dados. Explique como chegou nele.</span>');
      if (Math.abs(tauA - th.tau) < 1e-9) out.push('<span class="bad">! O τ adotado é idêntico ao teórico: ele precisa sair dos dados, não da teoria.</span>');
    }
    document.getElementById('divCheck').innerHTML = out.join('');
  }

  /* ---------------- Gráficos ---------------- */
  const THEMES = {
    dark: { bg: '#1d1729', grid: 'rgba(255,255,255,.07)', axis: '#8c84a3', text: '#dedde6', muted: '#a9a3bd', theory: '#80e6c6', exp: '#ff9148', fit: '#7caaff' },
    light: { bg: '#ffffff', grid: '#e8e8ee', axis: '#8a8a96', text: '#1f1f28', muted: '#5f5f6e', theory: '#0f8a6a', exp: '#d95f0e', fit: '#2f5fbf' }
  };
  function niceStep(range, n) {
    const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function drawChart(ctx, W, H, o) {
    const T = THEMES[o.theme], th = o.th, pts = o.pts || [];
    const pad = { l: 64, r: 22, t: o.title ? 78 : 50, b: 54 };
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    ctx.font = '12px "IBM Plex Mono", monospace';
    if (!th.ok) {
      ctx.fillStyle = T.muted; ctx.textAlign = 'center';
      ctx.fillText('Preencha R, C e VS no Contextualizar para ver a curva teórica.', W / 2, H / 2);
      return null;
    }
    const tMax = Math.max(5 * th.tau, pts.length ? pts[pts.length - 1].t : 0) * 1.02;
    const vMax = Math.max(th.vs, ...pts.map(p => p.v), o.vsExp || 0) * 1.1;
    const useS = tMax >= 3000, tDiv = useS ? 1000 : 1;
    const X = t => pad.l + (t / tMax) * (W - pad.l - pad.r);
    const Y = v => H - pad.b - (v / vMax) * (H - pad.t - pad.b);

    // grade e ticks
    ctx.lineWidth = 1; ctx.strokeStyle = T.grid; ctx.fillStyle = T.muted;
    const ts = niceStep(tMax / tDiv, 8) * tDiv;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let t = 0; t <= tMax + 1e-9; t += ts) {
      ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), H - pad.b); ctx.stroke();
      ctx.fillText(fmt(t / tDiv, Math.max(0, -Math.floor(Math.log10(ts / tDiv) + 1e-9))), X(t), H - pad.b + 6);
    }
    const vs_ = niceStep(vMax, 6);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= vMax + 1e-9; v += vs_) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(fmt(v, Math.max(0, -Math.floor(Math.log10(vs_) + 1e-9))), pad.l - 8, Y(v));
    }
    ctx.strokeStyle = T.axis; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();

    // rótulos dos eixos
    ctx.fillStyle = T.text; ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`Tempo t (${useS ? 's' : 'ms'})`, (pad.l + W - pad.r) / 2, H - 8);
    ctx.save(); ctx.translate(16, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top';
    ctx.fillText('Tensão no capacitor VC (V)', 0, 0); ctx.restore();
    if (o.title) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '600 15px "IBM Plex Sans", sans-serif'; ctx.fillText(o.title, pad.l, 12); }

    // guias de τ
    const v63 = vTheory(th.tau, th);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = T.muted; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(th.tau), H - pad.b); ctx.lineTo(X(th.tau), Y(v63)); ctx.lineTo(pad.l, Y(v63)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.muted; ctx.font = '12px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`τteo = ${fmtTime(th.tau)} · ${fmt(v63, 2)} V`, X(th.tau) + 6, Y(v63) + 16 + 4);

    const curve = (f, color, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) { const t = tMax * i / 240; i ? ctx.lineTo(X(t), Y(f(t))) : ctx.moveTo(X(t), Y(f(t))); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    curve(t => vTheory(t, th), T.theory);
    if (o.tauExp > 0) curve(t => o.vsExp * (1 - Math.exp(-t / o.tauExp)), T.fit, [7, 5]);
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(X(p.t), Y(p.v), 4, 0, 2 * Math.PI);
      ctx.fillStyle = T.exp; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.bg; ctx.stroke();
    });

    // legenda
    const items = [['line', T.theory, `Teórica: VS(1 − e^(−t/τ)), τ = ${fmtTime(th.tau)}`]];
    if (pts.length) items.push(['dot', T.exp, `Experimental (${pts.length} pontos)`]);
    if (o.tauExp > 0) items.push(['dash', T.fit, `Ajuste aos dados, τ = ${fmtTime(o.tauExp)}`]);
    let lx = pad.l, ly = pad.t - 26;
    ctx.font = '12px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    items.forEach(([kind, col, label]) => {
      const w = 28 + ctx.measureText(label).width + 20;
      if (lx + w > W - pad.r && lx > pad.l) { lx = pad.l; ly += 18; }
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      if (kind === 'dot') { ctx.beginPath(); ctx.arc(lx + 10, ly, 4, 0, 2 * Math.PI); ctx.fill(); }
      else { ctx.setLineDash(kind === 'dash' ? [5, 3] : []); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 20, ly); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = T.text; ctx.fillText(label, lx + 28, ly);
      lx += w;
    });

    // cursor
    if (Number.isFinite(o.hoverT)) {
      ctx.strokeStyle = T.text; ctx.globalAlpha = .4; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(o.hoverT), pad.t); ctx.lineTo(X(o.hoverT), H - pad.b); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(X(o.hoverT), Y(vTheory(o.hoverT, th)), 4, 0, 2 * Math.PI); ctx.fillStyle = T.theory; ctx.fill();
      if (o.hoverP) { ctx.beginPath(); ctx.arc(X(o.hoverP.t), Y(o.hoverP.v), 7, 0, 2 * Math.PI); ctx.strokeStyle = T.exp; ctx.lineWidth = 2; ctx.stroke(); }
    }
    return { X, Y, tMax, pad, W };
  }

  function chartOpts(withData) {
    const th = theory();
    const ex = tauExperimental();
    const tauA = num(F.conf_tau_exp.value);
    return { th, pts: withData ? sortedData() : [], tauExp: withData && tauA > 0 ? tauA : NaN, vsExp: ex.vs, theme: 'dark' };
  }
  function paintCanvas(cv, o) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = +cv.getAttribute('height');
    cv.style.height = H + 'px';
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return drawChart(ctx, W, H, o);
  }
  const cvTheory = document.getElementById('chartTheory');
  const cvMain = document.getElementById('chartMain');
  const chartHint = document.getElementById('chartHint');
  let geo = null, hover = null;
  function drawCharts() {
    paintCanvas(cvTheory, chartOpts(false));
    geo = paintCanvas(cvMain, Object.assign(chartOpts(true), hover || {}));
  }
  cvMain.addEventListener('pointermove', e => {
    if (!geo) return;
    const r = cvMain.getBoundingClientRect(), x = e.clientX - r.left;
    const t = (x - geo.pad.l) / (geo.W - geo.pad.l - geo.pad.r) * geo.tMax;
    if (t < 0 || t > geo.tMax) { cvMain.dispatchEvent(new Event('pointerleave')); return; }
    const th = theory(), pts = sortedData();
    let near = null;
    pts.forEach(p => { if (!near || Math.abs(p.t - t) < Math.abs(near.t - t)) near = p; });
    if (near && Math.abs(geo.X(near.t) - x) > 14) near = null;
    hover = { hoverT: near ? near.t : t, hoverP: near };
    const tt = hover.hoverT;
    chartHint.textContent = `t = ${fmtTime(tt)} (${fmt(tt / th.tau, 2)} τ) · teórico ${fmt(vTheory(tt, th), 3)} V`
      + (near ? ` · medido ${fmt(near.v, 3)} V · desvio ${fmt(near.v - vTheory(near.t, th), 3)} V` : '');
    drawCharts();
  });
  cvMain.addEventListener('pointerleave', () => { hover = null; chartHint.textContent = 'Passe o mouse sobre o gráfico para ler os valores.'; drawCharts(); });
  window.addEventListener('resize', drawCharts);

  function pngBlob() {
    const o = chartOpts(true), th = o.th;
    o.theme = 'light';
    o.title = th.ok ? `Carga do capacitor · R = ${fmtSig(th.R)} Ω · C = ${fmtSig(th.Cu)} µF · VS = ${fmt(th.vs, 2)} V` : 'Carga do capacitor';
    const cv = document.createElement('canvas'); cv.width = 2400; cv.height = 1400;
    const ctx = cv.getContext('2d'); ctx.scale(2, 2);
    drawChart(ctx, 1200, 700, o);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  const savePng = async () => download('grafico-rc.png', await pngBlob());
  document.getElementById('btnPng').addEventListener('click', savePng);
  document.getElementById('btnPng2').addEventListener('click', savePng);

  /* ---------------- Atualização geral ---------------- */
  // Código: TEMPO_TOTAL_MS = 5 × τ previsto
  const codeSrc = document.getElementById('codeSrc');
  function updateCode() {
    const th = theory(), tau = th.ok ? th.tau : 1000;
    document.getElementById('kTot').textContent = String(Math.max(10, Math.round(5 * tau)));
    codeSrc.textContent = th.ok ? `TEMPO_TOTAL_MS = 5 × τ previsto (${fmtTime(th.tau)})` : 'tempo de exemplo (τ = 1 s): preencha R e C no Contextualizar';
  }

  function updateAll() { updateCode(); ctxCheck(); updateRows(); dataCheck(); confrontOut(tauExperimental()); drawCharts(); }
  form.addEventListener('input', e => { if (!e.target.closest('#dataTable') && e.target.id !== 'pasteBox') { updateAll(); save(); } });

  /* ---------------- Relatório (Markdown) ---------------- */
  const status = document.getElementById('formStatus');
  function markdown() {
    const d = collect(), th = theory(), ex = tauExperimental(), pts = sortedData();
    const L = t => (t && t !== 'não' ? t.replace(/\n+/g, ' ') : '—');
    const tauA = num(d.conf_tau_exp);
    const div = th.ok && tauA > 0 ? 100 * (tauA - th.tau) / th.tau : NaN;
    const tol = num(d.ctx_tol);
    const ordem = !state.lockedAt ? '**previsão não registrada**'
      : !state.firstDataAt ? 'sem dados'
      : (new Date(state.lockedAt) <= new Date(state.firstDataAt) && !state.dirty) ? 'previsão registrada **antes** do primeiro dado'
      : '**atenção: previsão registrada ou alterada depois do primeiro dado**';
    const rows = pts.map((p, i) => `| ${i + 1} | ${fmt(p.t, 0)} | ${fmt(p.v, 3)} | ${th.ok ? fmt(vTheory(p.t, th), 3) : '—'} | ${th.ok ? fmt(p.v - vTheory(p.t, th), 3) : '—'} |`).join('\n');
    return `# Relatório — Ponderada 1 · Circuito RC de carga

**Aluno:** ${L(d.nome)} · ${L(d.email)}
**Turma:** ${L(d.turma)} · **Bancada:** ${L(d.bancada)}
**Previsão registrada em:** ${state.firstLockAt ? nowStr(state.firstLockAt) : '—'}${state.lockedAt && state.lockedAt !== state.firstLockAt ? ` · último registro: ${nowStr(state.lockedAt)}` : ''}${state.edits.length ? ` · alterada em: ${state.edits.map(nowStr).join('; ')}` : ''}${state.dirty ? ' · **alteração final não registrada**' : ''}
**Primeiro dado registrado em:** ${state.firstDataAt ? nowStr(state.firstDataAt) : '—'} · ${ordem}

## 1. Contextualizar (previsão)
| Grandeza | Valor |
|---|---|
| R nominal | ${L(d.ctx_r)} Ω |
| C nominal | ${L(d.ctx_c)} µF |
| Tolerância de fábrica | ${L(d.ctx_tol_comp)} |
| Tensão da fonte V_S | ${L(d.ctx_vs)} V |
| τ teórico (aluno) | ${L(d.ctx_tau)} ms |
| Conta | ${L(d.ctx_tau_calc)} |
| V_C esperada em t = τ | ${L(d.ctx_v_tau)} V |
| Tolerância aceitável | ${L(d.ctx_tol)} % |

**Justificativa da tolerância:** ${L(d.ctx_tol_just)}

Curva esperada: V_C(t) = ${L(d.ctx_vs)} · (1 − e^(−t / ${L(d.ctx_tau)} ms)). A curva teórica aparece no gráfico da etapa 4.

## 2. Consultar
- **Ferramenta:** ${L(d.con_ferramenta)}
- **Pergunta (exata):** ${L(d.con_pergunta)}
- **O que acrescentou:** ${L(d.con_acrescentou)}

## 3. Construir (dados da bancada)
- **Instrumento:** ${L(d.cons_instrumento)}
- **V_S medida (final estabilizada):** ${d.cons_vs_med ? d.cons_vs_med + ' V' : '—'}
- **Pontos:** ${pts.length}${th.ok ? ` · ${pts.filter(p => p.t <= th.tau).length} até 1 τ teórico` : ''}

| # | t (ms) | V_C medido (V) | V_C teórico (V) | Desvio (V) |
|---:|---:|---:|---:|---:|
${rows || '| — | — | — | — | — |'}

## 4. Confrontar
![Curva teórica e pontos experimentais](grafico-rc.png)

| | τ |
|---|---|
| Teórico (R · C) | ${th.ok ? fmtTime(th.tau) : '—'} |
| Experimental · linearização (${ex.nLin} pontos, R² = ${fmt(ex.r2, 4)}) | ${fmtTime(ex.lin)} |
| Experimental · ponto de 63,2 % | ${fmtTime(ex.p63)} |
| **Experimental adotado** | **${Number.isFinite(tauA) ? fmtTime(tauA) : '—'}** |

- **V_S usada no cálculo:** ${fmt(ex.vs, 3)} V (${ex.vsFrom})
- **Método:** ${L(d.conf_metodo)}
- **Como obtive:** ${L(d.conf_como)}
- **Divergência:** ${Number.isFinite(div) ? `${div >= 0 ? '+' : ''}${fmt(div, 1)} %` : '—'}${Number.isFinite(div) && Number.isFinite(tol) ? (Math.abs(div) <= tol ? ` (dentro da tolerância de ${fmt(tol, 0)} %)` : ` (fora da tolerância de ${fmt(tol, 0)} %)`) : ''}

## 5. Comprovar
**Análise da divergência:** ${L(d.comp_analise)}

| Causa física | Teste que a confirmaria |
|---|---|
| ${L(d.comp_c1)} | ${L(d.comp_t1)} |
| ${L(d.comp_c2)} | ${L(d.comp_t2)} |
${d.comp_c3 ? `| ${L(d.comp_c3)} | ${L(d.comp_t3)} |\n` : ''}
### Pergunta de transferência (sem consulta)
- **Pergunta:** ${L(d.comp_transf_q)}
- **Resposta:** ${L(d.comp_transf_r)}

Declaro que as medições são da bancada e que respondi a pergunta de transferência sem consulta: ${d.decl}
`;
  }
  document.getElementById('btnMd').addEventListener('click', () => {
    form.classList.add('was-validated');
    const bad = [...F].filter(el => el.name && !el.checkValidity()).length;
    const avisos = [];
    if (bad) avisos.push(`${bad} campo(s) obrigatório(s) em branco (destacados em vermelho)`);
    if (!state.lockedAt) avisos.push('previsão não registrada');
    if (sortedData().length < 3) avisos.push('tabela de dados vazia ou incompleta');
    status.hidden = !avisos.length;
    status.textContent = avisos.length ? `Relatório baixado com pendências: ${avisos.join('; ')}.` : '';
    download('RELATORIO.md', markdown(), 'text/markdown');
  });
  let undoSnap = null, undoT;
  document.getElementById('btnClear').addEventListener('click', () => {
    clearTimeout(saveT);
    undoSnap = snapshot();
    form.reset(); form.classList.remove('was-validated'); stepCtx.classList.remove('was-validated');
    Object.assign(state, { data: [], lockedAt: null, firstLockAt: null, edits: [], dirty: false, firstDataAt: null });
    try { localStorage.removeItem(KEY); } catch (_) {}
    applyLock(); renderTable(); updateAll();
    status.hidden = false;
    status.innerHTML = '<div>Rascunho apagado. <button type="button" class="btn ghost" id="btnUndo">Desfazer</button></div>';
    clearTimeout(undoT);
    undoT = setTimeout(() => { status.hidden = true; undoSnap = null; }, 10000);
  });
  status.addEventListener('click', e => {
    if (!e.target.closest('#btnUndo') || !undoSnap) return;
    restore(undoSnap); undoSnap = null; status.hidden = true;
    applyLock(); renderTable(); updateAll(); save();
  });

  restore(); applyLock(); renderTable(); updateAll();
  if (document.fonts) document.fonts.ready.then(drawCharts);
})();
