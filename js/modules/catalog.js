/**
 * catalog.js — Product catalog module.
 * Filtering (getFilteredProducts) stays pure and DOM-free; rendering
 * (renderCatalog, createProductCard) stays free of business logic.
 */

import { store }                          from './store.js';
import PRODUCTS                           from '../data/products.js';
import { formatPrice, calcDiscount, pluralizeItems, $, delegate } from '../utils/helpers.js';

// --------------------------------------------------------------------------
// FILTERING AND SORTING — pure functions
// --------------------------------------------------------------------------

/**
 * Applies current filters and sorting to the product array.
 * Pure function: does not mutate PRODUCTS or state — only computes the result.
 *
 * @param {Product[]} products   — source array (always pass PRODUCTS)
 * @param {Object}    filters    — state.filters from store
 * @param {string}    sortBy     — state.sortBy from store
 * @returns {Product[]}          — new filtered and sorted array
 */
export function getFilteredProducts(products, filters, sortBy) {
  /*
    .filter().sort() CHAIN — an elegant functional pipeline.
    Each step returns a new array, never mutating the previous one.

    Order of steps matters for performance:
    First filter (reduce array size), then sort (fewer comparisons).
  */
  const result = products
    .filter(p => filterByCategory(p, filters))
    .filter(p => filterByConnectivity(p, filters))
    .filter(p => filterByRgb(p, filters))
    .filter(p => filterByPrice(p, filters))
    .filter(p => filterBySearch(p, filters));

  return sortProducts(result, sortBy);
}

/**
 * Category filter.
 * An empty categories array = "all categories" (filter inactive).
 */
function filterByCategory(product, filters) {
  if (filters.categories.length === 0) return true;
  return filters.categories.includes(product.category);
}

/**
 * Connectivity type filter.
 * Product with connectivity: 'both' passes any connectivity filter.
 */
function filterByConnectivity(product, filters) {
  if (filters.connectivity.length === 0) return true;

  const conn = product.specs?.connectivity;
  if (!conn) return false;

  // 'both' = product supports both connection types
  if (conn === 'both') return true;

  return filters.connectivity.includes(conn);
}

/** RGB filter — if false, allow all products */
function filterByRgb(product, filters) {
  if (!filters.rgb) return true;
  return product.specs?.rgb === true;
}

/**
 * Price filter.
 * Compares product price (in minor units) with filter boundaries.
 * priceMax: Infinity in DEFAULT_FILTERS means "no upper limit".
 */
function filterByPrice(product, filters) {
  if (filters.priceMin === 0 && filters.priceMax === Infinity) return true;

  const price = product.price;
  const min = filters.priceMin ?? 0;
  const max = filters.priceMax ?? Infinity;

  return price >= min && price <= max;
}

/**
 * Full-text search across multiple fields.
 * toLowerCase() on both — case-insensitive search.
 */
function filterBySearch(product, filters) {
  const q = filters.searchQuery?.trim().toLowerCase();
  if (!q) return true;

  // Search across several fields with ||
  return (
    product.name.toLowerCase().includes(q)        ||
    product.brand.toLowerCase().includes(q)       ||
    product.description.toLowerCase().includes(q) ||
    product.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

/**
 * Product sorting.
 *
 * IMPORTANT: Array.sort() mutates the array!
 * Therefore we accept a .slice() copy from getFilteredProducts —
 * filter() already returns a new array, so sorting directly is safe.
 */
function sortProducts(products, sortBy) {
  /*
    [...products] creates a copy before sorting.
    Although .filter() already returned a new array, we do this explicitly —
    protection against future refactorings where someone removes .filter().
  */
  const sorted = [...products];

  switch (sortBy) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price);

    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price);

    case 'rating':
      /*
        Two-level sort: first by rating, then by review count on equal rating.
        A product with 4.5 rating and 1000 reviews is "more reliable"
        than one with 4.5 and 3 reviews.
      */
      return sorted.sort((a, b) =>
        b.rating - a.rating || b.reviewCount - a.reviewCount
      );

    case 'new':
      /*
        New arrivals first, then by popularity among the rest.
        true > false in JS: true - false = 1 (new item higher)
      */
      return sorted.sort((a, b) =>
        (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) ||
        b.popularity - a.popularity
      );

    case 'popularity':
    default:
      return sorted.sort((a, b) => b.popularity - a.popularity);
  }
}

