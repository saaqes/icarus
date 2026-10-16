/**
 * Catálogo de plantillas. Cada plantilla es una función que devuelve un documento real, con
 * identificadores nuevos en cada uso: se puede editar por completo (textos, imágenes, secciones,
 * colores, tipografías, animaciones y versiones para tableta y móvil).
 */
import { libSrc } from "../library";
import { anim, materialize, N, pad, Spec } from "../model/build";
import { DEFAULT_THEME, defaultSettings, uid } from "../model/doc";
import {
  contact, contactForm, cta, faq, features, footer, gallery, navBar, pricing, stats, testimonials,
} from "../model/presets";
import { Doc, Node, Page, Theme } from "../model/types";

export interface TemplateDef {
  id: string;
  name: string;
  /** Tipo de página al que mejor sirve (coincide con las categorías del asistente). */
  category: string;
  style: string;
  description: string;
  /** Colores representativos para la tarjeta. */
  swatch: string[];
  build: () => Doc;
}

interface PageSpec { id: string; name: string; slug: string; sections: Spec[]; seo?: { title?: string; description?: string } }

function makeDoc(siteName: string, theme: Theme, pages: PageSpec[], settings: Partial<Doc["settings"]> = {}): Doc {
  const nodes: Record<string, Node> = {};
  const outPages: Page[] = [];
  const bg = "$bg";
  for (const p of pages) {
    const rootSpec: Spec = {
      type: "root", name: p.name,
      s: { layout: "stack", gap: 0, bg, color: "$text", font: "$body", size: 16, lh: 1.6, align: "stretch" },
      children: p.sections,
    };
    const list = materialize(rootSpec);
    for (const n of list) nodes[n.id] = n;
    outPages.push({ id: p.id, name: p.name, slug: p.slug, rootId: list[0].id, seo: p.seo });
  }
  return {
    v: 1,
    pages: outPages,
    nodes,
    theme,
    savedColors: [],
    settings: { ...defaultSettings(siteName), homePageId: outPages[0].id, title: siteName, ...settings },
  };
}

const th = (colors: Partial<Theme["colors"]>, heading: string, body: string): Theme => ({
  colors: { ...DEFAULT_THEME.colors, ...colors } as Theme["colors"],
  fonts: { heading, body },
});

const sectionHead = (eyebrow: string, title: string, sub: string, center = true): Spec =>
  N.box({ name: "Encabezado", s: { gap: 12, align: center ? "center" : "start" } }, [
    N.eyebrow(eyebrow, center ? { s: { textAlign: "center" } } : {}),
    N.heading(title, 2, center ? { s: { textAlign: "center" } } : {}),
    ...(sub ? [N.para(sub, { s: { maxWidth: 560, ...(center ? { textAlign: "center" } : {}) } })] : []),
  ]);

/* ============ 1. Minimalista ============ */
function minimalista(): Doc {
  const home = uid("pg"), contactId = uid("pg");
  const link = (id: string) => `page:${id}`;
  return makeDoc("Lumen Studio", th({ primary: "#111827", secondary: "#374151", accent: "#2563eb", bg: "#ffffff", surface: "#f4f4f5", text: "#111827", muted: "#6b7280", light: "#ffffff", dark: "#0b0b0d" }, "Inter", "Inter"), [
    {
      id: home, name: "Inicio", slug: "index", seo: { title: "Lumen Studio — diseño sin ruido", description: "Estudio de diseño minimalista: identidad, web y empaque para marcas que valoran la claridad." },
      sections: [
        navBar("Lumen", [{ label: "Inicio", href: link(home) }, { label: "Servicios", href: "#servicios" }, { label: "Contacto", href: link(contactId) }]),
        N.section({ name: "Hero", s: { padding: pad(120, 24, 96, 24), gap: 28, maxWidth: 980 }, mobile: { padding: pad(64, 20, 56, 20) } }, [
          N.eyebrow("Estudio de diseño", { anim: anim("fade", { trigger: "load" }) }),
          N.heading("Menos ruido. Más marca.", 1, { s: { size: 84, weight: 800, ls: -2, lh: 1.02 }, tablet: { size: 60 }, mobile: { size: 44 }, anim: anim("slide-up", { trigger: "load", delay: 80 }) }),
          N.para("Creamos identidades y sitios web claros, útiles y bellos para negocios que prefieren decir una cosa bien dicha.", { s: { size: 20, maxWidth: 620 }, anim: anim("slide-up", { trigger: "load", delay: 180 }) }),
          N.row({ name: "Botones", s: { gap: 12, wrap: true }, anim: anim("slide-up", { trigger: "load", delay: 260 }) }, [
            N.button("Ver servicios", { props: { href: "#servicios" } }),
            N.button("Escríbenos", { variant: "outline", props: { href: link(contactId) } }),
          ]),
        ]),
        N.section({ name: "Imagen principal", s: { padding: pad(0, 24, 80, 24), maxWidth: 1160 }, mobile: { padding: pad(0, 16, 48, 16) } }, [
          N.image(libSrc("mono"), "Composición abstracta en tonos grises", { s: { radius: 24, h: "auto" }, props: { ratio: 2.2 }, anim: anim("scale") }),
        ]),
        { ...features(), name: "Servicios" },
        N.section({ name: "Sobre nosotros", s: { padding: pad(88, 24), bg: "$surface" }, mobile: { padding: pad(56, 20) } }, [
          N.row({ s: { gap: 64, align: "center" }, tablet: { layout: "stack", gap: 32 } }, [
            N.image(libSrc("workspace"), "Espacio de trabajo del estudio", { s: { w: "fill", h: "auto", radius: 20 }, props: { ratio: 1.5 } }),
            N.box({ s: { w: "fill", gap: 16 } }, [
              N.eyebrow("Sobre nosotros"),
              N.heading("Un equipo pequeño con ideas grandes", 2),
              N.para("Trabajamos con pocos clientes a la vez para dedicarles el tiempo que merecen. Cada proyecto empieza escuchando y termina con un resultado que se entiende de un vistazo."),
              N.button("Conoce el proceso", { variant: "ghost", props: { href: "#" }, s: { padding: pad(0) } }),
            ]),
          ]),
        ]),
        stats(),
        { ...testimonials(), name: "Testimonios" },
        { ...cta(), name: "Contacto breve" },
        footer("Lumen"),
      ],
    },
    {
      id: contactId, name: "Contacto", slug: "contacto", seo: { title: "Contacto — Lumen Studio", description: "Cuéntanos tu proyecto." },
      sections: [
        navBar("Lumen", [{ label: "Inicio", href: link(home) }, { label: "Servicios", href: link(home) }, { label: "Contacto", href: link(contactId) }]),
        { ...contact(), name: "Contacto" },
        footer("Lumen"),
      ],
    },
  ]);
}

