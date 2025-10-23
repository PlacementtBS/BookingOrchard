import { select, insert } from "../js/db.js";

export default function dashboardPage() {
  return `
    <section>
      <div>Next Booking</div>
      <div class="third">
        <h2>Rota</h2>
        <div id="todaysRota" class="rota-wrapper" style="max-height:400px; overflow-y:auto;">
          <table id="todaysRotaTable" class="rota-grid condensed-rota"></table>
        </div>
      </div>
    </section>
    <section>
      <div class="third">
        <h2>Staff Clock</h2>
        <div id="staffClock"></div>
      </div>
      <div>Bookings Progress (this and next months)</div>
    </section>

    <!-- reuse same hoverCard markup/CSS so hover text is shared with full rota -->
    <div id="hoverCard" class="hover-card hidden"></div>
  `;
}

/**
 * Dashboard loader:
 *  - Condensed rota (8h slice)
 *  - Staff clock widget (clocked-in then latest outs)
 */
export async function loadDashboard(currentUser) {
  await renderCondensedRota(currentUser);
  await renderStaffClock(currentUser);

  // auto refresh
  if (window.__dashboardAutoRefreshInterval) clearInterval(window.__dashboardAutoRefreshInterval);
  window.__dashboardAutoRefreshInterval = setInterval(async () => {
    await renderCondensedRota(currentUser);
    await renderStaffClock(currentUser);
  }, 30000);
}

async function renderCondensedRota(currentUser) {
  const rotaTable = document.getElementById("todaysRotaTable");
  if (!rotaTable) return;

  rotaTable.innerHTML = ""; // clear previous content

  const today = new Date();
  const ymd = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const todayKey = ymd(today);

  // Fetch relevant data
  const [assignments, users, rotaRoles] = await Promise.all([
    select("rotaAssignments", "*", {
      column: "date",
      operator: "eq",
      value: todayKey
    }),
    select("users", "*", {
      column: "organisationId",
      operator: "eq",
      value: currentUser.organisationId
    }),
    select("rotaRoles", "*", {
      column: "oId",
      operator: "eq",
      value: currentUser.organisationId
    })
  ]);

  if (!assignments.length) {
    rotaTable.innerHTML = `<tr><td colspan="4" style="text-align:center;">No published shifts today</td></tr>`;
    return;
  }

  // Flatten roles JSON to a map
  const roleMap = {};
  rotaRoles.forEach(r => {
    try {
      const parsedRoles = typeof r.roles === "string" ? JSON.parse(r.roles) : r.roles;
      parsedRoles.forEach(role => {
        roleMap[role.id] = role.role;
      });
    } catch (e) {
      console.error("Failed to parse roles", e);
    }
  });

  // Table header
  const headerRow = document.createElement("tr");
  ["Person", "Start", "End", "Role"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  rotaTable.appendChild(headerRow);

  // Render each published shift
  assignments
    .filter(a => a.published)
    .sort((a, b) => a.start.localeCompare(b.start))
    .forEach(a => {
      const user = users.find(u => u.id === a.uId);
      const userName = user ? `${user.forename} ${user.surname}` : "Unassigned";
      const roleName = roleMap[a.role] || "Unknown";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${userName}</td>
        <td>${a.start || "TBC"}</td>
        <td>${a.end || "TBC"}</td>
        <td>${roleName}</td>
      `;
      rotaTable.appendChild(tr);
    });
}

/* ------------------ STAFF CLOCK ------------------ */
async function renderStaffClock(currentUser) {
  const container = document.getElementById("staffClock");
  if (!container) return;
  container.innerHTML = "Loading...";

  const [users, clocks] = await Promise.all([
    select("users", "*", {
      column: "organisationId",
      operator: "eq",
      value: currentUser.organisationId
    }),
    select("clock", "*", {
      column: "oId",
      operator: "eq",
      value: currentUser.organisationId
    })
  ]);

  // get latest record per user
  const latestMap = {};
  // --- inside renderStaffClock ---
(clocks || []).forEach(c => {
  if (!latestMap[c.uId] || new Date(c.timestamp) > new Date(latestMap[c.uId].timestamp)) {
    latestMap[c.uId] = c;
  }
});

const ins = [];
const outs = [];
for (const u of users || []) {
  const latest = latestMap[u.id];
  if (latest?.action === "in") {
    ins.push({ user: u, record: latest });
  } else if (latest?.action === "out") {
    outs.push({ user: u, record: latest });
  } else {
    outs.push({ user: u, record: null }); // never clocked in
  }
}


  ins.sort((a, b) => new Date(a.record.timestamp) - new Date(b.record.timestamp));
  outs.sort((a, b) =>
    b.record ? new Date(b.record.timestamp) : 0 - (a.record ? new Date(a.record.timestamp) : 0)
  );

  container.innerHTML = "";

  function renderRow(entry, isIn) {
  const row = document.createElement("div");
  row.className = "clock-row";
  const name = `${entry.user.forename || ""} ${entry.user.surname || ""}`;
  const time = entry.record
    ? new Date(entry.record.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";
  row.innerHTML = `<strong>${name}</strong> ${isIn ? "In" : "Out"} @ ${time}`;

  if (isIn) {
    // Force Clock Out
    const btn = document.createElement("button");
    btn.textContent = "Force Out";
    btn.onclick = async () => {
      await insert("clock", {
        oId: currentUser.organisationId,
        uId: entry.user.id,
        action: "out",
        timestamp: new Date().toISOString(),
        comments: `Forced clock out by ${currentUser.forename} ${currentUser.surname} (${currentUser.email})`
      });
      await renderStaffClock(currentUser);
    };
    row.appendChild(btn);
  } else {
    // Force Clock In
    const btn = document.createElement("button");
    btn.textContent = "Force In";
    btn.onclick = async () => {
      await insert("clock", {
        oId: currentUser.organisationId,
        uId: entry.user.id,
        action: "in",
        timestamp: new Date().toISOString(),
        comments: `Forced clock in by ${currentUser.forename} ${currentUser.surname} (${currentUser.email})`
      });
      await renderStaffClock(currentUser);
    };
    row.appendChild(btn);
  }

  return row;
}


  if (ins.length) {
    const inHeader = document.createElement("h3");
    inHeader.textContent = "Clocked In";
    container.appendChild(inHeader);
    ins.forEach(e => container.appendChild(renderRow(e, true)));
  }

  if (outs.length) {
    const outHeader = document.createElement("h3");
    outHeader.textContent = "Clocked Out";
    container.appendChild(outHeader);
    outs.forEach(e => container.appendChild(renderRow(e, false)));
  }
}
