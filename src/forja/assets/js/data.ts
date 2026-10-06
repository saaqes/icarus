/* =========================================================
   ICARUS — CATÁLOGO (categorías, servicios y demostraciones)
   Para agregar un servicio: copia un bloque de SERVICES,
   cambia el id (único, minúsculas y guiones) y asígnale una
   demo existente de DEMOS.
   ========================================================= */
(function () {
  'use strict';

  var CATEGORIES = [
    {
      id: 'empresas',
      letter: 'A',
      rune: 'ᚨ',
      name: 'Empresas y Negocios',
      short: 'Empresas',
      icon: 'temple',
      desc: 'Presencia digital sólida para marcas que quieren verse profesionales, generar confianza y conseguir clientes.'
    },
    {
      id: 'tiendas',
      letter: 'B',
      rune: 'ᛒ',
      name: 'Tiendas y Comercio',
      short: 'Tiendas',
      icon: 'amphora',
      desc: 'Vende en línea con catálogos, carritos y pedidos que convierten visitas en ventas reales.'
    },
    {
      id: 'sistemas',
      letter: 'C',
      rune: 'ᚲ',
      name: 'Sistemas y Plataformas',
      short: 'Sistemas',
      icon: 'shield',
      desc: 'Bases de datos, usuarios, inventarios y reservas: herramientas que organizan la operación de tu negocio.'
    },
    {
      id: 'software',
      letter: 'D',
      rune: 'ᛞ',
      name: 'Software y Automatización',
      short: 'Software',
      icon: 'forge',
      desc: 'Software a la medida, dashboards e integraciones que ahorran horas de trabajo cada semana.'
    }
  ];

  var DEMOS = [
    {
      id: 'landing-page',
      name: 'Landing Page — Café Altura',
      project: 'Landing Page Profesional',
      cat: 'empresas',
      path: 'demos/landing-page/',
      image: 'assets/img/demos/landing-page.webp',
      desc: 'Página de presentación para una marca de café de especialidad: secciones, testimonios, preguntas frecuentes y contacto directo.',
      backend: false
    },
    {
      id: 'tienda-virtual',
      name: 'Tienda Virtual — NOVA Store',
      project: 'Tienda Virtual',
      cat: 'tiendas',
      path: 'demos/tienda-virtual/',
      image: 'assets/img/demos/tienda-virtual.webp',
      desc: 'Tienda con catálogo, filtros, buscador, ficha de producto, carrito de compras y resumen de pedido.',
      backend: true,
      realNotes: ['Base de datos de productos, clientes y pedidos', 'Pasarela de pagos (por ejemplo Wompi, PayU o Mercado Pago) con validación en el servidor', 'Panel administrativo con inicio de sesión', 'Cálculo real de envíos y notificaciones por correo o WhatsApp']
    },
    {
      id: 'sistema-administrativo',
      name: 'Sistema Administrativo — Bodega+',
      project: 'Sistema con Base de Datos',
      cat: 'sistemas',
      path: 'demos/sistema-administrativo/',
      image: 'assets/img/demos/sistema-administrativo.webp',
      desc: 'Panel con inventario, clientes y usuarios: crear, editar, buscar y eliminar registros sobre una base de datos de prueba.',
      backend: true,
      realNotes: ['Servidor (API) y base de datos real (PostgreSQL, MySQL o similar)', 'Autenticación segura con contraseñas cifradas y sesiones', 'Permisos por rol validados en el servidor', 'Copias de seguridad y registro de actividad']
    },
    {
      id: 'dashboard',
      name: 'Dashboard — Pulso Analytics',
      project: 'Dashboard y Automatización',
      cat: 'software',
      path: 'demos/dashboard/',
      image: 'assets/img/demos/dashboard.webp',
      desc: 'Panel de métricas con indicadores, gráficas interactivas, pedidos recientes y automatizaciones activables.',
      backend: true,
      realNotes: ['Conexión a tus fuentes de datos reales (base de datos, hojas de cálculo, APIs)', 'Tareas programadas en el servidor para las automatizaciones', 'Acceso privado con usuarios', 'Credenciales de servicios externos protegidas en variables de entorno']
    },
    {
      id: 'portafolio',
      name: 'Portafolio — Estudio Bruma',
      project: 'Portafolio Empresarial',
      cat: 'empresas',
      path: 'demos/portafolio/',
      image: 'assets/img/demos/portafolio.webp',
      desc: 'Portafolio para un estudio de arquitectura con proyectos filtrables, vista detallada y página del equipo.',
      backend: false
    },
    {
      id: 'sistema-reservas',
      name: 'Sistema de Reservas — Termales Vertiente',
      project: 'Sistema de Reservas',
      cat: 'sistemas',
      path: 'demos/sistema-reservas/',
      image: 'assets/img/demos/sistema-reservas.webp',
      desc: 'Reservas en línea con calendario, horarios disponibles, confirmación con código y gestión de reservas.',
      backend: true,
      realNotes: ['Base de datos de reservas y disponibilidad compartida entre todos los clientes', 'Bloqueo de horarios para evitar reservas duplicadas', 'Confirmaciones y recordatorios por correo o WhatsApp', 'Pagos anticipados opcionales']
    }
  ];

  var SERVICES = [
    /* ---------------- A · EMPRESAS ---------------- */
    {
      id: 'landing-page', cat: 'empresas', demo: 'landing-page', level: 1,
      name: 'Landing Page',
      tag: 'Una página. Un objetivo. Más clientes.',
      desc: 'Una página diseñada para presentar tu negocio, promocionar un producto o conseguir clientes mediante una experiencia visual atractiva.',
      long: 'La landing page concentra todo el mensaje de tu negocio en una sola página pensada para convertir: cada sección lleva al visitante hacia una acción clara, como escribirte por WhatsApp, agendar una cita o comprar. Es la forma más rápida y efectiva de tener presencia profesional en internet o de lanzar una campaña.',
      features: ['Diseño personalizado', 'Adaptación a móviles y computadores', 'Secciones informativas', 'Botones de contacto', 'Integración con WhatsApp', 'Optimización básica para buscadores'],
      includes: ['Diseño visual a la medida de tu marca', 'Hasta 8 secciones (inicio, beneficios, servicios, testimonios, preguntas, contacto…)', 'Botón flotante de WhatsApp', 'Formulario de contacto', 'Animaciones suaves', 'Configuración de título, descripción e imagen para redes'],
      recommended: ['Emprendedores que inician', 'Lanzamientos de productos', 'Campañas publicitarias', 'Profesionales independientes']
    },
    {
      id: 'web-corporativa', cat: 'empresas', demo: 'landing-page', level: 2,
      name: 'Página Web Corporativa',
      tag: 'La sede digital de tu empresa.',
      desc: 'Sitio de varias páginas que presenta tu empresa, su historia, servicios y equipo con una imagen sólida y profesional.',
      long: 'Un sitio corporativo transmite seriedad y confianza a clientes, aliados e inversionistas. Organizamos la información de tu empresa en páginas independientes —inicio, nosotros, servicios, equipo y contacto— con una identidad visual coherente y una navegación clara.',
      features: ['Varias páginas navegables', 'Identidad visual corporativa', 'Sección de equipo y valores', 'Formularios de contacto', 'Integración con WhatsApp y redes', 'SEO básico por página'],
      includes: ['Entre 4 y 8 páginas', 'Menú responsive', 'Mapa de ubicación', 'Páginas legales (términos, privacidad)', 'Optimización de imágenes', 'Guía de actualización de contenidos'],
      recommended: ['Pymes y empresas consolidadas', 'Firmas de servicios profesionales', 'Empresas que buscan aliados o inversionistas']
    },
    {
      id: 'pagina-informativa', cat: 'empresas', demo: 'landing-page', level: 2,
      name: 'Página Informativa',
      tag: 'Toda tu información, clara y ordenada.',
      desc: 'Sitio pensado para comunicar: servicios, horarios, ubicación, preguntas frecuentes y novedades de tu negocio.',
      long: 'Ideal para negocios que necesitan que sus clientes encuentren rápido lo esencial: qué ofreces, dónde estás, cuándo atiendes y cómo contactarte. Puede incluir una sección de noticias o publicaciones para mantener la información actualizada.',
      features: ['Información organizada por secciones', 'Horarios y ubicación', 'Preguntas frecuentes', 'Sección de novedades', 'Contacto directo', 'Diseño responsive'],
      includes: ['Hasta 5 páginas o secciones', 'Mapa integrado', 'Bloque de preguntas frecuentes', 'Integración con WhatsApp', 'SEO básico'],
      recommended: ['Restaurantes y cafés', 'Consultorios y clínicas', 'Academias', 'Comercios locales']
    },
    {
      id: 'portafolio-empresarial', cat: 'empresas', demo: 'portafolio', level: 2,
      name: 'Portafolio Empresarial',
      tag: 'Que tu trabajo hable por ti.',
      desc: 'Galería profesional de proyectos con filtros, fichas detalladas y una presentación que vende tu experiencia.',
      long: 'Un portafolio bien diseñado convierte tus trabajos anteriores en tu mejor argumento de venta. Mostramos cada proyecto con imágenes, contexto, resultados y una llamada a la acción para que el visitante quiera trabajar contigo.',
      features: ['Galería de proyectos filtrable', 'Vista detallada de cada proyecto', 'Presentación del equipo', 'Diseño editorial', 'Contacto integrado', 'Carga optimizada de imágenes'],
      includes: ['Página de inicio editorial', 'Hasta 12 proyectos iniciales', 'Filtros por tipo de proyecto', 'Página de estudio/equipo', 'Formulario de contacto'],
      recommended: ['Estudios de arquitectura y diseño', 'Fotógrafos y creativos', 'Agencias', 'Constructoras']
    },
    {
      id: 'presentacion-servicios', cat: 'empresas', demo: 'landing-page', level: 1,
      name: 'Página de Presentación de Servicios',
      tag: 'Explica lo que haces y por qué elegirte.',
      desc: 'Página enfocada en mostrar tus servicios, procesos, beneficios y planes, con botones directos para solicitarlos.',
      long: 'Pensada para negocios que venden servicios: explicamos cada uno con claridad, mostramos el proceso de trabajo, los beneficios y las preguntas frecuentes, y facilitamos que el cliente pida su servicio con un solo clic.',
      features: ['Fichas de servicios', 'Proceso de trabajo paso a paso', 'Planes o paquetes', 'Testimonios', 'Solicitud por WhatsApp', 'Diseño responsive'],
      includes: ['Hasta 8 servicios presentados', 'Sección de proceso', 'Tabla de planes configurable', 'Botones de solicitud por servicio'],
      recommended: ['Consultores', 'Agencias', 'Talleres y técnicos', 'Profesionales de la salud y el bienestar']
    },
    {
      id: 'sitio-institucional', cat: 'empresas', demo: 'portafolio', level: 2,
      name: 'Sitio Web Institucional',
      tag: 'Presencia formal para organizaciones.',
      desc: 'Sitio para fundaciones, colegios, entidades y asociaciones con información institucional, noticias y documentos.',
      long: 'Un sitio institucional comunica la misión, la historia y las actividades de una organización. Incluye secciones para noticias, documentos descargables, equipo directivo y canales de atención, con un diseño sobrio y accesible.',
      features: ['Misión, visión e historia', 'Noticias y comunicados', 'Documentos descargables', 'Equipo directivo', 'Accesibilidad básica', 'Canales de atención'],
      includes: ['Entre 5 y 10 páginas', 'Sección de noticias', 'Repositorio de documentos', 'Formularios de contacto o PQRS'],
      recommended: ['Fundaciones y ONG', 'Colegios e instituciones educativas', 'Asociaciones y gremios', 'Entidades']
    },

    /* ---------------- B · TIENDAS ---------------- */
    {
      id: 'tienda-virtual', cat: 'tiendas', demo: 'tienda-virtual', level: 3,
      name: 'Tienda Virtual',
      tag: 'Tu negocio vendiendo las 24 horas.',
      desc: 'Tienda en línea con catálogo, carrito de compras, gestión de pedidos y opción de pagos en línea o por WhatsApp.',
      long: 'Una tienda virtual completa para vender tus productos en internet: catálogo con categorías y filtros, fichas de producto, carrito, proceso de compra y panel para administrar productos y pedidos. Puede integrarse con pasarelas de pago colombianas.',
      features: ['Catálogo con categorías y filtros', 'Carrito de compras', 'Proceso de compra', 'Pedidos por WhatsApp o pago en línea', 'Panel de administración', 'Diseño responsive'],
      includes: ['Carga inicial de productos', 'Buscador de productos', 'Gestión de inventario básico', 'Cálculo de envíos configurable', 'Integración con pasarela de pagos (según proveedor)'],
      recommended: ['Marcas de ropa y accesorios', 'Tiendas de barrio que quieren vender en línea', 'Emprendimientos de productos']
    },
    {
      id: 'catalogo-digital', cat: 'tiendas', demo: 'tienda-virtual', level: 2,
      name: 'Catálogo Digital',
      tag: 'Tus productos, siempre a la mano.',
      desc: 'Catálogo en línea con fotos, precios y categorías, donde el cliente elige y te escribe directamente para comprar.',
      long: 'Un catálogo digital reemplaza el PDF que envías por WhatsApp: siempre actualizado, fácil de compartir y con un botón para que el cliente te pida el producto que le interesa. Es el primer paso ideal antes de una tienda completa.',
      features: ['Productos con fotos y precios', 'Categorías y buscador', 'Pedido directo por WhatsApp', 'Enlace fácil de compartir', 'Actualización sencilla', 'Diseño responsive'],
      includes: ['Carga inicial de productos', 'Filtros por categoría', 'Botón de pedido por producto', 'Código QR del catálogo'],
      recommended: ['Vendedores por redes sociales', 'Distribuidores', 'Restaurantes (menú digital)', 'Emprendimientos']
    },
    {
      id: 'sistema-pedidos', cat: 'tiendas', demo: 'tienda-virtual', level: 3,
      name: 'Sistema de Pedidos',
      tag: 'Recibe pedidos ordenados, no mensajes sueltos.',
      desc: 'Plataforma para que tus clientes armen su pedido en línea y tú lo recibas organizado, con estados y seguimiento.',
      long: 'El cliente selecciona productos, cantidades y datos de entrega, y el pedido llega organizado a tu panel o a tu WhatsApp. Puedes cambiar el estado de cada pedido (recibido, en preparación, enviado) y llevar el historial.',
      features: ['Armado de pedidos en línea', 'Datos de entrega', 'Estados del pedido', 'Notificación por WhatsApp', 'Historial de pedidos', 'Panel de gestión'],
      includes: ['Formulario de pedido', 'Resumen automático', 'Panel con estados', 'Reporte básico de ventas'],
      recommended: ['Restaurantes y comidas rápidas', 'Panaderías y repostería', 'Distribuidoras', 'Domicilios']
    },
    {
      id: 'carrito-compras', cat: 'tiendas', demo: 'tienda-virtual', level: 2,
      name: 'Carrito de Compras',
      tag: 'Agrega ventas a tu sitio actual.',
      desc: 'Carrito de compras integrado a tu página existente, con cantidades, totales y envío del pedido.',
      long: 'Si ya tienes un sitio web, podemos integrarle un carrito de compras que calcule cantidades, totales y costos de envío, y que envíe el pedido por WhatsApp o lo conecte con un medio de pago.',
      features: ['Agregar y quitar productos', 'Cálculo de totales', 'Costos de envío', 'Cupones de descuento', 'Envío del pedido', 'Diseño responsive'],
      includes: ['Integración en tu sitio', 'Carrito persistente', 'Resumen del pedido', 'Configuración de envíos'],
      recommended: ['Sitios web existentes', 'Catálogos que quieren dar el siguiente paso']
    },
    {
      id: 'gestion-productos', cat: 'tiendas', demo: 'sistema-administrativo', level: 3,
      name: 'Gestión de Productos',
      tag: 'Administra tu catálogo sin depender de nadie.',
      desc: 'Panel para crear, editar y organizar productos, precios, categorías, imágenes y existencias.',
      long: 'Un panel de administración para que tú mismo actualices productos, precios, fotos y existencias sin tocar código. Incluye búsqueda, filtros y alertas de stock bajo.',
      features: ['Crear, editar y eliminar productos', 'Categorías', 'Control de existencias', 'Alertas de stock bajo', 'Búsqueda y filtros', 'Acceso con usuario'],
      includes: ['Panel administrativo', 'Base de datos', 'Carga de imágenes', 'Exportación de datos'],
      recommended: ['Tiendas con muchos productos', 'Comercios con cambios frecuentes de precios']
    },
    {
      id: 'plataforma-ventas', cat: 'tiendas', demo: 'tienda-virtual', level: 4,
      name: 'Plataforma de Ventas',
      tag: 'Comercio electrónico a gran escala.',
      desc: 'Plataforma completa de ventas con clientes registrados, pagos, inventario, reportes y promociones.',
      long: 'Para negocios que quieren crecer en línea: cuentas de clientes, historial de compras, promociones, pagos en línea, inventario conectado y reportes de ventas. Se diseña según el modelo de negocio.',
      features: ['Cuentas de clientes', 'Pagos en línea', 'Promociones y cupones', 'Inventario conectado', 'Reportes de ventas', 'Escalable'],
      includes: ['Análisis del modelo de negocio', 'Tienda + panel administrativo', 'Integración de pagos', 'Reportes'],
      recommended: ['Marcas en crecimiento', 'Distribuidores mayoristas', 'Negocios con varias líneas de producto']
    },

    /* ---------------- C · SISTEMAS ---------------- */
    {
      id: 'sistema-base-datos', cat: 'sistemas', demo: 'sistema-administrativo', level: 3,
      name: 'Sistema con Base de Datos',
      tag: 'Tu información, organizada y segura.',
      desc: 'Aplicación web que guarda, consulta y organiza la información de tu negocio: clientes, productos, registros y más.',
      long: 'Reemplaza hojas de cálculo y cuadernos por un sistema web con base de datos, donde la información se registra una sola vez, se consulta en segundos y está disponible desde cualquier dispositivo, con permisos por usuario.',
      features: ['Base de datos centralizada', 'Registro y consulta de información', 'Búsqueda y filtros', 'Usuarios con permisos', 'Reportes', 'Acceso desde cualquier dispositivo'],
      includes: ['Análisis de la información a gestionar', 'Diseño de la base de datos', 'Panel web', 'Copias de seguridad configurables'],
      recommended: ['Negocios que hoy usan Excel', 'Empresas de servicios', 'Instituciones']
    },
    {
      id: 'panel-administrativo', cat: 'sistemas', demo: 'sistema-administrativo', level: 3,
      name: 'Panel Administrativo',
      tag: 'El centro de control de tu operación.',
      desc: 'Panel privado para gestionar contenidos, usuarios, pedidos o cualquier información de tu plataforma.',
      long: 'Un panel administrativo te permite controlar tu sitio o sistema desde un solo lugar: contenidos, usuarios, registros y configuraciones, con una interfaz clara pensada para personas sin conocimientos técnicos.',
      features: ['Acceso privado', 'Gestión de registros', 'Tablas con búsqueda', 'Roles y permisos', 'Indicadores', 'Diseño responsive'],
      includes: ['Módulos según tu necesidad', 'Inicio de sesión', 'Registro de actividad'],
      recommended: ['Sitios que requieren actualización constante', 'Plataformas con varios administradores']
    },
    {
      id: 'usuarios-autenticacion', cat: 'sistemas', demo: 'sistema-administrativo', level: 3,
      name: 'Sistema de Usuarios y Autenticación',
      tag: 'Cada persona, con su acceso correcto.',
      desc: 'Registro, inicio de sesión, recuperación de contraseña y roles para que cada usuario vea solo lo que le corresponde.',
      long: 'Implementamos registro e inicio de sesión seguros, recuperación de contraseña, roles (administrador, empleado, cliente) y permisos, siguiendo buenas prácticas: contraseñas cifradas, sesiones seguras y validación en el servidor.',
      features: ['Registro e inicio de sesión', 'Recuperación de contraseña', 'Roles y permisos', 'Contraseñas cifradas', 'Sesiones seguras', 'Perfil de usuario'],
      includes: ['Backend de autenticación', 'Pantallas de acceso', 'Gestión de usuarios para administradores'],
      recommended: ['Plataformas con clientes registrados', 'Sistemas internos de empresas', 'Portales educativos']
    },
    {
      id: 'gestion-inventarios', cat: 'sistemas', demo: 'sistema-administrativo', level: 3,
      name: 'Gestión de Inventarios',
      tag: 'Sabe qué tienes, dónde y cuánto.',
      desc: 'Control de entradas, salidas y existencias con alertas, historial de movimientos y reportes.',
      long: 'Un sistema de inventarios web registra cada entrada y salida, calcula existencias en tiempo real, avisa cuando un producto está por agotarse y genera reportes para tomar mejores decisiones de compra.',
      features: ['Entradas y salidas', 'Existencias en tiempo real', 'Alertas de stock mínimo', 'Historial de movimientos', 'Reportes', 'Varios usuarios'],
      includes: ['Base de datos de productos', 'Módulo de movimientos', 'Reportes exportables'],
      recommended: ['Ferreterías y almacenes', 'Bodegas', 'Restaurantes', 'Distribuidoras']
    },
    {
      id: 'sistema-reservas', cat: 'sistemas', demo: 'sistema-reservas', level: 3,
      name: 'Sistema de Reservas',
      tag: 'Agenda llena, sin llamadas perdidas.',
      desc: 'Reservas en línea con calendario, horarios disponibles, confirmaciones y gestión de la agenda.',
      long: 'Tus clientes eligen servicio, fecha y hora disponibles y reciben una confirmación. Tú administras la agenda, bloqueas horarios y evitas reservas duplicadas. Puede incluir recordatorios y pagos anticipados.',
      features: ['Calendario de disponibilidad', 'Selección de horarios', 'Confirmación con código', 'Gestión de la agenda', 'Cancelaciones', 'Recordatorios (opcional)'],
      includes: ['Módulo de reservas para clientes', 'Panel de agenda', 'Configuración de horarios y servicios'],
      recommended: ['Barberías, spas y estética', 'Hoteles, glampings y termales', 'Consultorios', 'Canchas y espacios']
    },
    {
      id: 'plataforma-personalizada', cat: 'sistemas', demo: 'dashboard', level: 4,
      name: 'Plataforma Personalizada',
      tag: 'Construida exactamente para tu modelo.',
      desc: 'Plataforma web diseñada desde cero para un proceso o modelo de negocio específico.',
      long: 'Cuando ninguna herramienta existente se ajusta a tu operación, diseñamos una plataforma a la medida: analizamos tu proceso, definimos módulos, usuarios y reglas de negocio, y la construimos por etapas.',
      features: ['Análisis del proceso', 'Módulos a la medida', 'Usuarios y roles', 'Base de datos', 'Reportes', 'Desarrollo por etapas'],
      includes: ['Levantamiento de requerimientos', 'Prototipo navegable', 'Desarrollo y pruebas', 'Acompañamiento en el lanzamiento'],
      recommended: ['Empresas con procesos propios', 'Startups', 'Proyectos de innovación']
    },

    /* ---------------- D · SOFTWARE ---------------- */
    {
      id: 'software-personalizado', cat: 'software', demo: 'dashboard', level: 4,
      name: 'Software Personalizado',
      tag: 'La herramienta que tu empresa necesita.',
      desc: 'Software web a la medida para resolver un problema concreto de tu empresa.',
      long: 'Desarrollamos software web enfocado en tu necesidad real: desde una herramienta interna hasta un sistema completo, con arquitectura escalable, buenas prácticas de seguridad y documentación.',
      features: ['Desarrollo a la medida', 'Arquitectura escalable', 'Seguridad', 'Documentación', 'Pruebas', 'Soporte'],
      includes: ['Análisis y diseño', 'Prototipo', 'Desarrollo por entregas', 'Manual de uso'],
      recommended: ['Empresas con necesidades específicas', 'Áreas operativas y administrativas']
    },
    {
      id: 'herramientas-web', cat: 'software', demo: 'dashboard', level: 3,
      name: 'Herramientas Web',
      tag: 'Calculadoras, cotizadores y utilidades.',
      desc: 'Pequeñas aplicaciones web: cotizadores, calculadoras, generadores de documentos y utilidades internas.',
      long: 'Herramientas web puntuales que ahorran tiempo: cotizadores automáticos, calculadoras para clientes, generadores de documentos o formularios inteligentes que puedes integrar a tu sitio.',
      features: ['Cálculos automáticos', 'Formularios inteligentes', 'Generación de documentos', 'Integrable a tu sitio', 'Rápidas y ligeras', 'Responsive'],
      includes: ['Diseño de la herramienta', 'Desarrollo', 'Integración'],
      recommended: ['Negocios que cotizan a diario', 'Equipos con tareas repetitivas']
    },
    {
      id: 'automatizacion-procesos', cat: 'software', demo: 'dashboard', level: 3,
      name: 'Automatización de Procesos',
      tag: 'Que las tareas repetitivas se hagan solas.',
      desc: 'Automatizamos reportes, notificaciones, registros y flujos de trabajo para ahorrar horas cada semana.',
      long: 'Identificamos tareas repetitivas —copiar datos, enviar reportes, notificar clientes— y las automatizamos con scripts, integraciones y flujos programados, reduciendo errores y tiempo.',
      features: ['Reportes automáticos', 'Notificaciones', 'Sincronización de datos', 'Tareas programadas', 'Registro de ejecuciones', 'Menos errores'],
      includes: ['Diagnóstico de procesos', 'Implementación de automatizaciones', 'Monitoreo'],
      recommended: ['Empresas con procesos manuales', 'Equipos administrativos y comerciales']
    },
    {
      id: 'dashboards', cat: 'software', demo: 'dashboard', level: 3,
      name: 'Dashboards',
      tag: 'Tus datos, convertidos en decisiones.',
      desc: 'Paneles visuales con indicadores, gráficas y reportes para entender tu negocio de un vistazo.',
      long: 'Un dashboard reúne tus datos de ventas, clientes u operación en gráficas e indicadores claros, con filtros por fecha y categoría, para que tomes decisiones con información real.',
      features: ['Indicadores clave (KPI)', 'Gráficas interactivas', 'Filtros por fecha', 'Tablas de detalle', 'Exportación', 'Acceso privado'],
      includes: ['Definición de indicadores', 'Conexión a tus datos', 'Diseño del panel'],
      recommended: ['Gerentes y dueños de negocio', 'Equipos comerciales', 'Operaciones']
    },
    {
      id: 'aplicaciones-web', cat: 'software', demo: 'sistema-reservas', level: 4,
      name: 'Aplicaciones Web',
      tag: 'Experiencias de app, directo en el navegador.',
      desc: 'Aplicaciones web interactivas que funcionan como una app, sin necesidad de instalar nada.',
      long: 'Desarrollamos aplicaciones web rápidas e interactivas, instalables en el celular como app (PWA), con experiencia fluida, funcionamiento en cualquier dispositivo y actualizaciones inmediatas.',
      features: ['Interfaz tipo app', 'Instalable en el celular (PWA)', 'Funciona en cualquier dispositivo', 'Actualizaciones inmediatas', 'Interactiva', 'Rápida'],
      includes: ['Diseño UX/UI', 'Desarrollo frontend y backend', 'Publicación'],
      recommended: ['Startups', 'Servicios digitales', 'Comunidades y plataformas']
    },
    {
      id: 'integraciones-api', cat: 'software', demo: 'dashboard', level: 3,
      name: 'Integraciones mediante API',
      tag: 'Que tus herramientas hablen entre sí.',
      desc: 'Conectamos tu sitio o sistema con pasarelas de pago, mensajería, facturación, mapas y otros servicios.',
      long: 'Integramos servicios externos mediante sus APIs oficiales —pagos, facturación electrónica, mensajería, correo, mapas, hojas de cálculo— de forma segura, manteniendo las credenciales protegidas en el servidor.',
      features: ['Pasarelas de pago', 'Facturación electrónica', 'Mensajería y correo', 'Sincronización de datos', 'Credenciales protegidas', 'Monitoreo de errores'],
      includes: ['Análisis de la API', 'Desarrollo de la integración', 'Pruebas'],
      recommended: ['Tiendas en línea', 'Sistemas existentes', 'Empresas con varias herramientas']
    }
  ];

  /* Tabla comparativa */
  var COMPARISON = {
    columns: [
      { key: 'landing', name: 'Landing Page', service: 'landing-page' },
      { key: 'info', name: 'Página informativa', service: 'pagina-informativa' },
      { key: 'db', name: 'Web con base de datos', service: 'sistema-base-datos' },
      { key: 'soft', name: 'Sistema o software a medida', service: 'software-personalizado' }
    ],
    rows: [
      { label: 'Objetivo', values: ['Convertir visitas en contactos o ventas', 'Informar sobre tu negocio', 'Guardar y gestionar información', 'Resolver un proceso específico'] },
      { label: 'Páginas', values: ['1 página con secciones', 'Varias páginas', 'Páginas + panel privado', 'Módulos a la medida'] },
      { label: 'Contenido', values: ['Fijo', 'Fijo o editable', 'Dinámico (cambia con los datos)', 'Dinámico y con reglas de negocio'] },
      { label: 'Base de datos', values: ['No', 'Opcional', 'Sí', 'Sí'] },
      { label: 'Usuarios / inicio de sesión', values: ['No', 'No', 'Sí', 'Sí, con roles y permisos'] },
      { label: 'Panel de administración', values: ['No', 'Opcional', 'Sí', 'Sí'] },
      { label: 'Complejidad', values: [1, 2, 3, 4] },
      { label: 'Tiempo estimado', values: ['Corto', 'Corto a medio', 'Medio', 'Según alcance'] }
    ]
  };

  window.ICARUS_DATA = Object.freeze({
    categories: CATEGORIES,
    services: SERVICES,
    demos: DEMOS,
    comparison: COMPARISON
  });
})();
