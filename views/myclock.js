// myclock.js
import { select } from "../js/db.js";

let currentMonth = new Date();

export default function clockPage(user) {
  return `
    <div class="clock-page">
      <h2>My Clock</h2>
      <div class="month-nav">
        <button id="prevMonth">⬅ Prev</button>
        <span id="monthLabel"></span>
        <button id="nextMonth">Next ➡</button>
      </div>
      <table id="clockTable" class="clock-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Clocks</th>
            <th>Bookings</th>
          </tr>
        </thead>
        <tbody></tbody>
        <tfoot>
          <tr>
            <td><b>Total</b></td>
            <td id="monthlyTotal" colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

export async function loadClock(user) {
  try {
    const tableBody = document.querySelector("#clockTable tbody");
    const monthLabel = document.getElementById("monthLabel");
    const monthlyTotalEl = document.getElementById("monthlyTotal");

    if (!tableBody || !monthLabel) return;

    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    // Update label
    monthLabel.textContent = currentMonth.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    // Get start and end of month
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Fetch data
    const clocks =
      (await select("clock", "*", {
        column: "uId",
        operator: "eq",
        value: user.id,
      })) || [];
    const bookings =
      (await select("bookings", "*", {
        column: "uId",
        operator: "eq",
        value: user.id,
      })) || [];

    // Clear table
    tableBody.innerHTML = "";
    monthlyTotalEl.textContent = "";

    // Generate rows for each day in the month
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayKey = d.toISOString().split("T")[0];

      const tr = document.createElement("tr");
      tr.setAttribute("data-day", dayKey);

      const tdDate = document.createElement("td");
      tdDate.textContent = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

      const tdClocks = document.createElement("td");
      tdClocks.setAttribute("data-type", "clocks");

      const tdBookings = document.createElement("td");
      tdBookings.setAttribute("data-type", "bookings");

      tr.appendChild(tdDate);
      tr.appendChild(tdClocks);
      tr.appendChild(tdBookings);
      tableBody.appendChild(tr);
    }

    // Track monthly hours
    let monthlyMinutes = 0;

    // Group and render clock sessions
    clocks.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (let i = 0; i < clocks.length; i++) {
      const entry = clocks[i];
      if (entry.action !== "in") continue;

      const inTime = new Date(entry.timestamp);
      const outEntry =
        clocks[i + 1] && clocks[i + 1].action === "out" ? clocks[i + 1] : null;
      if (!outEntry) continue;

      const outTime = new Date(outEntry.timestamp);

      if (outTime.getDate() !== inTime.getDate()) {
        // Split across midnight
        const endOfDay = new Date(inTime);
        endOfDay.setHours(23, 59, 0, 0);
        const midnight = new Date(outTime);
        midnight.setHours(0, 0, 0, 0);

        // Part 1
        if (inTime >= startDate && inTime <= endDate) {
          const tdClocks = document.querySelector(
            `tr[data-day="${inTime.toISOString().split("T")[0]}"] td[data-type="clocks"]`
          );
          if (tdClocks) tdClocks.appendChild(makeClockCard(inTime, endOfDay));
          monthlyMinutes += Math.floor((endOfDay - inTime) / (1000 * 60));
        }

        // Part 2
        if (outTime >= startDate && outTime <= endDate) {
          const tdNextClocks = document.querySelector(
            `tr[data-day="${outTime.toISOString().split("T")[0]}"] td[data-type="clocks"]`
          );
          if (tdNextClocks)
            tdNextClocks.appendChild(makeClockCard(midnight, outTime));
          monthlyMinutes += Math.floor((outTime - midnight) / (1000 * 60));
        }
      } else {
        // Normal session
        if (inTime >= startDate && outTime <= endDate) {
          const tdClocks = document.querySelector(
            `tr[data-day="${inTime.toISOString().split("T")[0]}"] td[data-type="clocks"]`
          );
          if (tdClocks) tdClocks.appendChild(makeClockCard(inTime, outTime));
          monthlyMinutes += Math.floor((outTime - inTime) / (1000 * 60));
        }
      }
    }

    // Render bookings
    // Render bookings
console.log("📅 Raw bookings:", bookings);

bookings.forEach((b) => {
  if (!b.timings) return;

  Object.entries(b.timings).forEach(([dateStr, times]) => {
    const { start, end } = times;

    const startDateTime = parseDate(`${dateStr} ${start}`);
    const endDateTime = parseDate(`${dateStr} ${end}`);

    if (!startDateTime || !endDateTime) {
      console.warn("⚠️ Skipping invalid booking:", b);
      return;
    }

    // Only render if inside the current month
    if (startDateTime < startDate || startDateTime > endDate) return;

    const dayKey = startDateTime.toISOString().split("T")[0];
    const tdBookings = document.querySelector(
      `tr[data-day="${dayKey}"] td[data-type="bookings"]`
    );

    if (tdBookings) {
      const div = document.createElement("div");
      div.style.border = "1px solid #ddd";
      div.style.margin = "0.2em 0";
      div.style.padding = "0.2em 0.5em";
      div.innerHTML = `
        <b>${b.name}</b><br>
        ${startDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -
        ${endDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      `;
      tdBookings.appendChild(div);
    }
  });
});


    // Show monthly total
    const h = Math.floor(monthlyMinutes / 60);
    const m = monthlyMinutes % 60;
    monthlyTotalEl.textContent = `${h}h ${m}m`;

    // Hook up navigation
    document.getElementById("prevMonth").onclick = () => {
      currentMonth = new Date(year, month - 1, 1);
      loadClock(user);
    };
    document.getElementById("nextMonth").onclick = () => {
      currentMonth = new Date(year, month + 1, 1);
      loadClock(user);
    };
  } catch (err) {
    console.error("❌ Error in loadClock:", err);
    const tableBody = document.querySelector("#clockTable tbody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="3" style="color:red;">Error loading clock data</td></tr>`;
    }
  }
}

// ✅ Helper: parse ISO or UK dd/mm/yyyy hh:mm
function parseDate(value) {
  if (!value) return null;

  const d = new Date(value);
  if (!isNaN(d)) return d;

  // UK format: dd/mm/yyyy hh:mm (allow 1–2 digit hour)
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(value);
  if (match) {
    const [_, dd, mm, yyyy, HH = "0", MM = "0"] = match;
    return new Date(
      parseInt(yyyy),
      parseInt(mm) - 1,
      parseInt(dd),
      parseInt(HH),
      parseInt(MM)
    );
  }

  return null;
}

// Helper to render clock cards
function makeClockCard(inTime, outTime) {
  const diffMs = outTime - inTime;
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs / (1000 * 60)) % 60);

  const div = document.createElement("div");
  div.style.border = "1px solid #ddd";
  div.style.margin = "0.2em 0";
  div.style.padding = "0.2em 0.5em";
  div.innerHTML = `
    <div><b>In:</b> ${inTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    <div><b>Out:</b> ${outTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    <div><b>Total:</b> ${h}h ${m}m</div>
  `;
  return div;
}
