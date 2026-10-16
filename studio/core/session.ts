/** Estado global ligero de la sesión del Studio (usuario, configuración del servidor, proyecto abierto). */
import type { ServerConfig, User } from "../lib/api";

export const session: { user: User | null; config: ServerConfig | null; projectId: string | null } = {
  user: null,
  config: null,
  projectId: null,
};
