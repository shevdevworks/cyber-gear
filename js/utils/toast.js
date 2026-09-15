/**
 * toast.js — Toast notifications
 * Lives in its own module so feature modules (checkout, catalog) can import it
 * without a circular dependency on app.js.
 */

export function showToast(message, type = 'success') {
  const container = document.querySelector('[data-js="toast-container"]');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = type === 'success' ? '✓' : '✕';

  const text = document.createElement('p');
  text.className = 'toast__text';
  text.textContent = message;

  toast.append(icon, text);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
