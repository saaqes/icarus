/** Estado global ligero del Studio (configuración pública y proyecto abierto). Sin cuentas: todo es local al dispositivo. */
export interface PublicConfig {
  /** Número de WhatsApp de ICARUS (solo dígitos). Sale de la variable de entorno WHATSAPP_NUMBER al compilar. */
  whatsappNumber: string;
}

export const session: { config: PublicConfig; projectId: string | null } = {
  config: { whatsappNumber: "" },
  projectId: null,
};
