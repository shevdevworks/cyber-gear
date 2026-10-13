import PRODUCTS from '../data/products.js';
import { store } from './store.js';
import { formatPrice } from '../utils/helpers.js';
import { showToast } from '../utils/toast.js';

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const findProduct = id => PRODUCTS.find(product => product.id === id);
const heart = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20S3 14.4 3 8.5a4.8 4.8 0 0 1 9-2.2 4.8 4.8 0 0 1 9 2.2C21 14.4 12 20 12 20Z" stroke="currentColor" stroke-width="1.5"/></svg>';

function animateImage(image) {
  image.getAnimations().forEach(animation => animation.cancel());
  if (!motion.matches) image.animate([
    { opacity: 0, translate: '16px 12px', scale: '.96' },
    { opacity: 1, translate: '0 0', scale: '1' },
  ], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
}

let sceneModule;
const loadScenes = () => sceneModule ??= import('./product-scenes.js');

function initHero() {
  const stage = document.querySelector('[data-js="hero-stage"]');
  const image = stage.querySelector('[data-js="hero-image"]');
  const detail = stage.querySelector('[data-js="hero-detail"]');
  const features = {
    'kb-wooting-60he': ['60HE', 'Analog precision.\nCompact by design.'],
    'kb-keychron-q1-pro': ['Q1 PRO', 'Aluminum craft.\nWireless freedom.'],
    'kb-nuphy-air75': ['AIR75', 'Low profile.\nA lighter touch.'],
  };
  let selected = 'kb-wooting-60he';
  let scene;
  const choices = [...document.querySelectorAll('[data-hero-product]')];
  const explode = document.querySelector('[data-js="hero-explode"]');
  function expandedState(value) {
    explode.setAttribute('aria-pressed', String(value));
    explode.querySelector('span').textContent = value ? 'Bring it together' : 'Explore the layers';
  }
  choices.forEach(button => button.addEventListener('click', () => {
    const product = findProduct(button.dataset.heroProduct);
    if (!product || product.id === selected) return;
    selected = product.id;
    choices.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    image.src = product.image;
    image.alt = product.name;
    stage.querySelector('[data-js="hero-product"]').dataset.model = product.id;
    detail.href = `#product/${product.id}`;
    stage.querySelector('[data-js="hero-name"]').textContent = product.name;
    stage.querySelector('[data-js="hero-price"]').textContent = formatPrice(product.price);
    stage.querySelector('.hero__watermark').textContent = features[product.id][0];
    const feature = stage.querySelector('[data-js="hero-feature"]');
    feature.textContent = features[product.id][1];
    feature.style.whiteSpace = 'pre-line';
    if (scene) scene.select(product.id);
    else animateImage(image);
  }));
  explode.addEventListener('click', () => {
    const value = explode.getAttribute('aria-pressed') !== 'true';
    expandedState(value);
    scene?.explode(value);
  });
  document.querySelector('[data-js="hero-replay"]').addEventListener('click', () => {
    expandedState(false);
    scene?.replay();
  });
  // The storefront is usable before the optional rendering module arrives.
  requestAnimationFrame(() => {
    loadScenes().then(({ createHeroScene }) => {
      scene = createHeroScene(stage.querySelector('[data-js="hero-scene"]'), selected);
      document.querySelector('[data-js="hero-scene-controls"]').hidden = false;
    }).catch(() => { /* Product photography remains the WebGL/network fallback. */ });
  });
}

function initCollection() {
  const catalog = document.querySelector('[data-js="catalog"]');
  const reveal = () => catalog.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
  document.querySelectorAll('[data-collection]').forEach(button => button.addEventListener('click', () => {
    store.setFilters({ categories: button.dataset.collection === 'all' ? [] : [button.dataset.collection], savedOnly: false });
  }));
  document.querySelectorAll('[data-category-jump]').forEach(button => button.addEventListener('click', () => {
    store.setFilters({ categories: [button.dataset.categoryJump], savedOnly: false });
    reveal();
  }));
  const savedButtons = [...document.querySelectorAll('[data-js="wishlist-filter"], [data-js="saved-tab"]')];
  savedButtons.forEach(button => button.addEventListener('click', () => {
    const savedOnly = !store.getState().filters.savedOnly;
    store.resetFilters();
    store.setFilters({ savedOnly });
    reveal();
  }));
  store.subscribe(({ filters }) => {
    document.querySelectorAll('[data-collection]').forEach(button => {
      const category = button.dataset.collection;
      const active = category === 'all' ? filters.categories.length === 0 : filters.categories.length === 1 && filters.categories[0] === category;
      button.setAttribute('aria-pressed', String(active && !filters.savedOnly));
    });
    savedButtons.forEach(button => button.setAttribute('aria-pressed', String(filters.savedOnly)));
    if (filters.savedOnly) document.querySelector('[data-js="catalog-title"]').textContent = 'Saved products';
  }, 'filters');
  store.subscribe(({ wishlist }) => {
    document.querySelector('[data-js="saved-count"]').hidden = wishlist.length === 0;
    document.querySelector('[data-js="saved-tab-count"]').textContent = wishlist.length;
  }, 'wishlist');
}

function initSetup() {
  const presets = {
    performance: ['kb-wooting-60he', 'ms-razer-viper-v3-pro', 'hs-hyperx-cloud-alpha'],
    studio: ['kb-keychron-q1-pro', 'ms-logitech-g-pro-x2', 'hs-audeze-maxwell'],
    everyday: ['kb-nuphy-air75', 'ms-lamzu-atlantis', 'hs-epos-h6pro'],
  };
  const categories = ['keyboards', 'mice', 'headsets'];
  const selected = Object.fromEntries(categories.map((category, index) => [category, presets.performance[index]]));
  let scene;
  const selects = [...document.querySelectorAll('[data-setup-select]')];
  selects.forEach(select => {
    select.replaceChildren(...PRODUCTS.filter(product => product.category === select.dataset.setupSelect && product.inStock)
      .map(product => new Option(`${product.name} — ${formatPrice(product.price)}`, product.id)));
    select.addEventListener('change', () => {
      selected[select.dataset.setupSelect] = select.value;
      update();
    });
  });

  function update(animate = true) {
    selects.forEach(select => {
      const category = select.dataset.setupSelect;
      const product = findProduct(selected[category]);
      select.value = product.id;
      const image = document.querySelector(`[data-setup-image="${category}"]`);
      if (image.dataset.productId !== product.id) {
        image.dataset.productId = product.id;
        image.src = product.image;
        image.alt = product.name;
        if (animate) animateImage(image);
      }
    });
    scene?.select(selected);
    document.querySelector('[data-js="setup-total"]').textContent = formatPrice(categories.reduce((sum, category) => sum + findProduct(selected[category]).price, 0));
    document.querySelectorAll('[data-setup-preset]').forEach(button => {
      button.setAttribute('aria-pressed', String(presets[button.dataset.setupPreset].every((id, index) => id === selected[categories[index]])));
    });
  }
  document.querySelectorAll('[data-setup-preset]').forEach(button => button.addEventListener('click', () => {
    categories.forEach((category, index) => { selected[category] = presets[button.dataset.setupPreset][index]; });
    update();
  }));
  document.querySelector('[data-js="setup-add"]').addEventListener('click', () => {
    categories.forEach(category => store.addToCart(findProduct(selected[category])));
    store.setUi({ cartOpen: true });
    showToast('Your setup is in the cart', 'success');
  });
  update(false);
  const host = document.querySelector('[data-js="setup-scene"]');
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    loadScenes().then(({ createSetupScene }) => {
      scene = createSetupScene(host, selected);
      document.querySelector('[data-js="setup-scene-controls"]').hidden = false;
    }).catch(() => { /* Keep the three selected product photos available. */ });
  }, { rootMargin: '300px' });
  observer.observe(host);
  document.querySelectorAll('[data-setup-view]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-setup-view]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    scene?.angle(button.dataset.setupView);
  }));
}

