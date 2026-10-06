/* Demo Sistema de Reservas — Termales Vertiente (negocio ficticio) */
(function () {
  'use strict';
  var I = window.ICARUS;
  var el = I.el;
  var demo = window.ICARUS_DEMO && window.ICARUS_DEMO.demo;
  var KEY = 'icarus-demo-vertiente-v1';

  var PLANS = [
    { id: 'pasadia', ico: '♨', name: 'Pasadía termal', desc: '4 horas en piscinas termales y zona húmeda.', price: 65000, perPerson: true, slots: ['08:00', '10:00', '12:00', '14:00'] },
    { id: 'masaje', ico: '❀', name: 'Masaje relajante', desc: '60 minutos con aceites esenciales.', price: 120000, perPerson: true, slots: ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'] },
    { id: 'pareja', ico: '♡', name: 'Plan pareja', desc: 'Termales + masaje para dos + bebida.', price: 260000, perPerson: false, slots: ['10:00', '13:00', '16:00'] },
    { id: 'cabana', ico: '⌂', name: 'Noche en cabaña', desc: 'Cabaña con jacuzzi privado y desayuno.', price: 380000, perPerson: false, slots: ['15:00'] }
  ];
  function plan(id) { return PLANS.filter(function (p) { return p.id === id; })[0]; }

  var db = I.store.get(KEY, null);
  if (!db || !Array.isArray(db.mine)) db = { mine: [], blocks: [] };
  function save() { I.store.set(KEY, db); updateBadge(); }

  /* ---------- Fechas ---------- */
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parseKey(k) { var p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 60);
  function isClosed(d) { return d.getDay() === 1; }
  function longDate(d) { return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function money(n) { return '$' + n.toLocaleString('es-CO'); }

  /* Ocupación simulada estable: mismo resultado para la misma fecha y hora */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function slotState(dateKey, planId, time) {
    var k = dateKey + '|' + planId + '|' + time;
    if (db.mine.some(function (r) { return r.status === 'ok' && r.date === dateKey && r.plan === planId && r.time === time; })) return 'mine';
    if (db.blocks.indexOf(k) !== -1) return 'blocked';
    var d = parseKey(dateKey);
    if (d.getTime() === today.getTime()) {
      var now = new Date();
      if (parseInt(time, 10) <= now.getHours()) return 'busy';
    }
    return hash(k) < (d.getDay() === 6 || d.getDay() === 0 ? 0.55 : 0.3) ? 'busy' : 'free';
  }

  var tt;
  function toast(t) { var n = document.getElementById('toast'); n.textContent = t; n.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { n.classList.remove('on'); }, 2600); }

  /* ---------- Pestañas ---------- */
  var tabs = document.querySelectorAll('[role="tab"]');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) {
        var on = x === t; x.setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (t.id === 't-mias') renderMine();
      if (t.id === 't-agenda') renderAgenda();
    });
  });
  function updateBadge() { document.getElementById('mine-count').textContent = db.mine.filter(function (r) { return r.status === 'ok'; }).length; }

  /* ---------- Asistente de reserva ---------- */
  var bk: { step: number; plan: any; date: any; time: any; people: number; name: string; phone: string; code?: string } = { step: 0, plan: null, date: null, time: null, people: 2, name: '', phone: '' };
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var body = document.getElementById('step-body');

  function setStepper() {
    document.querySelectorAll('#stepper li').forEach(function (li, i) {
      li.classList.toggle('is-on', i === bk.step);
      li.classList.toggle('is-done', i < bk.step);
    });
  }
  function actions(backFn, nextLabel, nextFn, disabled?) {
    return el('div', { class: 'actions' }, [
      backFn ? el('button', { class: 'btn btn--ghost', type: 'button', text: '← Atrás', on: { click: backFn } }) : el('span'),
      nextFn ? el('button', { class: 'btn', type: 'button', text: nextLabel, disabled: !!disabled, on: { click: nextFn } }) : null
    ]);
  }
  function total() { var p = plan(bk.plan); return p ? (p.perPerson ? p.price * bk.people : p.price) : 0; }

  function render() {
    setStepper();
    body.textContent = '';
    [stepPlan, stepDate, stepData, stepDone][bk.step]();
  }

  function stepPlan() {
    body.appendChild(el('h2', { text: '¿Qué quieres reservar?' }));
    body.appendChild(el('p', { class: 'muted', text: 'Abrimos de martes a domingo. Los lunes cerramos por mantenimiento.' }));
    body.appendChild(el('div', { class: 'plans' }, PLANS.map(function (p) {
      return el('button', { class: 'plan', type: 'button', 'aria-pressed': bk.plan === p.id ? 'true' : 'false', on: { click: function () { bk.plan = p.id; bk.time = null; render(); } } }, [
        el('span', { class: 'plan__ico', 'aria-hidden': 'true', text: p.ico }),
        el('div', null, [el('b', { text: p.name }), el('span', { text: p.desc }), el('span', { class: 'price', text: money(p.price) + (p.perPerson ? ' / persona' : ' / reserva') })])
      ]);
    })));
    body.appendChild(actions(null, 'Elegir fecha →', function () { bk.step = 1; render(); }, !bk.plan));
  }

  function stepDate() {
    var p = plan(bk.plan);
    body.appendChild(el('h2', { text: p.name + ': fecha y hora' }));
    var cal = el('div');
    var slotsBox = el('div');
    body.appendChild(el('div', { class: 'date-grid' }, [cal, slotsBox]));

    function drawCal() {
      cal.textContent = '';
      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var prevDisabled = first <= new Date(today.getFullYear(), today.getMonth(), 1);
      var nextDisabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > maxDate;
      cal.appendChild(el('div', { class: 'cal__head' }, [
        el('button', { type: 'button', 'aria-label': 'Mes anterior', text: '‹', disabled: prevDisabled, on: { click: function () { view.setMonth(view.getMonth() - 1); drawCal(); } } }),
        el('b', { text: first.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) }),
        el('button', { type: 'button', 'aria-label': 'Mes siguiente', text: '›', disabled: nextDisabled, on: { click: function () { view.setMonth(view.getMonth() + 1); drawCal(); } } })
      ]));
      var grid = el('div', { class: 'cal__grid', role: 'grid' });
      ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (d) { grid.appendChild(el('span', { class: 'cal__dow', 'aria-hidden': 'true', text: d })); });
      var offset = (first.getDay() + 6) % 7;
      for (var b = 0; b < offset; b++) grid.appendChild(el('span', { class: 'day day--blank' }));
      var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var n = 1; n <= days; n++) {
        (function (d) {
          var k = key(d);
          var off = d < today || d > maxDate || isClosed(d);
          grid.appendChild(el('button', {
            class: 'day' + (d.getTime() === today.getTime() ? ' today' : ''), type: 'button', text: String(d.getDate()), disabled: off,
            'aria-pressed': bk.date === k ? 'true' : 'false', 'aria-label': longDate(d) + (isClosed(d) ? ' (cerrado)' : ''),
            on: { click: function () { bk.date = k; bk.time = null; drawCal(); drawSlots(); } }
          }));
        })(new Date(view.getFullYear(), view.getMonth(), n));
      }
      cal.appendChild(grid);
      cal.appendChild(el('p', { class: 'legend', text: 'Puedes reservar hasta 60 días adelante. Los lunes no hay servicio.' }));
    }
    function drawSlots() {
      slotsBox.textContent = '';
      if (!bk.date) { slotsBox.appendChild(el('div', { class: 'slots-empty', text: 'Elige un día en el calendario para ver los horarios disponibles.' })); return; }
      slotsBox.appendChild(el('h3', { text: longDate(parseKey(bk.date)) }));
      var states = p.slots.map(function (t) { return slotState(bk.date, p.id, t); });
      var free = states.filter(function (s) { return s === 'free'; }).length;
      slotsBox.appendChild(el('p', { class: 'muted', style: 'margin:0 0 12px;font-size:14px', text: free ? free + ' horarios disponibles' : 'No quedan horarios este día. Prueba otra fecha.' }));
      slotsBox.appendChild(el('div', { class: 'slots' }, p.slots.map(function (t, i) {
        return el('button', { class: 'slot', type: 'button', text: t, disabled: states[i] !== 'free', 'aria-pressed': bk.time === t ? 'true' : 'false',
          'aria-label': t + (states[i] !== 'free' ? ' (ocupado)' : ''), on: { click: function () { bk.time = t; drawSlots(); nextBtn.disabled = false; } } });
      })));
    }
    drawCal(); drawSlots();
    var act = actions(function () { bk.step = 0; render(); }, 'Continuar →', function () { bk.step = 2; render(); }, !(bk.date && bk.time));
    var nextBtn = act.lastChild;
    body.appendChild(act);
  }

  function stepData() {
    var p = plan(bk.plan);
    body.appendChild(el('h2', { text: 'Tus datos' }));
    var people = el('select', { name: 'people', 'aria-label': 'Personas' }, [1, 2, 3, 4, 5, 6].map(function (n) { return el('option', { value: String(n), text: n + (n === 1 ? ' persona' : ' personas') }); }));
    people.value = String(bk.people);
    var name = el('input', { type: 'text', maxlength: '60', autocomplete: 'name', value: bk.name });
    var phone = el('input', { type: 'tel', maxlength: '15', autocomplete: 'tel', inputmode: 'tel', value: bk.phone, placeholder: '300 000 0000' });
    var sumBox = el('div', { class: 'summary' });
    var err = el('p', { class: 'err', role: 'alert' });
    function drawSum() {
      sumBox.textContent = '';
      [['Plan', p.name], ['Fecha', longDate(parseKey(bk.date))], ['Hora', bk.time], ['Personas', String(bk.people)]].forEach(function (r) {
        sumBox.appendChild(el('div', null, [el('span', { text: r[0] }), el('b', { text: r[1] })]));
      });
      sumBox.appendChild(el('div', { class: 'total' }, [el('span', { text: 'Total' }), el('b', { text: money(total()) })]));
    }
    people.addEventListener('change', function () { bk.people = Math.min(6, Math.max(1, parseInt(people.value, 10) || 1)); drawSum(); });
    body.appendChild(el('div', { class: 'form' }, [
      el('label', { class: 'full' }, ['Nombre completo', name]),
      el('label', null, ['Teléfono', phone]),
      el('label', null, ['Personas', people])
    ]));
    drawSum();
    body.appendChild(sumBox);
    body.appendChild(err);
    body.appendChild(actions(function () { bk.step = 1; render(); }, 'Confirmar reserva', function () {
      bk.name = I.clean(name.value, 60);
      bk.phone = I.clean(phone.value, 15).replace(/[^\d\s+]/g, '');
      if (bk.name.length < 3) { err.textContent = 'Escribe tu nombre completo.'; name.focus(); return; }
      if (bk.phone.replace(/\D/g, '').length < 7) { err.textContent = 'Escribe un teléfono válido.'; phone.focus(); return; }
      if (slotState(bk.date, bk.plan, bk.time) !== 'free') { err.textContent = 'Ese horario se acaba de ocupar. Elige otro.'; return; }
      var code = 'TV-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      db.mine.unshift({ code: code, plan: bk.plan, date: bk.date, time: bk.time, people: bk.people, name: bk.name, total: total(), status: 'ok', at: Date.now() });
      save();
      bk.code = code; bk.step = 3; render();
    }));
  }

  function qr(code) {
    var box = el('div', { class: 'qr', 'aria-hidden': 'true' });
    for (var i = 0; i < 121; i++) {
      var r = Math.floor(i / 11), c = i % 11;
      var finder = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
      box.appendChild(el('i', { class: finder || hash(code + i) > 0.5 ? '' : 'w' }));
    }
    return box;
  }

  function stepDone() {
    var p = plan(bk.plan);
    body.appendChild(el('div', { class: 'ticket', role: 'status' }, [
      el('div', null, [
        el('p', { class: 'muted', style: 'margin:0', text: '¡Reserva confirmada!' }),
        el('h2', { text: p.name }),
        el('p', { style: 'margin:0 0 8px', text: longDate(parseKey(bk.date)) + ' · ' + bk.time + ' · ' + bk.people + (bk.people === 1 ? ' persona' : ' personas') }),
        el('span', { class: 'ticket__code', text: bk.code }),
        el('p', { class: 'muted', style: 'font-size:14px;margin:10px 0 0', text: 'Presenta este código al llegar. Total: ' + money(total()) + ' (pago en el lugar).' })
      ]),
      qr(bk.code)
    ]));
    body.appendChild(el('p', { class: 'muted', style: 'font-size:14px;margin-top:18px', text: 'Demostración: en un sistema real se enviaría la confirmación por correo o WhatsApp, y el horario quedaría bloqueado para todos los clientes.' }));
    body.appendChild(el('div', { class: 'actions' }, [
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Hacer otra reserva', on: { click: function () { bk = { step: 0, plan: null, date: null, time: null, people: 2, name: bk.name, phone: bk.phone }; render(); } } }),
      el('button', { class: 'btn btn--warm', type: 'button', text: 'Quiero un sistema así', on: { click: function () { if (demo) I.openWhatsApp(I.msg.demo(demo)); } } })
    ]));
  }

  /* ---------- Mis reservas ---------- */
  function renderMine() {
    var box = document.getElementById('mine'); box.textContent = '';
    box.appendChild(el('h2', { text: 'Mis reservas' }));
    if (!db.mine.length) {
      box.appendChild(el('div', { class: 'empty' }, [el('p', { text: 'Aún no tienes reservas.' }), el('button', { class: 'btn', type: 'button', text: 'Reservar ahora', on: { click: function () { document.getElementById('t-reservar').click(); } } })]));
      return;
    }
    box.appendChild(el('div', { class: 'mine-list' }, db.mine.map(function (r) {
      var d = parseKey(r.date); var p = plan(r.plan) || { name: 'Plan' };
      return el('div', { class: 'res' + (r.status !== 'ok' ? ' res--cancel' : '') }, [
        el('div', { class: 'res__date' }, [el('b', { text: String(d.getDate()) }), el('span', { text: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') })]),
        el('div', null, [el('b', { text: p.name + ' · ' + r.time }), el('br'), el('small', { text: r.code + ' · ' + r.people + ' pers. · ' + money(r.total) + (r.status !== 'ok' ? ' · Cancelada' : '') })]),
        r.status === 'ok' ? el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancelar', on: { click: function () {
          if (window.confirm('¿Cancelar la reserva ' + r.code + '?')) { r.status = 'cancel'; save(); renderMine(); toast('Reserva cancelada'); }
        } } }) : null
      ]);
    })));
  }

  /* ---------- Agenda (administrador) ---------- */
  var agDate = document.getElementById('agenda-date') as HTMLInputElement;
  agDate.min = key(today); agDate.max = key(maxDate);
  agDate.value = key(isClosed(today) ? new Date(today.getTime() + 864e5) : today);
  agDate.addEventListener('change', renderAgenda);
  function renderAgenda() {
    var box = document.getElementById('agenda'); box.textContent = '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(agDate.value)) return;
    var d = parseKey(agDate.value);
    if (isClosed(d)) { box.appendChild(el('div', { class: 'ag-closed', text: 'Lunes: cerrado por mantenimiento.' })); return; }
    var times = [];
    PLANS.forEach(function (p) { p.slots.forEach(function (t) { if (times.indexOf(t) === -1) times.push(t); }); });
    times.sort();
    var table = el('table', { class: 'ag' }, [
      el('thead', null, [el('tr', null, [el('th', { text: 'Servicio' })].concat(times.map(function (t) { return el('th', { scope: 'col', text: t }); })))]),
      el('tbody', null, PLANS.map(function (p) {
        return el('tr', null, [el('th', { scope: 'row', text: p.name })].concat(times.map(function (t) {
          if (p.slots.indexOf(t) === -1) return el('td');
          var st = slotState(agDate.value, p.id, t);
          var label = { free: 'Libre', busy: 'Reservado', mine: 'Tu reserva', blocked: 'Bloqueado' }[st];
          var cell = el('td', { class: st, text: label, title: st === 'free' ? 'Clic para bloquear' : st === 'blocked' ? 'Clic para liberar' : null });
          if (st === 'free' || st === 'blocked') {
            cell.tabIndex = 0;
            cell.setAttribute('role', 'button');
            var toggle = function () {
              var k = agDate.value + '|' + p.id + '|' + t;
              var i = db.blocks.indexOf(k);
              if (i === -1) { db.blocks.push(k); toast('Horario bloqueado'); } else { db.blocks.splice(i, 1); toast('Horario liberado'); }
              save(); renderAgenda();
            };
            cell.addEventListener('click', toggle);
            cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
          }
          return cell;
        })));
      }))
    ]);
    box.appendChild(el('div', { class: 'ag-wrap' }, [table]));
    box.appendChild(el('div', { class: 'ag-legend' }, [
      el('span', null, [el('i', { style: 'background:#f6f1e8;border:1px solid #ddd' }), 'Libre']),
      el('span', null, [el('i', { style: 'background:#0f4c4a' }), 'Reservado']),
      el('span', null, [el('i', { style: 'background:#e07a4f' }), 'Tus reservas de prueba']),
      el('span', null, [el('i', { style: 'background:#e9e4da' }), 'Bloqueado por el negocio'])
    ]));
  }

  updateBadge();
  render();
})();
