import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  configurable: true,
});

const { store } = await import('../js/modules/store.js');
const { getFilteredProducts } = await import('../js/modules/catalog.js');
const { loadWishlist } = await import('../js/utils/storage.js');
const { default: products } = await import('../js/data/products.js');
const keyboard = products.find(product => product.id === 'kb-wooting-60he');
const mouse = products.find(product => product.id === 'ms-razer-viper-v3-pro');

beforeEach(() => {
  store.clearCart();
  store.resetFilters();
  store.getState().wishlist.forEach(id => store.toggleWishlist(id));
});

test('saved products persist independently of cart and combine with category filters', () => {
  store.toggleWishlist(keyboard.id);
  store.toggleWishlist(mouse.id);
  store.addToCart(mouse);
  store.clearCart();
  assert.deepEqual(loadWishlist(), [keyboard.id, mouse.id]);
  store.setFilters({ savedOnly: true, categories: ['keyboards'] });
  const state = store.getState();
  assert.deepEqual(getFilteredProducts(products, state.filters, state.sortBy, state.wishlist).map(p => p.id), [keyboard.id]);
  store.toggleWishlist(keyboard.id);
  assert.deepEqual(loadWishlist(), [mouse.id]);
});

test('adding a setup preserves item quantities and caps repeated additions at 99', () => {
  store.addToCart(keyboard);
  store.addToCart(mouse);
  store.addToCart(keyboard);
  assert.equal(store.getCartTotal(), keyboard.price * 2 + mouse.price);
  assert.equal(store.getCartCount(), 3);
  for (let count = 0; count < 105; count++) store.addToCart(keyboard);
  assert.equal(store.getState().cart.find(item => item.id === keyboard.id).quantity, 99);
  store.addToCart(products.find(product => !product.inStock));
  assert.equal(store.getState().cart.length, 2);
});

test('percentage promo recalculates when quantities change and resets with an empty cart', () => {
  store.addToCart(keyboard);
  assert.equal(store.applyPromo(' cyber2026 ').ok, true);
  assert.equal(store.getPromo().discount, 1990);
  store.updateQuantity(keyboard.id, 1);
  assert.equal(store.getPromo().discount, 3980);
  store.removeFromCart(keyboard.id);
  assert.equal(store.getPromo().discount, 0);
  assert.equal(store.getPromo().code, null);
});

test('fixed promo cannot make the order negative', () => {
  store.addToCart({ ...keyboard, price: 2000 });
  store.applyPromo('WELCOME50');
  assert.equal(store.getPromo().discount, 2000);
});

test('empty search results and sorting do not mutate the original catalog', () => {
  const originalOrder = products.map(product => product.id);
  store.setFilters({ searchQuery: 'no-such-product-7391' });
  assert.equal(getFilteredProducts(products, store.getState().filters, 'popularity').length, 0);
  store.resetFilters();
  const sorted = getFilteredProducts(products, store.getState().filters, 'price-asc');
  assert.ok(sorted.every((product, index) => index === 0 || product.price >= sorted[index - 1].price));
  assert.deepEqual(products.map(product => product.id), originalOrder);
});

test('malformed saved data falls back safely and does not produce duplicate IDs', () => {
  storage.set('cybergear:wishlist', 'invalid JSON');
  assert.deepEqual(loadWishlist(), []);
  storage.set('cybergear:wishlist', JSON.stringify([keyboard.id, keyboard.id, null, 42]));
  assert.deepEqual(loadWishlist(), [keyboard.id]);
});
