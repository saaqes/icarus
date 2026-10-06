/* =========================================================
   ICARUS — PÁGINA DE INICIO
   Renderiza categorías, catálogo, demostraciones, comparativa
   y el cotizador por WhatsApp a partir de data.js.
   ========================================================= */
(function () {
  'use strict';

  var I = window.ICARUS;
  var D = I.data;
  var el = I.el;

  /* ---------- Título del hero: aparición letra por letra ---------- */
  (function splitTitle() {
    var title = document.querySelector('[data-split]');
    if (!title) return;
    var label = title.textContent.replace(/\s+/g, ' ').trim();
    title.setAttribute('aria-label', label);
    var i = 0;
    title.querySelectorAll('.line').forEach(function (line) {
      var text = line.textContent;
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      text.trim().split(/\s+/).forEach(function (word, w) {
        if (w) line.appendChild(document.createTextNode(' '));
        var wordEl = el('span', { class: 'word' });
        word.split('').forEach(function (ch) {
          var s = el('span', { class: 'char', text: ch });
          s.style.setProperty('--i', String(i++));
          wordEl.appendChild(s);
        });
        line.appendChild(wordEl);
      });
    });
  })();

  /* ---------- Categorías ---------- */
  var state = { cat: 'all', q: '' };

  function renderCategories() {
    var grid = document.getElementById('cat-grid');
    D.categories.forEach(function (c, idx) {
      var services = I.servicesByCat(c.id);
      var list = el('ul', null, services.slice(0, 6).map(function (s) { return el('li', { text: s.name }); }));
      var card = el('button', {
        class: 'cat-card lit reveal',
        type: 'button',
        'aria-label': 'Explorar ' + c.name + ' (' + services.length + ' servicios)',
        on: { click: function () { applyFilter(c.id, true); } }
      }, [
        el('span', { class: 'cat-card__rune', 'aria-hidden': 'true', text: c.rune }),
        el('span', { class: 'cat-card__letter', text: 'CATEGORÍA ' + c.letter }),
        el('span', { class: 'cat-card__icon' }, [I.icon(c.icon, 52)]),
        el('h3', { text: c.name }),
        el('p', { text: c.desc }),
        list,
        el('span', { class: 'link-arrow', text: 'Explorar ' + services.length + ' servicios' })
      ]);
      card.style.setProperty('--rd', (idx * 0.08) + 's');
      grid.appendChild(card);
    });
  }

  /* ---------- Filtros y buscador ---------- */
  function renderFilters() {
    var wrap = document.getElementById('svc-filters');
    var opts = [{ id: 'all', short: 'Todos' }].concat(D.categories);
    opts.forEach(function (c) {
      wrap.appendChild(el('button', {
        class: 'chip', type: 'button', 'data-cat': c.id, 'aria-pressed': c.id === state.cat ? 'true' : 'false',
        text: c.short,
        on: { click: function () { applyFilter(c.id, false); } }
      }));
    });
    var input = document.getElementById('svc-search') as HTMLInputElement;
    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = I.clean(input.value, 60); renderServices(); }, 120);
    });
  }

  function applyFilter(cat, scroll) {
    state.cat = I.getCategory(cat) ? cat : 'all';
    document.querySelectorAll('#svc-filters .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-cat') === state.cat ? 'true' : 'false');
    });
    renderServices();
    if (scroll) {
      var target = document.getElementById('servicios');
      target.scrollIntoView({ behavior: I.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function normalize(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function matches(s) {
    if (state.cat !== 'all' && s.cat !== state.cat) return false;
    if (!state.q) return true;
    var cat = I.getCategory(s.cat);
    var hay = normalize([s.name, s.tag, s.desc, cat ? cat.name : '', s.features.join(' ')].join(' '));
    return normalize(state.q).split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function serviceCard(s, idx) {
    var cat = I.getCategory(s.cat);
    var demo = I.getDemo(s.demo);
    var card = el('article', { class: 'svc-card lit reveal', id: 'svc-' + s.id }, [
      el('div', { class: 'svc-card__top' }, [
        el('span', { class: 'svc-card__cat', text: cat ? cat.short : '' }),
        el('span', { class: 'price', text: I.priceOf(s.id) })
      ]),
      el('h3', { text: s.name }),
      el('p', { class: 'svc-card__tag', text: s.tag }),
      el('p', { class: 'svc-card__desc', text: s.desc }),
      el('ul', { class: 'svc-card__feats', 'aria-label': 'Características' }, s.features.slice(0, 4).map(function (f) { return el('li', { text: f }); })),
      el('div', { class: 'svc-card__actions' }, [
        demo ? el('a', { class: 'btn btn--ghost btn--sm', href: I.relUrl(demo.path), text: 'Ver demo', 'aria-label': 'Ver demostración de ' + s.name }) : null,
        el('button', { class: 'btn btn--blood btn--sm', type: 'button', 'data-wa-service': s.id, text: 'Quiero esta' })
      ]),
      el('div', { class: 'svc-card__links' }, [
        el('a', { class: 'link-arrow', href: I.relUrl('servicio/?id=' + encodeURIComponent(s.id)), text: 'Ver detalles' }),
        el('button', { class: 'link-arrow', type: 'button', text: 'Cotizar', on: { click: function () { preselectQuote(s.id); } } })
      ])
    ]);
    card.style.setProperty('--rd', ((idx % 3) * 0.07) + 's');
    return card;
  }

  function renderServices() {
    var grid = document.getElementById('svc-grid');
    var list = D.services.filter(matches);
    grid.textContent = '';
    if (!list.length) {
      grid.appendChild(el('div', { class: 'empty-state' }, [
        el('p', { text: 'No encontramos servicios con esa búsqueda. Cuéntanos qué necesitas y lo construimos.' }),
        el('button', { class: 'btn btn--blood btn--sm', type: 'button', 'data-wa': 'general', text: 'Hablemos por WhatsApp' })
      ]));
    } else {
      list.forEach(function (s, i) { grid.appendChild(serviceCard(s, i)); });
    }
    var cat = I.getCategory(state.cat);
    document.getElementById('svc-meta').textContent =
      list.length + (list.length === 1 ? ' servicio' : ' servicios') +
      (cat ? ' en ' + cat.name : '') + (state.q ? ' para «' + state.q + '»' : '');
    I.reveal(grid);
  }

  /* ---------- Demostraciones ---------- */
  function renderDemos() {
    var grid = document.getElementById('demo-grid');
    var foot = document.getElementById('footer-demos');
    D.demos.forEach(function (d, idx) {
      var cat = I.getCategory(d.cat);
      var uses = I.servicesByDemo(d.id).map(function (s) { return s.name; });
      var card = el('article', { class: 'demo-card reveal' }, [
        el('a', { class: 'browser', href: I.relUrl(d.path), 'aria-label': 'Abrir ' + d.name }, [
          el('div', { class: 'browser__bar', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]),
          el('div', { class: 'browser__shot' }, [
            el('img', { src: I.relUrl(d.image), alt: 'Vista previa de ' + d.name, loading: 'lazy', width: '1280', height: '800' })
          ])
        ]),
        el('div', { class: 'demo-card__body' }, [
          el('div', null, [
            el('span', { class: 'svc-card__cat', text: cat ? cat.short : '' }),
            d.backend ? el('span', { class: 'badge-backend', style: 'margin-left:10px', text: 'Datos de prueba' }) : null
          ]),
          el('h3', { text: d.name }),
          el('p', { text: d.desc }),
          el('p', { class: 'demo-card__uses', text: 'Sirve de referencia para: ' + uses.join(', ') + '.' }),
          el('div', { class: 'demo-card__actions' }, [
            el('a', { class: 'btn btn--ghost btn--sm', href: I.relUrl(d.path), text: 'Abrir demo' }),
            el('button', { class: 'btn btn--blood btn--sm', type: 'button', 'data-wa-demo': d.id, text: 'Quiero esta' })
          ])
        ])
      ]);
      card.style.setProperty('--rd', ((idx % 3) * 0.08) + 's');
      grid.appendChild(card);
      foot.appendChild(el('li', null, [el('a', { href: I.relUrl(d.path), text: d.project })]));
    });
  }

  /* ---------- Comparativa ---------- */
  function renderCompare() {
    var C = D.comparison;
    var thead = el('thead', null, [el('tr', null, [el('th', { scope: 'col' }, [el('span', { class: 'sr-only', text: 'Característica' })])].concat(
      C.columns.map(function (c, i) {
        return el('th', { scope: 'col' }, [el('small', { text: 'Nivel ' + (i + 1) }), c.name]);
      })
    ))]);
    var rows = C.rows.map(function (r) {
      return el('tr', null, [el('th', { scope: 'row', text: r.label })].concat(r.values.map(function (v) {
        if (typeof v === 'number') {
          var lv = el('span', { class: 'level', 'aria-label': 'Complejidad ' + v + ' de 4' });
          for (var k = 1; k <= 4; k++) lv.appendChild(el('i', { class: k <= v ? 'on' : '' }));
          return el('td', null, [lv]);
        }
        return el('td', { text: v });
      })));
    });
    rows.push(el('tr', { class: 'compare__cta' }, [el('th', { scope: 'row', text: 'Ver' })].concat(C.columns.map(function (c) {
      return el('td', null, [el('a', { class: 'link-arrow', href: I.relUrl('servicio/?id=' + c.service), text: 'Detalles' })]);
    }))));
    var table = el('table', null, [thead, el('tbody', null, rows)]);
    document.getElementById('compare').appendChild(table);
  }

  /* ---------- Cotizador ---------- */
  var NEEDS = [
    'Diseño personalizado', 'Integración con WhatsApp', 'Formulario de contacto', 'Catálogo de productos',
    'Carrito de compras', 'Pagos en línea', 'Panel de administración', 'Base de datos',
    'Usuarios e inicio de sesión', 'Reservas o agenda', 'Blog o noticias', 'Optimización para Google (SEO)',
    'Reportes o dashboard', 'Mantenimiento mensual'
  ];
  var HOSTING_LABEL = {
    con: 'Con hosting y dominio',
    sin: 'Sin hosting ni dominio',
    asesoria: 'Necesito asesoría',
    tengo: 'Ya tengo dominio'
  };

  var form = document.getElementById('quote-form') as any;
  var qCat = document.getElementById('q-cat') as HTMLSelectElement;
  var qType = document.getElementById('q-type') as HTMLSelectElement;
  var qIdea = document.getElementById('q-idea') as HTMLTextAreaElement;
  var preview = document.getElementById('wa-preview');

  function fillTypes(catId, selectedId?) {
    qType.textContent = '';
    qType.appendChild(el('option', { value: '', text: catId ? 'Selecciona el proyecto' : 'Primero elige una categoría' }));
    if (catId) {
      I.servicesByCat(catId).forEach(function (s) { qType.appendChild(el('option', { value: s.id, text: s.name })); });
      qType.appendChild(el('option', { value: 'otro', text: 'Otro / no estoy seguro' }));
    }
    qType.disabled = !catId;
    if (selectedId) qType.value = selectedId;
  }

  function initQuote() {
    qCat.appendChild(el('option', { value: '', text: 'Selecciona una categoría' }));
    D.categories.forEach(function (c) { qCat.appendChild(el('option', { value: c.id, text: c.name })); });
    fillTypes('');

    var needs = document.getElementById('q-needs');
    NEEDS.forEach(function (n) {
      needs.appendChild(el('label', { class: 'opt' }, [el('input', { type: 'checkbox', name: 'needs', value: n }), el('span', { text: n })]));
    });

    var slot = document.getElementById('wa-ico-slot');
    if (slot) slot.replaceWith(I.waIcon(20));

    qCat.addEventListener('change', function () { fillTypes(qCat.value); clearErrors(); updatePreview(); });
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);
    qIdea.addEventListener('input', function () {
      document.getElementById('q-count').textContent = qIdea.value.length + '/800';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      I.openWhatsApp(buildMessage());
      I.toast('Abriendo WhatsApp con tu solicitud…');
    });

    document.querySelectorAll('[data-quote-hosting]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-quote-hosting');
        var r = form.querySelector('input[name="hosting"][value="' + (v === 'con' ? 'con' : 'sin') + '"]') as HTMLInputElement;
        if (r) r.checked = true;
        updatePreview();
        scrollToQuote();
      });
    });

    // Preselección segura desde la URL (?servicio=id o ?categoria=id) — solo ids existentes
    var pSvc = I.param('servicio');
    var pCat = I.param('categoria');
    if (pSvc && I.getService(pSvc)) preselectQuote(pSvc, true);
    else if (pCat && I.getCategory(pCat)) { qCat.value = pCat; fillTypes(pCat); applyFilter(pCat, false); }

    updatePreview();
  }

  function scrollToQuote() {
    document.getElementById('contacto').scrollIntoView({ behavior: I.reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function preselectQuote(serviceId, silent?) {
    var s = I.getService(serviceId);
    if (!s) return;
    qCat.value = s.cat;
    fillTypes(s.cat, s.id);
    clearErrors();
    updatePreview();
    if (!silent) {
      scrollToQuote();
      I.toast('«' + s.name + '» seleccionado en el cotizador');
    } else {
      setTimeout(scrollToQuote, 600);
    }
  }

  function clearErrors() { form.querySelectorAll('.has-error').forEach(function (f) { f.classList.remove('has-error'); }); }

  function validate() {
    clearErrors();
    var ok = true;
    if (!qCat.value) { qCat.closest('.field')!.classList.add('has-error'); ok = false; }
    if (!qType.value) { qType.closest('.field')!.classList.add('has-error'); ok = false; }
    if (!ok) {
      var first = form.querySelector('.has-error select') as HTMLElement;
      if (first) first.focus();
    }
    return ok;
  }

  function buildMessage() {
    var cat = I.getCategory(qCat.value);
    var svc = I.getService(qType.value);
    var demo = svc ? I.getDemo(svc.demo) : null;
    var needs = Array.prototype.slice.call(form.querySelectorAll('input[name="needs"]:checked')).map(function (i) { return i.value; });
    var hostingEl = form.querySelector('input[name="hosting"]:checked') as HTMLInputElement;
    var hosting = hostingEl ? HOSTING_LABEL[hostingEl.value] : '';
    var name = I.clean(form.nombre.value, 60);
    var biz = I.clean(form.negocio.value, 80);
    var idea = I.clean(qIdea.value, 800);

    var L = ['Hola, ICARUS. Quiero solicitar una cotización.', ''];
    L.push('📂 Categoría: ' + (cat ? cat.name : '—'));
    L.push('🖥️ Proyecto: ' + (svc ? svc.name : (qType.value === 'otro' ? 'Otro / no estoy seguro' : '—')));
    if (demo) L.push('🔗 Demo de referencia: ' + I.absUrl(demo.path));
    if (needs.length) L.push('✅ Necesito: ' + needs.join(', '));
    if (hosting) L.push('🌐 Hosting y dominio: ' + hosting);
    if (name) L.push('👤 Nombre: ' + name);
    if (biz) L.push('🏢 Negocio: ' + biz);
    if (idea) L.push('', '💡 Mi idea:', idea);
    L.push('', 'Quiero recibir información y una cotización.');
    return L.join('\n');
  }

  function updatePreview() { preview.textContent = buildMessage(); }

  renderCategories();
  renderFilters();
  renderServices();
  renderDemos();
  renderCompare();
  initQuote();
  I.reveal();
})();
