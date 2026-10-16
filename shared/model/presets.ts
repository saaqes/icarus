/** Elementos del panel «Insertar», secciones prediseñadas, estilos de texto y paletas. */
import { libSrc } from "../library";
import { anim, N, pad, Spec } from "./build";
import { PartialStyle } from "./types";

export type ElementGroup = "Texto" | "Básicos" | "Medios" | "Estructura" | "Formularios";

export interface ElementDef {
  id: string;
  group: ElementGroup;
  label: string;
  icon: string;
  /** Tamaño inicial cuando se inserta en un contenedor libre. */
  size: { w: number; h: number };
  build: () => Spec;
}

export const ELEMENTS: ElementDef[] = [
  { id: "heading", group: "Texto", label: "Encabezado", icon: "type", size: { w: 520, h: 64 }, build: () => N.heading("Escribe tu título", 2) },
  { id: "subtitle", group: "Texto", label: "Subtítulo", icon: "type", size: { w: 520, h: 36 }, build: () => N.heading("Escribe tu subtítulo", 3, { name: "Subtítulo", s: { weight: 600 } }) },
  { id: "paragraph", group: "Texto", label: "Párrafo", icon: "align", size: { w: 480, h: 110 }, build: () => N.para("Escribe aquí tu párrafo. Haz doble clic para editar el texto directamente sobre el lienzo.") },
  { id: "text", group: "Texto", label: "Texto", icon: "type", size: { w: 260, h: 28 }, build: () => N.text("Texto", { name: "Texto", s: { size: 16, color: "$text" } }) },
  {
    id: "link", group: "Texto", label: "Enlace", icon: "link", size: { w: 160, h: 26 },
    build: () => N.text("Enlace de texto", { name: "Enlace", props: { href: "#", tag: "p" }, s: { size: 16, color: "$primary", underline: true, weight: 600 } }),
  },
  { id: "button", group: "Básicos", label: "Botón", icon: "button", size: { w: 180, h: 48 }, build: () => N.button("Botón") },
  { id: "button-outline", group: "Básicos", label: "Botón contorno", icon: "button", size: { w: 180, h: 48 }, build: () => N.button("Botón", { variant: "outline", name: "Botón contorno" }) },
  { id: "icon", group: "Básicos", label: "Icono", icon: "star", size: { w: 40, h: 40 }, build: () => N.icon("star", { size: 40 }) },
  { id: "divider", group: "Básicos", label: "Separador", icon: "minus", size: { w: 400, h: 2 }, build: () => N.divider() },
  { id: "rect", group: "Básicos", label: "Rectángulo", icon: "square", size: { w: 160, h: 120 }, build: () => N.shape("rect") },
  { id: "ellipse", group: "Básicos", label: "Círculo", icon: "circle", size: { w: 120, h: 120 }, build: () => N.shape("ellipse") },
  { id: "line", group: "Básicos", label: "Línea", icon: "minus", size: { w: 240, h: 3 }, build: () => N.shape("line") },
  { id: "image", group: "Medios", label: "Imagen", icon: "image", size: { w: 420, h: 280 }, build: () => N.image(libSrc("aurora"), "Describe la imagen", { s: { w: "fill", h: "auto" }, props: { ratio: 1.5 } }) },
  { id: "video", group: "Medios", label: "Vídeo", icon: "play", size: { w: 480, h: 270 }, build: () => N.video("", { name: "Vídeo", s: { w: "fill", h: "auto" } }) },
  {
    id: "container", group: "Estructura", label: "Contenedor", icon: "box", size: { w: 360, h: 200 },
    build: () => N.box({ s: { padding: pad(24), gap: 12, radius: 12, border: { w: 1, color: "rgba(255,255,255,0.14)", style: "dashed" } } }, [N.para("Contenido del contenedor")]),
  },
  { id: "row", group: "Estructura", label: "Fila (flex)", icon: "columns", size: { w: 520, h: 120 }, build: () => N.row({ s: { padding: pad(12), gap: 16, wrap: true } }, [N.button("Uno"), N.button("Dos", { variant: "outline" })]) },
  {
    id: "grid", group: "Estructura", label: "Cuadrícula", icon: "grid", size: { w: 640, h: 220 },
    build: () => N.grid({ s: { columns: 3, gap: 16 }, tablet: { columns: 2 }, mobile: { columns: 1 } }, [1, 2, 3].map((i) => N.card({ name: `Celda ${i}`, s: { padding: pad(20) } }, [N.heading(`Elemento ${i}`, 4), N.para("Descripción breve.", { s: { size: 15 } })]))),
  },
  { id: "free", group: "Estructura", label: "Lienzo libre", icon: "move", size: { w: 520, h: 320 }, build: () => N.free({ s: { minHeight: 280, border: { w: 1, color: "rgba(255,255,255,0.14)", style: "dashed" }, radius: 12 } }) },
  {
    id: "card", group: "Estructura", label: "Tarjeta", icon: "card", size: { w: 320, h: 220 },
    build: () => N.card({}, [N.icon("sparkles", { size: 30 }), N.heading("Título de la tarjeta", 3), N.para("Describe brevemente el servicio, producto o idea que quieres destacar.", { s: { size: 15 } })]),
  },
  {
    id: "form", group: "Formularios", label: "Formulario de contacto", icon: "mail", size: { w: 420, h: 360 },
    build: () => contactForm(),
  },
  { id: "field", group: "Formularios", label: "Campo de texto", icon: "input", size: { w: 320, h: 70 }, build: () => N.field("Nombre") },
];

