# CyberGear — Performance Studio

A product-led storefront for keyboards, mice and audio. Graphite product stages, silver catalog surfaces and restrained motion, built with semantic HTML, CSS and vanilla JavaScript modules.

[Live demo](https://shevdevworks.github.io/cyber-gear/)

![CyberGear storefront](assets/images/og-cover.png)

## The experience

- Animated product spotlight with three featured keyboards and pointer-responsive perspective.
- Search, category/connection/RGB/price filters, sorting and grid/list views.
- Product details with shareable hash URLs, image zoom, specifications and related gear.
- Saved products persisted in local storage, with a dedicated collection view.
- Interactive setup builder: three presets, individually selectable components, live totals and one-click addition to the cart.
- Persistent cart, quantity controls and percentage/fixed demo promo codes.
- Simulated checkout with field validation, country dialing codes, courier/pickup options and an explicit demo confirmation.
- Free demo courier delivery at $200 or more after discounts; otherwise $5. Pickup is free.
- Keyboard-accessible dialogs and drawers, managed focus and reduced-motion support.

## Run locally

No dependencies or build step are required. Serve the repository over HTTP:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open [localhost:4173](http://127.0.0.1:4173). ES modules require HTTP; opening the HTML directly as a file will not work. Hard-refresh after editing if your static server or browser caches modules.

## Verification

Run the state and filtering regression tests with Node.js:

```sh
node --test tests/store.test.mjs
```

The tests cover saved-item persistence, saved/category filter combinations, setup quantities, stock restrictions, quantity limits, percentage/fixed promo calculations and non-mutating sorting.

Browser checks cover the main shopping flow, mobile filters, focus containment, product navigation, reduced motion and viewport widths from 320 to 1440 px.

## Structure

```text
index.html                  Page, setup builder, cart and checkout markup
css/variables.css           Shared design tokens
css/components/             Component styles and studio layout
js/app.js                   Application wiring, navigation and layer management
js/modules/studio.js        Spotlight, setup builder, saved view and product dialogs
js/modules/catalog.js       Filtering, sorting and keyed card rendering
js/modules/store.js         State, cart, wishlist and promo calculations
js/modules/cart.js          Cart rendering and controls
js/modules/checkout.js      Validation and simulated order flow
js/data/products.js         Sample catalog
js/utils/                   Formatting, storage and notifications
tests/store.test.mjs        State and filtering regression tests
```

## Demo boundaries

This is an independent portfolio concept. There is no backend, payment provider, real order creation or fulfillment. Checkout fields stay in browser memory and are not submitted to a server. Use sample details when testing.

Cart and saved product IDs remain in this browser's local storage. Filters reset on reload. Product imagery, names and trademarks belong to their respective owners; prices, ratings, availability and specifications are sample data. Google Fonts is the only external runtime asset service.

Built by [ShevDevWorks](https://github.com/shevdevworks).