function initProductDetails() {
  const dialog = document.querySelector('[data-js="product-dialog"]');
  const content = dialog.querySelector('[data-js="product-detail"]');
  const specNames = { connectivity: 'Connection', rgb: 'RGB lighting', layout: 'Layout', switch: 'Switches', material: 'Case', sensor: 'Sensor', weight: 'Weight', dpi: 'DPI', drivers: 'Drivers', frequency: 'Frequency range', microphone: 'Microphone' };
  const specValues = { both: 'Wired + wireless', wired: 'Wired', wireless: 'Wireless', true: 'Yes', false: 'No' };
  let activeId = null;
  let afterClose = null;
  let returnFocus = null;

  function close() {
    if (history.state?.cybergearProduct) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      syncRoute();
    }
  }

  function syncRoute() {
    const id = location.hash.startsWith('#product/') ? location.hash.slice(9) : null;
    const product = findProduct(id);
    if (!product) {
      if (dialog.open) dialog.close();
      activeId = null;
      store.setUi({ productOpen: false });
      document.title = 'CyberGear — Custom Peripherals';
      if (afterClose) { const callback = afterClose; afterClose = null; callback(); }
      else if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
      return;
    }
    if (activeId === id && dialog.open) return;
    activeId = id;
    const saved = store.getState().wishlist.includes(id);
    const related = PRODUCTS.find(item => item.category === product.category && item.id !== id && item.inStock);
    content.innerHTML = `<article class="product-detail">
      <button class="dialog-close" data-detail-close aria-label="Close product details" autofocus>×</button>
      <div class="product-detail__gallery">
        <img class="product-detail__image" src="${product.image}" alt="${product.name}" width="600" height="450" />
        <p class="product-detail__caption">${product.brand} / ${product.category === 'headsets' ? 'Audio' : product.category}</p>
        <button class="product-detail__zoom" data-detail-zoom aria-pressed="false">Zoom image +</button>
      </div>
      <div class="product-detail__content">
        <p class="product-detail__brand">${product.brand}</p>
        <h2 id="product-detail-title">${product.name}</h2>
        <p class="product-detail__description">${product.description}</p>
        <div class="product-detail__price">${formatPrice(product.price)}${product.oldPrice ? `<del>${formatPrice(product.oldPrice)}</del>` : ''}</div>
        <p class="product-detail__stock ${!product.inStock ? 'product-detail__stock--unavailable' : ''}">${product.inStock ? 'Available in the demo collection' : 'Currently out of stock'}</p>
        <div class="product-detail__actions"><button class="studio-button studio-button--violet" data-detail-add ${product.inStock ? '' : 'disabled'}>${product.inStock ? 'Add to cart' : 'Unavailable'} <span aria-hidden="true">+</span></button><button class="product-detail__save" data-detail-save aria-label="${saved ? 'Remove from saved products' : 'Save product'}" aria-pressed="${saved}">${heart}</button></div>
        <dl class="product-detail__specs">${Object.entries(product.specs).map(([key, value]) => `<div><dt>${specNames[key] ?? key}</dt><dd>${specValues[value] ?? value}</dd></div>`).join('')}</dl>
        <button class="product-detail__shipping" data-info="shipping">Shipping & returns information</button>
      </div>
      ${related ? `<div class="product-detail__related"><span>Also worth a look</span><a href="#product/${related.id}"><img src="${related.image}" width="55" height="40" alt="" />${related.name}<span aria-hidden="true">↗</span></a></div>` : ''}
    </article>`;
    if (!dialog.open) dialog.showModal();
    else dialog.querySelector('[data-detail-close]').focus({ preventScroll: true });
    dialog.scrollTop = 0;
    store.setUi({ productOpen: true });
    document.title = `${product.name} — CyberGear`;
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#product/"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!dialog.open) {
      returnFocus = link;
      history.pushState({ ...history.state, cybergearProduct: true }, '', link.getAttribute('href'));
    } else history.replaceState(history.state, '', link.getAttribute('href'));
    syncRoute();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-detail-close]')) close();
    const product = findProduct(activeId);
    if (!product) return;
    if (event.target.closest('[data-detail-add]') && product.inStock) {
      store.addToCart(product);
      afterClose = () => { store.setUi({ cartOpen: true }); showToast(`${product.name} added to cart`, 'success'); };
      close();
    }
    if (event.target.closest('[data-detail-save]')) store.toggleWishlist(product.id);
    if (event.target.closest('[data-detail-zoom], .product-detail__image')) {
      const image = dialog.querySelector('.product-detail__image');
      const zoomed = image.classList.toggle('is-zoomed');
      const button = dialog.querySelector('[data-detail-zoom]');
      button.setAttribute('aria-pressed', String(zoomed));
      button.textContent = zoomed ? 'Reset image −' : 'Zoom image +';
    }
  });
  store.subscribe(({ wishlist }) => {
    const button = dialog.querySelector('[data-detail-save]');
    if (!button) return;
    const saved = wishlist.includes(activeId);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? 'Remove from saved products' : 'Save product');
  }, 'wishlist');
  window.addEventListener('popstate', syncRoute);
  window.addEventListener('hashchange', syncRoute);
  syncRoute();
}

