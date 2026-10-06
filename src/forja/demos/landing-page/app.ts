/* Demo Landing Page — Café Altura (marca ficticia) */
(function () {
  'use strict';
  var I = window.ICARUS;
  var el = I.el;
  var reduce = I.reducedMotion;
  var demo = window.ICARUS_DEMO && window.ICARUS_DEMO.demo;

  /* Menú móvil */
  var burger = document.querySelector('.burger');
  var links = document.getElementById('lp-links');
  burger.addEventListener('click', function () {
    var open = !links.classList.contains('is-open');
    links.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }); });

  /* Modal reutilizable */
  var modal = document.getElementById('modal');
  var lastFocus = null;
  function openModal(title, text, withCta) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    var actions = modal.querySelector('.modal__actions');
    var old = actions.querySelector('.cta-icarus');
    if (old) old.remove();
    if (withCta && demo) {
      actions.appendChild(el('button', { class: 'btn btn--line cta-icarus', type: 'button', text: 'Quiero una página así', on: { click: function () { I.openWhatsApp(I.msg.demo(demo)); } } }));
    }
    lastFocus = document.activeElement;
    modal.hidden = false;
    (modal.querySelector('[data-close]') as HTMLElement).focus();
  }
  function closeModal() { modal.hidden = true; if (lastFocus) lastFocus.focus(); }
  modal.addEventListener('click', function (e) { if (e.target === modal || (e.target as HTMLElement).closest('[data-close], .modal__close')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* Contadores */
  function countUp(node) {
    var target = parseInt(node.getAttribute('data-count'), 10);
    var suffix = node.getAttribute('data-suffix') || '';
    if (reduce) { node.textContent = target.toLocaleString('es-CO') + suffix; return; }
    var t0 = performance.now();
    (function step(t) {
      var p = Math.min(1, (t - t0) / 1400);
      var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
      node.textContent = v.toLocaleString('es-CO') + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  document.querySelectorAll('[data-count]').forEach(countUp);

  /* Cafés */
  var COFFEES = [
    { name: 'Origen Cumbre', color: '#5a3a28', notes: ['Panela', 'Cacao', 'Nuez'], desc: 'Tueste medio, cuerpo redondo. Ideal para todos los días.', p250: 32000, p500: 58000 },
    { name: 'Lote Niebla', color: '#3e6b4f', notes: ['Frutos rojos', 'Floral', 'Miel'], desc: 'Proceso honey. Dulce, brillante y con acidez jugosa.', p250: 39000, p500: 72000 },
    { name: 'Noche Volcán', color: '#2a1e17', notes: ['Chocolate', 'Caramelo', 'Especias'], desc: 'Tueste oscuro, intenso. Perfecto para espresso.', p250: 34000, p500: 62000 }
  ];
  var size = '250';
  var grid = document.getElementById('coffee-grid');
  function money(n) { return '$' + n.toLocaleString('es-CO'); }
  function renderCoffees() {
    grid.textContent = '';
    COFFEES.forEach(function (c) {
      grid.appendChild(el('article', { class: 'coffee reveal is-in' }, [
        el('div', { class: 'bag', style: 'background:' + c.color + '22' }, [
          el('div', { class: 'bag__pack', style: 'background:' + c.color }, [el('b', { text: c.name }), el('small', { text: size + ' G · ALTURA' })])
        ]),
        el('h3', { text: c.name }),
        el('div', { class: 'notes' }, c.notes.map(function (n) { return el('span', { text: n }); })),
        el('p', { text: c.desc }),
        el('div', { class: 'coffee__foot' }, [
          el('span', { class: 'price', text: money(size === '250' ? c.p250 : c.p500) }),
          el('button', { class: 'btn btn--dark', type: 'button', text: 'Pedir', on: { click: function () {
            openModal('Pedido de ' + c.name + ' (' + size + ' g)',
              'En la página real, este botón abre el WhatsApp del negocio con el producto, la presentación y el precio ya escritos, para que el cliente solo tenga que enviarlo. Así funciona la integración con WhatsApp de una landing page.', true);
          } } })
        ])
      ]));
    });
  }
  document.querySelectorAll('.toggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      size = b.getAttribute('data-size');
      document.querySelectorAll('.toggle button').forEach(function (x) {
        var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderCoffees();
    });
  });
  renderCoffees();

  /* Slider de opiniones */
  var track = document.getElementById('slider-track');
  var slides = track.children.length;
  var dots = document.getElementById('dots');
  var idx = 0, timer;
  for (var i = 0; i < slides; i++) {
    (function (n) { dots.appendChild(el('button', { type: 'button', 'aria-label': 'Ir a la opinión ' + (n + 1), on: { click: function () { go(n); restart(); } } })); })(i);
  }
  function go(n) {
    idx = (n + slides) % slides;
    track.style.transform = 'translateX(' + (-100 * idx) + '%)';
    Array.prototype.forEach.call(dots.children, function (d, k) { d.setAttribute('aria-current', k === idx ? 'true' : 'false'); });
  }
  function restart() { clearInterval(timer); if (!reduce) timer = setInterval(function () { go(idx + 1); }, 6000); }
  document.getElementById('prev').addEventListener('click', function () { go(idx - 1); restart(); });
  document.getElementById('next').addEventListener('click', function () { go(idx + 1); restart(); });
  go(0); restart();

  /* Formulario */
  var form = document.getElementById('lp-form') as any;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nombre = I.clean(form.nombre.value, 60);
    var ciudad = I.clean(form.ciudad.value, 40);
    var err = document.getElementById('lp-error');
    if (nombre.length < 2 || ciudad.length < 2) { err.textContent = 'Escribe tu nombre y tu ciudad para poder responderte.'; return; }
    err.textContent = '';
    form.textContent = '';
    form.appendChild(el('div', { class: 'form__ok', role: 'status' }, [
      el('h3', { text: '¡Gracias, ' + nombre + '!' }),
      el('p', { text: 'Recibimos tu mensaje desde ' + ciudad + '. (Demostración: en la página real, este formulario llega al correo o al WhatsApp del negocio).' })
    ]));
  });

  /* Botón flotante */
  document.getElementById('wa-float').addEventListener('click', function () {
    openModal('Botón de WhatsApp', 'En la página real, este botón abre una conversación de WhatsApp con el negocio y un saludo ya escrito. Está presente en todas las landing pages de ICARUS.', true);
  });

  /* Revelado */
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } }); }, { threshold: .1 });
    document.querySelectorAll('.reveal').forEach(function (n) { io.observe(n); });
  } else document.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('is-in'); });
})();