export function contactForm(): Spec {
  return N.form({ s: { gap: 14, padding: pad(0) } }, [
    N.field("Nombre", { required: true }),
    N.field("Correo", { kind: "email", name: "correo", required: true }),
    N.field("Mensaje", { kind: "textarea", name: "mensaje" }),
    N.button("Enviar mensaje", { props: { submit: true, href: "" }, s: { alignSelf: "stretch" } }),
  ]);
}

/* ---------- Secciones prediseñadas ---------- */

export interface SectionDef { id: string; label: string; description: string; icon: string; build: () => Spec }

const CARD_BORDER = { w: 1, color: "rgba(255,255,255,0.08)", style: "solid" as const };

export function navBar(brand = "Mi marca", links: { label: string; href: string }[] = [{ label: "Inicio", href: "#" }, { label: "Servicios", href: "#servicios" }, { label: "Contacto", href: "#contacto" }]): Spec {
  return N.section({
    name: "Navegación", props: { tag: "header" },
    s: { padding: pad(18, 24), maxWidth: 1160, layout: "row", justify: "between", align: "center", wrap: true, gap: 16, bg: "$bg" },
    mobile: { padding: pad(14, 16) },
  }, [
    N.text(brand, { name: "Logotipo", props: { tag: "p" }, s: { font: "$heading", size: 22, weight: 800, color: "$text" } }),
    N.row({ name: "Enlaces", props: { tag: "nav" }, s: { gap: 28, wrap: true }, mobile: { gap: 16 } }, links.map((l) =>
      N.text(l.label, { name: `Enlace ${l.label}`, props: { href: l.href, tag: "p" }, s: { size: 15, weight: 500, color: "$muted" }, hover: { color: "$text" } }))),
    N.button("Empezar", { name: "Botón principal", s: { padding: pad(10, 20) } }),
  ]);
}

export function heroCentered(): Spec {
  return N.section({ name: "Hero", s: { padding: pad(110, 24, 100, 24), align: "center", gap: 22, bg: "$bg" }, mobile: { padding: pad(64, 20) } }, [
    N.eyebrow("Presentamos", { s: { textAlign: "center" }, anim: anim("fade", { trigger: "load" }) }),
    N.heading("Una gran idea merece una gran página web", 1, { s: { textAlign: "center", maxWidth: 860 }, anim: anim("slide-up", { trigger: "load", delay: 80 }) }),
    N.para("Cuenta quién eres y qué ofreces en una frase clara. Este texto es totalmente editable: haz doble clic sobre él.", { s: { textAlign: "center", maxWidth: 640, size: 19 }, anim: anim("slide-up", { trigger: "load", delay: 160 }) }),
    N.row({ name: "Botones", s: { gap: 14, justify: "center", wrap: true }, anim: anim("slide-up", { trigger: "load", delay: 240 }) }, [
      N.button("Comenzar ahora", { s: { padding: pad(16, 32), size: 16 } }),
      N.button("Saber más", { variant: "outline", s: { padding: pad(16, 32), size: 16 } }),
    ]),
  ]);
}

