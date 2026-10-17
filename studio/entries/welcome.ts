/** Presentación de ICARUS Website Builder en /forja/: vídeo, herramientas y galería de plantillas (carga diferida). */

const TOOLS: { title: string; text: string; viz: string; marks: string[] }[] = [
  { title: "Diseña a tu manera", text: "Mueve, selecciona, redimensiona y organiza elementos con guías de alineación, capas y zoom.", viz: "viz-move", marks: ["b1", "b2", "b3", "sel"] },
  { title: "Personaliza cada detalle", text: "Cambia textos, tipografías, colores, imágenes y estilos. Un color global actualiza todo lo que lo usa.", viz: "viz-style", marks: ["sw s1", "sw s2", "sw s3", "sw s4", "aa"] },
  { title: "Dale vida a tu página", text: "Incorpora animaciones de entrada, efectos al pasar el cursor y entradas escalonadas. Respetan «reducir movimiento».", viz: "viz-anim", marks: ["a1", "a2", "a3"] },
  { title: "Adáptala a cualquier pantalla", text: "Visualiza y ajusta las versiones de escritorio, tableta y móvil, con el ancho real de cada dispositivo.", viz: "viz-resp", marks: ["d d1", "d d2", "d d3"] },
  { title: "Guarda tus proyectos", text: "Organízalos en carpetas, duplícalos y continúa editando cuando quieras desde cualquier dispositivo.", viz: "viz-folders", marks: ["f1", "f2", "f3", "f4"] },
  { title: "Prueba antes de terminar", text: "La vista previa muestra tu sitio real, sin interfaz de edición, con enlaces, botones y animaciones funcionando.", viz: "viz-prev", marks: ["w", "p"] },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/* ---------- Herramientas ---------- */
const toolsBox = document.getElementById("bld-tools");
if (toolsBox) {
  TOOLS.forEach((t, i) => {
    const viz = el("div", `bld-viz ${t.viz}`);
    viz.setAttribute("aria-hidden", "true");
    for (const m of t.marks) { const i2 = el("i", m); if (m === "aa") i2.textContent = "Aa"; viz.appendChild(i2); }
    const card = el("article", "bld-tool reveal");
    card.style.setProperty("--rd", `${i * 0.07}s`);
    card.append(viz, el("h3", undefined, t.title), el("p", undefined, t.text));
    toolsBox.appendChild(card);
  });
  (window as any).ICARUS?.reveal?.(toolsBox);
}

/* ---------- Vídeo de presentación (fondo de la sección, en bucle, con botón de pausa) ---------- */
const wrap = document.getElementById("bld-video");
const video = document.getElementById("bld-tour") as HTMLVideoElement | null;
const toggle = document.getElementById("bld-toggle") as HTMLButtonElement | null;
if (wrap && video && toggle) {
  const fallback = wrap.querySelector<HTMLElement>(".bld-video__fallback");
  const txt = toggle.querySelector(".bld-toggle__txt");
  let userPaused = false;
  const reflect = () => {
    const paused = video.paused;
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.setAttribute("aria-label", paused ? "Reproducir el vídeo de presentación" : "Pausar el vídeo de presentación");
    if (txt) txt.textContent = paused ? "Reproducir" : "Pausar";
  };
  const showFallback = () => { if (fallback) fallback.hidden = false; toggle.hidden = true; video.hidden = true; };
  toggle.addEventListener("click", () => {
    if (video.paused) { userPaused = false; void video.play().catch(() => undefined); }
    else { userPaused = true; video.pause(); }
  });
  video.addEventListener("play", reflect);
  video.addEventListener("pause", reflect);
  // quien prefiere menos movimiento ve el vídeo detenido (puede reproducirlo con el botón)
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { userPaused = true; video.pause(); video.removeAttribute("autoplay"); }
  // ahorra batería: se detiene al salir de la vista y se reanuda al volver (salvo que la persona lo haya pausado)
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      if (userPaused) return;
      if (e.isIntersecting) void video.play().catch(() => undefined); else video.pause();
    }, { threshold: 0.05 }).observe(wrap);
  }
  // si el archivo no existe o el formato no es compatible, se muestra una alternativa visual
  const sources = video.querySelectorAll("source");
  sources[sources.length - 1]?.addEventListener("error", showFallback);
  video.addEventListener("error", showFallback);
  if (video.canPlayType("video/webm") === "" && video.canPlayType("video/mp4") === "") showFallback();
  reflect();
}

/* ---------- Galería de plantillas (módulo diferido) ---------- */
const gallery = document.getElementById("bld-gallery");
if (gallery) {
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    import("./gallery").then((m) => m.mountGallery(gallery, document.getElementById("bld-filters")!)).catch(() => {
      gallery.replaceChildren(Object.assign(el("p", "bld-loading"), { textContent: "No se pudieron cargar las plantillas. " }), Object.assign(el("a", "btn btn--blood btn--sm"), { href: "studio/#/new", textContent: "Abrir el constructor" }));
    });
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "500px" });
    io.observe(gallery);
  } else load();
  document.getElementById("bld-explore")?.addEventListener("click", load);
}
