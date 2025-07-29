import renderHome from '../views/home.js';
import renderLogin, { setupLoginForm } from '../views/login.js';
import { checkSession, logout } from './auth.js';
import manageorg, { attachManageOrgListeners } from '../views/manageorg.js';
import bookingsPage, { loadBookings } from "../views/bookings.js";
import { bookableSpacesAfterRender, bookableSpacesHTML } from '../views/bookableSpaces.js';
import { updates } from '../views/updates.js';
import bookingHTML, { bookingAfterRender } from '../views/bookingPage.js';
import formBuilderPage, { loadFormBuilderPage } from '../views/createCustomForm.js';
import { renderFormById } from '../views/viewCustomForm.js';
import formsPage, { loadForms } from '../views/forms.js';
import { loadSettings, settingsPage } from '../views/settings.js';
import { subnav } from './subnav.js';
import { loadUsersPage, usersPageHtml } from '../views/usermanagement.js';

let currentUser = null;
const formsSubNav = subnav([
      { link: '#/forms/list', label: 'Forms' },
      { link: '#/forms/create', label: 'Create' },
      { link: '#/forms/responses', label: 'Responses' },
    ]);
const settingsSubNav = subnav([
      { link: '#/settings/profile', label: 'Profile' },
      { link: '#/settings/userManagement', label: 'Users' },
      { link: '#/settings/bookableSpaces', label: 'Spaces' },
    ])
const publicRoutes = {
  '/': renderHome,
  '/login': renderLogin,
  '/updates': updates,
  '/form': renderFormById,
};

const privateRoutes = {
  '/dashboard': () => `<h2>Welcome to your dashboard, ${currentUser?.forename || ''}</h2>`,
  '/forms': () => {
  window.location.hash = "#/forms/list";
  },
  '/forms/list': async () => {
  const html = formsPage(currentUser);
  setTimeout(() => loadForms(currentUser), 0); // Load data after render

  return `
    ${formsSubNav}
    ${html}
  `;
  },
  '/forms/create': async () => {
    const html = formBuilderPage(); // returns the HTML structure
    setTimeout(() => loadFormBuilderPage(currentUser), 0); // handles DOM interaction after render
    return `
      ${formsSubNav}
      ${html}
    `;
  },
  '/bookings': async () => {
    const html = bookingsPage(currentUser);
    setTimeout(() => loadBookings(currentUser), 0); // Load data after render
    return html;
  },
  '/bookings/view' : async () => {
    const html = bookingHTML();
    setTimeout(() => bookingAfterRender(currentUser), 0);
    return html;
  },
  '/settings': () => {
  window.location.hash = "#/settings/profile";
},
  '/settings/profile': async () => {
    const html = settingsPage(currentUser);
    setTimeout(() => loadSettings(currentUser), 0); // Load data after render
    return (`
      ${settingsSubNav}
      ${html}
      `);
  },
  '/settings/bookableSpaces': async () => {
  const html = bookableSpacesHTML();
  setTimeout(() => bookableSpacesAfterRender(currentUser), 0);
  return (`
      ${settingsSubNav}
      ${html}
      `);
  },
  '/settings/userManagement': async () => {
  const html = usersPageHtml();
  setTimeout(() => loadUsersPage(currentUser), 0);
  return (`
      ${settingsSubNav}
      ${html}
      `);
  },
};

const adminRoutes = {
  '/dashboard': () => `<h2>Welcome to your dashboard, ${currentUser?.forename || ''}</h2>`,
  '/profile': () => `<p>User profile for ${currentUser?.email || ''}</p>`,
  '/manageorg': async () => {
    const html = manageorg(); // just returns the HTML
    setTimeout(() => attachManageOrgListeners(), 0); // attaches logic after render
    return html;
  },
  };

// Switch between public and private styles
function setStylesheet(type) {
  const link = document.getElementById('main-style');
  if (link) {
    link.href = type === 'private' ? 'css/styles.css?v=3' : 'css/public.css';
  }
}
export function markActiveLinks(html) {
  const currentPath = location.hash.slice(1).split('?')[0] || '/';

  return html.replace(/<a href="([^"]+)"/g, (match, href) => {
    const hrefPath = href.startsWith('#') ? href.slice(1).split('?')[0] : href.split('?')[0];

    // Mark active if current path starts with hrefPath
    const isActive =
      currentPath === hrefPath || // exact match
      (hrefPath !== '/' && currentPath.startsWith(hrefPath)); // partial match (ignore "/" case)

    if (isActive) {
      if (match.includes('class="')) {
        return match.replace(/class="([^"]*)"/, (_, classes) => `class="${classes} activesubnav"`);
      } else {
        return `<a href="${href}" class="activesubnav"`;
      }
    }

    return match;
  });
}

