// PostCSS — Tailwind (scoped, preflight off) + autoprefixer.
// Tailwind only injects utilities into files that contain @tailwind directives
// (src/admin/admin.css). The existing index.css has no @tailwind directives,
// so it is unaffected aside from harmless vendor prefixing.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
