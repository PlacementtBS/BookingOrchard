import { select, insert, update } from "../js/db.js";

let currentMonth = new Date();
let viewingUser = null;

// Helper to parse ISO timestamp as local Date
function parseLocalTime(isoString) {
  const [datePart, timePart] = isoString.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart ? timePart.split(":").map(Number) : [];
  return new Date(year, month - 1, day, hour, minute);
}

// Helper to format Date as HH:MM for <input type="time">
function formatTimeInput(date) {
  return date.getHours().toString().padStart(2, "0") + ":" +
         date.getMinutes().toString().padStart(2, "0");
}

// ================= Manager Clock Page =================
export default function managerClockPage(users) {
  const userOptions = users
    .sort((a, b) => (a.surname || "").localeCompare(b.surname || ""))
    .map(u => `<option value="${u.id}">${u.forename} ${u.surname}</option>`)
    .join("");

  return `
  <section>
    <div class="manager-clock-page" style="background:none">
      <h2>Manager Clock</h2>

      <div class="month-nav" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div class="manager-controls" style="margin-bottom:12px; width:fit-content;margin-right:auto;">
          <h4>
            View clocks for:
            <select id="managerUserSelect">
              <option value="">All Staff</option>
              ${userOptions}
            </select>
          </h4>
        </div>
        <button id="prevMonth">⬅ Prev</button>
        <span id="monthLabel" style="font-weight:600;"></span>
        <button id="nextMonth">Next ➡</button>
        <button id="addClockBtn" style="margin-left:auto;">+ Add Clock</button>
      </div>

      <div id="managerClockList" class="manager-clock-list"></div>
      <div style="margin-top:12px;">
        <strong>Monthly total:</strong> <span id="monthlyTotal"></span>
      </div>
    </div>

    <div id="clockPopupOverlay" class="hidden"
      style="position:fixed;inset:0;background:rgba(0,0,0,0.35);
             display:none;align-items:center;justify-content:center;z-index:2000;">
      <div id="clockPopup" 
        style="background:#fff;border-radius:8px;padding:16px;width:520px;max-height:80vh;
               overflow:auto;box-shadow:0 6px 18px rgba(0,0,0,0.25);">
      </div>
    </div>
  </section>

  <style>
    .manager-clock-list { display: flex; flex-direction: column; gap: 12px; }
    .manager-day-row { display: flex; gap: 12px; align-items: flex-start;
                       background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee; }
    .day-label { width: 220px; min-width: 180px; font-weight:600; }
    .day-cards { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
    .clock-card { background:#fff;border:1px solid #e0e0e0;border-radius:8px;
                  padding:10px;width:220px;box-shadow:0 2px 6px rgba(0,0,0,0.04);
                  cursor:pointer;transition:transform .08s,box-shadow .12s; }
    .clock-card:hover { transform:translateY(-3px); box-shadow:0 6px 14px rgba(0,0,0,0.08); }
    .clock-card h4 { margin:0 0 6px 0; font-size:1rem; }
    .clock-card .times { display:flex; gap:8px; align-items:center; font-weight:600; font-size:0.95rem; }
    .clock-card .meta { margin-top:6px; color:#666; font-size:0.9rem; }
    .hidden { display:none; }
    #clockPopup .popup-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:8px; }
    #clockPopup label { display:block; margin:8px 0 4px; font-weight:600; font-size:0.9rem; }
    #clockPopup input[type="time"], #clockPopup textarea, #clockPopup input[type="date"], #clockPopup select { width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; }
    #clockPopup textarea { min-height:80px; resize:vertical; }
    #clockPopup .popup-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
    .outlineButton { background:transparent;border:1px solid #999;padding:6px 10px;border-radius:6px;cursor:pointer; }
    .primaryButton { background:#2b7cff;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer; }
  </style>
`;
}

