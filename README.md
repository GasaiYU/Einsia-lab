# Navers lab

## This fork's public deployment

`GasaiYU/Einsia-lab` publishes the `phys-last-exam` branch through GitHub Pages:
<https://gasaiyu.github.io/Einsia-lab/phys-last-exam/>.
Pushes to that branch automatically run the deployment workflow. In repository
Settings → Pages, the build source is **GitHub Actions**.

The workflow validates the original resources, builds the site, then prepares
the generated HTML, scripts, styles and catalogues for the Pages repository URL.
Only the generated `dist/` copy receives the URL prefix. Media and signed
evaluation evidence remain unchanged; the generated integrity manifest is
refreshed and the full resource validation runs again before publication.
The local development site continues to use root-relative URLs.

The contributing notes below describe the upstream project's workflow.

Lab homepage for [lab.einsia.ai](https://lab.einsia.ai), built with
[Astro](https://astro.build) on the
[Astroship](https://github.com/surjithctly/astroship) starter (Astro +
Tailwind CSS v4). Styling mirrors the monochrome
[einsia-homepage](https://einsia.ai) design system — Georgia serif headings,
Inter body, black ink on near-white paper.

## Project Structure

```
/
├── public/
│   ├── frontier-eng/         # FE-Leaderboard (static, untouched by Astro)
│   ├── phys-last-exam/            # World Models’ Last Exam in Physics page assets, bundled videos and evidence
│   └── browserbc/            # BrowserBC paper showcase (static)
└── src/
    ├── styles/global.css     # Tailwind v4 + design tokens (colors, fonts)
    ├── layouts/Layout.astro  # <head>, SEO, Navbar + Footer
    ├── components/           # navbar, footer, container, sectionhead, ui/*
    ├── content/
    │   ├── config.ts         # Blog collection schema
    │   └── blog/*.md         # Blog posts (one Markdown file per post)
    └── pages/
        ├── index.astro       # Homepage
        ├── blog.astro        # Blog index
        └── blog/[slug].astro # Generated post pages
```

`/news` and `/benchmarks` redirect to `/blog`.

## Tech stack

- **Astro 5** (static output)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Content Collections** for the blog (`src/content/blog`)
- `astro-navbar`, `astro-seo`, `astro-icon`, `@astrojs/sitemap`, `@astrojs/mdx`

## Contributing (Design)

### First-time setup

**Prerequisites**: Node.js 20.19+ (CI uses Node.js 22). The local version is
pinned in `.nvmrc`; run `nvm use` and check with `node -v`.

```bash
git clone https://github.com/Einsia/Einsia-lab.git
cd Einsia-lab
nvm install
nvm use
npm install
```

### Local preview

```bash
nvm use
npm run dev
```

Open [http://localhost:4321/](http://localhost:4321/) in your browser. Changes
to files under `src/` are reflected instantly.

### Workflow

```bash
# 1. Create a branch for your changes
git checkout -b design/your-change-name

# 2. Make changes, preview at localhost:4321

# 3. Commit and push
git add .
git commit -m "style: describe what you changed"
git push origin design/your-change-name

# 4. Open a Pull Request to main on GitHub
#    Production deploys automatically once merged to main
```

> **Note**: Only `main` branch triggers a production deploy. Your branch is safe
> to push freely.

### World Models’ Last Exam in Physics video resources

Commit the prepared videos in `public/phys-last-exam/videos/` and evidence in
`public/phys-last-exam/evidence/`, together with their catalogue and integrity manifest.
Full evaluation originals and caches are kept in Git-ignored `.local/phys-last-exam/`,
outside the deployed site. See [the resource packaging guide](scripts/phys-last-exam/WEB_RELEASE.md).

Run `npm run validate:phys-last-exam` before committing. The Pages workflow validates
asset hashes/links before building and enforces a 950 MB site budget after build.

## Files to edit

| What you want to change            | File                            |
| ---------------------------------- | ------------------------------- |
| Homepage layout / copy             | `src/pages/index.astro`         |
| Add / edit a blog post             | `src/content/blog/*.md`         |
| Blog index layout                  | `src/pages/blog.astro`          |
| Nav / footer                       | `src/components/`               |
| Colors, fonts, global styles       | `src/styles/global.css`         |
| Leaderboard / paper pages (static) | `public/frontier-eng/`, `public/browserbc/` |

### Adding a blog post

Create a Markdown file in `src/content/blog/`:

```yaml
---
draft: false
title: "Post title"
snippet: "One-line summary shown on the blog index."
publishDate: "2026-06-30"
author: "Navers lab"
category: "Benchmarks"
tags: [tag-one, tag-two]
links: # optional call-to-action buttons
  - label: "Open benchmark"
    href: "/frontier-eng/index.html"
    style: "primary"
---

Markdown body goes here.
```
