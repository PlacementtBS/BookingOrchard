import { select, insert, update } from "../js/db.js";

let currentMonth = new Date();
let viewingUser = null; // null = all users

export default function managerClockPage(users) {
  const userOptions = users
    .map(u => `<option value="${u.id}">${u.forename} ${u.surname}</option>`)
    .join("");

  return `
    <div class="manager-clock-page">
      <h2>Manager Clock</h2>

      <div class="manager-controls">
        <label>
          View clocks for:
          <select id="managerUserSelect">
            <option value="">All Staff</option>
            ${userOptions}
          </select>
        </label>
      </div>

      <div class="month-nav">
        <button id="prevMonth">⬅ Prev</button>
        <span id="monthLabel"></span>
        <button id="nextMonth">Next ➡</button>
      </div>

      <table id="managerClockTable" class="clock-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Staff</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
        <tfoot>
          <tr>
            <td><b>Total</b></td>
            <td colspan="5" id="monthlyTotal"></td>
          </tr>
        </tfoot>
      </table>

      <button id="addClockBtn" class="primaryButton">+ Add Clock</button>
    </div>
  `;
}

export async function loadManagerClock(users, oId) {
  try {
    const tableBody = document.querySelector("#managerClockTable tbody");
    const monthLabel = document.getElementById("monthLabel");
    const monthlyTotalEl = document.getElementById("monthlyTotal");
    const userSelect = document.getElementById("managerUserSelect");

    if (!tableBody || !monthLabel || !userSelect) return;

    // Who are we viewing?
    viewingUser = userSelect.value || null;

    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    monthLabel.textContent = currentMonth.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // Month range
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    // Fetch clocks
    let clocks =
      (await select("clock", "*", { column: "oId", operator: "eq", value: oId })) || [];

    // Filter by user if selected
    if (viewingUser) clocks = clocks.filter(c => c.uId === viewingUser);

    // Sort by date
    clocks.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    tableBody.innerHTML = "";
    monthlyTotalEl.textContent = "";

    // Aggregate clocks by day
    const dayMap = new Map();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      dayMap.set(key, []);
    }

    clocks.forEach(c => {
      const dateKey = new Date(c.timestamp).toISOString().split("T")[0];
      if (dayMap.has(dateKey)) dayMap.get(dateKey).push(c);
    });

    // Track total minutes in the month
    let monthlyMinutes = 0;

    // Render rows
    dayMap.forEach((entries, dayKey) => {
      if (entries.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${new Date(dayKey).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
          <td colspan="5">No clocks</td>
        `;
        tableBody.appendChild(tr);
        return;
      }

      // Group clocks by user
      const userMap = new Map();
      entries.forEach(e => {
        if (!userMap.has(e.uId)) userMap.set(e.uId, []);
        userMap.get(e.uId).push(e);
      });

      userMap.forEach((userClocks, uId) => {
        for (let i = 0; i < userClocks.length; i++) {
          const cIn = userClocks[i];
          if (cIn.action !== "in") continue;
          const cOut = userClocks[i + 1] && userClocks[i + 1].action === "out" ? userClocks[i + 1] : null;

          if (!cOut) continue;

          const inTime = new Date(cIn.timestamp);
          const outTime = new Date(cOut.timestamp);

          const tr = document.createElement("tr");
          const userObj = users.find(u => u.id === uId);
          const staffName = userObj ? `${userObj.forename} ${userObj.surname}` : "Unknown";

          const diffMs = outTime - inTime;
          const h = Math.floor(diffMs / (1000 * 60 * 60));
          const m = Math.floor((diffMs / (1000 * 60)) % 60);
          monthlyMinutes += h * 60 + m;

          tr.innerHTML = `
            <td>${new Date(dayKey).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
            <td>${staffName}</td>
            <td>${inTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
            <td>${outTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
            <td>${h}h ${m}m</td>
            <td>
              <button class="edit-clock" data-in="${cIn.id}" data-out="${cOut.id}">Edit</button>
            </td>
          `;
          tableBody.appendChild(tr);

          tr.querySelector(".edit-clock").onclick = () => openEditClock(cIn, cOut, users, oId);
        }
      });
    });

    monthlyTotalEl.textContent = `${Math.floor(monthlyMinutes / 60)}h ${monthlyMinutes % 60}m`;

    // Month navigation
    document.getElementById("prevMonth").onclick = () => {
      currentMonth = new Date(year, month - 1, 1);
      loadManagerClock(users, oId);
    };
    document.getElementById("nextMonth").onclick = () => {
      currentMonth = new Date(year, month + 1, 1);
      loadManagerClock(users, oId);
    };

    // User select change
    userSelect.onchange = () => loadManagerClock(users, oId);

    // Add clock
    document.getElementById("addClockBtn").onclick = () => openAddClock(users, oId);

  } catch (err) {
    console.error("❌ Error in loadManagerClock:", err);
    const tableBody = document.querySelector("#managerClockTable tbody");
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="color:red;">Error loading clock data</td></tr>`;
  }
}

// --- Helpers ---

function openEditClock(cIn, cOut, users, oId) {
  const newIn = prompt("Edit Clock In (HH:MM)", new Date(cIn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  const newOut = prompt("Edit Clock Out (HH:MM)", new Date(cOut.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  if (!newIn || !newOut) return;

  const inDate = new Date(cIn.timestamp);
  const outDate = new Date(cOut.timestamp);

  const [inH, inM] = newIn.split(":").map(Number);
  const [outH, outM] = newOut.split(":").map(Number);

  inDate.setHours(inH, inM, 0, 0);
  outDate.setHours(outH, outM, 0, 0);

  update("clock", { timestamp: inDate.toISOString() }, { column: "id", operator: "eq", value: cIn.id });
  update("clock", { timestamp: outDate.toISOString() }, { column: "id", operator: "eq", value: cOut.id });

  setTimeout(() => loadManagerClock(users, oId), 50);
}

function openAddClock(users, oId) {
  const uId = prompt("Staff ID (or leave blank for first user):", users[0]?.id || "");
  if (!uId) return;

  const dateStr = prompt("Date (YYYY-MM-DD)", new Date().toISOString().split("T")[0]);
  if (!dateStr) return;

  const inTimeStr = prompt("Clock In (HH:MM)", "09:00");
  const outTimeStr = prompt("Clock Out (HH:MM)", "17:00");
  if (!inTimeStr || !outTimeStr) return;

  const inDate = new Date(`${dateStr}T${inTimeStr}:00`);
  const outDate = new Date(`${dateStr}T${outTimeStr}:00`);

  insert("clock", { uId, action: "in", timestamp: inDate.toISOString(), oId });
  insert("clock", { uId, action: "out", timestamp: outDate.toISOString(), oId });

  setTimeout(() => loadManagerClock(users, oId), 50);
}
