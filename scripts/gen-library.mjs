// Genera las ilustraciones SVG de la biblioteca de ICARUS Studio (propias, libres de derechos).
// Uso: node scripts/gen-library.mjs   → escribe en src/forja/studio/assets/lib/
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../src/forja/studio/assets/lib");
mkdirSync(OUT, { recursive: true });
const svg = (w, h, body, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>\n`;
const write = (name, s) => writeFileSync(path.join(OUT, name + ".svg"), s);

/* ---------- Fondos con manchas de color ---------- */
function backdrop(name, [c1, c2], blobs) {
  const defs = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="90"/></filter>`;
  const shapes = blobs.map(([x, y, r, c, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`).join("");
  write(name, svg(1600, 900, `<rect width="1600" height="900" fill="url(#g)"/><g filter="url(#b)">${shapes}</g>`, defs));
}
backdrop("aurora", ["#0b0618", "#1b0b3a"], [[300, 200, 320, "#7c3aed", 0.8], [1200, 650, 380, "#22d3ee", 0.45], [800, 450, 260, "#ec4899", 0.4]]);
backdrop("ember", ["#140505", "#2a0a08"], [[250, 700, 340, "#b3261e", 0.85], [1250, 250, 360, "#ea580c", 0.6], [800, 500, 220, "#fbbf24", 0.3]]);
backdrop("midnight", ["#05060f", "#0a1030"], [[400, 300, 330, "#1d4ed8", 0.6], [1250, 600, 300, "#6366f1", 0.5]]);
backdrop("ocean", ["#03141f", "#06324a"], [[300, 250, 360, "#0ea5e9", 0.65], [1300, 700, 360, "#14b8a6", 0.5], [850, 400, 200, "#67e8f9", 0.3]]);
backdrop("forest", ["#04140b", "#0b3320"], [[300, 700, 340, "#16a34a", 0.6], [1250, 220, 320, "#84cc16", 0.4], [800, 450, 200, "#10b981", 0.4]]);
backdrop("sunrise", ["#2b0f1c", "#5a1d1d"], [[250, 600, 380, "#f97316", 0.7], [1300, 300, 340, "#f43f5e", 0.6], [800, 700, 260, "#fde047", 0.45]]);
backdrop("mono", ["#18181b", "#27272a"], [[300, 250, 330, "#52525b", 0.55], [1250, 650, 360, "#a1a1aa", 0.3]]);
backdrop("gold", ["#0d0a05", "#1f1608"], [[350, 650, 340, "#c9a35a", 0.6], [1250, 250, 300, "#e2c07c", 0.4], [850, 450, 180, "#b45309", 0.4]]);
backdrop("rose", ["#2a0a1a", "#4a1230"], [[300, 300, 340, "#ec4899", 0.6], [1250, 650, 340, "#f9a8d4", 0.4], [800, 450, 200, "#a21caf", 0.45]]);
backdrop("mesh", ["#0a0712", "#160d2e"], [[200, 200, 300, "#7c3aed", 0.75], [800, 120, 260, "#c026d3", 0.5], [1350, 300, 330, "#22d3ee", 0.45], [600, 760, 340, "#4f46e5", 0.6], [1250, 800, 260, "#a855f7", 0.5]]);

/* ---------- Tecnología ---------- */
{
  let lines = "";
  for (let x = 0; x <= 1600; x += 80) lines += `<path d="M${x} 0V900"/>`;
  for (let y = 0; y <= 900; y += 80) lines += `<path d="M0 ${y}H1600"/>`;
  write("grid", svg(1600, 900, `<rect width="1600" height="900" fill="url(#g)"/><g stroke="#7c3aed" stroke-opacity=".28" fill="none">${lines}</g><circle cx="800" cy="450" r="260" fill="url(#r)"/>`,
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07060d"/><stop offset="1" stop-color="#120b2a"/></linearGradient><radialGradient id="r"><stop offset="0" stop-color="#7c3aed" stop-opacity=".5"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>`));
}
{
  let paths = "";
  const rnd = (i) => ((Math.sin(i * 91.7) + 1) / 2);
  for (let i = 0; i < 18; i++) {
    const y = 60 + i * 48, x0 = rnd(i) * 400, x1 = x0 + 200 + rnd(i + 3) * 500, y1 = y + (rnd(i + 7) > 0.5 ? 60 : -60);
    paths += `<path d="M${x0.toFixed(0)} ${y} H${x1.toFixed(0)} L${(x1 + 60).toFixed(0)} ${y1} H${(x1 + 300 + rnd(i) * 500).toFixed(0)}"/><circle cx="${x0.toFixed(0)}" cy="${y}" r="6"/>`;
  }
  write("circuit", svg(1600, 900, `<rect width="1600" height="900" fill="#05100f"/><g stroke="#14b8a6" stroke-opacity=".55" stroke-width="2" fill="#14b8a6" fill-opacity=".7">${paths}</g>`));
}
{
  let w = "";
  for (let i = 0; i < 9; i++) {
    const y = 300 + i * 36;
    w += `<path d="M0 ${y} C 300 ${y - 120 - i * 8}, 500 ${y + 140}, 800 ${y} S 1300 ${y - 130}, 1600 ${y}" stroke="url(#l)" stroke-opacity="${(0.9 - i * 0.08).toFixed(2)}" stroke-width="3" fill="none"/>`;
  }
  write("waves", svg(1600, 900, `<rect width="1600" height="900" fill="#070b18"/>${w}`, `<linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>`));
}

/* ---------- Personas (avatares ilustrados) ---------- */
const avatars = [
  ["#fecaca", "#ef4444", "#7f1d1d", "#f1c9a5"],
  ["#bfdbfe", "#2563eb", "#1e3a8a", "#c68642"],
  ["#bbf7d0", "#16a34a", "#14532d", "#8d5524"],
  ["#fde68a", "#d97706", "#78350f", "#f5d0b0"],
];
avatars.forEach(([bg, shirt, hair, skin], i) => {
  const hairShape = i % 2 ? `<path d="M130 190c0-80 40-120 70-120s70 40 70 120c-20-40-50-55-70-55s-50 15-70 55z" fill="${hair}"/>` : `<path d="M135 175c5-70 35-105 65-105s60 35 65 105c-15-30-35-42-65-42s-50 12-65 42z" fill="${hair}"/><rect x="128" y="170" width="18" height="90" rx="9" fill="${hair}"/><rect x="254" y="170" width="18" height="90" rx="9" fill="${hair}"/>`;
  write(`avatar-${i + 1}`, svg(400, 400, `<rect width="400" height="400" fill="${bg}"/><path d="M60 400c0-90 60-130 140-130s140 40 140 130z" fill="${shirt}"/><rect x="178" y="230" width="44" height="50" rx="14" fill="${skin}"/><ellipse cx="200" cy="190" rx="62" ry="72" fill="${skin}"/>${hairShape}<circle cx="178" cy="195" r="5" fill="#222"/><circle cx="222" cy="195" r="5" fill="#222"/><path d="M182 222q18 14 36 0" stroke="#7a3b2e" stroke-width="5" fill="none" stroke-linecap="round"/>`));
});

/* ---------- Productos ---------- */
const prodBg = (c1, c2) => `<rect width="800" height="800" fill="url(#bg)"/>`;
const bgDef = (c1, c2) => `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
write("product-1", svg(800, 800, `${prodBg()}<ellipse cx="400" cy="640" rx="190" ry="30" fill="#000" opacity=".18"/><circle cx="400" cy="420" r="210" fill="url(#s)"/>`, bgDef("#fef3e2", "#fcd9b6") + `<radialGradient id="s" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff7ed"/><stop offset=".45" stop-color="#fb923c"/><stop offset="1" stop-color="#9a3412"/></radialGradient>`));
write("product-2", svg(800, 800, `${prodBg()}<ellipse cx="400" cy="650" rx="230" ry="32" fill="#000" opacity=".16"/><path d="M400 200 L610 310 V540 L400 650 L190 540 V310Z" fill="#14b8a6"/><path d="M400 200 L610 310 L400 420 L190 310Z" fill="#5eead4"/><path d="M400 420 L610 310 V540 L400 650Z" fill="#0f766e"/>`, bgDef("#ecfdf5", "#a7f3d0")));
write("product-3", svg(800, 800, `${prodBg()}<ellipse cx="400" cy="650" rx="220" ry="28" fill="#000" opacity=".16"/><circle cx="400" cy="410" r="190" fill="none" stroke="url(#r)" stroke-width="64"/><circle cx="400" cy="410" r="190" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="10" transform="translate(-14 -14)"/>`, bgDef("#eff6ff", "#bfdbfe") + `<linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1e40af"/></linearGradient>`));
write("product-4", svg(800, 800, `${prodBg()}<ellipse cx="400" cy="670" rx="170" ry="26" fill="#000" opacity=".16"/><path d="M270 250 V620 C270 660 530 660 530 620 V250Z" fill="url(#c)"/><ellipse cx="400" cy="250" rx="130" ry="36" fill="#fecdd3"/><ellipse cx="400" cy="250" rx="108" ry="26" fill="#9f1239" opacity=".5"/>`, bgDef("#fff1f2", "#fecdd3") + `<linearGradient id="c" x1="0" x2="1"><stop offset="0" stop-color="#be123c"/><stop offset=".45" stop-color="#fb7185"/><stop offset="1" stop-color="#881337"/></linearGradient>`));

/* ---------- Ilustraciones ---------- */
const ui = (x, y, w, h, c = "#fff", o = 0.9, r = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" opacity="${o}"/>`;
write("browser", svg(1200, 800, `<rect width="1200" height="800" fill="url(#bg)"/><rect x="120" y="110" width="960" height="580" rx="22" fill="#0f0b1e" stroke="#ffffff" stroke-opacity=".15"/><circle cx="162" cy="146" r="7" fill="#f87171"/><circle cx="188" cy="146" r="7" fill="#fbbf24"/><circle cx="214" cy="146" r="7" fill="#4ade80"/>${ui(260, 134, 520, 26, "#fff", 0.1, 13)}${ui(170, 200, 460, 40, "#fff", 0.92, 10)}${ui(170, 256, 330, 20, "#fff", 0.4, 6)}${ui(170, 290, 400, 20, "#fff", 0.28, 6)}${ui(170, 340, 150, 46, "#7c3aed", 1, 12)}${ui(336, 340, 130, 46, "#fff", 0.14, 12)}<rect x="700" y="200" width="330" height="230" rx="18" fill="url(#h)"/>${ui(170, 470, 280, 160, "#fff", 0.07, 16)}${ui(470, 470, 280, 160, "#fff", 0.07, 16)}${ui(770, 470, 260, 160, "#fff", 0.07, 16)}`, `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b0b3a"/><stop offset="1" stop-color="#0b1030"/></linearGradient><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>`));
write("phone", svg(800, 1200, `<rect width="800" height="1200" fill="url(#bg)"/><rect x="210" y="120" width="380" height="960" rx="54" fill="#0b0816" stroke="#ffffff" stroke-opacity=".25" stroke-width="3"/><rect x="340" y="146" width="120" height="26" rx="13" fill="#000"/>${ui(250, 220, 300, 200, "url(#h)", 1, 24)}${ui(250, 450, 220, 24, "#fff", 0.9, 8)}${ui(250, 490, 300, 16, "#fff", 0.35, 6)}${ui(250, 520, 260, 16, "#fff", 0.25, 6)}${ui(250, 580, 140, 140, "#fff", 0.08, 18)}${ui(410, 580, 140, 140, "#fff", 0.08, 18)}${ui(250, 750, 300, 56, "#7c3aed", 1, 18)}${ui(250, 830, 300, 56, "#fff", 0.1, 18)}`, `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b0f4a"/><stop offset="1" stop-color="#0a1030"/></linearGradient><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ec4899"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>`));
write("workspace", svg(1200, 800, `<rect width="1200" height="800" fill="url(#bg)"/><rect x="0" y="560" width="1200" height="240" fill="#1c1917"/><rect x="0" y="548" width="1200" height="16" fill="#44403c"/><rect x="330" y="230" width="540" height="320" rx="16" fill="#111" stroke="#57534e" stroke-width="6"/><rect x="350" y="250" width="500" height="280" rx="6" fill="url(#h)"/>${ui(380, 285, 220, 22, "#fff", 0.9, 6)}${ui(380, 320, 300, 14, "#fff", 0.45, 5)}${ui(380, 346, 260, 14, "#fff", 0.35, 5)}${ui(380, 400, 110, 36, "#fff", 0.95, 10)}<rect x="560" y="550" width="80" height="26" fill="#57534e"/><rect x="480" y="570" width="240" height="14" rx="7" fill="#78716c"/><path d="M960 548 C 960 480 930 430 900 400 M960 548 C 970 470 1010 440 1040 420 M960 548 C 950 500 980 470 960 430" stroke="#16a34a" stroke-width="10" fill="none" stroke-linecap="round"/><rect x="920" y="540" width="80" height="60" rx="10" fill="#b45309"/><rect x="150" y="470" width="60" height="78" rx="8" fill="#f5f5f4"/><rect x="156" y="440" width="48" height="36" rx="6" fill="#fcd34d"/>`, `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#7c2d12"/></linearGradient><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#ec4899"/></linearGradient>`));
write("chart", svg(1200, 800, `<rect width="1200" height="800" fill="#0b0f1c"/><g stroke="#fff" stroke-opacity=".08">${[160, 270, 380, 490, 600].map((y) => `<path d="M120 ${y}H1080"/>`).join("")}</g>${[[160, 330, 0.5], [290, 240, 0.6], [420, 280, 0.6], [550, 170, 0.8], [680, 210, 0.8], [810, 120, 1], [940, 90, 1]].map(([x, y, o]) => `<rect x="${x}" y="${y + 110}" width="70" height="${600 - y - 110}" rx="10" fill="#6366f1" opacity="${o}"/>`).join("")}<path d="M195 460 L325 380 L455 410 L585 300 L715 330 L845 230 L975 190" stroke="#22d3ee" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${[[195, 460], [325, 380], [455, 410], [585, 300], [715, 330], [845, 230], [975, 190]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#0b0f1c" stroke="#22d3ee" stroke-width="4"/>`).join("")}`));
write("rocket", svg(800, 800, `<rect width="800" height="800" fill="url(#bg)"/><g fill="#fff" opacity=".8">${[[100, 120], [680, 90], [620, 260], [140, 360], [720, 480], [90, 640]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join("")}</g><path d="M400 120 C 500 200 520 360 500 520 H300 C 280 360 300 200 400 120Z" fill="#f4f4f5"/><path d="M400 120 C 450 160 480 200 490 250 H310 C 320 200 350 160 400 120Z" fill="#ef4444"/><circle cx="400" cy="330" r="48" fill="#0ea5e9" stroke="#1e293b" stroke-width="10"/><path d="M300 440 L210 560 L300 520Z M500 440 L590 560 L500 520Z" fill="#ef4444"/><path d="M340 520 H460 L400 700Z" fill="url(#f)"/>`, `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#4c1d95"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#ea580c" stop-opacity="0"/></linearGradient>`));
console.log("Biblioteca generada en", OUT);
