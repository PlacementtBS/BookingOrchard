import renderHome from '../views/home.js';
import renderLogin, { setupLoginForm } from '../views/login.js';
import { checkSession, logout } from './auth.js';
import manageorg, { attachManageOrgListeners } from '../views/manageorg.js';
import bookingsPage, { loadBookings } from "../views/bookings.js";
import { bookableSpacesAfterRender, bookableSpacesHTML } from '../views/bookableSpaces.js';
import { updates } from '../views/updates.js';
import bookingHTML, { bookingAfterRender } from '../views/bookingPage.js';
import formBuilderPage, { loadFormBuilderPage } from '../views/createCustomForm.js';
import formsPage, { loadForms } from '../views/forms.js';
import { loadSettings, settingsPage } from '../views/settings.js';
import { subnav } from './subnav.js';
import { loadUsersPage, usersPageHtml } from '../views/usermanagement.js';
import { orgSettings } from '../views/orgSettings.js';
import  { bookingWorflowHTML, loadBookingWorkflow } from '../views/bookingWorkflow.js';
import { bookableEquipmentAfterRender, bookableEquipmentHTML } from '../views/bookableEquipment.js';
import customFormHTML, { customFormAfterRender } from '../views/viewCustomForm.js';
import requirementsFormHTML, { requirementsFormAfterRender } from '../views/requirements.js';
import { documentBuilderAfterRender, documentBuilderHTML } from '../views/documentBuilder.js';
import documentViewerHTML, { documentViewerAfterRender } from '../views/documentViewer.js';
import documentsPage, { loadDocuments } from '../views/documents.js';
import calendarPage, { loadCalendar } from '../views/calendar.js';
import rotaPage, { loadRota } from '../views/schedule.js';
import invoicePage, { loadInvoice } from '../views/invoiceAndQuote.js';
import myRotaPage, { loadMyRota } from '../views/myRota.js';
import { select, insert } from './db.js';
import clockPage, { loadClock } from '../views/myclock.js';
import managerClockPage, { loadManagerClock } from '../views/managerClockPage.js';

let currentUser = null;




// ===== SUBNAVS =====
const formsSubNav = subnav([
  { link: '#/forms/list', label: 'Forms' },
  { link: '#/forms/create', label: 'Create' }
]);

const settingsSubNav = subnav([
  { link: '#/settings/profile', label: 'Profile' },
  { link: '#/settings/userManagement', label: 'Users' },
  { link: '#/settings/bookableSpaces', label: 'Spaces' },
  { link: '#/settings/bookableEquipment', label: 'Equipment' },
  { link: '#/settings/orgSettings', label: 'Organisation' },
]);

const documentsSubNav = subnav([
  { link: '#/documents', label: 'Documents' },
  { link: '#/document-builder', label: 'New Document' }
]);

// ===== ROUTES =====
const publicRoutes = {
  '/': renderHome,
  '/login': renderLogin,
  '/updates': updates,
  '/form': async () => {
    const html = await customFormHTML();
    setTimeout(() => customFormAfterRender(), 0);
    return html;
  },
  '/requirements-form': async () => {
    const html = await requirementsFormHTML();
    setTimeout(() => requirementsFormAfterRender(), 0);
    return html;
  },
    '/agreements': async () => {
    const html = await documentViewerHTML();
    setTimeout(() => documentViewerAfterRender(), 0);
    return html;
  },
};

