/* Base comum das páginas de ponderada do acervo (ADR-012).
   Extraída do padrão da Ponderada 1 (Prof. Roberto Cândido): rascunho no navegador, previsão
   registrada com horário, verificações em linha, gráfico em canvas e relatório em Markdown.
   Cores e fontes são lidas dos tokens de assets/css/inteli-brand.css, porque canvas e atributos
   SVG não resolvem var(). Expõe window.Ponderada; cada página usa só o que precisa. */
(function () {
  const raiz = document.documentElement;
  const tok = nome => getComputedStyle(raiz).getPropertyValue(nome).trim();

  const C = {
    roxo: tok('--seg-primaria'), verde: tok('--seg-secundaria'), coral: tok('--seg-destaque'),
    branco: tok('--inteli-branco'), claro: tok('--inteli-cinza-claro'), medio: tok('--inteli-cinza-medio'),
    escuro: tok('--inteli-cinza-escuro')
  };
  const FM = tok('--fonte-mono'), FT = tok('--fonte-texto');
  const VAZIO = 'n/d';

  // Números: aceita vírgula decimal; exibe em pt-BR
  const num = s => { const v = parseFloat(String(s ?? '').trim().replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
  const fmt = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : VAZIO;
  const fmtSig = v => {
    if (!Number.isFinite(v)) return VAZIO;
    const a = Math.abs(v);
    return fmt(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
  };
  const quando = iso => new Date(iso).toLocaleString('pt-BR');
  // Texto de campo para o relatório: vazio vira n/d, quebras de linha viram espaço.
  const L = t => (t && String(t).trim() ? String(t).trim().replace(/\n+/g, ' ') : VAZIO);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, pai) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (pai) pai.appendChild(e);
    return e;
  }

  const ICONE_OK = '<span class="material-symbols-outlined" aria-hidden="true">check</span>';
  const ok = t => `<span class="ok">${ICONE_OK} ${t}</span>`;
  const ruim = t => `<span class="bad">! ${t}</span>`;
  const neutro = t => `<span>${t}</span>`;

  function baixar(nome, conteudo, tipo) {
    const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Botões de copiar e baixar do bloco de código: data-copy="id" e data-download="id" data-name="arquivo".
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      const texto = document.getElementById(c.dataset.copy).textContent;
      const rotulo = c.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject())
        .then(() => { c.textContent = 'Copiado'; }, () => { c.textContent = 'Selecione e copie'; })
        .finally(() => setTimeout(() => { c.textContent = rotulo; }, 1500));
    }
    const d = e.target.closest('[data-download]');
    if (d) baixar(d.dataset.name, document.getElementById(d.dataset.download).textContent, 'text/plain');
  });

  /* Rascunho: guarda os campos com name do formulário e um objeto de estado extra. O acesso ao
     localStorage pode falhar (janela privada, dados bloqueados), e a página segue sem rascunho. */
  function rascunho(form, chave) {
    let t;
    const campos = () => [...form.elements].filter(el => el.name);
    return {
      salvar(extra) {
        clearTimeout(t);
        t = setTimeout(() => {
          const dados = {};
          campos().forEach(el => { dados[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
          try { localStorage.setItem(chave, JSON.stringify({ dados, extra })); } catch (_) {}
        }, 250);
      },
      restaurar() {
        let salvo = null;
        try { salvo = JSON.parse(localStorage.getItem(chave) || 'null'); } catch (_) {}
        if (!salvo) return null;
        campos().forEach(el => {
          if (!(el.name in salvo.dados)) return;
          if (el.type === 'checkbox') el.checked = !!salvo.dados[el.name]; else el.value = salvo.dados[el.name];
        });
        return salvo.extra || null;
      },
      apagar() { clearTimeout(t); try { localStorage.removeItem(chave); } catch (_) {} }
    };
  }

  /* Registro com horário de uma etapa que precisa vir antes da medição (previsão, modelo de
     ameaça, lista bruta da IA). Alterar um campo depois do registro marca a etapa como alterada,
     e o relatório mostra o histórico. */
  function trava({ etapa, botao, status, rotulo, aoMudar }) {
    const s = { registradoEm: null, primeiroEm: null, alteracoes: [], alterado: false };
    const campos = () => [...etapa.querySelectorAll('input, textarea, select')].filter(el => el.name);
    function aplicar() {
      const reg = !!s.registradoEm, valido = reg && !s.alterado;
      botao.textContent = reg ? 'Registrar de novo' : `Registrar ${rotulo}`;
      botao.className = valido ? 'btn ghost' : 'btn orange';
      status.className = 'lock-status' + (valido ? ' on' : '');
      status.textContent = !reg ? `${rotulo[0].toUpperCase() + rotulo.slice(1)} ainda não registrado(a).`
        : s.alterado ? `! Alterado(a) depois do registro de ${quando(s.registradoEm)}. Clique em Registrar de novo (a alteração fica no relatório).`
        : `Registrado(a) em ${quando(s.registradoEm)}.${s.alteracoes.length ? ` Alterado(a) ${s.alteracoes.length} vez(es) depois do primeiro registro.` : ''}`;
    }
    botao.addEventListener('click', () => {
      const faltam = campos().filter(el => !el.checkValidity());
      if (faltam.length) {
        etapa.classList.add('was-validated');
        faltam[0].focus();
        status.className = 'lock-status';
        status.textContent = `Preencha os ${faltam.length} campo(s) obrigatório(s) destacados antes de registrar.`;
        return;
      }
      s.registradoEm = new Date().toISOString();
      if (!s.primeiroEm) s.primeiroEm = s.registradoEm;
      s.alterado = false;
      aplicar(); if (aoMudar) aoMudar();
    });
    etapa.addEventListener('input', () => {
      if (s.registradoEm && !s.alterado) { s.alterado = true; s.alteracoes.push(new Date().toISOString()); aplicar(); if (aoMudar) aoMudar(); }
    });
    return {
      estado: () => Object.assign({}, s, { alteracoes: s.alteracoes.slice() }),
      carregar(o) { Object.assign(s, { registradoEm: null, primeiroEm: null, alteracoes: [], alterado: false }, o || {}); aplicar(); },
      registrado: () => !!s.registradoEm,
      // Linha de Markdown com o histórico do registro.
      historico() {
        if (!s.primeiroEm) return `não registrado(a)`;
        let t = quando(s.primeiroEm);
        if (s.registradoEm !== s.primeiroEm) t += ` · último registro: ${quando(s.registradoEm)}`;
        if (s.alteracoes.length) t += ` · alterado(a) em: ${s.alteracoes.map(quando).join('; ')}`;
        if (s.alterado) t += ' · **alteração final não registrada**';
        return t;
      }
    };
  }

  /* Canvas nítido em tela de alta densidade: devolve o contexto já escalado e as dimensões em CSS px. */
  function prepararCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = +cv.getAttribute('height');
    cv.style.height = H + 'px';
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H };
  }

  function passoRedondo(faixa, n) {
    const bruto = faixa / n, p = Math.pow(10, Math.floor(Math.log10(bruto))), m = bruto / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }

  /* Fundo, grade, eixos e rótulos. o = { x: [min, max], y: [min, max], rotX, rotY, titulo,
     margem, casasX, casasY, rotulosX (lista de [valor, texto]) }. Devolve os mapeadores X e Y. */
  function eixos(ctx, W, H, o) {
    const pad = Object.assign({ l: 64, r: 22, t: o.titulo ? 78 : 50, b: 54 }, o.margem || {});
    const [x0, x1] = o.x, [y0, y1] = o.y;
    const X = v => pad.l + (v - x0) / (x1 - x0) * (W - pad.l - pad.r);
    const Y = v => H - pad.b - (v - y0) / (y1 - y0) * (H - pad.t - pad.b);
    const casas = passo => Math.max(0, -Math.floor(Math.log10(passo) + 1e-9));
    ctx.fillStyle = C.branco; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1; ctx.strokeStyle = C.claro; ctx.fillStyle = C.roxo; ctx.font = `12px ${FM}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (o.rotulosX) {
      o.rotulosX.forEach(([v, t]) => { ctx.beginPath(); ctx.moveTo(X(v), pad.t); ctx.lineTo(X(v), H - pad.b); ctx.stroke(); ctx.fillText(t, X(v), H - pad.b + 6); });
    } else {
      const px = passoRedondo(x1 - x0, 8);
      for (let v = Math.ceil(x0 / px) * px; v <= x1 + 1e-9; v += px) {
        ctx.beginPath(); ctx.moveTo(X(v), pad.t); ctx.lineTo(X(v), H - pad.b); ctx.stroke();
        ctx.fillText(fmt(v, o.casasX ?? casas(px)), X(v), H - pad.b + 6);
      }
    }
    const py = passoRedondo(y1 - y0, 6);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    let largura = 0;
    for (let v = Math.ceil(y0 / py) * py; v <= y1 + 1e-9; v += py) {
      const t = fmt(v, o.casasY ?? casas(py));
      largura = Math.max(largura, ctx.measureText(t).width);
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(t, pad.l - 8, Y(v));
    }
    ctx.strokeStyle = C.escuro;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
    ctx.fillStyle = C.roxo; ctx.font = `600 13px ${FT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(o.rotX, (pad.l + W - pad.r) / 2, H - 8);
    // O título do eixo Y fica à esquerda do rótulo mais largo, para não encostar em "4.000".
    const xTitulo = Math.max(4, Math.min(16, pad.l - 8 - largura - 20));
    ctx.save(); ctx.translate(xTitulo, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top';
    ctx.fillText(o.rotY, 0, 0); ctx.restore();
    if (o.titulo) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `600 15px ${FT}`; ctx.fillText(o.titulo, pad.l, 12); }
    return { X, Y, pad };
  }

  /* Quantas linhas a legenda ocupa na largura disponível, para a página reservar a margem de cima. */
  function linhasLegenda(ctx, W, pad, itens) {
    ctx.font = `12px ${FM}`;
    let lx = pad.l, n = 1;
    itens.forEach(([, , texto]) => {
      const w = 28 + ctx.measureText(texto).width + 20;
      if (lx + w > W - pad.r && lx > pad.l) { lx = pad.l; n++; }
      lx += w;
    });
    return n;
  }

  /* Legenda acima da área do gráfico. itens = [[tipo, cor, texto]], tipo em line, dash, dot.
     Quando quebra, cresce para cima, e a última linha fica logo acima da área do gráfico. */
  function legenda(ctx, W, pad, itens) {
    let lx = pad.l, ly = pad.t - 26 - 18 * (linhasLegenda(ctx, W, pad, itens) - 1);
    ctx.font = `12px ${FM}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    itens.forEach(([tipo, cor, texto]) => {
      const w = 28 + ctx.measureText(texto).width + 20;
      if (lx + w > W - pad.r && lx > pad.l) { lx = pad.l; ly += 18; }
      ctx.strokeStyle = cor; ctx.fillStyle = cor; ctx.lineWidth = tipo === 'line' ? 3 : 2;
      if (tipo === 'dot') { ctx.beginPath(); ctx.arc(lx + 10, ly, 4, 0, 2 * Math.PI); ctx.fill(); }
      else { ctx.setLineDash(tipo === 'dash' ? [5, 3] : []); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 20, ly); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = C.roxo; ctx.fillText(texto, lx + 28, ly);
      lx += w;
    });
  }

  /* PNG do gráfico em 2x para o relatório: desenhar(ctx, W, H) recebe um canvas de 1200 x 700. */
  function png(desenhar) {
    const cv = document.createElement('canvas'); cv.width = 2400; cv.height = 1400;
    const ctx = cv.getContext('2d'); ctx.scale(2, 2);
    desenhar(ctx, 1200, 700);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }

  /* Campos obrigatórios em branco no formulário inteiro (para o aviso ao baixar o relatório). */
  function pendentes(form) {
    form.classList.add('was-validated');
    return [...form.elements].filter(el => el.name && !el.checkValidity()).length;
  }

  window.Ponderada = {
    tok, C, FM, FT, VAZIO, num, fmt, fmtSig, quando, L, esc, svg, ICONE_OK, ok, ruim, neutro,
    baixar, rascunho, trava, prepararCanvas, eixos, legenda, linhasLegenda, png, pendentes, passoRedondo
  };
})();

/* Atividade ponderada de Computação 2 - Semáforo com dois modos de operação: simulador de histerese, plano do RA, esquema do divisor,
   calibração do LDR nas três condições, verificação dos limiares e relatório.
   Usa a base comum ponderadas/comum/ponderada-base.js (ADR-012). */
(function () {
  const P = window.Ponderada;
  const { C, FM, FT, num, fmt, fmtSig, L, svg } = P;
  const ESCALA = 4095;
  const CONDICOES = ['ambiente', 'sombra', 'lanterna'];
  const NOMES = { ambiente: 'ambiente iluminado', sombra: 'sombreado pela mão', lanterna: 'lanterna' };
  const KEY = 'ponderada-semaforo-rascunho';

  const form = document.getElementById('labForm');
  const F = form.elements;
  const state = { leituras: [], prev: null, primeiraLeituraEm: null, semente: 7 };

  /* ---------------- Simulador determinístico ---------------- */
  // Gerador com semente (mulberry32) e ruído gaussiano por Box-Muller: a mesma semente dá a mesma sequência.
  function gerador(semente) {
    let a = semente >>> 0;
    const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return () => { const u1 = Math.max(u(), 1e-12), u2 = u(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  }
  // Escuro: com a leitura subindo com a luz, escuro é leitura baixa; descendo, é leitura alta.
  const escuroAlem = (v, lim, sobe) => (sobe ? v < lim : v > lim);
  const claroAlem = (v, lim, sobe) => (sobe ? v > lim : v < lim);

  function contarTransicoes(modos) {
    let n = 0;
    for (let i = 1; i < modos.length; i++) if (modos[i] !== modos[i - 1]) n++;
    return n;
  }

  /* Um minuto a 10 leituras por segundo: a luz sai do claro, cai até o escuro em 30 s e volta em
     30 s, com ruído gaussiano. o = { semente, ruido, sobe, claro, escuro, entrada, saida }.
     O limiar único é o ponto médio entre entrada e saída. */
  function simular(o) {
    const N = 600, ruido = gerador(o.semente);
    const unico = (o.entrada + o.saida) / 2;
    const serie = [], mU = [], mH = [];
    let noturno = false;
    for (let i = 0; i < N; i++) {
      const fase = i < N / 2 ? i / (N / 2) : (N - i) / (N / 2);
      const v = Math.min(ESCALA, Math.max(0, o.claro + (o.escuro - o.claro) * fase + ruido() * o.ruido));
      serie.push(v);
      mU.push(escuroAlem(v, unico, o.sobe));
      if (!noturno && escuroAlem(v, o.entrada, o.sobe)) noturno = true;
      else if (noturno && claroAlem(v, o.saida, o.sobe)) noturno = false;
      mH.push(noturno);
    }
    return { serie, modosUnico: mU, modosHist: mH, limiarUnico: unico,
      unico: contarTransicoes(mU), histerese: contarTransicoes(mH) };
  }
  window.SemaforoSim = { simular, contarTransicoes };

  /* ---------------- Calibração ---------------- */
  const APELIDO = { a: 'ambiente', s: 'sombra', l: 'lanterna' };
  function interpretar(texto) {
    const out = []; let ignoradas = 0;
    String(texto).split(/\r?\n/).forEach(linha => {
      const l = linha.trim();
      if (!l || l.startsWith('#') || /^condi/i.test(l)) return;
      const m = l.match(/^(ambiente|sombra|lanterna|a|s|l)\s*[,;\t ]\s*(\d+(?:[.,]\d+)?)$/i);
      if (!m) { ignoradas++; return; }
      const c = m[1].toLowerCase();
      out.push({ cond: APELIDO[c] || c, v: num(m[2]) });
    });
    return { leituras: out, ignoradas };
  }

  function estatistica(cond) {
    const v = state.leituras.filter(p => p.cond === cond).map(p => p.v);
    const n = v.length;
    if (!n) return { n: 0 };
    const media = v.reduce((a, b) => a + b, 0) / n;
    const desvio = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
    return { n, min: Math.min(...v), max: Math.max(...v), media, desvio, valores: v };
  }
  const todas = () => Object.fromEntries(CONDICOES.map(c => [c, estatistica(c)]));

  // Sentido: a leitura sobe com a luz quando a lanterna lê mais que a sombra (ou, sem lanterna, o ambiente).
  function sentido(E) {
    if (!E.sombra.n) return null;
    const ref = E.lanterna.n ? E.lanterna : E.ambiente;
    if (!ref.n || ref.media === E.sombra.media) return null;
    return ref.media > E.sombra.media;
  }
  // Luz em escala crescente: com a leitura descendo com a luz, inverte. Facilita comparar faixas.
  const luz = (v, sobe) => (sobe ? v : ESCALA - v);

  // Região entre a faixa de sombra e a de ambiente, na escala de luz.
  function regiao(E, sobe) {
    if (!E.sombra.n || !E.ambiente.n || sobe === null) return null;
    const sombraTopo = Math.max(luz(E.sombra.min, sobe), luz(E.sombra.max, sobe));
    const ambienteBase = Math.min(luz(E.ambiente.min, sobe), luz(E.ambiente.max, sobe));
    return { de: sombraTopo, ate: ambienteBase, sobrepoe: sombraTopo >= ambienteBase,
      ruido: Math.max(E.sombra.max - E.sombra.min, E.ambiente.max - E.ambiente.min) };
  }

  function onde(lim, E, sobe, R) {
    const x = luz(lim, sobe);
    if (R.sobrepoe) return { ok: false, texto: 'as faixas de sombra e de ambiente se sobrepõem, e nenhum limiar separa as duas' };
    if (x > R.de && x < R.ate) return { ok: true, texto: 'fica entre a faixa de sombra e a de ambiente' };
    const dentro = c => { const a = luz(E[c].min, sobe), b = luz(E[c].max, sobe); return x >= Math.min(a, b) && x <= Math.max(a, b); };
    for (const c of CONDICOES) if (E[c].n && dentro(c)) return { ok: false, texto: `cai dentro da faixa medida em ${NOMES[c]}, e o ruído dessa condição já cruza o limiar` };
    return { ok: false, texto: x <= R.de ? 'fica além da faixa de sombra, e a mão sobre o sensor não acionaria o modo noturno' : 'fica além da faixa de ambiente, do lado da lanterna, e o modo noturno entraria com a sala iluminada' };
  }

  function checksDados(E) {
    const out = [];
    if (!state.leituras.length) return out;
    if (!trava.registrado() || (state.primeiraLeituraEm && trava.estado().primeiroEm > state.primeiraLeituraEm))
      out.push({ ok: false, texto: 'Leituras importadas antes do registro da previsão no Contextualizar. A previsão precisa vir antes da medição.' });
    CONDICOES.forEach(c => {
      const e = E[c];
      if (!e.n) { out.push({ ok: false, texto: `Falta a condição ${NOMES[c]}.` }); return; }
      if (e.n < 10) out.push({ ok: false, texto: `${NOMES[c]}: só ${e.n} leituras; meça pelo menos 10 para ver o ruído.` });
      else out.push({ ok: true, texto: `${NOMES[c]}: ${e.n} leituras, de ${fmt(e.min, 0)} a ${fmt(e.max, 0)}.` });
      if (e.n >= 5 && e.valores.every(v => v % 10 === 0))
        out.push({ ok: false, texto: `${NOMES[c]}: todas as leituras são múltiplas de 10. Leitura bruta do conversor raramente é redonda; tabela com valores redondos sem medição recebe zero.` });
    });
    const sobe = sentido(E);
    if (sobe !== null) {
      out.push({ ok: true, texto: `Sentido detectado: a leitura ${sobe ? 'sobe' : 'desce'} com a luz (lanterna ${sobe ? 'acima' : 'abaixo'} da sombra).` });
      if (E.ambiente.n && E.lanterna.n && E.sombra.n) {
        const a = luz(E.ambiente.media, sobe), s = luz(E.sombra.media, sobe), l = luz(E.lanterna.media, sobe);
        if (!(a > s && a < l)) out.push({ ok: false, texto: 'A média do ambiente não fica entre a da sombra e a da lanterna. Confira se as condições foram medidas com o rótulo certo.' });
      }
    }
    return out;
  }

  function checksComparacao(E) {
    const out = [], sobe = sentido(E), R = regiao(E, sobe);
    if (!R) return out;
    out.push({ ok: !R.sobrepoe, texto: R.sobrepoe ? 'As faixas de sombra e de ambiente se sobrepõem: meça de novo com a mão mais perto do sensor.'
      : `Região entre as faixas: leituras de ${fmt(Math.min(luz(R.de, sobe), luz(R.ate, sobe)), 0)} a ${fmt(Math.max(luz(R.de, sobe), luz(R.ate, sobe)), 0)}. Maior ruído numa mesma condição: ${fmt(R.ruido, 0)} contagens.` });
    const prev = num(F.ctx_limiar.value), ia = num(F.con_limiar_ia.value);
    if (Number.isFinite(prev)) { const r = onde(prev, E, sobe, R); out.push({ ok: r.ok, texto: `Limiar previsto (${fmt(prev, 0)}) ${r.texto}.` }); }
    if (Number.isFinite(ia)) { const r = onde(ia, E, sobe, R); out.push({ ok: r.ok, texto: `Limiar sugerido pela IA (${fmt(ia, 0)}) ${r.texto}.` }); }
    else out.push({ ok: true, texto: 'Sem limiar sugerido pela IA: registre na divergência se ela não deu valor, e por quê.' });
    return out;
  }

  function checksLimiares(E) {
    const out = [], sobe = sentido(E), R = regiao(E, sobe);
    const en = num(F.cons_entrada.value), sa = num(F.cons_saida.value);
    if (!Number.isFinite(en) || !Number.isFinite(sa)) return out;
    if (!R) { out.push({ ok: false, texto: 'Importe as leituras de sombra, ambiente e lanterna para conferir os limiares.' }); return out; }
    if (luz(en, sobe) >= luz(sa, sobe))
      out.push({ ok: false, texto: `Com a leitura ${sobe ? 'subindo' : 'descendo'} com a luz, o limiar de entrada precisa ser ${sobe ? 'menor' : 'maior'} que o de saída: o modo noturno entra no lado mais escuro.` });
    else out.push({ ok: true, texto: `Ordem coerente com o sentido: entrada do lado escuro, saída do lado claro.` });
    [['entrada', en], ['saída', sa]].forEach(([n, v]) => { const r = onde(v, E, sobe, R); out.push({ ok: r.ok, texto: `Limiar de ${n} (${fmt(v, 0)}) ${r.texto}.` }); });
    const folga = Math.abs(en - sa);
    out.push(folga > R.ruido ? { ok: true, texto: `Folga de ${fmt(folga, 0)} contagens, maior que o ruído medido de ${fmt(R.ruido, 0)}.` }
      : { ok: false, texto: `Folga de ${fmt(folga, 0)} contagens, menor ou igual ao ruído medido de ${fmt(R.ruido, 0)}: o ruído ainda atravessa os dois limiares.` });
    return out;
  }

  const html = lista => lista.map(c => (c.ok ? P.ok(P.esc(c.texto)) : P.ruim(P.esc(c.texto)))).join('');

  /* ---------------- Plano do RA ---------------- */
  function plano(d) {
    if (!Number.isInteger(d) || d < 0 || d > 9) return null;
    const p = { vermelho: 5 + d, verde: 3 + Math.floor(d / 2), amarelo: 2 };
    p.ciclo = p.vermelho + p.verde + p.amarelo;
    return p;
  }
  const textoPlano = p => (p ? `<b>${p.vermelho} s · ${p.verde} s · ${p.amarelo} s</b><span>vermelho, verde e amarelo · ciclo de ${p.ciclo} s</span>` : '<b>n/d</b><span>dígito de 0 a 9</span>');
  const raCalc = document.getElementById('raDigito');
  const atualizarPlanoCalc = () => { document.getElementById('outPlano').innerHTML = 'Plano do RA' + textoPlano(plano(num(raCalc.value))); };
  raCalc.addEventListener('input', atualizarPlanoCalc);

  /* ---------------- Semáforo básico: corrente nos LEDs ---------------- */
  const LEDS = [['vermelho', 'ledVfR', 'ctx_i_verm'], ['amarelo', 'ledVfA', 'ctx_i_amar'], ['verde', 'ledVfG', 'ctx_i_verde']];
  // Corrente em mA para tensão em V e resistor em ohm.
  const corrente = (v, vf, r) => (Number.isFinite(v) && Number.isFinite(vf) && r > 0 && v > vf ? ((v - vf) / r) * 1000 : NaN);
  function atualizarLed() {
    const v = num(document.getElementById('ledV').value), r = num(document.getElementById('ledR').value);
    document.getElementById('outLed').innerHTML = 'Corrente em cada LED' + LEDS.map(([cor, id]) =>
      `<span>${cor}: <b style="display:inline;font-size:inherit">${fmtSig(corrente(v, num(document.getElementById(id).value), r))} mA</b></span>`).join('<br>');
  }
  ['ledV', 'ledR', 'ledVfR', 'ledVfA', 'ledVfG'].forEach(id => document.getElementById(id).addEventListener('input', atualizarLed));

  function checksLed() {
    const out = [], imax = num(F.conf_imax.value);
    if (!Number.isFinite(imax)) return out;
    LEDS.forEach(([cor, , campo]) => {
      const i = num(F[campo].value);
      if (!Number.isFinite(i)) return;
      out.push(i <= imax ? { ok: true, texto: `LED ${cor}: ${fmtSig(i)} mA previstos, dentro do limite de ${fmtSig(imax)} mA do datasheet.` }
        : { ok: false, texto: `LED ${cor}: ${fmtSig(i)} mA previstos, acima do limite de ${fmtSig(imax)} mA do datasheet. Aumente o resistor.` });
    });
    const rPrev = num(F.ctx_r.value), rAdot = num(F.conf_r_adotado.value), rIa = num(F.conf_r_ia.value);
    if (Number.isFinite(rPrev) && Number.isFinite(rAdot) && rPrev !== rAdot)
      out.push({ ok: true, texto: `Resistor adotado (${fmtSig(rAdot)} Ω) diferente do previsto no Contextualizar (${fmtSig(rPrev)} Ω): recalcule a corrente com o valor adotado.` });
    if (Number.isFinite(rIa)) out.push({ ok: true, texto: `Resistor sugerido pela IA: ${fmtSig(rIa)} Ω. Adotado: ${Number.isFinite(rAdot) ? fmtSig(rAdot) + ' Ω' : 'n/d'}. Justifique a escolha.` });
    return out;
  }

  // Temporização: previsto pelo plano do RA contra o medido com cronômetro externo.
  function tempos() {
    const p = plano(num(F.cons_ra.value));
    const fases = [['vermelho', 'comp_t_verm'], ['verde', 'comp_t_verde'], ['amarelo', 'comp_t_amar'], ['ciclo', 'comp_t_ciclo']];
    return fases.map(([fase, campo]) => {
      const prev = p ? p[fase] : NaN, med = num(F[campo].value);
      const desvio = Number.isFinite(prev) && Number.isFinite(med) && prev > 0 ? ((med - prev) / prev) * 100 : NaN;
      return { fase, prev, med, desvio };
    });
  }
  const fmtDesvio = d => (Number.isFinite(d) ? `${d > 0 ? '+' : ''}${fmt(d, 1)} %` : 'n/d');
  function checksTempo(T) {
    const out = [], crit = num(F.ctx_desvio.value);
    if (!Number.isFinite(crit)) return out;
    T.forEach(t => {
      if (!Number.isFinite(t.desvio)) return;
      out.push(Math.abs(t.desvio) <= crit ? { ok: true, texto: `${t.fase}: desvio de ${fmtDesvio(t.desvio)}, dentro do critério de ${fmt(crit, 1)} %.` }
        : { ok: false, texto: `${t.fase}: desvio de ${fmtDesvio(t.desvio)}, acima do critério de ${fmt(crit, 1)} %. Explique a divergência.` });
    });
    return out;
  }

  /* ---------------- Esquema do divisor ---------------- */
  (function esquema() {
    const g = document.getElementById('esquema');
    const fio = d => svg('path', { d, fill: 'none', stroke: C.escuro, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    const txt = (x, y, t, o = {}) => svg('text', { x, y, text: t, fill: o.fill || C.roxo, 'font-size': o.size || 13, 'text-anchor': o.anchor || 'middle', 'font-family': FM, 'font-weight': o.weight || 600 }, g);
    txt(150, 26, '3V3', { size: 14 });
    fio('M150 34 V60');
    // LDR: retângulo com zigue-zague e duas setas de luz
    svg('rect', { x: 128, y: 60, width: 44, height: 70, rx: 8, fill: C.branco, stroke: C.roxo, 'stroke-width': 3 }, g);
    svg('path', { d: 'M150 66 l10 7 l-20 8 l20 8 l-20 8 l20 8 l-20 8 l10 7', fill: 'none', stroke: C.coral, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    [[86, 70], [86, 100]].forEach(([x, y]) => svg('path', { d: `M${x} ${y} l30 12 m-9 -9 l9 9 l-12 3`, fill: 'none', stroke: C.verde, 'stroke-width': 3, 'stroke-linecap': 'round' }, g));
    txt(196, 100, 'LDR', { anchor: 'start' });
    fio('M150 130 V160');
    svg('circle', { cx: 150, cy: 160, r: 5, fill: C.roxo }, g);
    // resistor fixo
    fio('M150 160 V180');
    svg('path', { d: 'M150 180 l10 6 l-20 8 l20 8 l-20 8 l20 8 l-20 8 l10 6', fill: 'none', stroke: C.roxo, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
    txt(178, 214, 'R fixo', { anchor: 'start' });
    fio('M150 232 V258');
    fio('M136 258 H164 M142 264 H158 M147 270 H153');
    txt(150, 290, 'GND');
    // nó ao pino
    fio('M150 160 H330');
    svg('rect', { x: 330, y: 136, width: 160, height: 48, rx: 10, fill: C.roxo }, g);
    txt(410, 158, 'GPIO34', { fill: C.branco, size: 14, weight: 700 });
    txt(410, 175, 'ADC1 · 0 a 4095', { fill: C.claro, size: 11 });
    txt(240, 150, 'nó do divisor', { size: 11, weight: 500 });
  })();

  /* ---------------- Simulador na tela ---------------- */
  const simCv = document.getElementById('simCanvas');
  const simRuido = document.getElementById('simRuido');
  const outRuido = document.getElementById('outRuido');
  let simRes = null, simProgresso = 0, simAnim = null;

  function parametrosSim() {
    const E = todas(), sobe = sentido(E);
    const en = num(F.cons_entrada.value), sa = num(F.cons_saida.value);
    const doGrupo = sobe !== null && E.ambiente.n && E.sombra.n && Number.isFinite(en) && Number.isFinite(sa) && luz(en, sobe) < luz(sa, sobe);
    if (doGrupo) return { doGrupo, sobe, claro: E.ambiente.media, escuro: E.sombra.media, entrada: en, saida: sa };
    return { doGrupo: false, sobe: true, claro: 2400, escuro: 900, entrada: 1550, saida: 1750 };
  }

  function desenharSim() {
    const { ctx, W, H } = P.prepararCanvas(simCv);
    const o = parametrosSim();
    document.getElementById('simFonte').textContent = o.doGrupo ? 'com as medições e os limiares do grupo' : 'valores de exemplo';
    const lo = Math.max(0, Math.min(o.claro, o.escuro) - 3 * +simRuido.value - 100);
    const hi = Math.min(ESCALA, Math.max(o.claro, o.escuro) + 3 * +simRuido.value + 100);
    const itensSim = [['dash', C.coral, 'limiar único'], ['dash', C.roxo, `entrada ${fmt(o.entrada, 0)} e saída ${fmt(o.saida, 0)}`], ['line', C.verde, 'leitura']];
    const extra = 18 * (P.linhasLegenda(ctx, W, { l: 84, r: 22 }, itensSim) - 1);
    const { X, Y, pad } = P.eixos(ctx, W, H, { x: [0, 60], y: [lo, hi], rotX: 'Tempo (s)', rotY: 'Leitura do LDR', casasY: 0, margem: { t: 116 + extra, l: 84 } });
    const linha = (v, cor, tracos) => { ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.setLineDash(tracos); ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.setLineDash([]); };
    linha((o.entrada + o.saida) / 2, C.coral, [6, 4]);
    linha(o.entrada, C.roxo, [2, 3]);
    linha(o.saida, C.roxo, [8, 3]);
    P.legenda(ctx, W, pad, itensSim);
    if (!simRes) {
      // Aviso com fundo próprio, no alto da área, para não ficar sobre as linhas dos limiares.
      const aviso = 'Registre a previsão acima para rodar a simulação.';
      ctx.font = `13px ${FT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cx = (pad.l + W - pad.r) / 2, cy = pad.t + 18, lw = ctx.measureText(aviso).width + 24;
      ctx.fillStyle = C.claro; ctx.fillRect(cx - lw / 2, cy - 13, lw, 26);
      ctx.fillStyle = C.roxo; ctx.fillText(aviso, cx, cy);
      return;
    }
    const n = Math.max(1, Math.round(simRes.serie.length * simProgresso));
    const t = i => i / 10;
    ctx.strokeStyle = C.verde; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < n; i++) i ? ctx.lineTo(X(t(i)), Y(simRes.serie[i])) : ctx.moveTo(X(t(i)), Y(simRes.serie[i]));
    ctx.stroke();
    // Faixas de modo: escuro = noturno, claro = diurno
    const faixa = (y, modos, rotulo) => {
      ctx.fillStyle = C.roxo; ctx.font = `600 12px ${FT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(rotulo, pad.l - 8, y + 7);
      for (let i = 0; i < n; i++) { ctx.fillStyle = modos[i] ? C.roxo : C.claro; ctx.fillRect(X(t(i)), y, (W - pad.l - pad.r) / 600 + 0.5, 14); }
    };
    faixa(18, simRes.modosUnico, 'único');
    faixa(42, simRes.modosHist, 'histerese');
    ctx.fillStyle = C.roxo; ctx.font = `12px ${FM}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('roxo = modo noturno', pad.l, 68);
    const cU = contarTransicoes(simRes.modosUnico.slice(0, n)), cH = contarTransicoes(simRes.modosHist.slice(0, n));
    document.getElementById('simOut').innerHTML =
      `<div class="out">Limiar único<b>${cU} trocas</b><span>${state.prev ? `previsão: ${state.prev.unico}` : ''}</span></div>` +
      `<div class="out">Histerese<b>${cH} trocas</b><span>${state.prev ? `previsão: ${state.prev.hist}` : ''}</span></div>`;
    if (simProgresso >= 1)
      document.getElementById('simExpl').textContent = `Em um minuto, o limiar único trocou de modo ${simRes.unico} vezes e a histerese ${simRes.histerese}. Perto do limiar único, o ruído leva a leitura para os dois lados várias vezes seguidas. Com dois limiares, depois que o modo noturno entra a leitura precisa voltar além do limiar de saída, e uma folga maior que o ruído impede essa volta por acaso.`;
  }

  function rodarSim() {
    const o = parametrosSim();
    simRes = simular(Object.assign({ semente: state.semente, ruido: +simRuido.value }, o));
    simProgresso = 0;
    document.getElementById('simExpl').textContent = '';
    cancelAnimationFrame(simAnim);
    const reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzido) { simProgresso = 1; desenharSim(); return; }
    const t0 = performance.now();
    (function passo(agora) {
      simProgresso = Math.min(1, Math.max(0, (agora - t0) / 6000));
      desenharSim();
      if (simProgresso < 1) simAnim = requestAnimationFrame(passo);
    })(t0);
  }

  const atualizarRuido = () => { outRuido.textContent = simRuido.value; };
  simRuido.addEventListener('input', () => { atualizarRuido(); if (simRes) { simProgresso = 1; simRes = simular(Object.assign({ semente: state.semente, ruido: +simRuido.value }, parametrosSim())); desenharSim(); } });
  document.getElementById('btnSemente').addEventListener('click', () => { state.semente = (state.semente * 31 + 17) % 100000; rodarSim(); salvar(); });
  document.getElementById('btnRodar').addEventListener('click', rodarSim);
  function liberarSim() {
    document.getElementById('simCtrl').hidden = false;
    document.getElementById('simPrev').classList.add('feito');
    document.getElementById('prevUnico').value = state.prev.unico;
    document.getElementById('prevHist').value = state.prev.hist;
  }
  document.getElementById('btnPrev').addEventListener('click', () => {
    const u = num(document.getElementById('prevUnico').value), h = num(document.getElementById('prevHist').value);
    if (!Number.isFinite(u) || !Number.isFinite(h)) { document.getElementById('simExpl').textContent = 'Escreva as duas previsões antes de rodar.'; return; }
    state.prev = { unico: u, hist: h };
    liberarSim(); rodarSim(); salvar();
  });

  /* ---------------- Gráfico da calibração ---------------- */
  function desenharCal(ctx, W, H, titulo) {
    const E = todas();
    const limiares = [[num(F.ctx_limiar.value), C.verde, [], 'previsto'], [num(F.con_limiar_ia.value), C.coral, [6, 4], 'IA'],
      [num(F.cons_entrada.value), C.roxo, [2, 3], 'entrada'], [num(F.cons_saida.value), C.roxo, [8, 3], 'saída']].filter(l => Number.isFinite(l[0]));
    const itens = [['dot', C.roxo, 'leitura'], ['line', C.coral, 'média']].concat(limiares.map(([, cor, tracos, texto]) => [tracos.length ? 'dash' : 'line', cor, texto]));
    const extra = 18 * (P.linhasLegenda(ctx, W, { l: 84, r: 22 }, itens) - 1);
    const { X, Y, pad } = P.eixos(ctx, W, H, { x: [0.5, 3.5], y: [0, ESCALA], rotX: 'Condição', rotY: 'Leitura bruta (0 a 4095)', titulo, casasY: 0,
      margem: { l: 84, t: (titulo ? 78 : 50) + extra }, rotulosX: [[1, 'ambiente'], [2, 'sombra'], [3, 'lanterna']] });
    CONDICOES.forEach((c, k) => {
      const e = E[c]; if (!e.n) return;
      e.valores.forEach((v, i) => {
        const x = k + 1 + (((i * 37) % 100) / 100 - 0.5) * 0.4;
        ctx.beginPath(); ctx.arc(X(x), Y(v), 3.5, 0, 2 * Math.PI); ctx.fillStyle = C.roxo; ctx.fill();
      });
      ctx.strokeStyle = C.coral; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(k + 1 - 0.3), Y(e.media)); ctx.lineTo(X(k + 1 + 0.3), Y(e.media)); ctx.stroke();
    });
    limiares.forEach(([v, cor, tracos]) => {
      ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.setLineDash(tracos);
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke(); ctx.setLineDash([]);
    });
    P.legenda(ctx, W, pad, itens);
  }
  const cvCal = document.getElementById('chartCal');
  const desenharTela = () => { const { ctx, W, H } = P.prepararCanvas(cvCal); desenharCal(ctx, W, H); };
  const pngCal = () => P.png((ctx, W, H) => desenharCal(ctx, W, H, `Calibração do LDR · ${F.autor.value || 'n/d'}`));
  ['btnPng', 'btnPng2'].forEach(id => document.getElementById(id).addEventListener('click', () => pngCal().then(b => P.baixar('grafico-calibracao.png', b))));

  /* ---------------- Tabela, verificações e atualização ---------------- */
  function atualizar() {
    const E = todas();
    document.querySelector('#statTable tbody').innerHTML = CONDICOES.map(c => {
      const e = E[c];
      return `<tr><td>${c}</td><td>${e.n}</td><td>${e.n ? fmt(e.min, 0) : 'n/d'}</td><td>${e.n ? fmt(e.max, 0) : 'n/d'}</td><td>${e.n ? fmt(e.media, 1) : 'n/d'}</td><td>${e.n ? fmt(e.desvio, 1) : 'n/d'}</td></tr>`;
    }).join('');
    document.getElementById('dataCheck').innerHTML = html(checksDados(E));
    document.getElementById('cmpCheck').innerHTML = html(checksComparacao(E));
    document.getElementById('limCheck').innerHTML = html(checksLimiares(E));
    document.getElementById('ledCheck').innerHTML = html(checksLed());
    const T = tempos();
    document.querySelector('#tempoTable tbody').innerHTML = T.map(t =>
      `<tr><td>${t.fase}</td><td>${Number.isFinite(t.prev) ? fmt(t.prev, 0) : 'n/d'}</td><td>${Number.isFinite(t.med) ? fmt(t.med, 2) : 'n/d'}</td><td>${fmtDesvio(t.desvio)}</td></tr>`).join('');
    document.getElementById('tempoCheck').innerHTML = html(checksTempo(T));
    const p = plano(num(F.cons_ra.value));
    document.getElementById('outPlanoRel').innerHTML = F.cons_ra.value === '' ? '' : 'Plano do RA' + textoPlano(p);
    desenharTela();
    if (simRes) { simProgresso = 1; simRes = simular(Object.assign({ semente: state.semente, ruido: +simRuido.value }, parametrosSim())); }
    desenharSim();
  }

  document.getElementById('btnImport').addEventListener('click', () => {
    const r = interpretar(document.getElementById('pasteBox').value);
    if (!r.leituras.length) { document.getElementById('dataCheck').innerHTML = P.ruim('Nenhuma linha no formato condição,leitura foi reconhecida.'); return; }
    state.leituras = state.leituras.concat(r.leituras);
    if (!state.primeiraLeituraEm) state.primeiraLeituraEm = new Date().toISOString();
    document.getElementById('pasteBox').value = '';
    atualizar(); salvar();
    if (r.ignoradas) document.getElementById('dataCheck').insertAdjacentHTML('beforeend', P.neutro(`${r.ignoradas} linha(s) fora do formato foram ignoradas.`));
  });
  document.getElementById('btnClearData').addEventListener('click', () => { state.leituras = []; state.primeiraLeituraEm = null; atualizar(); salvar(); });

  /* ---------------- Registro da previsão e rascunho ---------------- */
  const trava = P.trava({ etapa: document.getElementById('stepCtx'), botao: document.getElementById('btnLock'),
    status: document.getElementById('lockStatus'), rotulo: 'previsão', aoMudar: () => { atualizar(); salvar(); } });
  const rasc = P.rascunho(form, KEY);
  const salvar = () => rasc.salvar({ leituras: state.leituras, prev: state.prev, primeiraLeituraEm: state.primeiraLeituraEm, semente: state.semente, trava: trava.estado() });
  form.addEventListener('input', e => { if (e.target.id !== 'pasteBox') { atualizar(); salvar(); } });

  /* ---------------- Relatório e ADR ---------------- */
  const md = lista => lista.map(c => `- ${c.ok ? 'OK' : 'Atenção'}: ${c.texto}`).join('\n') || '- n/d';

  function relatorio() {
    const E = todas(), sobe = sentido(E), R = regiao(E, sobe);
    const p = plano(num(F.cons_ra.value)), T = tempos();
    const linhasEst = CONDICOES.map(c => { const e = E[c]; return `| ${c} | ${e.n} | ${e.n ? fmt(e.min, 0) : 'n/d'} | ${e.n ? fmt(e.max, 0) : 'n/d'} | ${e.n ? fmt(e.media, 1) : 'n/d'} | ${e.n ? fmt(e.desvio, 1) : 'n/d'} |`; }).join('\n');
    const brutos = state.leituras.map(x => `${x.cond},${x.v}`).join('\n');
    const ordem = state.primeiraLeituraEm && trava.registrado() && trava.estado().primeiroEm <= state.primeiraLeituraEm
      ? 'previsão registrada antes da primeira leitura' : state.primeiraLeituraEm ? '**leituras importadas antes do registro da previsão**' : 'sem leituras importadas';
    return `# Relatório · Atividade ponderada de Computação 2 - Semáforo com dois modos de operação

**Nome:** ${L(F.autor.value)} (${L(F.email.value)}) · **Turma:** ${L(F.turma.value)}
**Grupo de bancada:** ${L(F.grupo.value)} · **Colegas de bancada:** ${L(F.integrantes.value.split(/\n+/).filter(Boolean).join(', '))}
**Previsão registrada em:** ${trava.historico()}
**Primeira leitura importada em:** ${state.primeiraLeituraEm ? P.quando(state.primeiraLeituraEm) : 'n/d'} · ${ordem}

## 1. Contextualizar

### Semáforo básico: tabela de previsão

| Item | Previsto |
|---|---|
| Último dígito do RA | ${L(F.cons_ra.value)} |
| Tempo de vermelho | ${p ? p.vermelho + ' s' : 'n/d'} |
| Tempo de verde | ${p ? p.verde + ' s' : 'n/d'} |
| Tempo de amarelo | ${p ? p.amarelo + ' s' : 'n/d'} |
| Ciclo completo | ${p ? p.ciclo + ' s' : 'n/d'} |
| Tensão de alimentação considerada | ${L(F.ctx_vcc.value)} V |
| Resistor de cada LED | ${L(F.ctx_r.value)} Ω |
| Corrente esperada no LED vermelho | ${L(F.ctx_i_verm.value)} mA |
| Corrente esperada no LED amarelo | ${L(F.ctx_i_amar.value)} mA |
| Corrente esperada no LED verde | ${L(F.ctx_i_verde.value)} mA |
| Desvio aceitável na temporização | ${L(F.ctx_desvio.value)} % |

- **Por que esse desvio é aceitável:** ${L(F.ctx_desvio_just.value)}

### Modo noturno

| Item | Valor |
|---|---|
| Transições indevidas toleráveis por minuto | ${L(F.ctx_transicoes.value)} |
| Limiar previsto (0 a 4095) | ${L(F.ctx_limiar.value)} |

- **Por que esse número de transições:** ${L(F.ctx_transicoes_just.value)}
- **Origem do limiar previsto:** ${L(F.ctx_limiar_just.value)}
- **O que delego à IA:** ${L(F.ctx_delega.value)}

## 2. Consultar

- **Ferramenta:** ${L(F.con_ferramenta.value)}

### Semáforo básico

- **Pergunta sobre o circuito ou o código:** ${L(F.con_circ_pergunta.value)}
- **Resposta da IA:** ${L(F.con_circ_resposta.value)}

### Modo noturno

- **Pergunta:** ${L(F.con_pergunta.value)}
- **Estratégia sugerida:** ${L(F.con_estrategia.value)}
- **Nome da técnica:** ${L(F.con_tecnica.value)}
- **Limiar sugerido pela IA:** ${L(F.con_limiar_ia.value)}

## 3. Confrontar

### Semáforo básico: corrente contra o datasheet

- **LED usado:** ${L(F.conf_led.value)}
- **Corrente máxima no datasheet:** ${L(F.conf_imax.value)} mA
- **Resistor sugerido pela IA:** ${F.conf_r_ia.value ? L(F.conf_r_ia.value) + ' Ω' : 'n/d'}
- **Resistor adotado:** ${L(F.conf_r_adotado.value)} Ω
- **Por quê:** ${L(F.conf_r_just.value)}

Verificações:
${md(checksLed())}

### Modo noturno: tabela de calibração

Leitura bruta do conversor de 12 bits (0 a 4095).

| Condição | n | Mínimo | Máximo | Média | Desvio |
|---|---|---|---|---|---|
${linhasEst}

- **Sentido:** ${sobe === null ? 'n/d' : `a leitura ${sobe ? 'sobe' : 'desce'} com a luz`}
- **Maior ruído numa mesma condição:** ${R ? fmt(R.ruido, 0) + ' contagens' : 'n/d'}

Verificações:
${md(checksDados(E).concat(checksComparacao(E)))}

**Divergência explicada:** ${L(F.conf_divergencia.value)}

Gráfico: \`grafico-calibracao.png\`.

<details><summary>Leituras brutas (${state.leituras.length})</summary>

\`\`\`csv
condicao,leitura
${brutos}
\`\`\`

</details>

## 4. Construir

### Semáforo básico

- **Pinos (vermelho, amarelo, verde):** ${L(F.cons_pinos.value)}
- **Código:** ${L(F.cons_codigo.value)}
- **Ciclo programado:** ${p ? `vermelho ${p.vermelho} s, verde ${p.verde} s, amarelo ${p.amarelo} s, repetindo` : 'n/d'}

### Modo noturno (amarelo intermitente, com histerese)

| Item | Valor |
|---|---|
| Limiar de entrada no modo noturno | ${L(F.cons_entrada.value)} |
| Limiar de saída do modo noturno | ${L(F.cons_saida.value)} |
| Folga entre os limiares | ${Number.isFinite(num(F.cons_entrada.value)) && Number.isFinite(num(F.cons_saida.value)) ? fmt(Math.abs(num(F.cons_entrada.value) - num(F.cons_saida.value)), 0) + ' contagens' : 'n/d'} |

Verificações:
${md(checksLimiares(E))}

**Como os limiares saíram das medições:** ${L(F.cons_justificativa.value)}

## 5. Comprovar

### Semáforo básico: tabela de previsão com a medição

| Fase | Previsto (s) | Medido com cronômetro (s) | Desvio |
|---|---|---|---|
${T.map(t => `| ${t.fase} | ${Number.isFinite(t.prev) ? fmt(t.prev, 0) : 'n/d'} | ${Number.isFinite(t.med) ? fmt(t.med, 2) : 'n/d'} | ${fmtDesvio(t.desvio)} |`).join('\n')}

Critério de aceitação: ${L(F.ctx_desvio.value)} %.

Verificações:
${md(checksTempo(T))}

- **Explicação das divergências:** ${L(F.comp_t_just.value)}
- **Vídeo do ciclo completo (30 a 60 s):** ${L(F.comp_video_ciclo.value)}

#### Cartão de falha

- **Sintoma:** ${L(F.comp_cartao.value)}
- **Causa mais provável:** ${L(F.comp_causa.value)}
- **Teste para confirmar:** ${L(F.comp_teste.value)}

### Modo noturno

- **Vídeo da transição:** ${L(F.comp_video.value)}
- **Trocas de modo observadas:** ${L(F.comp_trocas.value)} (critério declarado: ${L(F.ctx_transicoes.value)} por minuto)
- **Por que a histerese impede a oscilação:** ${L(F.comp_frase.value)}

ADR em \`ADR.md\`.
`;
  }

  function adr() {
    const E = todas();
    const media = c => (E[c].n ? fmt(E[c].media, 0) : 'n/d');
    return `# ADR · Atividade ponderada de Computação 2 - Semáforo com dois modos de operação

**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Autor:** ${L(F.autor.value)} (${L(F.email.value)})
**Turma:** ${L(F.turma.value)}

## Contexto

Semáforo de três LEDs com o plano do RA (dígito ${L(F.cons_ra.value)}) e modo noturno automático, detectado por LDR. Calibração: média de ${media('ambiente')} no ambiente, ${media('sombra')} na sombra e ${media('lanterna')} com lanterna. Limiares adotados: entrada ${L(F.cons_entrada.value)} e saída ${L(F.cons_saida.value)}.

## Decisão

${L(F.adr_decisao.value)}

## Alternativa considerada

${L(F.adr_alternativa.value)}

## Sugestão de IA rejeitada ou corrigida

${L(F.adr_sugestao.value)}

## Razão técnica

${L(F.adr_razao.value)}
`;
  }

  const status = document.getElementById('formStatus');
  function avisar(extra) {
    const faltam = P.pendentes(form);
    const avisos = [];
    if (faltam) avisos.push(`${faltam} campo(s) obrigatório(s) em branco (destacados)`);
    if (!trava.registrado()) avisos.push('previsão não registrada');
    if (CONDICOES.some(c => !estatistica(c).n)) avisos.push('calibração sem as três condições');
    if (extra) avisos.push(extra);
    status.hidden = !avisos.length;
    status.textContent = avisos.length ? `Arquivo baixado com pendências: ${avisos.join('; ')}.` : '';
  }
  document.getElementById('btnMd').addEventListener('click', () => { avisar(); P.baixar('RELATORIO.md', relatorio(), 'text/markdown'); });
  document.getElementById('btnAdr').addEventListener('click', () => { avisar(); P.baixar('ADR.md', adr(), 'text/markdown'); });
  document.getElementById('btnClear').addEventListener('click', () => {
    rasc.apagar(); form.reset(); form.classList.remove('was-validated');
    Object.assign(state, { leituras: [], primeiraLeituraEm: null });
    trava.carregar(null); atualizar();
    status.hidden = false; status.textContent = 'Rascunho apagado.';
  });

  /* ---------------- Início ---------------- */
  const extra = rasc.restaurar();
  if (extra) {
    Object.assign(state, { leituras: extra.leituras || [], prev: extra.prev || null, primeiraLeituraEm: extra.primeiraLeituraEm || null, semente: extra.semente || 7 });
    trava.carregar(extra.trava);
    if (state.prev) liberarSim();
  } else trava.carregar(null);
  atualizarRuido(); atualizarPlanoCalc(); atualizarLed(); atualizar();
  if (state.prev) { simRes = simular(Object.assign({ semente: state.semente, ruido: +simRuido.value }, parametrosSim())); simProgresso = 1; desenharSim(); }
  window.addEventListener('resize', () => { desenharTela(); desenharSim(); });
  if (document.fonts) document.fonts.ready.then(() => { desenharTela(); desenharSim(); });
})();
