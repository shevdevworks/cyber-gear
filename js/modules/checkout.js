/**
 * checkout.js — Checkout module
 */

import { store } from './store.js';
import { formatPrice, generateOrderId } from '../utils/helpers.js';
import { showToast } from '../utils/toast.js';

// --------------------------------------------------------------------------
// DOM CACHE
// --------------------------------------------------------------------------

let DOM = {};
let closePhoneCountryList  = () => {};
let resetPhoneCountrySelect = () => {};
let autoCloseTimer = null;

function cacheDomNodes() {
  DOM = {
    modal:          document.querySelector('[data-js="checkout-modal"]'),
    panel:          document.querySelector('.checkout-modal__panel'),
    closeButtons:   document.querySelectorAll('[data-js="checkout-close"]'),
    form:           document.querySelector('[data-js="checkout-form"]'),
    submitBtn:      document.querySelector('[data-js="checkout-submit"]'),
    checkoutTotal:  document.querySelector('[data-js="checkout-total"]'),
    successScreen:  document.querySelector('[data-js="checkout-success"]'),
    orderNumber:    document.querySelector('[data-js="order-number"]'),

    // Form fields
    fields: {
      name:    document.querySelector('[data-js="checkout-name"]'),
      phone:   document.querySelector('[data-js="checkout-phone"]'),
      email:   document.querySelector('[data-js="checkout-email"]'),
      address: document.querySelector('[data-js="checkout-address"]'),
    },
    
    // Country code selector (custom dropdown — a native <select> can't show flag images)
    phoneCountryBtn:  document.querySelector('[data-js="phone-country-btn"]'),
    phoneCountryList: document.querySelector('[data-js="phone-country-list"]'),
    phoneCountryFlag: document.querySelector('[data-js="phone-country-flag"]'),
    phoneCountryDial: document.querySelector('[data-js="phone-country-dial"]'),

    // Delivery options
    deliveryRadios:   document.querySelectorAll('[data-js="delivery-type"]'),
    addressFieldWrap: document.querySelector('#address-field-wrap'),
  };
}

// --------------------------------------------------------------------------
// PUBLIC API
// --------------------------------------------------------------------------

/**
 * Initializes checkout and subscribes to UI store
 */
export function initCheckout() {
  cacheDomNodes();
  if (!DOM.modal) return;

  // Force hide modal on init
  DOM.modal.hidden = true;
  if (DOM.successScreen) DOM.successScreen.hidden = true;
  if (DOM.form)          DOM.form.hidden          = false;

  let wasOpen = false;

  store.subscribe(({ ui, cart, promo }) => {
    // Strict check: only explicit true opens the modal
    const isOpen = ui.checkoutOpen === true;
    if (isOpen === wasOpen) return;
    wasOpen = isOpen;

    DOM.modal.hidden = !isOpen;

    if (isOpen) {
      updateOrderTotal(cart, promo);
      // On touch devices autofocus pops the keyboard over the sheet right away —
      // only do it where there's a real pointer
      if (window.matchMedia('(hover: hover)').matches) {
        setTimeout(() => DOM.fields.name?.focus(), 350);
      } else {
        DOM.panel?.setAttribute('tabindex', '-1');
        DOM.panel?.focus({ preventScroll: true });
      }
    }
  }, 'ui');

  // Sync total when cart changes while modal is open
  store.subscribe(({ cart, promo, ui }) => {
    if (ui.checkoutOpen) updateOrderTotal(cart, promo);
  }, 'cart');

  initCloseHandlers();
  initPhoneCountrySelect();
  initPhoneMask();
  initLiveValidation();
  initDeliverySteps();
  initFormSubmit();
}

// --------------------------------------------------------------------------
// MODAL STATE
// --------------------------------------------------------------------------