// --------------------------------------------------------------------------
// RENDERING — building DOM from data
// --------------------------------------------------------------------------

/*
  The empty-state <li> lives inside the grid, so grid.innerHTML = '' used to
  delete it on the very first render — "Nothing found" could never appear.
  Keep a reference to the node and put it back after every render.
*/
let emptyStateEl = null;

/**
 * Renders the product grid into the container.
 * Uses innerHTML for card markup — safe here because it's built from
 * PRODUCTS, not user input (user input always goes through textContent).
 *
 * @param {Product[]} productsList — filtered array to display
 */
export function renderCatalog(productsList) {
  const grid    = document.querySelector('[data-js="product-grid"]');
  const countEl = document.querySelector('[data-js="catalog-count"]');

  if (!grid) return;

  emptyStateEl ??= document.querySelector('[data-js="catalog-empty"]');
  const emptyEl = emptyStateEl;

  // Update results counter
  if (countEl) {
    countEl.textContent = pluralizeItems(productsList.length);
  }

  // Empty state
  if (productsList.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) {
      emptyEl.hidden = false;
      grid.appendChild(emptyEl);
    }
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  // Build all cards into a DocumentFragment first, then insert once —
  // avoids one reflow per card
  const fragment = document.createDocumentFragment();

  // Temporary container for parsing HTML string into DOM nodes
  const temp = document.createElement('div');

  productsList.forEach((product, index) => {
    temp.innerHTML = createProductCard(product, index);
    // appendChild moves the node (not copies it) — temp is empty again after this
    fragment.appendChild(temp.firstElementChild);
  });

  // One reflow instead of N
  grid.innerHTML = '';
  grid.appendChild(fragment);
}

/**
 * Creates an HTML string for a single product card.
 *
 * @param {Product} product
 * @param {number}  index    — for stagger animation (--card-index)
 * @returns {string}         — valid HTML
 */
function createProductCard(product, index) {
  const {
    id, name, brand, category, price, oldPrice,
    image, rating, reviewCount, isNew, inStock, specs,
  } = product;

  // Compute derived values HERE, not in the template
  const discount      = oldPrice ? calcDiscount(oldPrice, price) : 0;
  const formattedPrice    = formatPrice(price);
  const formattedOldPrice = oldPrice ? formatPrice(oldPrice) : null;
  const starsHtml     = renderStars(rating);
  const categoryLabel = CATEGORY_LABELS[category] ?? category;

  /*
    Why class strings via ternary instead of classList?
    In template strings we build raw HTML — there is no DOM element
    to call classList on. Ternary is the only option.
  */
  const cardClass = [
    'product-card',
    !inStock ? 'product-card--out-of-stock' : '',
  ].filter(Boolean).join(' ');

  return `
    <li
      class="${cardClass}"
      style="--card-index: ${index}"
      data-js="product-card"
      data-product-id="${id}"
      data-category="${category}"
    >

      <!-- Media block -->
      <div class="product-card__media">

        <!-- Badges over the image -->
        <div class="product-card__badges">
          ${isNew ? '<span class="badge badge--new">New</span>' : ''}
          ${discount > 0 ? `<span class="badge badge--discount">−${discount}%</span>` : ''}
          ${!inStock ? '<span class="badge badge--out-of-stock">Out of stock</span>' : ''}
        </div>

        <!-- Wishlist button -->
        <button
          class="product-card__wishlist"
          data-js="wishlist-toggle"
          data-product-id="${id}"
          aria-label="Add ${name} to wishlist"
          aria-pressed="false"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 13.5S1.5 9.5 1.5 5.5A3.5 3.5 0 0 1 8 3.622 3.5 3.5 0 0 1 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z"
              stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Image -->
        <img
          class="product-card__image"
          src="${image}"
          alt="${name}"
          loading="lazy"
          width="400"
          height="300"
          onerror="this.style.display='none'; this.parentNode.querySelector('.product-card__image-placeholder').style.display='flex'"
        />
        <!-- Placeholder shown on image load error -->
        <div class="product-card__image-placeholder" style="display:none" aria-hidden="true">
          ${CATEGORY_ICONS[category] ?? '📦'}
        </div>

      </div>

      <!-- Card body -->
      <div class="product-card__body">

        <span class="product-card__brand">${brand}</span>

        <h3 class="product-card__name">${name}</h3>

        <!-- Rating -->
        <div class="product-card__rating">
          <div class="product-card__stars" aria-hidden="true">${starsHtml}</div>
          <span class="product-card__rating-value">${rating.toFixed(1)}</span>
          <span class="product-card__review-count">(${reviewCount})</span>
        </div>

        <!-- Specs (show 2-3 key ones) -->
        <ul class="product-card__specs" aria-label="Specifications">
          ${renderSpecChips(specs, category)}
        </ul>

      </div>

      <!-- Footer: price + button -->
      <div class="product-card__footer">

        <div class="product-card__price-wrap">
          <span class="product-card__price">${formattedPrice}</span>
          ${formattedOldPrice
            ? `<span class="product-card__old-price">${formattedOldPrice}</span>`
            : ''
          }
        </div>

        <!--
          data-product-id — hook for event delegation.
          Click on this button bubbles up to [data-js="product-grid"],
          where we intercept it and read dataset.productId.
        -->
        <button
          class="product-card__add-btn"
          data-js="add-to-cart"
          data-product-id="${id}"
          data-product-name="${name}"
          aria-label="Add ${name} to cart"
          ${!inStock ? 'disabled aria-disabled="true"' : ''}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 3.75v10.5M3.75 9h10.5"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

      </div>

    </li>
  `;
}

