import renderHome from '../views/home.js';
import renderLogin, { setupLoginForm } from '../views/login.js';
import { checkSession, logout } from './auth.js';

let currentUser = null;

const publicRoutes = {
  '/': renderHome,
  '/login': renderLogin,
  '/updates': () => '<p>Updates coming soon…</p>',
};

const privateRoutes = {
  '/dashboard': () => `<h2>Welcome to your dashboard, ${currentUser?.forename || ''}</h2>`,
  '/profile': () => `<p>User profile for ${currentUser?.email || ''}</p>`,
};

// Switch between public and private styles
function setStylesheet(type) {
  const link = document.getElementById('main-style');
  if (link) {
    link.href = type === 'private' ? 'css/styles.css' : 'css/public.css';
  }
}

// Public layout
function renderPublicLayout(content) {
  return `
    <header>
      <a href="#/" class="logo">
        <img src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Group%205.png" alt="Company logo" />
      </a>
      <div>
        <a href="#/">Home</a>
        <a href="#/updates">Updates</a>
        <a href="#/login"><button class="primaryButton">Login</button></a>
      </div>
    </header>
    <main class="content">
      ${content}
    </main>
  `;
}

// Private layout
function renderPrivateLayout(content) {
  return `
    <nav class="private-nav">
      <a href="#/" class="logo-link">
        <img src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Group%205.png" alt="Company logo" />
      </a>
      <div class="nav-links">
        <a href="#/dashboard" class="nav-link">Dashboard</a>
        <a href="#/tasks" class="nav-link">Tasks</a>
        <a href="#/notifications" class="nav-link">Notifications</a>
        <hr />
        <h4>Settings</h4>
        <a href="#/userManagement" class="nav-link sub">Users</a>
        <a href="#/venueManagement" class="nav-link sub">Venue</a>
        <h4>Bookings</h4>
        <a href="#/bookingManagement" class="nav-link">Bookings</a>
      </div>
      <button id="btn-logout" class="primaryButton">Log out</button>
    </nav>
    <main class="main">${content}</main>
  `;
}

async function router() {
  const hash = location.hash.slice(1) || '/';
  const app = document.getElementById('app');

  currentUser = await checkSession();

  // Unauthenticated trying to access private route
  if (!currentUser && privateRoutes[hash]) {
    location.hash = '#/login';
    return;
  }

  // Authenticated + private route
  if (currentUser && privateRoutes[hash]) {
    setStylesheet('private');
    const view = privateRoutes[hash];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderPrivateLayout(content);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await logout();
        currentUser = null;
        location.hash = '#/login';
      });
    }

  // Public route
  } else if (publicRoutes[hash]) {
    setStylesheet('public');
    const view = publicRoutes[hash];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderPublicLayout(content);

    if (hash === '/login') setupLoginForm?.();

  // 404 fallback
  } else {
    setStylesheet('public');
    app.innerHTML = `<main><h2>404 - Page Not Found</h2></main>`;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
