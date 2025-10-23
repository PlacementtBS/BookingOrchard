import { select } from "../js/db.js";

export default function myRotaPage() {
  return `
    <section>
      <div id="myRotaWrapper" class="cardGallery" style="background:none"></div>
    </section>
  `;
}

export function formatDateToHTML(dateStr) {
  const date = new Date(dateStr);
  const weekday = date.toLocaleString("default", { weekday: "short" });
  const day = date.getDate();
  const monthYear = date.toLocaleString("default", { month: "short", year: "numeric" });
  return `<h4 style="text-align:center;margin:0;">${weekday}</h4>
          <h3 style="text-align:center;margin:0;">${day}</h3>
          <h5 style="width:80px;text-align:center;margin:0;">${monthYear}</h5>`;
}

// Simple inline popup
function showPopup(html, title = "Info") {
  const overlay = document.createElement("div");
  overlay.className = "popupOverlay";
  overlay.style = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  `;

  const popup = document.createElement("div");
  popup.className = "popup";
  popup.style = `
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    width: 400px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;

  popup.innerHTML = `
    <h2 style="margin-bottom:10px;">${title}</h2>
    <div class="popupContent">${html}</div>
    <div class="popupActions" style="margin-top:12px;text-align:right;">
      <button class="primaryButton" id="closePopupBtn">Close</button>
    </div>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  popup.querySelector("#closePopupBtn").onclick = () => overlay.remove();
}

export async function loadMyRota(currentUser) {
  const rotaWrapper = document.getElementById("myRotaWrapper");
  
  rotaWrapper.innerHTML = "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayKey = ymd(today);

  const formatDateLong = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const assignments = await select("rotaAssignments", "*", {
    column: "uId",
    operator: "eq",
    value: currentUser.id,
  });

  const upcoming = assignments.filter((a) => a.date >= todayKey && a.published);

  if (!upcoming.length) {
    rotaWrapper.innerHTML = `<p style="text-align:center;">No published upcoming shifts</p>`;
    return;
  }

  const bookings = await select("bookings", "", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });
  const rotaRoles = await select("rotaRoles", "", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });
  const allAssignments = await select("rotaAssignments", "", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });
  const users = await select("users", "");

  const roleMap = {};
  rotaRoles.forEach((r) => {
    try {
      const parsedRoles = typeof r.roles === "string" ? JSON.parse(r.roles) : r.roles;
      parsedRoles.forEach((role) => {
        roleMap[role.id] = role;
      });
    } catch (e) {
      console.error("Failed to parse roles for org", r.oId, e);
    }
  });

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const formatHHMM = (t) => (t || "").slice(0, 5);

  const shifts = upcoming.map((shift) => {
    const role = roleMap[shift.role];
    const roleName = role?.role || "⚠️ Unknown Role";
    const user = userMap[shift.uId];

    let overlappingBookings = [];
    if (shift.date && shift.start && shift.end) {
      const sameDayBookings = bookings.filter(
        (b) => shift.date >= b.startDate && shift.date <= b.endDate && b.timings
      );

      for (const b of sameDayBookings) {
        let timings;
        try {
          timings = typeof b.timings === "string" ? JSON.parse(b.timings) : b.timings;
        } catch {
          timings = {};
        }

        const t = timings[shift.date];
        if (t?.start && t?.end && !(shift.end <= t.start || shift.start >= t.end)) {
          overlappingBookings.push(b.name);
        }
      }
    }

    return {
      id: shift.id,
      date: shift.date,
      bookings: overlappingBookings.length ? overlappingBookings.join(", ") : "-",
      roleName,
      userName: user ? `${user.forename} ${user.surname}` : "Unknown User",
      start: shift.start ? formatHHMM(shift.start) : "TBC",
      end: shift.end ? formatHHMM(shift.end) : "TBC",
    };
  });

  shifts.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));

  const grouped = {};
  for (const s of shifts) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }

  for (const [date, dayShifts] of Object.entries(grouped)) {
    for (const shift of dayShifts) {
      const presDate = formatDateToHTML(date);

      const card = document.createElement("div");
      card.className = "rota-card";
      card.style = `
        border-radius: 8px;
        padding: 14px;
        margin: 10px 0;
        width: 100%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        background: #fff;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.2s ease;
      `;
      card.onmouseover = () => (card.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)");
      card.onmouseout = () => (card.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)");

      card.innerHTML = `
        <div style="display:flex;flex-direction:column;justify-content:center;width:80px;">
          ${presDate}
        </div>
        <div style="flex:1;padding-left:10px;">
          <div><h4 style="margin:0;">${shift.roleName}</h4></div>
          <div style="display:flex;flex-direction:row;justify-content:space-between;margin-top:4px;">
            <h3 style="margin:0;">${shift.start}</h3>
            <h3 style="margin:0;">${shift.end}</h3>
          </div>
          <div><h5 style="margin-top:6px;color:#555;">Bookings: ${shift.bookings}</h5></div>
        </div>
      `;

      card.addEventListener("click", async () => {
        const others = allAssignments.filter(
          (a) => a.date === shift.date && a.id !== shift.id && a.published
        );

        if (!others.length) {
          showPopup("No one else is working this shift.", "Shift Info");
          return;
        }

        const cardsHTML = others
          .map((o) => {
            const role = roleMap[o.role];
            const user = userMap[o.uId];
            const roleName = role?.role || "⚠️ Unknown Role";
            const userName = user ? `${user.forename} ${user.surname}` : "Unknown User";
            const start = o.start ? formatHHMM(o.start) : "TBC";
            const end = o.end ? formatHHMM(o.end) : "TBC";

            return `
              <div style="display:flex;flex-direction:row;align-items:center;margin:6px 0;padding:6px 0;border-bottom:1px solid #eee;">
                <div style="flex:1;">
                  <h4 style="margin:0;">${userName}</h4>
                  <p style="margin:0;color:#555;">${roleName}</p>
                </div>
                <div>
                  <h3 style="margin:0;">${start} - ${end}</h3>
                </div>
              </div>`;
          })
          .join("");

        showPopup(`<div>${cardsHTML}</div>`, `Others on ${formatDateLong(shift.date)}`);
      });

      rotaWrapper.appendChild(card);
    }
  }
 const userId = currentUser.id;
const token = currentUser.calendarToken;
const httpsUrl = `${location.origin}/api/rota.ics?user=${userId}&token=${token}`;
const webcalUrl = httpsUrl.replace(/^https:/, 'webcal:');

// create button
const btn = document.createElement("button");
btn.textContent = "Subscribe to My Rota";
btn.className = "primaryButton";
btn.style = "margin-bottom:20px;";
btn.onclick = () => {
  // try opening webcal://
  const opened = window.open(webcalUrl);
  if (!opened) {
    // fallback: copy https link
    navigator.clipboard.writeText(httpsUrl).then(() => {
      alert("Could not open webcal:// automatically.\nCopied link to clipboard:\n\n" + httpsUrl);
    });
  }
};

  rotaWrapper.append(btn);
}
