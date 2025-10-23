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
import dashboardPage, { loadDashboard } from '../views/dashboard.js';

let currentUser = null;

// ===== PERMISSION TEMPLATES =====
const PRODUCTS = {
  "Basic": [
    "Bookings Tab",
    "Manage and Create Forms",
    "Manage and Create Documents",
    "Calendar of Bookings",
    "Manage Rota",
    "Personal Rota",
    "Manage Timeclock",
    "Personal Timeclock",
    "Manage Organisation"
  ]
};

function hasPermission(user, product, action) {
  if (!user?.permissionJSON) return false;
  try {
    const perms = JSON.parse(user.permissionJSON);
    return perms[product]?.includes(action);
  } catch (err) {
    console.error("Failed to parse permissionJSON", err);
    return false;
  }
}

// ===== SUBNAVS WITH PERMISSIONS =====
function buildSubnav(items) {
  return subnav(
    items.filter(item => {
      // If no permission required, always show
      if (!item.perm) return true;
      return hasPermission(currentUser, item.perm.product, item.perm.action);
    })
  );
}

// Forms subnav
const formsSubNav = () =>
  buildSubnav([
    { link: '#/forms/list', label: 'Forms', perm: { product: "Basic", action: "Manage and Create Forms" } },
    { link: '#/forms/create', label: 'Create', perm: { product: "Basic", action: "Manage and Create Forms" } },
  ]);

// Settings subnav
const settingsSubNav = () =>
  buildSubnav([
    { link: '#/settings/profile', label: 'Profile' },
    { link: '#/settings/userManagement', label: 'Users', perm: { product: "Basic", action: "Manage Organisation" } },
    { link: '#/settings/bookableSpaces', label: 'Spaces', perm: { product: "Basic", action: "Manage Organisation" } },
    { link: '#/settings/bookableEquipment', label: 'Equipment', perm: { product: "Basic", action: "Manage Organisation" } },
    { link: '#/settings/orgSettings', label: 'Organisation', perm: { product: "Basic", action: "Manage Organisation" } },
  ]);

