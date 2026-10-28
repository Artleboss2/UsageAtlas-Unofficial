#!/usr/bin/env node
/**
 * Rebuilds this fork's application icon from the upstream mark.
 *
 * The fork ships the same artwork deliberately datamoshed, so an install of it is
 * never mistaken for the official build. The recipe is fixed — channels split, a
 * few horizontal bands wrapped sideways, three torn scanlines — so running this
 * again writes byte-identical files:
 *
 *   node apps/desktop/scripts/glitch-icon.mjs
 *
 * Reads `resources/installer/usageatlas-official.png` (the untouched upstream
 * artwork, 1024 × 1024) and writes:
 *
 *   resources/icons/usageatlas.png  the window, taskbar and Linux icon, and the
 *                                   renderer's brand mark
 *   resources/icons/usageatlas.ico  the Windows executable icon, one PNG-compressed
 *                                   entry per size from 16 px to 256 px
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const masterFile = path.join(root, "resources", "installer", "usageatlas-official.png");
const pngFile = path.join(root, "resources", "icons", "usageatlas.png");
const icoFile = path.join(root, "resources", "icons", "usageatlas.ico");
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Horizontal bands: the share of the height they cover and how far they move. */
const BANDS = [
  { to: 0.12, shift: 0 },
  { to: 0.2, shift: 34 },
  { to: 0.29, shift: -14 },
  { to: 0.44, shift: 0 },
  { to: 0.52, shift: -52 },
  { to: 0.66, shift: 22 },
  { to: 0.83, shift: 0 },
  { to: 0.9, shift: -30 },
  { to: 1, shift: 0 }
];
/** Channel separation in pixels: red arrives late, blue early. */
const CHANNEL_SHIFT = 5;
/** Torn scanlines carrying their own tint. */
const TEARS = [
  { at: 0.283, thickness: 4, tint: [90, 255, 235] },
  { at: 0.523, thickness: 5, tint: [255, 90, 220] },
  { at: 0.845, thickness: 3, tint: [255, 240, 130] }
];

/** One pass over the master, returning fresh RGBA pixels. */
function glitch(master) {
  const { width, height } = master;
  const source = master.data;
  const pixels = Buffer.alloc(source.length);
  const at = (x, y) => (y * width + x) * 4;
  const bandShift = Array.from({ length: height }, (_row, y) => {
    const row = y / height;
    return BANDS.find(band => row < band.to)?.shift ?? 0;
  });

  for (let y = 0; y < height; y += 1) {
    const shift = bandShift[y];
    for (let x = 0; x < width; x += 1) {
      const target = at(x, y);
      // The band slides sideways and wraps: the pixels that leave one edge come
      // back on the other, which is what makes a block read as corrupted data.
      const slid = shift === 0 ? x : (x - shift + width) % width;
      const red = at(Math.min(width - 1, slid + CHANNEL_SHIFT), y);
      const green = at(slid, y);
      const blue = at(Math.max(0, slid - CHANNEL_SHIFT), y);
      pixels[target] = source[red];
      pixels[target + 1] = source[green + 1];
      pixels[target + 2] = source[blue + 2];
      pixels[target + 3] = source[green + 3];
    }
  }

  for (const tear of TEARS) {
    const top = Math.round(tear.at * height);
    const span = Math.round(0.4 * width);
    const left = Math.round(tear.at * (width - span));
    for (let y = top; y < Math.min(height, top + tear.thickness); y += 1) {
      for (let x = left; x < left + span; x += 1) {
        const target = at(x, y);
        // A line of pixels from the opposite edge, laid down where it does not belong.
        const sample = at(width - 1 - x, top);
        pixels[target] = mix(pixels[sample], tear.tint[0]);
        pixels[target + 1] = mix(pixels[sample + 1], tear.tint[1]);
        pixels[target + 2] = mix(pixels[sample + 2], tear.tint[2]);
        pixels[target + 3] = pixels[sample + 3];
      }
    }
  }
  return pixels;
}

const mix = (channel, tint) => Math.round(channel * 0.45 + tint * 0.55);

/** Box filter: the small entries stay a faithful reduction of the master. */
function downscale(master, size) {
  const { width, height, data } = master;
  const pixels = Buffer.alloc(size * size * 4);
  const scale = width / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0, 0];
      let count = 0;
      for (let sy = Math.floor(y * scale); sy < Math.min(height, Math.ceil((y + 1) * scale)); sy += 1) {
        for (let sx = Math.floor(x * scale); sx < Math.min(width, Math.ceil((x + 1) * scale)); sx += 1) {
          const at = (sy * width + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) sums[channel] += data[at + channel];
          count += 1;
        }
      }
      const target = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) pixels[target + channel] = Math.round(sums[channel] / count);
    }
  }
  return pixels;
}

/** A PNG-compressed ICO, which Windows has read since Vista. */
function encodeIco(master) {
  const entries = ICO_SIZES.map((size) => ({
    size,
    data: PNG.sync.write({ width: size, height: size, data: downscale(master, size) }, { colorType: 6 })
  }));
  const directory = Buffer.alloc(6 + entries.length * 16);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(entries.length, 4);
  let offset = directory.length;
  entries.forEach((entry, index) => {
    const at = 6 + index * 16;
    directory.writeUInt8(entry.size === 256 ? 0 : entry.size, at);
    directory.writeUInt8(entry.size === 256 ? 0 : entry.size, at + 1);
    directory.writeUInt8(0, at + 2);
    directory.writeUInt8(0, at + 3);
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(entry.data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });
  return Buffer.concat([directory, ...entries.map(entry => entry.data)]);
}

const master = PNG.sync.read(readFileSync(masterFile));
if (master.width !== master.height) throw new Error("the icon master must be square");
const glitched = { width: master.width, height: master.height, data: glitch(master) };
writeFileSync(pngFile, PNG.sync.write(glitched, { colorType: 6 }));
writeFileSync(icoFile, encodeIco(glitched));
console.log(`wrote ${path.relative(root, pngFile)} (${master.width}×${master.height})`);
console.log(`wrote ${path.relative(root, icoFile)} (${ICO_SIZES.join(", ")} px)`);
