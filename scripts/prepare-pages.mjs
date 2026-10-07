import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The site includes static showcases and JSON catalogues as well as Astro pages.
// Rewrite the built copy so the same authored resources still work at domain root.
export function rewriteUrls(text, { base, site, roots }) {
  const target = site.replace(/\/$/, '') + base;
  for (const origin of new Set(['https://lab.einsia.ai', site.replace(/\/$/, '')])) {
    const absolute = new RegExp(escape(origin) + '(?=[/\\s"\'`<>?#]|$)(?!' + escape(base || '/__no_base__') + '(?:[/\\s"\'`<>?#]|$))', 'g');
    text = text.replace(absolute, () => target);
  }
  if (!base) return text;
  const names = [...roots].sort((a, b) => b.length - a.length).map(escape).join('|');
  const local = new RegExp('([\\s"\'`(=>]|&quot;|&#34;)/(?:' + names + ')(?=[/\\s"\'`<>?#),;&]|$)', 'g');
  text = text.replace(local, (match, boundary) => boundary + base + match.slice(boundary.length));
  // Only HTML URL attributes: replacing every quoted slash would break JS split('/').
  return text.replace(/\b(href|action)=(['"])\/(?=[?#]|\2)/g, (_match, attr, quote) => `${attr}=${quote}${base}/`);
}

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Unexpected symlink: ${entry.name}`);
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (entry.isFile()) yield file;
  }
}

export function preparePages(root, base, site) {
  base = base.replace(/\/$/, '');
  assert(!base || /^\/[A-Za-z0-9._-]+$/.test(base), `Invalid project base: ${base}`);
  const origin = new URL(site);
  assert(['http:', 'https:'].includes(origin.protocol));
  assert.equal(origin.pathname, '/', 'SITE must be an origin, without a path');
  const roots = fs.readdirSync(root).flatMap(name => name.endsWith('.html') ? [name, name.slice(0, -5)] : [name]);
  let changed = 0;
  for (const file of files(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (!/\.(html|css|js|mjs|json|svg|xml|txt)$/.test(file)) continue;
    // Signed evaluator evidence is provenance and must remain byte-identical.
    if (relative.startsWith('phys-last-exam/evidence/')) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = rewriteUrls(before, { base, site: origin.origin, roots });
    if (after !== before) {
      if (file.endsWith('.json')) JSON.parse(after);
      fs.writeFileSync(file, after);
      changed++;
    }
  }

  const manifestPath = path.join(root, 'phys-last-exam/release-assets.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const asset of manifest.assets) {
      assert(asset.url.startsWith(base + '/phys-last-exam/'));
      const relative = asset.url.slice(base.length + 1);
      assert(!relative.includes('..') && !relative.includes('\\'));
      const bytes = fs.readFileSync(path.join(root, relative));
      asset.bytes = bytes.length;
      asset.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
  console.log(`Prepared ${changed} text files for ${origin.origin}${base}/; signed evidence and media preserved.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  preparePages(path.resolve('dist'), process.env.BASE_PATH || '', process.env.SITE || 'https://lab.einsia.ai');
}
