/* Demo Dashboard — Pulso Analytics (datos ficticios generados) */
(function () {
  'use strict';
  var I = window.ICARUS;
  var el = I.el;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = I.reducedMotion;

  function svgEl(tag, attrs?) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  /* Generador pseudoaleatorio con semilla: los datos son estables entre recargas */
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  var CHANNELS = [
    { id: 'web', name: 'Tienda web', color: '#2fd3c5', share: 0.42 },
    { id: 'wa', name: 'WhatsApp', color: '#f7a046', share: 0.27 },
    { id: 'ig', name: 'Instagram', color: '#8c7cff', share: 0.19 },
    { id: 'pos', name: 'Punto físico', color: '#ff5d7a', share: 0.12 }
  ];
  var CITIES = ['Bogotá', 'Medellín', 'Cali', 'Armenia', 'Pereira', 'Barranquilla'];
  var NAMES = ['Laura G.', 'Andrés P.', 'Camila R.', 'Santiago M.', 'Valentina T.', 'Mateo C.', 'Sofía L.', 'Julián H.', 'Daniela V.', 'Felipe O.', 'Mariana S.', 'Tomás A.'];
  var state = { range: 30, channel: 'all', status: 'all' };

  /* Serie diaria de 90 días */
  var r = rng(42);
  var DAYS = [];
  for (var d = 89; d >= 0; d--) {
    var date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - d);
    var weekday = date.getDay();
    var base = 3.2e6 + (89 - d) * 14000 + (weekday === 5 || weekday === 6 ? 1.1e6 : 0);
    var day = { date: date, total: 0, by: {}, orders: 0, visits: Math.round(1800 + r() * 900 + (89 - d) * 6) };
    CHANNELS.forEach(function (c) { var v = base * c.share * (0.75 + r() * 0.5); day.by[c.id] = v; day.total += v; });
    day.orders = Math.round(day.total / (78000 + r() * 30000));
    DAYS.push(day);
  }
  var ORDERS = [];
  var ro = rng(7);
  for (var o = 0; o < 14; o++) {
    var ch = CHANNELS[Math.floor(ro() * CHANNELS.length)];
    ORDERS.push({ id: '#' + (10482 - o), name: NAMES[o % NAMES.length], ch: ch, total: Math.round((60 + ro() * 420) * 1000), st: ['Pagado', 'Enviado', 'Pendiente'][Math.floor(ro() * 3)] });
  }

  function money(n, short?) {
    if (short && n >= 1e6) return '$' + (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
    return '$' + Math.round(n).toLocaleString('es-CO');
  }
  function val(day) { return state.channel === 'all' ? day.total : day.by[state.channel]; }
  function slice(offset) { return DAYS.slice(DAYS.length - state.range - (offset || 0), DAYS.length - (offset || 0)); }

  /* ---------- KPIs ---------- */
  function sparkline(values, color) {
    var svg = svgEl('svg', { viewBox: '0 0 100 30', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var pts = values.map(function (v, i) { return (i / (values.length - 1) * 100).toFixed(2) + ',' + (28 - (v - min) / (max - min || 1) * 24).toFixed(2); });
    svg.appendChild(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': '1.6', 'vector-effect': 'non-scaling-stroke' }));
    return svg;
  }
  function renderKpis() {
    var cur = slice(0);
    var prevRange = state.range <= 45 ? slice(state.range) : null;
    var share = state.channel === 'all' ? 1 : CHANNELS.filter(function (c) { return c.id === state.channel; })[0].share;
    var sales = cur.reduce(function (a, x) { return a + val(x); }, 0);
    var orders = Math.round(cur.reduce(function (a, x) { return a + x.orders; }, 0) * share);
    var visits = Math.round(cur.reduce(function (a, x) { return a + x.visits; }, 0) * share);
    var prevSales = prevRange ? prevRange.reduce(function (a, x) { return a + val(x); }, 0) : sales * 0.88;
    function delta(a, b) { var p = (a - b) / b * 100; return el('em', { class: p >= 0 ? 'up' : 'down', text: (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p).toFixed(1) + ' % vs. periodo anterior' }); }
    var box = document.getElementById('kpis'); box.textContent = '';
    [
      ['Ventas', money(sales, true), delta(sales, prevSales), cur.map(val), '#2fd3c5'],
      ['Pedidos', orders.toLocaleString('es-CO'), delta(orders, orders * 0.91), cur.map(function (x) { return x.orders; }), '#f7a046'],
      ['Ticket promedio', money(sales / Math.max(1, orders)), delta(sales / orders, sales / orders * 0.97), cur.map(function (x) { return val(x) / Math.max(1, x.orders); }), '#8c7cff'],
      ['Conversión', (orders / visits * 100).toFixed(2) + ' %', delta(orders / visits, orders / visits * 1.02), cur.map(function (x) { return x.orders / x.visits; }), '#ff5d7a']
    ].forEach(function (k) {
      box.appendChild(el('div', { class: 'kpi' }, [el('small', { text: k[0] }), el('b', { text: k[1] }), k[2], sparkline(k[3], k[4])]));
    });
  }

  /* ---------- Gráfica de líneas ---------- */
  var tip = document.getElementById('tip');
  function renderLine() {
    var box = document.getElementById('line-chart'); box.textContent = '';
    var data = slice(0);
    var W = 700, H = 280, P = { l: 52, r: 10, t: 10, b: 26 };
    var vals = data.map(val);
    var goal = vals.map(function (v, i) { return (vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) * (0.92 + i / vals.length * 0.16); });
    var max = Math.max.apply(null, vals.concat(goal)) * 1.1;
    var x = function (i) { return P.l + i / (data.length - 1) * (W - P.l - P.r); };
    var y = function (v) { return H - P.b - v / max * (H - P.t - P.b); };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Gráfica de ventas diarias frente a la meta' });
    var g = svgEl('g', { class: 'grid' });
    for (var k = 0; k <= 4; k++) {
      var gv = max / 4 * k;
      g.appendChild(svgEl('line', { x1: P.l, x2: W - P.r, y1: y(gv), y2: y(gv) }));
      var t = svgEl('text', { x: P.l - 8, y: y(gv) + 4, 'text-anchor': 'end' }); t.textContent = (gv / 1e6).toFixed(1) + 'M'; g.appendChild(t);
    }
    var step = Math.ceil(data.length / 6);
    data.forEach(function (dd, i) {
      if (i % step) return;
      var t = svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' });
      t.textContent = dd.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
      g.appendChild(t);
    });
    svg.appendChild(g);
    var defs = svgEl('defs');
    var grad = svgEl('linearGradient', { id: 'fill', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgEl('stop', { offset: '0', 'stop-color': '#2fd3c5', 'stop-opacity': '.35' }));
    grad.appendChild(svgEl('stop', { offset: '1', 'stop-color': '#2fd3c5', 'stop-opacity': '0' }));
    defs.appendChild(grad); svg.appendChild(defs);
    function path(arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' '); }
    svg.appendChild(svgEl('path', { d: path(vals) + ' L' + x(vals.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + 'Z', fill: 'url(#fill)' }));
    svg.appendChild(svgEl('path', { d: path(goal), fill: 'none', stroke: '#f7a046', 'stroke-width': '2', 'stroke-dasharray': '6 5', 'vector-effect': 'non-scaling-stroke' }));
    var line = svgEl('path', { d: path(vals), fill: 'none', stroke: '#2fd3c5', 'stroke-width': '2.5', 'vector-effect': 'non-scaling-stroke', class: reduce ? '' : 'draw', style: '--len:3000' });
    svg.appendChild(line);
    var hl = svgEl('line', { class: 'hover-line', y1: P.t, y2: H - P.b, visibility: 'hidden' });
    var dot = svgEl('circle', { class: 'dot', r: '5', visibility: 'hidden' });
    svg.appendChild(hl); svg.appendChild(dot);
    box.appendChild(svg);

    function move(clientX, clientY) {
      var rect = svg.getBoundingClientRect();
      var px = (clientX - rect.left) / rect.width * W;
      var i = Math.max(0, Math.min(data.length - 1, Math.round((px - P.l) / (W - P.l - P.r) * (data.length - 1))));
      hl.setAttribute('x1', String(x(i))); hl.setAttribute('x2', String(x(i))); hl.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', String(x(i))); dot.setAttribute('cy', String(y(vals[i]))); dot.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.textContent = '';
      tip.appendChild(el('b', { text: data[i].date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' }) }));
      tip.appendChild(document.createTextNode('Ventas: ' + money(vals[i]) + ' · Meta: ' + money(goal[i])));
      var tx = Math.min(window.innerWidth - tip.offsetWidth - 10, clientX + 14);
      tip.style.left = Math.max(10, tx) + 'px'; tip.style.top = (clientY - 50) + 'px';
    }
    function hide() { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); }
    svg.addEventListener('pointermove', function (e: PointerEvent) { move(e.clientX, e.clientY); });
    svg.addEventListener('pointerleave', hide);
  }

  /* ---------- Dona por canal ---------- */
  function renderDonut() {
    var box = document.getElementById('donut'); box.textContent = '';
    var legend = document.getElementById('donut-legend'); legend.textContent = '';
    var data = slice(0);
    var totals = CHANNELS.map(function (c) { return { c: c, v: data.reduce(function (a, x) { return a + x.by[c.id]; }, 0) }; });
    var sum = totals.reduce(function (a, t) { return a + t.v; }, 0);
    var svg = svgEl('svg', { viewBox: '0 0 42 42', role: 'img', 'aria-label': 'Distribución de ventas por canal' });
    var R = 15.915, off = 0;
    var center = el('div', { class: 'donut-center' }, [el('div', null, [el('b', { text: money(sum, true) }), el('span', { text: 'total del periodo' })])]);
    totals.forEach(function (t) {
      var pct = t.v / sum * 100;
      var active = state.channel === 'all' || state.channel === t.c.id;
      var circ = svgEl('circle', { cx: '21', cy: '21', r: R, fill: 'none', stroke: t.c.color, 'stroke-width': active ? '5' : '3.5', 'stroke-dasharray': pct.toFixed(2) + ' ' + (100 - pct).toFixed(2), 'stroke-dashoffset': (-off).toFixed(2), opacity: active ? '1' : '.3' });
      circ.addEventListener('click', function () { setChannel(state.channel === t.c.id ? 'all' : t.c.id); });
      svg.appendChild(circ);
      off += pct;
      legend.appendChild(el('li', null, [el('i', { style: 'background:' + t.c.color }), t.c.name, el('b', { text: pct.toFixed(1) + ' %' })]));
    });
    box.appendChild(svg); box.appendChild(center);
  }

  /* ---------- Pedidos y ciudades ---------- */
  function renderOrders() {
    var body = document.getElementById('orders'); body.textContent = '';
    var list = ORDERS.filter(function (o) { return (state.status === 'all' || o.st === state.status) && (state.channel === 'all' || o.ch.id === state.channel); });
    if (!list.length) { body.appendChild(el('tr', null, [el('td', { colspan: '5', class: 'mono', text: 'Sin pedidos con este filtro.' })])); return; }
    list.slice(0, 8).forEach(function (o) {
      body.appendChild(el('tr', null, [el('td', { class: 'mono', text: o.id }), el('td', { text: o.name }), el('td', { text: o.ch.name }), el('td', { text: money(o.total) }), el('td', null, [el('span', { class: 'st st--' + o.st, text: o.st })])]));
    });
  }
  function renderCities() {
    var box = document.getElementById('cities'); box.textContent = '';
    var rc = rng(state.range + state.channel.length * 13);
    var total = slice(0).reduce(function (a, x) { return a + val(x); }, 0);
    var shares = CITIES.map(function (c, i) { return { c: c, v: (0.34 / (i + 1)) * (0.8 + rc() * 0.4) }; });
    var s = shares.reduce(function (a, x) { return a + x.v; }, 0);
    var max = shares[0].v / s;
    shares.forEach(function (x) {
      var p = x.v / s;
      box.appendChild(el('div', { class: 'city' }, [el('span', { text: x.c }), el('div', { class: 'track' }, [el('i', { style: 'width:' + (p / max * 100).toFixed(1) + '%' })]), el('b', { text: money(total * p, true) })]));
    });
  }

  /* ---------- Automatizaciones ---------- */
  var AUTOS = [
    { ico: '✉', name: 'Reporte diario de ventas', desc: 'Envía un resumen por correo a las 7:00 a. m.', on: true },
    { ico: '⚠', name: 'Alerta de stock bajo', desc: 'Notifica por WhatsApp al bajar del mínimo.', on: true },
    { ico: '⇄', name: 'Sincronizar pedidos', desc: 'Copia los pedidos nuevos a una hoja de cálculo.', on: false },
    { ico: '🧾', name: 'Facturación automática', desc: 'Genera la factura cuando un pedido se paga.', on: false }
  ];
  var consoleList = document.getElementById('console');
  function logLine(cls, text) {
    var now = new Date();
    consoleList.insertBefore(el('li', { class: cls }, [el('time', { text: now.toLocaleTimeString('es-CO', { hour12: false }) }), text]), consoleList.firstChild);
  }
  function renderAutos() {
    var box = document.getElementById('autos');
    AUTOS.forEach(function (a, i) {
      var input = el('input', { type: 'checkbox', 'aria-label': 'Activar ' + a.name });
      input.checked = a.on;
      input.addEventListener('change', function () { a.on = input.checked; logLine('ok', a.name + (a.on ? ' activada' : ' desactivada')); });
      box.appendChild(el('div', { class: 'auto' }, [
        el('span', { class: 'auto__ico', 'aria-hidden': 'true', text: a.ico }),
        el('div', { class: 'auto__txt' }, [el('b', { text: a.name }), el('span', { text: a.desc })]),
        el('button', { class: 'run', type: 'button', text: 'Ejecutar', on: { click: function (e) {
          var b = e.currentTarget; b.disabled = true; b.textContent = '…';
          logLine('run', 'Ejecutando «' + a.name + '»');
          setTimeout(function () {
            var n = [ORDERS.length, 3, 12, 5][i];
            logLine('ok', ['Reporte enviado a 2 destinatarios', 'Revisados 48 productos: ' + n + ' alertas enviadas', n + ' pedidos sincronizados', n + ' facturas generadas'][i] + ' (simulado)');
            b.disabled = false; b.textContent = 'Ejecutar';
          }, 900);
        } } }),
        el('label', { class: 'switch' }, [input, el('span')])
      ]));
    });
    logLine('ok', 'Panel iniciado · 2 automatizaciones activas');
  }

  /* ---------- Controles ---------- */
  function setChannel(c) { state.channel = c; (document.getElementById('channel') as HTMLSelectElement).value = c; renderAll(); }
  document.querySelectorAll('[data-range]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.range = parseInt(b.getAttribute('data-range'), 10);
      document.querySelectorAll('[data-range]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      renderAll();
    });
  });
  document.getElementById('channel').addEventListener('change', function (e) {
    var v = (e.target as HTMLSelectElement).value; setChannel(v === 'all' || CHANNELS.some(function (c) { return c.id === v; }) ? v : 'all');
  });
  document.getElementById('status-filter').addEventListener('change', function (e) { state.status = (e.target as HTMLSelectElement).value; renderOrders(); });
  document.getElementById('export').addEventListener('click', function () {
    var rows = [['Fecha', 'Ventas', 'Pedidos']].concat(slice(0).map(function (x) { return [x.date.toISOString().slice(0, 10), Math.round(val(x)), x.orders]; }));
    var blob = new Blob([rows.map(function (r) { return r.join(','); }).join('\n')], { type: 'text/csv' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'ventas-' + state.range + 'd-demo.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    logLine('ok', 'Exportado CSV de ' + state.range + ' días');
  });
  document.querySelectorAll('.rail a').forEach(function (a) {
    a.addEventListener('click', function () { document.querySelectorAll('.rail a').forEach(function (x) { x.classList.toggle('is-active', x === a); }); });
  });

  function renderAll() { renderKpis(); renderLine(); renderDonut(); renderOrders(); renderCities(); }
  renderAll();
  renderAutos();
  window.addEventListener('resize', function () { tip.hidden = true; });
})();