// --------------------------------------------------------------------------
// RENDER HELPER FUNCTIONS
// --------------------------------------------------------------------------

/**
 * Generates rating stars HTML.
 * Supports fractional values (4.7 → 4 full + 1 partial).
 *
 * @param {number} rating — 0.0 – 5.0
 * @returns {string}      — HTML string
 */
function renderStars(rating) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < Math.floor(rating);     // Full star
    const half   = !filled && i < rating;      // Half star (4.7 → 5th star = half)

    if (filled) return '<span class="star star--full">★</span>';
    if (half)   return '<span class="star star--half">★</span>';
    return            '<span class="star star--empty">☆</span>';
  }).join('');
}

/**
 * Renders specification chips.
 * Each category has its own key specs to display.
 *
 * @param {Object} specs
 * @param {string} category
 * @returns {string}
 */
function renderSpecChips(specs, category) {
  if (!specs) return '';

  // List of fields we want to show for each category
  const specFields = SPEC_DISPLAY_FIELDS[category] ?? [];

  return specFields
    .filter(field => specs[field.key] !== undefined)
    .slice(0, 3) // Max 3 chips — keep the card clean
    .map(field => {
      const value = specs[field.key];
      // Boolean fields get a special display
      const label = typeof value === 'boolean'
        ? (value ? field.trueLabel : field.falseLabel)
        : (field.labels?.[value] ?? value);

      if (!label) return '';
      return `<li class="spec-chip">${label}</li>`;
    })
    .filter(Boolean)
    .join('');
}

// --------------------------------------------------------------------------
// CONSTANTS — display data
// --------------------------------------------------------------------------

const CATEGORY_LABELS = {
  keyboards: 'Keyboards',
  mice:      'Mice',
  headsets:  'Headsets',
};

const CATEGORY_ICONS = {
  keyboards: '⌨️',
  mice:      '🖱️',
  headsets:  '🎧',
};

/**
 * Configuration: which spec fields to display per category.
 * trueLabel / falseLabel — for boolean fields (rgb: true → "RGB")
 */
/** Raw spec values → human-readable chip text ("both" alone means nothing) */
const CONNECTIVITY_LABELS = {
  wired:    'Wired',
  wireless: 'Wireless',
  both:     'Wired + wireless',
};

const SPEC_DISPLAY_FIELDS = {
  keyboards: [
    { key: 'switch',       },
    { key: 'connectivity', labels: CONNECTIVITY_LABELS },
    { key: 'rgb',          trueLabel: 'RGB lighting', falseLabel: null },
  ],
  mice: [
    { key: 'sensor',       },
    { key: 'weight',       },
    { key: 'connectivity', labels: CONNECTIVITY_LABELS },
  ],
  headsets: [
    { key: 'drivers',      },
    { key: 'connectivity', labels: CONNECTIVITY_LABELS },
    { key: 'microphone',   },
  ],
};

