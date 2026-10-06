/* =========================================================
   ICARUS — EFECTOS Y NAVEGACIÓN COMPARTIDOS
   Partículas, plumas, luz de cursor, parallax, revelado,
   encabezado, menú móvil, transiciones y botones flotantes.
   ========================================================= */
(function () {
  'use strict';

  var I = window.ICARUS;
  var reduce = I.reducedMotion;
  document.documentElement.classList.remove('no-js');

  /* ---------- Pantalla de carga ---------- */
  function finishLoading() {
    var loader = document.querySelector('.loader');
    document.body.classList.add('is-ready');
    if (loader) {
      loader.classList.add('is-done');
      setTimeout(function () { loader.remove(); }, 1000);
    }
  }
  var seen = false;
  try { seen = sessionStorage.getItem('icarus-intro') === '1'; sessionStorage.setItem('icarus-intro', '1'); } catch (e) { /* noop */ }
  var minDelay = seen || reduce ? 150 : 1500;
  var start = Date.now();
  window.addEventListener('load', function () {
    setTimeout(finishLoading, Math.max(0, minDelay - (Date.now() - start)));
  });
  setTimeout(finishLoading, 4000); // salvaguarda

  /* ---------- Partículas (ceniza y brasas) ---------- */
  function embers() {
    var canvas = document.getElementById('embers') as HTMLCanvasElement;
    if (!canvas || reduce) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W, H, parts = [], running = true;
    var count = window.innerWidth < 700 ? 34 : 70;

    function resize() {
      W = canvas.width = Math.floor(window.innerWidth * dpr);
      H = canvas.height = Math.floor(window.innerHeight * dpr);
    }
    function spawn(initial) {
      var ember = Math.random() < 0.28;
      return {
        x: Math.random() * W,
        y: initial ? Math.random() * H : H + 10,
        r: (ember ? 1 + Math.random() * 1.6 : 0.6 + Math.random() * 1.4) * dpr,
        vy: -(0.15 + Math.random() * 0.55) * dpr,
        vx: (Math.random() - 0.5) * 0.2 * dpr,
        sway: Math.random() * Math.PI * 2,
        life: 0.4 + Math.random() * 0.6,
        ember: ember
      };
    }
    resize();
    for (var i = 0; i < count; i++) parts.push(spawn(true));
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(tick);
    });

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.sway += 0.01;
        p.x += p.vx + Math.sin(p.sway) * 0.25 * dpr;
        p.y += p.vy;
        if (p.y < -10) parts[i] = spawn(false);
        var fade = Math.min(1, p.y / (H * 0.35)) * p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        if (p.ember) {
          ctx.fillStyle = 'rgba(217,71,43,' + (fade * 0.85).toFixed(3) + ')';
          ctx.shadowColor = 'rgba(217,71,43,.8)';
          ctx.shadowBlur = 8 * dpr;
        } else {
          ctx.fillStyle = 'rgba(210,212,220,' + (fade * 0.45).toFixed(3) + ')';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Plumas ocasionales ---------- */
  function feathers() {
    var layer = document.querySelector('.feather-layer');
    if (!layer || reduce) return;
    function drop() {
      if (document.hidden || layer.childElementCount > 2) return;
      var f = I.icon('feather', 34);
      f.classList.add('feather');
      f.style.left = (5 + Math.random() * 90) + 'vw';
      f.style.setProperty('--drift', ((Math.random() - 0.5) * 240).toFixed(0) + 'px');
      f.style.setProperty('--dur', (12 + Math.random() * 8).toFixed(1) + 's');
      var s = 0.6 + Math.random() * 0.7;
      f.style.width = f.style.height = (34 * s) + 'px';
      f.addEventListener('animationend', function () { f.remove(); });
      layer.appendChild(f);
    }
    setTimeout(drop, 2500);
    setInterval(drop, 7000);
  }

  /* ---------- Luz que sigue al cursor ---------- */
  function cursorLight() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    document.addEventListener('pointermove', function (e) {
      var t = (e.target as HTMLElement).closest && ((e.target as HTMLElement).closest('.lit, .btn') as HTMLElement);
      if (!t) return;
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      t.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- Revelado al desplazarse ---------- */
  var io = null;
  function reveal(scope?) {
    var items = (scope || document).querySelectorAll('.reveal:not(.is-in)');
    if (!('IntersectionObserver' in window) || reduce) {
      items.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------- Encabezado, parallax y botón superior ---------- */
  function scrollFx() {
    var header = document.querySelector('.site-header');
    var toTop = document.querySelector('.to-top');
    var layers = document.querySelectorAll('[data-parallax]');
    var ticking = false;
    function update() {
      var y = window.scrollY;
      if (header) header.classList.toggle('is-solid', y > 30);
      if (toTop) toTop.classList.toggle('is-visible', y > 900);
      if (!reduce && y < window.innerHeight * 1.4) {
        layers.forEach(function (l) {
          var k = parseFloat(l.getAttribute('data-parallax')) || 0.2;
          (l as HTMLElement).style.transform = 'translate3d(0,' + (y * k).toFixed(1) + 'px,0)';
        });
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
    if (toTop) toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  }

  /* ---------- Menú móvil ---------- */
  function mobileMenu() {
    var btn = document.querySelector('.menu-toggle');
    if (!btn) return;
    function set(open) {
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    }
    btn.addEventListener('click', function () { set(!document.body.classList.contains('menu-open')); });
    document.querySelectorAll('.nav__links a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }

  /* ---------- Sección activa en el menú ---------- */
  function activeNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href*="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute('href').split('#')[1];
      var sec = id && document.getElementById(id);
      if (sec) map[id] = a;
    });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (l) { l.classList.remove('is-active'); });
          map[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { obs.observe(document.getElementById(id)); });
  }

  /* ---------- Transiciones entre páginas ---------- */
  function pageTransitions() {
    var veil = document.querySelector('.page-veil');
    if (!veil || reduce) return;
    document.addEventListener('click', function (e) {
      var a = (e.target as HTMLElement).closest && ((e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement);
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      var url;
      try { url = new URL(href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      e.preventDefault();
      veil.classList.add('is-active');
      setTimeout(function () { window.location.href = url.href; }, 420);
    });
    window.addEventListener('pageshow', function () { veil.classList.remove('is-active'); });
  }

  /* ---------- Botones de WhatsApp declarativos ----------
     data-wa="general" | data-wa-service="<id>" | data-wa-demo="<id>" */
  function waButtons() {
    document.addEventListener('click', function (e) {
      var b = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('[data-wa], [data-wa-service], [data-wa-demo]');
      if (!b) return;
      var msg = null;
      if (b.hasAttribute('data-wa-service')) {
        var s = I.getService(b.getAttribute('data-wa-service'));
        if (s) msg = I.msg.service(s);
      } else if (b.hasAttribute('data-wa-demo')) {
        var d = I.getDemo(b.getAttribute('data-wa-demo'));
        if (d) msg = I.msg.demo(d);
      }
      if (!msg) msg = I.msg.general();
      e.preventDefault();
      I.openWhatsApp(msg);
    });
    // Los enlaces con data-wa tienen un href real como respaldo sin JS
    document.querySelectorAll('a[data-wa]').forEach(function (a: HTMLAnchorElement) { a.href = I.waLink(I.msg.general()); });
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  I.toast = function (text) {
    var t = document.querySelector('.toast');
    if (!t) { t = I.el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 2800);
  };

  /* ---------- Año del footer ---------- */
  document.querySelectorAll('[data-year]').forEach(function (n) { n.textContent = String(new Date().getFullYear()); });

  I.reveal = reveal;
  embers();
  feathers();
  cursorLight();
  scrollFx();
  mobileMenu();
  activeNav();
  pageTransitions();
  waButtons();
  reveal();
})();