const privateRoutes = {
  '/dashboard': () => `<h2>Welcome to your dashboard, ${currentUser?.forename || ''}</h2>`,
  '/forms': () => { window.location.hash = "#/forms/list"; },
  '/forms/list': async () => {
    const html = formsPage(currentUser);
    setTimeout(() => loadForms(currentUser), 0);
    return `${formsSubNav}${html}`;
  },
  '/documents': async () => {
    const html = documentsPage(currentUser);
    setTimeout(() => loadDocuments(currentUser), 0);
    return `${documentsSubNav}${html}`;
  },
  '/my-clock': async () => {
    const html = clockPage(currentUser);
    setTimeout(() => loadClock(currentUser), 0);
    return `${documentsSubNav}${html}`;
  },
  '/document-builder': async () => {
    const html = await documentBuilderHTML();
    setTimeout(() => documentBuilderAfterRender(currentUser), 0);
    return `${documentsSubNav}${html}`;
  },
  '/document': async () => {
    const html = await documentViewerHTML();
    setTimeout(() => documentViewerAfterRender(currentUser), 0);
    return html;
  },
  '/forms/create': async () => {
    const html = formBuilderPage();
    setTimeout(() => loadFormBuilderPage(currentUser), 0);
    return `${formsSubNav}${html}`;
  },
  '/bookings': async () => {
    const html = bookingsPage(currentUser);
    setTimeout(() => loadBookings(currentUser), 0);
    return html;
  },
  '/calendar': async () => {
    const html = calendarPage(currentUser);
    setTimeout(() => loadCalendar(currentUser), 0);
    return html;
  },
  '/rota': async () => {
    const html = rotaPage(currentUser);
    setTimeout(() => loadRota(currentUser), 0);
    return html;
  },
  '/bookings/view': async () => {
    const html = bookingHTML();
    setTimeout(() => bookingAfterRender(currentUser), 0);
    return html;
  },
  '/settings': () => { window.location.hash = "#/settings/profile"; },
  '/settings/profile': async () => {
    const html = settingsPage(currentUser);
    setTimeout(() => loadSettings(currentUser), 0);
    return `${settingsSubNav}${html}`;
  },
  '/settings/bookableSpaces': async () => {
    const html = bookableSpacesHTML();
    setTimeout(() => bookableSpacesAfterRender(currentUser), 0);
    return `${settingsSubNav}${html}`;
  },
  '/settings/bookableEquipment': async () => {
    const html = bookableEquipmentHTML();
    setTimeout(() => bookableEquipmentAfterRender(currentUser), 0);
    return `${settingsSubNav}${html}`;
  },
  '/settings/userManagement': async () => {
    const html = usersPageHtml();
    setTimeout(() => loadUsersPage(currentUser), 0);
    return `${settingsSubNav}${html}`;
  },
  '/invoice-and-quote': async () => {
    const html = invoicePage();
    setTimeout(() => loadInvoice(currentUser), 0);
    return html;
  },
  '/manager-clock': async () => {
  const users = await select("users", "*", {column:"organisationId", operator:"eq", value:currentUser.organisationId}) || [];
  const html = managerClockPage(users);
  setTimeout(() => loadManagerClock(users, currentUser.organisationId), 0);
  return html;
},
  '/my-rota': async () => {
    const html = myRotaPage();
    setTimeout(() => loadMyRota(currentUser), 0);
    return html;
  },
  '/settings/orgSettings': async () => `${settingsSubNav}${orgSettings()}`,
  '/settings/bookingWorkflow': async () => {
    const html = bookingWorflowHTML();
    setTimeout(() => loadBookingWorkflow(currentUser), 0);
    return `${settingsSubNav}${html}`;
  }
};

const adminRoutes = {
  '/dashboard': () => `<h2>Welcome to your dashboard, ${currentUser?.forename || ''}</h2>`,
  '/profile': () => `<p>User profile for ${currentUser?.email || ''}</p>`,
  '/manageorg': async () => {
    const html = manageorg();
    setTimeout(() => attachManageOrgListeners(), 0);
    return html;
  },
};

// ===== STYLESHEETS =====
function setStylesheet(type) {
  document.querySelectorAll('link[data-dynamic="true"]').forEach(l => l.remove());
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = type === 'public' ? 'css/public.css' : 'css/styles.css?v=3';
  sheet.setAttribute('data-dynamic', 'true');
  document.head.appendChild(sheet);
}

// ===== CLOCK LOGIC =====
async function updateClockNavBtn(userId) {
  const btn = document.getElementById("clockNavBtn");
  if (!btn) return;

  try {
    const rows = await select("clock", "*", { column: "uId", operator: "eq", value: userId });
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latest = rows[0];

    if (!latest || latest.action === "out") {
      btn.textContent = "⏱ Clocked Out";
      if (btn._interval) clearInterval(btn._interval);
      btn._interval = null;
    } else {
      const start = new Date(latest.created_at);
      function tick() {
        const elapsedMs = Date.now() - start.getTime();
        const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
        const mins = Math.floor((elapsedMs / (1000 * 60)) % 60);
        btn.textContent = `⏱ Clocked In (${hours}h ${mins}m)`;
      }
      tick();
      if (!btn._interval) btn._interval = setInterval(tick, 60000);
    }
  } catch (err) {
    console.error("❌ Error updating clock:", err);
  }
}

async function toggleClock(userId) {
  const btn = document.getElementById("clockNavBtn");
  if (!btn) return;

  try {
    const rows = await select("clock", "*", { column: "uId", operator: "eq", value: userId });
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latest = rows[0];
    const newAction = !latest || latest.action === "out" ? "in" : "out";

    await insert("clock", { uId: userId, action: newAction , oId: currentUser.organisationId});
    updateClockNavBtn(userId);
  } catch (err) {
    console.error("❌ Error toggling clock:", err);
  }
}