// ================= Popup =================
async function openEditClockPopup(cIn, cOut, users, bookings, oId) {
  const user = users.find(u => u.id === cIn.uId);
  const staffName = user ? `${user.forename} ${user.surname}` : "Unknown";

  const inDate = parseLocalTime(cIn.timestamp);
  const outDate = cOut ? parseLocalTime(cOut.timestamp) : null;

  const popup = document.getElementById("clockPopup");
  popup.innerHTML = `
    <div class="popup-header">
      <h3>Edit Clock</h3>
      <button class="outlineButton" id="closePopupBtn">✖</button>
    </div>
    <p><b>${staffName}</b></p>
    <label>Clock In</label>
    <input id="editInTime" type="time" value="${formatTimeInput(inDate)}">
    <label>Clock Out</label>
    <input id="editOutTime" type="time" value="${outDate ? formatTimeInput(outDate) : ''}" placeholder="Ongoing">
    <label>Comments</label>
    <textarea id="editComments" disabled>${cIn.comments || ""}</textarea>
    <div class="popup-actions">
      <button class="outlineButton" id="cancelEdit">Cancel</button>
      <button class="primaryButton" id="saveEdit">Save</button>
    </div>
    <h4 style="margin-top:16px;">Bookings during shift:</h4>
    <ul id="bookingList"></ul>
  `;

  const bookingList = popup.querySelector("#bookingList");
  const dateKey = inDate.toISOString().split("T")[0];

  const related = bookings.filter(b => {
    if (b.uId !== cIn.uId || !b.timings) return false;
    const t = b.timings[dateKey];
    if (!t || !t.start || !t.end) return false;
    const bStart = parseLocalTime(`${dateKey}T${t.start}`);
    const bEnd = parseLocalTime(`${dateKey}T${t.end}`);
    const shiftEnd = outDate || new Date();
    return bStart < shiftEnd && bEnd > inDate;
  });

  bookingList.innerHTML = related.length
    ? related.map(b => `<li>${b.title || "Untitled"} (${b.room || "?"}) — ${b.timings[dateKey].start}–${b.timings[dateKey].end}</li>`).join("")
    : `<li style="color:#666;">No overlapping bookings</li>`;

  showPopup();
  popup.querySelector("#closePopupBtn").onclick = hidePopup;
  popup.querySelector("#cancelEdit").onclick = hidePopup;

  popup.querySelector("#saveEdit").onclick = async () => {
    const newIn = popup.querySelector("#editInTime").value;
    const newOut = popup.querySelector("#editOutTime").value;
    const newComments = popup.querySelector("#editComments").value;

    if (!newIn) return alert("Clock In is required");

    const [inH, inM] = newIn.split(":").map(Number);
    const inDateNew = new Date(inDate);
    inDateNew.setHours(inH, inM, 0, 0);

    let outDateNew = null;
    if (newOut) {
      const [outH, outM] = newOut.split(":").map(Number);
      outDateNew = new Date(inDate);
      outDateNew.setHours(outH, outM, 0, 0);
    }

    const inChanged = inDateNew.toISOString() !== cIn.timestamp;
    let updatedComments = newComments;

    if (inChanged) {
      const log = `[${new Date().toLocaleString()}] In time changed: ${cIn.timestamp.substring(11,16)} → ${newIn}`;
      updatedComments = (newComments + "\n" + log).trim();
      await update("clock", { timestamp: inDateNew.toISOString(), comments: updatedComments }, { column:"id", operator:"eq", value:cIn.id });
    } else {
      await update("clock", { comments: updatedComments }, { column:"id", operator:"eq", value:cIn.id });
    }

    if (outDateNew) {
      if (cOut) {
        await update("clock", { timestamp: outDateNew.toISOString() }, { column:"id", operator:"eq", value:cOut.id });
      } else {
        await insert("clock", { uId: cIn.uId, oId, action:"out", timestamp: outDateNew.toISOString() });
      }
    }

    hidePopup();
    loadManagerClock(users, oId);
  };
}

