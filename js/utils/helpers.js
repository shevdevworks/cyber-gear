/**
 * helpers.js — Pure utility functions
 */

// --------------------------------------------------------------------------
// FORMATTING
// --------------------------------------------------------------------------

/**
 * Formats price from minor units (cents) to a currency string.
 *
 * @param {number} amountInMinorUnits - price in cents
 * @param {string} [currency='USD']
 * @param {string} [locale='en-US']
 * @returns {string} — e.g. "$189"
 */
export function formatPrice(amountInMinorUnits, currency = 'USD', locale = 'en-US') {
  const amount = amountInMinorUnits / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates a unique ID based on time + random number.
 *
 * @returns {string} — e.g. "CG-1703251234-A3F"
 */
export function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 5);
  return `CG-${timestamp}-${random}`.toUpperCase();
}

/**
 * Calculates discount percentage.
 *
 * @param {number} original - original price
 * @param {number} current  - current price
 * @returns {number} — discount percentage (0-100)
 */
export function calcDiscount(original, current) {
  if (original <= 0 || current >= original) return 0;
  return Math.round((1 - current / original) * 100);
}

/**
 * Returns a string with item count and correct plural form.
 *
 * @param {number} count
 * @returns {string}
 */
export function pluralizeItems(count) {
  return count === 1 ? `${count} item` : `${count} items`;
}

// --------------------------------------------------------------------------
// DOM UTILITIES
// --------------------------------------------------------------------------

/**
 * Safe querySelector with a console warning if the element is missing.
 *
 * @param {string} selector
 * @param {Element} [context=document]
 * @returns {Element|null}
 */
export function $(selector, context = document) {
  const el = context.querySelector(selector);
  if (!el) {
    console.warn(`[CyberGear] Element not found: "${selector}"`);
  }
  return el;
}

/**
 * querySelectorAll that returns a real Array.
 *
 * @param {string} selector
 * @param {Element} [context=document]
 * @returns {Element[]}
 */
export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Event delegation handler.
 *
 * @param {Element}  parent   - container element
 * @param {string}   event    - event type ('click', 'change', ...)
 * @param {string}   selector - CSS selector for target child elements
 * @param {Function} handler  - handler, receives (event, matchedElement)
 */
export function delegate(parent, event, selector, handler) {
  parent.addEventListener(event, (e) => {
    const matched = e.target.closest(selector);
    if (matched && parent.contains(matched)) {
      handler(e, matched);
    }
  });
}

/**
 * Delays function execution until `delay` ms have passed without new calls.
 *
 * @param {Function} fn
 * @param {number} delay - milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Restricts a number between min and max.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}