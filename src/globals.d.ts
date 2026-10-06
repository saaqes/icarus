/* Tipos globales del sitio "forja" (icarus-web). Los scripts clásicos comparten estos objetos en window. */
interface IcarusApi {
  cfg: any;
  data: any;
  el(tag: string, attrs?: Record<string, any> | null, children?: Array<Node | string | null | false | undefined>): any;
  icon(name: string, size?: number | string): SVGSVGElement;
  waIcon(size?: number | string): SVGSVGElement;
  [key: string]: any;
}
interface Window {
  ICARUS_CONFIG: any;
  ICARUS_DATA: any;
  ICARUS: IcarusApi;
  ICARUS_DEMO: any;
}