export function heroSplit(): Spec {
  return N.section({ name: "Hero con imagen", s: { padding: pad(90, 24), bg: "$bg" }, mobile: { padding: pad(48, 20) } }, [
    N.row({ name: "Columnas", s: { gap: 56, align: "center" }, tablet: { layout: "stack", gap: 36 } }, [
      N.box({ name: "Texto", s: { w: "fill", gap: 20 } }, [
        N.eyebrow("Nuevo"),
        N.heading("Convierte visitantes en clientes", 1, { s: { size: 52 }, anim: anim("slide-up") }),
        N.para("Explica el valor de tu propuesta en dos líneas. Sé directo, humano y concreto.", { s: { size: 18 } }),
        N.row({ name: "Botones", s: { gap: 12, wrap: true } }, [N.button("Empezar"), N.button("Ver demo", { variant: "outline" })]),
      ]),
      N.image(libSrc("browser"), "Vista de un sitio web", { s: { w: "fill", h: "auto", radius: 20, shadow: [{ x: 0, y: 30, blur: 70, spread: -20, color: "rgba(0,0,0,0.6)" }] }, props: { ratio: 1.5 }, anim: anim("scale", { delay: 150 }) }),
    ]),
  ]);
}

export function features(): Spec {
  const items = [
    ["zap", "Rápido", "Páginas ligeras que cargan al instante en cualquier dispositivo."],
    ["shield", "Seguro", "Buenas prácticas de seguridad aplicadas desde el diseño."],
    ["palette", "A tu estilo", "Colores, tipografías y animaciones totalmente personalizables."],
  ];
  return N.section({ name: "Características", attrs: { elId: "servicios" }, s: { padding: pad(88, 24), align: "center", gap: 48, bg: "$bg" }, mobile: { padding: pad(56, 20), gap: 32 } }, [
    N.box({ name: "Encabezado", s: { align: "center", gap: 12 } }, [
      N.eyebrow("Servicios", { s: { textAlign: "center" } }),
      N.heading("Todo lo que necesitas", 2, { s: { textAlign: "center" } }),
      N.para("Una breve introducción a lo que ofreces.", { s: { textAlign: "center", maxWidth: 560 } }),
    ]),
    N.grid({ name: "Tarjetas", s: { columns: 3, gap: 24, w: "fill" }, tablet: { columns: 2 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) },
      items.map(([ic, t, d]) => N.card({ name: `Tarjeta ${t}` }, [N.icon(ic, { size: 30 }), N.heading(t, 3), N.para(d, { s: { size: 15 } })]))),
  ]);
}

export function testimonials(): Spec {
  const items = [
    ["avatar-1", "Laura Gómez", "Fundadora, Estudio Alba", "«Pasamos de una idea a una web profesional en un fin de semana. El resultado superó lo que esperábamos.»"],
    ["avatar-2", "Andrés Pardo", "Director, Pardo & Co.", "«Cambiar textos, colores y fotos es tan simple que ya no dependemos de nadie.»"],
    ["avatar-3", "Marta Ruiz", "Diseñadora independiente", "«Mi portafolio ahora refleja mi trabajo. Mis clientes lo notaron desde el primer día.»"],
  ];
  return N.section({ name: "Testimonios", s: { padding: pad(88, 24), align: "center", gap: 44, bg: "$surface" }, mobile: { padding: pad(56, 20) } }, [
    N.heading("Lo que dicen nuestros clientes", 2, { s: { textAlign: "center" } }),
    N.grid({ name: "Opiniones", s: { columns: 3, gap: 24, w: "fill" }, tablet: { columns: 2 }, mobile: { columns: 1 } },
      items.map(([av, nm, role, q]) => N.card({ name: `Opinión ${nm}`, s: { bg: "$bg", gap: 18, border: CARD_BORDER } }, [
        N.para(q, { s: { color: "$text", size: 16 } }),
        N.row({ name: "Autor", s: { gap: 12 } }, [
          N.image(libSrc(av), nm, { s: { w: 48, h: 48, radius: 999 }, props: { ratio: 1 } }),
          N.box({ s: { gap: 2 } }, [N.text(nm, { s: { weight: 700, size: 15, color: "$text" } }), N.text(role, { s: { size: 13, color: "$muted" } })]),
        ]),
      ]))),
  ]);
}

