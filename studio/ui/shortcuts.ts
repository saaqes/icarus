/** Atajos de teclado del editor. Se ignoran mientras se escribe en un campo o se edita un texto. */
import { Editor } from "../core/editor";
import { Workspace } from "../canvas/workspace";
import { h, modal, toast } from "../lib/dom";

export const SHORTCUTS: [string, string][] = [
  ["Ctrl/Cmd + Z", "Deshacer"], ["Ctrl/Cmd + Shift + Z  ·  Ctrl + Y", "Rehacer"], ["Ctrl/Cmd + C / X / V", "Copiar, cortar y pegar"],
  ["Ctrl/Cmd + D", "Duplicar"], ["Supr · Retroceso", "Eliminar selección"], ["Esc", "Cancelar gesto / edición / selección"],
  ["Ctrl/Cmd + S", "Guardar ahora"], ["V", "Herramienta de selección"], ["H  ·  Espacio (mantener)", "Mover el lienzo"],
  ["Enter · doble clic", "Editar texto"], ["Flechas (Shift = 10 px)", "Mover elementos libres"], ["Ctrl/Cmd + G", "Agrupar"], ["Ctrl/Cmd + Shift + G", "Desagrupar"],
  ["[  ·  ]", "Bajar / subir capa"], ["Ctrl/Cmd + rueda · pellizco", "Zoom"], ["Ctrl/Cmd + 0", "Ajustar al área visible"], ["Ctrl/Cmd + + / −", "Acercar / alejar"],
  ["Shift + clic", "Añadir a la selección"], ["Alt (al arrastrar)", "Sin imanes"], ["?", "Mostrar esta ayuda"],
];

export function showShortcuts(): void {
  void modal({ title: "Atajos de teclado", wide: true, body: h("dl", { class: "sc-list" }, SHORTCUTS.flatMap(([k, d]) => [h("dt", null, h("kbd", null, k)), h("dd", null, d)])) });
}

export function attachShortcuts(ed: Editor, ws: () => Workspace | null, save: () => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    const t = (e.composedPath()[0] ?? e.target) as HTMLElement;
    const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    if (document.querySelector(".st-backdrop, .pv")) return;
    const k = e.key.toLowerCase();

    if (mod && k === "s") { e.preventDefault(); save(); return; }
    if (typing || ed.s.editingText) { if (k === "escape" && typing && t.closest?.(".pf, .ly, .in, .rs, .pg")) (t as HTMLElement).blur(); return; }

    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? ed.redo() : ed.undo(); return; }
    if (mod && k === "y") { e.preventDefault(); ed.redo(); return; }
    if (mod && k === "c") { if (ed.s.selection.length) { e.preventDefault(); if (ed.copy()) toast("Copiado", "info", 1000); } return; }
    if (mod && k === "x") { if (ed.s.selection.length) { e.preventDefault(); ed.cut(); } return; }
    if (mod && k === "v") { e.preventDefault(); ed.paste(); return; }
    if (mod && k === "d") { e.preventDefault(); ed.duplicateNodes(); return; }
    if (mod && k === "g") { e.preventDefault(); e.shiftKey ? ed.ungroup() : ed.group(); return; }
    if (mod && k === "a") { e.preventDefault(); const root = ed.doc.nodes[ed.rootId]; const target = ed.selected.length === 1 && ed.selected[0].parent ? ed.doc.nodes[ed.selected[0].parent!] : root; ed.select(target.children.filter((c) => !ed.doc.nodes[c].locked)); return; }
    if (mod && (k === "0")) { e.preventDefault(); ws()?.fit("width"); return; }
    if (mod && (k === "=" || k === "+")) { e.preventDefault(); ws()?.zoomBy(1.2); return; }
    if (mod && k === "-") { e.preventDefault(); ws()?.zoomBy(1 / 1.2); return; }
    if (mod) return;

    if (k === "escape") { if (!ws()?.cancelInteraction()) { if (ed.s.sheet) ed.store.set({ sheet: null }); else ed.clearSelection(); } return; }
    if (k === "delete" || k === "backspace") { if (ed.s.selection.length) { e.preventDefault(); ed.deleteNodes(); } return; }
    if (k === "v") { ed.setTool("select"); return; }
    if (k === "h") { ed.setTool("hand"); return; }
    if (k === "enter") { const n = ed.selected[0]; if (n && ed.selected.length === 1 && (n.type === "text" || n.type === "button")) { e.preventDefault(); ws()?.startEdit(n.id); } return; }
    if (k === "[") { ed.reorder("backward"); return; }
    if (k === "]") { ed.reorder("forward"); return; }
    if (k === "?" || (k === "/" && e.shiftKey)) { showShortcuts(); return; }
    if (k.startsWith("arrow")) {
      const step = e.shiftKey ? 10 : 1;
      const d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k] as [number, number];
      if (ed.s.selection.length && ed.topLevel(ed.s.selection).some((id) => ed.isFreeChild(id))) { e.preventDefault(); ed.nudge(d[0], d[1]); }
    }
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}
