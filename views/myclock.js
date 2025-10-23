// myClockPersonal.js
import { select } from "../js/db.js";

let currentMonth = new Date();

export default function clockPage(user) {
  return `
  <section>
    <div class="clock-page" style="background:none">
      <div class="month-nav" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
        <button id="prevMonth">⬅ Prev</button>
        <span id="monthLabel" style="font-weight:600;"></span>
        <button id="nextMonth">Next ➡</button>
        
      </div>
      <div style="margin-top:5px;padding:10px;text-align:center;margin-bottom:5px;">
      <p><strong>Month total:</strong> <span id="monthlyTotal"></span></p>
      </div>
      <div id="clockList" class="clock-list"></div>

      
    </div>
  </section>

  <style>
    .clock-list { display: flex; flex-direction: column; gap: 12px; background:none }
    .day-row { display: flex; gap: 12px; align-items: flex-start;
               background:none; padding: 10px; border-radius: 8px; border: 1px solid #eee; }
    .day-row div{background:none}
    .day-label { width: 100%; min-width: 180px; font-weight:600; height:100%;padding:10px;margin:auto;background:#23001E !important;color:white}
    .day-cards { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;height:100% }
    .clock-card { background:#fff !important;border-radius:8px;
                  padding:10px;width:220px; }
    .clock-card h4 { margin:0 0 6px 0; font-size:1rem; }
    .clock-card .times { display:flex; gap:8px; align-items:center; font-weight:600; font-size:0.95rem; }
    .clock-card .meta { margin-top:6px; color:#666; font-size:0.9rem; }
  </style>
  `;
}

export async function loadClock(user, oId) {
  try {
    const listContainer = document.getElementById("clockList");
    const monthLabel = document.getElementById("monthLabel");
    const monthlyTotalEl = document.getElementById("monthlyTotal");
    if (!listContainer || !monthLabel) return;

    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    monthLabel.textContent = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    // Fetch all clocks for this user
    let clocks = await select("clock", "*", { column: "uId", operator: "eq", value: user.id }) || [];

    // Sort clocks
    clocks.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Build day map
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const dayMap = new Map();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      dayMap.set(key, []);
    }
    clocks.forEach(c => {
      const key = new Date(c.timestamp).toISOString().split("T")[0];
      if (dayMap.has(key)) dayMap.get(key).push(c);
    });

    listContainer.innerHTML = "";
    let monthlyMinutes = 0;

    function renderClockCard(cIn, cOut) {
      const inTime = new Date(cIn.timestamp);
      const outTime = cOut ? new Date(cOut.timestamp) : new Date(inTime);
      if (!cOut) outTime.setHours(23, 59, 0, 0);

      const diffMs = outTime - inTime;
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs / (1000 * 60)) % 60);
      monthlyMinutes += h * 60 + m;

      const card = document.createElement("div");
      card.className = "clock-card";
      card.innerHTML = `
        <h4>${user.forename} ${user.surname}</h4>
        <div class="times">
          <div>${inTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          <div style="color:#999;">→</div>
          <div>${outTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div class="meta">${h}h ${m}m</div>
      `;
      return card;
    }

    // Render each day
    // Render each day
for (const [dayKey, entries] of dayMap.entries()) {
  if (!entries.length) continue; // ✅ Skip days with no clocks

  const dayRow = document.createElement("div");
  dayRow.className = "day-row";

  const labelDiv = document.createElement("div");
  labelDiv.className = "day-label";
  const dateObj = new Date(dayKey);
  labelDiv.innerHTML = `${dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;

  const cardsDiv = document.createElement("div");
  cardsDiv.className = "day-cards";

  for (let i = 0; i < entries.length; i++) {
    const c = entries[i];
    if (c.action === "in") {
      const cOut = entries[i + 1] && entries[i + 1].action === "out" ? entries[i + 1] : null;
      cardsDiv.appendChild(renderClockCard(c, cOut));
    } else if (c.action === "out" && (!entries[i - 1] || entries[i - 1].action !== "in")) {
      // missing in → assume midnight
      const assumedIn = { ...c, action: "in", timestamp: c.timestamp.split("T")[0] + "T00:00:00.000Z" };
      cardsDiv.appendChild(renderClockCard(assumedIn, c));
    }
  }

  listContainer.appendChild(labelDiv);
  dayRow.appendChild(cardsDiv);
  listContainer.appendChild(dayRow);
}


    monthlyTotalEl.textContent = `${Math.floor(monthlyMinutes / 60)}h ${monthlyMinutes % 60}m`;

    // Month navigation
    document.getElementById("prevMonth").onclick = () => {
      currentMonth = new Date(year, month - 1, 1);
      loadClock(user, oId);
    };
    document.getElementById("nextMonth").onclick = () => {
      currentMonth = new Date(year, month + 1, 1);
      loadClock(user, oId);
    };
  } catch (err) {
    console.error("❌ Error loading personal clock:", err);
  }
}