export function faq(): Spec {
  const qa = [
    ["¿Necesito saber programar?", "No. Todo se hace de forma visual: arrastras, escribes y personalizas."],
    ["¿Puedo cambiar el diseño después?", "Sí, puedes editar tu proyecto cuando quieras. Se guarda en tu cuenta."],
    ["¿Se ve bien en el celular?", "Cada sección tiene su versión para tableta y móvil que puedes ajustar."],
    ["¿Cómo recibo mi página?", "Descargas el sitio completo en un archivo ZIP o lo solicitas a ICARUS."],
  ];
  return N.section({ name: "Preguntas frecuentes", s: { padding: pad(88, 24), align: "center", gap: 36, maxWidth: 820, bg: "$bg" }, mobile: { padding: pad(56, 20) } }, [
    N.heading("Preguntas frecuentes", 2, { s: { textAlign: "center" } }),
    N.box({ name: "Preguntas", s: { gap: 14, w: "fill" } }, qa.map(([q, a]) =>
      N.box({ name: q, s: { padding: pad(20, 24), bg: "$surface", radius: 14, gap: 6, border: CARD_BORDER } }, [
        N.heading(q, 4, { s: { size: 17 } }),
        N.para(a, { s: { size: 15 } }),
      ]))),
  ]);
}

export function cta(): Spec {
  return N.section({
    name: "Llamada a la acción",
    s: { padding: pad(88, 24), align: "center", gap: 20, bg: { kind: "linear", angle: 135, stops: [{ c: "$primary", p: 0 }, { c: "$secondary", p: 100 }] } },
    mobile: { padding: pad(56, 20) },
  }, [
    N.heading("¿Listo para empezar?", 2, { s: { textAlign: "center", color: "$light" } }),
    N.para("Da el primer paso hoy y deja que tu idea tenga su propio lugar en internet.", { s: { textAlign: "center", color: "rgba(255,255,255,0.86)", maxWidth: 560, size: 18 } }),
    N.button("Crear mi página", { s: { bg: "$light", color: "$dark", alignSelf: "center", padding: pad(16, 34) }, hover: { bg: "$text" } }),
  ]);
}

export function pricing(): Spec {
  const plans: [string, string, string[], boolean][] = [
    ["Básico", "$29", ["1 página", "Diseño responsive", "Soporte por correo"], false],
    ["Pro", "$59", ["Hasta 5 páginas", "Animaciones", "Formulario de contacto", "Soporte prioritario"], true],
    ["Empresa", "$99", ["Páginas ilimitadas", "Diseño a medida", "Acompañamiento personal"], false],
  ];
  return N.section({ name: "Precios", s: { padding: pad(88, 24), align: "center", gap: 44, bg: "$bg" }, mobile: { padding: pad(56, 20) } }, [
    N.box({ name: "Encabezado", s: { align: "center", gap: 10 } }, [N.heading("Planes simples", 2, { s: { textAlign: "center" } }), N.para("Elige el que mejor se ajuste a tu proyecto.", { s: { textAlign: "center" } })]),
    N.grid({ name: "Planes", s: { columns: 3, gap: 24, w: "fill" }, tablet: { columns: 1 }, mobile: { columns: 1 } }, plans.map(([nm, price, feats, hot]) =>
      N.card({ name: `Plan ${nm}`, s: { gap: 16, border: hot ? { w: 2, color: "$primary", style: "solid" } : CARD_BORDER } }, [
        N.text(nm, { s: { weight: 700, size: 16, color: hot ? "$primary" : "$muted", transform: "uppercase", ls: 1.5 } }),
        N.text(price, { name: "Precio", s: { font: "$heading", size: 44, weight: 800, color: "$text" } }),
        N.divider(),
        N.box({ name: "Incluye", s: { gap: 10 } }, feats.map((f) => N.row({ s: { gap: 10 } }, [N.icon("check", { size: 18 }), N.text(f, { s: { size: 15, color: "$text" } })]))),
        N.button("Elegir plan", { variant: hot ? "solid" : "outline", s: { alignSelf: "stretch" } }),
      ]))),
  ]);
}

export function gallery(): Spec {
  const imgs = ["aurora", "ember", "ocean", "forest", "sunrise", "mesh"];
  return N.section({ name: "Galería", s: { padding: pad(80, 24), align: "center", gap: 36, bg: "$bg" }, mobile: { padding: pad(48, 20) } }, [
    N.heading("Galería", 2, { s: { textAlign: "center" } }),
    N.grid({ name: "Imágenes", s: { columns: 3, gap: 16, w: "fill" }, tablet: { columns: 2 }, mobile: { columns: 1 }, anim: anim("scale", { stagger: true }) },
      imgs.map((i, k) => N.image(libSrc(i), `Imagen ${k + 1}`, { s: { radius: 14, w: "fill", h: "auto" }, props: { ratio: 1.5 } }))),
  ]);
}