/* ============ 2. Corporativa ============ */
function corporativa(): Doc {
  const home = uid("pg"), services = uid("pg"), contactId = uid("pg");
  const nav = () => navBar("Andina Consultores", [{ label: "Inicio", href: `page:${home}` }, { label: "Servicios", href: `page:${services}` }, { label: "Contacto", href: `page:${contactId}` }]);
  const theme = th({ primary: "#1d4ed8", secondary: "#3b82f6", accent: "#f59e0b", bg: "#f8fafc", surface: "#ffffff", text: "#0f172a", muted: "#475569", light: "#ffffff", dark: "#0b1220" }, "Montserrat", "Lora");
  const card = (ic: string, t: string, d: string) => N.card({ name: t, s: { bg: "$surface", border: { w: 1, color: "#e2e8f0", style: "solid" } } }, [N.icon(ic, { size: 30 }), N.heading(t, 3), N.para(d, { s: { size: 15 } })]);
  return makeDoc("Andina Consultores", theme, [
    {
      id: home, name: "Inicio", slug: "index", seo: { title: "Andina Consultores — estrategia que se ejecuta", description: "Consultoría empresarial en estrategia, finanzas y operaciones para empresas en crecimiento." },
      sections: [
        nav(),
        N.section({
          name: "Hero", s: { padding: pad(130, 24, 120, 24), gap: 22, bg: "$dark", bgImage: { src: libSrc("ocean"), fit: "cover", pos: "center", overlay: "rgba(11,18,32,0.72)" } }, mobile: { padding: pad(72, 20) },
        }, [
          N.eyebrow("Consultoría empresarial", { s: { color: "$accent" } }),
          N.heading("Estrategia que se convierte en resultados", 1, { s: { color: "$light", maxWidth: 780, size: 60 }, anim: anim("slide-up", { trigger: "load" }) }),
          N.para("Acompañamos a las empresas medianas en la definición, ejecución y medición de su crecimiento.", { s: { color: "rgba(255,255,255,0.82)", maxWidth: 580, size: 19 } }),
          N.row({ s: { gap: 12, wrap: true } }, [N.button("Agenda una reunión", { props: { href: `page:${contactId}` }, s: { bg: "$accent", color: "$dark" }, hover: { bg: "$light" } }), N.button("Nuestros servicios", { variant: "outline", props: { href: `page:${services}` }, s: { color: "$light", border: { w: 1, color: "rgba(255,255,255,0.5)", style: "solid" } } })]),
        ]),
        stats(),
        N.section({ name: "Servicios destacados", s: { padding: pad(88, 24), gap: 44 }, mobile: { padding: pad(56, 20) } }, [
          sectionHead("Qué hacemos", "Un socio para cada etapa", "Equipos multidisciplinarios con experiencia en sectores regulados y de consumo."),
          N.grid({ s: { columns: 3, gap: 24 }, tablet: { columns: 2 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) }, [
            card("chart", "Estrategia", "Diagnóstico, plan de crecimiento y tablero de seguimiento."),
            card("briefcase", "Finanzas", "Presupuestos, flujo de caja y evaluación de inversiones."),
            card("settings", "Operaciones", "Procesos más simples, medibles y con responsables claros."),
          ]),
        ]),
        { ...testimonials(), name: "Clientes" },
        { ...cta(), name: "Contacto" },
        footer("Andina Consultores"),
      ],
    },
    {
      id: services, name: "Servicios", slug: "servicios", seo: { title: "Servicios — Andina Consultores" },
      sections: [
        nav(),
        N.section({ name: "Encabezado", s: { padding: pad(96, 24, 40, 24) }, mobile: { padding: pad(56, 20, 24, 20) } }, [N.eyebrow("Servicios"), N.heading("Soluciones a la medida de tu empresa", 1, { s: { size: 50 } })]),
        N.section({ name: "Detalle", s: { padding: pad(24, 24, 88, 24), gap: 20 } }, [
          ...[["chart", "Estrategia y planeación", "Definimos objetivos, indicadores y hoja de ruta a 12 y 36 meses."], ["briefcase", "Finanzas corporativas", "Modelos financieros, valoración y búsqueda de capital."], ["users", "Gestión del talento", "Estructura organizacional, compensación y cultura."], ["settings", "Mejora de procesos", "Mapeo, automatización y control de calidad."]].map(([ic, t, d]) =>
            N.card({ name: t, s: { bg: "$surface", border: { w: 1, color: "#e2e8f0", style: "solid" } } }, [N.row({ s: { gap: 18, align: "start" }, mobile: { layout: "stack" } }, [N.icon(ic, { size: 34 }), N.box({ s: { gap: 6 } }, [N.heading(t, 3), N.para(d, { s: { size: 15 } })])])])),
        ]),
        faq(),
        footer("Andina Consultores"),
      ],
    },
    { id: contactId, name: "Contacto", slug: "contacto", sections: [nav(), contact(), footer("Andina Consultores")] },
  ]);
}