function initCloseHandlers() {
  DOM.closeButtons.forEach(btn => {
    btn.addEventListener('click', closeCheckout);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    // The country dropdown sits visually above the rest of the modal —
    // close it first, and don't let the checkout-close logic below run too.
    if (DOM.phoneCountryBtn?.getAttribute('aria-expanded') === 'true') {
      e.stopImmediatePropagation();
      closePhoneCountryList();
      DOM.phoneCountryBtn.focus();
      return;
    }

    if (store.getState().ui.checkoutOpen) {
      // Checkout sits on top of the cart drawer; stop other Escape listeners
      // (cart, filters — registered later on the same document node) from
      // also firing, so Esc closes one layer at a time.
      e.stopImmediatePropagation();
      closeCheckout();
    }
  });
}

function closeCheckout() {
  clearTimeout(autoCloseTimer);
  if (!store.getState().ui.checkoutOpen) return;

  store.setUi({ checkoutOpen: false });
  setTimeout(resetForm, 400);
}

function resetForm() {
  DOM.form?.reset();
  resetPhoneCountrySelect();
  updateAddressVisibility(getDeliveryMode());

  // Remove validation states
  Object.values(DOM.fields).forEach(field => {
    if (!field) return;
    setFieldState(field, 'idle');
    field._touched = false;
  });

  // Hide success screen, show form
  if (DOM.successScreen) DOM.successScreen.hidden = true;
  if (DOM.form)          DOM.form.hidden          = false;

  // After a successful order the button was left in "Placing order..." with
  // pointer-events: none, so the next checkout couldn't be submitted at all
  setSubmitLoading(false);
}

// --------------------------------------------------------------------------
// ORDER TOTAL
// --------------------------------------------------------------------------

/**
 * Delivery fees in minor units (cents) — must match the labels
 * shown in the delivery-option cards in index.html ("from $5" / "Free").
 */
const DELIVERY_FEES = {
  courier: 500,
  pickup:  0,
};

/**
 * Updates order total including promo discounts
 */
function updateOrderTotal(cart, promo) {
  if (!DOM.checkoutTotal) return;

  const subtotal      = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const promoDiscount = promo?.discount ?? 0;
  const deliveryFee   = DELIVERY_FEES[getDeliveryMode()] ?? 0;
  const total         = Math.max(0, subtotal - promoDiscount + deliveryFee);

  DOM.checkoutTotal.textContent = formatPrice(total);
}

// --------------------------------------------------------------------------
// VALIDATION
// --------------------------------------------------------------------------

/**
 * Validation strategies mapping
 */
const validators = {
  name(value) {
    const trimmed = value.trim();
    if (!trimmed)            return 'Enter your name';
    if (trimmed.length < 2)  return 'Name is too short';
    if (trimmed.length > 60) return 'Name is too long';
    // Letters, spaces, and hyphens only
    if (!/^[\p{L}\s\-']+$/u.test(trimmed)) return 'Letters and hyphens only';
    return null;
  },

  email(value) {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter your email';
    // Basic email validation format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return 'Enter a valid email';
    }
    return null;
  },

  phone(value) {
    // Remove non-digit characters
    const digits = value.replace(/\D/g, '');
    if (!digits)              return 'Enter your phone number';
    if (digits.length < 6)    return 'Phone number is too short';
    if (digits.length > 14)   return 'Phone number is too long';
    return null;
  },

  address(value) {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter your delivery address';
    if (trimmed.length < 10) return 'Address is too short';
    
    // Check: must contain letters (street) and numbers (house/apartment)
    if (!/\d/.test(trimmed) || !/[a-zA-Z\p{L}]/u.test(trimmed)) {
      return 'Enter a complete address (street and house number)';
    }
    return null;
  },
};

function validateField(field) {
  if (!field) return true; 

  const name      = field.name || field.dataset.js?.replace('checkout-', '');
  const validator = validators[name];

  if (!validator) return true;

  // Validate address only for courier delivery
  if (name === 'address') {
    const deliveryMode = getDeliveryMode();
    if (deliveryMode !== 'courier') return true;
  }

  const error = validator(field.value);

  if (error) {
    setFieldState(field, 'error', error);
    return false;
  }

  setFieldState(field, 'valid');
  return true;
}

function setFieldState(field, state, message = '') {
  const wrapper  = field.closest('[data-js="form-field"]');
  if (!wrapper) return;

  const errorEl  = wrapper.querySelector('[data-js="field-error"]');

  // Reset all states before applying new one
  wrapper.classList.remove('form-field--error', 'form-field--valid');
  field.removeAttribute('aria-invalid');

  if (errorEl) {
    errorEl.textContent = '';
    errorEl.hidden      = true;
  }

  if (state === 'error') {
    wrapper.classList.add('form-field--error');
    field.setAttribute('aria-invalid', 'true');

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden      = false;
    }
  } else if (state === 'valid') {
    wrapper.classList.add('form-field--valid');
    field.setAttribute('aria-invalid', 'false');
  }
}

