export {};
    /* =========================================================
       CONFIGURACIÓN
       - url: ruta de la herramienta (ej. "herramientas/deriv.html").
         Vacía → "Explorar" muestra "Próximamente".
       - demo: true → se marca como Demo / simulación.
       - accent: color RGB de la tarjeta.
       ========================================================= */
    const CONTACT_EMAIL = "icaruswebservice@gmail.com";
    // WhatsApp: se arma al hacer clic (no queda como enlace visible en el HTML)
    const WA_PARTS = ["57", "316", "621", "9962"];
    const openWhatsApp = (msg: string) => { window.open("https://wa" + ".me/" + WA_PARTS.join("") + "?text=" + encodeURIComponent(msg), "_blank", "noopener,noreferrer"); };

    const ICONS = {
      helmet: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 20c3-10 27-10 30 0"/><path d="M24 12v6M32 10v6M40 12v6"/><path d="M16 40V30c0-8 6-13 16-13s16 5 16 13v10"/><path d="M24 33h6v5h-6zM34 33h6v5h-6z"/><path d="M32 33v14"/><path d="m16 40 2 11 6 4h4l-2-9M48 40l-2 11-6 4h-4l2-9"/></svg>',
      caduceus: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 12v46"/><circle cx="32" cy="9" r="3.2"/><path d="M30 20C22 12 14 15 7 12c4 8 12 10 23 12M34 20c8-8 16-5 23-8-4 8-12 10-23 12"/><path d="M32 28c-9 4 9 8 0 12s9 8 0 12M32 28c9 4-9 8 0 12s-9 8 0 12"/></svg>',
      bolt: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M38 5 15 36h14l-5 23 25-33H34z"/><path d="M10 14l-4-3M54 22l5-2M8 50l-4 3"/></svg>',
      bident: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 32v28"/><path d="M16 8v14c0 7 7 10 16 10s16-3 16-10V8"/><path d="m12 13 4-8 4 8M44 13l4-8 4 8"/><path d="M26 56h12"/></svg>'
    };

    /* device: "desktop" | "phone" (también se puede fijar dentro de cada página con
       <meta name="icarus-device" content="phone">). Las páginas reales viven en pages/<id>.html
       y el build las incrusta; mientras no existan se muestra una vista ilustrativa. */
    const TOOLS = [
      { id: "deriv", numeral: "I", name: "DERIV", god: "Atenea · la estrategia", category: "Trading & análisis", icon: "helmet", accent: "214, 40, 52", device: "phone", status: "live", page: "herramientas/trading-lab/",
        desc: "Panel para visualizar índices y movimientos de mercado en tiempo real, con lectura clara de tendencias.",
        features: ["Gráficos en vivo", "Indicadores", "Panel móvil"],
        details: ["Visualización de índices y velas", "Lectura rápida de tendencia y volatilidad", "Pensado para práctica y análisis"], demo: true, url: "" },
      { id: "nequi", numeral: "II", name: "NEQUI", god: "Hermes · el mensajero del comercio", category: "Finanzas & pagos", icon: "caduceus", accent: "224, 184, 100", device: "phone", status: "dev",
        desc: "Interfaz educativa para entender flujos de pagos, envíos y control de gastos del día a día.",
        features: ["Pagos", "Movimientos", "Metas"],
        details: ["Simulación de envíos y recargas", "Historial de movimientos", "Ideal para aprender flujos de pago"], demo: true, url: "" },
      { id: "binance", numeral: "III", name: "BINANCE", god: "Zeus · el rayo del mercado", category: "Cripto & activos digitales", icon: "bolt", accent: "255, 128, 56", device: "phone", status: "dev",
        desc: "Explora activos digitales, precios y portafolios con una vista simplificada y fácil de seguir.",
        features: ["Mercados", "Portafolio", "Seguimiento"],
        details: ["Seguimiento de precios de criptoactivos", "Vista de portafolio simulado", "Conceptos de mercado explicados"], demo: true, url: "" },
      { id: "daviplata", numeral: "IV", name: "DAVIPLATA", god: "Plutón · señor de las riquezas", category: "Pagos & finanzas", icon: "bident", accent: "170, 190, 220", device: "phone", status: "dev",
        desc: "Demo de billetera móvil para practicar transferencias, pagos y consultas desde una interfaz limpia.",
        features: ["Transferencias", "Pagos QR", "Saldo"],
        details: ["Simulación de transferencias", "Flujo de pagos con QR", "Consulta de saldo y movimientos"], demo: true, url: "" }
    ];

    /* ============ UTILIDADES ============ */
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => [...c.querySelectorAll(s)];
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const NS = "http://www.w3.org/2000/svg";
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    $("#year").textContent = new Date().getFullYear();
    $("#contactEmailText").textContent = CONTACT_EMAIL;

    /* ============ VISTAS PREVIAS ============ */
    const toolDevice = t => t.device || "desktop";
    const toolLive = t => t.status === "live" && !!t.page;
    const mkRand = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
    function mkCandles(n, seed) {
      const r = mkRand(seed); let p = 100; const out = [];
      for (let i = 0; i < n; i++) { const o = p, c = o + (r() - .46) * 9; out.push({ o, c, h: Math.max(o, c) + r() * 5, l: Math.min(o, c) - r() * 5 }); p = c; }
      return out;
    }
    function mkSpark(n, seed, up) {
      const r = mkRand(seed); let v = 50; const pts = [];
      for (let i = 0; i < n; i++) { v += (r() - (up ? .42 : .58)) * 12; pts.push(v); }
      const lo = Math.min(...pts), hi = Math.max(...pts) || 1;
      return pts.map((p, i) => `${(i / (n - 1) * 120).toFixed(1)},${(30 - (p - lo) / (hi - lo || 1) * 28 - 1).toFixed(1)}`).join(" ");
    }
    const mkIco = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    const MOCKS = {
      deriv() {
        const cs = mkCandles(52, 7), lo = Math.min(...cs.map(c => c.l)), hi = Math.max(...cs.map(c => c.h)), W = 880, H = 500, sx = W / cs.length;
        const y = v => H - 12 - (v - lo) / (hi - lo) * (H - 24);
        const bars = cs.map((c, i) => {
          const up = c.c >= c.o, col = up ? "#3ddc97" : "#ff5b61", x = i * sx + sx / 2;
          return `<line x1="${x}" y1="${y(c.h)}" x2="${x}" y2="${y(c.l)}" stroke="${col}" stroke-width="2"/><rect x="${x - sx * .3}" y="${y(Math.max(c.o, c.c))}" width="${sx * .6}" height="${Math.max(2, Math.abs(y(c.o) - y(c.c)))}" fill="${col}"/>`;
        }).join("");
        const grid = [1, 2, 3, 4].map(i => `<line x1="0" x2="${W}" y1="${H / 5 * i}" y2="${H / 5 * i}" stroke="#1c1f28"/>`).join("");
        return `<div class="mk mkd"><div class="mkd__top"><span class="mkd__logo">DERIV · DEMO</span><div class="mkd__tabs"><b>Gráfico</b><span>Posiciones</span><span>Historial</span></div><div class="mkd__px mk-blink">1.284,52<small>+0,84 %</small></div></div>
          <div class="mkd__body"><div class="mkd__main"><div class="mkd__sym">Índice de volatilidad · simulado<small>Datos ficticios con fines educativos</small></div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%">${grid}${bars}</svg></div>
          <div class="mkd__side"><span class="mk-lbl">Monto simulado</span><div class="mk-fld"><span>Stake</span><span>10,00 USD</span></div><span class="mk-lbl">Duración</span><div class="mk-fld"><span>Ticks</span><span>5</span></div><div class="mk-btn mk-up">Sube ▲</div><div class="mk-btn mk-dn">Baja ▼</div><div class="mk-row"><span>Pago potencial</span><span>19,50 USD</span></div><div class="mk-row"><span>Dinero real</span><span>No</span></div></div></div></div>`;
      },
      binance() {
        const rows = [["BTC", "Bitcoin", "64.210,50", "+2,31 %", 1, 11], ["ETH", "Ethereum", "3.145,20", "+1,12 %", 1, 23], ["BNB", "BNB", "585,40", "-0,64 %", 0, 35], ["SOL", "Solana", "148,90", "+4,08 %", 1, 47], ["XRP", "XRP", "0,5230", "-1,27 %", 0, 59]];
        const list = rows.map(r => `<div class="mkp__tx" style="grid-template-columns:44px 1fr 70px auto"><i>${r[0][0]}</i><span>${r[0]}<small>${r[1]}</small></span><svg viewBox="0 0 120 30" preserveAspectRatio="none" style="width:70px;height:26px"><polyline points="${mkSpark(20, r[5], r[4])}" fill="none" stroke="${r[4] ? "#3ddc97" : "#ff5b61"}" stroke-width="3"/></svg><span style="text-align:right"><b>${r[2]}</b><small class="${r[4] ? "mk-up-t" : "mk-dn-t"}">${r[3]}</small></span></div>`).join("");
        return `<div class="mk mkp"><div class="mkp__status"><span>9:41</span><span>● ● ▮</span></div><div class="mkp__hello">Mercados<small>Demo educativa · precios ficticios</small></div><div class="mkp__card"><small>Portafolio simulado</small><b>$ 12.480</b><div class="mkp__chips"><span>+3,2 % hoy</span><span>5 activos</span></div></div><h5>Mercados</h5>${list}<div class="mkp__tab"><b>Mercados</b><span>Portafolio</span><span>Aprender</span><span>Perfil</span></div></div>`;
      },
      nequi() {
        const tx = [["M", "Mercado La 14", "Hoy · 10:42", "-$ 38.500"], ["R", "Recarga simulada", "Ayer · 18:05", "-$ 10.000"], ["+", "Ingreso de práctica", "Lun · 09:12", "+$ 120.000"]].map(r => `<div class="mkp__tx"><i>${r[0]}</i><span>${r[1]}<small>${r[2]}</small></span><b>${r[3]}</b></div>`).join("");
        const acts = [["Enviar", '<path d="M5 12h14M13 6l6 6-6 6"/>'], ["Recargar", '<path d="M12 5v14M5 12h14"/>'], ["Metas", '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'], ["QR", '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z"/>']].map(a => `<div><i>${mkIco(a[1])}</i>${a[0]}</div>`).join("");
        return `<div class="mk mkp"><div class="mkp__status"><span>9:41</span><span>● ● ▮</span></div><div class="mkp__hello">Hola, Ícaro<small>Demo educativa · sin dinero real</small></div><div class="mkp__card"><small>Saldo simulado</small><b>$ 248.500</b><div class="mkp__chips"><span>Disponible</span><span>Meta 62 %</span></div></div><div class="mkp__acts">${acts}</div><h5>Movimientos</h5>${tx}<div class="mkp__tab"><b>Inicio</b><span>Pagos</span><span>Metas</span><span>Perfil</span></div></div>`;
      },
      daviplata() {
        const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<span>${k}</span>`).join("");
        return `<div class="mk mkp mkp--pay"><div class="mkp__status"><span>9:41</span><span>● ● ▮</span></div><div class="mkp__hello">Enviar plata<small>Demo educativa · sin dinero real</small></div><div class="mkp__to"><i>C</i><span>Camila R.<small>300 ••• ••45 · contacto de práctica</small></span></div><div class="mkp__amt">$ 50.000</div><div class="mkp__avail">Saldo simulado $ 248.500</div><div class="mkp__keys">${keys}</div><div class="mkp__go">Confirmar envío</div></div>`;
      }
    };
    const scenePx = d => d === "phone" ? [390, 844] : [1280, 800];
    function sceneHTML(t, dev, extra = "") {
      const [w, h] = scenePx(dev), live = toolLive(t);
      return `<div class="shot__scene shot__scene--${dev} ${extra}" data-w="${w}" data-h="${h}">${live ? `<iframe data-page="${esc(t.page)}" title="Vista de ${esc(t.name)}" tabindex="-1" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>` : MOCKS[t.id](t)}</div>`;
    }
    function hydrate(root) { $$("iframe[data-page]", root).forEach(f => { f.src = f.dataset.page; f.removeAttribute("data-page"); }); }
    function fitScene(sc, view) {
      const sw = +sc.dataset.w, sh = +sc.dataset.h, vw = view.clientWidth, vh = view.clientHeight; if (!vw || !vh) return;
      if (sc.classList.contains("shot__scene--phone")) { const k = Math.min(vw * .5 / sw, (vh - 14) / sh * 1.9); sc.style.transform = `scale(${k})`; sc.style.left = (vw - sw * k) / 2 + "px"; sc.style.top = "16px"; }
      else { const k = Math.min(vw / sw, vh / sh); sc.style.transform = `scale(${k})`; sc.style.left = (vw - sw * k) / 2 + "px"; sc.style.top = (vh - sh * k) / 2 + "px"; }
    }

    /* ============ TARJETAS ============ */
    const grid = $("#toolsGrid");
    grid.innerHTML = TOOLS.map((t, i) => {
      const dev = toolDevice(t), live = toolLive(t), isDev = t.status === "dev";
      return `
      <article class="tool tablet reveal${isDev ? " is-dev" : ""}" style="--accent:${t.accent}; --d:${i * 0.09}s" data-tilt>
        <span class="tool__numeral" aria-hidden="true">${t.numeral}</span>
        <div class="tool__top">
          <div class="medal" aria-hidden="true">${ICONS[t.icon]}</div>
          <span class="seals">${t.demo ? '<span class="seal" title="Simulación con fines educativos">Demo</span>' : ""}<span class="seal seal--lock" title="Sin registro ni rastreo">Anónimo</span></span>
        </div>
        <div class="tool__meta">
          <p class="tool__god">${t.god}</p>
          <h3 class="tool__name">${t.name}</h3>
          <p class="tool__cat">${t.category}</p>
        </div>
        <div class="tool__shot"${isDev ? ` role="img" aria-label="Vista previa de ${t.name} (en desarrollo)"` : ` role="button" tabindex="0" data-view="${t.id}" aria-label="Probar la vista previa de ${t.name}"`}>
          <div class="shot__bar" aria-hidden="true"><i></i><i></i><i></i><span>icarus.marketing/${t.id}</span></div>
          <div class="shot__view">${sceneHTML(t, dev)}</div>
          ${isDev ? '<div class="shot__dev"><span>En desarrollo</span></div>' : `<div class="shot__cta" aria-hidden="true"><span>Probar ${arrow}</span></div><span class="shot__tag">En vivo</span>`}
        </div>
        <p class="tool__desc">${t.desc}</p>
        <ul class="tool__features" aria-label="Funciones">${t.features.map(f => `<li>${f}</li>`).join("")}</ul>
        <div class="tool__actions">
          ${isDev ? `<button type="button" class="btn btn--primary btn--sm" data-open="${t.id}" data-soon="1" aria-label="Explorar ${t.name} (en desarrollo)">Explorar ${arrow}</button>` : `<button type="button" class="btn btn--primary btn--sm" data-view="${t.id}" aria-label="Explorar ${t.name}">Explorar ${arrow}</button>`}
          <button type="button" class="btn btn--ghost btn--sm" data-open="${t.id}" aria-label="Conocer más sobre ${t.name}">Conocer más</button>
          ${live ? '<span class="avail" role="status">¡Disponible!</span>' : ""}
        </div>
      </article>`;
    }).join("");
    (function () {
      const shots = $$(".tool__shot", grid);
      const fitAll = () => shots.forEach(s => fitScene($(".shot__scene", s), $(".shot__view", s)));
      if ("ResizeObserver" in window) { const ro = new ResizeObserver(fitAll); shots.forEach(s => ro.observe(s)); }
      addEventListener("resize", fitAll); fitAll();
      // las páginas reales se cargan solo cuando la tarjeta está cerca de la pantalla
      const lazy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { hydrate(e.target); lazy.unobserve(e.target); } }), { rootMargin: "300px" });
      shots.forEach(s => lazy.observe(s));
    })();

    /* ============ FRONTÓN: rayos del sol ============ */
    (function () {
      const g = $("#pedRays"); if (!g) return;
      let h = "";
      for (let i = 0; i < 17; i++) {
        const a = Math.PI + (i / 16) * Math.PI; // semicírculo superior
        const x1 = Math.cos(a) * 36, y1 = Math.sin(a) * 36, x2 = Math.cos(a) * (i % 2 ? 50 : 62), y2 = Math.sin(a) * (i % 2 ? 50 : 62);
        h += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(232,201,134,${i % 2 ? .5 : .8})" stroke-width="${i % 2 ? 1.4 : 2}" stroke-linecap="round"/>`;
      }
      g.innerHTML = h;
    })();

    /* ============ LAURELES ============ */
    $$("[data-laurel]").forEach(svg => {
      const cx = 150, cy = 145, r = 118, N = 14;
      const P = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
      const [sx, sy] = P(100), [ex, ey] = P(260);
      let h = `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} A${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="#c9a35a" stroke-width="2.2" stroke-linecap="round"/>`;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1), th = 100 + t * 160, [x, y] = P(th);
        const s = .72 + .5 * Math.sin(Math.PI * t), tan = th + 90;
        [-1, 1].forEach(sg => {
          h += `<ellipse cx="${(14 * s).toFixed(1)}" cy="0" rx="${(14 * s).toFixed(1)}" ry="${(5.2 * s).toFixed(1)}" fill="url(#g-leaf)" opacity="${sg > 0 ? .95 : .7}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(tan + sg * 40).toFixed(1)})"/>`;
        });
      }
      h += `<ellipse cx="15" cy="0" rx="15" ry="5.6" fill="url(#g-leaf)" transform="translate(${ex.toFixed(1)} ${ey.toFixed(1)}) rotate(${(260 + 90 + 8).toFixed(1)})"/>`;
      svg.innerHTML = h;
    });

    /* ============ NAVBAR ============ */
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 24);
    onScroll(); addEventListener("scroll", onScroll, { passive: true });

    const toggle = $("#navToggle"), menu = $("#mobileMenu");
    const setMenu = open => {
      toggle.setAttribute("aria-expanded", open);
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      menu.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    $$("a", menu).forEach(a => a.addEventListener("click", () => setMenu(false)));
    addEventListener("resize", () => { if (innerWidth > 1000) setMenu(false); });

    const links = $$("[data-link]");
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(l => l.classList.toggle("is-active", l.getAttribute("href") === "#" + e.target.id));
    }), { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(l => { const s = $(l.getAttribute("href")); s && spy.observe(s); });

    /* ============ REVEAL ============ */
    const revealer = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); revealer.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal").forEach(el => revealer.observe(el));

    /* ============ PARALLAX SUAVE (solo escritorio) ============ */
    if (!reduceMotion && finePointer) {
      const layers = $$("[data-depth]");
      let raf = null, mx = 0, my = 0;
      const apply = () => {
        const sy = Math.min(scrollY, 900);
        layers.forEach(l => {
          const k = +l.dataset.depth;
          if (l.classList.contains("hero__sun")) { l.style.translate = `${mx * k}px ${my * k + sy * .05}px`; }
          else l.style.transform = `translate3d(${mx * k}px, ${sy * k * -.012}px, 0)`;
        });
        raf = null;
      };
      addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; raf = raf || requestAnimationFrame(apply); }, { passive: true });
      addEventListener("scroll", () => { raf = raf || requestAnimationFrame(apply); }, { passive: true });
    }

    /* ============ TARJETAS: LUZ + INCLINACIÓN ============ */
    if (finePointer) {
      $$("[data-tilt]").forEach(card => {
        card.addEventListener("pointermove", e => {
          const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          card.style.setProperty("--mx", x * 100 + "%"); card.style.setProperty("--my", y * 100 + "%");
          if (!reduceMotion) card.style.transform = `perspective(1100px) rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-5px)`;
        });
        card.addEventListener("pointerleave", () => { card.style.transform = ""; card.style.setProperty("--my", "0%"); });
      });
    }

    /* ============ BRASAS (canvas ligero) ============ */
    (function () {
      if (reduceMotion) return;
      const cv = $("#embers"), ctx = cv.getContext("2d");
      const DPR = Math.min(devicePixelRatio || 1, 1.5);
      let W = 0, H = 0, parts = [], running = true;
      const make = (init) => ({
        x: Math.random() * W, y: init ? Math.random() * H : H + 10,
        r: .6 + Math.random() * 1.9, vy: .18 + Math.random() * .55, vx: (Math.random() - .5) * .25,
        ph: Math.random() * 6.28, sp: .01 + Math.random() * .02, a: .25 + Math.random() * .6, hot: Math.random()
      });
      const resize = () => {
        W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        const n = W < 700 ? 14 : 38; parts = Array.from({ length: n }, () => make(true));
      };
      resize(); addEventListener("resize", resize);
      document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) requestAnimationFrame(tick); });
      function tick() {
        if (!running) return;
        ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i]; p.y -= p.vy; p.ph += p.sp; p.x += p.vx + Math.sin(p.ph) * .35;
          if (p.y < -12) { parts[i] = make(false); continue; }
          const fade = Math.min(1, p.y / (H * .35)) * (.6 + .4 * Math.sin(p.ph * 3));
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
          g.addColorStop(0, `rgba(255,${150 + p.hot * 70 | 0},80,${p.a * fade})`); g.addColorStop(1, "rgba(255,90,40,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })();

    /* ============ MODAL ============ */
    const modal = $("#toolModal"), card = $("#modalCard");
    let lastFocus = null;
    function openModal(tool, soon = false) {
      lastFocus = document.activeElement;
      card.style.setProperty("--accent", tool.accent);
      $("#modalCat").textContent = tool.god + " · " + tool.category;
      $("#modalTitle").textContent = tool.name;
      $("#modalBody").innerHTML = `
        ${soon ? `<p><strong style="color:#fff">En desarrollo.</strong> Esta herramienta aún se está forjando dentro de ICARUS; pronto estará disponible.</p>` : ""}
        <p>${tool.desc}</p>
        <ul>${tool.details.map(d => `<li>${d}</li>`).join("")}</ul>
        ${tool.demo ? `<p class="modal__warn">Demo / simulación con fines educativos. No ejecuta operaciones reales ni está conectada a cuentas de ${tool.name}. ICARUS no es un producto oficial de ${tool.name}.</p>` : ""}
        <p class="vow vow--plain" style="margin-top:0">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'}<span><b>Anónimo.</b> Sin registro, sin rastreo; todo ocurre en tu navegador.</span></p>`;
      $("#modalActions").innerHTML = (toolLive(tool)
        ? `<button type="button" class="btn btn--primary" data-try="${tool.id}">Probar ahora ${arrow}</button>`
        : "")
        + `<button type="button" class="btn btn--ghost" data-wa="${tool.name}">Contactar</button><button class="btn btn--ghost" data-close>Cerrar</button>`;
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add("is-open"));
      document.body.style.overflow = "hidden";
      $("#modalClose").focus();
    }
    function closeModal() {
      modal.classList.remove("is-open"); document.body.style.overflow = "";
      setTimeout(() => { modal.hidden = true; }, reduceMotion ? 0 : 400);
      lastFocus && lastFocus.focus();
    }
    /* ============ VISOR INTERACTIVO ============ */
    const viewer = $("#viewer"), vwDev = $("#vwDev"), vwStage = $("#vwStage");
    let vwTool = null, vwMode = "desktop", vwLast = null;
    const vwOpen = () => viewer.classList.contains("is-open");
    function fitViewerMock() {
      const sc = $(".shot__scene", vwDev); if (!sc || !vwDev.classList.contains("is-mock")) return;
      const sw = +sc.dataset.w, sh = +sc.dataset.h, m = innerWidth <= 700 ? 8 : 32;
      const k = Math.min((vwStage.clientWidth - m) / sw, (vwStage.clientHeight - m) / sh, 1.25);
      sc.style.transform = `scale(${k})`; sc.style.left = "0"; sc.style.top = "0";
      vwDev.style.width = sw * k + "px"; vwDev.style.height = sh * k + "px";
      vwDev.style.borderRadius = sc.classList.contains("shot__scene--phone") ? 46 * k + "px" : "10px";
    }
    function renderViewer() {
      const t = vwTool, live = toolLive(t);
      vwDev.className = "viewer__dev"; vwDev.removeAttribute("style");
      $("#vwSeg").hidden = !live;
      $$("#vwSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.dev === vwMode));
      $("#vwNew").hidden = !live;
      if (live) {
        vwDev.classList.add(vwMode === "phone" ? "is-phone" : "is-desktop");
        vwDev.innerHTML = `<iframe title="${esc(t.name)} — vista interactiva" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
        $("iframe", vwDev).src = t.page;
        $("#vwNote").innerHTML = `Demo interactiva que corre en tu navegador. <b>Sin registro ni rastreo.</b> Nunca escribas datos bancarios reales.`;
      } else {
        vwDev.classList.add("is-mock");
        vwDev.innerHTML = sceneHTML(t, vwMode, "shot__scene--bare");
        $("#vwNote").innerHTML = `Simulación independiente, no es la app original. <b>Sin mercado real ni dinero real.</b> Anónimo, sin registro ni rastreo.`;
        fitViewerMock(); requestAnimationFrame(fitViewerMock);
      }
    }
    function openViewer(id) {
      const t = TOOLS.find(x => x.id === id); if (!t) return;
      vwTool = t; vwMode = toolDevice(t); vwLast = document.activeElement;
      viewer.style.setProperty("--accent", t.accent);
      $("#vwTitle").textContent = t.name; $("#vwSeal").hidden = !t.demo;
      renderViewer();
      viewer.setAttribute("aria-hidden", "false"); viewer.classList.add("is-open");
      document.body.style.overflow = "hidden";
      $("#vwClose").focus();
    }
    function closeViewer() {
      viewer.classList.remove("is-open"); viewer.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
      setTimeout(() => { if (!vwOpen()) vwDev.innerHTML = ""; }, reduceMotion ? 0 : 450);
      vwLast && vwLast.focus && vwLast.focus();
    }
    $("#vwClose").addEventListener("click", closeViewer);
    $("#vwReload").addEventListener("click", renderViewer);
    $("#vwSeg").addEventListener("click", e => { const b = e.target.closest("[data-dev]"); if (b) { vwMode = b.dataset.dev; renderViewer(); } });
    $("#vwNew").addEventListener("click", () => {
      if (!vwTool || !toolLive(vwTool)) return;
      window.open(vwTool.page, "_blank", "noopener");
    });
    addEventListener("resize", () => { if (vwOpen()) fitViewerMock(); });

    grid.addEventListener("click", e => {
      const v = e.target.closest("[data-view]"); if (v) { e.preventDefault(); return openViewer(v.dataset.view); }
      const btn = e.target.closest("[data-open]"); if (!btn) return;
      const tool = TOOLS.find(t => t.id === btn.dataset.open);
      e.preventDefault(); openModal(tool, btn.dataset.soon === "1");
    });
    grid.addEventListener("keydown", e => {
      const s = e.target.closest(".tool__shot"); if (!s || e.target !== s) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(s.dataset.view); }
    });
    modal.addEventListener("click", e => {
      const wa = e.target.closest("[data-wa]");
      if (wa) { e.preventDefault(); return openWhatsApp(`Hola, quiero más información sobre ${wa.dataset.wa} de ICARUS.`); }
      const tr = e.target.closest("[data-try]");
      if (tr) { const id = tr.dataset.try; closeModal(); return setTimeout(() => openViewer(id), 60); }
      if (e.target === modal || e.target.closest("[data-close]") || e.target.closest("#modalClose")) closeModal();
    });
    addEventListener("keydown", e => {
      if (e.key === "Escape") { if (vwOpen()) return closeViewer(); if (modal.classList.contains("is-open")) closeModal(); if (menu.classList.contains("is-open")) setMenu(false); }
      if (e.key === "Tab" && vwOpen()) {
        const f = $$("button:not([hidden])", viewer).filter(b => b.offsetParent !== null || b === document.activeElement), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !viewer.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !viewer.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      } else if (e.key === "Tab" && modal.classList.contains("is-open")) {
        const f = $$("a, button", card), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* =========================================================
       LA FORJA WEB — configurador de páginas y cotización
       Edita aquí precios, textos y datos de envío.
       ========================================================= */
    const FORGE_WHATSAPP = "";        // ej. "573001234567" (código de país + número). Vacío = oculta el botón
    const FORGE_URGENT_PCT = 0.25;    // recargo por entrega urgente (25%)
    const FORGE_CUSTOM_PRICE = 80000; // precio de cada "sección a medida"

    const F_TYPES = {
      landing:    { name: "Landing page",           sub: "1 página para vender o captar clientes",   base: 250000,  days: 5,  preset: ["hero", "servicios", "testimonios", "cta", "contacto"] },
      sitio:      { name: "Sitio web corporativo",  sub: "Hasta 5 páginas internas",                 base: 650000,  days: 12, preset: ["hero", "nosotros", "servicios", "equipo", "faq", "contacto"] },
      portafolio: { name: "Portafolio / marca personal", sub: "Muestra tu trabajo con estilo",       base: 420000,  days: 8,  preset: ["hero", "nosotros", "galeria", "testimonios", "contacto"] },
      tienda:     { name: "Tienda online",          sub: "Catálogo de productos y carrito",          base: 1100000, days: 20, preset: ["hero", "servicios", "galeria", "testimonios", "faq", "contacto"] }
    };

    const F_SECTIONS = [
      { id: "hero",        name: "Portada (hero)",         desc: "Título, frase y botones principales", price: 0 },
      { id: "nosotros",    name: "Sobre nosotros",         desc: "Tu historia y propuesta de valor",    price: 40000 },
      { id: "servicios",   name: "Servicios / beneficios", desc: "Tarjetas con lo que ofreces",         price: 50000 },
      { id: "galeria",     name: "Galería / portafolio",   desc: "Cuadrícula de imágenes o trabajos",   price: 70000 },
      { id: "testimonios", name: "Testimonios",            desc: "Opiniones de tus clientes",           price: 45000 },
      { id: "precios",     name: "Planes y precios",       desc: "Tabla comparativa de planes",         price: 60000 },
      { id: "faq",         name: "Preguntas frecuentes",   desc: "Acordeón de dudas comunes",           price: 35000 },
      { id: "equipo",      name: "Equipo",                 desc: "Fotos y cargos de tu gente",          price: 45000 },
      { id: "proceso",     name: "Cómo funciona",          desc: "Pasos numerados de tu proceso",       price: 40000 },
      { id: "estadisticas",name: "Cifras y logros",        desc: "Contadores animados",                 price: 35000 },
      { id: "video",       name: "Video destacado",        desc: "Video incrustado de tu marca",        price: 40000 },
      { id: "mapa",        name: "Ubicación y mapa",       desc: "Dirección, horarios y mapa",          price: 35000 },
      { id: "cta",         name: "Llamado a la acción",    desc: "Banner para cerrar la venta",         price: 25000 },
      { id: "contacto",    name: "Formulario de contacto", desc: "Campos y datos para escribirte",      price: 60000 },
      { id: "blog",        name: "Blog / noticias",        desc: "Listado de artículos",                price: 90000 },
      { id: "newsletter",  name: "Suscripción por correo", desc: "Captura de emails",                   price: 40000 }
    ];

    const F_EXTRAS = [
      { group: "Diseño y movimiento", items: [
        { id: "anim",    name: "Animaciones al hacer scroll",       desc: "Las secciones aparecen con fluidez",           price: 60000 },
        { id: "parallax",name: "Animaciones avanzadas / parallax",  desc: "Efectos de profundidad y microinteracciones",  price: 120000 },
        { id: "dark",    name: "Modo claro / oscuro",               desc: "El visitante elige su tema",                   price: 70000 },
        { id: "logo",    name: "Diseño de logo básico",             desc: "Logotipo y variantes en alta calidad",         price: 150000 },
        { id: "imgs",    name: "Banco de imágenes curado",          desc: "Selección y edición de fotos",                 price: 50000 }
      ]},
      { group: "Funciones", items: [
        { id: "wsp",     name: "Botón flotante de WhatsApp",        desc: "Chat directo con un clic",                     price: 25000 },
        { id: "mailform",name: "Formulario conectado a tu correo",  desc: "Los mensajes llegan a tu bandeja",             price: 40000 },
        { id: "stats",   name: "Google Analytics y píxeles",        desc: "Mide visitas y campañas",                      price: 40000 },
        { id: "booking", name: "Calendario de reservas",            desc: "Agenda citas desde la página",                 price: 80000 },
        { id: "lang",    name: "Multi-idioma (ES / EN)",            desc: "Tu sitio en dos idiomas",                      price: 150000 },
        { id: "pay",     name: "Pasarela de pagos",                 desc: "Cobra en línea con tarjeta o PSE",             price: 250000 },
        { id: "cms",     name: "Panel para editar contenido",       desc: "Cambia textos e imágenes tú mismo",            price: 300000 }
      ]},
      { group: "Contenido y SEO", items: [
        { id: "seo",     name: "SEO básico",                        desc: "Metaetiquetas, sitemap y estructura",          price: 80000 },
        { id: "copy",    name: "Redacción de textos",               desc: "Copywriting para todas las secciones",         price: 120000 },
        { id: "speed",   name: "Optimización de velocidad",         desc: "Imágenes ligeras y carga rápida",              price: 70000 }
      ]},
      { group: "Publicación", items: [
        { id: "domain",  name: "Dominio (1 año)",                   desc: "Compra y configuración del dominio",           price: 70000 },
        { id: "hosting", name: "Hosting + SSL (1 año)",             desc: "Tu sitio en línea y seguro",                   price: 120000 },
        { id: "maint",   name: "Mantenimiento (3 meses)",           desc: "Cambios menores y soporte",                    price: 150000 }
      ]}
    ];
    const F_EXTRA_MAP = Object.fromEntries(F_EXTRAS.flatMap(g => g.items).map(e => [e.id, e]));

    const F_THEMES = {
      oscuro:   { name: "Oscuro moderno",  bg: "#0f1117", fg: "#f3f4f6", mu: "#9aa0ab", card: "#181b24" },
      claro:    { name: "Minimal claro",   bg: "#ffffff", fg: "#14161a", mu: "#6b7280", card: "#f1f2f5" },
      dorado:   { name: "Elegante dorado", bg: "#14110d", fg: "#f6ecd6", mu: "#b3a58a", card: "#201a13" },
      vibrante: { name: "Vibrante cálido", bg: "#fff6ec", fg: "#241a3d", mu: "#6e6288", card: "#ffffff" },
      neon:     { name: "Neón nocturno",   bg: "#070a14", fg: "#e8fbff", mu: "#7fa1b3", card: "#0e1424" }
    };
    const F_ACCENTS = ["#e0303c", "#c9a35a", "#8b5cf6", "#14b8a6", "#3b82f6", "#22c55e", "#f97316", "#ec4899"];

    const F_ICONS = {
      hero: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 20h10"/>',
      nosotros: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
      servicios: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
      galeria: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
      testimonios: '<path d="M4 6h7v6H7c0 3-1 4-3 5M13 6h7v6h-4c0 3-1 4-3 5"/>',
      precios: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
      faq: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
      equipo: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5M16 14.5c3 0 5 1.8 5 4.5"/>',
      proceso: '<circle cx="5" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><path d="m7 17 3-3M14 11l3-3"/>',
      estadisticas: '<path d="M5 20V10M12 20V4M19 20v-8"/>',
      video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
      mapa: '<path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
      cta: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
      contacto: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>',
      blog: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
      newsletter: '<rect x="3" y="6" width="14" height="12" rx="1"/><path d="m3 8 7 5 7-5M20 4v6M17 7h6"/>',
      custom: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>'
    };
    const fIcon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${F_ICONS[k] || F_ICONS.custom}</svg>`;
    const F_STEPS = ["Proyecto", "Secciones", "Extras", "Enviar"];
    const F_ROMAN = ["I", "II", "III", "IV"];

    /* ---------- estado + persistencia ---------- */
    const F_KEY = "icarus.forge.v1";
    const fDefault = () => ({ step: 0, type: "landing", theme: "oscuro", accent: "#e0303c", name: "", tagline: "", sections: [...F_TYPES.landing.preset], customs: {}, extras: [], urgent: false, dirty: false, contact: { name: "", email: "", phone: "", notes: "" } });
    const fSecInfo = id => id.startsWith("custom:")
      ? { id, name: (F.customs[id] && F.customs[id].title) || "Sección a medida", price: FORGE_CUSTOM_PRICE, custom: true }
      : F_SECTIONS.find(s => s.id === id);
    function fLoad() {
      const d = fDefault();
      try {
        const s = JSON.parse(localStorage.getItem(F_KEY) || "null");
        if (s && typeof s === "object") {
          Object.assign(d, s, { contact: { ...d.contact, ...(s.contact || {}) } });
          if (!F_TYPES[d.type]) d.type = "landing";
          if (!F_THEMES[d.theme]) d.theme = "oscuro";
          if (!/^#[0-9a-f]{6}$/i.test(d.accent)) d.accent = "#e0303c";
          d.customs = d.customs && typeof d.customs === "object" ? d.customs : {};
          d.sections = (Array.isArray(d.sections) ? d.sections : []).filter(id => typeof id === "string" && (F_SECTIONS.some(x => x.id === id) || (id.startsWith("custom:") && d.customs[id])));
          d.extras = (Array.isArray(d.extras) ? d.extras : []).filter(id => F_EXTRA_MAP[id]);
          if (d.sections[0] !== "hero") d.sections = ["hero", ...d.sections.filter(id => id !== "hero")];
          d.step = Math.min(Math.max(+d.step || 0, 0), 3);
        }
      } catch (e) { /* sin almacenamiento: seguimos con valores por defecto */ }
      return d;
    }
    let F = fLoad(), fSaveT, fSent = null, fShownTotal = 0, fAnim = null;
    function fSave() { clearTimeout(fSaveT); fSaveT = setTimeout(() => { try { localStorage.setItem(F_KEY, JSON.stringify(F)); } catch (e) { /* ignorar */ } }, 250); }

    const fmtCOP = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

    /* ---------- cotización ---------- */
    function fQuote() {
      const t = F_TYPES[F.type];
      const lines = [{ label: t.name + " · base", price: t.base }];
      F.sections.forEach(id => { if (id !== "hero") { const s = fSecInfo(id); lines.push({ label: s.name, price: s.price }); } });
      F.extras.forEach(id => { const e = F_EXTRA_MAP[id]; lines.push({ label: e.name, price: e.price }); });
      const subtotal = lines.reduce((a, l) => a + l.price, 0);
      const surcharge = F.urgent ? Math.round(subtotal * FORGE_URGENT_PCT / 1000) * 1000 : 0;
      if (surcharge) lines.push({ label: `Entrega urgente (+${Math.round(FORGE_URGENT_PCT * 100)}%)`, price: surcharge });
      let days = t.days + Math.ceil((F.sections.length - 1) * 0.5 + F.extras.length * 0.6);
      if (F.urgent) days = Math.max(3, Math.ceil(days * 0.55));
      return { lines, subtotal, surcharge, total: subtotal + surcharge, days };
    }

    /* ---------- vista previa ---------- */
    const pvBars = (...w) => w.map(x => `<div class="pv-line w${x}"></div>`).join("");
    const PV = {
      hero: (n, t) => `<div class="pv-hero"><small>${esc(n.toUpperCase())}</small><h4>${esc(t)}</h4>${pvBars(60, 40)}<span class="pv-btn">Comenzar</span><span class="pv-btn pv-btn--o">Saber más</span></div>`,
      nosotros: () => `<div class="pv-split"><div class="pv-img"></div><div><div class="pv-h">Sobre nosotros</div>${pvBars(100, 80, 60)}</div></div>`,
      servicios: () => `<div class="pv-h">Servicios</div><div class="pv-grid3">${('<div class="pv-card"><div class="pv-ico"></div>' + pvBars(80, 60) + '</div>').repeat(3)}</div>`,
      galeria: () => `<div class="pv-h">Galería</div><div class="pv-grid3">${'<div class="pv-img"></div>'.repeat(6)}</div>`,
      testimonios: () => `<div class="pv-h">Lo que dicen</div><div class="pv-grid2">${('<div class="pv-card"><div class="pv-av"></div>' + pvBars(100, 80) + '</div>').repeat(2)}</div>`,
      precios: () => `<div class="pv-h">Planes</div><div class="pv-grid3">${'<div class="pv-card"><div class="pv-num">$</div>' + pvBars(80, 60) + '</div>'}${'<div class="pv-card pv-card--hi"><div class="pv-num">$$</div>' + pvBars(80, 60) + '</div>'}${'<div class="pv-card"><div class="pv-num">$$$</div>' + pvBars(80, 60) + '</div>'}</div>`,
      faq: () => `<div class="pv-h">Preguntas frecuentes</div>${('<div class="pv-faq"><div class="pv-line w60" style="margin:0"></div><i></i></div>').repeat(4)}`,
      equipo: () => `<div class="pv-h">Equipo</div><div class="pv-grid4">${('<div><div class="pv-av"></div>' + pvBars(80) + '</div>').repeat(4)}</div>`,
      proceso: () => `<div class="pv-h">Cómo funciona</div><div class="pv-grid3">${[1, 2, 3].map(n => `<div class="pv-step"><em>${n}</em>${pvBars(80)}</div>`).join("")}</div>`,
      estadisticas: () => `<div class="pv-grid4">${["12K", "98%", "5★", "24h"].map(n => `<div><div class="pv-num">${n}</div>${pvBars(80)}</div>`).join("")}</div>`,
      video: () => `<div class="pv-h">Mira cómo trabajamos</div><div class="pv-play"></div>`,
      mapa: () => `<div class="pv-h">Dónde estamos</div><div class="pv-map"></div>`,
      cta: () => `<div class="pv-sec pv-cta" style="margin:-20px -16px;border:0"><div class="pv-h">¿Listo para empezar?</div><span class="pv-btn">Contáctanos</span></div>`,
      contacto: () => `<div class="pv-h">Contacto</div><div class="pv-field"></div><div class="pv-field"></div><div class="pv-field" style="height:34px"></div><span class="pv-btn">Enviar</span>`,
      blog: () => `<div class="pv-h">Blog</div><div class="pv-grid3">${('<div class="pv-card"><div class="pv-img" style="margin-bottom:6px"></div>' + pvBars(100, 60) + '</div>').repeat(3)}</div>`,
      newsletter: () => `<div class="pv-h">Suscríbete</div><div class="pv-sub"><div class="pv-field"></div><span class="pv-btn">Unirme</span></div>`
    };
    const pvLabel = id => (fSecInfo(id) || {}).name || "";
    function fAccentOn(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? "#14110d" : "#ffffff"; }

    function renderPreview(flashId?) {
      const th = F_THEMES[F.theme], nm = F.name.trim() || "Tu negocio", tg = F.tagline.trim() || "Tu frase principal va aquí";
      const blocks = F.sections.map(id => {
        const isNew = id === flashId ? " pv-new" : "";
        let inner;
        if (id.startsWith("custom:")) inner = `<div class="pv-custom">${esc(fSecInfo(id).name)}</div>`;
        else if (id === "hero") return `<section class="pv-sec${isNew}" data-id="${id}" style="padding:0">${PV.hero(nm, tg)}</section>`;
        else inner = PV[id](nm, tg);
        return `<section class="pv-sec${isNew}" data-id="${esc(id)}"><span class="pv-tag">${esc(pvLabel(id))}</span>${inner}</section>`;
      }).join("");
      const html = `<div class="pv" style="--pbg:${th.bg};--pfg:${th.fg};--pmu:${th.mu};--pcard:${th.card};--pac:${F.accent};--pon:${fAccentOn(F.accent)}">
        <div class="pv-nav"><b>${esc(nm)}</b><span class="pv-dots"><i></i><i></i><i></i></span><span class="pv-btn" style="margin:0;padding:4px 9px">Contacto</span></div>
        ${blocks}
        <div class="pv-foot"><b>${esc(nm)}</b><span>© ${new Date().getFullYear()} · Todos los derechos reservados</span></div></div>`;
      const view = $("#pvView"), keep = view.scrollTop;
      view.innerHTML = html;
      view.setAttribute("aria-label", "Vista previa de tu página con: " + F.sections.map(pvLabel).join(", "));
      view.scrollTop = keep;
      const slug = nm.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "") || "tunegocio";
      $("#pvUrl").textContent = `www.${slug}.com`;
      if (flashId) {
        const el = view.querySelector(`[data-id="${CSS.escape(flashId)}"]`);
        if (el) view.scrollTo({ top: Math.max(0, el.offsetTop - view.clientHeight / 3), behavior: reduceMotion ? "auto" : "smooth" });
      }
    }

    function renderQuote() {
      const q = fQuote();
      $("#fgMeta").innerHTML = `<span>${F.sections.length} secciones</span><span>${F.extras.length} extras</span><span>≈ ${q.days} días hábiles</span>`;
      $("#fgLines").innerHTML = q.lines.map(l => `<li><span>${esc(l.label)}</span><span>${fmtCOP(l.price)}</span></li>`).join("");
      const from = fShownTotal, to = q.total;
      cancelAnimationFrame(fAnim);
      const put = v => { const s = fmtCOP(Math.round(v)); $("#fgTotal").textContent = s; $("#fgBarTotal").textContent = s; };
      if (reduceMotion || from === to) { fShownTotal = to; put(to); return; }
      const t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / 500), e = 1 - Math.pow(1 - k, 3); fShownTotal = from + (to - from) * e; put(fShownTotal); if (k < 1) fAnim = requestAnimationFrame(step); else { fShownTotal = to; put(to); } };
      fAnim = requestAnimationFrame(step);
    }

    function renderSteps() {
      $("#fgSteps").innerHTML = F_STEPS.map((s, i) => `<button type="button" class="fg-step${i < F.step ? " is-done" : ""}" data-step="${i}"${i === F.step ? ' aria-current="step"' : ""}><b><span>${F_ROMAN[i]}</span></b>${s}</button>`).join("");
    }

    /* ---------- paneles ---------- */
    const optHTML = (type, name, value, checked, title, desc, price, fk, extra = "") => `<label class="opt${extra}"><input type="${type}" name="${name}" value="${esc(value)}" data-f="${name}" data-fk="${fk}"${checked ? " checked" : ""}><span class="opt__box"></span><span><span class="opt__name">${title}</span>${desc ? `<span class="opt__desc">${desc}</span>` : ""}</span>${price ? `<span class="opt__price">${price}</span>` : ""}</label>`;
    const navHTML = (prev, next) => `<div class="fg-nav">${prev ? '<button type="button" class="btn btn--ghost btn--sm" data-act="prev">Anterior</button>' : ""}${next ? `<button type="button" class="btn btn--primary btn--sm" data-act="next">${next} ${arrow}</button>` : ""}</div>`;

    function panel0() {
      return `<h3 tabindex="-1">Tu proyecto</h3>
        <p class="fg-hint">Elige qué quieres construir. Puedes cambiarlo cuando quieras.</p>
        <div class="fg-opts fg-opts--2" role="radiogroup" aria-label="Tipo de proyecto">${Object.entries(F_TYPES).map(([k, t]) => optHTML("radio", "type", k, F.type === k, t.name, t.sub, "desde " + fmtCOP(t.base), "type-" + k)).join("")}</div>
        <h4 class="fg-sub">Estilo visual</h4>
        <div class="fg-opts fg-opts--3" role="radiogroup" aria-label="Estilo visual">${Object.entries(F_THEMES).map(([k, t]) => `<label class="opt opt--chip"><input type="radio" name="theme" value="${k}" data-f="theme" data-fk="theme-${k}"${F.theme === k ? " checked" : ""}><span class="opt__box"></span><span><span class="opt__name">${t.name}</span><span class="opt__dots"><i style="background:${t.bg}"></i><i style="background:${t.card}"></i><i style="background:${F.accent}"></i></span></span></label>`).join("")}</div>
        <h4 class="fg-sub">Color principal</h4>
        <div class="swatches">${F_ACCENTS.map(c => `<button type="button" class="swatch" style="--c:${c}" data-act="accent" data-color="${c}" data-fk="acc-${c.slice(1)}" aria-label="Color ${c}" aria-pressed="${F.accent.toLowerCase() === c}"></button>`).join("")}<input type="color" class="swatch-in" id="fgColor" value="${F.accent}" aria-label="Elegir otro color"><span class="swatch-lbl">Otro</span></div>
        <h4 class="fg-sub">Tu marca</h4>
        <div class="fg-fields">
          <div class="field"><label for="fgName">Nombre de tu negocio</label><input id="fgName" type="text" maxlength="40" placeholder="Ej: Café Montaña" value="${esc(F.name)}" data-bind="name"></div>
          <div class="field"><label for="fgTag">Frase principal</label><input id="fgTag" type="text" maxlength="70" placeholder="Ej: El mejor café de la región" value="${esc(F.tagline)}" data-bind="tagline"></div>
        </div>
        ${navHTML(false, "Elegir secciones")}`;
    }

    function panel1() {
      const catalog = F_SECTIONS.filter(s => s.id !== "hero").map(s => {
        const on = F.sections.includes(s.id);
        return `<button type="button" class="sec" data-act="sec" data-id="${s.id}" data-fk="sec-${s.id}" aria-pressed="${on}">${fIcon(s.id)}<span><span class="sec__name">${s.name}</span><span class="sec__meta">${on ? "✓ Agregada · " : ""}<b>+${fmtCOP(s.price)}</b></span></span></button>`;
      }).join("") + `<button type="button" class="sec sec--custom" data-act="addcustom" data-fk="addcustom" aria-pressed="false">${fIcon("custom")}<span><span class="sec__name">Sección a medida</span><span class="sec__meta">Descríbela tú · <b>+${fmtCOP(FORGE_CUSTOM_PRICE)}</b></span></span></button>`;
      const last = F.sections.length - 1;
      const stack = F.sections.map((id, i) => {
        const s = fSecInfo(id);
        if (id === "hero") return `<li><span class="stack__n">1</span><span class="stack__name">${fIcon("hero").replace("<svg", '<svg style="display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:8px;color:var(--gold)"')}${s.name}</span><span class="stack__lock">Incluida</span></li>`;
        const nameCell = (s as any).custom ? `<span class="stack__name"><input type="text" maxlength="40" value="${esc((F.customs[id] || {}).title || "")}" placeholder="Título de tu sección" aria-label="Título de la sección a medida" data-custom="${esc(id)}"></span>` : `<span class="stack__name">${s.name}</span>`;
        return `<li><span class="stack__n">${i + 1}</span>${nameCell}<span class="stack__price">${fmtCOP(s.price)}</span>
          <button type="button" class="ib" data-act="up" data-id="${esc(id)}" data-fk="up-${esc(id)}" aria-label="Subir ${esc(s.name)}"${i <= 1 ? " disabled" : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 15 6-6 6 6"/></svg></button>
          <button type="button" class="ib" data-act="down" data-id="${esc(id)}" data-fk="down-${esc(id)}" aria-label="Bajar ${esc(s.name)}"${i === last ? " disabled" : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg></button>
          <button type="button" class="ib ib--rm" data-act="rm" data-id="${esc(id)}" data-fk="rm-${esc(id)}" aria-label="Quitar ${esc(s.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg></button></li>`;
      }).join("");
      return `<h3 tabindex="-1">Arma la estructura</h3>
        <p class="fg-hint">El encabezado y el pie de página van incluidos. Agrega las secciones que necesites y ordénalas a tu gusto: tu vista previa cambia al instante.</p>
        <div class="secs">${catalog}</div>
        <h4 class="fg-sub">Tu estructura <em>(${F.sections.length} secciones)</em></h4>
        <ol class="stack">${stack}</ol>
        ${navHTML(true, "Personalizar")}`;
    }

    function panel2() {
      const groups = F_EXTRAS.map(g => `<h4 class="fg-sub">${g.group}</h4><div class="fg-opts fg-opts--1">${g.items.map(e => optHTML("checkbox", "extra", e.id, F.extras.includes(e.id), e.name, e.desc, "+" + fmtCOP(e.price), "extra-" + e.id)).join("")}</div>`).join("");
      return `<h3 tabindex="-1">Personalízala</h3>
        <p class="fg-hint">Suma funciones y detalles. Cada uno aparece en tu cotización con su valor.</p>
        ${groups}
        <h4 class="fg-sub">Entrega</h4>
        <div class="fg-opts fg-opts--1">${optHTML("checkbox", "urgent", "1", F.urgent, "Entrega urgente", "Priorizo tu proyecto y lo entrego en menos tiempo", "+" + Math.round(FORGE_URGENT_PCT * 100) + "%", "urgent")}</div>
        ${navHTML(true, "Enviar pedido")}`;
    }

    function panel3() {
      const q = fQuote(), t = F_TYPES[F.type];
      const sent = fSent ? `<div class="fg-sent" id="fgSent"><p><strong>¡Pedido preparado!</strong> Se abrió tu app de correo con el resumen. Si no se abrió, copia o descarga el resumen y envíalo a <strong>${esc(CONTACT_EMAIL)}</strong>.</p><pre>${esc(fSent)}</pre></div>` : "";
      return `<h3 tabindex="-1">Envía tu pedido</h3>
        <p class="fg-hint">Déjame un medio de contacto y recibiré tu diseño con la cotización para revisarlo y responderte.</p>
        <p class="vow vow--plain" style="margin:0 0 14px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span><b>Anónimo.</b> Puedes usar un alias. Solo necesito un correo <i>o</i> un WhatsApp para responderte; no hay cuentas ni seguimiento.</span></p>
        <div class="fg-mini"><span>${esc(t.name)} · ${F.sections.length} secciones · ${F.extras.length} extras</span><b>${fmtCOP(q.total)}</b></div>
        <div class="fg-fields">
          <div class="form__row">
            <div class="field"><label for="fcName">Nombre o alias <small style="color:var(--mute)">(opcional)</small></label><input id="fcName" type="text" autocomplete="off" placeholder="Como quieras que te llamemos" value="${esc(F.contact.name)}" data-bind="contact.name"></div>
            <div class="field"><label for="fcEmail">Correo <small style="color:var(--mute)">(o WhatsApp)</small></label><input id="fcEmail" type="email" autocomplete="email" placeholder="tu@correo.com" value="${esc(F.contact.email)}" data-bind="contact.email"></div>
          </div>
          <div class="field"><label for="fcPhone">WhatsApp</label><input id="fcPhone" type="tel" autocomplete="tel" placeholder="+57 300 000 0000" value="${esc(F.contact.phone)}" data-bind="contact.phone"></div>
          <div class="field"><label for="fcNotes">Detalles o referencias</label><textarea id="fcNotes" placeholder="Cuéntame sobre tu negocio, páginas que te gusten, fechas…" data-bind="contact.notes">${esc(F.contact.notes)}</textarea></div>
        </div>
        <div class="fg-actions" style="margin-top:20px">
          <button type="button" class="btn btn--primary" data-act="send">Enviar pedido ${arrow}</button>
          ${FORGE_WHATSAPP ? '<button type="button" class="btn btn--ghost" data-act="wsp">Por WhatsApp</button>' : ""}
          <button type="button" class="btn btn--ghost btn--sm" data-act="copy">Copiar resumen</button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="download">Descargar .txt</button>
        </div>
        <p class="fg-status" id="fgStatus" role="status" aria-live="polite"></p>
        ${sent}
        <div class="fg-nav"><button type="button" class="btn btn--ghost btn--sm" data-act="prev">Anterior</button><button type="button" class="btn btn--ghost btn--sm" data-act="reset">Empezar de nuevo</button></div>`;
    }

    function renderPanel(focusKey?) {
      $("#fgPanel").innerHTML = [panel0, panel1, panel2, panel3][F.step]();
      if (focusKey) { const el = $(`#fgPanel [data-fk="${CSS.escape(focusKey)}"]`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
    }
    function renderAll(focusKey?, flashId?) { renderSteps(); renderPanel(focusKey); renderPreview(flashId); renderQuote(); fSave(); }

    function goStep(n, user?) {
      F.step = Math.min(3, Math.max(0, n)); renderSteps(); renderPanel(); fSave();
      const h = $("#fgPanel h3"); if (h && user) h.focus({ preventScroll: true });
      const w = $("#fgWork"); if (user && w.getBoundingClientRect().top < 70) w.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }

    /* ---------- resumen / envío ---------- */
    function fSummary() {
      const q = fQuote(), t = F_TYPES[F.type], c = F.contact;
      const L = ["PEDIDO DE PÁGINA WEB — ICARUS", "", `Tipo: ${t.name}`, `Negocio: ${F.name.trim() || "(sin nombre)"}`, `Frase: ${F.tagline.trim() || "(sin frase)"}`, `Estilo: ${F_THEMES[F.theme].name} · Color ${F.accent}`, "", `Secciones (${F.sections.length}):`];
      F.sections.forEach((id, i) => L.push(`  ${i + 1}. ${fSecInfo(id).name}`));
      L.push("", F.extras.length ? `Extras (${F.extras.length}):` : "Extras: ninguno");
      F.extras.forEach(id => L.push(`  - ${F_EXTRA_MAP[id].name}`));
      L.push("", `Entrega: ${F.urgent ? "URGENTE" : "normal"} (≈ ${q.days} días hábiles)`, `TOTAL ESTIMADO: ${fmtCOP(q.total)}`, "", "Desglose:");
      q.lines.forEach(l => L.push(`  ${l.label}: ${fmtCOP(l.price)}`));
      L.push("", `Cliente: ${c.name.trim() || "Anónimo"}`, `Correo: ${c.email || "—"}`, `WhatsApp: ${c.phone || "—"}`);
      if (c.notes.trim()) L.push("", "Notas:", c.notes.trim());
      return L.join("\n");
    }
    function fStatus(msg, err?) { const s = $("#fgStatus"); if (s) { s.textContent = msg; s.classList.toggle("is-err", !!err); } }
    function fValid() {
      const c = F.contact;
      const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()), okTel = c.phone.replace(/\D/g, "").length >= 7;
      if (!okMail && !okTel) { fStatus("Escribe un correo válido o un WhatsApp para poder responderte. El nombre es opcional.", true); return false; }
      return true;
    }
    async function fCopy(text) {
      try { await navigator.clipboard.writeText(text); return true; } catch (e) {
        const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand("copy"); } catch (e2) { /* ignorar */ } ta.remove(); return ok;
      }
    }

    /* ---------- eventos ---------- */
    const fgPanel = $("#fgPanel");
    fgPanel.addEventListener("click", async e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const act = b.dataset.act, id = b.dataset.id;
      if (act === "next") return goStep(F.step + 1, true);
      if (act === "prev") return goStep(F.step - 1, true);
      if (act === "accent") { F.accent = b.dataset.color; return renderAll("acc-" + b.dataset.color.slice(1)); }
      if (act === "sec") {
        F.dirty = true;
        if (F.sections.includes(id)) { F.sections = F.sections.filter(x => x !== id); return renderAll("sec-" + id); }
        F.sections.push(id); return renderAll("sec-" + id, id);
      }
      if (act === "addcustom") {
        F.dirty = true; const nid = "custom:" + Date.now().toString(36); F.customs[nid] = { title: "" }; F.sections.push(nid);
        renderAll(null, nid); const inp = $(`#fgPanel [data-custom="${CSS.escape(nid)}"]`); if (inp) inp.focus({ preventScroll: true }); return;
      }
      if (act === "rm") { F.dirty = true; F.sections = F.sections.filter(x => x !== id); delete F.customs[id]; return renderAll("addcustom"); }
      if (act === "up" || act === "down") {
        const i = F.sections.indexOf(id), j = act === "up" ? i - 1 : i + 1;
        if (i < 1 || j < 1 || j >= F.sections.length) return;
        F.dirty = true; [F.sections[i], F.sections[j]] = [F.sections[j], F.sections[i]]; return renderAll(`${act}-${id}`, id);
      }
      if (act === "copy") { fStatus((await fCopy(fSummary())) ? "Resumen copiado. Ya puedes pegarlo donde quieras." : "No pude copiarlo; usa «Descargar .txt».", false); return; }
      if (act === "download") {
        const url = URL.createObjectURL(new Blob([fSummary()], { type: "text/plain;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = "icarus-cotizacion.txt"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        return fStatus("Cotización descargada.", false);
      }
      if (act === "send" || act === "wsp") {
        if (!fValid()) return;
        const text = fSummary();
        if (act === "wsp" && FORGE_WHATSAPP) window.open(`https://wa.me/${FORGE_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        else location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[ICARUS] Pedido de página web — " + (F.name.trim() || F.contact.name.trim() || "Anónimo"))}&body=${encodeURIComponent(text)}`;
        fSent = text; renderPanel(); fStatus("Pedido preparado.", false);
        const s = $("#fgSent"); if (s) s.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
        return;
      }
      if (act === "reset") { if (confirm("¿Empezar de nuevo? Se borrará tu diseño actual.")) { F = fDefault(); fSent = null; fShownTotal = 0; renderAll(); } }
    });
    fgPanel.addEventListener("change", e => {
      const t = e.target;
      if (t.id === "fgColor") { F.accent = t.value; return renderAll(); }
      const f = t.dataset.f; if (!f) return;
      if (f === "type") { F.type = t.value; if (!F.dirty) F.sections = [...F_TYPES[F.type].preset]; return renderAll("type-" + t.value); }
      if (f === "theme") { F.theme = t.value; return renderAll("theme-" + t.value); }
      if (f === "extra") { F.extras = t.checked ? [...F.extras, t.value] : F.extras.filter(x => x !== t.value); return renderAll("extra-" + t.value); }
      if (f === "urgent") { F.urgent = t.checked; return renderAll("urgent"); }
    });
    fgPanel.addEventListener("input", e => {
      const t = e.target;
      if (t.id === "fgColor") { F.accent = t.value; renderPreview(); fSave(); return; }
      if (t.dataset.custom) { if (F.customs[t.dataset.custom]) F.customs[t.dataset.custom].title = t.value; renderPreview(); renderQuote(); fSave(); return; }
      const k = t.dataset.bind; if (!k) return;
      if (k.startsWith("contact.")) F.contact[k.slice(8)] = t.value; else { F[k] = t.value; renderPreview(); }
      fSave();
    });
    $("#fgSteps").addEventListener("click", e => { const b = e.target.closest("[data-step]"); if (b) goStep(+b.dataset.step, true); });
    $("#fgGoSend").addEventListener("click", () => goStep(3, true));

    /* ---------- Redirección: "Forja tu página web" lleva a tu página externa ----------
       Deja FORGE_REDIRECT_URL vacío ("") para volver al configurador integrado. */
    const FORGE_REDIRECT_URL = "forja/";   // icarus-web vive dentro de este mismo sitio (carpeta /forja/)
    const FORGE_REDIRECT_NEW_TAB = false;  // true = se abre en otra pestaña
    (function () {
      if (!FORGE_REDIRECT_URL) { renderAll(); return; }
      const box = $("#forge"), gate = $("#fgGate"), btn = $("#fgGateBtn");
      box.classList.add("is-gate"); gate.hidden = false;
      btn.href = FORGE_REDIRECT_URL;
      if (FORGE_REDIRECT_NEW_TAB) { btn.target = "_blank"; btn.rel = "noopener"; }
      $("#forgeSubTxt").textContent = "Diseña tu landing page o tu sitio completo en nuestra página dedicada y recibe tu cotización.";
      // vista previa animada de demostración (no guarda nada)
      F = fDefault(); F.name = "Tu marca"; F.tagline = "Tu idea, hecha página web";
      const pool = ["servicios", "galeria", "testimonios", "precios", "faq", "contacto"], looks = [["oscuro", "#e0303c"], ["oscuro", "#c9a35a"], ["oscuro", "#4aa3ff"]];
      F.sections = ["hero"]; renderPreview();
      let n = 0;
      const tick = () => {
        if (document.hidden) return;
        if (n >= pool.length) { n = 0; F.sections = ["hero"]; const l = looks[Math.floor(Math.random() * looks.length)]; F.theme = F_THEMES[l[0]] ? l[0] : F.theme; F.accent = l[1]; renderPreview(); return; }
        const id = pool[n++]; F.sections.push(id); renderPreview(id);
      };
      if (reduceMotion) { F.sections = ["hero", "servicios", "testimonios", "contacto"]; renderPreview(); }
      else setInterval(tick, 1700);
    })();

    /* ============ FORMULARIO ============ */
    const form = $("#contactForm"), status = $("#formStatus");
    form.addEventListener("submit", e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || "");
      if (!ok || !d.message.trim()) { status.textContent = "Revisa los campos: un correo válido y tu mensaje. El nombre es opcional."; return; }
      const who = d.name.trim() || "Anónimo";
      const subject = encodeURIComponent(`[ICARUS] ${d.topic} — ${who}`);
      const body = encodeURIComponent(`${d.message}\n\n— ${who} (${d.email})`);
      location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      status.textContent = "Abriendo tu app de correo… ¡Gracias por escribirnos!";
      form.reset();
    });
  

    /* ============ PANTALLA DE INICIO: «Se requiere discreción» ============ */
    (function () {
      const sp = $("#splash"); if (!sp) return;
      document.body.classList.add("is-splash");
      let gone = false;
      const out = () => {
        if (gone) return; gone = true;
        sp.classList.add("is-out"); document.body.classList.remove("is-splash");
        setTimeout(() => sp.remove(), reduceMotion ? 0 : 900);
      };
      setTimeout(out, reduceMotion ? 900 : 2600);
      sp.addEventListener("click", out);
      addEventListener("keydown", out, { once: true });
    })();