// Documents subnav
const documentsSubNav = () =>
  buildSubnav([
    { link: '#/documents', label: 'Documents', perm: { product: "Basic", action: "Manage and Create Documents" } },
    { link: '#/document-builder', label: 'New Document', perm: { product: "Basic", action: "Manage and Create Documents" } },
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
  '/dashboard': () => {
    const html = dashboardPage();
    setTimeout(() => loadDashboard(currentUser), 0);
    return html;
  },
  '/forms': () => { window.location.hash = "#/forms/list"; },
  '/forms/list': async () => {
    const html = formsPage(currentUser);
    setTimeout(() => loadForms(currentUser), 0);
    return `${formsSubNav()}${html}`;
  },
  '/documents': async () => {
    const html = documentsPage(currentUser);
    setTimeout(() => loadDocuments(currentUser), 0);
    return `${html}`;
  },
  '/my-clock': async () => {
    const html = clockPage(currentUser);
    setTimeout(() => loadClock(currentUser), 0);
    return `${html}`;
  },
  '/document-builder': async () => {
    const html = await documentBuilderHTML();
    setTimeout(() => documentBuilderAfterRender(currentUser), 0);
    return `${documentsSubNav()}${html}`;
  },
  '/document': async () => {
    const html = await documentViewerHTML();
    setTimeout(() => documentViewerAfterRender(currentUser), 0);
    return html;
  },
  '/forms/create': async () => {
    const html = formBuilderPage();
    setTimeout(() => loadFormBuilderPage(currentUser), 0);
    return `${formsSubNav()}${html}`;
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
    return `${settingsSubNav()}${html}`;
  },
  '/settings/bookableSpaces': async () => {
    const html = bookableSpacesHTML();
    setTimeout(() => bookableSpacesAfterRender(currentUser), 0);
    return `${settingsSubNav()}${html}`;
  },
  '/settings/bookableEquipment': async () => {
    const html = bookableEquipmentHTML();
    setTimeout(() => bookableEquipmentAfterRender(currentUser), 0);
    return `${settingsSubNav()}${html}`;
  },
  '/settings/userManagement': async () => {
    const html = usersPageHtml();
    setTimeout(() => loadUsersPage(currentUser), 0);
    return `${settingsSubNav()}${html}`;
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
  '/settings/orgSettings': async () => `${settingsSubNav()}${orgSettings()}`,
  '/settings/bookingWorkflow': async () => {
    const html = bookingWorflowHTML();
    setTimeout(() => loadBookingWorkflow(currentUser), 0);
    return `${settingsSubNav()}${html}`;
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
      <p>Company Registration Number 16751616</p>
      <p>Copyright of BOOKING ORCHARD LTD 2025</p>
    </footer>
    </main>
  `;
}

export function renderPrivateLayout(content) {
  const navItems = [
    { href: "#/dashboard", label: "Dashboard" },
    { href: "#/bookings", label: "Bookings", perm: { product: "Basic", action: "Bookings Tab" } },
    { href: "#/forms", label: "Forms", perm: { product: "Basic", action: "Manage and Create Forms" } },
    { href: "#/documents", label: "Documents", perm: { product: "Basic", action: "Manage and Create Documents" } },
    { href: "#/calendar", label: "Calendar", perm: { product: "Basic", action: "Calendar of Bookings" } },
    { href: "#/rota", label: "Rota", perm: { product: "Basic", action: "Manage Rota" } },
    { href: "#/my-rota", label: "My Rota", perm: { product: "Basic", action: "Personal Rota" } },
    { href: "#/my-clock", label: "My Clock", perm: { product: "Basic", action: "Personal Timeclock" } },
    { href: "#/manager-clock", label: "Manager Clock", perm: { product: "Basic", action: "Manage Timeclock" } },
  ];

  const linksHtml = navItems
    .filter(item => !item.perm || hasPermission(currentUser, item.perm.product, item.perm.action))
    .map(item => `<a href="${item.href}" class="nav-link">${item.label}</a>`).join("");

  const html = `
    <nav class="private-nav">
      <div class="user-card">
        <a id="user-card" style="display:flex;gap:5px">
          <img style="width:40px;height:40px;border-radius:500px" src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${currentUser.id}"></img>
          <div style="width:calc(300px - 60px);overflow:hidden;">
            ${currentUser.forename + " " + currentUser.surname}<br><p>${currentUser.email}</p>
          </div>
        </a>
        <a id="btn-logout" style="display:none"><p>Log out</p></a>
        <a id="btn-settings" style="display:none" href="#/settings"><p>Settings</p></a>
      </div>
      <div class="nav-links">
        ${linksHtml}
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

    // ===== PERMISSIONS LOGIC =====
    const routePermissions = {
      "/forms": {product: "Basic", action: "Manage and Create Forms"},
      "/forms/list": {product: "Basic", action: "Manage and Create Forms"},
      "/documents": {product: "Basic", action: "Manage and Create Documents"},
      "/my-clock": {product: "Basic", action: "Personal Timeclock"},
      "/document-builder": {product: "Basic", action: "Manage and Create Documents"},
      "/bookings": {product: "Basic", action: "Bookings Tab"},
      "/calendar": {product: "Basic", action: "Calendar of Bookings"},
      "/rota": {product: "Basic", action: "Manage Rota"},
      "/my-rota": {product: "Basic", action: "Personal Rota"},
      "/manager-clock": {product: "Basic", action: "Manage Timeclock"},
      "/settings/userManagement": {product: "Basic", action: "Manage Organisation"}
    };

    if (routePermissions[hashPath]) {
      const {product, action} = routePermissions[hashPath];
      if (!hasPermission(currentUser, product, action)) {
        app.innerHTML = `<h2>You do not have permission to view this page</h2>`;
        return;
      }
    }

    // ===== LOAD ROUTE =====
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
