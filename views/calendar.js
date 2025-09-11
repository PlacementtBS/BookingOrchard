import { select } from "../js/db.js";
import { showInsertPopup } from "../js/popup.js";

export default function calendarPage() {
  return (`
    <section>
      <div class="cal-headerBar">
        <button id="prevMonth" class="primaryButton">Previous</button>
        <h1 id="monthLabel" class="cal-monthLabel"></h1>
        <button id="nextMonth" class="primaryButton">Next</button>
        <button id="NewBooking" class="primaryButton">New Booking</button>
      </div>
    </section>
    <section>
      <div id="calendarContainer" class="cal-grid">
        <p>Loading calendar...</p>
      </div>
    </section>
  `);
}

// Call this AFTER rendering to the DOM
export async function loadCalendar(currentUser) {
  const container = document.getElementById("calendarContainer");
  const monthLabel = document.getElementById("monthLabel");
  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");
  const newBookingBtn = document.getElementById("NewBooking");

  let currentDate = new Date();

  if (newBookingBtn) {
    newBookingBtn.addEventListener("click", () => {
      showInsertPopup({
        tableName: "bookings",
        columns: [
          "name",
          { name: "startDate", type: "date" },
          { name: "endDate", type: "date" },
          { name: "recurring", type: "checkbox" },
          {
            name: "recurrence",
            type: "customGroup",
            fields: [
              { name: "basis", label: "Recurrence Basis", type: "select", options: ["Daily", "Weekly", "Monthly"] },
              { name: "days", label: "Days of Week", type: "checkboxGroup", options: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] }
            ]
          }
        ],
        friendlyNames: [
          "Booking Name", "Start Date", "End Date", "Recurring?", "Recurrence Settings"
        ],
        extraInsertFields: {
          oId: currentUser.organisationId,
          uId: currentUser.id
        }
      });
    });
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function matchesRecurrence(booking, date) {
    if (!booking.recurring) {
      // Non-recurring: only show on startDate
      const start = stripTime(new Date(booking.startDate));
      return date.getTime() === start.getTime();
    }

    // Recurring event
    const start = stripTime(new Date(booking.startDate));
    const end = stripTime(new Date(booking.endDate || booking.startDate));

    if (date < start || date > end) return false;

    if (!booking.recurrence) return false;

    const dayOfWeek = ["Su","Mo","Tu","We","Th","Fr","Sa"][date.getDay()];
    const basis = booking.recurrence.basis; // Daily / Weekly / Monthly
    const days = booking.recurrence.days || [];

    switch (basis) {
      case "Daily":
        return true; // every day in range
      case "Weekly":
        return days.includes(dayOfWeek);
      case "Monthly":
        return date.getDate() === start.getDate();
      default:
        return false;
    }
  }

  async function renderCalendar() {
    if (!container) return;
    container.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthLabel.textContent = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

    const bookings = await select("bookings", "*", {
      column: "oId",
      operator: "eq",
      value: currentUser.organisationId
    });

    const grid = document.createElement("div");
    grid.className = "cal-month";

    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat","Sun"];
    weekdays.forEach(d => {
      const cell = document.createElement("div");
      cell.className = "cal-header";
      cell.textContent = d;
      grid.appendChild(cell);
    });

    const firstDay = new Date(year, month, 0).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell empty";
      grid.appendChild(blank);
    }

    // Day cells
    for (let d = 1; d <= lastDate; d++) {
      const dateCell = document.createElement("div");
      dateCell.className = "cal-cell";

      const dayNum = document.createElement("div");
      dayNum.className = "cal-dayNumber";
      dayNum.textContent = d;
      dateCell.appendChild(dayNum);

      const list = document.createElement("ul");
      list.className = "cal-eventList";

      const cellDate = stripTime(new Date(year, month, d));

      bookings.forEach(b => {
        if (matchesRecurrence(b, cellDate)) {
          const item = document.createElement("li");
          item.innerHTML = `<a href="#/bookings/view?id=${b.id}">${b.name}</a>`;
          list.appendChild(item);
        }
      });

      dateCell.appendChild(list);
      grid.appendChild(dateCell);
    }

    container.appendChild(grid);
  }

  prevBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  nextBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  await renderCalendar();
}