// --------------------------------------------------------------------------
// TOOLBAR UI UPDATE
// --------------------------------------------------------------------------

/**
 * Updates catalog title when category changes.
 * @param {string[]} activeCategories
 */
function updateCatalogTitle(activeCategories) {
  const titleEl = document.querySelector('[data-js="catalog-title"]');
  if (!titleEl) return;

  if (activeCategories.length === 0) {
    titleEl.textContent = 'All products';
  } else if (activeCategories.length === 1) {
    titleEl.textContent = CATEGORY_LABELS[activeCategories[0]] ?? 'Products';
  } else {
    titleEl.textContent = 'Multiple categories';
  }
}

/**
 * Updates the active filters count badge.
 * @param {Object} filters
 */
function updateActiveFiltersBadge(filters) {
  const badge = document.querySelector('[data-js="active-filters-count"]');
  if (!badge) return;

  let count = 0;
  if (filters.categories.length > 0)   count += filters.categories.length;
  if (filters.connectivity.length > 0) count += filters.connectivity.length;
  if (filters.rgb)                      count += 1;
  if (filters.priceMin > 0)            count += 1;
  if (filters.priceMax !== Infinity)    count += 1;
  if (filters.searchQuery)             count += 1;

  badge.textContent = count;
  badge.hidden = count === 0;
}

// --------------------------------------------------------------------------
// MODULE INITIALIZATION
// --------------------------------------------------------------------------

/**
 * Entry point for the catalog module.
 * Called from app.js once at startup.
 *
 * Subscribes to store → whenever filters/sorting change,
 * recalculates the product list and rerenders the grid.
 */
export function initCatalog() {
  /*
    Subscribe to the 'filters' channel.
    store.subscribe calls the callback IMMEDIATELY with current state —
    this means the catalog will render automatically on initialization.
    We don't need a separate "first render" — the subscription handles it.
  */
  store.subscribe((state) => {
    const filtered = getFilteredProducts(
      PRODUCTS,
      state.filters,
      state.sortBy,
    );

    renderCatalog(filtered);
    updateCatalogTitle(state.filters.categories);
    updateActiveFiltersBadge(state.filters);
  }, 'filters');

  // Initialize click delegation on product cards
  initCardDelegation();
}

/**
 * Event delegation inside the product grid.
 *
 * EVENT DELEGATION PATTERN:
 * Instead of N listeners on N cards — one listener on the parent.
 * Works for cards added later (after filtering).
 */
function initCardDelegation() {
  const grid = document.querySelector('[data-js="product-grid"]');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    // "Add to cart" button
    const addBtn = e.target.closest('[data-js="add-to-cart"]');
    if (addBtn) {
      handleAddToCart(addBtn);
      return;
    }

    // Wishlist button
    const wishlistBtn = e.target.closest('[data-js="wishlist-toggle"]');
    if (wishlistBtn) {
      handleWishlistToggle(wishlistBtn);
      return;
    }
  });
}

/**
 * Add to cart handler.
 * @param {HTMLElement} btn — button with data-product-id
 */
function handleAddToCart(btn) {
  const productId = btn.dataset.productId;
  const product   = PRODUCTS.find(p => p.id === productId);

  if (!product || !product.inStock) return;

  store.addToCart(product);

  // Visual feedback: button → "added" for 1.5 seconds
  btn.classList.add('product-card__add-btn--added');
  btn.setAttribute('aria-label', `${product.name} added to cart`);

  // Change icon to checkmark
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 9l4.5 4.5L15 5"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  setTimeout(() => {
    btn.classList.remove('product-card__add-btn--added');
    btn.setAttribute('aria-label', `Add ${product.name} to cart`);
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 3.75v10.5M3.75 9h10.5"
          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }, 1500);
}

/**
 * Wishlist button handler.
 * @param {HTMLElement} btn
 */
function handleWishlistToggle(btn) {
  const isActive = btn.getAttribute('aria-pressed') === 'true';
  btn.setAttribute('aria-pressed', String(!isActive));
  btn.classList.toggle('product-card__wishlist--active', !isActive);
  // TODO: store.toggleWishlist(productId) — to be implemented in the next steps
}