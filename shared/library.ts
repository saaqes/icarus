/** Biblioteca de imágenes incluida con ICARUS Studio (ilustraciones propias, libres de derechos). */
export const LIB_BASE = "/forja/studio/assets/lib/";

export interface LibImage { id: string; name: string; category: "fondos" | "tecnología" | "personas" | "productos" | "ilustraciones"; w: number; h: number }

export const LIBRARY: LibImage[] = [
  { id: "aurora", name: "Aurora", category: "fondos", w: 1600, h: 900 },
  { id: "ember", name: "Brasa", category: "fondos", w: 1600, h: 900 },
  { id: "midnight", name: "Medianoche", category: "fondos", w: 1600, h: 900 },
  { id: "ocean", name: "Océano", category: "fondos", w: 1600, h: 900 },
  { id: "forest", name: "Bosque", category: "fondos", w: 1600, h: 900 },
  { id: "sunrise", name: "Amanecer", category: "fondos", w: 1600, h: 900 },
  { id: "mono", name: "Monocromo", category: "fondos", w: 1600, h: 900 },
  { id: "gold", name: "Oro", category: "fondos", w: 1600, h: 900 },
  { id: "rose", name: "Rosa", category: "fondos", w: 1600, h: 900 },
  { id: "mesh", name: "Malla violeta", category: "fondos", w: 1600, h: 900 },
  { id: "grid", name: "Cuadrícula", category: "tecnología", w: 1600, h: 900 },
  { id: "circuit", name: "Circuito", category: "tecnología", w: 1600, h: 900 },
  { id: "waves", name: "Ondas", category: "tecnología", w: 1600, h: 900 },
  { id: "avatar-1", name: "Persona 1", category: "personas", w: 400, h: 400 },
  { id: "avatar-2", name: "Persona 2", category: "personas", w: 400, h: 400 },
  { id: "avatar-3", name: "Persona 3", category: "personas", w: 400, h: 400 },
  { id: "avatar-4", name: "Persona 4", category: "personas", w: 400, h: 400 },
  { id: "product-1", name: "Producto esfera", category: "productos", w: 800, h: 800 },
  { id: "product-2", name: "Producto cubo", category: "productos", w: 800, h: 800 },
  { id: "product-3", name: "Producto anillo", category: "productos", w: 800, h: 800 },
  { id: "product-4", name: "Producto cilindro", category: "productos", w: 800, h: 800 },
  { id: "workspace", name: "Espacio de trabajo", category: "ilustraciones", w: 1200, h: 800 },
  { id: "phone", name: "Móvil", category: "ilustraciones", w: 800, h: 1200 },
  { id: "browser", name: "Navegador", category: "ilustraciones", w: 1200, h: 800 },
  { id: "chart", name: "Gráfica", category: "ilustraciones", w: 1200, h: 800 },
  { id: "rocket", name: "Cohete", category: "ilustraciones", w: 800, h: 800 },
];

export function libSrc(id: string): string {
  return `${LIB_BASE}${id}.svg`;
}

/** Imágenes reales de las demostraciones de ICARUS (ya presentes en el sitio). */
export const SITE_IMAGES = [
  { id: "demo-portafolio", name: "Demo portafolio", src: "/forja/assets/img/demos/portafolio.webp" },
  { id: "demo-dashboard", name: "Demo dashboard", src: "/forja/assets/img/demos/dashboard.webp" },
  { id: "demo-landing", name: "Demo landing", src: "/forja/assets/img/demos/landing-page.webp" },
  { id: "demo-admin", name: "Demo sistema", src: "/forja/assets/img/demos/sistema-administrativo.webp" },
  { id: "demo-tienda", name: "Demo tienda", src: "/forja/assets/img/demos/tienda-virtual.webp" },
  { id: "demo-reservas", name: "Demo reservas", src: "/forja/assets/img/demos/sistema-reservas.webp" },
];

/** Rutas de imagen que el servidor puede empaquetar o servir sin autenticación. */
export const STATIC_IMAGE_PREFIXES = ["/forja/studio/assets/lib/", "/forja/assets/img/"];
