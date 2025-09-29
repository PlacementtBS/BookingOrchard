import { select, insert, update } from "../js/db.js";

export default function rotaPage() {
  return `
    <section>
      <div class="rota-headerBar">
        <h1>Staff Rota</h1>
        <button id="prevWeek" class="primaryButton">&lt; Prev Week</button>
        <button id="nextWeek" class="primaryButton">Next Week &gt;</button>
      </div>
      <div class="rota-scrollBar">
        <button id="prevBlock" class="secondaryButton">&lt; Prev 8h</button>
        <button id="nextBlock" class="secondaryButton">Next 8h &gt;</button>
      </div>
    </section>
    <section>
      <div id="rotaWrapper" class="rota-wrapper">
        <table id="rotaTable" class="rota-grid"></table>
      </div>
    </section>
  `;
}

export async function loadRota(currentUser) {
  const rotaTable = document.getElementById("rotaTable");
  rotaTable.innerHTML = "";

  const slotsPerHour = 4;
  const hoursVisible = 8;

  const now = new Date();
  let currentBlockStart = Math.floor(now.getHours() / hoursVisible) * hoursVisible;

  let weekStart = new Date();
  const dayOfWeek = weekStart.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  weekStart.setDate(weekStart.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const ymdLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  async function renderWeek() {
    rotaTable.innerHTML = "";

    const bookings = await select("bookings", "*", { column: "oId", operator: "eq", value: currentUser.organisationId }) || [];
    const rotaRoles = await select("rotaRoles", "*", { column: "oId", operator: "eq", value: currentUser.organisationId }) || [];
    const assignments = await select("rotaAssignments", "*", { column: "weekStart", operator: "eq", value: ymdLocal(weekStart) }) || [];
    const users = await select("users", "*", { column: "organisationId", operator: "eq", value: currentUser.organisationId }) || [];

    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });

    const daySegments = new Map(days.map(d => [ymdLocal(d), []]));

    // --- Process bookings ---
    for (const booking of bookings) {
      let recurrence = {};
      try { recurrence = typeof booking.recurrence === "string" ? JSON.parse(booking.recurrence) : booking.recurrence || {}; } catch {}
      let timings = {};
      try { timings = typeof booking.timings === "string" ? JSON.parse(booking.timings) : booking.timings || {}; } catch {}

      if (recurrence.basis === "SingleDates" && Array.isArray(recurrence.dates)) {
        for (const d of recurrence.dates) {
          if (!daySegments.has(d)) continue;
          const t = timings[d];
          if (!t?.start || !t?.end) continue;
          const [sh, sm] = t.start.split(":").map(Number);
          const [eh, em] = t.end.split(":").map(Number);
          daySegments.get(d).push({ id: booking.id, name: booking.name, startSlot: sh*slotsPerHour + (sm/60)*slotsPerHour, endSlot: eh*slotsPerHour + (em/60)*slotsPerHour });
        }
      } else if (recurrence.basis === "Weekly") {
        const until = recurrence.until ? new Date(recurrence.until) : null;
        for (const day of days) {
          const dayKey = ymdLocal(day);
          if (!daySegments.has(dayKey)) continue;
          if (until && day > until) continue;
          const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day.getDay()];
          if (!recurrence.days?.includes(dow)) continue;
          const t = timings[dayKey] || { start: "09:00", end: "17:00" };
          const [sh, sm] = t.start.split(":").map(Number);
          const [eh, em] = t.end.split(":").map(Number);
          daySegments.get(dayKey).push({ id: booking.id, name: booking.name, startSlot: sh*slotsPerHour + (sm/60)*slotsPerHour, endSlot: eh*slotsPerHour + (em/60)*slotsPerHour });
        }
      } else {
        const start = new Date(booking.startDate);
        const end = new Date(booking.endDate);
        for (const day of days) {
          const dayKey = ymdLocal(day);
          if (!daySegments.has(dayKey)) continue;
          if (day < start || day > end) continue;
          const t = timings[dayKey];
          if (!t?.start || !t?.end) continue;
          const [sh, sm] = t.start.split(":").map(Number);
          const [eh, em] = t.end.split(":").map(Number);
          daySegments.get(dayKey).push({ id: booking.id, name: booking.name, startSlot: sh*slotsPerHour + (sm/60)*slotsPerHour, endSlot: eh*slotsPerHour + (em/60)*slotsPerHour });
        }
      }
    }

    // --- HEADER ROWS ---
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th style="min-width:200px"></th>`;
    for (let h = currentBlockStart; h < currentBlockStart + hoursVisible; h++) {
      headerRow.innerHTML += `<th colspan="${slotsPerHour}">${String(h).padStart(2,"0")}:00</th>`;
    }
    rotaTable.appendChild(headerRow);

    const subHeaderRow = document.createElement("tr");
    subHeaderRow.innerHTML = `<th></th>`;
    for (let h = currentBlockStart; h < currentBlockStart + hoursVisible; h++) {
      for (let s = 0; s < slotsPerHour; s++) subHeaderRow.innerHTML += `<th>${String(s*15).padStart(2,"0")}</th>`;
    }
    rotaTable.appendChild(subHeaderRow);

    // --- DAYS + BOOKINGS + SHIFTS + Add Shift row ---
    for (const day of days) {
      const dateKey = ymdLocal(day);

      // booking row
      const bookingRow = document.createElement("tr");
      bookingRow.innerHTML = `<th>${day.toDateString()}</th>`;
      const blockStartSlot = currentBlockStart * slotsPerHour;
      const blockEndSlot = (currentBlockStart + hoursVisible) * slotsPerHour;
      const emptyCells = Array(blockEndSlot - blockStartSlot).fill(null);

      for (const seg of daySegments.get(dateKey) || []) {
        let renderStart = Math.max(seg.startSlot, blockStartSlot);
        let renderEnd = Math.min(seg.endSlot, blockEndSlot);
        if (renderEnd <= blockStartSlot || renderStart >= blockEndSlot) continue;
        emptyCells[Math.floor(renderStart - blockStartSlot)] = { name: seg.name, colspan: Math.ceil(renderEnd - renderStart) };
        for (let i = Math.floor(renderStart - blockStartSlot) + 1; i < Math.ceil(renderEnd - blockStartSlot); i++) emptyCells[i] = "merged";
      }

      for (let cell of emptyCells) {
        if (!cell) bookingRow.innerHTML += `<td></td>`;
        else if (cell === "merged") continue;
        else bookingRow.innerHTML += `<td colspan="${cell.colspan}" class="booking-block" style="background:#90caf9;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cell.name}</td>`;
      }
      rotaTable.appendChild(bookingRow);

      // shifts
      const dayAssignments = assignments.filter(s => s.date === dateKey);
      for (const shift of dayAssignments) {
        const role = rotaRoles.find(r => r.id === shift.role);
        const user = users.find(u => u.id === shift.uId);
        const staffName = user ? `${user.forename} ${user.surname}` : "";
        const roleName = role ? role.roleName : "Unknown Role";

        const shiftRow = document.createElement("tr");
        shiftRow.innerHTML = `<td>${roleName}<br>
          <button class="assign-btn">Assign</button>
          <button class="unassign-btn">Unassign</button>
        </td>`;

        if (shift.start && shift.end) {
          let [sh, sm] = shift.start.split(":").map(Number);
          let [eh, em] = shift.end.split(":").map(Number);
          const startSlot = sh * slotsPerHour + (sm/60)*slotsPerHour;
          const endSlot = eh * slotsPerHour + (em/60)*slotsPerHour;
          const renderStart = Math.max(startSlot, blockStartSlot);
          const renderEnd = Math.min(endSlot, blockEndSlot);
          const colspan = renderEnd - renderStart;

          if (colspan > 0) {
            shiftRow.innerHTML += `<td></td>`.repeat(Math.floor(renderStart - blockStartSlot));
            shiftRow.innerHTML += `<td colspan="${Math.ceil(colspan)}" class="shift-block" style="background:#c5e1a5;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${staffName}</td>`;
            shiftRow.innerHTML += `<td></td>`.repeat(Math.floor(blockEndSlot - renderEnd));
          } else {
            shiftRow.innerHTML += `<td></td>`.repeat(blockEndSlot - blockStartSlot);
          }
        } else {
          shiftRow.innerHTML += `<td></td>`.repeat(blockEndSlot - blockStartSlot);
        }

        rotaTable.appendChild(shiftRow);

        shiftRow.querySelector(".unassign-btn").onclick = async () => {
          await update("rotaAssignments", { uId: null, start: null, end: null }, { column: "id", operator: "eq", value: shift.id });
          await renderWeek();
        };

        shiftRow.querySelector(".assign-btn").onclick = () => {
          const td = shiftRow.querySelector("td.shift-block") || shiftRow.children[1];
          td.innerHTML = `<form class="assign-form">
            <select name="staff">
              <option value="">Select Staff...</option>
              ${users.map(u => `<option value="${u.id}">${u.forename} ${u.surname}</option>`).join("")}
            </select>
            <input type="time" name="start" value="${shift.start || '08:00'}">
            <input type="time" name="end" value="${shift.end || '16:00'}">
            <button type="submit">Save</button>
          </form>`;
          td.querySelector("form").onsubmit = async (e) => {
            e.preventDefault();
            const staff = e.target.staff.value || null;
            const start = e.target.start.value;
            const end = e.target.end.value;
            await update("rotaAssignments", { uId: staff, start, end }, { column: "id", operator: "eq", value: shift.id });
            await renderWeek();
          };
        };
      }

      // ghost row: +Add Shift
      const ghostRow = document.createElement("tr");
      ghostRow.innerHTML = `<td class="ghost-row" colspan="${hoursVisible * slotsPerHour + 1}">+ Add Shift</td>`;
      rotaTable.appendChild(ghostRow);

      ghostRow.onclick = () => {
        const selectEl = document.createElement("select");
        selectEl.innerHTML = `<option value="">Select Role...</option>` +
          rotaRoles.map(r => `<option value="${r.id}">${r.roleName}</option>`).join("");
        ghostRow.innerHTML = `<td colspan="${hoursVisible * slotsPerHour + 1}"></td>`;
        ghostRow.firstChild.appendChild(selectEl);

        selectEl.addEventListener("change", async (e) => {
          const roleId = e.target.value;
          if (!roleId) return;

          await insert("rotaAssignments", {
            oId: currentUser.organisationId,
            role: roleId,
            uId: null,
            date: dateKey,
            start: null,
            end: null,
            weekStart: ymdLocal(weekStart)
          });

          await renderWeek();
        });
      };
    }
  }

  renderWeek();

  document.getElementById("prevBlock").onclick = () => { if (currentBlockStart>0){ currentBlockStart-=hoursVisible; renderWeek(); } };
  document.getElementById("nextBlock").onclick = () => { if (currentBlockStart+hoursVisible<24){ currentBlockStart+=hoursVisible; renderWeek(); } };
  document.getElementById("prevWeek").onclick = () => { weekStart.setDate(weekStart.getDate()-7); currentBlockStart=Math.floor(new Date().getHours()/hoursVisible)*hoursVisible; renderWeek(); };
  document.getElementById("nextWeek").onclick = () => { weekStart.setDate(weekStart.getDate()+7); currentBlockStart=Math.floor(new Date().getHours()/hoursVisible)*currentBlockStart; renderWeek(); };
}
