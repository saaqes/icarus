(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const fmt = (n, d = 2) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
  const money = n => (n < 0 ? "-" : "") + "$ " + fmt(Math.abs(n));
  const sign = n => (n > 0 ? "+" : "") + money(n);
  const PAYOUT = 0.85, START = 10000;
  const S = { ticks: [], tf: 10, ind: { sma: true, ema: false, bb: false }, balance: START, positions: [], history: [], nid: 1 };
  const B = { state: "idle", rules: [{ cond: "rsi_lt", val: 35, act: "up" }, { cond: "red_n", val: 3, act: "up" }], n: 0, wins: 0, pl: 0, busy: false, timer: null };

  /* ---------- mercado ficticio ---------- */
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(6.2832 * r());
  let vol = .35, drift = 0;
  function genTick(r) { const last = S.ticks[S.ticks.length - 1]; if (r() < .02) vol = .2 + r() * .5; drift = drift * .97 + (r() - .5) * .08; return Math.max(50, last + drift + gauss(r) * vol); }
  (() => { const r = mulberry(20241); S.ticks.push(1000); for (let i = 0; i < 1800; i++) S.ticks.push(genTick(r)); })();

  /* ---------- velas e indicadores ---------- */
  function candles() {
    const out = [], N = S.tf, t = S.ticks;
    for (let i = 0; i < t.length; i += N) { const c = t.slice(i, i + N); out.push({ o: c[0], c: c[c.length - 1], h: Math.max(...c), l: Math.min(...c) }); }
    return out;
  }
  const sma = (a, n) => a.map((_, i) => i < n - 1 ? null : a.slice(i - n + 1, i + 1).reduce((x, y) => x + y, 0) / n);
  function ema(a, n) { const k = 2 / (n + 1); let e = null; return a.map((v, i) => { if (i < n - 1) return null; e = e === null ? a.slice(0, n).reduce((x, y) => x + y, 0) / n : v * k + e * (1 - k); return e; }); }
  function bb(a, n = 20) { const m = sma(a, n); return m.map((mm, i) => { if (mm === null) return null; const s = a.slice(i - n + 1, i + 1), sd = Math.sqrt(s.reduce((x, y) => x + (y - mm) ** 2, 0) / n); return [mm - 2 * sd, mm + 2 * sd]; }); }
  function rsi(closes, n = 14) {
    if (closes.length <= n) return null; let g = 0, l = 0;
    for (let i = closes.length - n; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }

  /* ---------- gráfico ---------- */
  const cv = $("#cv");
  function draw() {
    const box = cv.parentElement.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!box.width) return;
    if (cv.width !== Math.round(box.width * dpr) || cv.height !== Math.round(box.height * dpr)) { cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr); }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = box.width, H = box.height, ax = 62, ph = H - 22, pw = W - ax;
    g.clearRect(0, 0, W, H);
    const all = candles(), closes = all.map(c => c.c), NV = W < 520 ? 34 : 64, from = Math.max(0, all.length - NV), vis = all.slice(from);
    const S20 = sma(closes, 20).slice(from), E50 = ema(closes, 50).slice(from), BB = bb(closes).slice(from);
    let lo = Math.min(...vis.map(c => c.l)), hi = Math.max(...vis.map(c => c.h));
    if (S.ind.bb) BB.forEach(b => { if (b) { lo = Math.min(lo, b[0]); hi = Math.max(hi, b[1]); } });
    const pad = (hi - lo) * .08 || 1; lo -= pad; hi += pad;
    const Y = v => 8 + (hi - v) / (hi - lo) * (ph - 16), cw = pw / NV;
    g.font = "11px system-ui"; g.textBaseline = "middle"; g.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { const v = lo + (hi - lo) * i / 5, y = Y(v); g.strokeStyle = "#1d1812"; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.fillStyle = "#7d7365"; g.fillText(fmt(v), pw + 6, y); }
    const X = i => i * cw + cw / 2;
    const line = (arr, col) => { g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); let s = false; arr.forEach((v, i) => { if (v === null) return; const x = X(i), y = Y(v); s ? g.lineTo(x, y) : g.moveTo(x, y); s = true; }); g.stroke(); };
    if (S.ind.bb) { g.fillStyle = "rgba(201,163,90,.07)"; g.beginPath(); let st = false; BB.forEach((b, i) => { if (!b) return; st ? g.lineTo(X(i), Y(b[1])) : g.moveTo(X(i), Y(b[1])); st = true; }); for (let i = BB.length - 1; i >= 0; i--) if (BB[i]) g.lineTo(X(i), Y(BB[i][0])); g.fill(); line(BB.map(b => b && b[0]), "rgba(201,163,90,.6)"); line(BB.map(b => b && b[1]), "rgba(201,163,90,.6)"); }
    vis.forEach((c, i) => {
      const up = c.c >= c.o, col = up ? "#3ddc97" : "#ff5b61", x = X(i);
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, Y(c.h)); g.lineTo(x, Y(c.l)); g.stroke();
      const t = Y(Math.max(c.o, c.c)), h = Math.max(1.5, Math.abs(Y(c.o) - Y(c.c))); g.fillRect(x - cw * .32, t, cw * .64, h);
    });
    if (S.ind.sma) line(S20, "#4aa3ff"); if (S.ind.ema) line(E50, "#ff9d3d");
    S.positions.forEach(p => { const y = Y(p.entry); g.setLineDash([5, 4]); g.strokeStyle = p.side === "up" ? "#3ddc97" : "#ff5b61"; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.setLineDash([]); g.fillStyle = g.strokeStyle; g.fillText(p.side === "up" ? "▲ entrada" : "▼ entrada", 6, y - 8); });
    const last = S.ticks[S.ticks.length - 1], ly = Y(last), lc = last >= S.ticks[S.ticks.length - 2];
    g.setLineDash([2, 3]); g.strokeStyle = "#c9a35a"; g.beginPath(); g.moveTo(0, ly); g.lineTo(pw, ly); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#c9a35a"; g.fillRect(pw, ly - 9, ax, 18); g.fillStyle = "#14100d"; g.fillText(fmt(last), pw + 6, ly);
    $("#legend").innerHTML = (S.ind.sma ? '<i style="background:#4aa3ff"></i>SMA 20' : "") + (S.ind.ema ? '<i style="background:#ff9d3d"></i>EMA 50' : "") + (S.ind.bb ? '<i style="background:#c9a35a"></i>Bollinger' : "") + (rsi(closes) !== null ? `<i style="background:transparent"></i>RSI(14): ${fmt(rsi(closes), 1)}` : "");
  }

  /* ---------- operaciones ---------- */
  const toast = m => { $("#toast").textContent = m; };
  const clock = () => new Date().toLocaleTimeString("es-CO", { hour12: false });
  function openPos(side, stake, dur, src) {
    if (!(stake > 0)) { toast("Escribe un monto válido."); return false; }
    if (stake > S.balance) { toast("Saldo ficticio insuficiente."); return false; }
    S.balance -= stake; const p = { id: S.nid++, side, stake, left: dur, dur, entry: S.ticks[S.ticks.length - 1], src };
    S.positions.push(p); ui(); return p;
  }
  function settle(p) {
    const px = S.ticks[S.ticks.length - 1]; let res, pl;
    if (px === p.entry) { res = "Empate"; pl = 0; S.balance += p.stake; }
    else if ((p.side === "up") === (px > p.entry)) { res = "Ganada"; pl = p.stake * PAYOUT; S.balance += p.stake + pl; }
    else { res = "Perdida"; pl = -p.stake; }
    S.history.unshift({ id: p.id, t: clock(), src: p.src, side: p.side, stake: p.stake, entry: p.entry, exit: px, res, pl });
    if (p.src === "Bot") botResolved(res, pl);
    else toast(`Operación #${p.id} ${res.toLowerCase()}: ${sign(pl)}`);
  }
  function ui() {
    $("#bal").textContent = money(S.balance);
    const tot = S.history.reduce((a, h) => a + h.pl, 0), e = $("#plTot"); e.textContent = sign(tot); e.className = tot > 0 ? "pos" : tot < 0 ? "neg" : "";
    const last = S.ticks[S.ticks.length - 1], prev = S.ticks[S.ticks.length - 11] ?? S.ticks[0], ch = (last - prev) / prev * 100;
    $("#px").textContent = fmt(last); const c = $("#pxch"); c.textContent = (ch >= 0 ? "▲ +" : "▼ ") + fmt(ch) + " %"; c.className = ch >= 0 ? "pos" : "neg";
    $("#openList").innerHTML = S.positions.length ? S.positions.map(p => { const now = last, win = (p.side === "up") === (now > p.entry), pl = now === p.entry ? 0 : win ? p.stake * PAYOUT : -p.stake; return `<div class="${p.side}"><span>#${p.id} ${p.side === "up" ? "▲ Compra" : "▼ Venta"} · ${money(p.stake)}</span><span class="${pl > 0 ? "pos" : pl < 0 ? "neg" : ""}">${sign(pl)} · ${p.left}t</span></div>`; }).join("") : '<p class="empty" style="padding:8px">Sin posiciones abiertas.</p>';
    $("#hist").innerHTML = S.history.map(h => `<tr><td>${h.id}</td><td>${h.t}</td><td>${h.src}</td><td>${h.side === "up" ? "▲ Compra" : "▼ Venta"}</td><td>${money(h.stake)}</td><td>${fmt(h.entry)}</td><td>${fmt(h.exit)}</td><td class="${h.res === "Ganada" ? "pos" : h.res === "Perdida" ? "neg" : ""}">${h.res}</td><td class="${h.pl > 0 ? "pos" : h.pl < 0 ? "neg" : ""}">${sign(h.pl)}</td></tr>`).join("");
    $("#histEmpty").hidden = S.history.length > 0;
  }

  /* ---------- bot ---------- */
  const COND = { rsi_lt: ["RSI(14) menor que", 30], rsi_gt: ["RSI(14) mayor que", 70], cross_up: ["Precio cruza SMA 20 al alza", null], cross_dn: ["Precio cruza SMA 20 a la baja", null], green_n: ["N velas verdes seguidas", 3], red_n: ["N velas rojas seguidas", 3] };
  const STATES = { idle: "Esperando", analyzing: "Analizando", executing: "Ejecutando simulación", open: "Operación simulada", done: "Finalizada" };
  function renderRules() {
    $("#rules").innerHTML = B.rules.map((r, i) => `<div class="rule"><span class="k">Cuando</span>
      <select class="in" data-i="${i}" data-k="cond" aria-label="Condición ${i + 1}">${Object.entries(COND).map(([k, v]) => `<option value="${k}"${r.cond === k ? " selected" : ""}>${v[0]}</option>`).join("")}</select>
      <input class="in" type="number" data-i="${i}" data-k="val" value="${r.val ?? ""}" ${COND[r.cond][1] === null ? "disabled" : ""} aria-label="Valor ${i + 1}">
      <span class="k">Entonces</span>
      <select class="in" data-i="${i}" data-k="act" aria-label="Acción ${i + 1}"><option value="up"${r.act === "up" ? " selected" : ""}>Comprar ▲</option><option value="down"${r.act === "down" ? " selected" : ""}>Vender ▼</option></select>
      <button class="x" data-rm="${i}" aria-label="Quitar regla ${i + 1}" type="button">✕</button></div>`).join("") || '<p class="empty">Agrega al menos una regla.</p>';
  }
  const setState = s => { B.state = s; $("#botChip").dataset.s = s; $("#botState").textContent = STATES[s]; $("#run").disabled = ["analyzing", "executing", "open"].includes(s); $("#stop").disabled = !$("#run").disabled; };
  const blog = m => { const l = $("#log"); if (l.firstElementChild && l.firstElementChild.dataset.init) l.innerHTML = ""; l.insertAdjacentHTML("afterbegin", `<p><b>${clock()}</b> ${m}</p>`); while (l.children.length > 30) l.lastChild.remove(); };
  const bstats = () => { $("#sN").textContent = B.n; $("#sW").textContent = B.wins; $("#sR").textContent = B.n ? Math.round(B.wins / B.n * 100) + " %" : "—"; const e = $("#sPL"); e.textContent = sign(B.pl); e.className = B.pl > 0 ? "pos" : B.pl < 0 ? "neg" : ""; };
  function evalRules() {
    const cs = candles(), cl = cs.map(c => c.c), n = cl.length, s20 = sma(cl, 20), R = rsi(cl);
    for (const r of B.rules) {
      const v = +r.val; let ok = false;
      if (r.cond === "rsi_lt") ok = R !== null && R < v;
      else if (r.cond === "rsi_gt") ok = R !== null && R > v;
      else if (r.cond === "cross_up") ok = s20[n - 2] != null && cl[n - 2] <= s20[n - 2] && cl[n - 1] > s20[n - 1];
      else if (r.cond === "cross_dn") ok = s20[n - 2] != null && cl[n - 2] >= s20[n - 2] && cl[n - 1] < s20[n - 1];
      else if (r.cond === "green_n" || r.cond === "red_n") { const k = Math.max(1, Math.round(v)); ok = n >= k && cs.slice(-k).every(c => r.cond === "green_n" ? c.c > c.o : c.c < c.o); }
      if (ok) return r;
    }
    return null;
  }
  function botTick() {
    if (B.state !== "analyzing" || B.busy || S.ticks.length % S.tf !== 0) return;
    const r = evalRules(); if (!r) { blog("Sin señal en esta vela."); return; }
    B.busy = true; setState("executing"); blog(`Señal: ${COND[r.cond][0]}${COND[r.cond][1] === null ? "" : " " + r.val} → ${r.act === "up" ? "comprar" : "vender"}.`);
    setTimeout(() => {
      if (B.state !== "executing") { B.busy = false; return; }
      const p = openPos(r.act, +$("#bStake").value, +$("#bDur").value, "Bot");
      B.busy = false; if (!p) { finish("No se pudo abrir la operación (saldo ficticio insuficiente)."); return; }
      setState("open"); blog(`Operación simulada #${p.id} abierta por ${money(p.stake)}.`);
    }, reduceMotion() ? 0 : 500);
  }
  function botResolved(res, pl) {
    B.n++; if (res === "Ganada") B.wins++; B.pl += pl; bstats(); blog(`Resultado: <b>${res}</b> ${sign(pl)}.`);
    if (B.state === "done") return;
    const max = +$("#bMax").value || 8, sl = +$("#bSl").value || 150, tp = +$("#bTp").value || 200;
    if (B.pl <= -sl) return finish("Se alcanzó la pérdida máxima.");
    if (B.pl >= tp) return finish("Se alcanzó la ganancia objetivo.");
    if (B.n >= max) return finish("Se completó el máximo de operaciones.");
    setState("analyzing");
  }
  function finish(msg) { setState("done"); blog(`<b>Finalizada.</b> ${msg} ${B.n} operaciones, P/L ${sign(B.pl)} (ficticio).`); restart(); }
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- bucle ---------- */
  function step() {
    S.ticks.push(genTick(Math.random));
    if (S.ticks.length > 9000) S.ticks.splice(0, 4800);
    S.positions = S.positions.filter(p => { p.left--; if (p.left <= 0) { settle(p); return false; } return true; });
    botTick(); ui(); draw();
  }
  function restart() { clearTimeout(B.timer); B.timer = setTimeout(loop, ["analyzing", "executing", "open"].includes(B.state) ? 140 : 500); }
  function loop() { if (!document.hidden) step(); restart(); }

  /* ---------- eventos ---------- */
  $$(".tabs button").forEach(b => b.addEventListener("click", () => { $$(".tabs button").forEach(x => x.setAttribute("aria-selected", x === b)); ["chart", "bot", "hist"].forEach(k => $("#v-" + k).hidden = k !== b.dataset.tab); if (b.dataset.tab === "chart") draw(); }));
  $("#tfSeg").addEventListener("click", e => { const b = e.target.closest("[data-tf]"); if (!b) return; S.tf = +b.dataset.tf; $$("#tfSeg button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
  $$("[data-ind]").forEach(c => c.addEventListener("change", () => { S.ind[c.dataset.ind] = c.checked; draw(); }));
  $$("[data-st]").forEach(b => b.addEventListener("click", () => { $("#stake").value = b.dataset.st; }));
  $("#buy").addEventListener("click", () => { const p = openPos("up", +$("#stake").value, +$("#dur").value, "Manual"); if (p) toast(`Compra simulada #${p.id} abierta.`); });
  $("#sell").addEventListener("click", () => { const p = openPos("down", +$("#stake").value, +$("#dur").value, "Manual"); if (p) toast(`Venta simulada #${p.id} abierta.`); });
  $("#addRule").addEventListener("click", () => { if (B.rules.length >= 6) return; B.rules.push({ cond: "rsi_gt", val: 70, act: "down" }); renderRules(); });
  $("#rules").addEventListener("change", e => { const t = e.target, i = +t.dataset.i, k = t.dataset.k; if (k === undefined) return; B.rules[i][k] = t.value; if (k === "cond") B.rules[i].val = COND[t.value][1]; renderRules(); });
  $("#rules").addEventListener("input", e => { const t = e.target; if (t.dataset.k === "val") B.rules[+t.dataset.i].val = t.value; });
  $("#rules").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { B.rules.splice(+b.dataset.rm, 1); renderRules(); } });
  $("#run").addEventListener("click", () => {
    if (!B.rules.length) { blog("Agrega al menos una regla."); return; }
    B.n = 0; B.wins = 0; B.pl = 0; B.busy = false; bstats(); $("#log").innerHTML = ""; setState("analyzing"); blog("Simulación iniciada: analizando velas…"); restart();
  });
  $("#stop").addEventListener("click", () => { finish("Detenida por el usuario."); });
  $("#reset").addEventListener("click", () => { S.balance = START; S.history = []; S.positions = []; B.n = B.wins = B.pl = 0; bstats(); setState("idle"); toast("Saldo ficticio reiniciado."); ui(); });
  addEventListener("resize", draw);
  if ("ResizeObserver" in window) new ResizeObserver(draw).observe(cv.parentElement);

  renderRules(); setState("idle"); bstats(); ui(); draw(); $("#log").firstElementChild.dataset.init = 1; restart();
})();
