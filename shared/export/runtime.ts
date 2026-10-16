/**
 * CSS base y JavaScript mínimo que acompañan a todo sitio generado (exportación y vista previa).
 * El sitio publicado NO contiene nada del editor: solo estos dos archivos y el contenido del diseño.
 */

export const BASE_CSS = `/* ICARUS Website Builder — estilos base */
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;min-height:100vh;background:var(--c-bg,#fff);color:var(--c-text,#111);font-family:var(--f-body,system-ui,sans-serif);line-height:1.5;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4,h5,h6,p,figure,blockquote,hr{margin:0}
hr{border:0}
img,video,svg{max-width:100%}
a{color:inherit}
.n a{color:inherit;text-decoration:inherit}
.n-text{white-space:pre-wrap;overflow-wrap:break-word}
.n-button{cursor:pointer;text-decoration:none;font:inherit;line-height:1.2;border:0;background:none;color:inherit;transition:background-color .25s ease,color .25s ease,border-color .25s ease,box-shadow .25s ease,transform .25s ease,opacity .25s ease}
.n-button[disabled],.n-button[aria-disabled="true"]{opacity:.5;pointer-events:none}
.n-button svg{flex:none}
.n-image,.n-video{overflow:hidden}
.n-icon svg{display:block}
.ic-field label{font-size:.875em;font-weight:600}
.ic-field input,.ic-field textarea{font:inherit;color:inherit;background:transparent;border:1px solid rgba(128,128,128,.45);border-radius:10px;padding:12px 14px;width:100%;min-width:0}
.ic-field textarea{min-height:110px;resize:vertical}
.ic-field input:focus-visible,.ic-field textarea:focus-visible,.n-button:focus-visible,a:focus-visible{outline:2px solid var(--c-primary,#7c3aed);outline-offset:2px}
.ic-form-msg{font-size:.9375em;font-weight:600;color:var(--c-primary)}
.ic-skip{position:fixed;top:-60px;left:12px;z-index:9999;background:#fff;color:#000;padding:10px 14px;border-radius:8px;font:600 14px system-ui}
.ic-skip:focus{top:12px}
.hfx{transition:translate .28s cubic-bezier(.2,.7,.1,1),scale .28s cubic-bezier(.2,.7,.1,1),box-shadow .28s ease}
.hfx-lift:hover{translate:0 -6px}
.hfx-grow:hover{scale:1.04}
.hfx-shrink:hover{scale:.97}
.hfx-glow:hover{box-shadow:0 0 32px -2px var(--c-primary,#7c3aed)}
`;

export const ANIM_CSS = `/* Animaciones de entrada */
.js [data-anim]{transition:opacity var(--ad,700ms) ease var(--adl,0ms),translate var(--ad,700ms) cubic-bezier(.2,.7,.1,1) var(--adl,0ms),scale var(--ad,700ms) cubic-bezier(.2,.7,.1,1) var(--adl,0ms),rotate var(--ad,700ms) cubic-bezier(.2,.7,.1,1) var(--adl,0ms),filter var(--ad,700ms) ease var(--adl,0ms)}
.js [data-anim]:not(.is-in){opacity:0}
.js [data-anim="slide-up"]:not(.is-in){translate:0 calc(var(--ai,50) * .8px)}
.js [data-anim="slide-down"]:not(.is-in){translate:0 calc(var(--ai,50) * -.8px)}
.js [data-anim="slide-left"]:not(.is-in){translate:calc(var(--ai,50) * -.8px) 0}
.js [data-anim="slide-right"]:not(.is-in){translate:calc(var(--ai,50) * .8px) 0}
.js [data-anim="scale"]:not(.is-in){scale:calc(1 - var(--ai,50) / 250)}
.js [data-anim="zoom-out"]:not(.is-in){scale:calc(1 + var(--ai,50) / 100)}
.js [data-anim="blur"]:not(.is-in){filter:blur(calc(var(--ai,50) * .2px))}
.js [data-anim="rotate"]:not(.is-in){rotate:calc(var(--ai,50) * -.2deg)}
@media (prefers-reduced-motion:reduce){
html{scroll-behavior:auto}
.js [data-anim],.hfx{transition:none!important}
.js [data-anim]:not(.is-in){opacity:1!important;translate:none!important;scale:none!important;rotate:none!important;filter:none!important}
.hfx-lift:hover,.hfx-grow:hover,.hfx-shrink:hover{translate:none;scale:none}
}
`;

/**
 * Comportamiento del sitio generado: animaciones al hacer scroll, formularios (WhatsApp / correo)
 * y, solo en la vista previa del editor, navegación entre páginas hacia la ventana contenedora.
 */
export const SITE_JS = `/* ICARUS Website Builder — comportamiento del sitio */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) { if (d.readyState !== 'loading') fn(); else d.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    var els = [].slice.call(d.querySelectorAll('[data-anim]'));
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); }
    else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      els.forEach(function (e) {
        if (e.getAttribute('data-anim-trigger') === 'load') requestAnimationFrame(function () { requestAnimationFrame(function () { e.classList.add('is-in'); }); });
        else io.observe(e);
      });
    }

    [].slice.call(d.querySelectorAll('form[data-ic-mode]')).forEach(function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (!form.reportValidity()) return;
        var lines = [];
        [].slice.call(form.querySelectorAll('input,textarea')).forEach(function (f) {
          var label = f.getAttribute('data-label') || f.name;
          if (f.value) lines.push(label + ': ' + f.value);
        });
        var text = lines.join('\\n');
        var to = form.getAttribute('data-ic-to') || '';
        var mode = form.getAttribute('data-ic-mode');
        var msg = form.getAttribute('data-ic-success') || 'Gracias.';
        var out = form.querySelector('.ic-form-msg');
        if (!out) { out = d.createElement('p'); out.className = 'ic-form-msg'; out.setAttribute('role', 'status'); form.appendChild(out); }
        if (!to) { out.textContent = 'Este formulario aún no tiene un destino configurado.'; return; }
        if (mode === 'whatsapp') {
          var num = to.replace(/\\D/g, '');
          window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        } else {
          window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Mensaje desde la web') + '&body=' + encodeURIComponent(text);
        }
        out.textContent = msg;
      });
    });

    /* Vista previa dentro del editor: los enlaces entre páginas se resuelven en la ventana contenedora. */
    d.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[data-ic-page]') : null;
      if (!a) return;
      ev.preventDefault();
      if (window.parent !== window) window.parent.postMessage({ type: 'icarus-preview-nav', page: a.getAttribute('data-ic-page') }, '*');
    });
  });
})();
`;