export function contact(): Spec {
  return N.section({ name: "Contacto", attrs: { elId: "contacto" }, s: { padding: pad(88, 24), bg: "$surface" }, mobile: { padding: pad(56, 20) } }, [
    N.row({ name: "Columnas", s: { gap: 56, align: "start" }, tablet: { layout: "stack", gap: 32 } }, [
      N.box({ name: "Información", s: { w: "fill", gap: 16 } }, [
        N.eyebrow("Contacto"),
        N.heading("Hablemos de tu proyecto", 2),
        N.para("Cuéntanos qué necesitas y te respondemos lo antes posible."),
        N.row({ s: { gap: 10 } }, [N.icon("mail", { size: 20 }), N.text("hola@tusitio.com", { s: { color: "$text", size: 15 } })]),
        N.row({ s: { gap: 10 } }, [N.icon("phone", { size: 20 }), N.text("+57 300 000 0000", { s: { color: "$text", size: 15 } })]),
      ]),
      N.box({ name: "Formulario", s: { w: "fill", padding: pad(28), bg: "$bg", radius: 18, border: CARD_BORDER } }, [contactForm()]),
    ]),
  ]);
}

export function stats(): Spec {
  const items = [["+120", "Proyectos entregados"], ["98%", "Clientes satisfechos"], ["24 h", "Tiempo de respuesta"], ["5★", "Valoración media"]];
  return N.section({ name: "Cifras", s: { padding: pad(56, 24), bg: "$bg" }, mobile: { padding: pad(40, 20) } }, [
    N.grid({ name: "Cifras", s: { columns: 4, gap: 24, align: "center" }, tablet: { columns: 2 }, mobile: { columns: 2, gap: 16 }, anim: anim("fade", { stagger: true }) },
      items.map(([n, l]) => N.box({ s: { align: "center", gap: 4 } }, [
        N.text(n, { s: { font: "$heading", size: 40, weight: 800, color: "$primary", textAlign: "center" }, mobile: { size: 30 } }),
        N.text(l, { s: { size: 14, color: "$muted", textAlign: "center" } }),
      ]))),
  ]);
}

export function footer(brand = "Mi marca"): Spec {
  return N.section({ name: "Pie de página", props: { tag: "footer" }, s: { padding: pad(56, 24, 32, 24), gap: 36, bg: "$dark" }, mobile: { padding: pad(40, 20, 28, 20) } }, [
    N.row({ name: "Columnas", s: { gap: 40, align: "start", justify: "between", wrap: true }, tablet: { layout: "stack" } }, [
      N.box({ name: "Marca", s: { gap: 10, maxWidth: 320 } }, [
        N.text(brand, { name: "Logotipo", s: { font: "$heading", size: 22, weight: 800, color: "$light" } }),
        N.para("Construido con ICARUS Website Builder.", { s: { size: 14 } }),
      ]),
      N.box({ name: "Enlaces", s: { gap: 8 } }, [N.text("Navegación", { s: { weight: 700, size: 14, color: "$light" } }), ...["Inicio", "Servicios", "Contacto"].map((t) => N.text(t, { props: { href: "#" }, s: { size: 14, color: "$muted" } }))]),
      N.box({ name: "Contacto", s: { gap: 8 } }, [N.text("Contacto", { s: { weight: 700, size: 14, color: "$light" } }), N.text("hola@tusitio.com", { s: { size: 14, color: "$muted" } })]),
    ]),
    N.divider(),
    N.text(`© ${new Date().getFullYear()} ${brand}. Todos los derechos reservados.`, { s: { size: 13, color: "$muted" } }),
  ]);
}

export const SECTIONS: SectionDef[] = [
  { id: "nav", label: "Navegación", description: "Logotipo, enlaces y botón", icon: "menu", build: () => navBar() },
  { id: "hero", label: "Hero centrado", description: "Título grande y botones", icon: "sparkles", build: heroCentered },
  { id: "hero-split", label: "Hero con imagen", description: "Texto a la izquierda, imagen a la derecha", icon: "columns", build: heroSplit },
  { id: "features", label: "Servicios", description: "Tres tarjetas con icono", icon: "grid", build: features },
  { id: "stats", label: "Cifras", description: "Datos destacados", icon: "chart", build: stats },
  { id: "gallery", label: "Galería", description: "Cuadrícula de imágenes", icon: "image", build: gallery },
  { id: "testimonials", label: "Testimonios", description: "Opiniones de clientes", icon: "message", build: testimonials },
  { id: "pricing", label: "Precios", description: "Tres planes", icon: "tag", build: pricing },
  { id: "faq", label: "Preguntas frecuentes", description: "Lista de preguntas", icon: "help", build: faq },
  { id: "cta", label: "Llamada a la acción", description: "Fondo degradado y botón", icon: "rocket", build: cta },
  { id: "contact", label: "Contacto", description: "Datos y formulario", icon: "mail", build: contact },
  { id: "footer", label: "Pie de página", description: "Enlaces y derechos", icon: "layers", build: () => footer() },
];

