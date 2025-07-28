import renderHome from '../views/home.js';
import renderLogin, { setupLoginForm } from '../views/login.js';
import { checkSession, logout } from './auth.js';
import manageorg from '../views/manageorg.js';
import bookingsPage, { loadBookings } from "../views/bookings.js";
import { bookableSpacesAfterRender, bookableSpacesHTML } from '../views/bookableSpaces.js';
import { updates } from '../views/updates.js';

let currentUser = null;

const publicRoutes = {
  '/': renderHome,
  '/login': renderLogin,
  '/updates': updates,
};

const privateRoutes = {
  '/dashboard': () => `<h2>Welcome to your dashboard, ${currentUser?.forename || ''}</h2>`,
  '/profile': () => `<p>User profile for ${currentUser?.email || ''}</p>`,
  '/bookings': async () => {
    const html = bookingsPage(currentUser);
    setTimeout(() => loadBookings(currentUser), 0); // Load data after render
    return html;
  },
  '/bookableSpaces': async () => {
  const html = bookableSpacesHTML();
  setTimeout(() => bookableSpacesAfterRender(currentUser), 0);
  return html;
},
};

const adminRoutes = {
  '/dashboard': () => `<h2>Welcome to your dashboard, ${currentUser?.forename || ''}</h2>`,
  '/profile': () => `<p>User profile for ${currentUser?.email || ''}</p>`,
  '/manageorg': manageorg,
};

// Switch between public and private styles
function setStylesheet(type) {
  const link = document.getElementById('main-style');
  if (link) {
    link.href = type === 'private' ? 'css/styles.css?v=2' : 'css/public.css';
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
        <a href="#/bookableSpaces" class="nav-link sub">Spaces</a>
        <h4>Bookings</h4>
        <a href="#/bookings" class="nav-link">Overview</a>
      </div>
      <button id="btn-logout" class="primaryButton">Log out</button>
    </nav>
    <div class="main">${content}</div>
  `;
}
function renderAdminLayout(content) {
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
        <h4>Organisations</h4>
        <a href="#/manageorg" class="nav-link">Manage</a>
      </div>
      <button id="btn-logout" class="primaryButton">Log out</button>
    </nav>
    <div class="main">${content}</div>
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
    if(currentUser.product == "admin"){
    const view = adminRoutes[hash];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderAdminLayout(content);
    }else {
      const view = privateRoutes[hash];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderPrivateLayout(content);
    }
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await logout();
        currentUser = null;
        location.hash = '#/login';
      });
    }

      // Authenticated + private route
  }else if (currentUser && adminRoutes[hash]) {
    setStylesheet('private');
    if(currentUser.product == "admin"){
    const view = adminRoutes[hash];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderAdminLayout(content);
    }else {
      const view = privateRoutes[hash];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderPrivateLayout(content);
    }
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
    app.innerHTML = `<main><div style="background-color:white;padding:10px;border-radius:10px"><h1>Error 404 : Page Not Found
    <h2>Sorry, We couldn't find the page you were looking for</h2>
    <p>Unfortunately, the url you were trying to access is either unavailable or does not exist on our system. It may be the case that you are trying to access a page that requires you to be logged in. If you believe that this is a problem on our end please contact us via</p>
    <a href="mailto:ben@bookingorchard.com">Ben Scott (ben@bookingorchard.com)</a><p> or </p><a href="mailto:david@bookingorchard.com">David Brasas (david@bookingorchard.com)</a>
    </div></main>`;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