// --------------------------------------------------------------------------
// LIVE VALIDATION
// --------------------------------------------------------------------------

/**
 * Live validation: validate on blur, then immediately on input
 */
function initLiveValidation() {
  const { name, phone, email, address } = DOM.fields;
  const allFields = [name, phone, email, address].filter(Boolean);

  allFields.forEach(field => {
    // First touch: validate on blur
    field.addEventListener('blur', () => {
      // Empty untouched field on blur (e.g. just tabbing through) — don't nag yet
      if (!field._touched && !field.value.trim()) return;
      field._touched = true;
      validateField(field);
    });

    // After first touch: validate on input
    field.addEventListener('input', () => {
      if (field._touched) validateField(field);
    });
  });
}

/*
  The submit button used to be disabled until every field was valid, but that
  state was only recalculated on blur — after typing the last field the
  button stayed grey, and it started enabled on the first open but disabled
  after a reset. It now stays enabled; handleSubmit() validates everything,
  shows the errors and scrolls to the first one.
*/

// --------------------------------------------------------------------------
// PHONE COUNTRY SELECT
// --------------------------------------------------------------------------

function initPhoneCountrySelect() {
  const btn  = DOM.phoneCountryBtn;
  const list = DOM.phoneCountryList;
  if (!btn || !list) return;

  const options = Array.from(list.querySelectorAll('[data-js="phone-country-option"]'));

  const closeList = () => {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };

  const openList = () => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  };

  const applySelection = (option) => {
    options.forEach(o => o.setAttribute('aria-selected', 'false'));
    option.setAttribute('aria-selected', 'true');

    const flagSrc = option.querySelector('img')?.getAttribute('src') ?? '';
    const dial    = option.dataset.dial ?? '+1';
    const name    = option.querySelector('.phone-field__country-option-name')?.textContent ?? '';

    if (DOM.phoneCountryFlag) DOM.phoneCountryFlag.src = flagSrc;
    if (DOM.phoneCountryDial) DOM.phoneCountryDial.textContent = dial;
    btn.dataset.dial = dial;
    btn.setAttribute('aria-label', `Country code, currently ${name} ${dial}`);
  };

  const selectOption = (option) => {
    applySelection(option);
    closeList();
    btn.focus();
  };

  const focusOption = (option) => option?.focus();

  const moveFocus = (delta) => {
    const current = options.indexOf(document.activeElement);
    const next = current === -1
      ? (delta > 0 ? 0 : options.length - 1)
      : (current + delta + options.length) % options.length;
    focusOption(options[next]);
  };

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    isOpen ? closeList() : openList();
  });

  // Arrow keys open the list and move focus straight to an option,
  // matching how a native <select> responds to arrow keys
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    openList();
    const current = options.find(o => o.getAttribute('aria-selected') === 'true') || options[0];
    focusOption(current);
  });

  options.forEach(option => {
    // role="option" isn't natively focusable — without this the list
    // is only usable with a mouse
    option.tabIndex = -1;
    option.addEventListener('click', () => selectOption(option));
  });

  // Roving keyboard navigation while a country option has focus
  list.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        e.preventDefault();
        focusOption(options[0]);
        break;
      case 'End':
        e.preventDefault();
        focusOption(options[options.length - 1]);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (options.includes(document.activeElement)) selectOption(document.activeElement);
        break;
    }
  });

  // Click outside closes the list
  document.addEventListener('click', (e) => {
    if (btn.getAttribute('aria-expanded') !== 'true') return;
    if (!btn.contains(e.target) && !list.contains(e.target)) closeList();
  });

  // Let the shared Escape handler in initCloseHandlers() reach this
  closePhoneCountryList = closeList;

  // Seed the button's dial code from whichever option starts selected,
  // and expose a reset for resetForm() — this dropdown isn't a native
  // form control, so form.reset() doesn't touch it on its own.
  const defaultOption = list.querySelector('[aria-selected="true"]') || options[0];
  if (defaultOption) applySelection(defaultOption);
  resetPhoneCountrySelect = () => {
    if (defaultOption) applySelection(defaultOption);
  };
}

