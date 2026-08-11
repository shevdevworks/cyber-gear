# CyberGear

**Custom peripherals for those who don't compromise.**

A front-end e-commerce demo — full product catalog, filtering, cart, and checkout — built with **zero frameworks and zero build step**. Just semantic HTML, modern CSS, and vanilla ES modules.

This is a portfolio project. The goal was to see how far a production-shaped UI — state, filtering, validation, custom ARIA controls — gets without React, Vue, or a bundler.

![CyberGear preview](assets/images/og-cover.png)

**[Live Demo →](https://shevdevworks.github.io/cyber-gear/)**

---

## Why this project exists

Most "vanilla JS" portfolio pieces are a single `index.html` with a `<script>` tag. This one is deliberately built like a small real app instead:

- a **centralized store** (pub/sub, channel-based subscriptions, immutable updates) instead of scattered DOM state
- **pure filtering/sorting functions** kept separate from rendering, so business logic doesn't depend on the DOM
- **event delegation** everywhere instead of per-card listeners
- custom controls (listbox, collapsible sections, modal) built on real ARIA patterns — `role`, `aria-selected`, `aria-expanded`, arrow keys, Home/End, Enter, Escape — rather than a mouse-only skin
- a token-based design system in CSS custom properties, not scattered magic values

## Features

**Catalog**
- Filter by category, connectivity, RGB, and price range (dual slider + numeric inputs, kept in sync)
- Live search, sorting (popularity, rating, price, newest), grid/list view toggle
- Collapsible filter groups with animated height transitions
- Mobile filters drawer, sticky header with scroll state

**Cart**
- Slide-out drawer, quantity controls, promo codes (percentage and fixed-amount), persisted to `localStorage`
- Cart state survives page reloads

**Checkout**
- Multi-field form with live validation (name, phone, email, address) and per-field error states
- Custom country-code selector — a real `listbox` widget with flag icons, full keyboard navigation (arrow keys, Home/End, Enter, Escape), and screen-reader labels — not just a styled `<select>`
- Delivery method toggle (courier / pickup) that conditionally requires the address field and recalculates the total
- Simulated async submission with loading and error states

**Design system**
- "Toxic Violet" dark theme — deep-space backgrounds, violet/cyan accents — defined entirely as CSS custom properties in [`css/variables.css`](css/variables.css)
- `:focus-visible` states throughout and `prefers-reduced-motion`–friendly transitions, both in [`css/base.css`](css/base.css)

## Tech stack

| | |
|---|---|
| Markup | Semantic HTML5, ARIA where a native element wasn't enough |
| Styles | CSS3 — custom properties, Grid/Flexbox, no preprocessor |
| Logic | Vanilla JavaScript (ES2022+), native ES modules — no bundler, no framework, no dependencies |
| State | Custom pub/sub store (`store.js`) — Redux-shaped, framework-free |
| Persistence | `localStorage` |

Nothing to install, nothing to build. The whole app ships as static files.

## Project structure

```
cyber-gear/
├── index.html                 # Single-page markup
├── css/
│   ├── variables.css          # Design tokens — colors, spacing, shadows
│   ├── base.css                # Reset + global element styles
│   └── components/            # One stylesheet per UI component
├── js/
│   ├── app.js                  # Entry point — wires up every feature on load
│   ├── modules/
│   │   ├── store.js            # Centralized state (cart, filters, UI, promo)
│   │   ├── catalog.js          # Filtering/sorting (pure) + rendering (DOM)
│   │   ├── cart.js             # Cart drawer
│   │   └── checkout.js         # Checkout modal, validation, phone mask
│   ├── data/products.js        # Product catalog (mock data)
│   └── utils/                  # Small pure helpers (formatting, storage, DOM)
└── assets/
    └── images/
        ├── flags/               # Country flags for the phone selector
        └── *.png                # Product photos, OG cover
```

## Running locally

No build step — any static file server works:

```bash
git clone https://github.com/shevdevworks/cyber-gear.git
cd cyber-gear
npx serve .
# or: python -m http.server, or the VS Code "Live Server" extension
```

ES modules require serving over `http(s)://` — opening `index.html` directly via `file://` will fail on the `import` statements.

## Known limitations

This is a front-end demo — there's no backend, so a few things are intentionally mocked or left as future work:

- Checkout "submission" is simulated (`setTimeout`), no real order is created
- The wishlist button toggles its visual state but isn't persisted yet (tracked with a `TODO` in `catalog.js`)
- Filter persistence helpers exist in `storage.js` but aren't wired up — only the cart currently survives a reload

## Author

Built by [ShevDevWorks](https://github.com/shevdevworks) as a portfolio piece.

This project has no license attached — it's a demo, not a package meant for reuse.
