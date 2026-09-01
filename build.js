#!/usr/bin/env node
/* ==========================================================================
   Worth the Drive — static site build
   No framework, no dependencies. Assembles src/ into static .html at the repo
   root, which is what GitHub Pages serves. Run: node build.js
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = ROOT;

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

/* --- tiny template engine ------------------------------------------------
   {{> partial }}        include a partial
   {{ a.b.c }}           escaped interpolation
   {{{ a.b.c }}}         raw interpolation
   {{#if a.b }}…{{/if}}  truthy block (supports {{else}})
   {{#each a.b }}…{{/each}}  iteration; inside: {{ this.x }}, {{@index}}, {{@num}}
   -------------------------------------------------------------------------- */

const partials = {};
function loadPartials() {
  const dir = path.join(SRC, 'partials');
  if (!exists(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html')) partials[path.basename(f, '.html')] = read(path.join(dir, f));
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function resolve(ctx, key) {
  key = key.trim();
  if (key === 'this') return ctx.__this !== undefined ? ctx.__this : ctx;
  if (key === '@index') return ctx.__index;
  if (key === '@num') return (ctx.__index ?? 0) + 1;
  let cur = key.startsWith('this.')
    ? (ctx.__this !== undefined ? ctx.__this : ctx)
    : ctx;
  const parts = key.replace(/^this\./, '').split('.');
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/* Find the index just past the {{/tag}} that balances an opener at `from`,
   counting nested {{#tag …}} of the same kind. Returns { body, end }. */
function matchBlock(tpl, tag, from) {
  const open = new RegExp('\\{\\{#' + tag + '\\s+[\\w.@]+\\s*\\}\\}', 'g');
  const close = new RegExp('\\{\\{\\/' + tag + '\\}\\}', 'g');
  let depth = 1;
  let i = from;
  while (i < tpl.length) {
    open.lastIndex = i;
    close.lastIndex = i;
    const o = open.exec(tpl);
    const c = close.exec(tpl);
    if (!c) throw new Error(`unclosed {{#${tag}}} block`);
    if (o && o.index < c.index) { depth++; i = o.index + o[0].length; continue; }
    depth--;
    if (depth === 0) return { body: tpl.slice(from, c.index), end: c.index + c[0].length };
    i = c.index + c[0].length;
  }
  throw new Error(`unclosed {{#${tag}}} block`);
}

/* Split a block body on its top-level {{else}} (ignoring nested blocks). */
function splitElse(body) {
  const re = /\{\{#(each|if)\s+[\w.@]+\s*\}\}|\{\{\/(each|if)\}\}|\{\{else\}\}/g;
  let depth = 0, m;
  while ((m = re.exec(body))) {
    if (m[0] === '{{else}}') { if (depth === 0) return [body.slice(0, m.index), body.slice(m.index + 8)]; }
    else if (m[1]) depth++;
    else depth--;
  }
  return [body, ''];
}

function renderBlocks(tpl, ctx, depth) {
  const opener = /\{\{#(each|if)\s+([\w.@]+)\s*\}\}/;
  let out = '';
  let rest = tpl;

  for (;;) {
    const m = opener.exec(rest);
    if (!m) return out + rest;

    out += rest.slice(0, m.index);
    const tag = m[1];
    const key = m[2];
    const bodyStart = m.index + m[0].length;
    const { body, end } = matchBlock(rest, tag, bodyStart);

    if (tag === 'each') {
      const list = resolve(ctx, key);
      if (Array.isArray(list)) {
        out += list.map((item, i) => {
          const child = Object.create(ctx);
          child.__this = item;
          child.__index = i;
          return render(body, child, depth + 1);
        }).join('');
      }
    } else {
      const v = resolve(ctx, key);
      const truthy = Array.isArray(v) ? v.length > 0 : Boolean(v);
      const [ifBody, elseBody] = splitElse(body);
      out += render(truthy ? ifBody : elseBody, ctx, depth + 1);
    }

    rest = rest.slice(end);
  }
}

function render(tpl, ctx, depth) {
  depth = depth || 0;
  if (depth > 12) throw new Error('template recursion too deep');

  // includes first, so partials participate in the same pass
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`unknown partial: ${name}`);
    return partials[name];
  });
  if (/\{\{>\s*[\w-]+\s*\}\}/.test(tpl)) return render(tpl, ctx, depth + 1);

  // Blocks ({{#each}} / {{#if}}) are matched by scanning for the *balanced*
  // closing tag, so nested loops work. A non-greedy regex would close an outer
  // {{#each}} at an inner {{/each}} and silently emit unclosed markup.
  tpl = renderBlocks(tpl, ctx, depth);

  // raw then escaped
  tpl = tpl.replace(/\{\{\{\s*([\w.@]+)\s*\}\}\}/g, (_, k) => {
    const v = resolve(ctx, k);
    return v == null ? '' : String(v);
  });
  tpl = tpl.replace(/\{\{\s*([\w.@]+)\s*\}\}/g, (_, k) => {
    const v = resolve(ctx, k);
    return v == null ? '' : esc(v);
  });

  return tpl;
}

/* --- page metadata -------------------------------------------------------
   Each page begins with an HTML comment holding JSON:
     <!--meta { "slug": "index", "title": "…" } -->
   -------------------------------------------------------------------------- */

function parsePage(raw, file) {
  const m = raw.match(/^\s*<!--meta([\s\S]*?)-->/);
  if (!m) throw new Error(`${file}: missing <!--meta … --> block`);
  let meta;
  try { meta = JSON.parse(m[1]); }
  catch (e) { throw new Error(`${file}: bad meta JSON — ${e.message}`); }
  return { meta, body: raw.slice(m[0].length).trim() };
}

/* --- CSS bundle ----------------------------------------------------------
   Source is split for maintainability; exactly one stylesheet is served.
   -------------------------------------------------------------------------- */

function buildCss() {
  const dir = path.join(ROOT, 'assets', 'css');
  const order = ['site.css', 'components.css'];
  const parts = order
    .filter((f) => exists(path.join(dir, f)))
    .map((f) => `/* ===== ${f} ===== */\n` + read(path.join(dir, f)));
  const bundle = parts.join('\n\n');
  fs.writeFileSync(path.join(dir, 'wtd.css'), bundle);
  return bundle.length;
}

/* --- gallery ---------------------------------------------------------------
   Photos are discovered from images/gallery/ rather than listed anywhere. Drop
   a file in, rebuild, and it appears. Any number, no markup to edit.

   -800 variants sit beside the originals and are excluded from the listing;
   the build wires them into srcset when present. alt.json is optional and maps
   a filename to its alt text — anything missing falls back to a description
   derived from the filename, so a photo is never dropped for lacking one.     */

const GALLERY_DIR = path.join(__dirname, 'images', 'gallery');

function titleFromFilename(name) {
  return name
    .replace(/\.[a-z]+$/i, '')
    .replace(/^\d+[-_]/, '')      // strip a leading sort prefix like 010-
    .replace(/[-_]+/g, ' ')
    .trim();
}

function loadGallery() {
  if (!fs.existsSync(GALLERY_DIR)) return [];

  let alts = {};
  const altFile = path.join(GALLERY_DIR, 'alt.json');
  if (fs.existsSync(altFile)) {
    try {
      alts = JSON.parse(read(altFile));
    } catch (e) {
      throw new Error('images/gallery/alt.json is not valid JSON: ' + e.message);
    }
  }

  const files = fs.readdirSync(GALLERY_DIR)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .filter((f) => !/-800\.[a-z]+$/i.test(f))   // generated variant, not a photo
    .sort((a, z) => a.localeCompare(z, 'en', { numeric: true }));

  return files.map((file) => {
    const small = file.replace(/(\.[a-z]+)$/i, '-800$1');
    const hasSmall = fs.existsSync(path.join(GALLERY_DIR, small));
    return {
      src: 'images/gallery/' + file,
      small: hasSmall ? 'images/gallery/' + small : null,
      alt: alts[file] || ('Worth the Drive On Tour — ' + titleFromFilename(file)),
      generic: !alts[file],
    };
  });
}

/* Course thumbnails are discovered the same way gallery photos are: drop
   images/courses/<course-name-slugified>.jpg in and that card gets a thumbnail.
   No JSON to edit. A card with no matching file simply renders without one, so
   the section is never half-broken while thumbnails are being collected.

   The right source is a GSPro capture of that course. A photograph of the real
   course would sit directly above a line saying we are not affiliated with or
   endorsed by these clubs, and would undercut it.                              */

const COURSE_THUMB_DIR = path.join(__dirname, 'images', 'courses');

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function attachCourseThumbs(cards) {
  if (!Array.isArray(cards)) return cards;
  return cards.map((card) => {
    const slug = slugify(card.name);
    // Whatever extension the file was saved with. Looking only for .jpg meant a
    // .png dropped in was silently ignored, which reads as the feature being
    // broken rather than the filename being wrong.
    const ext = ['.jpg', '.jpeg', '.png', '.webp']
      .find((e) => fs.existsSync(path.join(COURSE_THUMB_DIR, slug + e)));
    if (!ext) return card;
    const small = path.join(COURSE_THUMB_DIR, slug + '-800' + ext);
    return Object.assign({}, card, {
      thumb: 'images/courses/' + slug + ext,
      thumbSmall: fs.existsSync(small) ? 'images/courses/' + slug + '-800' + ext : null,
    });
  });
}

/* --- image dimensions -------------------------------------------------------
   width/height on an <img> reserve the space before the picture arrives, so a
   stale pair makes the page jump as it loads. Hand-maintaining them means every
   replacement image has to be the same size as the one it replaced, which is
   not a rule anyone will remember.

   So the build reads the real dimensions out of the file and corrects the
   attributes itself. Upload any size; the markup follows.                     */

function jpegSize(buf) {
  let i = 2;                                   // skip SOI
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // SOF0-3, 5-7, 9-11, 13-15 carry the frame header. Others are skipped.
    if ((marker >= 0xc0 && marker <= 0xcf) &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const sizeCache = new Map();

function imageSize(relPath) {
  if (sizeCache.has(relPath)) return sizeCache.get(relPath);
  const file = path.join(__dirname, relPath);
  let out = null;
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) out = pngSize(buf);
    else if (buf[0] === 0xff && buf[1] === 0xd8) out = jpegSize(buf);
  } catch { /* referenced file missing — reported separately */ }
  sizeCache.set(relPath, out);
  return out;
}

/* Rewrite width/height on every <img> whose src points at a local file. */
function correctImageDimensions(html, onFix) {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
    if (!src || !src.startsWith('images/')) return tag;
    const real = imageSize(src);
    if (!real) return tag;
    const w = (tag.match(/\swidth="(\d+)"/) || [])[1];
    const h = (tag.match(/\sheight="(\d+)"/) || [])[1];
    if (String(real.width) === w && String(real.height) === h) return tag;
    if (w && h) onFix(src, `${w}x${h}`, `${real.width}x${real.height}`);
    return tag
      .replace(/\swidth="\d+"/, ` width="${real.width}"`)
      .replace(/\sheight="\d+"/, ` height="${real.height}"`);
  });
}

/* Rotator cards are 4:3 and contain their image, so a wider screenshot
   letterboxes. Centred, that splits the empty space top and bottom and the
   caption ends up sitting over the screenshot's bottom row of data. Anchoring
   those to the top collects all the space at the bottom, under the caption.

   Derived from the file rather than listed by hand, so swapping an image
   changes the anchor with it.                                                */

const CARD_ASPECT = 4 / 3;

function markWideShots(shots) {
  if (!Array.isArray(shots)) return shots;
  return shots.map((shot) => {
    const size = imageSize('images/' + shot.image + '.jpg');
    if (!size || !size.height) return shot;
    const wider = (size.width / size.height) > CARD_ASPECT + 0.02;
    return wider ? Object.assign({}, shot, { anchorTop: true }) : shot;
  });
}

/* --- build ---------------------------------------------------------------- */

function build() {
  loadPartials();

  const site = JSON.parse(read(path.join(SRC, 'data', 'site.json')));
  // CTA config resolves once, here — flipping site.cta.state swaps every
  // surface with no layout change (HANDOFF rule 3).
  site.ctas = site.cta.state === 'open' ? site.cta.open : site.cta.preOpening;

  // Discovered from the folder, not configured. See loadGallery.
  site.gallery = loadGallery();
  if (site.courses) site.courses.cards = attachCourseThumbs(site.courses.cards);
  if (site.technology && site.technology.vx) {
    site.technology.vx.shots = markWideShots(site.technology.vx.shots);
  }

  const cssBytes = buildCss();
  const layout = read(path.join(SRC, 'layouts', 'base.html'));

  const pagesDir = path.join(SRC, 'pages');
  const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html'));
  const built = [];
  const dimFixes = [];

  for (const file of files) {
    const { meta, body } = parsePage(read(path.join(pagesDir, file)), file);
    const slug = meta.slug || path.basename(file, '.html');
    const ctx = Object.assign(Object.create(null), site, {
      page: meta,
      site,
      slug,
      year: meta.year || 2026,
    });

    const content = render(body, ctx);
    const html = render(layout, Object.assign(Object.create(null), ctx, { content }));
    const fixed = correctImageDimensions(html, (src, was, now) => {
      dimFixes.push(`${slug}.html  ${src}  ${was} -> ${now}`);
    });

    const outFile = path.join(OUT, `${slug}.html`);
    fs.writeFileSync(outFile, fixed);
    built.push({ slug, bytes: html.length });
  }

  const cards = (site.courses && site.courses.cards) || [];
  return { built, cssBytes, gallery: site.gallery, dimFixes,
           thumbs: cards.filter((c) => c.thumb).length, courseCount: cards.length };
}

if (require.main === module) {
  try {
    const { built, cssBytes, gallery, thumbs, courseCount, dimFixes } = build();
    console.log(`css bundle  assets/css/wtd.css  ${(cssBytes / 1024).toFixed(1)} KB`);
    for (const b of built.sort((a, z) => a.slug.localeCompare(z.slug))) {
      console.log(`page        ${b.slug}.html`.padEnd(34) + `${(b.bytes / 1024).toFixed(1)} KB`);
    }
    const missingAlt = gallery.filter((g) => g.generic).length;
    console.log(`courses     ${thumbs} of ${courseCount} card(s) have a thumbnail`);
    for (const f of dimFixes) console.log(`img fixed   ${f}`);
    console.log(`gallery     ${gallery.length} photo(s) from images/gallery/`
      + (missingAlt ? `  (${missingAlt} using a filename-derived alt)` : ''));
    console.log(`\n${built.length} page(s) built.`);
  } catch (e) {
    console.error('BUILD FAILED: ' + e.message);
    process.exit(1);
  }
}

module.exports = { build, render };