function initInformation() {
  const dialog = document.querySelector('[data-js="info-dialog"]');
  const information = {
    shipping: ['Shipping & returns', '<p>This is a demonstration storefront. No physical products are sold or shipped.</p><h3>Try the shipping options</h3><p>The demo checkout offers courier delivery for $5, free courier delivery on orders of $200 or more after discounts, or free pickup. Your total updates when you choose an option.</p><h3>Returns</h3><p>Demo orders do not create purchases, so no return or refund is needed.</p>'],
    faq: ['A few good answers', '<h3>Can I buy these products here?</h3><p>CyberGear is a portfolio concept. You can explore products, build a setup and complete a simulated checkout. For purchases, visit the manufacturers or their authorized retailers.</p><h3>Will my saved gear stay here?</h3><p>Your cart and saved products are stored in this browser. They remain available when you come back on the same device.</p><h3>Can I try a discount?</h3><p>Use CYBER2026 in the cart for a 10% demo discount.</p>'],
    about: ['Considered gear. Considered design.', '<p>CyberGear is an independent storefront concept by ShevDevWorks, built around the feel of well-made peripherals and a thoughtful shopping experience.</p><p>Explore the collection, compare specifications, build a setup and try the demo checkout.</p><p>Product names, trademarks and imagery belong to their respective owners. Prices, ratings, availability and specifications are sample catalog data.</p>'],
    privacy: ['Your browser. Your data.', '<p>This demo stores your cart and saved product IDs locally in your browser. Checkout details are not submitted to a server or saved by the application.</p><p>Use sample details when testing checkout. Clearing this site’s browser storage removes saved items and the cart.</p><p>Fonts are requested from Google Fonts. There are no payment integrations or analytics scripts in the application.</p>'],
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-info]');
    const info = information[button?.dataset.info];
    if (!info) return;
    document.querySelector('#info-title').textContent = info[0];
    dialog.querySelector('[data-js="info-body"]').innerHTML = info[1];
    dialog.showModal();
    store.setUi({ infoOpen: true });
  });
  dialog.querySelector('[data-js="info-close"]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => store.setUi({ infoOpen: false }));
}

export function initStudio() {
  initHero();
  initCollection();
  initSetup();
  initProductDetails();
  initInformation();
}
