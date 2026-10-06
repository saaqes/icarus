/* =========================================================
   ICARUS — NÚCLEO COMPARTIDO
   Utilidades seguras: rutas, WhatsApp, búsqueda en el catálogo
   y creación de elementos sin innerHTML.
   ========================================================= */
(function () {
  'use strict';

  var CFG = window.ICARUS_CONFIG;
  var DATA = window.ICARUS_DATA;

  /* ---------- Raíz del sitio ----------
     Cada página declara <html data-root="./"> o "../../".
     Si CONFIG.SITE_URL es una URL https válida, se usa esa. */
  function siteRoot() {
    if (CFG.SITE_URL && /^https:\/\/[a-z0-9.-]+(:\d+)?\/([\w\-./]*)?$/i.test(CFG.SITE_URL)) {
      return CFG.SITE_URL.replace(/\/?$/, '/');
    }
    var rel = document.documentElement.getAttribute('data-root') || './';
    return new URL(rel, window.location.href).href;
  }

  function absUrl(path) {
    // path siempre proviene de data.js (rutas internas controladas)
    return new URL(String(path).replace(/^\/+/, ''), siteRoot()).href;
  }

  function relUrl(path) {
    var rel = document.documentElement.getAttribute('data-root') || './';
    return rel + String(path).replace(/^\/+/, '');
  }

  /* ---------- Saneamiento de texto ---------- */
  function clean(str, max) {
    return String(str == null ? '' : str)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, max || 600);
  }

  /* ---------- WhatsApp ---------- */
  function waNumber() {
    var n = String(CFG.WHATSAPP_NUMBER || '').replace(/\D/g, '');
    return /^\d{10,15}$/.test(n) ? n : '';
  }

  function waLink(message) {
    var n = waNumber();
    var base = 'https://wa.me/' + n;
    return message ? base + '?text=' + encodeURIComponent(message) : base;
  }

  function openWhatsApp(message) {
    var url = waLink(message);
    var w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) window.location.href = url;
  }

  var MSG = {
    general: function () {
      return 'Hola, estoy interesado en los servicios de desarrollo web de ICARUS. Me gustaría recibir información sobre las opciones disponibles.';
    },
    service: function (s) {
      var cat = getCategory(s.cat);
      var demo = getDemo(s.demo);
      var lines = [
        'Hola, ICARUS.',
        '',
        'Quiero esta página:',
        '',
        '🖥️ Proyecto: ' + s.name,
        '📂 Categoría: ' + (cat ? cat.name : '')
      ];
      if (demo) {
        lines.push('👁️ Demostración: ' + demo.name);
        lines.push('🔗 Demo: ' + absUrl(demo.path));
        lines.push('🖼️ Imagen de referencia: ' + absUrl(demo.image));
      }
      lines.push('', 'Quiero recibir información y una cotización.');
      return lines.join('\n');
    },
    demo: function (d) {
      var cat = getCategory(d.cat);
      return [
        'Hola, estoy interesado en la ' + d.project + ' de ICARUS.',
        '',
        'Vi la demostración y quiero solicitar información sobre este proyecto.',
        '',
        '🖥️ Proyecto: ' + d.project,
        '📂 Categoría: ' + (cat ? cat.name : ''),
        '👁️ Demostración: ' + d.name,
        '',
        'Página seleccionada:',
        absUrl(d.path),
        '',
        'Imagen de referencia:',
        absUrl(d.image),
        '',
        'Quiero recibir información y una cotización.'
      ].join('\n');
    }
  };

  /* ---------- Catálogo ---------- */
  function getCategory(id) { return DATA.categories.filter(function (c) { return c.id === id; })[0] || null; }
  function getService(id) { return DATA.services.filter(function (s) { return s.id === id; })[0] || null; }
  function getDemo(id) { return DATA.demos.filter(function (d) { return d.id === id; })[0] || null; }
  function servicesByCat(id) { return DATA.services.filter(function (s) { return s.cat === id; }); }
  function servicesByDemo(id) { return DATA.services.filter(function (s) { return s.demo === id; }); }

  function priceOf(id) {
    if (!CFG.SHOW_PRICES) return CFG.PRICE_FALLBACK;
    var p = CFG.PRICES && CFG.PRICES[id];
    return p ? String(p) : CFG.PRICE_FALLBACK;
  }

  /* ---------- Constructor de elementos (sin innerHTML) ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'on') Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* ---------- Iconografía (SVG estáticos, sin datos de usuario) ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    temple: ['M4 20h40', 'M7 20L24 8l17 12', 'M10 24v16', 'M18 24v16', 'M30 24v16', 'M38 24v16', 'M5 43h38', 'M8 40h32'],
    amphora: ['M18 6h12', 'M20 6v5c-7 3-10 9-10 16 0 8 6 14 14 15 8-1 14-7 14-15 0-7-3-13-10-16V6', 'M14 22h20', 'M12 30h24', 'M10 12c-4 2-4 8 1 10', 'M38 12c4 2 4 8-1 10'],
    shield: ['M24 4l16 6v12c0 11-7 18-16 22C15 40 8 33 8 22V10z', 'M24 12v24', 'M16 20h16', 'M17 28l7-8 7 8'],
    forge: ['M6 18h26c0 5 4 8 10 8v4H30l-4 6h6v6H14v-6h6l-4-6c-6 0-10-4-10-12z', 'M36 6l-4 6', 'M42 10l-6 4', 'M30 4v6'],
    feather: ['M38 6C24 8 12 20 10 38', 'M10 38l-4 4', 'M38 6c0 14-8 24-22 28', 'M20 30l8-2', 'M24 22l8-2', 'M28 15l6-2'],
    whatsapp: null
  };

  function icon(name, size?): SVGSVGElement {
    var svg = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', size || 48);
    svg.setAttribute('height', size || 48);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    (ICONS[name] || ICONS.feather).forEach(function (d) {
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  function waIcon(size?): SVGSVGElement {
    var svg = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size || 20);
    svg.setAttribute('height', size || 20);
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.03c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.23.54.77 1.88.84 2.01.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.7 1.16 1.51 1.88 1.04.93 1.91 1.21 2.18 1.35.27.14.43.11.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.23.61-.14.25.09 1.59.75 1.86.89.27.14.45.2.52.32.07.11.07.66-.17 1.34z');
    svg.appendChild(p);
    return svg;
  }

  /* ---------- Parámetros de URL (solo ids conocidos) ---------- */
  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch (e) { return null; }
  }

  /* ---------- Almacenamiento seguro ---------- */
  var store = {
    get: function (k, fallback) {
      try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
    }
  };

  window.ICARUS = {
    cfg: CFG,
    data: DATA,
    siteRoot: siteRoot,
    absUrl: absUrl,
    relUrl: relUrl,
    clean: clean,
    waLink: waLink,
    openWhatsApp: openWhatsApp,
    msg: MSG,
    getCategory: getCategory,
    getService: getService,
    getDemo: getDemo,
    servicesByCat: servicesByCat,
    servicesByDemo: servicesByDemo,
    priceOf: priceOf,
    el: el,
    icon: icon,
    waIcon: waIcon,
    param: param,
    store: store,
    reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };
})();
