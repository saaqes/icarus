/* Capa de disuasión: oculta el menú contextual y atajos de inspección.
   No es seguridad real (el navegador siempre puede ver lo que recibe), solo dificulta la curiosidad casual. */
(function () {
  const stop = (e: Event) => { e.preventDefault(); };
  document.addEventListener("contextmenu", stop);
  document.addEventListener("dragstart", (e) => { if ((e.target as HTMLElement).tagName === "IMG") stop(e); });
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k"].includes(k)) || ((e.ctrlKey || e.metaKey) && ["u", "s"].includes(k)) || (e.metaKey && e.altKey && ["i", "j", "u"].includes(k))) stop(e);
  });
})();