/* ============ 3. Tecnológica ============ */
function tecnologica(): Doc {
  const theme = th({ primary: "#7c3aed", secondary: "#22d3ee", accent: "#a855f7", bg: "#07060d", surface: "#12101c", text: "#f5f3ff", muted: "#a8a0c2", light: "#ffffff", dark: "#030208" }, "Space Grotesk", "Inter");
  const feat = (ic: string, t: string, d: string) => N.card({ name: t, s: { bg: "$surface", border: { w: 1, color: "rgba(124,58,237,0.28)", style: "solid" } }, hover: { border: { w: 1, color: "$secondary", style: "solid" } } }, [N.icon(ic, { size: 28, s: { color: "$secondary" } }), N.heading(t, 3), N.para(d, { s: { size: 15 } })]);
  return makeDoc("Nexo AI", theme, [{
    id: uid("pg"), name: "Inicio", slug: "index", seo: { title: "Nexo — automatiza tu flujo de trabajo con IA", description: "Plataforma de automatización con inteligencia artificial para equipos modernos." },
    sections: [
      navBar("nexo", [{ label: "Producto", href: "#producto" }, { label: "Precios", href: "#precios" }, { label: "FAQ", href: "#faq" }]),
      N.section({
        name: "Hero", s: { padding: pad(120, 24, 100, 24), align: "center", gap: 24, bgImage: { src: libSrc("mesh"), fit: "cover", pos: "center top", overlay: "rgba(7,6,13,0.45)" } }, mobile: { padding: pad(72, 20, 64, 20) },
      }, [
        N.row({ name: "Insignia", s: { padding: pad(6, 14), radius: 999, bg: "rgba(124,58,237,0.18)", border: { w: 1, color: "rgba(168,85,247,0.5)", style: "solid" }, gap: 8, alignSelf: "center" }, anim: anim("fade", { trigger: "load" }) }, [N.icon("sparkles", { size: 16, s: { color: "$secondary" } }), N.text("Nuevo: agentes que trabajan por ti", { s: { size: 13, color: "$text", weight: 600 } })]),
        N.heading("Automatiza lo repetitivo. Enfócate en lo importante.", 1, { s: { textAlign: "center", maxWidth: 880, size: 64, ls: -1.5, bg: null }, anim: anim("slide-up", { trigger: "load", delay: 80 }) }),
        N.para("Conecta tus herramientas, define reglas en lenguaje natural y deja que Nexo ejecute el trabajo de rutina las 24 horas.", { s: { textAlign: "center", maxWidth: 620, size: 19 }, anim: anim("slide-up", { trigger: "load", delay: 160 }) }),
        N.row({ name: "Botones", s: { gap: 14, justify: "center", wrap: true }, anim: anim("slide-up", { trigger: "load", delay: 240 }) }, [N.button("Probar gratis", { s: { padding: pad(16, 32), size: 16, shadow: [{ x: 0, y: 12, blur: 40, spread: -8, color: "rgba(124,58,237,0.7)" }] } }), N.button("Ver demo", { variant: "outline", s: { padding: pad(16, 32), size: 16 } })]),
        N.image(libSrc("browser"), "Panel de la aplicación Nexo", { s: { maxWidth: 980, radius: 20, h: "auto", border: { w: 1, color: "rgba(255,255,255,0.12)", style: "solid" }, shadow: [{ x: 0, y: 50, blur: 100, spread: -30, color: "rgba(124,58,237,0.6)" }] }, props: { ratio: 1.6 }, anim: anim("scale", { trigger: "load", delay: 340 }) }),
      ]),
      N.section({ name: "Producto", attrs: { elId: "producto" }, s: { padding: pad(96, 24), gap: 48 }, mobile: { padding: pad(56, 20) } }, [
        sectionHead("Producto", "Todo conectado, todo bajo control", "Integraciones nativas con las herramientas que ya usas."),
        N.grid({ s: { columns: 3, gap: 20 }, tablet: { columns: 2 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) }, [
          feat("zap", "Flujos en segundos", "Crea automatizaciones con un par de frases, sin código."),
          feat("shield", "Seguridad primero", "Cifrado de extremo a extremo y control de permisos."),
          feat("chart", "Métricas en vivo", "Mide el ahorro de tiempo y el rendimiento de cada flujo."),
          feat("globe", "+200 integraciones", "Correo, calendario, CRM, hojas de cálculo y más."),
          feat("users", "Trabajo en equipo", "Comparte flujos, comenta y aprueba cambios."),
          feat("code", "API abierta", "Extiende Nexo con tu propia lógica cuando lo necesites."),
        ]),
      ]),
      stats(),
      { ...pricing(), name: "Precios", props: {}, attrs: { elId: "precios" } },
      { ...testimonials(), name: "Testimonios" },
      { ...faq(), attrs: { elId: "faq" } },
      cta(),
      footer("nexo"),
    ],
  }]);
}

/* ============ 4. Elegante ============ */
function elegante(): Doc {
  const theme = th({ primary: "#c9a35a", secondary: "#e2c07c", accent: "#b3261e", bg: "#0a0a0a", surface: "#141414", text: "#f6f1e6", muted: "#a39b88", light: "#ffffff", dark: "#050505" }, "Cormorant Garamond", "Manrope");
  return makeDoc("Maison Aurea", theme, [{
    id: uid("pg"), name: "Inicio", slug: "index", seo: { title: "Maison Aurea — joyería de autor", description: "Piezas únicas hechas a mano en oro y plata." },
    sections: [
      navBar("MAISON AUREA", [{ label: "Colección", href: "#coleccion" }, { label: "Atelier", href: "#atelier" }, { label: "Contacto", href: "#contacto" }]),
      N.section({ name: "Hero", s: { padding: pad(150, 24, 140, 24), align: "center", gap: 26, bg: "$bg", bgImage: { src: libSrc("gold"), fit: "cover", pos: "center", overlay: "rgba(10,10,10,0.6)" } }, mobile: { padding: pad(90, 20, 80, 20) } }, [
        N.eyebrow("Joyería de autor · desde 1998", { s: { textAlign: "center", ls: 5 } }),
        N.heading("El oro cuenta historias", 1, { s: { textAlign: "center", size: 92, weight: 500, lh: 1, maxWidth: 860 }, tablet: { size: 64 }, mobile: { size: 46 }, anim: anim("fade", { trigger: "load", duration: 1400 }) }),
        N.para("Cada pieza nace en nuestro taller, forjada a mano por maestros joyeros.", { s: { textAlign: "center", maxWidth: 520, size: 20, color: "$text" } }),
        N.button("Descubrir la colección", { props: { href: "#coleccion" }, s: { padding: pad(16, 36), radius: 0, ls: 2, transform: "uppercase", size: 13, alignSelf: "center", bg: null, color: "$primary", border: { w: 1, color: "$primary", style: "solid" } }, hover: { bg: "$primary", color: "$dark" } }),
      ]),
      N.section({ name: "Colección", attrs: { elId: "coleccion" }, s: { padding: pad(96, 24), gap: 48 }, mobile: { padding: pad(56, 20) } }, [
        sectionHead("La colección", "Piezas que perduran", ""),
        N.grid({ s: { columns: 4, gap: 24 }, tablet: { columns: 2 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) },
          [["product-3", "Anillo Sol", "$2.400.000"], ["product-1", "Perla Luna", "$1.850.000"], ["product-4", "Brazalete Ámbar", "$3.100.000"], ["product-2", "Dije Cubo", "$980.000"]].map(([im, nm, pr]) =>
            N.box({ name: nm, s: { gap: 10 } }, [
              N.image(libSrc(im), nm, { s: { radius: 0, h: "auto", w: "fill" }, props: { ratio: 1 } }),
              N.text(nm, { s: { font: "$heading", size: 24, weight: 500, color: "$text" } }),
              N.text(pr, { s: { size: 15, color: "$primary" } }),
            ]))),
      ]),
      N.section({ name: "Atelier", attrs: { elId: "atelier" }, s: { padding: pad(96, 24), bg: "$surface" }, mobile: { padding: pad(56, 20) } }, [
        N.row({ s: { gap: 72, align: "center" }, tablet: { layout: "stack", gap: 32 } }, [
          N.box({ s: { w: "fill", gap: 18 } }, [N.eyebrow("El atelier"), N.heading("Hecho a mano, pieza por pieza", 2, { s: { weight: 500 } }), N.para("Seleccionamos metales y piedras de origen responsable y los trabajamos con técnicas tradicionales. Cada joya se entrega con su certificado y una garantía de por vida.")]),
          N.image(libSrc("ember"), "Taller de joyería", { s: { w: "fill", h: "auto", radius: 0 }, props: { ratio: 1.3 } }),
        ]),
      ]),
      { ...testimonials(), name: "Clientes" },
      { ...contact(), name: "Contacto" },
      footer("MAISON AUREA"),
    ],
  }]);
}

