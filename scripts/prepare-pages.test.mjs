import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { preparePages, rewriteUrls } from './prepare-pages.mjs';

const options = { base: '/Einsia-lab', site: 'https://gasaiyu.github.io', roots: ['phys-last-exam', '_astro', 'favicon.svg', 'index.html', 'index'] };
test('HTML, CSS, JS and catalogue URLs work under the repository prefix', () => {
  const input = `<a href="/">Home</a><a href="/#videos">Videos</a><img src="/favicon.svg" srcset="/phys-last-exam/a.webp 1x, /phys-last-exam/b.webp 2x"><style>.x{background:url(/phys-last-exam/a.webp)}</style><script>fetch('/phys-last-exam/video-gallery.json');const path=\`/phys-last-exam/\${id}\`;const parts=value.split('/');</script>{"original":"/phys-last-exam/videos/a.mp4"}`;
  const output = rewriteUrls(input, options);
  assert(output.includes('href="/Einsia-lab/"'));
  assert(output.includes('href="/Einsia-lab/#videos"'));
  assert(output.includes('/Einsia-lab/phys-last-exam/b.webp 2x'));
  assert(output.includes('url(/Einsia-lab/phys-last-exam/a.webp)'));
  assert(output.includes("fetch('/Einsia-lab/phys-last-exam/video-gallery.json')"));
  assert(output.includes('`/Einsia-lab/phys-last-exam/${id}`'));
  assert(output.includes("value.split('/')"));
  assert(output.includes('"original":"/Einsia-lab/phys-last-exam/videos/a.mp4"'));
  assert.equal(rewriteUrls(output, options), output);
});
test('external URLs, protocol-relative links and already-prefixed paths are preserved', () => {
  const input = `"https://example.com/phys-last-exam/" "//cdn.example.com/_astro/x.js" "/Einsia-lab/phys-last-exam/" "https://gasaiyu.github.io/Einsia-lab/phys-last-exam/"`;
  assert.equal(rewriteUrls(input, options), input);
  assert.equal(rewriteUrls('"https://lab.einsia.ai/phys-last-exam/"', options), '"https://gasaiyu.github.io/Einsia-lab/phys-last-exam/"');
  assert.equal(rewriteUrls('"https://gasaiyu.github.io/phys-last-exam/"', options), '"https://gasaiyu.github.io/Einsia-lab/phys-last-exam/"');
});
test('root-domain builds preserve original paths', () => {
  const input = '<a href="/">Home</a><img src="/phys-last-exam/a.webp">';
  assert.equal(rewriteUrls(input, { ...options, base: '' }), input);
});
test('built catalogues remain parseable and their manifest hashes stay valid', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-test-'));
  try {
    const physical = path.join(root, 'phys-last-exam');
    fs.mkdirSync(path.join(physical, 'evidence'), { recursive: true });
    const evidence = '{"provenance":"/phys-last-exam/original.json"}';
    fs.writeFileSync(path.join(physical, 'evidence/annotation.json'), evidence);
    const media = Buffer.from([0, 1, 2, 255]);
    fs.writeFileSync(path.join(physical, 'video.mp4'), media);
    fs.writeFileSync(path.join(physical, 'video-gallery.json'), '{"entries":[{"original":"/phys-last-exam/video.mp4"}]}');
    fs.writeFileSync(path.join(physical, 'release-assets.json'), JSON.stringify({ assets: ['video.mp4', 'video-gallery.json', 'evidence/annotation.json'].map(name => ({ url: '/phys-last-exam/' + name, bytes: 0, sha256: '' })) }));
    preparePages(root, options.base, options.site);
    assert.equal(fs.readFileSync(path.join(physical, 'evidence/annotation.json'), 'utf8'), evidence);
    assert.deepEqual(fs.readFileSync(path.join(physical, 'video.mp4')), media);
    const gallery = JSON.parse(fs.readFileSync(path.join(physical, 'video-gallery.json')));
    assert.equal(gallery.entries[0].original, '/Einsia-lab/phys-last-exam/video.mp4');
    const manifest = JSON.parse(fs.readFileSync(path.join(physical, 'release-assets.json')));
    for (const item of manifest.assets) {
      const bytes = fs.readFileSync(path.join(root, item.url.slice(options.base.length + 1)));
      assert.equal(item.bytes, bytes.length);
      assert.equal(item.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
