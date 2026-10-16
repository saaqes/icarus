import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, blankDoc } from "../shared/templates";
import { validateDoc } from "../shared/model/validate";
import { buildSite } from "../shared/export/render";
import { checkAccessibility } from "../shared/export/a11y";
import { thumbnailSvg } from "../shared/thumb";
import { Tx, cloneSubtree, createEmptyDoc, produce, duplicatePage, descendants } from "../shared/model/doc";
import { effectiveLayout, nodeDecls, resolveStyle, sanitizeCssDecls } from "../shared/model/style";
import { makeNode } from "../shared/model/doc";

for (const t of TEMPLATES) {
  test(`plantilla «${t.name}»: documento válido sin pérdidas`, () => {
    const doc = t.build();
    const res = validateDoc(JSON.parse(JSON.stringify(doc)));
    assert.ok(res.ok, res.errors.join(","));
    assert.deepEqual(res.warnings, [], res.warnings.join("\n"));
    assert.equal(Object.keys(res.doc!.nodes).length, Object.keys(doc.nodes).length);
    // el saneado conserva estilos, animaciones y nombres, y es idempotente
    for (const id of Object.keys(doc.nodes)) {
      assert.deepEqual(res.doc!.nodes[id].s, doc.nodes[id].s, id);
      assert.deepEqual(res.doc!.nodes[id].anim, doc.nodes[id].anim, id);
      assert.deepEqual(res.doc!.nodes[id].hover, doc.nodes[id].hover, id);
      assert.deepEqual(res.doc!.nodes[id].children, doc.nodes[id].children, id);
      assert.equal(res.doc!.nodes[id].props.text, doc.nodes[id].props.text);
      assert.equal(res.doc!.nodes[id].props.src, doc.nodes[id].props.src);
    }
    assert.deepEqual(validateDoc(res.doc).doc, res.doc);
  });

  test(`plantilla «${t.name}»: exporta HTML/CSS responsive`, () => {
    const doc = t.build();
    const site = buildSite(doc, { mode: "export", projectName: t.name });
    assert.ok(site.pages.length >= 1);
    assert.match(site.pages[0].html, /<!doctype html>/);
    assert.match(site.css, /@media \(max-width:640px\)/);
    assert.ok(!/<script>[^<]/.test(site.pages[0].html), "sin scripts en línea");
    assert.ok(site.files.some((f) => f.path === "assets/styles.css"));
    assert.ok(!site.pages[0].html.includes("undefined"));
    const thumb = thumbnailSvg(doc);
    assert.match(thumb, /^<svg/);
    assert.ok(thumb.length < 60000);
  });
}

test("accesibilidad: detecta imágenes sin alt y botones sin texto", () => {
  const doc = blankDoc("X");
  const out = produce(doc, (tx) => {
    const root = doc.pages[0].rootId;
    tx.add(makeNode("image", { props: { src: "/forja/studio/assets/lib/aurora.svg", alt: "" } }), root);
    tx.add(makeNode("button", { props: { text: "" } }), root);
  });
  const codes = checkAccessibility(out).map((i) => i.code);
  assert.ok(codes.includes("img-alt"));
  assert.ok(codes.includes("button-name"));
});

test("Tx: copy-on-write conserva la identidad de los nodos no tocados", () => {
  const doc = createEmptyDoc("T");
  const root = doc.pages[0].rootId;
  const a = makeNode("text", { props: { text: "a" } });
  const b = makeNode("text", { props: { text: "b" } });
  const d1 = produce(doc, (tx) => { tx.add(a, root); tx.add(b, root); });
  const d2 = produce(d1, (tx) => { tx.node(a.id).props.text = "z"; });
  assert.notEqual(d2.nodes[a.id], d1.nodes[a.id]);
  assert.equal(d2.nodes[b.id], d1.nodes[b.id]);
  assert.equal(d1.nodes[a.id].props.text, "a");
});

test("Tx: mover, eliminar y clonar subárboles mantienen la coherencia", () => {
  const doc = TEMPLATES[0].build();
  const root = doc.pages[0].rootId;
  const sec = doc.nodes[root].children[1];
  const before = Object.keys(doc.nodes).length;
  const subtree = cloneSubtree(doc.nodes, sec);
  assert.equal(subtree.length, 1 + descendants(doc, sec).length);
  assert.ok(subtree.every((n) => !doc.nodes[n.id]));
  const d2 = produce(doc, (tx) => tx.addSubtree(subtree, root, 0));
  assert.equal(Object.keys(d2.nodes).length, before + subtree.length);
  const d3 = produce(d2, (tx) => tx.remove(subtree[0].id));
  assert.equal(Object.keys(d3.nodes).length, before);
  assert.ok(validateDoc(d3).ok);
  const d4 = duplicatePage(doc, doc.pages[0].id);
  assert.equal(d4.pages.length, doc.pages.length + 1);
  assert.ok(validateDoc(d4).ok && validateDoc(d4).warnings.length === 0);
});

test("responsive: una disposición libre en escritorio cae a pila en móvil", () => {
  const doc = TEMPLATES.find((t) => t.id === "creativa")!.build();
  const free = Object.values(doc.nodes).find((n) => n.type === "container" && n.s.base.layout === "free")!;
  assert.equal(effectiveLayout(free, "desktop"), "free");
  assert.equal(effectiveLayout(free, "mobile"), "stack");
  const child = doc.nodes[free.children[0]];
  assert.equal(nodeDecls(doc, child, "desktop").position, "absolute");
  assert.equal(nodeDecls(doc, child, "mobile").position, "relative");
  assert.ok(resolveStyle(child, "mobile").x !== undefined);
});

test("CSS personalizado: descarta url(), @import y llaves", () => {
  const css = sanitizeCssDecls("color: red; background: url(http://x/y); margin: 4px; }body{display:none; behavior: x; width:10px");
  assert.equal(css, "color:red;margin:4px;width:10px");
});

test("validación: rechaza javascript:, repara referencias rotas y recorta basura", () => {
  const doc = blankDoc("X");
  const raw: any = JSON.parse(JSON.stringify(doc));
  const root = raw.pages[0].rootId;
  raw.nodes.a_bad = { id: "a_bad", type: "button", name: "x", parent: root, children: [], props: { text: "ok", href: "javascript:alert(1)" }, s: { base: { w: 99999, color: "red;background:url(x)" } } };
  raw.nodes[root].children.push("a_bad", "ghost_id");
  raw.nodes.orphan = { id: "orphan", type: "text", name: "o", parent: null, children: [], props: {}, s: { base: {} } };
  raw.nodes.evil = { id: "evil", type: "script", name: "o", parent: root, children: [], props: {}, s: { base: {} } };
  const res = validateDoc(raw);
  assert.ok(res.ok);
  const d = res.doc!;
  assert.equal(d.nodes.a_bad.props.href, "");
  assert.equal(d.nodes.a_bad.s.base.w, 20000);
  assert.equal(d.nodes.a_bad.s.base.color, undefined);
  assert.ok(!d.nodes.orphan && !d.nodes.evil);
  assert.ok(!d.nodes[root].children.includes("ghost_id"));
  assert.equal(validateDoc({}).ok, false);
});
