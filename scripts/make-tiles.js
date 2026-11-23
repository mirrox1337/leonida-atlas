#!/usr/bin/env node
// Cuts a large map image into a zoom pyramid of tiles for Leaflet.
//
//   npm install            (once, installs sharp)
//   node scripts/make-tiles.js [input] [outDir] [--tile-size 256] [--quality 82]
//
// Defaults: input = assets/map/map.jpg, outDir = assets/map/tiles
//
// Output layout: <outDir>/{z}/{x}/{y}.jpg
// The deepest zoom level (z = maxZoom) is the image at 1:1; every level above
// it is half the size. Tiles are anchored at the image's top-left corner and
// edge tiles are padded to full size, which is what js/map.js expects.
//
// The site itself does not need Node. This script is only for preparing tiles.

import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const args = process.argv.slice(2);
const positional = [];
const flags = { 'tile-size': 256, quality: 82, background: '#0a1216' };
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith('--')) {
    const name = args[i].slice(2);
    if (!(name in flags) || args[i + 1] === undefined) {
      console.error(`Unknown or incomplete option: ${args[i]}`);
      process.exit(1);
    }
    flags[name] = name === 'background' ? args[i + 1] : Number(args[i + 1]);
    i += 1;
  } else {
    positional.push(args[i]);
  }
}

const input = positional[0] ?? 'assets/map/map.jpg';
const outDir = positional[1] ?? 'assets/map/tiles';
const tileSize = flags['tile-size'];
const quality = flags.quality;

if (!Number.isInteger(tileSize) || tileSize < 64) {
  console.error('--tile-size must be a whole number of at least 64');
  process.exit(1);
}

// Game maps are often far larger than sharp's default pixel limit.
const open = () => sharp(input, { limitInputPixels: false });

const { width, height } = await open().metadata();
if (!width || !height) {
  console.error(`Could not read the size of ${input}`);
  process.exit(1);
}

const maxZoom = Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / tileSize)));
console.log(`${input}: ${width} x ${height}px, zoom levels 0-${maxZoom}, ${tileSize}px tiles`);

// Remove only the zoom folders this script writes, never the folder itself.
for (let z = 0; z <= Math.max(maxZoom, 12); z += 1) {
  await rm(path.join(outDir, String(z)), { recursive: true, force: true });
}

let total = 0;
for (let z = maxZoom; z >= 0; z -= 1) {
  const factor = 2 ** (z - maxZoom);
  const levelWidth = Math.max(1, Math.round(width * factor));
  const levelHeight = Math.max(1, Math.round(height * factor));

  // Resize once per level, then slice tiles out of the raw pixels.
  const { data, info } = await open()
    .resize(levelWidth, levelHeight, { fit: 'fill' })
    .flatten({ background: flags.background })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { raw: { width: info.width, height: info.height, channels: info.channels }, limitInputPixels: false };

  const columns = Math.ceil(levelWidth / tileSize);
  const rows = Math.ceil(levelHeight / tileSize);
  for (let x = 0; x < columns; x += 1) {
    const dir = path.join(outDir, String(z), String(x));
    await mkdir(dir, { recursive: true });
    for (let y = 0; y < rows; y += 1) {
      const left = x * tileSize;
      const top = y * tileSize;
      const w = Math.min(tileSize, levelWidth - left);
      const h = Math.min(tileSize, levelHeight - top);
      await sharp(data, raw)
        .extract({ left, top, width: w, height: h })
        .extend({ right: tileSize - w, bottom: tileSize - h, background: flags.background })
        .jpeg({ quality, mozjpeg: true })
        .toFile(path.join(dir, `${y}.jpg`));
      total += 1;
    }
  }
  console.log(`  z${z}: ${levelWidth} x ${levelHeight}px -> ${columns} x ${rows} tiles`);
}

console.log(`\nWrote ${total} tiles to ${outDir}`);
console.log('Now edit js/config.js:');
console.log(`  size: [${width}, ${height}],`);
console.log("  mode: 'tiles',");
if (tileSize !== 256) console.log(`  tiles.tileSize: ${tileSize},`);
