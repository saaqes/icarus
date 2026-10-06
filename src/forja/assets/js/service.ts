/* =========================================================
   ICARUS — PÁGINA DE DETALLE DE SERVICIO  (servicio/?id=...)
   Solo se aceptan ids que existen en data.js.
   ========================================================= */
(function () {
  'use strict';

  var I = window.ICARUS;
  var el = I.el;
  var root = document.getElementById('service-root');

  function levelNode(n) {
    var lv = el('span', { class: 'level', 'aria-label': 'Complejidad ' + n + ' de 4' });
    for (var k = 1; k <= 4; k++) lv.appendChild(el('i', { class: k <= n ? 'on' : '' }));
    return lv;
  }

  function list(items) {
    return el('ul', { class: 'check-list', style: 'margin:0' }, items.map(function (t) { return el('li', { text: t }); }));
  }

  function notFound() {
    document.title = 'Servicio no encontrado — ICARUS';
    root.appendChild(el('section', { class: 'not-found' }, [
      el('div', { class: 'wrap' }, [
        el('img', { src: I.relUrl('assets/img/icarus-symbol.webp'), alt: '', width: '385', height: '710' }),
        el('h1', { class: 'h-section', text: 'Este servicio no existe' }),
        el('p', { class: 'lede', style: 'margin:0 auto 30px', text: 'Puede que el enlace esté incompleto. Explora el catálogo completo para encontrar lo que buscas.' }),
        el('a', { class: 'btn btn--blood', href: I.relUrl('#servicios'), text: 'Ver todos los servicios' })
      ])
    ]));
  }

  function render(s) {
    var cat = I.getCategory(s.cat);
    var demo = I.getDemo(s.demo);
    document.title = s.name + ' — ICARUS';
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', s.desc);
    var og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute('content', s.name + ' — ICARUS');

    var quoteHref = I.relUrl('?servicio=' + encodeURIComponent(s.id) + '#contacto');

    /* ----- Hero ----- */
    var hero = el('section', { class: 'svc-hero' }, [
      el('div', { class: 'wrap' }, [
        el('nav', { class: 'crumbs', 'aria-label': 'Ruta' }, [
          el('a', { href: I.relUrl(''), text: 'ICARUS' }),
          el('span', { 'aria-hidden': 'true', text: '◆' }),
          el('a', { href: I.relUrl('?categoria=' + s.cat + '#servicios'), text: cat ? cat.name : '' }),
          el('span', { 'aria-hidden': 'true', text: '◆' }),
          el('span', { 'aria-current': 'page', text: s.name })
        ]),
        el('div', { class: 'svc-hero__grid' }, [
          el('div', { class: 'reveal' }, [
            el('span', { class: 'eyebrow' }, [el('span', { class: 'rune', text: cat ? cat.rune : 'ᛁ' }), 'Categoría ' + (cat ? cat.letter + ' · ' + cat.short : '')]),
            el('h1', { class: 'h-display text-silver', text: s.name }),
            el('p', { class: 'tagline', text: s.tag }),
            el('p', { class: 'lede', text: s.long }),
            el('div', { class: 'svc-hero__actions' }, [
              el('button', { class: 'btn btn--blood', type: 'button', 'data-wa-service': s.id, text: 'Quiero esta' }),
              demo ? el('a', { class: 'btn btn--ghost', href: I.relUrl(demo.path), text: 'Ver demostración' }) : null,
              el('a', { class: 'btn btn--ghost', href: quoteHref, text: 'Solicitar cotización' })
            ]),
            el('div', { class: 'svc-hero__meta' }, [
              el('div', null, [el('small', { text: 'Categoría' }), el('b', { text: cat ? cat.name : '' })]),
              el('div', null, [el('small', { text: 'Inversión' }), el('b', { text: I.priceOf(s.id) })]),
              el('div', null, [el('small', { text: 'Complejidad' }), levelNode(s.level)])
            ])
          ]),
          demo ? el('a', { class: 'demo-card reveal', href: I.relUrl(demo.path), style: '--rd:.15s', 'aria-label': 'Abrir ejemplo visual: ' + demo.name }, [
            el('div', { class: 'browser' }, [
              el('div', { class: 'browser__bar', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]),
              el('div', { class: 'browser__shot' }, [el('img', { src: I.relUrl(demo.image), alt: 'Ejemplo visual: ' + demo.name, width: '1280', height: '800' })])
            ]),
            el('div', { class: 'demo-card__body', style: 'padding:16px 20px' }, [
              el('span', { class: 'svc-card__cat', text: 'Ejemplo visual' }),
              el('p', { style: 'margin:6px 0 0', text: demo.name })
            ])
          ]) : null
        ])
      ])
    ]);

    /* ----- Detalles ----- */
    var details = el('section', { class: 'section section--tight', 'aria-label': 'Detalles del servicio' }, [
      el('div', { class: 'wrap' }, [
        el('div', { class: 'detail-grid' }, [
          el('div', { class: 'detail-box lit reveal' }, [el('h2', null, [el('span', { class: 'rune', text: 'ᚠ' }), 'Características']), list(s.features)]),
          el('div', { class: 'detail-box lit reveal', style: '--rd:.08s' }, [el('h2', null, [el('span', { class: 'rune', text: 'ᛁ' }), 'Qué incluye']), list(s.includes)]),
          el('div', { class: 'detail-box lit reveal', style: '--rd:.16s' }, [el('h2', null, [el('span', { class: 'rune', text: 'ᛟ' }), 'Recomendado para']), list(s.recommended)])
        ])
      ])
    ]);

    /* ----- Demostración funcional ----- */
    var demoSec = null;
    if (demo) {
      var notes = demo.realNotes;
      demoSec = el('section', { class: 'section section--stone section--tight', 'aria-labelledby': 'live-title' }, [
        el('div', { class: 'wrap' }, [
          el('header', { class: 'section__head reveal' }, [
            el('span', { class: 'eyebrow' }, [el('span', { class: 'rune', text: 'ᛞ' }), 'Demostración funcional']),
            el('h2', { class: 'h-section', id: 'live-title', text: demo.name }),
            el('p', { class: 'lede', text: demo.desc + ' Pruébala aquí mismo o ábrela en pantalla completa.' })
          ]),
          el('div', { class: 'live-demo reveal' }, [
            el('div', { class: 'browser__bar', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]),
            el('iframe', { src: I.relUrl(demo.path) + '?embed=1', title: 'Demostración en vivo: ' + demo.name, loading: 'lazy', referrerpolicy: 'same-origin' })
          ]),
          el('div', { class: 'svc-hero__actions' }, [
            el('a', { class: 'btn btn--ghost', href: I.relUrl(demo.path), text: 'Abrir en pantalla completa' }),
            el('button', { class: 'btn btn--blood', type: 'button', 'data-wa-demo': demo.id, text: 'Quiero esta' })
          ]),
          notes ? el('div', { class: 'note', style: 'margin-top:34px' }, [
            el('strong', { style: 'color:var(--bone);display:block;margin-bottom:8px', text: 'Esta demostración usa datos de prueba en tu navegador. Una implementación real incluye:' }),
            el('ul', { style: 'margin:0;padding-left:18px' }, notes.map(function (n) { return el('li', { text: n }); }))
          ]) : null
        ])
      ]);
    }

    /* ----- Relacionados ----- */
    var rel = I.servicesByCat(s.cat).filter(function (x) { return x.id !== s.id; });
    var related = el('section', { class: 'section section--tight', 'aria-labelledby': 'rel-title' }, [
      el('div', { class: 'wrap' }, [
        el('header', { class: 'section__head reveal' }, [
          el('span', { class: 'eyebrow' }, [el('span', { class: 'rune', text: cat ? cat.rune : 'ᛁ' }), 'Más en ' + (cat ? cat.name : '')]),
          el('h2', { class: 'h-section', id: 'rel-title', text: 'Servicios relacionados' })
        ]),
        el('div', { class: 'related reveal' }, rel.map(function (r) {
          return el('a', { href: I.relUrl('servicio/?id=' + encodeURIComponent(r.id)) }, [el('b', { text: r.name }), el('span', { text: r.tag })]);
        })),
        el('div', { class: 'panel reveal', style: 'margin-top:50px;text-align:center' }, [
          el('h2', { class: 'h-section', style: 'margin-top:0', text: '¿Listo para despegar?' }),
          el('p', { class: 'lede', style: 'margin:0 auto 26px', text: 'Escríbenos con un clic: el mensaje ya incluye el servicio y la demostración que viste.' }),
          el('div', { class: 'svc-hero__actions', style: 'justify-content:center;margin:0' }, [
            el('button', { class: 'btn btn--blood', type: 'button', 'data-wa-service': s.id, text: 'Quiero esta' }),
            el('a', { class: 'btn btn--ghost', href: quoteHref, text: 'Armar cotización detallada' })
          ])
        ])
      ])
    ]);

    [hero, details, demoSec, related].forEach(function (n) { if (n) root.appendChild(n); });
  }

  function footerDemos() {
    var foot = document.getElementById('footer-demos');
    if (!foot) return;
    I.data.demos.forEach(function (d) { foot.appendChild(el('li', null, [el('a', { href: I.relUrl(d.path), text: d.project })])); });
  }

  var id = I.param('id');
  var s = id && I.getService(id);
  if (s) render(s); else notFound();
  footerDemos();
  I.reveal();
  document.body.classList.add('is-ready');
})();