/* ---------- Estilos de texto predefinidos ---------- */

export interface TextStyleDef { id: string; label: string; style: PartialStyle; tag: string }
export const TEXT_STYLES: TextStyleDef[] = [
  { id: "title", label: "Título", tag: "h1", style: { font: "$heading", size: 56, weight: 700, lh: 1.08, color: "$text", ls: 0, transform: "none" } },
  { id: "subtitle", label: "Subtítulo", tag: "h3", style: { font: "$heading", size: 24, weight: 600, lh: 1.25, color: "$text", ls: 0, transform: "none" } },
  { id: "paragraph", label: "Párrafo", tag: "p", style: { font: "$body", size: 17, weight: 400, lh: 1.65, color: "$muted", ls: 0, transform: "none" } },
  { id: "highlight", label: "Texto destacado", tag: "p", style: { font: "$body", size: 20, weight: 600, lh: 1.5, color: "$primary", ls: 0, transform: "none" } },
  { id: "label", label: "Etiqueta", tag: "p", style: { font: "$body", size: 13, weight: 700, lh: 1.3, color: "$primary", ls: 2.4, transform: "uppercase" } },
];

/* ---------- Paletas ---------- */

export interface PaletteDef { id: string; label: string; colors: Record<string, string> }
export const PALETTES: PaletteDef[] = [
  { id: "icarus", label: "ICARUS", colors: { primary: "#b3261e", secondary: "#d9472b", accent: "#c9a35a", bg: "#0b0b0d", surface: "#17171b", text: "#f3f1ec", muted: "#9a9ca5", light: "#ffffff", dark: "#060607" } },
  { id: "violeta", label: "Violeta", colors: { primary: "#7c3aed", secondary: "#a855f7", accent: "#f0abfc", bg: "#0a0712", surface: "#15101f", text: "#f5f3ff", muted: "#a8a0c2", light: "#ffffff", dark: "#05030a" } },
  { id: "oceano", label: "Océano", colors: { primary: "#0ea5e9", secondary: "#38bdf8", accent: "#22d3ee", bg: "#06121b", surface: "#0c1f2e", text: "#ecf8ff", muted: "#8fb0c4", light: "#ffffff", dark: "#030a10" } },
  { id: "esmeralda", label: "Esmeralda", colors: { primary: "#10b981", secondary: "#34d399", accent: "#fbbf24", bg: "#07120e", surface: "#0e1f18", text: "#ecfdf5", muted: "#8db3a2", light: "#ffffff", dark: "#030a07" } },
  { id: "claro", label: "Claro minimal", colors: { primary: "#111827", secondary: "#374151", accent: "#2563eb", bg: "#ffffff", surface: "#f4f4f5", text: "#111827", muted: "#6b7280", light: "#ffffff", dark: "#0b0b0d" } },
  { id: "calido", label: "Cálido", colors: { primary: "#c2410c", secondary: "#ea580c", accent: "#b45309", bg: "#fdf8f3", surface: "#f6ece1", text: "#2a1a10", muted: "#7b6552", light: "#ffffff", dark: "#1f130b" } },
  { id: "rosa", label: "Rosa editorial", colors: { primary: "#be185d", secondary: "#ec4899", accent: "#f59e0b", bg: "#fff7fa", surface: "#fdeaf1", text: "#2b0a18", muted: "#7c5767", light: "#ffffff", dark: "#1a0610" } },
  { id: "oro", label: "Oro y negro", colors: { primary: "#c9a35a", secondary: "#e2c07c", accent: "#b3261e", bg: "#0a0a0a", surface: "#151515", text: "#f6f1e6", muted: "#a39b88", light: "#ffffff", dark: "#050505" } },
];

export const COLOR_NAMES: Record<string, string> = {
  primary: "Primario", secondary: "Secundario", accent: "Acento", bg: "Fondo", surface: "Superficie", text: "Texto", muted: "Texto suave", light: "Claro", dark: "Oscuro",
};
