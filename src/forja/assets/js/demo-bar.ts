/* =========================================================
   ICARUS — BARRA DE DEMOSTRACIÓN
   Uso: <html data-root="../../" data-demo="<id de data.js>">
   Requiere config.js, data.js y core.js antes de este archivo.
   ========================================================= */
(function () {
  'use strict';

  var I = window.ICARUS;
  if (!I) return;
  var el = I.el;
  var demo = I.getDemo(document.documentElement.getAttribute('data-demo'));
  if (!demo) return;

  var embedded = I.param('embed') === '1' || window.self !== window.top;
  var mainService = I.servicesByDemo(demo.id)[0];

  function build() {
    var infoPanel = null;
    if (demo.realNotes && demo.realNotes.length) {
      infoPanel = el('aside', { class: 'ixb-info', id: 'ixb-info', role: 'dialog', 'aria-label': 'Sobre esta demostración' }, [
        el('button', { type: 'button', 'aria-label': 'Cerrar', text: '×', on: { click: toggleInfo } }),
        el('h2', { text: 'Sobre esta demostración' }),
        el('p', { text: 'Funciona con datos de prueba guardados en tu navegador, para que puedas probarla libremente. Una implementación real incluye:' }),
        el('ul', null, demo.realNotes.map(function (n) { return el('li', { text: n }); }))
      ]);
    }

    function toggleInfo() {
      if (!infoPanel) return;
      var open = !infoPanel.classList.contains('is-open');
      infoPanel.classList.toggle('is-open', open);
      infoBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    var backAttrs: Record<string, any> = { class: 'ixb__back', href: I.relUrl('#demostraciones'), 'aria-label': 'Volver a ICARUS' };
    if (embedded) backAttrs.target = '_top';

    var infoBtn = infoPanel ? el('button', {
      class: 'ixb__btn ixb__hide-sm', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'ixb-info', text: 'Info',
      on: { click: toggleInfo }
    }) : null;

    var fichaAttrs: Record<string, any> = { class: 'ixb__btn ixb__hide-sm', href: I.relUrl('servicio/?id=' + (mainService ? mainService.id : '')), text: 'Ver ficha' };
    if (embedded) fichaAttrs.target = '_top';

    var bar = el('div', { class: 'ixb', role: 'region', 'aria-label': 'Barra de ICARUS' }, [
      el('a', backAttrs, [
        el('span', { 'aria-hidden': 'true', text: '←' }),
        el('img', { src: I.relUrl('assets/img/icarus-symbol.webp'), alt: '', width: '30', height: '30' }),
        el('b', { text: 'ICARUS' })
      ]),
      el('div', { class: 'ixb__title' }, [
        el('small', { text: 'Demostración' }),
        el('strong', { text: demo.project })
      ]),
      el('div', { class: 'ixb__actions' }, [
        infoBtn,
        embedded ? null : el('a', fichaAttrs),
        el('button', {
          class: 'ixb__btn ixb__btn--blood', type: 'button', 'aria-label': 'Quiero esta página: abrir WhatsApp',
          on: { click: function () { I.openWhatsApp(I.msg.demo(demo)); } }
        }, [I.waIcon(16), 'Quiero esta'])
      ])
    ]);

    document.body.insertBefore(bar, document.body.firstChild);
    if (infoPanel) document.body.appendChild(infoPanel);
    document.body.classList.add('ixb-on');
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && infoPanel && infoPanel.classList.contains('is-open')) toggleInfo();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  /* Permite que cada demo abra WhatsApp con su propio mensaje
     (por ejemplo, un pedido o una reserva de ejemplo). */
  window.ICARUS_DEMO = { demo: demo, embedded: embedded };
})();
