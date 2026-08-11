/**
 * storage.js — LocalStorage persistence utilities
 */

const STORAGE_KEYS = {
  CART: 'cybergear:cart',
  FILTERS: 'cybergear:filters',
};

// --------------------------------------------------------------------------
// CART STORAGE
// --------------------------------------------------------------------------

/**
 * Saves the cart array to localStorage.
 *
 * @param {Array} cart - array of CartItem objects
 * @returns {boolean} — true if saved successfully
 */
export function saveCart(cart) {
  try {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    return true;
  } catch (error) {
    console.warn('[CyberGear Storage] Failed to save cart:', error);
    return false;
  }
}

/**
 * Loads the cart array from localStorage.
 *
 * @returns {Array}
 */
export function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CART);
    if (raw === null) return [];
    
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[CyberGear Storage] Failed to load cart:', error);
    return [];
  }
}

/**
 * Clears the cart from storage.
 */
export function clearCartStorage() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CART);
  } catch (error) {
    console.warn('[CyberGear Storage] Failed to clear cart:', error);
  }
}

// --------------------------------------------------------------------------
// FILTERS STORAGE
// --------------------------------------------------------------------------

/**
 * Saves filters object to localStorage.
 * * @param {Object} filters
 * @returns {boolean}
 */
export function saveFilters(filters) {
  try {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
    return true;
  } catch (error) {
    console.warn('[CyberGear Storage] Failed to save filters:', error);
    return false;
  }
}

/**
 * Loads filters object from localStorage.
 *
 * @returns {Object|null}
 */
export function loadFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FILTERS);
    if (raw === null) return null;

    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
  } catch (error) {
    console.warn('[CyberGear Storage] Failed to load filters:', error);
    return null;
  }
}