/* ============ 5. Creativa (creador de contenido) ============ */
function creativa(): Doc {
  const theme = th({ primary: "#ff3d81", secondary: "#ffd23f", accent: "#3ddcff", bg: "#12082b", surface: "#1d1040", text: "#fff7ff", muted: "#c9b8e8", light: "#ffffff", dark: "#0a0418" }, "Unbounded", "DM Sans");
  return makeDoc("Mica Vlogs", theme, [{
    id: uid("pg"), name: "Inicio", slug: "index", seo: { title: "Mica — creadora de contenido", description: "Videos, colaboraciones y comunidad. Conoce a Mica y trabajemos juntos." },
    sections: [
      navBar("mica!", [{ label: "Contenido", href: "#contenido" }, { label: "Marcas", href: "#marcas" }, { label: "Contacto", href: "#contacto" }]),
      N.section({ name: "Hero libre", s: { padding: pad(0), maxWidth: 1200 }, }, [
        N.free({ name: "Composición libre", s: { minHeight: 560 }, tablet: { layout: "stack", padding: pad(48, 24), gap: 20 } }, [
          N.shape("ellipse", { name: "Círculo rosa", s: { x: 640, y: 40, w: 420, h: 420, bg: { kind: "linear", angle: 135, stops: [{ c: "$primary", p: 0 }, { c: "$secondary", p: 100 }] } }, anim: anim("scale", { trigger: "load" }) }),
          N.image(libSrc("avatar-4"), "Retrato de Mica", { name: "Retrato", s: { x: 700, y: 70, w: 320, h: 320, radius: 999 }, props: { ratio: 1 }, anim: anim("zoom-out", { trigger: "load", delay: 200 }) }),
          N.heading("Hola, soy Mica.", 1, { s: { x: 60, y: 110, w: 620, size: 72, weight: 800 }, tablet: { size: 52 }, mobile: { size: 40 }, anim: anim("slide-right", { trigger: "load" }) }),
          N.para("Creo videos sobre viajes, tecnología y vida creativa para una comunidad de 250 mil personas.", { s: { x: 60, y: 300, w: 520, size: 20, color: "$text" }, anim: anim("slide-up", { trigger: "load", delay: 160 }) }),
          N.button("Ver mi canal", { s: { x: 60, y: 420, w: 190, h: 54, padding: pad(14, 24), bg: "$secondary", color: "$dark" }, hover: { bg: "$accent" } }),
          N.button("Colaboremos", { variant: "outline", s: { x: 270, y: 420, w: 190, h: 54, padding: pad(14, 24) } }),
        ]),
      ]),
      stats(),
      N.section({ name: "Contenido", attrs: { elId: "contenido" }, s: { padding: pad(88, 24), gap: 40 }, mobile: { padding: pad(56, 20) } }, [
        sectionHead("Lo último", "Mis videos favoritos", "Historias, guías y aventuras cada semana."),
        N.grid({ s: { columns: 3, gap: 20 }, tablet: { columns: 2 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) },
          ["sunrise", "rose", "ocean"].map((im, i) => N.card({ name: `Video ${i + 1}`, s: { padding: pad(0), overflow: "hidden", gap: 0 } }, [
            N.image(libSrc(im), `Miniatura del video ${i + 1}`, { s: { radius: 0, h: "auto" }, props: { ratio: 1.78 } }),
            N.box({ s: { padding: pad(18), gap: 6 } }, [N.heading(["24 horas en Lisboa", "Mi setup creativo 2026", "Cómo edito mis videos"][i], 4), N.text(["Viajes · 12:40", "Tecnología · 8:15", "Tutorial · 15:02"][i], { s: { size: 13, color: "$muted" } })]),
          ]))),
      ]),
      N.section({ name: "Marcas", attrs: { elId: "marcas" }, s: { padding: pad(72, 24), bg: "$surface", align: "center", gap: 28 }, mobile: { padding: pad(48, 20) } }, [
        N.heading("Han confiado en mí", 3, { s: { textAlign: "center" } }),
        N.row({ s: { gap: 40, justify: "center", wrap: true } }, ["LUMA", "Norte", "pixel+", "Vértice", "Onda"].map((b) => N.text(b, { s: { font: "$heading", size: 26, weight: 800, color: "$muted" } }))),
      ]),
      { ...cta(), name: "Colaboraciones" },
      { ...contact(), name: "Contacto" },
      footer("mica!"),
    ],
  }]);
}