// Public layout
export function renderPublicLayout(content) {
  return( `
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
  `);
}

export function renderPrivateLayout(content) {
  let html = `
    <nav class="private-nav">
      <a href="#/" class="logo-link">
        <img src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Group%205.png" alt="Company logo" />
      </a>
      <div class="nav-links">
        <a href="#/dashboard" class="nav-link"><svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path d="M32 32v432a16 16 0 0016 16h432" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><rect x="96" y="224" width="80" height="192" rx="20" ry="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><rect x="240" y="176" width="80" height="240" rx="20" ry="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><rect x="383.64" y="112" width="80" height="304" rx="20" ry="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>Dashboard</a>
        <hr />
        <a href="#/bookings" class="nav-link"><svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512" fill="none" stroke="currentColor" stroke-width="32" stroke-linejoin="round" stroke-linecap="round"><rect x="48" y="80" width="416" height="384" rx="48"/><circle cx="296" cy="232" r="24" fill="currentColor" stroke="none"/><circle cx="376" cy="232" r="24" fill="currentColor" stroke="none"/><circle cx="296" cy="312" r="24" fill="currentColor" stroke="none"/><circle cx="376" cy="312" r="24" fill="currentColor" stroke="none"/><circle cx="136" cy="312" r="24" fill="currentColor" stroke="none"/><circle cx="216" cy="312" r="24" fill="currentColor" stroke="none"/><circle cx="136" cy="392" r="24" fill="currentColor" stroke="none"/><circle cx="216" cy="392" r="24" fill="currentColor" stroke="none"/><circle cx="296" cy="392" r="24" fill="currentColor" stroke="none"/><path d="M128 48v32"/><path d="M384 48v32"/><path d="M464 160H48"/></svg>Bookings</a>
        <a href="#/forms" class="nav-link "><svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path d="M416 221.25V416a48 48 0 01-48 48H144a48 48 0 01-48-48V96a48 48 0 0148-48h98.75a32 32 0 0122.62 9.37l141.26 141.26a32 32 0 019.37 22.62z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"/><path d="M256 56v120a32 32 0 0032 32h120M176 288h160M176 368h160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>Forms</a>
      </div>
<a href="#/settings" class="nav-link"><svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path fill="currentColor" d="M456.7 242.27l-26.08-4.2a8 8 0 01-6.6-6.82c-.5-3.2-1-6.41-1.7-9.51a8.08 8.08 0 013.9-8.62l23.09-12.82a8.05 8.05 0 003.9-9.92l-4-11a7.94 7.94 0 00-9.4-5l-25.89 5a8 8 0 01-8.59-4.11q-2.25-4.2-4.8-8.41a8.16 8.16 0 01.7-9.52l17.29-19.94a8 8 0 00.3-10.62l-7.49-9a7.88 7.88 0 00-10.5-1.51l-22.69 13.63a8 8 0 01-9.39-.9c-2.4-2.11-4.9-4.21-7.4-6.22a8 8 0 01-2.5-9.11l9.4-24.75A8 8 0 00365 78.77l-10.2-5.91a8 8 0 00-10.39 2.21l-16.64 20.84a7.15 7.15 0 01-8.5 2.5s-5.6-2.3-9.8-3.71A8 8 0 01304 87l.4-26.45a8.07 8.07 0 00-6.6-8.42l-11.59-2a8.07 8.07 0 00-9.1 5.61l-8.6 25.05a8 8 0 01-7.79 5.41h-9.8a8.07 8.07 0 01-7.79-5.41l-8.6-25.05a8.07 8.07 0 00-9.1-5.61l-11.59 2a8.07 8.07 0 00-6.6 8.42l.4 26.45a8 8 0 01-5.49 7.71c-2.3.9-7.3 2.81-9.7 3.71-2.8 1-6.1.2-8.8-2.91l-16.51-20.34A8 8 0 00156.75 73l-10.2 5.91a7.94 7.94 0 00-3.3 10.09l9.4 24.75a8.06 8.06 0 01-2.5 9.11c-2.5 2-5 4.11-7.4 6.22a8 8 0 01-9.39.9L111 116.14a8 8 0 00-10.5 1.51l-7.49 9a8 8 0 00.3 10.62l17.29 19.94a8 8 0 01.7 9.52q-2.55 4-4.8 8.41a8.11 8.11 0 01-8.59 4.11l-25.89-5a8 8 0 00-9.4 5l-4 11a8.05 8.05 0 003.9 9.92L85.58 213a7.94 7.94 0 013.9 8.62c-.6 3.2-1.2 6.31-1.7 9.51a8.08 8.08 0 01-6.6 6.82l-26.08 4.2a8.09 8.09 0 00-7.1 7.92v11.72a7.86 7.86 0 007.1 7.92l26.08 4.2a8 8 0 016.6 6.82c.5 3.2 1 6.41 1.7 9.51a8.08 8.08 0 01-3.9 8.62L62.49 311.7a8.05 8.05 0 00-3.9 9.92l4 11a7.94 7.94 0 009.4 5l25.89-5a8 8 0 018.59 4.11q2.25 4.2 4.8 8.41a8.16 8.16 0 01-.7 9.52l-17.29 19.96a8 8 0 00-.3 10.62l7.49 9a7.88 7.88 0 0010.5 1.51l22.69-13.63a8 8 0 019.39.9c2.4 2.11 4.9 4.21 7.4 6.22a8 8 0 012.5 9.11l-9.4 24.75a8 8 0 003.3 10.12l10.2 5.91a8 8 0 0010.39-2.21l16.79-20.64c2.1-2.6 5.5-3.7 8.2-2.6 3.4 1.4 5.7 2.2 9.9 3.61a8 8 0 015.49 7.71l-.4 26.45a8.07 8.07 0 006.6 8.42l11.59 2a8.07 8.07 0 009.1-5.61l8.6-25a8 8 0 017.79-5.41h9.8a8.07 8.07 0 017.79 5.41l8.6 25a8.07 8.07 0 009.1 5.61l11.59-2a8.07 8.07 0 006.6-8.42l-.4-26.45a8 8 0 015.49-7.71c4.2-1.41 7-2.51 9.6-3.51s5.8-1 8.3 2.1l17 20.94A8 8 0 00355 439l10.2-5.91a7.93 7.93 0 003.3-10.12l-9.4-24.75a8.08 8.08 0 012.5-9.12c2.5-2 5-4.1 7.4-6.21a8 8 0 019.39-.9L401 395.66a8 8 0 0010.5-1.51l7.49-9a8 8 0 00-.3-10.62l-17.29-19.94a8 8 0 01-.7-9.52q2.55-4.05 4.8-8.41a8.11 8.11 0 018.59-4.11l25.89 5a8 8 0 009.4-5l4-11a8.05 8.05 0 00-3.9-9.92l-23.09-12.82a7.94 7.94 0 01-3.9-8.62c.6-3.2 1.2-6.31 1.7-9.51a8.08 8.08 0 016.6-6.82l26.08-4.2a8.09 8.09 0 007.1-7.92V250a8.25 8.25 0 00-7.27-7.73zM256 112a143.82 143.82 0 01139.38 108.12A16 16 0 01379.85 240H274.61a16 16 0 01-13.91-8.09l-52.1-91.71a16 16 0 019.85-23.39A146.94 146.94 0 01256 112zM112 256a144 144 0 0143.65-103.41 16 16 0 0125.17 3.47L233.06 248a16 16 0 010 15.87l-52.67 91.7a16 16 0 01-25.18 3.36A143.94 143.94 0 01112 256zm144 144a146.9 146.9 0 01-38.19-4.95 16 16 0 01-9.76-23.44l52.58-91.55a16 16 0 0113.88-8H379.9a16 16 0 0115.52 19.88A143.84 143.84 0 01256 400z"/></svg>Settings</a>
      <a class="nav-link "></a>
      <button id="btn-logout" class="primaryButton">Log out</button>
    </nav>
    <div class="main">${content}</div>
  `;
  return markActiveLinks(html);
}

export function renderAdminLayout(content) {
  let html = `
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
    <div class="main" id="body">${content}</div>
  `;
  return markActiveLinks(html);
}

async function router() {
  const fullHash = location.hash.slice(1) || '/';
  const [hashPath] = fullHash.split('?'); // Ignore query params
  const app = document.getElementById('app');

  currentUser = await checkSession();

  // Unauthenticated trying to access private route
  if (!currentUser && privateRoutes[hashPath]) {
    location.hashPath = '#/login';
    return;
  }

  // Authenticated + private route
  if (currentUser && privateRoutes[hashPath]) {
    setStylesheet('private');
    if(currentUser.product == "admin"){
    const view = adminRoutes[hashPath];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderAdminLayout(content);
    }else {
      const view = privateRoutes[hashPath];
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
  }else if (currentUser && adminRoutes[hashPath]) {
    setStylesheet('private');
    if(currentUser.product == "admin"){
    const view = adminRoutes[hashPath];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderAdminLayout(content);
    }else {
      const view = privateRoutes[hashPath];
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
  } else if (publicRoutes[hashPath]) {
    setStylesheet('public');
    const view = publicRoutes[hashPath];
    const content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderPublicLayout(content);

    if (hashPath === '/login') setupLoginForm?.();

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
