import { select } from "../js/db.js";

export default function calendarPage() {
  return (`
    <section>
      <div style="display:flex; justify-content:center; gap: 10px;">
        <button id="prevMonth" >Previous</button>
        <button id="monthLabel" style="border:none !important" class="outlineButton"></button>
        <button id="nextMonth">Next</button>
      </div>
    </section>
    <section>
      <div id="calendarContainer" class="cal-grid">
        <p>Loading calendar...</p>
      </div>
    </section>
  `);
}

export async function loadCalendar(currentUser) {
  const container = document.getElementById("calendarContainer");
  const monthLabel = document.getElementById("monthLabel");
  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");

  let currentDate = new Date();

  function formatDate(date) {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
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

    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    weekdays.forEach(d => {
      const cell = document.createElement("div");
      cell.className = "cal-header";
      cell.textContent = d;
      grid.appendChild(cell);
    });



    // 0 = Sunday, 1 = Monday ... shift to 0 = Monday
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
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

      const cellDate = formatDate(new Date(year, month, d));

      bookings.forEach(b => {
  const timings = JSON.parse(b.timings || "{}");
  for (const dateStr in timings) {
    const bookingDate = new Date(dateStr);
    if (
      bookingDate.getFullYear() === year &&
      bookingDate.getMonth() === month &&
      bookingDate.getDate() === d
    ) {
      const item = document.createElement("li");
      item.innerHTML = `<a href="#/bookings/view?id=${b.id}">${b.name}</a>`;
      list.appendChild(item);
    }
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
