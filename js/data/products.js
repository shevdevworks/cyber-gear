/**
 * products.js — CyberGear product catalog
 * Images: loaded from ./assets/images/ — PNG with transparent background
 */

const PRODUCTS = [

  // ══════════════════════════════════════
  // KEYBOARDS
  // ══════════════════════════════════════

  {
    id: 'kb-keychron-q1-pro', name: 'Keychron Q1 Pro', brand: 'Keychron',
    category: 'keyboards', price: 23900, oldPrice: 27900,
    image: './assets/images/kb-keychron-q1-pro.png',
    description: 'Flagship mechanical keyboard with an aluminum case and Bluetooth 5.1.',
    rating: 4.8, reviewCount: 312, popularity: 9340, isNew: false, inStock: true,
    tags: ['mechanical', 'aluminum', 'hotswap', 'bluetooth'],
    specs: { rgb: true, connectivity: 'both', layout: 'TKL', switch: 'Gateron Jupiter Red', material: 'Aluminum' },
  },
  {
    id: 'kb-wooting-60he', name: 'Wooting 60HE', brand: 'Wooting',
    category: 'keyboards', price: 19900, oldPrice: null,
    image: './assets/images/kb-wooting-60he.png',
    description: 'Analog mechanical keyboard with Lekker magnetic switches.',
    rating: 4.9, reviewCount: 187, popularity: 8920, isNew: true, inStock: true,
    tags: ['analog', 'magnetic', '60%', 'gaming'],
    specs: { rgb: true, connectivity: 'wired', layout: '60%', switch: 'Lekker Linear', material: 'Polycarbonate' },
  },
  {
    id: 'kb-hhkb-pro-hybrid', name: 'HHKB Professional Hybrid', brand: 'PFU',
    category: 'keyboards', price: 30900, oldPrice: null,
    image: './assets/images/kb-hhkb-pro-hybrid.png',
    description: 'Iconic keyboard with electrostatic capacitive Topre switches.',
    rating: 4.7, reviewCount: 94, popularity: 5410, isNew: false, inStock: true,
    tags: ['topre', 'capacitive', '60%', 'bluetooth', 'premium'],
    specs: { rgb: false, connectivity: 'both', layout: '60%', switch: 'Topre 45g', material: 'ABS' },
  },
  {
    id: 'kb-nuphy-air75', name: 'NuPhy Air75 V2', brand: 'NuPhy',
    category: 'keyboards', price: 8900, oldPrice: 10900,
    image: './assets/images/kb-nuphy-air75.png',
    description: 'Ultra-thin wireless keyboard with low-profile switches.',
    rating: 4.4, reviewCount: 256, popularity: 7180, isNew: false, inStock: true,
    tags: ['low-profile', 'mac', 'bluetooth', 'slim'],
    specs: { rgb: true, connectivity: 'both', layout: 'TKL', switch: 'Gateron Low Profile Red', material: 'Aluminum' },
  },

  // ══════════════════════════════════════
  // MICE
  // ══════════════════════════════════════

  {
    id: 'ms-lamzu-atlantis', name: 'Lamzu Atlantis Mini Pro', brand: 'Lamzu',
    category: 'mice', price: 10900, oldPrice: null,
    image: './assets/images/ms-lamzu-atlantis.png',
    description: 'Ultra-light symmetric mouse, 48g, with PAW3395 sensor and 4K polling rate.',
    rating: 4.9, reviewCount: 423, popularity: 11200, isNew: true, inStock: true,
    tags: ['ultra-light', '4k-polling', 'symmetric', 'wireless'],
    specs: { rgb: true, connectivity: 'wireless', sensor: 'PAW3395', weight: '48g', dpi: '100–26000' },
  },
  {
    id: 'ms-logitech-g-pro-x2', name: 'Logitech G Pro X Superlight 2', brand: 'Logitech',
    category: 'mice', price: 14900, oldPrice: 18900,
    image: './assets/images/ms-logitech-g-pro-x2.png',
    description: 'Professional esports mouse, 60g, with HERO 2 25K sensor.',
    rating: 4.8, reviewCount: 1840, popularity: 15600, isNew: false, inStock: true,
    tags: ['pro', 'esports', 'hero-sensor', 'lightspeed'],
    specs: { rgb: false, connectivity: 'wireless', sensor: 'HERO 2 25K', weight: '60g', dpi: '100–25600' },
  },
  {
    id: 'ms-razer-viper-v3-pro', name: 'Razer Viper V3 Pro', brand: 'Razer',
    category: 'mice', price: 16900, oldPrice: null,
    image: './assets/images/ms-razer-viper-v3-pro.png',
    description: 'Asymmetric mouse, 54g, with Focus Pro 35K optical sensor.',
    rating: 4.7, reviewCount: 621, popularity: 9870, isNew: true, inStock: true,
    tags: ['asymmetric', 'hyperspeed', 'focus-pro', 'esports'],
    specs: { rgb: true, connectivity: 'wireless', sensor: 'Focus Pro 35K', weight: '54g', dpi: '100–35000' },
  },
  {
    id: 'ms-endgame-gear-op1', name: 'Endgame Gear OP1 8K', brand: 'Endgame Gear',
    category: 'mice', price: 6900, oldPrice: 8900,
    image: './assets/images/ms-endgame-gear-op1.png',
    description: 'Wired mouse with an 8000 Hz polling rate and PAW3370 sensor.',
    rating: 4.6, reviewCount: 198, popularity: 6340, isNew: false, inStock: false,
    tags: ['8k-polling', 'wired', 'speedflex'],
    specs: { rgb: false, connectivity: 'wired', sensor: 'PAW3370', weight: '65g', dpi: '50–19000' },
  },

  // ══════════════════════════════════════
  // HEADSETS
  // ══════════════════════════════════════

  {
    id: 'hs-audeze-maxwell', name: 'Audeze Maxwell', brand: 'Audeze',
    category: 'headsets', price: 43900, oldPrice: null,
    image: './assets/images/hs-audeze-maxwell.png',
    description: 'Premium planar-magnetic wireless headset with 90mm drivers.',
    rating: 4.9, reviewCount: 143, popularity: 4870, isNew: false, inStock: true,
    tags: ['planar', 'studio-quality', 'bluetooth', 'usb-c'],
    specs: { rgb: false, connectivity: 'both', drivers: '90mm planar-magnetic', frequency: '10Hz – 50kHz', microphone: 'Detachable' },
  },
  {
    id: 'hs-steelseries-arctis-nova-pro', name: 'Arctis Nova Pro Wireless', brand: 'SteelSeries',
    category: 'headsets', price: 28900, oldPrice: 33900,
    image: './assets/images/hs-steelseries-arctis-nova-pro.png',
    description: 'Flagship headset with dual wireless and active ANC.',
    rating: 4.7, reviewCount: 534, popularity: 8920, isNew: false, inStock: true,
    tags: ['anc', 'dual-wireless', 'hot-swap-battery', 'premium'],
    specs: { rgb: true, connectivity: 'both', drivers: '40mm dynamic', frequency: '10Hz – 40kHz', microphone: 'Retractable ClearCast' },
  },
  {
    id: 'hs-hyperx-cloud-alpha', name: 'HyperX Cloud Alpha Wireless', brand: 'HyperX',
    category: 'headsets', price: 18900, oldPrice: null,
    image: './assets/images/hs-hyperx-cloud-alpha.png',
    description: 'Wireless headset with a record-breaking 300-hour battery life.',
    rating: 4.6, reviewCount: 892, popularity: 10450, isNew: false, inStock: true,
    tags: ['300h', 'dual-chamber', 'wireless', 'long-battery'],
    specs: { rgb: false, connectivity: 'wireless', drivers: '50mm dual-chamber', frequency: '15Hz – 21kHz', microphone: 'Detachable' },
  },
  {
    id: 'hs-epos-h6pro', name: 'EPOS H6Pro Closed', brand: 'EPOS',
    category: 'headsets', price: 10900, oldPrice: 13900,
    image: './assets/images/hs-epos-h6pro.png',
    description: 'Professional closed-back headset with a broadcast-grade microphone.',
    rating: 4.5, reviewCount: 267, popularity: 5630, isNew: true, inStock: true,
    tags: ['closed-back', 'detachable', 'pro', 'acoustic'],
    specs: { rgb: false, connectivity: 'wired', drivers: '42mm dynamic', frequency: '10Hz – 30kHz', microphone: 'Broadcast quality' },
  },

];

export default PRODUCTS;