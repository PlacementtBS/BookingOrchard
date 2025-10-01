import { select, insert } from "../js/db.js";

export default function dashboardPage() {
  return `
    <section>
      <div>Next Booking</div>
      <div class="third">
        <h2>Live Rota</h2>
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

/* ------------------ CONDENSED ROTA ------------------ */
async function renderCondensedRota(currentUser) {
  const rotaTable = document.getElementById("todaysRotaTable");
  const hoverCard = document.getElementById("hoverCard");
  if (!rotaTable) return;

  const slotsPerHour = 2;
  const totalSlots = 24 * slotsPerHour;

  const now = new Date();
  const startWindow = new Date(now);
  startWindow.setHours(now.getHours() - 3, 0, 0, 0);
  const endWindow = new Date(now);
  endWindow.setHours(now.getHours() + 3, 0, 0, 0);

  const ymd = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const parseTimeToSlot = t =>
    t
      ? t.split(":").map(Number).reduce(
          (a, v, i) =>
            i === 0
              ? a + v * slotsPerHour
              : a + Math.floor(v / (60 / slotsPerHour)),
          0
        )
      : null;

  const slotToTime = s => {
    const h = Math.floor(s / slotsPerHour);
    const m = (s % slotsPerHour) * (60 / slotsPerHour);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const dateKeys = [];
  const tmp = new Date(startWindow);
  tmp.setHours(0, 0, 0, 0);
  while (tmp <= endWindow) {
    dateKeys.push(ymd(tmp));
    tmp.setDate(tmp.getDate() + 1);
  }

  const [roles, bookings, users] = await Promise.all([
    select("rotaRoles", "*", { column: "oId", operator: "eq", value: currentUser.organisationId }),
    select("bookings", "*", { column: "oId", operator: "eq", value: currentUser.organisationId }),
    select("users", "*", { column: "organisationId", operator: "eq", value: currentUser.organisationId })
  ]);

  const assignmentPromises = dateKeys.map(dk =>
    select("rotaAssignments", "*", { column: "date", operator: "eq", value: dk })
  );
  const assignmentsArrays = await Promise.all(assignmentPromises);
  const assignments = assignmentsArrays.flat().filter(Boolean);

  const roleColors = {};
  (roles || []).forEach((r, i) => (roleColors[r.id] = `hsl(${(i * 60) % 360},70%,60%)`));

  const bookingMap = new Map();
  let bookingColors = {};
  let colorIndex = 0;
  const palette = ["#f48fb1", "#ffcc80", "#81d4fa", "#b39ddb", "#a5d6a7"];
  for (const b of bookings || []) {
    if (!bookingColors[b.id]) bookingColors[b.id] = palette[colorIndex++ % palette.length];
    let timings = {};
    try {
      timings = typeof b.timings === "string" ? JSON.parse(b.timings) : b.timings || {};
    } catch {}
    for (const dk of Object.keys(timings)) {
      const t = timings[dk];
      const s = parseTimeToSlot(t.start);
      const e = parseTimeToSlot(t.end);
      if (s != null && e != null) {
        if (!bookingMap.has(dk)) bookingMap.set(dk, []);
        bookingMap.get(dk).push({
          ...t,
          id: b.id,
          name: b.name,
          startSlot: s,
          endSlot: e,
          color: bookingColors[b.id]
        });
      }
    }
  }

  const asgMap = new Map();
  (assignments || []).forEach(a => {
    if (!a.start) return;
    const s = parseTimeToSlot(a.start);
    const e = a.end ? parseTimeToSlot(a.end) : s + 4 * slotsPerHour;
    if (s == null || e == null) return;
    if (!asgMap.has(a.date)) asgMap.set(a.date, []);
    asgMap.get(a.date).push({ ...a, startSlot: s, endSlot: e });
  });

  function assignColumns(items) {
    const cols = [];
    (items || [])
      .sort((a, b) => a.startSlot - b.startSlot)
      .forEach(it => {
        let col = 0;
        while (
          cols[col] &&
          cols[col].some(o => o.startSlot < it.endSlot && o.endSlot > it.startSlot)
        )
          col++;
        if (!cols[col]) cols[col] = [];
        cols[col].push(it);
        it.column = col;
      });
    return cols.length;
  }

  rotaTable.innerHTML = "";

  for (const dk of dateKeys) {
    const dateRow = document.createElement("tr");
    dateRow.innerHTML = `<th colspan="2" style="background:#f0f0f0;text-align:left;padding:6px 8px;">${new Date(
      dk
    ).toDateString()}</th>`;
    rotaTable.appendChild(dateRow);

    const isStartDate = dk === ymd(startWindow);
    const isEndDate = dk === ymd(endWindow);
    const dayStartSlot = isStartDate
      ? parseTimeToSlot(`${String(startWindow.getHours()).padStart(2, "0")}:00`)
      : 0;
    const dayEndSlot = isEndDate
      ? parseTimeToSlot(`${String(endWindow.getHours()).padStart(2, "0")}:00`)
      : totalSlots;

    const shiftsThisDay = asgMap.get(dk) || [];
    const bookingThisDay = bookingMap.get(dk) || [];
    const shiftColsCount = assignColumns(shiftsThisDay);
    assignColumns(bookingThisDay);

    for (let slot = dayStartSlot; slot < dayEndSlot; slot++) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.className = "time-col";
      th.textContent = slotToTime(slot);
      tr.appendChild(th);

      const td = document.createElement("td");
      const innerDiv = document.createElement("div");
      innerDiv.className = "cell-inner";
      td.appendChild(innerDiv);

      const bookingsThisSlot = (bookingThisDay || []).filter(
        b => b.startSlot <= slot && b.endSlot > slot
      );
      if (bookingsThisSlot?.length) {
        bookingsThisSlot.forEach(b => {
          const div = document.createElement("div");
          div.className = "booking-block";
          div.style.background = b.color;
          div.style.position = "absolute";
          div.style.top = "0";
          div.style.height = "100%";
          div.style.left = `${(shiftColsCount || 0) * 30 + (b.column || 0) * 16}px`;
          div.style.right = "0";
          div.style.zIndex = 1;
          if (b.startSlot === slot) div.textContent = b.name;
          innerDiv.appendChild(div);
        });
      }

      const shiftsThisSlot = (shiftsThisDay || []).filter(
        s => s.startSlot <= slot && s.endSlot > slot
      );
      if (shiftsThisSlot?.length) {
        shiftsThisSlot.forEach(s => {
          const roleColor = roleColors[s.role] || "#666";
          const lineLeft = (s.column || 0) * 30;

          const line = document.createElement("div");
          line.className = "shift-block-line";
          line.style.left = `${lineLeft}px`;
          line.style.top = "0";
          line.style.height = "100%";
          line.style.borderLeft = `3px solid ${roleColor}`;
          line.style.position = "absolute";
          line.style.zIndex = 5;
          innerDiv.appendChild(line);

          if (s.startSlot === slot) {
            const user = (users || []).find(u => u.id === s.uId);
            const initials = user
              ? `${user.forename?.[0] || "?"}${user.surname?.[0] || "?"}`
              : "??";
            const imgDiv = document.createElement("div");
            imgDiv.className = "shift-image";
            imgDiv.dataset.uid = s.uId || "";
            imgDiv.dataset.name = user
              ? `${user.forename} ${user.surname}`
              : "Unassigned";
            imgDiv.dataset.role =
              (roles || []).find(r => r.id === s.role)?.roleName || "Unknown";
            imgDiv.style.border = `2px solid ${roleColor}`;
            imgDiv.style.left = `${lineLeft - 1}px`;

            const img = new Image();
            img.src = `https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${s.uId}`;
            img.onerror = () => {
              imgDiv.textContent = initials;
              imgDiv.style.background = roleColor;
            };
            img.style.borderRadius = "50%";
            imgDiv.appendChild(img);

            imgDiv.onmouseenter = e => {
              hoverCard.innerHTML = `<strong>${imgDiv.dataset.name}</strong><br>${imgDiv.dataset.role}<br>${slotToTime(
                s.startSlot
              )} - ${slotToTime(s.endSlot)}`;
              hoverCard.style.top = e.pageY + "px";
              hoverCard.style.left = e.pageX + "px";
              hoverCard.classList.remove("hidden");
            };
            imgDiv.onmouseleave = () => hoverCard.classList.add("hidden");

            innerDiv.appendChild(imgDiv);
          }
        });
      }

      tr.appendChild(td);
      rotaTable.appendChild(tr);
    }
  }
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
