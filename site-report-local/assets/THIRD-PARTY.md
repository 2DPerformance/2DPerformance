# Local pilot assets

- Sarabun 400 and 700, Thai and Latin WOFF2 subsets: copied byte-for-byte from `public/fonts/sarabun/` in the StructVault repository. Licensed under SIL OFL 1.1; see `SARABUN-OFL.txt`. License source: https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/OFL.txt (retrieved 2026-09-04).
- Lucide 1.8.0 browser UMD: copied byte-for-byte from the bundled Codex runtime's `lucide/dist/umd/lucide.min.js`; ISC plus Feather-derived icon MIT notices retained in `LUCIDE-LICENSE.txt`. Optional source map is not needed at runtime and is not hosted. No dependency install or CDN request.
- `icon-512.png`: copied byte-for-byte from the existing StructVault brand asset `public/brand/naichangyai-engineering-icon-512.png`. Used as the existing product identity, not a new logo or engineering approval mark.

All runtime assets are same-origin and included in the versioned offline app shell.
