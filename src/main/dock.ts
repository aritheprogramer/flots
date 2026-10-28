import { app, nativeImage, type NativeImage } from 'electron';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { validHex, contrast } from '../shared/appearance';
// A small PNG encoder keeps runtime custom colors independent of native addons or subprocesses.
function crc(data: Buffer) { let c = 0xffffffff; for (const b of data) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) { const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, sum]); }
export function iconPNG(color: string, size = 128, mask?: Uint8Array): Buffer {
  if (!validHex(color) || !Number.isInteger(size) || size < 16 || size > 512 || (mask && mask.length !== size * size)) throw new Error('Invalid icon');
  const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const foreground = contrast(color, '#ffffff') >= 3 ? 255 : 28;
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xx = (x + .5) / size, yy = (y + .5) / size;
    const dx = Math.max(Math.abs(xx - .5) - .24, 0), dy = Math.max(Math.abs(yy - .5) - .24, 0);
    const alpha = Math.max(0, Math.min(1, (.20 - Math.hypot(dx, dy)) * size));
    const wave = mask ? mask[y * size + x] / 255 : xx >= .23 && xx <= .77 && [.40, .59].some(b => Math.abs(yy - b - .05 * Math.sin((xx - .23) / .27 * Math.PI * 2)) < .025) ? 1 : 0;
    const offset = y * (1 + size * 4) + 1 + x * 4;
    for (let i = 0; i < 3; i++) raw[offset + i] = Math.round((rgb[i] * .78 + ((rgb[i] + (255 - rgb[i]) * .35) - rgb[i] * .78) * (1 - yy * .85 - xx * .15)) * (1 - wave) + (foreground === 255 ? [247,250,237][i] : foreground) * wave);
    raw[offset + 3] = Math.round(alpha * 255);
  }
  const head = Buffer.alloc(13); head.writeUInt32BE(size); head.writeUInt32BE(size, 4); head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
export class DockIcon {
  private cache = new Map<string, NativeImage>();
  private mask?: Uint8Array;
  color = ''; updates = 0;
  update(color: string) {
    if (!app.dock || this.color === color) return;
    let image = this.cache.get(color);
    if (!image) { if (!this.mask) { const source = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets/flots-wave-mask.png')).resize({ width: 256, height: 256 }).toBitmap(); this.mask = Uint8Array.from({ length: 256 * 256 }, (_, i) => source[i * 4 + 3]); } image = nativeImage.createFromBuffer(iconPNG(color, 256, this.mask)); if (this.cache.size >= 8) this.cache.delete(this.cache.keys().next().value!); this.cache.set(color, image); }
    app.dock.setIcon(image); this.color = color; this.updates++;
  }
}
