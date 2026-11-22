import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const source = path.join(publicDir, 'logo.png');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Place logo centered on a square canvas with padding (scale = fraction of canvas). */
async function writeIcon(size, scale, filename) {
  const logoSize = Math.round(size * scale);
  const offset = Math.floor((size - logoSize) / 2);

  const resized = await sharp(source)
    .resize(logoSize, logoSize, { fit: 'contain', background: WHITE })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .png()
    .toFile(path.join(publicDir, filename));

  console.log(`Wrote ${filename} (logo ${Math.round(scale * 100)}% of ${size}px)`);
}

// Only 3 files needed — see README / vite.config manifest comments.
// Standard icons: home screen (any), launch splash, in-app logo
await writeIcon(192, 0.78, 'pwa-192x192.png');
await writeIcon(512, 0.78, 'pwa-512x512.png');

// Maskable: Android rounded icon (extra padding so shield is not clipped)
await writeIcon(512, 0.68, 'pwa-512x512-maskable.png');
