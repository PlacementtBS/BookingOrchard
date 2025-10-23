// schedule.js
import { select, insert, update, remove } from "../js/db.js";

let currentWeekStart = getMonday(new Date());
let weekBookings = [];
let weekRoles = [];
let weekAssignments = [];
let usersCache = [];

// localStorage clipboards
let shiftClipboard = JSON.parse(localStorage.getItem("shiftClipboard") || "null");
let fullRotaClipboard = JSON.parse(localStorage.getItem("fullRotaClipboard") || "null");

// Small system message helper (non-blocking)
function showSystemMessage(text, type = "alert") {
  let container = document.getElementById("systemMessages");
  if (!container) {
    container = document.createElement("div");
    container.id = "systemMessages";
    container.style.position = "fixed";
    container.style.bottom = "10px";
    container.style.right = "10px";
    container.style.zIndex = "2000";
    document.body.appendChild(container);
  }
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.className = type;
  msg.style.marginTop = "6px";
  msg.style.padding = "8px";
  msg.style.borderRadius = "4px";
  msg.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)";
  msg.style.background = type === "success" ? "#e6ffed" : "#fff3cd";
  msg.style.border = type === "success" ? "1px solid #b7f0c3" : "1px solid #f0d88a";
  container.appendChild(msg);
  setTimeout(() => msg.remove(), 4000);
}

