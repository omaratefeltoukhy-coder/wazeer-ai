# Wazeer Logo Assets

Vector source files for the Wazeer logo. Use these in the app, in
marketing material, in emails, and anywhere a logo is needed.

## Files

| File | Use |
|---|---|
| `wazeer-mark.svg` | Square mark only (256×256). Use as app icon, social avatar, or anywhere a small standalone symbol is needed. |
| `wazeer-logo.svg` | Horizontal lockup — mark + "Wazeer" wordmark. Use on light backgrounds. |
| `wazeer-logo-dark.svg` | Same lockup on a deep-navy background — for dark mode, dark hero sections, or printed marketing on dark. |
| `favicon.svg` | 64×64 simplified favicon for browser tabs. Already wired via `<link rel="icon">` if needed. |

## Brand spec

- **Royal Blue** `#2563EB` — gradient start
- **Emerald** `#10B981` — gradient end + accent dot
- **Deep Navy** `#07111F` — dark backgrounds
- **Charcoal** `#111827` — wordmark on light surfaces
- **Soft White** `#F8FAFC` / `#FFFFFF` — wordmark on dark surfaces
- **Gradient** — `linear-gradient(135deg, #2563EB 0%, #10B981 100%)`
- **Wordmark font** — Plus Jakarta Sans (Bold / 700)

## Exporting to PNG

The SVGs are the source of truth. To export raster sizes:

```powershell
# With Inkscape (if installed)
inkscape wazeer-mark.svg --export-type=png --export-filename=wazeer-mark@2x.png -w 512

# Or open the SVG in any browser, screenshot, or use https://realfavicongenerator.net
```

## Usage in code

The React `Logo` component at `src/components/wazeer/Logo.tsx` currently
draws the lockup with inline JSX/CSS — keep that as the in-app logo so
brand color changes via Tailwind tokens propagate automatically. Use
these SVG files for **external** surfaces (emails, OG images, App Store
icons, partner co-branded materials, README headers).
