// @ts-check
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

/**
 * Serve `<dir>/index.html` for trailing-slash requests to static (public/)
 * directories during `astro dev` and `astro preview`, so e.g. `/browserbc/`
 * opens its index without a redirect or an explicit `index.html` in the URL.
 * GitHub Pages already does this in production; this just matches it locally.
 */
function publicDirectoryIndex() {
  const middleware = (root) => (req, _res, next) => {
    const raw = req.url || "";
    const qIndex = raw.indexOf("?");
    const pathname = qIndex === -1 ? raw : raw.slice(0, qIndex);
    const query = qIndex === -1 ? "" : raw.slice(qIndex);
    if (pathname.endsWith("/")) {
      const file = path.join(root, pathname, "index.html");
      if (fs.existsSync(file)) {
        req.url = pathname + "index.html" + query;
      }
    }
    next();
  };
  return {
    name: "public-directory-index",
    configureServer(server) {
      server.middlewares.use(middleware("public"));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware("dist"));
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE || "https://lab.einsia.ai",
  base: "/",
  output: "static",
  integrations: [mdx(), sitemap(), icon()],
  redirects: {
    "/blog": "/research",
    "/benchmarks": "/research",
    "/news": "/research",
    // Preserve already-published deep links to the static showcases.
    "/browser-bc": "/browserbc/",
    "/frontier-engineering": "/frontier-eng/",
    // Old static .html subpages now live at clean Astro routes.
    "/browserbc/contact.html": "/browserbc/contact",
    "/frontier-eng/contact.html": "/frontier-eng/contact",
    "/frontier-eng/leaderboard.html": "/frontier-eng/leaderboard",
    "/frontier-eng/problem.html": "/frontier-eng/tasks",
  },
  vite: {
    plugins: [tailwindcss(), publicDirectoryIndex()],
  },
});