// ===== LAYOUTS =====
export function renderPublicLayout(content) {
  return `
    <header>
      <a href="#/" class="logo"><img src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1/Group%207.svg" alt="Company logo" /></a>
      <div class="links">
        <a href="#/">Home</a>
        <a href="#/updates">Updates</a>
      </div>
      <a href="#/login">Portal Login</a>
    </header>
    <main class="content">${content}
    <footer>
      <p>BOOKING ORCHARD LTD is a UK company registered in England and Wales</p>
      <p>Registration Number</p>
      <p>Copyright of BOOKING ORCHARD LTD 2025</p>
    </footer>
    </main>
  `;
}

export function renderPrivateLayout(content) {
  
  const html = `
    <nav class="private-nav">
      <div class="user-card">
        <a  id="user-card" style="display:flex;gap:5px"><img style="width:40px;height:40px;border-radius:500px" src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${currentUser.id}"></img><div style="width:calc(300px - 60px);overflow:hidden;">${currentUser.forename+" "+currentUser.surname}<br><p>${currentUser.email}</p></div></a>
        <a  id="btn-logout" style="display:none"><p>Log out</p></a>
        <a  id="btn-settings" style="display:none" href="#/settings"><p>Settings</p></a>
        </div>
      <div class="nav-links">
        <a href="#/dashboard" class="nav-link">Dashboard</a>
        <a href="#/bookings" class="nav-link">Bookings</a>
        <a href="#/forms" class="nav-link">Forms</a>
        <a href="#/documents" class="nav-link">Documents</a>
        <a href="#/calendar" class="nav-link">Calendar</a>
        <a href="#/rota" class="nav-link">Rota</a>
        <a href="#/my-rota" class="nav-link">My Rota</a>
        <a href="#/my-clock" class="nav-link">My Clock</a>
        <a href="#/manager-clock" class="nav-link">Manager Clock</a>
      </div>
      
      <button id="clockNavBtn" class="nav-btn">⏱ Clocked Out</button>
      
    </nav>
    <div class="main">${content}</div>
  `;
  return markActiveLinks(html);
}

export function renderAdminLayout(content) {
  const html = `
    <nav class="private-nav">
      <a href="#/" class="logo-link"><img src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Group%205.png" alt="Company logo" /></a>
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

// ===== ACTIVE LINKS =====
export function markActiveLinks(html) {
  const currentPath = location.hash.slice(1).split('?')[0] || '/';
  return html.replace(/<a href="([^"]+)"/g, (match, href) => {
    const hrefPath = href.startsWith('#') ? href.slice(1).split('?')[0] : href.split('?')[0];
    const isActive = currentPath === hrefPath || (hrefPath !== '/' && currentPath.startsWith(hrefPath));
    if (isActive) {
      if (match.includes('class="')) return match.replace(/class="([^"]*)"/, (_, classes) => `class="${classes} activesubnav"`);
      return `<a href="${href}" class="activesubnav"`;
    }
    return match;
  });
}

// ===== ROUTER =====
async function router() {
  const fullHash = location.hash.slice(1) || '/';
  const [hashPath] = fullHash.split('?');
  const app = document.getElementById('app');

  currentUser = await checkSession();

  if (!currentUser && privateRoutes[hashPath]) {
    location.hash = '#/login';
    return;
  }

  let view, content;

  if (currentUser && (privateRoutes[hashPath] || adminRoutes[hashPath])) {
    setStylesheet('private');

    if (currentUser.product === "admin" && adminRoutes[hashPath]) {
      view = adminRoutes[hashPath];
      content = typeof view === 'function' ? await view() : view;
      app.innerHTML = renderAdminLayout(content);
    } else {
      view = privateRoutes[hashPath];
      content = typeof view === 'function' ? await view() : view;
      app.innerHTML = renderPrivateLayout(content);
      const usrCard = document.getElementById("user-card");
const btnLogout = document.getElementById("btn-logout");
const btnSettings = document.getElementById("btn-settings");

usrCard.addEventListener("click", () => {
  if (btnLogout.style.display === "block") {
    btnLogout.style.display = "none";
    btnSettings.style.display = "none";
  } else {
    btnLogout.style.display = "block";
    btnSettings.style.display = "block";
  }
});
    }

    // LOGOUT
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener("click", async () => { await logout(); location.hash = '#/login'; });

    // CLOCK BUTTON
    const clockBtn = document.getElementById("clockNavBtn");
    if (clockBtn) {
      clockBtn.addEventListener("click", () => toggleClock(currentUser.id));
      updateClockNavBtn(currentUser.id);
    }

  } else if (publicRoutes[hashPath]) {
    setStylesheet('public');
    view = publicRoutes[hashPath];
    content = typeof view === 'function' ? await view() : view;
    app.innerHTML = renderPublicLayout(content);
    if (hashPath === '/login') setupLoginForm?.();
  } else {
    setStylesheet('public');
    app.innerHTML = `<h2>Page not found</h2>`;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