/* ============ 6. E-commerce (tienda visual) ============ */
function ecommerce(): Doc {
  const theme = th({ primary: "#0f766e", secondary: "#14b8a6", accent: "#f97316", bg: "#fafaf9", surface: "#ffffff", text: "#1c1917", muted: "#78716c", light: "#ffffff", dark: "#0c0a09" }, "Poppins", "Poppins");
  const products = [["product-1", "Esfera de cerámica", "$89.000", "Nuevo"], ["product-2", "Cubo organizador", "$64.000", ""], ["product-3", "Anillo decorativo", "$52.000", "-20%"], ["product-4", "Jarrón cilíndrico", "$118.000", ""], ["product-2", "Set de cubos", "$135.000", "Nuevo"], ["product-1", "Esfera mini", "$39.000", ""], ["product-4", "Jarrón alto", "$146.000", ""], ["product-3", "Anillo grande", "$76.000", "-15%"]];
  return makeDoc("Casa Norte", theme, [{
    id: uid("pg"), name: "Tienda", slug: "index", seo: { title: "Casa Norte — objetos para el hogar", description: "Decoración y objetos de diseño para tu casa. Envíos a todo el país." },
    sections: [
      N.section({ name: "Barra de anuncio", s: { padding: pad(8, 24), bg: "$primary", align: "center" } }, [N.text("Envío gratis en compras superiores a $150.000", { s: { size: 13, color: "$light", textAlign: "center", weight: 500 } })]),
      navBar("Casa Norte", [{ label: "Novedades", href: "#productos" }, { label: "Colecciones", href: "#colecciones" }, { label: "Ayuda", href: "#faq" }]),
      N.section({ name: "Hero", s: { padding: pad(40, 24), bg: "$bg" }, mobile: { padding: pad(16, 16) } }, [
        N.row({ name: "Banner", s: { bg: "$surface", radius: 28, gap: 0, align: "stretch", overflow: "hidden", border: { w: 1, color: "#e7e5e4", style: "solid" } }, tablet: { layout: "stack" } }, [
          N.box({ s: { w: "fill", padding: pad(64), gap: 18, justify: "center" }, mobile: { padding: pad(28) } }, [
            N.eyebrow("Colección primavera", { s: { color: "$accent" } }),
            N.heading("Objetos que hacen hogar", 1, { s: { size: 54 } }),
            N.para("Cerámica, textiles y piezas de diseño seleccionadas con cariño.", { s: { size: 18 } }),
            N.button("Comprar ahora", { props: { href: "#productos" }, s: { padding: pad(15, 30) } }),
          ]),
          N.image(libSrc("sunrise"), "Objetos decorativos sobre una mesa", { s: { w: "fill", radius: 0, h: 420 }, tablet: { h: 280 }, props: { ratio: 1.3 } }),
        ]),
      ]),
      N.section({ name: "Productos", attrs: { elId: "productos" }, s: { padding: pad(64, 24), gap: 32 }, mobile: { padding: pad(40, 16) } }, [
        N.row({ s: { justify: "between", align: "end", wrap: true } }, [N.heading("Novedades", 2), N.button("Ver todo", { variant: "ghost", s: { padding: pad(0) } })]),
        N.grid({ name: "Catálogo", s: { columns: 4, gap: 22 }, tablet: { columns: 3 }, mobile: { columns: 2, gap: 12 }, anim: anim("slide-up", { stagger: true }) }, products.map(([im, nm, pr, tag]) =>
          N.box({ name: nm, s: { gap: 10 } }, [
            N.image(libSrc(im), nm, { s: { radius: 16, h: "auto", bg: "$surface" }, props: { ratio: 1 } }),
            N.row({ s: { justify: "between", gap: 8, align: "start" } }, [N.text(nm, { s: { size: 15, weight: 500, color: "$text" } }), ...(tag ? [N.text(tag, { s: { size: 12, weight: 700, color: "$accent" } })] : [])]),
            N.text(pr, { s: { size: 15, weight: 700, color: "$primary" } }),
            N.button("Añadir al carrito", { variant: "outline", s: { padding: pad(10, 16), size: 13, alignSelf: "stretch" } }),
          ]))),
      ]),
      N.section({ name: "Colecciones", attrs: { elId: "colecciones" }, s: { padding: pad(24, 24, 72, 24), gap: 24 }, mobile: { padding: pad(16, 16, 40, 16) } }, [
        N.grid({ s: { columns: 3, gap: 20 }, tablet: { columns: 1 } }, [["forest", "Cerámica"], ["rose", "Textiles"], ["mono", "Iluminación"]].map(([im, t]) =>
          N.box({ name: t, s: { bgImage: { src: libSrc(im), fit: "cover", pos: "center", overlay: "rgba(0,0,0,0.35)" }, radius: 20, minHeight: 240, padding: pad(24), justify: "end" } }, [N.heading(t, 3, { s: { color: "$light" } }), N.text("Explorar →", { s: { color: "$light", size: 14, weight: 600 } })]))),
      ]),
      N.section({ name: "Beneficios", s: { padding: pad(40, 24), bg: "$surface" } }, [
        N.grid({ s: { columns: 3, gap: 24 }, mobile: { columns: 1 } }, [["truck", "Envío a todo el país", "Entrega en 2 a 5 días hábiles"], ["shield", "Pago seguro", "Tarjeta, PSE o contra entrega"], ["gift", "Empaque de regalo", "Sin costo adicional"]].map(([ic, t, d]) =>
          N.row({ s: { gap: 14, align: "start" } }, [N.icon(ic, { size: 30 }), N.box({ s: { gap: 2 } }, [N.text(t, { s: { weight: 700, color: "$text" } }), N.text(d, { s: { size: 14, color: "$muted" } })])]))),
      ]),
      { ...faq(), attrs: { elId: "faq" } },
      footer("Casa Norte"),
    ],
  }]);
}

