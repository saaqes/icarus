/* Demo Sistema Administrativo — Bodega+ (datos de prueba en el navegador) */
(function () {
  'use strict';
  var I = window.ICARUS;
  var el = I.el;
  var KEY = 'icarus-demo-bodega-v1';

  /* ---------- Base de datos de prueba ---------- */
  function seed() {
    return {
      seq: 200,
      products: [
        { id: 101, sku: 'HER-001', name: 'Taladro percutor 650W', cat: 'Herramientas', stock: 14, min: 5, price: 289000 },
        { id: 102, sku: 'HER-002', name: 'Pulidora 4½" 900W', cat: 'Herramientas', stock: 4, min: 5, price: 239000 },
        { id: 103, sku: 'HER-003', name: 'Juego de destornilladores x12', cat: 'Herramientas', stock: 32, min: 10, price: 45000 },
        { id: 104, sku: 'PIN-010', name: 'Pintura vinilo blanca 1 gal', cat: 'Pinturas', stock: 58, min: 20, price: 62000 },
        { id: 105, sku: 'PIN-011', name: 'Esmalte negro brillante 1/4', cat: 'Pinturas', stock: 0, min: 8, price: 28000 },
        { id: 106, sku: 'PIN-012', name: 'Rodillo felpa 9"', cat: 'Pinturas', stock: 21, min: 10, price: 16500 },
        { id: 107, sku: 'ELE-020', name: 'Cable eléctrico N.º 12 (m)', cat: 'Eléctricos', stock: 420, min: 100, price: 3200 },
        { id: 108, sku: 'ELE-021', name: 'Toma doble con polo a tierra', cat: 'Eléctricos', stock: 9, min: 15, price: 8900 },
        { id: 109, sku: 'ELE-022', name: 'Bombillo LED 12W', cat: 'Eléctricos', stock: 140, min: 40, price: 7500 },
        { id: 110, sku: 'PLO-030', name: 'Tubo PVC ½" x 6 m', cat: 'Plomería', stock: 75, min: 25, price: 14800 },
        { id: 111, sku: 'PLO-031', name: 'Llave de paso ½"', cat: 'Plomería', stock: 18, min: 10, price: 23500 },
        { id: 112, sku: 'CON-040', name: 'Cemento gris 50 kg', cat: 'Construcción', stock: 62, min: 30, price: 34000 }
      ],
      clients: [
        { id: 201, name: 'Construcciones Andinas SAS', nit: '900.123.456-7', city: 'Armenia', phone: '300 000 0001', purchases: 18 },
        { id: 202, name: 'María Fernanda López', nit: 'CC 1.094.000.001', city: 'Calarcá', phone: '300 000 0002', purchases: 4 },
        { id: 203, name: 'Obras y Acabados del Eje', nit: '901.555.222-1', city: 'Pereira', phone: '300 000 0003', purchases: 11 },
        { id: 204, name: 'Jorge Iván Restrepo', nit: 'CC 7.540.000.002', city: 'Montenegro', phone: '300 000 0004', purchases: 2 }
      ],
      users: [
        { id: 1, name: 'Administrador Demo', email: 'admin@bodega.demo', role: 'admin', active: true },
        { id: 2, name: 'Vendedor Demo', email: 'ventas@bodega.demo', role: 'vendedor', active: true },
        { id: 3, name: 'Bodeguero Demo', email: 'bodega@bodega.demo', role: 'vendedor', active: false }
      ],
      moves: [
        { t: Date.now() - 3600e3 * 2, type: 'in', text: 'Entrada de 20 × Pintura vinilo blanca 1 gal', by: 'Administrador Demo' },
        { t: Date.now() - 3600e3 * 5, type: 'out', text: 'Salida de 3 × Taladro percutor 650W', by: 'Vendedor Demo' },
        { t: Date.now() - 3600e3 * 26, type: 'new', text: 'Nuevo producto: Bombillo LED 12W', by: 'Administrador Demo' }
      ]
    };
  }
  var db = I.store.get(KEY, null);
  if (!db || !Array.isArray(db.products)) db = seed();
  function persist() { I.store.set(KEY, db); }

  var session = null;
  var view = 'resumen';
  var invState = { q: '', cat: '', sort: 'name', dir: 'asc' };
  var content = document.getElementById('content');

  function money(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }
  function status(p) { return p.stock <= 0 ? 'out' : p.stock < p.min ? 'low' : 'ok'; }
  function statusPill(p) {
    var s = status(p);
    return el('span', { class: 'pill pill--' + s, text: s === 'out' ? 'Agotado' : s === 'low' ? 'Stock bajo' : 'Disponible' });
  }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    return 'hace ' + Math.round(h / 24) + ' d';
  }
  function log(type, text) { db.moves.unshift({ t: Date.now(), type: type, text: text, by: session.name }); db.moves = db.moves.slice(0, 60); }
  var tt;
  function toast(t) { var n = document.getElementById('toast'); n.textContent = t; n.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { n.classList.remove('on'); }, 2600); }
  function isAdmin() { return session && session.role === 'admin'; }

  /* ---------- Sesión ---------- */
  document.querySelectorAll('[data-role]').forEach(function (b) {
    b.addEventListener('click', function () {
      var role = b.getAttribute('data-role') === 'admin' ? 'admin' : 'vendedor';
      session = { role: role, name: role === 'admin' ? 'Administrador Demo' : 'Vendedor Demo' };
      document.getElementById('user-name').textContent = session.name;
      document.getElementById('user-role').textContent = role === 'admin' ? 'Administrador' : 'Vendedor';
      document.getElementById('avatar').textContent = role === 'admin' ? 'A' : 'V';
      document.getElementById('login').hidden = true;
      document.getElementById('app').hidden = false;
      go('resumen');
    });
  });
  document.getElementById('logout').addEventListener('click', function () {
    session = null; document.getElementById('app').hidden = true; document.getElementById('login').hidden = false; closeSide();
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (!isAdmin()) { toast('Solo el administrador puede restablecer los datos'); return; }
    if (window.confirm('¿Restablecer todos los datos de prueba?')) { db = seed(); persist(); go(view); toast('Datos de prueba restablecidos'); }
  });

  /* ---------- Navegación ---------- */
  var side = document.getElementById('side');
  var menu = document.getElementById('menu');
  var scrim = null;
  function closeSide() { side.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); if (scrim) { scrim.remove(); scrim = null; } }
  menu.addEventListener('click', function () {
    if (side.classList.contains('is-open')) { closeSide(); return; }
    side.classList.add('is-open'); menu.setAttribute('aria-expanded', 'true');
    scrim = el('div', { class: 'scrim', on: { click: closeSide } }); document.body.appendChild(scrim);
  });
  side.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-view')); closeSide(); }); });

  var TITLES = { resumen: 'Resumen', inventario: 'Inventario', movimientos: 'Movimientos', clientes: 'Clientes', usuarios: 'Usuarios' };
  function go(v) {
    view = TITLES[v] ? v : 'resumen';
    side.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-view') === view); });
    document.getElementById('view-title').textContent = TITLES[view];
    content.textContent = '';
    ({ resumen: viewSummary, inventario: viewInventory, movimientos: viewMoves, clientes: viewClients, usuarios: viewUsers })[view]();
  }

  /* ---------- Resumen ---------- */
  function viewSummary() {
    var low = db.products.filter(function (p) { return status(p) !== 'ok'; });
    var value = db.products.reduce(function (a, p) { return a + p.stock * p.price; }, 0);
    content.appendChild(el('div', { class: 'kpis' }, [
      kpi('Productos registrados', db.products.length, el('em', { class: 'up', text: '▲ catálogo activo' })),
      kpi('Valor del inventario', money(value), el('em', { class: 'muted', text: 'a precio de venta' })),
      kpi('Alertas de stock', low.length, el('em', { class: low.length ? 'warn' : 'up', text: low.length ? 'requieren reposición' : 'todo en orden' })),
      kpi('Clientes', db.clients.length, el('em', { class: 'up', text: '▲ base de clientes' }))
    ]));
    var cats = {};
    db.products.forEach(function (p) { cats[p.cat] = (cats[p.cat] || 0) + p.stock * p.price; });
    var max = Math.max.apply(null, Object.keys(cats).map(function (k) { return cats[k]; }));
    content.appendChild(el('div', { class: 'cols' }, [
      el('section', { class: 'panel' }, [
        el('h2', null, ['Valor por categoría']),
        el('div', { class: 'bars' }, Object.keys(cats).map(function (k) {
          return el('div', { class: 'bar-row' }, [el('span', { text: k }), el('div', { class: 'bar-track' }, [el('i', { style: 'width:' + Math.max(4, cats[k] / max * 100) + '%' })]), el('span', { class: 'mono', text: Math.round(cats[k] / 1e6 * 10) / 10 + ' M' })]);
        }))
      ]),
      el('section', { class: 'panel' }, [
        el('h2', null, ['Productos por reponer', el('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: 'Ver inventario', on: { click: function () { go('inventario'); } } })]),
        low.length ? el('ul', { class: 'log' }, low.map(function (p) {
          return el('li', null, [el('span', { class: 'dot dot--' + (status(p) === 'out' ? 'del' : 'out') }), el('div', { style: 'flex:1' }, [p.name, el('br'), el('span', { class: 'mono', text: p.stock + ' / mín. ' + p.min })]), statusPill(p)]);
        })) : el('p', { class: 'muted', text: 'Sin alertas.' })
      ])
    ]));
    content.appendChild(el('section', { class: 'panel' }, [el('h2', null, ['Actividad reciente']), moveList(db.moves.slice(0, 6))]));
  }
  function kpi(label, value, extra) { return el('div', { class: 'kpi' }, [el('small', { text: label }), el('b', { text: String(value) }), extra]); }
  function moveList(items) {
    if (!items.length) return el('p', { class: 'muted', text: 'Sin movimientos todavía.' });
    return el('ul', { class: 'log' }, items.map(function (m) {
      return el('li', null, [el('span', { class: 'dot dot--' + m.type }), el('div', { style: 'flex:1' }, [m.text, el('br'), el('span', { class: 'mono', text: m.by })]), el('time', { text: ago(m.t) })]);
    }));
  }

  /* ---------- Inventario ---------- */
  function viewInventory() {
    var cats = db.products.map(function (p) { return p.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }).sort();
    var search = el('input', { type: 'search', placeholder: 'Buscar por nombre o SKU', value: invState.q, maxlength: '40', 'aria-label': 'Buscar productos' });
    var catSel = el('select', { 'aria-label': 'Filtrar por categoría' }, [el('option', { value: '', text: 'Todas las categorías' })].concat(cats.map(function (c) { return el('option', { value: c, text: c }); })));
    catSel.value = invState.cat;
    var tableWrap = el('div', { class: 'table-wrap' });
    content.appendChild(el('div', { class: 'toolbar' }, [
      search, catSel,
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Exportar CSV', on: { click: exportCSV } }),
      el('button', { class: 'btn btn--primary', type: 'button', text: '+ Nuevo producto', on: { click: function () { productForm(null); } } })
    ]));
    content.appendChild(tableWrap);
    search.addEventListener('input', function () { invState.q = I.clean(search.value, 40).toLowerCase(); draw(); });
    catSel.addEventListener('change', function () { invState.cat = catSel.value; draw(); });

    var COLS = [['sku', 'SKU'], ['name', 'Producto'], ['cat', 'Categoría'], ['stock', 'Stock'], ['price', 'Precio'], ['estado', 'Estado'], ['acc', 'Acciones']];
    function draw() {
      var rows = db.products.filter(function (p) {
        return (!invState.cat || p.cat === invState.cat) && (!invState.q || (p.name + ' ' + p.sku).toLowerCase().indexOf(invState.q) !== -1);
      }).sort(function (a, b) {
        var k = invState.sort, x = a[k], y = b[k];
        var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
        return invState.dir === 'asc' ? r : -r;
      });
      tableWrap.textContent = '';
      var head = el('tr', null, COLS.map(function (c) {
        if (c[0] === 'estado' || c[0] === 'acc') return el('th', { scope: 'col', text: c[1] });
        return el('th', { scope: 'col' }, [el('button', { type: 'button', text: c[1], 'data-dir': invState.sort === c[0] ? invState.dir : null, on: { click: function () {
          if (invState.sort === c[0]) invState.dir = invState.dir === 'asc' ? 'desc' : 'asc'; else { invState.sort = c[0]; invState.dir = 'asc'; }
          draw();
        } } })]);
      }));
      var body = el('tbody', null, rows.length ? rows.map(function (p) {
        return el('tr', null, [
          el('td', { class: 'mono', text: p.sku }), el('td', { text: p.name }), el('td', { text: p.cat }),
          el('td', { text: p.stock + ' (mín. ' + p.min + ')' }), el('td', { text: money(p.price) }), el('td', null, [statusPill(p)]),
          el('td', null, [el('div', { class: 'actions' }, [
            el('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '⇅ Mover', title: 'Registrar entrada o salida', on: { click: function () { moveForm(p); } } }),
            el('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: 'Editar', on: { click: function () { productForm(p); } } }),
            el('button', { class: 'btn btn--danger btn--sm', type: 'button', text: 'Eliminar', disabled: !isAdmin(), title: isAdmin() ? null : 'Solo administradores', on: { click: function () {
              if (window.confirm('¿Eliminar «' + p.name + '»?')) {
                db.products.splice(db.products.indexOf(p), 1); log('del', 'Producto eliminado: ' + p.name); persist(); draw(); toast('Producto eliminado');
              }
            } } })
          ])])
        ]);
      }) : [el('tr', null, [el('td', { colspan: '7', class: 'empty', text: 'No hay productos que coincidan.' })])]);
      tableWrap.appendChild(el('table', null, [el('thead', null, [head]), body]));
    }
    draw();
  }

  function exportCSV() {
    var rows = [['SKU', 'Producto', 'Categoria', 'Stock', 'Minimo', 'Precio']].concat(db.products.map(function (p) { return [p.sku, p.name, p.cat, p.stock, p.min, p.price]; }));
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'inventario-bodega-demo.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    toast('CSV exportado');
  }

  /* ---------- Formularios en modal ---------- */
  var modal = document.getElementById('modal');
  var form = document.getElementById('modal-form');
  var onSubmit = null;
  var lastFocus = null;
  function openModal(title, fields, okText, submit) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-ok').textContent = okText || 'Guardar';
    document.getElementById('modal-err').textContent = '';
    var body = document.getElementById('modal-body'); body.textContent = '';
    fields.forEach(function (f) { body.appendChild(f); });
    onSubmit = submit;
    lastFocus = document.activeElement;
    modal.hidden = false;
    var first = body.querySelector('input, select'); if (first) (first as HTMLElement).focus();
  }
  function closeModal() { modal.hidden = true; onSubmit = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  modal.addEventListener('click', function (e) { if (e.target === modal || (e.target as HTMLElement).closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!onSubmit) return;
    var err = onSubmit(new FormData(form as HTMLFormElement));
    if (err) document.getElementById('modal-err').textContent = err; else closeModal();
  });
  function field(label, name, type, value, opts?) {
    opts = opts || {};
    var input;
    if (type === 'select') {
      input = el('select', { name: name }, opts.options.map(function (o) { return el('option', { value: o, text: o }); }));
      input.value = value || opts.options[0];
    } else {
      input = el('input', { name: name, type: type, value: value == null ? '' : String(value), maxlength: opts.max || '60', min: type === 'number' ? '0' : null, step: type === 'number' ? '1' : null, inputmode: type === 'number' ? 'numeric' : null });
    }
    return el('label', { class: 'field' + (opts.full ? ' full' : '') }, [label, input]);
  }

  function productForm(p) {
    var cats = ['Herramientas', 'Pinturas', 'Eléctricos', 'Plomería', 'Construcción'];
    openModal(p ? 'Editar producto' : 'Nuevo producto', [
      field('Nombre del producto', 'name', 'text', p && p.name, { full: true, max: 70 }),
      field('SKU', 'sku', 'text', p ? p.sku : 'NEW-' + (db.seq + 1), { max: 12 }),
      field('Categoría', 'cat', 'select', p && p.cat, { options: cats }),
      field('Stock', 'stock', 'number', p ? p.stock : 0),
      field('Stock mínimo', 'min', 'number', p ? p.min : 5),
      field('Precio de venta (COP)', 'price', 'number', p ? p.price : '', { full: true })
    ], p ? 'Guardar cambios' : 'Crear producto', function (fd) {
      var name = I.clean(fd.get('name'), 70), sku = I.clean(fd.get('sku'), 12).toUpperCase();
      var stock = parseInt(fd.get('stock'), 10), min = parseInt(fd.get('min'), 10), price = parseInt(fd.get('price'), 10);
      if (name.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
      if (!/^[A-Z0-9-]{3,12}$/.test(sku)) return 'El SKU solo admite letras, números y guiones (3 a 12).';
      if (db.products.some(function (x) { return x.sku === sku && x !== p; })) return 'Ya existe un producto con ese SKU.';
      if (!(stock >= 0) || !(min >= 0) || !(price > 0)) return 'Revisa stock, mínimo y precio (números válidos).';
      var cat = cats.indexOf(fd.get('cat')) !== -1 ? fd.get('cat') : cats[0];
      if (p) { Object.assign(p, { name: name, sku: sku, cat: cat, stock: stock, min: min, price: price }); log('new', 'Producto actualizado: ' + name); toast('Cambios guardados'); }
      else { db.seq++; db.products.push({ id: db.seq, name: name, sku: sku, cat: cat, stock: stock, min: min, price: price }); log('new', 'Nuevo producto: ' + name); toast('Producto creado'); }
      persist(); go('inventario');
      return null;
    });
  }

  function moveForm(p) {
    openModal('Movimiento · ' + p.name, [
      field('Tipo', 'type', 'select', 'Entrada', { options: ['Entrada', 'Salida'] }),
      field('Cantidad', 'qty', 'number', 1),
      el('p', { class: 'muted full', style: 'grid-column:1/-1;margin:0;font-size:13px', text: 'Stock actual: ' + p.stock + ' unidades.' })
    ], 'Registrar', function (fd) {
      var q = parseInt(fd.get('qty'), 10);
      var isIn = fd.get('type') === 'Entrada';
      if (!(q > 0) || q > 10000) return 'Escribe una cantidad válida.';
      if (!isIn && q > p.stock) return 'No hay suficiente stock para esa salida.';
      p.stock += isIn ? q : -q;
      log(isIn ? 'in' : 'out', (isIn ? 'Entrada' : 'Salida') + ' de ' + q + ' × ' + p.name);
      persist(); go('inventario'); toast('Movimiento registrado');
      return null;
    });
  }

  /* ---------- Movimientos ---------- */
  function viewMoves() {
    content.appendChild(el('section', { class: 'panel' }, [el('h2', null, ['Historial de movimientos', el('span', { class: 'mono', text: db.moves.length + ' registros' })]), moveList(db.moves)]));
  }

  /* ---------- Clientes ---------- */
  function viewClients() {
    content.appendChild(el('div', { class: 'toolbar' }, [el('span', { class: 'spacer' }), el('button', { class: 'btn btn--primary', type: 'button', text: '+ Nuevo cliente', on: { click: function () {
      openModal('Nuevo cliente', [
        field('Nombre o razón social', 'name', 'text', '', { full: true, max: 70 }),
        field('NIT / Cédula', 'nit', 'text', '', { max: 20 }),
        field('Ciudad', 'city', 'text', '', { max: 40 }),
        field('Teléfono', 'phone', 'text', '', { full: true, max: 20 })
      ], 'Crear cliente', function (fd) {
        var name = I.clean(fd.get('name'), 70);
        if (name.length < 3) return 'Escribe el nombre del cliente.';
        db.seq++;
        db.clients.push({ id: db.seq, name: name, nit: I.clean(fd.get('nit'), 20) || '—', city: I.clean(fd.get('city'), 40) || '—', phone: I.clean(fd.get('phone'), 20) || '—', purchases: 0 });
        log('new', 'Nuevo cliente: ' + name); persist(); go('clientes'); toast('Cliente creado');
        return null;
      });
    } } })]));
    content.appendChild(el('div', { class: 'table-wrap' }, [el('table', null, [
      el('thead', null, [el('tr', null, ['Cliente', 'Documento', 'Ciudad', 'Teléfono', 'Compras'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
      el('tbody', null, db.clients.map(function (c) {
        return el('tr', null, [el('td', { text: c.name }), el('td', { class: 'mono', text: c.nit }), el('td', { text: c.city }), el('td', { text: c.phone }), el('td', { text: String(c.purchases) })]);
      }))
    ])]));
  }

  /* ---------- Usuarios ---------- */
  function viewUsers() {
    if (!isAdmin()) {
      content.appendChild(el('section', { class: 'panel' }, [el('h2', null, ['Acceso restringido']), el('p', { class: 'muted', text: 'Solo los administradores pueden gestionar usuarios. Así funcionan los permisos por rol: cada usuario ve únicamente lo que le corresponde.' })]));
      return;
    }
    content.appendChild(el('div', { class: 'table-wrap' }, [el('table', null, [
      el('thead', null, [el('tr', null, ['Usuario', 'Correo', 'Rol', 'Estado', 'Acciones'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
      el('tbody', null, db.users.map(function (u) {
        return el('tr', null, [
          el('td', { text: u.name }), el('td', { class: 'mono', text: u.email }),
          el('td', null, [el('span', { class: 'pill ' + (u.role === 'admin' ? 'pill--admin' : 'pill--vend'), text: u.role === 'admin' ? 'Administrador' : 'Vendedor' })]),
          el('td', null, [el('span', { class: 'pill ' + (u.active ? 'pill--ok' : 'pill--out'), text: u.active ? 'Activo' : 'Inactivo' })]),
          el('td', null, [el('div', { class: 'actions' }, [
            el('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: u.active ? 'Desactivar' : 'Activar', disabled: u.id === 1, on: { click: function () { u.active = !u.active; log('new', 'Usuario ' + (u.active ? 'activado' : 'desactivado') + ': ' + u.name); persist(); go('usuarios'); } } }),
            el('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: 'Cambiar rol', disabled: u.id === 1, on: { click: function () { u.role = u.role === 'admin' ? 'vendedor' : 'admin'; log('new', 'Rol actualizado: ' + u.name); persist(); go('usuarios'); } } })
          ])])
        ]);
      }))
    ])]));
    content.appendChild(el('p', { class: 'muted tiny', style: 'margin-top:14px', text: 'En la versión real, cada usuario inicia sesión con su correo y una contraseña cifrada en el servidor; los permisos se validan en el backend, no en el navegador.' }));
  }
})();
