/* Demo Tienda Virtual — NOVA Store (marca ficticia, datos de prueba) */
(function () {
  'use strict';
  var I = window.ICARUS;
  var el = I.el;
  var demo = window.ICARUS_DEMO && window.ICARUS_DEMO.demo;
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- Ilustraciones de producto (SVG) ---------- */
  var SHAPES = {
    camiseta: ['M30 18 L42 12 Q50 18 58 12 L70 18 L86 32 L76 42 L70 38 L70 88 L30 88 L30 38 L24 42 L14 32 Z'],
    buzo: ['M32 16 L42 12 Q50 22 58 12 L68 16 L84 34 L86 78 L76 80 L72 46 L72 90 L28 90 L28 46 L24 80 L14 78 L16 34 Z', 'M42 12 Q50 34 58 12'],
    gorra: ['M18 60 Q18 30 50 28 Q82 30 82 60 Z', 'M14 60 L92 60 Q92 70 70 68 L14 66 Z'],
    bolso: ['M22 36 L78 36 L84 90 L16 90 Z', 'M36 36 Q36 14 50 14 Q64 14 64 36'],
    pantalon: ['M30 10 L70 10 L76 90 L56 90 L50 40 L44 90 L24 90 Z'],
    tenis: ['M10 62 Q12 44 30 44 L44 46 Q56 30 70 40 L88 54 Q92 62 88 70 L12 70 Z', 'M10 70 L90 70 L90 76 L10 76 Z']
  };
  function art(type, color) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    (SHAPES[type] || SHAPES.camiseta).forEach(function (d, i) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', i === 0 ? color : (type === 'tenis' ? '#fff' : 'none'));
      p.setAttribute('stroke', '#111');
      p.setAttribute('stroke-width', '2.4');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    });
    return svg;
  }

  /* ---------- Catálogo de prueba ---------- */
  var CATS = [{ id: 'all', name: 'Todo' }, { id: 'camisetas', name: 'Camisetas' }, { id: 'buzos', name: 'Buzos' }, { id: 'pantalones', name: 'Pantalones' }, { id: 'accesorios', name: 'Accesorios' }, { id: 'calzado', name: 'Calzado' }];
  var P = [
    { id: 1, name: 'Camiseta Oversize Eclipse', cat: 'camisetas', type: 'camiseta', color: '#1d1d1f', price: 89000, old: 109000, badge: 'Top', isNew: false, sizes: ['S', 'M', 'L', 'XL'] },
    { id: 2, name: 'Camiseta Boxy Lima', cat: 'camisetas', type: 'camiseta', color: '#d4ff3a', price: 79000, badge: 'Nuevo', isNew: true, sizes: ['S', 'M', 'L'] },
    { id: 3, name: 'Camiseta Arena Básica', cat: 'camisetas', type: 'camiseta', color: '#e3d6bf', price: 59000, isNew: false, sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    { id: 4, name: 'Buzo Capucha Niebla', cat: 'buzos', type: 'buzo', color: '#9aa3ad', price: 159000, old: 189000, badge: '-15%', isNew: false, sizes: ['S', 'M', 'L', 'XL'] },
    { id: 5, name: 'Buzo Heavy Carbón', cat: 'buzos', type: 'buzo', color: '#2b2b2e', price: 179000, isNew: true, badge: 'Nuevo', sizes: ['M', 'L', 'XL'] },
    { id: 6, name: 'Buzo Cereza', cat: 'buzos', type: 'buzo', color: '#a3242a', price: 169000, isNew: false, sizes: ['S', 'M', 'L'] },
    { id: 7, name: 'Pantalón Cargo Oliva', cat: 'pantalones', type: 'pantalon', color: '#5d6b3c', price: 149000, isNew: false, sizes: ['28', '30', '32', '34'] },
    { id: 8, name: 'Jogger Grafito', cat: 'pantalones', type: 'pantalon', color: '#45474d', price: 129000, isNew: true, badge: 'Nuevo', sizes: ['S', 'M', 'L'] },
    { id: 9, name: 'Gorra Snapback NOVA', cat: 'accesorios', type: 'gorra', color: '#111', price: 69000, isNew: false, sizes: ['Única'] },
    { id: 10, name: 'Tote Bag Lienzo', cat: 'accesorios', type: 'bolso', color: '#efe6d2', price: 49000, isNew: false, sizes: ['Única'] },
    { id: 11, name: 'Tenis Low Blanco', cat: 'calzado', type: 'tenis', color: '#f4f4f4', price: 239000, old: 279000, badge: 'Top', isNew: false, sizes: ['37', '38', '39', '40', '41', '42'] },
    { id: 12, name: 'Tenis Runner Lima', cat: 'calzado', type: 'tenis', color: '#d4ff3a', price: 259000, isNew: true, badge: 'Nuevo', sizes: ['38', '39', '40', '41', '42', '43'] }
  ];
  var DESC = {
    camisetas: 'Algodón peinado 100 % de 220 g, costuras reforzadas y estampado en serigrafía.',
    buzos: 'Felpa perchada de 380 g, capucha doble y bolsillo canguro. Abriga sin pesar.',
    pantalones: 'Tela resistente con elastano, pretina ajustable y bolsillos funcionales.',
    accesorios: 'Accesorio de edición limitada para completar tu outfit.',
    calzado: 'Suela de caucho vulcanizado, plantilla acolchada y ajuste cómodo todo el día.'
  };
  function byId(id) { return P.filter(function (p) { return p.id === id; })[0]; }
  function money(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }
  function catName(id) { return (CATS.filter(function (c) { return c.id === id; })[0] || {}).name; }

  /* ---------- Toast ---------- */
  var toastT;
  function toast(t) {
    var n = document.getElementById('toast');
    n.textContent = t; n.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { n.classList.remove('on'); }, 2400);
  }

  /* ---------- Catálogo ---------- */
  var state = { cat: 'all', q: '', sort: 'dest' };
  var grid = document.getElementById('grid');
  document.getElementById('hero-item').appendChild(art('buzo', '#111'));

  var tabs = document.getElementById('tabs');
  CATS.forEach(function (c) {
    tabs.appendChild(el('button', { type: 'button', 'aria-pressed': c.id === 'all' ? 'true' : 'false', text: c.name, on: { click: function (this: HTMLElement) {
      state.cat = c.id;
      tabs.querySelectorAll('button').forEach(function (this: HTMLElement, b: Element) { b.setAttribute('aria-pressed', b === this ? 'true' : 'false'); }, this);
      render();
    } } }));
  });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = (e.target as HTMLSelectElement).value; render(); });
  var qT;
  document.getElementById('q').addEventListener('input', function (e) {
    clearTimeout(qT);
    qT = setTimeout(function () { state.q = I.clean((e.target as HTMLInputElement).value, 40).toLowerCase(); render(); }, 120);
  });

  function render() {
    var list = P.filter(function (p) {
      return (state.cat === 'all' || p.cat === state.cat) && (!state.q || p.name.toLowerCase().indexOf(state.q) !== -1);
    });
    if (state.sort === 'asc') list.sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'desc') list.sort(function (a, b) { return b.price - a.price; });
    if (state.sort === 'new') list.sort(function (a, b) { return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0); });
    grid.textContent = '';
    document.getElementById('count').textContent = list.length + (list.length === 1 ? ' producto' : ' productos');
    if (!list.length) { grid.appendChild(el('p', { class: 'empty', text: 'No hay productos con esa búsqueda.' })); return; }
    list.forEach(function (p) {
      grid.appendChild(el('article', { class: 'card' }, [
        el('button', { class: 'card__art', type: 'button', style: 'background:' + p.color + '1f', 'aria-label': 'Ver ' + p.name, on: { click: function () { openProduct(p.id); } } }, [
          p.badge ? el('span', { class: 'badge', text: p.badge }) : null,
          art(p.type, p.color)
        ]),
        el('div', { class: 'card__body' }, [
          el('span', { class: 'card__cat', text: catName(p.cat) }),
          el('h3', { text: p.name }),
          el('div', { class: 'card__price' }, [money(p.price), p.old ? el('s', { text: money(p.old) }) : null])
        ]),
        el('button', { class: 'card__add', type: 'button', text: 'Agregar', on: { click: function () {
          if (p.sizes.length === 1) { addToCart(p.id, p.sizes[0], 1); } else { openProduct(p.id); }
        } } })
      ]));
    });
  }

  /* ---------- Modales (foco y cierre) ---------- */
  var lastFocus;
  function openOverlay(ov) { lastFocus = document.activeElement; ov.hidden = false; document.body.style.overflow = 'hidden'; var f = ov.querySelector('[data-close]'); if (f) f.focus(); }
  function closeOverlay(ov) { ov.hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  document.querySelectorAll('.overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) { if (e.target === ov || (e.target as HTMLElement).closest('[data-close]')) closeOverlay(ov); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.overlay:not([hidden])').forEach(closeOverlay);
  });

  /* ---------- Ficha de producto ---------- */
  var pm = document.getElementById('product-modal');
  var cur = { id: null, size: null, qty: 1 };
  function openProduct(id) {
    var p = byId(id);
    cur = { id: id, size: null, qty: 1 };
    var a = document.getElementById('pm-art'); a.textContent = ''; a.style.background = p.color + '1f'; a.appendChild(art(p.type, p.color));
    document.getElementById('pm-cat').textContent = catName(p.cat);
    document.getElementById('pm-title').textContent = p.name;
    document.getElementById('pm-price').textContent = money(p.price) + (p.old ? '  (antes ' + money(p.old) + ')' : '');
    document.getElementById('pm-desc').textContent = DESC[p.cat];
    document.getElementById('pm-qty').textContent = '1';
    var sz = document.getElementById('pm-sizes'); sz.textContent = '';
    p.sizes.forEach(function (s) {
      sz.appendChild(el('button', { type: 'button', 'aria-pressed': 'false', text: s, on: { click: function () {
        cur.size = s; sz.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === s ? 'true' : 'false'); });
      } } }));
    });
    if (p.sizes.length === 1) { cur.size = p.sizes[0]; (sz.firstChild as HTMLElement).setAttribute('aria-pressed', 'true'); }
    openOverlay(pm);
  }
  document.getElementById('pm-minus').addEventListener('click', function () { cur.qty = Math.max(1, cur.qty - 1); document.getElementById('pm-qty').textContent = String(cur.qty); });
  document.getElementById('pm-plus').addEventListener('click', function () { cur.qty = Math.min(10, cur.qty + 1); document.getElementById('pm-qty').textContent = String(cur.qty); });
  document.getElementById('pm-add').addEventListener('click', function () {
    if (!cur.size) { toast('Elige una talla'); return; }
    addToCart(cur.id, cur.size, cur.qty);
    closeOverlay(pm);
  });

  /* ---------- Carrito (persistente en el navegador) ---------- */
  var KEY = 'icarus-demo-nova-cart';
  var cart = I.store.get(KEY, []).filter(function (l) { return byId(l.id) && l.qty > 0 && l.qty <= 10; });
  var coupon = false;
  var step = 'cart';
  function save() { I.store.set(KEY, cart); updateCount(); }
  function updateCount() {
    var n = cart.reduce(function (a, l) { return a + l.qty; }, 0);
    var c = document.getElementById('cart-count');
    c.textContent = n; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
  }
  function addToCart(id, size, qty) {
    var line = cart.filter(function (l) { return l.id === id && l.size === size; })[0];
    if (line) line.qty = Math.min(10, line.qty + qty); else cart.push({ id: id, size: size, qty: qty });
    save();
    toast('Agregado: ' + byId(id).name + ' · ' + size);
  }
  function totals() {
    var sub = cart.reduce(function (a, l) { return a + byId(l.id).price * l.qty; }, 0);
    var disc = coupon ? sub * 0.1 : 0;
    var ship = sub === 0 || sub - disc >= 200000 ? 0 : 12000;
    return { sub: sub, disc: disc, ship: ship, total: sub - disc + ship };
  }

  var cartOv = document.getElementById('cart-overlay');
  var body = document.getElementById('cart-body');
  var foot = document.getElementById('cart-foot');
  document.getElementById('open-cart').addEventListener('click', function () { step = 'cart'; renderCart(); openOverlay(cartOv); });

  function qtyCtrl(l) {
    return el('div', { class: 'qty' }, [
      el('button', { type: 'button', 'aria-label': 'Menos', text: '−', on: { click: function () { l.qty--; if (l.qty < 1) cart.splice(cart.indexOf(l), 1); save(); renderCart(); } } }),
      el('output', { text: String(l.qty) }),
      el('button', { type: 'button', 'aria-label': 'Más', text: '+', on: { click: function () { l.qty = Math.min(10, l.qty + 1); save(); renderCart(); } } })
    ]);
  }

  function renderCart() {
    body.textContent = ''; foot.textContent = '';
    if (step === 'done') return;
    if (!cart.length) {
      body.appendChild(el('div', { class: 'cart-empty' }, [el('p', { text: 'Tu carrito está vacío.' }), el('button', { class: 'btn', type: 'button', text: 'Seguir comprando', on: { click: function () { closeOverlay(cartOv); } } })]));
      return;
    }
    var t = totals();
    if (step === 'cart') {
      cart.forEach(function (l) {
        var p = byId(l.id);
        body.appendChild(el('div', { class: 'line' }, [
          el('div', { class: 'line__art', style: 'background:' + p.color + '1f' }, [art(p.type, p.color)]),
          el('div', null, [el('b', { text: p.name }), el('small', { text: 'Talla ' + l.size }), qtyCtrl(l),
            el('button', { class: 'line__rm', type: 'button', text: 'Quitar', on: { click: function () { cart.splice(cart.indexOf(l), 1); save(); renderCart(); } } })]),
          el('div', { class: 'line__price', text: money(p.price * l.qty) })
        ]));
      });
      var faltan = 200000 - (t.sub - t.disc);
      var couponInput = el('input', { type: 'text', placeholder: 'Cupón', maxlength: '12', 'aria-label': 'Código de cupón', value: coupon ? 'NOVA10' : '' });
      [
        el('p', { class: 'hint', text: faltan > 0 ? 'Te faltan ' + money(faltan) + ' para envío gratis' : '¡Tienes envío gratis!' }),
        el('div', { class: 'ship-bar' }, [el('i', { style: 'width:' + Math.min(100, (t.sub - t.disc) / 2000) + '%' })]),
        el('div', { class: 'coupon' }, [couponInput, el('button', { type: 'button', text: 'Aplicar', on: { click: function () {
          if (I.clean(couponInput.value, 12).toUpperCase() === 'NOVA10') { coupon = true; toast('Cupón aplicado: 10 % de descuento'); renderCart(); }
          else toast('Cupón no válido. Prueba con NOVA10');
        } } })]),
        sumRow('Subtotal', money(t.sub)),
        coupon ? sumRow('Descuento NOVA10', '−' + money(t.disc)) : null,
        sumRow('Envío', t.ship ? money(t.ship) : 'Gratis'),
        el('div', { class: 'sum sum--total' }, [el('span', { text: 'Total' }), el('span', { text: money(t.total) })]),
        el('button', { class: 'btn btn--full', type: 'button', text: 'Continuar con el pedido', on: { click: function () { step = 'checkout'; renderCart(); } } })
      ].forEach(function (n) { if (n) foot.appendChild(n); });
    } else if (step === 'checkout') {
      var f = el('form', { class: 'checkout', novalidate: true }, [
        el('label', null, ['Nombre completo', el('input', { name: 'n', type: 'text', maxlength: '60', autocomplete: 'name' })]),
        el('label', null, ['Ciudad', el('input', { name: 'c', type: 'text', maxlength: '40', autocomplete: 'address-level2' })]),
        el('label', null, ['Dirección', el('input', { name: 'd', type: 'text', maxlength: '80', autocomplete: 'street-address' })]),
        el('label', null, ['Método de pago', el('select', { name: 'm' }, ['Tarjeta de crédito', 'PSE', 'Contra entrega'].map(function (o) { return el('option', { text: o }); }))]),
        el('p', { class: 'err', role: 'alert' })
      ]);
      body.appendChild(el('button', { class: 'line__rm', type: 'button', text: '← Volver al carrito', on: { click: function () { step = 'cart'; renderCart(); } } }));
      body.appendChild(f);
      foot.appendChild(el('div', { class: 'sum sum--total' }, [el('span', { text: 'Total a pagar' }), el('span', { text: money(t.total) })]));
      foot.appendChild(el('button', { class: 'btn btn--full', type: 'button', text: 'Confirmar pedido', on: { click: function () {
        var n = I.clean(f.n.value, 60), c = I.clean(f.c.value, 40), d = I.clean(f.d.value, 80);
        if (n.length < 3 || c.length < 2 || d.length < 5) { f.querySelector('.err').textContent = 'Completa nombre, ciudad y dirección.'; return; }
        finish(n, c, f.m.value, t.total);
      } } }));
    }
  }
  function sumRow(a, b) { return el('div', { class: 'sum' }, [el('span', { text: a }), el('span', { text: b })]); }

  function finish(name, city, method, total) {
    step = 'done';
    var code = 'NV-' + Date.now().toString(36).slice(-6).toUpperCase();
    cart = []; coupon = false; save();
    body.textContent = ''; foot.textContent = '';
    body.appendChild(el('div', { class: 'done', role: 'status' }, [
      el('div', { class: 'done__check', 'aria-hidden': 'true', text: '✓' }),
      el('h3', { text: '¡Pedido confirmado!' }),
      el('p', null, ['Gracias, ' + name + '. Tu pedido ', el('code', { text: code }), ' por ' + money(total) + ' (' + method + ') va camino a ' + city + '.']),
      el('p', { text: 'Esto es una simulación: no se realizó ningún cobro. En una tienda real, aquí se procesa el pago y el pedido llega a tu panel y a tu WhatsApp.' }),
      el('button', { class: 'btn btn--full', type: 'button', text: 'Quiero una tienda así', style: 'margin-top:10px', on: { click: function () { if (demo) I.openWhatsApp(I.msg.demo(demo)); } } }),
      el('button', { class: 'btn btn--line btn--full', type: 'button', text: 'Seguir explorando', style: 'margin-top:8px', on: { click: function () { closeOverlay(cartOv); } } })
    ]));
  }

  render();
  updateCount();
})();
