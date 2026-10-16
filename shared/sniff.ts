/** Tipo real de un archivo por su firma de bytes (no se confía en el tipo declarado). SVG no se admite. */
const str = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function sniff(buf: Uint8Array): { mime: string; ext: string; kind: "image" | "video" } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && str(buf, 1, 4) === "PNG") return { mime: "image/png", ext: "png", kind: "image" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (str(buf, 0, 4) === "GIF8") return { mime: "image/gif", ext: "gif", kind: "image" };
  if (str(buf, 0, 4) === "RIFF" && str(buf, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (str(buf, 4, 8) === "ftyp") {
    const brand = str(buf, 8, 12);
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: "avif", kind: "image" };
    return { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: "video/webm", ext: "webm", kind: "video" };
  return null;
}