/* ============ 7. Portafolio ============ */
function portafolio(): Doc {
  const theme = th({ primary: "#e11d48", secondary: "#fb7185", accent: "#0ea5e9", bg: "#fbf7f2", surface: "#f1eadf", text: "#1a1411", muted: "#6c5f55", light: "#ffffff", dark: "#120d0a" }, "Playfair Display", "Inter");
  const work = (im: string, t: string, c: string) => N.box({ name: t, s: { gap: 12 }, anim: anim("slide-up") }, [N.image(libSrc(im), t, { s: { radius: 6, h: "auto", w: "fill" }, props: { ratio: 1.4 } }), N.row({ s: { justify: "between" } }, [N.heading(t, 3, { s: { size: 22 } }), N.text(c, { s: { size: 13, color: "$muted", transform: "uppercase", ls: 1.5 } })])]);
  return makeDoc("Valeria Montes", theme, [{
    id: uid("pg"), name: "Portafolio", slug: "index", seo: { title: "Valeria Montes — diseñadora gráfica", description: "Portafolio de diseño gráfico, branding e ilustración." },
    sections: [
      navBar("Valeria Montes", [{ label: "Trabajos", href: "#trabajos" }, { label: "Sobre mí", href: "#sobre" }, { label: "Contacto", href: "#contacto" }]),
      N.section({ name: "Presentación", s: { padding: pad(120, 24, 72, 24), gap: 24 }, mobile: { padding: pad(64, 20, 40, 20) } }, [
        N.eyebrow("Diseñadora gráfica & ilustradora"),
        N.heading("Diseño con intención, color con carácter.", 1, { s: { size: 82, weight: 700, lh: 1.02, maxWidth: 960, ls: -1.5 }, tablet: { size: 60 }, mobile: { size: 42 }, anim: anim("slide-up", { trigger: "load" }) }),
        N.para("Ayudo a marcas y editoriales a contar su historia con imágenes memorables. Basada en Medellín, trabajo con clientes de toda Latinoamérica.", { s: { size: 20, maxWidth: 640 } }),
      ]),
      N.section({ name: "Trabajos", attrs: { elId: "trabajos" }, s: { padding: pad(24, 24, 88, 24), gap: 32 }, mobile: { padding: pad(16, 20, 56, 20) } }, [
        N.grid({ s: { columns: 2, gap: 32 }, mobile: { columns: 1 } }, [work("aurora", "Identidad Café Brasa", "Branding"), work("circuit", "App Pulso", "UI / Producto"), work("sunrise", "Libro «Aurora»", "Editorial"), work("mesh", "Campaña Onda", "Publicidad")]),
      ]),
      N.section({ name: "Sobre mí", attrs: { elId: "sobre" }, s: { padding: pad(88, 24), bg: "$surface" }, mobile: { padding: pad(56, 20) } }, [
        N.row({ s: { gap: 64, align: "center" }, tablet: { layout: "stack", gap: 28 } }, [
          N.image(libSrc("avatar-2"), "Retrato de Valeria", { s: { w: 360, h: 360, radius: 999 }, props: { ratio: 1 }, mobile: { w: 220, h: 220 } }),
          N.box({ s: { w: "fill", gap: 16 } }, [N.eyebrow("Sobre mí"), N.heading("Hola, soy Valeria", 2), N.para("Llevo diez años diseñando identidades, libros y productos digitales. Creo que el buen diseño se nota cuando hace la vida de las personas un poco más fácil y más bonita."), N.row({ s: { gap: 10, wrap: true } }, ["Branding", "Ilustración", "UI", "Editorial"].map((t) => N.text(t, { s: { padding: pad(6, 14), radius: 999, border: { w: 1, color: "$muted", style: "solid" }, size: 13, color: "$text" } })))]),
        ]),
      ]),
      { ...testimonials(), name: "Clientes" },
      { ...contact(), name: "Contacto" },
      footer("Valeria Montes"),
    ],
  }]);
}

/* ============ 8. Agencia digital ============ */
function agencia(): Doc {
  const theme = th({ primary: "#ff5a1f", secondary: "#ffb703", accent: "#8338ec", bg: "#0e0e10", surface: "#1a1a1e", text: "#f5f5f4", muted: "#a1a1aa", light: "#ffffff", dark: "#050506" }, "Syne", "DM Sans");
  return makeDoc("Pulso Agency", theme, [{
    id: uid("pg"), name: "Inicio", slug: "index", seo: { title: "Pulso — agencia de marketing digital", description: "Estrategia, contenido y performance para marcas que quieren crecer." },
    sections: [
      navBar("PULSO®", [{ label: "Servicios", href: "#servicios" }, { label: "Casos", href: "#casos" }, { label: "Contacto", href: "#contacto" }]),
      N.section({ name: "Hero", s: { padding: pad(110, 24, 90, 24), gap: 28 }, mobile: { padding: pad(64, 20, 56, 20) } }, [
        N.heading("Hacemos que tu marca se escuche.", 1, { s: { size: 104, weight: 800, lh: 0.98, ls: -3, maxWidth: 1000 }, tablet: { size: 72 }, mobile: { size: 46 }, anim: anim("slide-up", { trigger: "load", duration: 900 }) }),
        N.row({ s: { gap: 40, align: "end", justify: "between", wrap: true } }, [
          N.para("Agencia de marketing digital: estrategia, contenido, pauta y analítica en un solo equipo.", { s: { size: 20, maxWidth: 520, color: "$text" } }),
          N.button("Agenda una llamada", { s: { padding: pad(18, 34), size: 16, radius: 999 } }),
        ]),
      ]),
      N.section({ name: "Marquesina", s: { padding: pad(22, 24), bg: "$primary" } }, [N.row({ s: { gap: 36, justify: "between", wrap: true } }, ["SEO", "Social media", "Performance", "Contenido", "Branding"].map((t) => N.text(`✦ ${t}`, { s: { font: "$heading", size: 22, weight: 800, color: "$dark" }, mobile: { size: 16 } })))]),
      N.section({ name: "Servicios", attrs: { elId: "servicios" }, s: { padding: pad(96, 24), gap: 40 }, mobile: { padding: pad(56, 20) } }, [
        sectionHead("Servicios", "Todo lo que tu marca necesita", "", false),
        N.grid({ s: { columns: 2, gap: 20 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) }, [["chart", "Performance", "Campañas en Meta, Google y TikTok optimizadas por ROAS."], ["camera", "Contenido", "Producción de foto y video para redes con una línea editorial."], ["message", "Community", "Gestión de comunidad y atención en tiempo real."], ["sparkles", "Branding", "Estrategia de marca, naming e identidad visual."]].map(([ic, t, d]) =>
          N.card({ name: t, s: { padding: pad(32), border: { w: 1, color: "rgba(255,255,255,0.1)", style: "solid" } }, hover: { border: { w: 1, color: "$primary", style: "solid" } } }, [N.icon(ic, { size: 34 }), N.heading(t, 3, { s: { size: 28 } }), N.para(d, { s: { size: 16 } })]))),
      ]),
      stats(),
      N.section({ name: "Casos", attrs: { elId: "casos" }, s: { padding: pad(96, 24), gap: 36 }, mobile: { padding: pad(56, 20) } }, [
        sectionHead("Casos", "Resultados que se miden", "", false),
        N.grid({ s: { columns: 2, gap: 24 }, mobile: { columns: 1 } }, [["ember", "Café Brasa", "+240% en ventas online"], ["ocean", "Nauta Viajes", "3× más reservas directas"]].map(([im, t, r]) => N.box({ name: t, s: { gap: 12 } }, [N.image(libSrc(im), t, { s: { h: "auto", radius: 20 }, props: { ratio: 1.6 } }), N.heading(t, 3), N.text(r, { s: { color: "$primary", weight: 700 } })]))),
      ]),
      { ...testimonials(), name: "Clientes" },
      { ...contact(), name: "Contacto" },
      footer("PULSO®"),
    ],
  }]);
}

