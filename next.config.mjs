/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static site: `next build` emits an `out/` folder of static files,
  // deployable to any static host with no Node server at runtime.
  output: 'export',
  images: { unoptimized: true },
  // Uncomment and set when deploying under a sub-path (e.g. GitHub Pages):
  // basePath: '/end-of-the-fast',
};

export default nextConfig;
