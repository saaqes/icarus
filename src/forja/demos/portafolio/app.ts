/* Demo Portafolio — Estudio Bruma (estudio ficticio, ilustraciones generadas) */
(function () {
  'use strict';
  var I = window.ICARUS;
  var el = I.el;
  var NS = 'http://www.w3.org/2000/svg';

  function s(tag, a) { var n = document.createElementNS(NS, tag); Object.keys(a).forEach(function (k) { n.setAttribute(k, a[k]); }); return n; }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  /* ---------- Ilustración arquitectónica generativa ---------- */
  var uid = 0;
  function art(p, wide?) {
    var r = rng(p.seed);
    var W = 400, H = wide ? 152 : 300;
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
    var id = 'sky' + (++uid);
    var defs = s('defs', {});
    var g = s('linearGradient', { id: id, x1: '0', y1: '0', x2: '0', y2: '1' });
    g.appendChild(s('stop', { offset: '0', 'stop-color': p.pal.sky1 }));
    g.appendChild(s('stop', { offset: '1', 'stop-color': p.pal.sky2 }));
    defs.appendChild(g); svg.appendChild(defs);
    svg.appendChild(s('rect', { width: W, height: H, fill: 'url(#' + id + ')' }));
    svg.appendChild(s('circle', { cx: 60 + r() * 280, cy: H * (0.18 + r() * 0.12), r: 14 + r() * 16, fill: p.pal.sun, opacity: '.85' }));
    var gy = H * 0.78;
    // colinas
    var hill = 'M0 ' + (gy - 20);
    for (var x = 0; x <= W; x += 40) hill += ' Q' + (x + 20) + ' ' + (gy - 40 - r() * 50) + ' ' + (x + 40) + ' ' + (gy - 18 - r() * 16);
    svg.appendChild(s('path', { d: hill + ' L' + W + ' ' + H + ' L0 ' + H + 'Z', fill: p.pal.hill, opacity: '.55' }));
    svg.appendChild(s('rect', { x: 0, y: gy, width: W, height: H - gy, fill: p.pal.ground }));
    // volumen principal
    var bw = 150 + r() * 70, bh = H * (0.32 + r() * 0.14), bx = (W - bw) / 2 + (r() - 0.5) * 60;
    svg.appendChild(s('rect', { x: bx + 10, y: gy - 2, width: bw, height: 8, fill: '#000', opacity: '.12' }));
    svg.appendChild(s('rect', { x: bx, y: gy - bh, width: bw, height: bh, fill: p.pal.wall }));
    svg.appendChild(s('rect', { x: bx + bw * 0.62, y: gy - bh, width: bw * 0.38, height: bh, fill: '#000', opacity: '.08' }));
    // voladizo superior
    var cw = bw * (0.55 + r() * 0.3), ch = bh * 0.42, cx = bx + (r() < 0.5 ? -bw * 0.18 : bw * 0.3);
    svg.appendChild(s('rect', { x: cx, y: gy - bh - ch, width: cw, height: ch, fill: p.pal.accent }));
    svg.appendChild(s('rect', { x: cx - 6, y: gy - bh - ch - 5, width: cw + 12, height: 5, fill: p.pal.roof }));
    // ventanales
    var cols = 2 + Math.floor(r() * 3);
    for (var c = 0; c < cols; c++) {
      var ww = (bw - 30) / cols - 8;
      var wx = bx + 15 + c * (ww + 8);
      svg.appendChild(s('rect', { x: wx, y: gy - bh + 14, width: ww, height: bh - 28, fill: p.pal.glass }));
      svg.appendChild(s('path', { d: 'M' + wx + ' ' + (gy - 14) + ' L' + (wx + ww * 0.6) + ' ' + (gy - bh + 14) + ' L' + (wx + ww) + ' ' + (gy - bh + 14) + ' L' + (wx + ww * 0.4) + ' ' + (gy - 14) + 'Z', fill: '#fff', opacity: '.12' }));
    }
    svg.appendChild(s('rect', { x: cx + 12, y: gy - bh - ch + 10, width: cw - 24, height: ch - 20, fill: p.pal.glass, opacity: '.9' }));
    // árboles
    var trees = 2 + Math.floor(r() * 3);
    for (var t = 0; t < trees; t++) {
      var tx = r() < 0.5 ? r() * (bx - 10) : bx + bw + 10 + r() * (W - bx - bw - 20);
      var tr = 12 + r() * 16;
      svg.appendChild(s('rect', { x: tx - 1.5, y: gy - tr * 1.6, width: 3, height: tr * 1.6, fill: '#3b3329' }));
      svg.appendChild(s('circle', { cx: tx, cy: gy - tr * 1.8, r: tr, fill: p.pal.tree }));
      svg.appendChild(s('circle', { cx: tx + tr * 0.35, cy: gy - tr * 2.1, r: tr * 0.6, fill: '#fff', opacity: '.08' }));
    }
    return svg;
  }

  var PAL = {
    calido: { sky1: '#f0d9bd', sky2: '#f7efe4', sun: '#f4b778', hill: '#a9b39a', ground: '#cbbfa7', wall: '#efe9de', accent: '#9b6b43', roof: '#2d2a26', glass: '#2f3b40', tree: '#5c7a52' },
    niebla: { sky1: '#c9d3d6', sky2: '#eef1ef', sun: '#ffffff', hill: '#7f948c', ground: '#b9bfb6', wall: '#e7e5df', accent: '#5f6b66', roof: '#1f2422', glass: '#24302f', tree: '#4a6650' },
    atardecer: { sky1: '#e8a98b', sky2: '#f5d7bf', sun: '#fff2d9', hill: '#9c8a8b', ground: '#c7b29c', wall: '#f3ece4', accent: '#3e3a36', roof: '#151312', glass: '#3a2f33', tree: '#556b4a' },
    selva: { sky1: '#b9d4c5', sky2: '#eef4ee', sun: '#fdf7d8', hill: '#5f8a6a', ground: '#9fae8c', wall: '#d9d1c2', accent: '#7a5a3e', roof: '#262a22', glass: '#20302a', tree: '#2f5a3a' }
  };

  var PROJECTS = [
    { id: 1, name: 'Casa Guadua', cat: 'Residencial', place: 'Salento, Quindío', year: 2024, area: '320 m²', seed: 11, pal: PAL.calido, desc: 'Vivienda campestre que combina estructura en guadua con muros de tierra. Los aleros profundos protegen del sol y la lluvia, y el salón se abre por completo hacia el valle.' },
    { id: 2, name: 'Mirador del Valle', cat: 'Residencial', place: 'Filandia, Quindío', year: 2023, area: '410 m²', seed: 23, pal: PAL.niebla, desc: 'Casa en voladizo sobre la ladera, pensada para la niebla de la mañana. Un único volumen de vidrio enmarca el paisaje desde cada habitación.' },
    { id: 3, name: 'Tostadora Origen', cat: 'Comercial', place: 'Armenia, Quindío', year: 2023, area: '180 m²', seed: 37, pal: PAL.atardecer, desc: 'Café y tostadora abierta al público. La máquina de tueste es el centro del espacio y la fachada se recoge para unir el local con la calle.' },
    { id: 4, name: 'Glamping Neblina', cat: 'Paisaje', place: 'Circasia, Quindío', year: 2022, area: '6 cabañas', seed: 41, pal: PAL.selva, desc: 'Seis cabañas dispersas entre el bosque, conectadas por senderos elevados que respetan la vegetación existente y los cursos de agua.' },
    { id: 5, name: 'Loft Bahareque', cat: 'Interiores', place: 'Pereira, Risaralda', year: 2024, area: '95 m²', seed: 53, pal: PAL.calido, desc: 'Renovación de un apartamento en edificio patrimonial. Se recuperaron los muros de bahareque y se integró una cocina en madera de nogal.' },
    { id: 6, name: 'Centro Verde', cat: 'Comercial', place: 'Manizales, Caldas', year: 2021, area: '1.200 m²', seed: 67, pal: PAL.niebla, desc: 'Pequeño centro comercial con cubiertas verdes, patios interiores y ventilación natural que reduce el consumo de energía.' },
    { id: 7, name: 'Jardín de las Lluvias', cat: 'Paisaje', place: 'Calarcá, Quindío', year: 2022, area: '2.400 m²', seed: 79, pal: PAL.selva, desc: 'Parque de bolsillo diseñado para recoger el agua de lluvia en estanques escalonados y especies nativas.' },
    { id: 8, name: 'Casa Patio', cat: 'Residencial', place: 'Montenegro, Quindío', year: 2021, area: '260 m²', seed: 97, pal: PAL.atardecer, desc: 'Vivienda organizada alrededor de un patio central con un árbol de yarumo, que ilumina y ventila todos los espacios.' }
  ];
  var CATS = ['Todos', 'Residencial', 'Comercial', 'Interiores', 'Paisaje'];

  document.getElementById('hero-art').appendChild(art({ seed: 5, pal: PAL.niebla }, true));

  /* Menú móvil */
  var mb = document.querySelector('.menu-btn');
  var nav = document.getElementById('pf-nav');
  mb.addEventListener('click', function () { var o = !nav.classList.contains('is-open'); nav.classList.toggle('is-open', o); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); mb.textContent = o ? 'Cerrar' : 'Menú'; });
  nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('is-open'); mb.setAttribute('aria-expanded', 'false'); mb.textContent = 'Menú'; }); });

  /* Proyectos y filtros */
  var current = 'Todos';
  var visible = PROJECTS;
  var grid = document.getElementById('pgrid');
  var filters = document.getElementById('filters');
  CATS.forEach(function (c) {
    filters.appendChild(el('button', { type: 'button', 'aria-pressed': c === current ? 'true' : 'false', text: c, on: { click: function () {
      current = c;
      filters.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === c ? 'true' : 'false'); });
      render();
    } } }));
  });
  function render() {
    visible = PROJECTS.filter(function (p) { return current === 'Todos' || p.cat === current; });
    grid.textContent = '';
    document.getElementById('p-count').textContent = '(' + visible.length + ')';
    visible.forEach(function (p, i) {
      grid.appendChild(el('button', { class: 'proj', type: 'button', style: 'animation-delay:' + (i * 0.06) + 's', 'aria-label': 'Ver proyecto ' + p.name, on: { click: function () { openLb(i); } } }, [
        el('div', { class: 'proj__art' }, [art(p)]),
        el('div', { class: 'proj__meta' }, [el('h3', { text: p.name }), el('span', { text: p.cat + ' · ' + p.year })])
      ]));
    });
  }
  render();

  /* Lightbox */
  var lb = document.getElementById('lb');
  var pos = 0, lastFocus;
  function fill() {
    var p = visible[pos];
    var a = document.getElementById('lb-art'); a.textContent = ''; a.appendChild(art(p));
    document.getElementById('lb-cat').textContent = p.cat;
    document.getElementById('lb-title').textContent = p.name;
    document.getElementById('lb-desc').textContent = p.desc;
    document.getElementById('lb-pos').textContent = (pos + 1) + ' / ' + visible.length;
    var meta = document.getElementById('lb-meta'); meta.textContent = '';
    [['Ubicación', p.place], ['Año', String(p.year)], ['Área', p.area], ['Estado', 'Construido']].forEach(function (m) {
      meta.appendChild(el('div', null, [el('dt', { text: m[0] }), el('dd', { text: m[1] })]));
    });
  }
  function openLb(i) { pos = i; fill(); lastFocus = document.activeElement; lb.hidden = false; document.body.style.overflow = 'hidden'; document.getElementById('lb-close').focus(); }
  function closeLb() { lb.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  function step(d) { pos = (pos + d + visible.length) % visible.length; fill(); }
  document.getElementById('lb-close').addEventListener('click', closeLb);
  document.getElementById('lb-prev').addEventListener('click', function () { step(-1); });
  document.getElementById('lb-next').addEventListener('click', function () { step(1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  /* Contacto */
  var form = document.getElementById('pf-form') as any;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var n = I.clean(form.n.value, 60);
    if (n.length < 2) { form.querySelector('.err').textContent = 'Escribe tu nombre.'; return; }
    var tipo = form.t.value;
    form.textContent = '';
    form.appendChild(el('p', { class: 'ok', role: 'status' }, ['Gracias, ' + n + '. Te escribiremos pronto sobre tu proyecto de ' + tipo.toLowerCase() + '.', el('small', { text: 'Demostración: en el sitio real este mensaje llega al correo o WhatsApp del estudio.' })]));
  });
})();
