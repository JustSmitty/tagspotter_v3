#!/usr/bin/env node
/**
 * Generate the two Google Play listing graphics that are not screenshots.
 *
 *   node scripts/make-store-graphics.mjs
 *
 *   store-assets/google-play/icon-512.png                    512x512, no alpha
 *   store-assets/google-play/feature-graphic/feature-graphic.png  1024x500, no alpha
 *
 * Both are derived from assets already in the repo, so they can be regenerated
 * after any rebrand instead of living on as untracked exports from a design tool.
 *
 * The typography problem
 * ----------------------
 * The app's fonts are self-hosted woff2 (Rye, Newsreader, Special Elite, Work
 * Sans). sharp's SVG renderer resolves fonts through the system, not through the
 * repo, so <text> in an SVG here would silently fall back to a generic serif and
 * look nothing like the app it is advertising.
 *
 * So the logotype is not typeset — it is lifted from an actual release-build
 * screenshot. Real font, real colour, and guaranteed to match the screenshots
 * sitting next to it in the listing. Everything else is geometry from the
 * palette in src/theme/variables.scss.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const ICON_SRC = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
const SHOT_SRC = 'store-assets/google-play/phone/01-explore.png';
const ICON_OUT = 'store-assets/google-play/icon-512.png';
const FEATURE_OUT = 'store-assets/google-play/feature-graphic/feature-graphic.png';

/**
 * Where the logotype sits in a 1080x2404 capture of the Explore tab. The
 * circular header buttons sit directly above the kicker, so a taller crop drags
 * them in — this window is the logotype alone.
 */
const LOGOTYPE_CROP = { left: 86, top: 352, width: 470, height: 68 };

const CREAM = '#fdfae9';
const PLATE = '#f6eee1'; // sampled from the crop's own ground, so there is no seam
const RUST = '#D9541C';
const PINE = '#396754';
const GOLD = '#F1C40F';

const W = 1024;
const H = 500;
const plate = { x: 92, y: 74, w: 840, h: 352, r: 44 };

/** Play requires exactly 512x512 with no alpha; a transparent corner renders black in the console. */
async function icon() {
  await sharp(ICON_SRC)
    .resize(512, 512, { fit: 'cover', kernel: 'lanczos3' })
    // flatten() composites away transparency but leaves the channel in place,
    // and Play wants a 24-bit PNG. removeAlpha() is what actually drops it.
    .flatten({ background: CREAM })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(ICON_OUT);
  const meta = await sharp(ICON_OUT).metadata();
  console.log(`${ICON_OUT}  ${meta.width}x${meta.height}  ${meta.hasAlpha ? 'HAS ALPHA' : 'no alpha'}`);
}

async function featureGraphic() {
  // Play crops this at some placements, so nothing that matters is within ~90px
  // of an edge.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M34 0H0V34" fill="none" stroke="rgba(150,110,60,0.10)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <rect x="${plate.x}" y="${plate.y}" width="${plate.w}" height="${plate.h}" rx="${plate.r}"
        fill="${PLATE}" stroke="${RUST}" stroke-width="13"/>

  <rect x="${plate.x + 34}" y="${plate.y + 46}" width="${plate.w - 68}" height="34" fill="${PINE}"/>
  <rect x="${plate.x + 34}" y="${plate.y + plate.h - 92}" width="${plate.w - 68}" height="26" fill="${GOLD}"/>

  <circle cx="${plate.x + 44}" cy="${plate.y + plate.h / 2}" r="9" fill="rgba(71,51,28,0.28)"/>
  <circle cx="${plate.x + plate.w - 44}" cy="${plate.y + plate.h / 2}" r="9" fill="rgba(71,51,28,0.28)"/>

  <!-- Sits ON the pine band like a sticker, but clear of the logotype's
       ascenders — at scale 1.45 it grazed the R of SPOTTER. -->
  <g transform="translate(${plate.x + plate.w - 104}, ${plate.y + 74}) scale(1.3)">
    <path d="M0,-34 L9.6,-11.6 L34,-8.8 L15.5,7.3 L20.6,31.4 L0,19 L-20.6,31.4 L-15.5,7.3 L-34,-8.8 L-9.6,-11.6 Z"
          fill="${GOLD}" stroke="rgba(71,51,28,0.22)" stroke-width="2"/>
  </g>
</svg>`;

  /**
   * Compositing the crop as a rectangle leaves a visible box: the postcard's
   * paper is a subtly textured gradient and will never match a flat fill.
   *
   * So the crop is reduced to a MASK instead. The letterforms are dark on light,
   * so greyscale -> negate gives an alpha channel that is opaque exactly where
   * the type is, anti-aliasing included. That alpha is joined onto a flat rust
   * layer, which composites onto any background with no seam at all — and as a
   * bonus the wordmark is now recolourable without re-cropping.
   */
  const LOGO_W = 620;

  // metadata() on a pipeline describes the INPUT file, not the resized output —
  // asking it for dimensions here returns the 1080x2404 screenshot and the
  // joinChannel below fails on a buffer-size mismatch. resolveWithObject gives
  // the dimensions of what was actually produced.
  const { data: grey, info } = await sharp(SHOT_SRC)
    .extract(LOGOTYPE_CROP)
    .resize({ width: LOGO_W, kernel: 'lanczos3' })
    .greyscale()
    .negate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: lw, height: lh } = info;

  /**
   * Remap by hand rather than with sharp's linear().
   *
   * Rust is a mid-tone, so after negate the measured histogram is: cream paper
   * 16-31, letterforms 128-146, anti-aliasing spread between. Left alone, the
   * paper is close enough to zero to LOOK transparent without being it, which
   * printed a faint pink rectangle across the plate.
   *
   * linear() does not apply a plain 0-255 affine map — feeding it the arithmetic
   * that should have worked drove the letterforms to near-zero instead. Doing it
   * here is a few lines and is verifiable against the histogram above.
   */
  const FLOOR = 34; // top of the paper
  const CEIL = 140; // body of the letterforms
  const alpha = Buffer.alloc(grey.length);
  for (let i = 0; i < grey.length; i++) {
    const t = (grey[i] - FLOOR) / (CEIL - FLOOR);
    alpha[i] = Math.max(0, Math.min(255, Math.round(t * 255)));
  }

  const logotype = await sharp({
    create: { width: lw, height: lh, channels: 3, background: RUST },
  })
    .joinChannel(alpha, { raw: { width: lw, height: lh, channels: 1 } })
    .png()
    .toBuffer();
  const logoMeta = { width: lw, height: lh };

  mkdirSync('store-assets/google-play/feature-graphic', { recursive: true });

  await sharp(Buffer.from(svg))
    .composite([
      {
        input: logotype,
        left: Math.round((W - logoMeta.width) / 2),
        top: Math.round(plate.y + plate.h / 2 - logoMeta.height / 2) + 6,
      },
    ])
    // flatten() composites away transparency but leaves the channel in place,
    // and Play wants a 24-bit PNG. removeAlpha() is what actually drops it.
    .flatten({ background: CREAM })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(FEATURE_OUT);

  const meta = await sharp(FEATURE_OUT).metadata();
  console.log(`${FEATURE_OUT}  ${meta.width}x${meta.height}  ${meta.hasAlpha ? 'HAS ALPHA' : 'no alpha'}`);
}

await icon();
await featureGraphic();