// -------------------- Utilities --------------------
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseDateYMD(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return new Date(dateStr);
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}
function isDateInCurrentWeek(dateStr, weekStart) {
  const date = parseDateYMD(dateStr);
  const wkStart = new Date(weekStart);
  wkStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(wkStart);
  weekEnd.setDate(wkStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return date >= wkStart && date <= weekEnd;
}
function updateWeekDisplay() {
  const p = document.getElementById("week");
  if (!p) return;
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 6);
  p.textContent = `${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
}

// -------------------- Load caches --------------------
async function loadUsers(currentUser) {
  usersCache = await select("users", "*", { column: "organisationId", operator: "eq", value: currentUser.organisationId });
}
async function loadRolesForWeek(currentUser) {
  const weekDate = formatDate(currentWeekStart);
  const rolesData = await select("rotaRoles", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
  const thisWeek = rolesData.find(r => r.weekDate === weekDate);
  weekRoles = thisWeek
    ? JSON.parse(thisWeek.roles).map(r => ({
        id: r.id || crypto.randomUUID(),
        role: r.role,
        shifts: r.shifts
      }))
    : [];
}
async function loadAssignments(currentUser) {
  const weekStartStr = formatDate(currentWeekStart);
  const assignments = await select("rotaAssignments", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
  // ensure published property exists (set to false if undefined)
  weekAssignments = assignments
    .filter(a => formatDate(parseDateYMD(a.weekStart) || a.weekStart) === weekStartStr)
    .map(a => ({ published: !!a.published, ...a }));
}

// -------------------- Copy / Paste single shift --------------------
function copyShift(assignment) {
  // copy assignment but clear person id, assign a new local id for clipboard to avoid collisions
  shiftClipboard = { ...assignment, id: crypto.randomUUID(), uId: null };
  localStorage.setItem("shiftClipboard", JSON.stringify(shiftClipboard));
  showSystemMessage("Shift copied", "success");
}
async function pasteShift(currentUser, role, dateStr) {
  if (!shiftClipboard) return showSystemMessage("No shift copied", "alert");
  // Prevent double-booking for any user (clipboard uId is null normally, but check)
  if (shiftClipboard.uId) {
    const conflicts = weekAssignments.filter(a =>
      a.uId === shiftClipboard.uId &&
      a.date === dateStr &&
      ((a.start && a.end && shiftClipboard.start && shiftClipboard.end) &&
        !(a.end <= shiftClipboard.start || a.start >= shiftClipboard.end))
    );
    if (conflicts.length) return showSystemMessage("User already scheduled at this time!", "alert");
  }
  const newShift = {
    id: crypto.randomUUID(),
    oId: currentUser.organisationId,
    role: role.id,
    date: dateStr,
    weekStart: formatDate(currentWeekStart),
    uId: null,
    start: shiftClipboard.start || "",
    end: shiftClipboard.end || "",
    published: false
  };
  await insert("rotaAssignments", newShift);
  await loadRota(currentUser);
  showSystemMessage("Shift pasted", "success");
}

// -------------------- Copy / Paste full rota (roles + assignments) --------------------
async function copyFullRota(currentUser) {
  await loadRolesForWeek(currentUser);
  await loadAssignments(currentUser);
  fullRotaClipboard = {
    weekRoles: JSON.parse(JSON.stringify(weekRoles)),
    weekAssignments: JSON.parse(JSON.stringify(weekAssignments))
  };
  localStorage.setItem("fullRotaClipboard", JSON.stringify(fullRotaClipboard));
  showSystemMessage("Full rota copied", "success");
}
async function pasteFullRota(currentUser) {
  if (!fullRotaClipboard) return showSystemMessage("No rota copied", "alert");

  // 1) Paste roles (save as new roles for current week)
  weekRoles = fullRotaClipboard.weekRoles.map(r => ({ ...r, id: crypto.randomUUID() }));
  await saveRolesForCurrentWeek(currentUser);

  // 2) Paste assignments with date-shift mapping
  // Determine original weekStart used in copied assignments:
  // If there are any in clipboard, use the weekStart of first; otherwise default to currentWeekStart (no assignments -> nothing to insert).
  const clipboardAssignments = fullRotaClipboard.weekAssignments || [];
  if (clipboardAssignments.length > 0) {
    // find earliest weekStart in clipboard (should be the same for all)
    const oldWeekStartStr = clipboardAssignments[0].weekStart || clipboardAssignments[0].weekStart;
    const oldWeekStartDate = parseDateYMD(oldWeekStartStr);

    // For each assignment, compute offset days from oldWeekStart and apply to currentWeekStart
    const assignmentsToInsert = clipboardAssignments.map(a => {
      const oldDate = parseDateYMD(a.date);
      const diffDays = Math.round((oldDate - oldWeekStartDate) / 86400000);
      const newDate = new Date(currentWeekStart);
      newDate.setDate(newDate.getDate() + diffDays);
      return {
        ...a,
        id: crypto.randomUUID(),
        date: formatDate(newDate),
        weekStart: formatDate(currentWeekStart),
        // keep times but reset user to null to avoid copying users across weeks; if you want to preserve uId, change this line
        uId: null,
        published: false // pasted assignments are unpublished by default so they can be published
      };
    });

    // Insert assignments
    for (const assignment of assignmentsToInsert) {
      // Use insert; ensure we don't include old created_at, etc.
      await insert("rotaAssignments", assignment);
    }
  }

  await loadRota(currentUser);
  showSystemMessage("Rota pasted for this week!", "success");
}

// -------------------- Export as PDF (loads libs if needed) --------------------
function ensureScript(url) {
  return new Promise((resolve, reject) => {
    // Already loaded?
    if ([...document.scripts].some(s => s.src && s.src.indexOf(url) !== -1)) {
      return resolve();
    }
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
}
export async function exportRotaPDF() {
  const table = document.querySelector(".rota");
  if (!table) return showSystemMessage("No rota table found.", "alert");

  // Load html2canvas and jspdf if missing (CDN)
  try {
    if (!window.html2canvas) {
      await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    }
    if (!window.jspdf) {
      await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
  } catch (err) {
    return showSystemMessage("Failed to load PDF libraries", "alert");
  }

  window.html2canvas(table, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("l", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = pageWidth / imgWidth;
    let heightLeft = imgHeight * ratio;
    let position = 20;

    pdf.addImage(imgData, "PNG", 20, position, pageWidth - 40, imgHeight * ratio);
    heightLeft -= pageHeight - 40;

    while (heightLeft > 0) {
      pdf.addPage();
      position = 20 - heightLeft;
      pdf.addImage(imgData, "PNG", 20, position, pageWidth - 40, imgHeight * ratio);
      heightLeft -= pageHeight - 40;
    }

    pdf.save(`rota_${formatDate(new Date(currentWeekStart))}.pdf`);
    showSystemMessage("PDF exported", "success");
  });
}

// -------------------- Publish / Unpublish logic --------------------
async function publishWeek(currentUser) {
  // set published true for all assignments in the week
  const weekStartStr = formatDate(currentWeekStart);
  // load assignments to operate on latest
  await loadAssignments(currentUser);
  const toPublish = weekAssignments.filter(a => !a.published);
  for (const a of toPublish) {
    await update("rotaAssignments", { published: true }, { column: "id", operator: "eq", value: a.id });
  }
  await loadRota(currentUser);
  showSystemMessage("Week published", "success");
}
async function unpublishWeek(currentUser) {
  const weekStartStr = formatDate(currentWeekStart);
  await loadAssignments(currentUser);
  const toUnpublish = weekAssignments.filter(a => a.published);
  for (const a of toUnpublish) {
    await update("rotaAssignments", { published: false }, { column: "id", operator: "eq", value: a.id });
  }
  await loadRota(currentUser);
  showSystemMessage("Week unpublished", "success");
}
async function publishSingleAssignment(currentUser, assignment) {
  await update("rotaAssignments", { published: true }, { column: "id", operator: "eq", value: assignment.id });
  await loadRota(currentUser);
  showSystemMessage("Shift published", "success");
}
async function unpublishSingleAssignment(currentUser, assignment) {
  await update("rotaAssignments", { published: false }, { column: "id", operator: "eq", value: assignment.id });
  await loadRota(currentUser);
  showSystemMessage("Shift unpublished", "success");
}

// -------------------- Right-Click Menu --------------------
function addRightClickMenu(td, assignment, currentUser, role = null, dateStr = null, booking = null, timingKey = null) {
  td.oncontextmenu = e => {
    e.preventDefault();

    const existingMenu = document.querySelector(".contextMenu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.className = "contextMenu";
    menu.style.position = "absolute";
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.style.background = "#fff";
    menu.style.border = "1px solid #ccc";
    menu.style.padding = "5px";
    menu.style.zIndex = 10000;
    menu.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    menu.style.minWidth = "140px";

    let itemsHTML = "";

    // Existing shift -> delete / copy / publish/unpublish
    if (assignment) {
      itemsHTML += `<div class="menuItem" id="deleteShift">Delete Shift</div>`;
      itemsHTML += `<div class="menuItem" id="copyShift">Copy Shift</div>`;
      if (assignment.published) itemsHTML += `<div class="menuItem" id="unpublishShift">Unpublish Shift</div>`;
      else itemsHTML += `<div class="menuItem" id="publishShift">Publish Shift</div>`;
    }

    // Empty cell -> paste (if clipboard) or create shift
    if (!assignment && shiftClipboard) {
      itemsHTML += `<div class="menuItem" id="pasteShift">Paste Shift</div>`;
    }
    if (!booking && !assignment) {
      itemsHTML += `<div class="menuItem" id="createShift">Create Shift</div>`;
    }

    // Booking-specific
    if (booking && timingKey && booking.timings) {
      itemsHTML += `<div class="menuItem" id="deleteBookingTiming">Delete Booking Timing</div>`;
    }

    if (!itemsHTML) return;

    menu.innerHTML = itemsHTML;
    document.body.appendChild(menu);

    // Wiring
    const deleteShiftBtn = menu.querySelector("#deleteShift");
    if (deleteShiftBtn) deleteShiftBtn.onclick = async () => {
      if (!assignment) return;
      if (!confirm("Are you sure you want to delete this shift?")) { menu.remove(); return; }
      await remove("rotaAssignments", { column: "id", operator: "eq", value: assignment.id });
      menu.remove();
      await loadRota(currentUser);
    };

    const copyShiftBtn = menu.querySelector("#copyShift");
    if (copyShiftBtn) copyShiftBtn.onclick = () => { copyShift(assignment); menu.remove(); };

    const pasteShiftBtn = menu.querySelector("#pasteShift");
    if (pasteShiftBtn) pasteShiftBtn.onclick = async () => {
      await pasteShift(currentUser, role, dateStr);
      menu.remove();
    };

    const createShiftBtn = menu.querySelector("#createShift");
    if (createShiftBtn) createShiftBtn.onclick = () => { showShiftPopup(currentUser, role, dateStr, 0, null); menu.remove(); };

    const publishShiftBtn = menu.querySelector("#publishShift");
    if (publishShiftBtn) publishShiftBtn.onclick = async () => {
      await publishSingleAssignment(currentUser, assignment);
      menu.remove();
    };
    const unpublishShiftBtn = menu.querySelector("#unpublishShift");
    if (unpublishShiftBtn) unpublishShiftBtn.onclick = async () => {
      await unpublishSingleAssignment(currentUser, assignment);
      menu.remove();
    };

    const deleteBookingBtn = menu.querySelector("#deleteBookingTiming");
    if (deleteBookingBtn) deleteBookingBtn.onclick = async () => {
      const timings = booking.timings ? JSON.parse(booking.timings) : {};
      delete timings[timingKey];
      await update("bookings", { timings: JSON.stringify(timings) }, { column: "id", operator: "eq", value: booking.id });
      menu.remove();
      await loadRota(currentUser);
    };

    document.addEventListener("click", function handler() {
      menu.remove();
      document.removeEventListener("click", handler);
    });
  };
}

// -------------------- Roles Popup --------------------
async function showRolesPopup(currentUser) {
  const overlay = document.createElement("div");
  overlay.className = "popupOverlay";
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.style.width = "400px";

  let rolesHTML = "";
  weekRoles.forEach((r, idx) => {
    rolesHTML += `
      <div class="roleRow" data-index="${idx}">
        <input type="text" class="roleName" value="${r.role}" placeholder="Role Name" />
        <input type="number" class="roleShifts" value="${r.shifts || 1}" min="1" style="width:50px;" />
        <button class="deleteRoleBtn">Delete</button>
      </div>
    `;
  });

  popup.innerHTML = `
    <h2>Manage Roles - Week of ${formatDate(currentWeekStart)}</h2>
    <div id="rolesList">${rolesHTML}</div>
    <button id="addRoleBtn" class="primaryButton">Add Role</button>
    <div class="popupActions" style="margin-top:12px">
      <button id="saveRolesBtn" class="primaryButton">Save</button>
      <button id="closeRolesBtn" class="outlineButton">Close</button>
    </div>
  `;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  const rolesList = popup.querySelector("#rolesList");

  popup.querySelector("#addRoleBtn").onclick = () => {
    weekRoles.push({ role: "", shifts: 1, id: crypto.randomUUID() });
    const idx = weekRoles.length - 1;
    const div = document.createElement("div");
    div.className = "roleRow";
    div.dataset.index = idx;
    div.innerHTML = `
      <input type="text" class="roleName" value="" placeholder="Role Name" />
      <input type="number" class="roleShifts" value="1" min="1" style="width:50px;" />
      <button class="deleteRoleBtn">Delete</button>
    `;
    div.querySelector(".deleteRoleBtn").onclick = () => {
      weekRoles.splice(idx, 1);
      div.remove();
    };
    rolesList.appendChild(div);
  };

  popup.querySelectorAll(".deleteRoleBtn").forEach((btn, idx) => {
    btn.onclick = () => {
      weekRoles.splice(idx, 1);
      btn.parentElement.remove();
    };
  });

  popup.querySelector("#saveRolesBtn").onclick = async () => {
    rolesList.querySelectorAll(".roleRow").forEach((row, i) => {
      const name = row.querySelector(".roleName").value.trim();
      const shifts = parseInt(row.querySelector(".roleShifts").value, 10) || 1;
      weekRoles[i] = { id: weekRoles[i]?.id || crypto.randomUUID(), role: name, shifts };
    });
    await saveRolesForCurrentWeek(currentUser);
    overlay.remove();
    await loadRota(currentUser);
  };

  popup.querySelector("#closeRolesBtn").onclick = () => overlay.remove();
}

// -------------------- Save Roles --------------------
async function saveRolesForCurrentWeek(currentUser) {
  const weekDate = formatDate(currentWeekStart);
  const existing = await select("rotaRoles", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
  const thisWeek = existing.find(r => r.weekDate === weekDate);
  if (thisWeek) await update("rotaRoles", { roles: JSON.stringify(weekRoles) }, { column: "id", operator: "eq", value: thisWeek.id });
  else await insert("rotaRoles", { id: crypto.randomUUID(), oId: currentUser.organisationId, weekDate, roles: JSON.stringify(weekRoles) });
}

// -------------------- Shift Popup --------------------
async function showShiftPopup(currentUser, role, dateStr, shiftIndex, existing = null) {
  const overlay = document.createElement("div");
  overlay.className = "popupOverlay";
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.innerHTML = `
    <h2>Assign Shift - ${role ? role.role : "Role"} (${dateStr})</h2>
    <input type="text" id="userSearch" placeholder="Search user by name"/>
    <input type="time" id="shiftStart"/>
    <input type="time" id="shiftEnd"/>
    <div id="userResults" style="max-height:200px;overflow:auto;margin-top:10px;"></div>
    <div class="popupActions" style="margin-top:12px">
      <button id="saveShiftBtn" class="primaryButton">Save</button>
      <button id="closeShiftBtn" class="outlineButton">Close</button>
    </div>
  `;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  const userResults = popup.querySelector("#userResults");
  const searchInput = popup.querySelector("#userSearch");
  const startInput = popup.querySelector("#shiftStart");
  const endInput = popup.querySelector("#shiftEnd");

  // If existing assignment passed, autofill start/end and select user if present
  if (existing) {
    startInput.value = existing.start || "";
    endInput.value = existing.end || "";
  } else {
    // If empty slot but there's an assignment at this role/day for this shiftIndex that has times we want to prefill
    const dayAssignments = weekAssignments.filter(a => a.role === role.id && a.date === dateStr).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    const maybe = dayAssignments[shiftIndex];
    if (maybe && !maybe.uId) { // no person -> autofill times
      startInput.value = maybe.start || "";
      endInput.value = maybe.end || "";
    }
  }

  function searchUsers() {
    const q = searchInput.value.toLowerCase();
    const filtered = usersCache
      .filter(u => (u.forename + " " + u.surname).toLowerCase().includes(q))
      .slice(0, 10);
    userResults.innerHTML = "";
    filtered.forEach(u => {
      const div = document.createElement("div");
      div.className = "userRow";
      div.textContent = u.forename + " " + u.surname;
      div.dataset.userId = u.id;
      div.onclick = () => {
        Array.from(userResults.children).forEach(c => c.style.background = "");
        div.style.background = "#d0f0ff";
      };
      userResults.appendChild(div);
    });
  }
  searchInput.oninput = searchUsers;
  searchUsers();

  popup.querySelector("#saveShiftBtn").onclick = async () => {
    const selectedDiv = Array.from(userResults.children).find(c => c.style.background);
    const uId = selectedDiv?.dataset.userId || null;

    // Prevent double-booking
    if (uId) {
      const conflicts = weekAssignments.filter(a =>
        a.uId === uId &&
        a.date === dateStr &&
        ((a.start && a.end && startInput.value && endInput.value) &&
          !(a.end <= startInput.value || a.start >= endInput.value)) &&
        (!existing || a.id !== existing.id)
      );
      if (conflicts.length) { showSystemMessage("User already scheduled during this time!", "alert"); return; }
    }

    const assignmentsForDay = weekAssignments.filter(a => a.role === role.id && a.date === dateStr);
    const existingAssignment = existing || assignmentsForDay[shiftIndex];

    const newData = { uId, start: startInput.value || "", end: endInput.value || "" };

    if (existingAssignment) {
      // update existing assignment but keep published flag as-is (unless you want to reset)
      await update("rotaAssignments", newData, { column: "id", operator: "eq", value: existingAssignment.id });
    } else {
      // create new; default published false (so new shifts will be sent only if published)
      const insertData = {
        id: crypto.randomUUID(),
        oId: currentUser.organisationId,
        role: role.id,
        date: dateStr,
        weekStart: formatDate(currentWeekStart),
        ...newData,
        published: false
      };
      await insert("rotaAssignments", insertData);
    }

    overlay.remove();
    await loadRota(currentUser);
  };
  popup.querySelector("#closeShiftBtn").onclick = () => overlay.remove();
}

// -------------------- Render Week (bookings + roles + shifts) --------------------
async function renderWeekBookings(currentUser) {
  await loadRolesForWeek(currentUser);
  await loadAssignments(currentUser);
  await loadUsers(currentUser);

  const manageBtn = document.getElementById("manageRolesBtn");
  if (manageBtn) manageBtn.onclick = () => showRolesPopup(currentUser);

  const tableBody = document.getElementById("headerRow");
  tableBody.innerHTML = "";

  // Top row: day headers + compute daysOfWeek
  const headerRow = document.createElement("tr");
  const daysOfWeek = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(currentWeekStart);
    day.setDate(currentWeekStart.getDate() + i);
    day.setHours(0, 0, 0, 0);
    daysOfWeek.push(day);

    const th = document.createElement("th");
    th.textContent = day.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
    headerRow.appendChild(th);
  }
  tableBody.appendChild(headerRow);

  // Bookings rows (same as before)
  const bookingsByDay = daysOfWeek.map(day => {
    const dateStr = formatDate(day);
    return weekBookings.filter(b => b.date === dateStr);
  });

  for (let i = 0; i < Math.max(...bookingsByDay.map(b => b.length), 1); i++) {
    const row = document.createElement("tr");
    bookingsByDay.forEach(dayBookings => {
      const td = document.createElement("td");
      td.className = "booking-data";
      if (dayBookings[i]) {
        const booking = dayBookings[i];
        td.innerHTML = `<div>${booking.name}</div><div>${booking.startTime} - ${booking.endTime}</div>`;
        if (booking.timings) addRightClickMenu(td, null, currentUser, null, booking.date, booking, booking.date);
      } else td.innerHTML = `<div style="opacity:0;">-</div>`;
      row.appendChild(td);
    });
    tableBody.appendChild(row);
  }

  // Roles & shift rows
  for (const role of weekRoles) {
    const roleRow = document.createElement("tr");
    for (let i = 0; i < 7; i++) {
      const td = document.createElement("td");
      td.className = "role-title";
      td.textContent = role.role;
      roleRow.appendChild(td);
    }
    tableBody.appendChild(roleRow);

    for (let s = 0; s < role.shifts; s++) {
      const shiftRow = document.createElement("tr");
      for (let i = 0; i < 7; i++) {
        const td = document.createElement("td");
        td.className = "shift-cell";
        td.style.position = "relative"; // for publish badge
        td.innerHTML = "<div style='opacity:0'>-</div>";

        const dayDate = formatDate(daysOfWeek[i]);
        const assignmentsForDay = weekAssignments
          .filter(a => a.role === role.id && a.date === dayDate)
          .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
        const assignment = assignmentsForDay[s];

        if (assignment) {
          let userName = "Unassigned";
          if (assignment.uId) {
            const user = usersCache.find(u => u.id === assignment.uId);
            userName = user ? `${user.forename} ${user.surname}` : "Unknown";
          }
          let timeStr = "";
          if (assignment.start && assignment.end) {
            const formatHHMM = t => (t || "").slice(0, 5);
            timeStr = `<br>${formatHHMM(assignment.start)} - ${formatHHMM(assignment.end)}`;
          }
          td.innerHTML = `${userName}${timeStr}`;
          td.style.background = "#f0f8ff";

          // publish badge (small)
          const badge = document.createElement("span");
          badge.className = "publishBadge";
          badge.textContent = assignment.published ? "P" : "U";
          badge.title = assignment.published ? "Published" : "Unpublished";
          badge.style.position = "absolute";
          badge.style.top = "4px";
          badge.style.right = "6px";
          badge.style.fontSize = "10px";
          badge.style.fontWeight = "700";
          badge.style.padding = "2px 5px";
          badge.style.borderRadius = "3px";
          badge.style.background = assignment.published ? "#dff6e3" : "#fff2d9";
          badge.style.border = "1px solid rgba(0,0,0,0.08)";
          td.appendChild(badge);
        } else {
          // show a visible placeholder dash (but we still want context menu to work)
          td.innerHTML = `<div style="opacity:0.3">-</div>`;
        }

        // double-click/edit
        td.ondblclick = () => showShiftPopup(currentUser, role, dayDate, s, assignment || null);

        // drag/drop — only allow drop into truly empty slot (no assignment at this shift index)
        td.ondragover = e => e.preventDefault();
        td.ondrop = async e => {
          e.preventDefault();
          if (assignment) return; // don't allow drop onto occupied shift
          const assignmentId = e.dataTransfer.getData("text/plain");
          const sourceAssignment = weekAssignments.find(a => a.id === assignmentId);
          if (!sourceAssignment) return;
          await update("rotaAssignments", { role: role.id, date: dayDate }, { column: "id", operator: "eq", value: sourceAssignment.id });
          await loadRota(currentUser);
        };

        // draggable if there is an assignment
        td.draggable = !!assignment;
        td.ondragstart = e => { if (!assignment) return; e.dataTransfer.setData("text/plain", assignment.id); td.style.opacity = "0.5"; };
        td.ondragend = e => td.style.opacity = "1";

        // context menu must work on empty and occupied cells
        addRightClickMenu(td, assignment || null, currentUser, role, dayDate);

        shiftRow.appendChild(td);
      }
      tableBody.appendChild(shiftRow);
    }
  }
}

// -------------------- Load Rota (entry point) --------------------
export async function loadRota(currentUser) {
  // bookings
  const bookings = await select("bookings", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
  weekBookings = [];
  bookings.forEach(b => {
    const timings = b.timings ? JSON.parse(b.timings) : {};
    for (const dateStr in timings) {
      if (isDateInCurrentWeek(dateStr, currentWeekStart)) {
        weekBookings.push({
          id: b.id,
          name: b.name,
          date: dateStr,
          startTime: timings[dateStr].start,
          endTime: timings[dateStr].end,
          timings: b.timings
        });
      }
    }
  });
  weekBookings.sort((a, b) =>
    a.date === b.date ? (a.startTime || "").localeCompare(b.startTime || "") : a.date.localeCompare(b.date)
  );

  await renderWeekBookings(currentUser);
  updateWeekDisplay();

  // Hook up prev/next controls and other buttons
  const prevBtn = document.getElementById("prevWeek");
  const nextBtn = document.getElementById("nextWeek");
  const exportBtn = document.getElementById("exportPDFBtn");
  const copyBtn = document.getElementById("copyPrevRota");
  const manageBtn = document.getElementById("manageRolesBtn");
  const publishBtn = document.getElementById("publishWeek");

  if (prevBtn) prevBtn.onclick = () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); loadRota(currentUser); };
  if (nextBtn) nextBtn.onclick = () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); loadRota(currentUser); };
  if (exportBtn) exportBtn.onclick = () => exportRotaPDF();
  if (copyBtn) copyBtn.onclick = () => copyFullRota(currentUser);
  if (manageBtn) manageBtn.onclick = () => showRolesPopup(currentUser);

  // publish button behavior:
  // logic: if there are any assignments and all are published -> show "Unpublish"
  // if there are assignments and some unpublished -> show "Publish" (to publish newly added ones)
  // if no assignments -> button shows "Publish" (disabled maybe)
  await loadAssignments(currentUser); // refresh assignments
  const weekHasAssignments = weekAssignments.length > 0;
  const anyUnpublished = weekAssignments.some(a => !a.published);
  if (publishBtn) {
    if (!weekHasAssignments) {
      publishBtn.textContent = "Publish";
      publishBtn.onclick = () => publishWeek(currentUser);
    } else if (anyUnpublished) {
      publishBtn.textContent = "Publish";
      publishBtn.onclick = () => publishWeek(currentUser);
    } else {
      publishBtn.textContent = "Unpublish";
      publishBtn.onclick = () => unpublishWeek(currentUser);
    }
  }

  // Also update copy-prev-rota button to paste if full clipboard and week empty
  if (copyBtn) {
    if ((!weekRoles.length && !weekAssignments.length) && fullRotaClipboard) {
      copyBtn.textContent = "Paste Rota";
      copyBtn.onclick = () => pasteFullRota(currentUser);
    } else {
      copyBtn.textContent = "Copy Rota";
      copyBtn.onclick = () => copyFullRota(currentUser);
    }
  }
}

// -------------------- Page Layout (export default) --------------------
export default function rotaPage() {
  return `
    <section>
      <div style="display:flex; width: 100%;justify-content:space-between;vertical-align:middle;flex-direction:row">
      <i><button class="outlineButton" id="manageRolesBtn">Manage Roles</button>
      <button class="outlineButton" id="copyPrevRota">Copy Roles</button>
      
      </i>
      <div style="display:flex; width:fit-content;justify-content:space-between;vertical-align:middle;flex-direction:row">
      <button class="outlineButton" id="prevWeek">Prev</button>
      <button class="outlineButton" id="week" style="background:none;border:none !important;color:#000;vertical-align:middle; height:fit-content;width:fit-content"></button>
      <button class="outlineButton" id="nextWeek">Next</button>
      </div>
      <i><button class="outlineButton" id="exportPDFBtn">Download as PDF</button>
      <button class="outlineButton" id="publishWeek">Publish</button></i>
      </div>
    </section>

    <section style="min-height:90%">
      <div class="rota-container">
        <table class="rota">
          <tbody id="headerRow"></tbody>
        </table>
      </div>
    </section>
  `;
}
