import sharp from 'sharp';
import fs from 'node:fs/promises';

const S = 128;
const manifestPath = 'public/reference-live2d/expressions/manifest.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const mouthEntries = manifest.entries.filter((e) => e.kind === 'mouth');

const compositeList = mouthEntries.map((e, i) => ({
  input: `public/reference-live2d/${e.file}`,
  left: (i % 5) * S,
  top: Math.floor(i / 5) * S,
}));

await sharp({
  create: {
    width: S * 5,
    height: S * 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(compositeList)
  .png()
  .toFile('public/reference-live2d/expressions/mouth-atlas.png');

console.log('Updated public/reference-live2d/expressions/mouth-atlas.png from individual mouth PNGs.');