/**
 * Returns full phone number with country code
 */
function getFullPhoneNumber() {
  const code  = DOM.phoneCountryBtn?.dataset.dial ?? '+1';
  const local = DOM.fields.phone?.value ?? '';
  return `${code} ${local}`.trim();
}

// --------------------------------------------------------------------------
// PHONE NUMBER MASK
// --------------------------------------------------------------------------

/**
 * Initializes phone number mask (XXX) XXX-XXXX
 */
function initPhoneMask() {
  const phoneEl = DOM.fields.phone;
  if (!phoneEl) return;

  phoneEl.addEventListener('input', handlePhoneInput);
  phoneEl.addEventListener('keydown', handlePhoneKeydown);
  phoneEl.addEventListener('paste',   handlePhonePaste);
}

/**
 * Applies phone mask to digit string
 */
function applyPhoneMask(digits) {
  const d = digits.slice(0, 10);

  if (d.length === 0) return '';

  let result = `(${d.slice(0, 3)}`;

  if (d.length <= 3) return result;
  result += `) ${d.slice(3, 6)}`;

  if (d.length <= 6) return result;
  result += `-${d.slice(6, 10)}`;

  return result;
}

function handlePhoneInput(e) {
  const input = e.currentTarget;

  const cursorPos = input.selectionStart;
  const oldValue  = input.value;

  const digits = oldValue.replace(/\D/g, '');

  const formatted  = applyPhoneMask(digits);
  input.value      = formatted;

  restoreCursorPosition(input, oldValue, formatted, cursorPos);
}

function restoreCursorPosition(input, oldValue, newValue, oldCursor) {
  const digitsBeforeCursor = oldValue
    .slice(0, oldCursor)
    .replace(/\D/g, '')
    .length;

  let digitCount = 0;
  let newCursor  = 0;

  for (let i = 0; i < newValue.length; i++) {
    if (/\d/.test(newValue[i])) {
      digitCount++;
      if (digitCount === digitsBeforeCursor) {
        newCursor = i + 1;
        break;
      }
    }
    newCursor = i + 1;
  }

  requestAnimationFrame(() => {
    input.setSelectionRange(newCursor, newCursor);
  });
}

/**
 * Handle Backspace over formatting characters
 */
function handlePhoneKeydown(e) {
  if (e.key !== 'Backspace') return;

  const input  = e.currentTarget;
  const cursor = input.selectionStart;

  if (input.selectionStart !== input.selectionEnd) return;

  const charBefore = input.value[cursor - 1];

  if (charBefore && /[\s\-\(\)]/.test(charBefore)) {
    e.preventDefault();
    input.setSelectionRange(cursor - 1, cursor - 1);
  }
}

/**
 * Handle paste event
 */
function handlePhonePaste(e) {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text');
  const digits = pasted.replace(/\D/g, '');

  e.currentTarget.value = applyPhoneMask(digits);
  
  const len = e.currentTarget.value.length;
  e.currentTarget.setSelectionRange(len, len);
}

// --------------------------------------------------------------------------
// DELIVERY STEPS
// --------------------------------------------------------------------------

/**
 * Initialize delivery type toggle
 */
