// Static export: `next build` writes the whole site to ./out. Upload that folder to any static host.
/** @type {import('next').NextConfig} */
export default {
  output: "export",
  trailingSlash: true,        // /sales/view/ is served from sales/view/index.html, so no server rewrite rules are needed
  images: { unoptimized: true },
};
