/* =========================================================
   ICARUS — CONFIGURACIÓN GLOBAL
   Edita este archivo para cambiar número, dominio y precios.
   No coloques aquí contraseñas, tokens ni API keys: todo lo
   que está en el frontend es público.
   ========================================================= */
(function () {
  'use strict';

  var CONFIG = {
    /* Marca */
    BRAND: 'ICARUS',
    TAGLINE: 'Desarrollo web de alto nivel',

    /* WhatsApp — formato internacional, solo dígitos (57 = Colombia) */
    WHATSAPP_NUMBER: '573166219962',

    /* Dominio público del sitio (con https y barra final).
       Déjalo vacío ('') para detectarlo automáticamente.
       Ejemplo: 'https://icarus.onrender.com/' */
    SITE_URL: '',

    /* Correo opcional (déjalo vacío si no quieres mostrarlo) */
    EMAIL: '',

    /* Redes (déjalas vacías para ocultarlas). Solo https. */
    SOCIAL: {
      instagram: '',
      facebook: '',
      tiktok: ''
    },

    /* PRECIOS
       SHOW_PRICES: false → todas las tarjetas muestran "A cotizar".
       Para mostrar un precio base, pon SHOW_PRICES: true y escribe
       el valor en PRICES con el id del servicio (ver data.js).
       Ejemplo: 'landing-page': 'Desde $650.000 COP'
       Los servicios sin precio seguirán mostrando "A cotizar". */
    SHOW_PRICES: false,
    PRICE_FALLBACK: 'A cotizar',
    PRICES: {
      'landing-page': '',
      'web-corporativa': '',
      'pagina-informativa': '',
      'portafolio-empresarial': '',
      'presentacion-servicios': '',
      'sitio-institucional': '',
      'tienda-virtual': '',
      'catalogo-digital': '',
      'sistema-pedidos': '',
      'carrito-compras': '',
      'gestion-productos': '',
      'plataforma-ventas': '',
      'sistema-base-datos': '',
      'panel-administrativo': '',
      'usuarios-autenticacion': '',
      'gestion-inventarios': '',
      'sistema-reservas': '',
      'plataforma-personalizada': '',
      'software-personalizado': '',
      'herramientas-web': '',
      'automatizacion-procesos': '',
      'dashboards': '',
      'aplicaciones-web': '',
      'integraciones-api': ''
    },

    /* Planes de hosting/dominio — textos configurables */
    HOSTING: {
      withoutLabel: 'Sin hosting ni dominio',
      withLabel: 'Con hosting y dominio',
      note: 'Los costos de hosting, dominio y sus renovaciones varían según el proveedor y el plan, y se especifican en cada cotización.'
    }
  };

  window.ICARUS_CONFIG = Object.freeze(CONFIG);
})();
