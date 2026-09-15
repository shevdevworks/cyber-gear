/**
 * store.js — Centralized state store for CyberGear
 */

import { saveCart, loadCart } from '../utils/storage.js';
import { clamp } from '../utils/helpers.js';

// --------------------------------------------------------------------------
// INITIAL STATE
// --------------------------------------------------------------------------

const DEFAULT_FILTERS = {
  categories:   [],         
  connectivity: [],         
  rgb:          false,      
  priceMin:     0,          
  priceMax:     Infinity,   
  searchQuery:  '',         
};

const PROMO_CODES = {
  'CYBER2026':  { type: 'percent', value: 10,   label: '−10%' },
  'GEAR15':     { type: 'percent', value: 15,   label: '−15%' },
  'WELCOME50':  { type: 'fixed',   value: 5000, label: '−$50' }, 
};

const createInitialState = () => ({
  cart:    loadCart(),   
  filters: { ...DEFAULT_FILTERS },
  sortBy:  'popularity', 
  promo: {
    code:     null,   
    discount: 0,      
    label:    null,   
  },
  ui: {
    cartOpen:     false,
    filtersOpen:  false,
    checkoutOpen: false,
    searchOpen:   false,
    viewMode:     'grid',  
  },
});

// --------------------------------------------------------------------------
// STORE FACTORY
// --------------------------------------------------------------------------

function createStore() {
  let state = createInitialState();

  const listeners = new Map([
    ['cart',    new Set()],
    ['filters', new Set()],
    ['ui',      new Set()],
    ['*',       new Set()], 
  ]);

  function getSnapshot() {
    return structuredClone(state);
  }

  function notify(channel) {
    const snapshot = getSnapshot();

    listeners.get(channel)?.forEach(fn => fn(snapshot));
    listeners.get('*')?.forEach(fn => fn(snapshot, channel));
  }

  /**
   * Discount depends on the subtotal, so it has to be recalculated on every
   * cart change — otherwise a 10% code applied to a $300 cart keeps
   * subtracting $30 after items are removed.
   */
  function calcPromoDiscount(code, cart) {
    const promo = PROMO_CODES[code];
    if (!promo) return 0;

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (promo.type === 'percent') return Math.round(subtotal * promo.value / 100);
    if (promo.type === 'fixed')   return Math.min(promo.value, subtotal);
    return 0;
  }

  function setCart(newCart) {
    const promo = newCart.length === 0
      ? { code: null, discount: 0, label: null }
      : { ...state.promo, discount: calcPromoDiscount(state.promo.code, newCart) };

    state = { ...state, cart: newCart, promo };
    saveCart(newCart);
    notify('cart');
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  return {

    getState() {
      return getSnapshot();
    },

    subscribe(fn, channel = '*') {
      if (!listeners.has(channel)) {
        console.warn(`[Store] Unknown channel: "${channel}". Use 'cart', 'filters', 'ui' or '*'`);
        return () => {};
      }
      listeners.get(channel).add(fn);
      fn(getSnapshot());
      return () => listeners.get(channel).delete(fn);
    },

    // ---- CART MANAGEMENT ----

    addToCart(product) {
      const existing = state.cart.find(item => item.id === product.id);

      if (existing) {
        const updatedCart = state.cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        setCart(updatedCart);
      } else {
        const cartItem = {
          id:       product.id,
          name:     product.name,
          brand:    product.brand,
          price:    product.price,      
          oldPrice: product.oldPrice ?? null,
          image:    product.image,
          quantity: 1,
        };
        setCart([...state.cart, cartItem]);
      }
    },

    removeFromCart(productId) {
      const updatedCart = state.cart.filter(item => item.id !== productId);
      setCart(updatedCart);
    },

    updateQuantity(productId, delta) {
      const updatedCart = state.cart.reduce((acc, item) => {
        if (item.id !== productId) {
          acc.push(item);
          return acc;
        }

        const newQty = clamp(item.quantity + delta, 0, 99);

        if (newQty === 0) return acc;

        acc.push({ ...item, quantity: newQty });
        return acc;
      }, []);

      setCart(updatedCart);
    },

    clearCart() {
      setCart([]);
    },

    getCartCount() {
      return state.cart.reduce((sum, item) => sum + item.quantity, 0);
    },

    getCartTotal() {
      return state.cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
    },

    getCartDiscount() {
      return state.cart.reduce((sum, item) => {
        if (!item.oldPrice) return sum;
        return sum + (item.oldPrice - item.price) * item.quantity;
      }, 0);
    },

    // ---- FILTER MANAGEMENT ----

    setFilters(patch) {
      state = {
        ...state,
        filters: { ...state.filters, ...patch },
      };
      notify('filters');
    },

    resetFilters() {
      state = {
        ...state,
        filters: { ...DEFAULT_FILTERS },
      };
      notify('filters');
    },

    setSortBy(sortBy) {
      state = { ...state, sortBy };
      notify('filters'); 
    },

    // ---- PROMO CODES ----

    applyPromo(rawCode) {
      const code  = rawCode.trim().toUpperCase();
      const promo = PROMO_CODES[code];

      if (!promo) {
        return { ok: false, message: 'Promo code not found' };
      }

      if (state.promo.code === code) {
        return { ok: false, message: 'Promo code already applied' };
      }

      const discount = calcPromoDiscount(code, state.cart);

      state = {
        ...state,
        promo: { code, discount, label: promo.label },
      };

      notify('cart'); 
      return { ok: true, message: `Promo code ${code} applied (${promo.label})` };
    },

    removePromo() {
      state = {
        ...state,
        promo: { code: null, discount: 0, label: null },
      };
      notify('cart');
    },

    getPromo() {
      return { ...state.promo };
    },

    // ---- UI STATE MANAGEMENT ----

    setUi(patch) {
      state = {
        ...state,
        ui: { ...state.ui, ...patch },
      };
      notify('ui');
    },
  };
}

export const store = createStore();