import { select } from "../js/db.js";

export default function myRotaPage() {
  return `
    <section>
      <div class="rota-headerBar">
        <h1>My Rota</h1>
      </div>
    </section>
    <section>
      <div id="myRotaWrapper" class="rota-wrapper"></div>
    </section>
  `;
}

export async function loadMyRota(currentUser) {
  const rotaWrapper = document.getElementById("myRotaWrapper");
  rotaWrapper.innerHTML = "";

  // today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const todayKey = ymd(today);

  const formatDateLong = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  // --- fetch data ---
  const assignments = await select("rotaAssignments", "*", {
    column: "uId",
    operator: "eq",
    value: currentUser.id
  });
  if (!assignments.length) {
    rotaWrapper.innerHTML = `<p style="text-align:center;">No upcoming shifts</p>`;
    return;
  }

  const bookings = await select("bookings", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId
  });
  const rotaRoles = await select("rotaRoles", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId
  });

  // --- filter, enrich & group by date ---
  const shifts = assignments
    .filter((shift) => shift.date >= todayKey) // exclude past
    .map((shift) => {
      const role = rotaRoles.find((r) => r.id === shift.role);
      const roleName = role ? role.roleName : "Unknown Role";

      let overlappingBookings = [];
      if (shift.date && shift.start && shift.end) {
        // bookings active on this date
        const sameDayBookings = bookings.filter(
          (b) =>
            shift.date >= b.startDate &&
            shift.date <= b.endDate &&
            b.timings
        );

        for (const b of sameDayBookings) {
          let timings;
          try {
            timings =
              typeof b.timings === "string"
                ? JSON.parse(b.timings)
                : b.timings;
          } catch {
            timings = {};
          }

          const t = timings[shift.date];
          if (t?.start && t?.end) {
            // overlap check: !(shiftEnd <= bookingStart || shiftStart >= bookingEnd)
            if (!(shift.end <= t.start || shift.start >= t.end)) {
              overlappingBookings.push(b.name);
            }
          }
        }
      }

      return {
        date: shift.date,
        bookings: overlappingBookings.length
          ? overlappingBookings.join(", ")
          : "-",
        role: roleName,
        times:
          shift.start && shift.end ? `${shift.start} - ${shift.end}` : "TBC"
      };
    });

  if (!shifts.length) {
    rotaWrapper.innerHTML = `<p style="text-align:center;">No upcoming shifts</p>`;
    return;
  }

  // sort by date/time
  shifts.sort((a, b) => {
    if (a.date === b.date) return a.times.localeCompare(b.times);
    return a.date.localeCompare(b.date);
  });

  // group by date
  const grouped = {};
  for (const s of shifts) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }

  // render
  for (const [date, dayShifts] of Object.entries(grouped)) {
    // date heading
    const heading = document.createElement("h2");
    heading.textContent = formatDateLong(date);
    rotaWrapper.appendChild(heading);

    // shifts
    dayShifts.forEach((shift) => {
      const card = document.createElement("div");
      card.className = "rota-card";
      card.style = `
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 12px;
        margin: 8px 0;
        width: 100%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      card.innerHTML = `
        <div><strong>Role:</strong> ${shift.role}</div>
        <div><strong>Bookings:</strong> ${shift.bookings}</div>
        <div><strong>Times:</strong> ${shift.times}</div>
      `;
      rotaWrapper.appendChild(card);
    });
  }
}