/* ============ 9. Landing de ventas (producto digital) ============ */
function ventas(): Doc {
  const theme = th({ primary: "#16a34a", secondary: "#22c55e", accent: "#eab308", bg: "#ffffff", surface: "#f0fdf4", text: "#052e16", muted: "#4b5d52", light: "#ffffff", dark: "#052e16" }, "Sora", "DM Sans");
  return makeDoc("Curso Impulsa", theme, [{
    id: uid("pg"), name: "Oferta", slug: "index", seo: { title: "Impulsa — curso de marketing para emprendedores", description: "Aprende a conseguir tus primeros 100 clientes con un método paso a paso." },
    sections: [
      N.section({ name: "Aviso", s: { padding: pad(10, 24), bg: "$dark", align: "center" } }, [N.text("🔥 Últimos 30 cupos con 40 % de descuento — termina esta semana", { s: { color: "$light", size: 14, textAlign: "center", weight: 600 } })]),
      N.section({ name: "Hero", s: { padding: pad(80, 24, 72, 24), bg: "$surface" }, mobile: { padding: pad(40, 20, 48, 20) } }, [
        N.row({ s: { gap: 56, align: "center" }, tablet: { layout: "stack", gap: 32 } }, [
          N.box({ s: { w: "fill", gap: 20 } }, [
            N.eyebrow("Curso en línea · 6 semanas"),
            N.heading("Consigue tus primeros 100 clientes sin gastar en publicidad", 1, { s: { size: 50, lh: 1.08 } }),
            N.para("Un método paso a paso, plantillas listas para usar y acompañamiento semanal en vivo.", { s: { size: 18 } }),
            N.row({ s: { gap: 10 } }, [N.icon("check", { size: 20 }), N.text("Acceso de por vida + comunidad privada", { s: { color: "$text", size: 15 } })]),
            N.row({ s: { gap: 10 } }, [N.icon("check", { size: 20 }), N.text("Garantía de devolución de 14 días", { s: { color: "$text", size: 15 } })]),
            N.row({ s: { gap: 14, wrap: true } }, [N.button("Quiero inscribirme", { s: { padding: pad(18, 34), size: 17, bg: "$primary" }, hover: { bg: "$dark" } }), N.text("Desde $29 USD", { s: { size: 14, color: "$muted" } })]),
          ]),
          N.image(libSrc("rocket"), "Cohete despegando", { s: { w: "fill", h: "auto", radius: 24 }, props: { ratio: 1 }, anim: anim("zoom-out", { trigger: "load" }) }),
        ]),
      ]),
      N.section({ name: "Problema y solución", s: { padding: pad(88, 24), gap: 36, align: "center" }, mobile: { padding: pad(56, 20) } }, [
        sectionHead("¿Te suena familiar?", "Publicas, esperas… y nadie compra", "Tener un buen producto no basta si nadie lo conoce. Impulsa te enseña a atraer clientes de forma constante."),
        N.grid({ s: { columns: 3, gap: 20 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) }, [["x", "Sin sistema", "Publicas cuando se te ocurre, sin una estrategia clara."], ["x", "Sin métricas", "No sabes qué funciona ni por qué."], ["check", "Con Impulsa", "Un plan semanal, medible y que cabe en tu agenda."]].map(([ic, t, d], i) =>
          N.card({ name: t, s: { bg: i === 2 ? "$surface" : "$bg", border: { w: i === 2 ? 2 : 1, color: i === 2 ? "$primary" : "#d4e0d8", style: "solid" } } }, [N.icon(ic, { size: 28, s: { color: i === 2 ? "$primary" : "$muted" } }), N.heading(t, 3), N.para(d, { s: { size: 15 } })]))),
      ]),
      { ...features(), name: "Qué incluye" },
      stats(),
      { ...testimonials(), name: "Resultados" },
      { ...pricing(), name: "Inscripción" },
      faq(),
      { ...cta(), name: "Cierre" },
      footer("Impulsa"),
    ],
  }]);
}

