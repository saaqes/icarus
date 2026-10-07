/* =========================================================
   ICARUS — PÁGINAS CREADAS
   Tarjetas con vista previa en vivo (iframe escalado, carga
   diferida) + botones "Ver" y "Contactar" (WhatsApp).
   Para agregar otra página, añade un objeto a MADE.
   Las direcciones no se escriben en el HTML: se usan al hacer clic.
   ========================================================= */
(function () {
  'use strict';

  var I = window.ICARUS;
  var el = I.el;
  var grid = document.getElementById('made-grid');
  if (!grid) return;

  var MADE = [
    { id: 'mantiz', name: 'MANTIZ', kind: 'Moda · E-commerce y red social',
      desc: 'Plataforma de moda colombiana estilo Y2K con tienda y comunidad.',
      u: ['https:', '', 'saaqes.github.io', 'MANTIZ', ''] },
    { id: 'star-crumbs', name: 'STAR-CRUMBS', kind: 'Repostería · Tienda online',
      desc: 'Tienda de galletas con catálogo, carrito y pedidos.',
      u: ['https:', '', 'star-crumbs.onrender.com', ''] }
  ];

  var VIEW_W = 1280, VIEW_H = 800;
  var addr = function (p) { return p.u.join('/'); };

  function fit(shot) {
    var f = shot.querySelector('iframe'); if (!f) return;
    var k = shot.clientWidth / VIEW_W;
    f.style.transform = 'scale(' + k + ')';
  }

  function load(shot, p) {
    if (shot.getAttribute('data-ready')) return;
    shot.setAttribute('data-ready', '1');
    var f = el('iframe', { title: 'Vista previa de ' + p.name, tabindex: '-1', loading: 'lazy',
      referrerpolicy: 'no-referrer', sandbox: 'allow-scripts allow-same-origin', width: String(VIEW_W), height: String(VIEW_H) });
    f.style.width = VIEW_W + 'px'; f.style.height = VIEW_H + 'px';
    f.addEventListener('load', function () { shot.classList.add('is-loaded'); });
    f.src = addr(p);
    shot.appendChild(f);
    fit(shot);
  }

  MADE.forEach(function (p, idx) {
    var shot = el('div', { class: 'browser__shot made__shot', role: 'img', 'aria-label': 'Vista previa de ' + p.name }, [
      el('div', { class: 'made__ph' }, [el('b', { text: p.name }), el('span', { text: 'Cargando vista previa…' })])
    ]);
    var card = el('article', { class: 'demo-card made-card reveal' }, [
      el('div', { class: 'browser' }, [
        el('div', { class: 'browser__bar', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]),
        shot
      ]),
      el('div', { class: 'demo-card__body' }, [
        el('div', null, [el('span', { class: 'svc-card__cat', text: p.kind })]),
        el('h3', { text: p.name }),
        el('p', { text: p.desc }),
        el('div', { class: 'demo-card__actions' }, [
          el('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'data-made-view': p.id, text: 'Ver' }),
          el('button', { class: 'btn btn--blood btn--sm', type: 'button', 'data-made-wa': p.id, text: 'Contactar' })
        ])
      ])
    ]);
    card.style.setProperty('--rd', (idx * 0.1) + 's');
    grid.appendChild(card);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { load(shot, p); io.disconnect(); }
      }, { rootMargin: '300px' });
      io.observe(shot);
    } else { load(shot, p); }
    if ('ResizeObserver' in window) new ResizeObserver(function () { fit(shot); }).observe(shot);
  });

  if (I.reveal) I.reveal(grid);

  grid.addEventListener('click', function (e) {
    var t = e.target as HTMLElement;
    var v = t.closest && t.closest('[data-made-view]');
    var w = t.closest && t.closest('[data-made-wa]');
    var id = v ? v.getAttribute('data-made-view') : w ? w.getAttribute('data-made-wa') : null;
    if (!id) return;
    var p = MADE.filter(function (m) { return m.id === id; })[0];
    if (!p) return;
    e.preventDefault();
    if (v) window.open(addr(p), '_blank', 'noopener,noreferrer');
    else I.openWhatsApp('Hola, ICARUS. Vi la página ' + p.name + ' que crearon y quiero información para una página similar.');
  });
})();
