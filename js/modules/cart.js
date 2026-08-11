/**
 * cart.js — Cart rendering module
 */

import { store } from './store.js';
import { formatPrice, $, delegate, pluralizeItems } from '../utils/helpers.js';

// --------------------------------------------------------------------------
// DOM CACHE
// --------------------------------------------------------------------------
const DOM = {};

function cacheDom() {
  DOM.listEl       = $('[data-js="cart-list"]');        
  DOM.emptyEl      = $('[data-js="cart-empty"]');        
  DOM.summaryEl    = $('[data-js="cart-summary"]');      
  DOM.totalCountEl = $('[data-js="cart-total-count"]');  

  DOM.subtotalEl   = $('[data-js="cart-subtotal"]');     
  DOM.discountRow  = $('[data-js="cart-discount-row"]');
  DOM.discountEl   = $('[data-js="cart-discount"]');
  DOM.totalEl      = $('[data-js="cart-total"]');       

  DOM.promoInput   = $('[data-js="promo-input"]');
  DOM.promoBtn     = $('[data-js="promo-apply"]');
  DOM.promoMsg     = $('[data-js="promo-message"]');
}

// --------------------------------------------------------------------------
// RENDER ITEM LIST
// --------------------------------------------------------------------------
function renderCartList(items) {
  if (!DOM.listEl) return;

  const isEmpty = items.length === 0;

  DOM.listEl.hidden = isEmpty;
  if (DOM.emptyEl)   DOM.emptyEl.hidden   = !isEmpty;
  if (DOM.summaryEl) DOM.summaryEl.hidden = isEmpty;

  if (isEmpty) return; 

  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.dataset.productId = item.id;

    li.innerHTML = `
      <img
        class="cart-item__image"
        src="${item.image}"
        alt="${item.name}"
        width="64" height="64"
      >
      <div class="cart-item__info">
        <p class="cart-item__name">${item.name}</p>
        <div class="cart-item__controls">
          <button
            class="cart-item__qty-btn"
            data-js="cart-qty-decrease"
            aria-label="Decrease quantity"
            ${item.quantity <= 1 ? 'disabled aria-disabled="true"' : ''}
          >−</button>
          <span class="cart-item__qty" data-js="cart-qty">${item.quantity}</span>
          <button
            class="cart-item__qty-btn"
            data-js="cart-qty-increase"
            aria-label="Increase quantity"
          >+</button>
        </div>
      </div>
      <div class="cart-item__right">
        <p class="cart-item__price">${formatPrice(item.price * item.quantity)}</p>
        <button
          class="cart-item__remove"
          data-js="cart-remove"
          aria-label="Remove from cart"
        >×</button>
      </div>
    `;

    fragment.appendChild(li);
  });

  DOM.listEl.innerHTML = '';
  DOM.listEl.appendChild(fragment);
}

// --------------------------------------------------------------------------
// UPDATE TOTALS
// --------------------------------------------------------------------------
function updateTotals(cart, promo) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = promo?.discount ?? 0;
  const total    = subtotal - discount;

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (DOM.totalCountEl) DOM.totalCountEl.textContent = pluralizeItems(totalQty);
  if (DOM.subtotalEl)   DOM.subtotalEl.textContent   = formatPrice(subtotal);
  if (DOM.totalEl)      DOM.totalEl.textContent      = formatPrice(Math.max(total, 0));

  const hasDiscount = discount > 0;
  if (DOM.discountRow) DOM.discountRow.hidden = !hasDiscount;
  if (DOM.discountEl)  DOM.discountEl.textContent = `−${formatPrice(discount)}`;
}

// --------------------------------------------------------------------------
// PROMO CODE
// --------------------------------------------------------------------------
function handlePromo() {
  if (!DOM.promoInput) return;

  const code = DOM.promoInput.value;
  if (!code.trim()) return;

  const result = store.applyPromo(code);

  if (DOM.promoMsg) {
    DOM.promoMsg.textContent = result.message;
    DOM.promoMsg.hidden = false;
    DOM.promoMsg.classList.toggle('cart__promo-message--success', result.ok);
    DOM.promoMsg.classList.toggle('cart__promo-message--error', !result.ok);
  }

  if (result.ok) DOM.promoInput.value = '';
}

// --------------------------------------------------------------------------
// EVENT BINDING
// --------------------------------------------------------------------------
function bindListEvents() {
  if (!DOM.listEl) return;

  delegate(DOM.listEl, 'click', '[data-js="cart-remove"]', (e, el) => {
    const li = el.closest('.cart-item');
    const id = li?.dataset.productId;
    if (!id) return;

    li.classList.add('cart-item--removing');
    li.addEventListener('transitionend', () => {
      store.removeFromCart(id);
    }, { once: true });
  });

  delegate(DOM.listEl, 'click', '[data-js="cart-qty-increase"]', (e, el) => {
    const li = el.closest('.cart-item');
    const id = li?.dataset.productId;
    if (!id) return;
    store.updateQuantity(id, +1);
  });

  delegate(DOM.listEl, 'click', '[data-js="cart-qty-decrease"]', (e, el) => {
    const li = el.closest('.cart-item');
    const id = li?.dataset.productId;
    if (!id) return;
    store.updateQuantity(id, -1);
  });
}

// --------------------------------------------------------------------------
// INIT
// --------------------------------------------------------------------------
export function initCart() {
  cacheDom();

  store.subscribe((state) => {
    renderCartList(state.cart);
    updateTotals(state.cart, state.promo);
  }, 'cart');

  DOM.promoBtn?.addEventListener('click', handlePromo);
  DOM.promoInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePromo();
  });

  bindListEvents();

  $('[data-js="checkout-open"]')?.addEventListener('click', () => {
    store.setUi({ checkoutOpen: true });
  });
}