// ================= Load Manager =================
export async function loadManagerClock(users, oId) {
  try {
    const listContainer = document.getElementById("managerClockList");
    const monthLabel = document.getElementById("monthLabel");
    const monthlyTotalEl = document.getElementById("monthlyTotal");
    const userSelect = document.getElementById("managerUserSelect");
    if (!listContainer || !monthLabel) return;

    viewingUser = userSelect.value || null;
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    monthLabel.textContent = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

    let clocks = await select("clock", "*", { column: "oId", operator: "eq", value: oId }) || [];
    clocks = await normalizeClocks(clocks, oId);

    if (viewingUser) clocks = clocks.filter(c => c.uId === viewingUser);
    clocks.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const dayMap = new Map();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dayMap.set(d.toISOString().split("T")[0], []);
    }
    clocks.forEach(c => {
      const key = parseLocalTime(c.timestamp).toISOString().split("T")[0];
      if (dayMap.has(key)) dayMap.get(key).push(c);
    });

    const bookings = await select("bookings", "*", { column: "oId", operator: "eq", value: oId }) || [];

    listContainer.innerHTML = "";
    let monthlyMinutes = 0;

    function renderClockCard(cIn, cOut) {
      const inTime = parseLocalTime(cIn.timestamp);
      let outTimeText = "";
      let diffMs = 0;
      const todayKey = new Date().toISOString().split("T")[0];
      const dayKey = inTime.toISOString().split("T")[0];
      const isToday = dayKey === todayKey;

      if (!cOut) {
        if (isToday) {
          outTimeText = "Ongoing";
          diffMs = new Date() - inTime;
        } else {
          const outDateLocal = new Date(inTime);
          outDateLocal.setHours(23,59,0,0);
          outTimeText = outDateLocal.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          diffMs = outDateLocal - inTime;
        }
      } else {
        const outDateLocal = parseLocalTime(cOut.timestamp);
        outTimeText = outDateLocal.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        diffMs = outDateLocal - inTime;
      }

      const h = Math.floor(diffMs / (1000*60*60));
      const m = Math.floor((diffMs / (1000*60)) % 60);
      monthlyMinutes += h*60 + m;

      const userObj = users.find(u => u.id === cIn.uId);
      const staffName = userObj ? `${userObj.forename} ${userObj.surname}` : "Unknown";

      const card = document.createElement("div");
      card.className = "clock-card";
      card.innerHTML = `
        <h4>${staffName}</h4>
        <div class="times">
          <div>${inTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          <div style="color:#999;">→</div>
          <div>${outTimeText}</div>
        </div>
        <div class="meta">${h}h ${m}m</div>
      `;
      card.onclick = () => openEditClockPopup(cIn, cOut, users, bookings, oId);
      return card;
    }

    for (const [dayKey, entries] of dayMap.entries()) {
      const dayRow = document.createElement("div");
      dayRow.className = "manager-day-row";

      const labelDiv = document.createElement("div");
      const dateObj = new Date(dayKey);
      labelDiv.className = "day-label";
      labelDiv.innerHTML = `${dateObj.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" })}`;

      const cardsDiv = document.createElement("div");
      cardsDiv.className = "day-cards";

      if (!entries.length) {
        cardsDiv.innerHTML = `<div class="clock-card" style="opacity:0.6;">No clocks</div>`;
      } else {
        const byUser = new Map();
        entries.forEach(e => {
          if (!byUser.has(e.uId)) byUser.set(e.uId, []);
          byUser.get(e.uId).push(e);
        });

        byUser.forEach(userClocks => {
          userClocks.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
          for (let i = 0; i < userClocks.length; i++) {
            const c = userClocks[i];
            if (c.action === "in") {
              const cOut = userClocks[i+1] && userClocks[i+1].action==="out"? userClocks[i+1] : null;
              cardsDiv.appendChild(renderClockCard(c, cOut));
            } else if (c.action==="out" && (!userClocks[i-1] || userClocks[i-1].action!=="in")) {
              const assumedIn = {
                ...c,
                action: "in",
                timestamp: parseLocalTime(c.timestamp).toISOString().split("T")[0]+"T00:00:00",
                comments: ""
              };
              cardsDiv.appendChild(renderClockCard(assumedIn, c));
            }
          }
        });
      }

      dayRow.appendChild(labelDiv);
      dayRow.appendChild(cardsDiv);
      listContainer.appendChild(dayRow);
    }

    monthlyTotalEl.textContent = `${Math.floor(monthlyMinutes/60)}h ${monthlyMinutes%60}m`;

    document.getElementById("prevMonth").onclick = () => { currentMonth = new Date(year, month-1,1); loadManagerClock(users,oId); };
    document.getElementById("nextMonth").onclick = () => { currentMonth = new Date(year, month+1,1); loadManagerClock(users,oId); };
    userSelect.onchange = () => loadManagerClock(users,oId);
    document.getElementById("addClockBtn").onclick = () => openAddClockPopup(users,oId,loadManagerClock);

  } catch(err) {
    console.error("❌ Error loading manager clock:", err);
  }
}

// ================= Normalize Clocks =================
async function normalizeClocks(clocks,oId){
  const sorted = clocks.sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));

  for(let i=0;i<sorted.length;i++){
    const c=sorted[i];

    if(c.action==="out" && (!sorted[i-1] || sorted[i-1].uId!==c.uId || sorted[i-1].action!=="in")){
      const newIn = parseLocalTime(c.timestamp);
      newIn.setHours(0,0,0,0);
      await insert("clock",{uId:c.uId,oId,action:"in",timestamp:newIn.toISOString()});
    }

    if(c.action==="in" && (!sorted[i+1] || sorted[i+1].uId!==c.uId || sorted[i+1].action!=="out")){
      const newOut = parseLocalTime(c.timestamp);
      newOut.setHours(23,59,0,0);
      await insert("clock",{uId:c.uId,oId,action:"out",timestamp:newOut.toISOString()});
    }
  }

  // Overnight shifts
  for(let i=0;i<sorted.length;i++){
    const cIn=sorted[i];
    if(cIn.action!=="in") continue;
    const cOut = sorted[i+1] && sorted[i+1].action==="out" && sorted[i+1].uId===cIn.uId ? sorted[i+1] : null;
    if(!cOut) continue;

    const inDate=parseLocalTime(cIn.timestamp);
    const outDate=parseLocalTime(cOut.timestamp);
    if(outDate<inDate){
      const endOfDay=new Date(inDate); endOfDay.setHours(23,59,0,0);
      await update("clock",{timestamp:endOfDay.toISOString()},{column:"id",operator:"eq",value:cOut.id});

      const nextDay=new Date(inDate); nextDay.setDate(nextDay.getDate()+1); nextDay.setHours(0,0,0,0);
      await insert("clock",{uId:cIn.uId,oId,action:"in",timestamp:nextDay.toISOString()});
      await insert("clock",{uId:cIn.uId,oId,action:"out",timestamp:outDate.toISOString()});
    }
  }

  return await select("clock","*",{column:"oId",operator:"eq",value:oId});
}

// ================= Popup Helpers =================
function showPopup(){ const overlay=document.getElementById("clockPopupOverlay"); overlay.classList.remove("hidden"); overlay.style.display="flex"; }
function hidePopup(){ const overlay=document.getElementById("clockPopupOverlay"); overlay.classList.add("hidden"); overlay.style.display="none"; }
document.addEventListener("click",(e)=>{ const overlay=document.getElementById("clockPopupOverlay"); if(e.target===overlay) hidePopup(); });