/* ============ 10. Editorial ============ */
function editorial(): Doc {
  const theme = th({ primary: "#9a3412", secondary: "#c2410c", accent: "#1d4ed8", bg: "#fffdf8", surface: "#f5efe3", text: "#1c1917", muted: "#78716c", light: "#ffffff", dark: "#1c1917" }, "Playfair Display", "Lora");
  const article = (im: string, cat: string, t: string, ex: string, big = false) => N.box({ name: t, s: { gap: 12 } }, [
    N.image(libSrc(im), t, { s: { radius: 0, h: "auto" }, props: { ratio: big ? 1.7 : 1.5 } }),
    N.text(cat, { s: { size: 12, weight: 700, color: "$primary", transform: "uppercase", ls: 2 } }),
    N.heading(t, big ? 2 : 3, { s: { weight: 700 } }),
    N.para(ex, { s: { size: 16 } }),
  ]);
  return makeDoc("La Gaceta", theme, [{
    id: uid("pg"), name: "Portada", slug: "index", seo: { title: "La Gaceta — revista de cultura y diseño", description: "Reportajes, entrevistas y ensayos sobre cultura, arquitectura y diseño." },
    sections: [
      N.section({ name: "Cabecera", props: { tag: "header" }, s: { padding: pad(28, 24, 18, 24), gap: 14, align: "center" } }, [
        N.text("LA GACETA", { s: { font: "$heading", size: 68, weight: 800, ls: 4, textAlign: "center", color: "$text" }, mobile: { size: 38 } }),
        N.divider({ s: { bg: "$text", opacity: 1, h: 2 } }),
        N.row({ props: { tag: "nav" }, s: { gap: 28, justify: "center", wrap: true } }, ["Cultura", "Arquitectura", "Diseño", "Entrevistas", "Ensayo"].map((t) => N.text(t, { props: { href: "#" }, s: { size: 13, weight: 700, transform: "uppercase", ls: 2, color: "$text" }, hover: { color: "$primary" } }))),
        N.divider({ s: { bg: "$text", opacity: 0.4 } }),
      ]),
      N.section({ name: "Portada principal", s: { padding: pad(32, 24, 56, 24) }, mobile: { padding: pad(16, 20, 40, 20) } }, [
        N.row({ s: { gap: 48, align: "start" }, tablet: { layout: "stack", gap: 28 } }, [
          N.box({ s: { w: "fill", gap: 14 }, anim: anim("fade", { trigger: "load" }) }, [N.image(libSrc("circuit"), "Fotografía de portada", { s: { radius: 0, h: "auto" }, props: { ratio: 1.55 } }), N.text("Reportaje de portada", { s: { size: 12, weight: 700, color: "$primary", transform: "uppercase", ls: 2 } }), N.heading("La ciudad que se reinventa bajo la lluvia", 1, { s: { size: 52, lh: 1.08 } }), N.para("Un recorrido por los barrios que están cambiando la forma de vivir, trabajar y soñar en la capital.", { s: { size: 18 } })]),
          N.box({ s: { w: 360, gap: 22, padding: pad(0, 0, 0, 28) }, tablet: { w: "fill", padding: pad(0) } }, [
            N.heading("Más leídos", 3, { s: { size: 20, transform: "uppercase", ls: 2 } }),
            ...["Diez casas que cambiaron la arquitectura", "Entrevista con la diseñadora del año", "El regreso de la tipografía de autor", "Cuando el museo sale a la calle"].map((t, i) => N.row({ s: { gap: 14, align: "start" } }, [N.text(String(i + 1), { s: { font: "$heading", size: 34, weight: 800, color: "$primary" } }), N.heading(t, 4, { s: { size: 17 } })])),
          ]),
        ]),
      ]),
      N.section({ name: "Artículos", s: { padding: pad(40, 24, 80, 24), gap: 28, bg: "$surface" }, mobile: { padding: pad(32, 20, 56, 20) } }, [
        N.heading("Últimas historias", 2),
        N.grid({ s: { columns: 3, gap: 32 }, tablet: { columns: 2 }, mobile: { columns: 1 }, anim: anim("slide-up", { stagger: true }) }, [
          article("rose", "Diseño", "El color como lenguaje de marca", "Cómo las paletas definen la memoria de un lugar."),
          article("forest", "Cultura", "Libros para leer despacio", "Siete novelas que piden tiempo y silencio."),
          article("midnight", "Ensayo", "Elogio de la noche", "Sobre las ciudades que no duermen y quienes las cuidan."),
        ]),
      ]),
      N.section({ name: "Boletín", s: { padding: pad(72, 24), align: "center", gap: 16, maxWidth: 720 }, mobile: { padding: pad(48, 20) } }, [
        N.heading("Recibe el boletín de los domingos", 2, { s: { textAlign: "center" } }),
        N.para("Una selección de lecturas, exposiciones y descubrimientos. Sin ruido, sin spam.", { s: { textAlign: "center" } }),
        N.form({ props: { mode: "mailto", to: "" }, s: { w: "fill", layout: "row", gap: 10, wrap: true } }, [N.field("Correo electrónico", { kind: "email", name: "correo", required: true, s: { w: "fill" } }), N.button("Suscribirme", { props: { submit: true, href: "" }, s: { alignSelf: "end" } })]),
      ]),
      footer("La Gaceta"),
    ],
  }]);
}

export const TEMPLATES: TemplateDef[] = [
  { id: "minimalista", name: "Minimalista", category: "Negocio o empresa", style: "Minimalista", description: "Aire, tipografía grande y una sola idea por pantalla. Dos páginas.", swatch: ["#ffffff", "#111827", "#2563eb"], build: minimalista },
  { id: "corporativa", name: "Corporativa", category: "Servicios profesionales", style: "Corporativo", description: "Consultoría con tres páginas: inicio, servicios y contacto.", swatch: ["#1d4ed8", "#f8fafc", "#f59e0b"], build: corporativa },
  { id: "tecnologica", name: "Tecnológica", category: "Producto digital", style: "Tecnológico", description: "Landing de software con degradados violeta, precios y preguntas frecuentes.", swatch: ["#7c3aed", "#07060d", "#22d3ee"], build: tecnologica },
  { id: "elegante", name: "Elegante", category: "Marca personal", style: "Elegante", description: "Negro y oro, serifas finas y mucho espacio. Ideal para marcas de lujo.", swatch: ["#c9a35a", "#0a0a0a", "#f6f1e6"], build: elegante },
  { id: "creativa", name: "Creativa", category: "Página para redes sociales", style: "Creativo", description: "Para creadores de contenido: composición libre, color intenso y videos.", swatch: ["#ff3d81", "#12082b", "#ffd23f"], build: creativa },
  { id: "ecommerce", name: "E-commerce", category: "Tienda visual", style: "Comercio", description: "Catálogo de productos en cuadrícula, colecciones y beneficios de compra.", swatch: ["#0f766e", "#fafaf9", "#f97316"], build: ecommerce },
  { id: "portafolio", name: "Portafolio", category: "Portafolio personal", style: "Portafolio", description: "Muestra tus trabajos, tu historia y tus clientes con serifas editoriales.", swatch: ["#e11d48", "#fbf7f2", "#0ea5e9"], build: portafolio },
  { id: "agencia", name: "Agencia digital", category: "Agencia de marketing", style: "Agencia", description: "Tipografía gigante, servicios, casos de éxito y llamada a la acción.", swatch: ["#ff5a1f", "#0e0e10", "#8338ec"], build: agencia },
  { id: "ventas", name: "Landing de ventas", category: "Landing page", style: "Ventas", description: "Estructura de conversión: oferta, problema, beneficios, precios y garantía.", swatch: ["#16a34a", "#f0fdf4", "#eab308"], build: ventas },
  { id: "editorial", name: "Editorial", category: "Otro tipo de página", style: "Editorial", description: "Portada de revista con artículos, más leídos y boletín.", swatch: ["#9a3412", "#fffdf8", "#1d4ed8"], build: editorial },
];

export function templateById(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Documento en blanco con una sección de ejemplo. */
export function blankDoc(siteName: string): Doc {
  return makeDoc(siteName || "Mi sitio", th({}, "Manrope", "Manrope"), [
    {
      id: uid("pg"), name: "Inicio", slug: "index", sections: [
        N.section({ name: "Sección", s: { padding: pad(96, 24), align: "center", gap: 16 } }, [
          N.heading(siteName || "Tu nuevo sitio web", 1, { s: { textAlign: "center" } }),
          N.para("Empieza arrastrando elementos desde el panel izquierdo o inserta una sección prediseñada.", { s: { textAlign: "center", maxWidth: 520 } }),
        ]),
      ],
    },
  ], { title: siteName });
}

export { contactForm };