function initDeliverySteps() {
  DOM.deliveryRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = getDeliveryMode();
      updateAddressVisibility(mode);
      
      // Reset address field on pickup
      if (mode === 'pickup' && DOM.fields.address) {
        setFieldState(DOM.fields.address, 'idle');
        DOM.fields.address._touched = false;
      }

      // Delivery fee depends on the selected mode — refresh the total
      const { cart, promo } = store.getState();
      updateOrderTotal(cart, promo);
    });
  });

  updateAddressVisibility(getDeliveryMode());
}

function getDeliveryMode() {
  for (const radio of DOM.deliveryRadios) {
    if (radio.checked) return radio.value;
  }
  return 'courier'; 
}

function updateAddressVisibility(mode) {
  const wrap = DOM.addressFieldWrap;
  if (!wrap) return;

  const isCourier = mode === 'courier';
  wrap.hidden = !isCourier;

  // Address is required only for courier
  if (DOM.fields.address) {
    DOM.fields.address.required = isCourier;
  }
}

// --------------------------------------------------------------------------
// FORM SUBMISSION
// --------------------------------------------------------------------------

function initFormSubmit() {
  DOM.form?.addEventListener('submit', handleSubmit);
}

/**
 * Handle form submission and final validation
 */
async function handleSubmit(e) {
  e.preventDefault();

  // Mark all fields as touched
  const allFields = Object.values(DOM.fields).filter(Boolean);
  allFields.forEach(field => { field._touched = true; });

  const validationResults = allFields.map(field => validateField(field));
  const isFormValid = validationResults.every(Boolean);

  if (!isFormValid) {
    // Scroll to first invalid field
    const firstInvalidWrapper = DOM.form.querySelector('.form-field--error');
    firstInvalidWrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Show loading state
  setSubmitLoading(true);

  try {
    // Simulate API request
    const fullPhone = getFullPhoneNumber();
    await fakeApiRequest(fullPhone);

    // Success
    const orderId = generateOrderId();
    showSuccessScreen(orderId);
  } catch {
    // Network error
    setSubmitLoading(false);
    showSubmitError();
  }
}

/**
 * Simulates network request delay
 */
function fakeApiRequest(payload) {
  return new Promise(resolve => setTimeout(resolve, 1200));
}

/**
 * Toggles submit button loading state
 */
function setSubmitLoading(isLoading) {
  if (!DOM.submitBtn) return;

  DOM.submitBtn.disabled = isLoading;

  if (isLoading) {
    // Save original text
    DOM.submitBtn._originalText = DOM.submitBtn.textContent;
    DOM.submitBtn.innerHTML = `
      <span class="btn__spinner" aria-hidden="true"></span>
      Placing order...
    `;
    DOM.submitBtn.classList.add('btn--loading');
  } else {
    DOM.submitBtn.textContent = DOM.submitBtn._originalText ?? 'Confirm order';
    DOM.submitBtn.classList.remove('btn--loading');
  }
}

function showSubmitError() {
  showToast('Network error. Please try again later.', 'error');
  console.error('[Checkout] Order submission failed: Network error timeout.');
}

// --------------------------------------------------------------------------
// SUCCESS SCREEN
// --------------------------------------------------------------------------

/**
 * Show order success screen
 */
function showSuccessScreen(orderId) {
  // Hide form
  if (DOM.form) DOM.form.hidden = true;

  // Set order number
  if (DOM.orderNumber) DOM.orderNumber.textContent = `#${orderId}`;

  // Show success screen
  if (DOM.successScreen) {
    DOM.successScreen.hidden = false;
    // Focus for screen readers
    DOM.successScreen.setAttribute('tabindex', '-1');
    DOM.successScreen.focus();
  }

  // Clear cart
  store.clearCart();

  // Remove promo code
  store.removePromo();

  // Auto-close after 5 seconds (closeCheckout() clears it on manual close)
  clearTimeout(autoCloseTimer);
  autoCloseTimer = setTimeout(closeCheckout, 5000);
}