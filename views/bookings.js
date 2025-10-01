import { select, insert } from "../js/db.js";

// --- Custom popup for new bookings ---
// --- Custom popup for new bookings ---
function showNewBookingPopup(currentUser) {
  const overlay = document.createElement("div");
  overlay.className = "popupOverlay";

  const popup = document.createElement("div");
  popup.className = "popup";
  popup.innerHTML = `
    <h2>New Booking</h2>
    <form id="newBookingForm" class="popupForm">
      <label>
        Booking Name
        <input type="text" name="name" required />
      </label>
      <label>
        Recurring?
        <input type="checkbox" id="recurring" name="recurring" />
      </label>

      <div id="recurrenceFields" style="display:none;">
        <label>
          Recurrence Basis
          <select id="basis" name="basis">
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </label>

        <div id="weeklyFields" style="display:none;">
          <p>Select days:</p>
          ${["Mo","Tu","We","Th","Fr","Sa","Su"].map(
            d => `<label><input type="checkbox" value="${d}" /> ${d}</label>`
          ).join(" ")}
        </div>

        <div id="monthlyFields" style="display:none;">
          <label>
            Week
            <select id="monthWeek">
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">3rd</option>
              <option value="4">4th</option>
              <option value="last">Last</option>
            </select>
          </label>
          <label>
            Day
            <select id="monthDay">
              ${["Mo","Tu","We","Th","Fr","Sa","Su"].map(
                d => `<option value="${d}">${d}</option>`
              ).join("")}
            </select>
          </label>
        </div>

        <label>
          Start Date
          <input type="date" id="recurringStart" name="recurringStart" required />
        </label>
        <label>
          End Date
          <input type="date" id="recurringEnd" name="recurringEnd" required />
        </label>
      </div>

      <div id="dateFields">
        <p>Set booking dates:</p>
        <div id="datesContainer"></div>
      </div>

      <div class="popupActions">
        <button type="submit" class="primaryButton">Create</button>
        <button type="button" id="cancelBtn" class="outlineButton">Cancel</button>
      </div>
    </form>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  const recurringChk = popup.querySelector("#recurring");
  const recurrenceFields = popup.querySelector("#recurrenceFields");
  const basisSelect = popup.querySelector("#basis");
  const weeklyFields = popup.querySelector("#weeklyFields");
  const monthlyFields = popup.querySelector("#monthlyFields");
  const datesContainer = popup.querySelector("#datesContainer");

  // --- Helpers ---
  function addDateInput(required = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "dateRow";

    const input = document.createElement("input");
    input.type = "date";
    recurringChk.addEventListener("change", () => {
  const isRecurring = recurringChk.checked;
  recurrenceFields.style.display = isRecurring ? "block" : "none";
  document.getElementById("dateFields").style.display = isRecurring ? "none" : "block";

  // Fix required attribute on hidden fields
  datesContainer.querySelectorAll("input[type=date]").forEach(input => {
    input.required = !isRecurring; 
  });
});

    input.className = "dateInput";

    input.addEventListener("change", () => {
      const lastInput = datesContainer.querySelector(".dateRow:last-child input");
      if (lastInput && lastInput.value && !lastInput.nextSibling) {
        addDateInput(false);
      }
    });

    wrapper.appendChild(input);
    datesContainer.appendChild(wrapper);
  }

  // first one required for single dates
  addDateInput(true);

  recurringChk.addEventListener("change", () => {
    recurrenceFields.style.display = recurringChk.checked ? "block" : "none";
    document.getElementById("dateFields").style.display = recurringChk.checked ? "none" : "block";
  });

  basisSelect.addEventListener("change", () => {
    weeklyFields.style.display = basisSelect.value === "Weekly" ? "block" : "none";
    monthlyFields.style.display = basisSelect.value === "Monthly" ? "block" : "none";
  });

  popup.querySelector("#cancelBtn").addEventListener("click", () => {
    overlay.remove();
  });

  popup.querySelector("#newBookingForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const name = form.name.value;
    const recurring = recurringChk.checked;

    let startDate = null;
    let endDate = null;
    let recurrence = null;

    if (!recurring) {
      const dates = Array.from(datesContainer.querySelectorAll("input[type=date]"))
        .map(i => i.value)
        .filter(v => v);

      if (!dates.length) {
        alert("Please add at least one date");
        return;
      }
      startDate = dates[0];
      endDate = dates[dates.length - 1];
      recurrence = { basis: "SingleDates", dates };
    } else {
      startDate = form.recurringStart.value;
      endDate = form.recurringEnd.value;

      if (!startDate || !endDate) {
        alert("Please select a start and end date for recurring bookings");
        return;
      }

      if (basisSelect.value === "Weekly") {
        const days = Array.from(weeklyFields.querySelectorAll("input:checked")).map(i => i.value);
        if (!days.length) {
          alert("Please select at least one day for weekly recurrence");
          return;
        }
        recurrence = { basis: "Weekly", days };
      }
      if (basisSelect.value === "Monthly") {
        recurrence = { 
          basis: "Monthly", 
          week: document.getElementById("monthWeek").value, 
          day: document.getElementById("monthDay").value 
        };
      }
    }

    await insert("bookings", {
      id: crypto.randomUUID(),
      name,
      recurring, // ✅ always true for recurring
      recurrence,
      startDate,
      endDate,
      oId: currentUser.organisationId,
      uId: currentUser.id,
      stage: "0"
    });

    overlay.remove();
    location.reload();
  });
}


// --- Main Page ---
export default function bookingsPage() {
  return (`
        <button id="NewBooking" class="actionButton">+</button>
    </section>
    <section class="fullHeight">
      <div class="cardGallery" id="bookings">
        <p>Loading bookings...</p>
      </div>
    </section>
  `);
}

export async function loadBookings(currentUser) {
  const container = document.getElementById("bookings");
  const newBookingBtn = document.getElementById("NewBooking");

  if (newBookingBtn) {
    newBookingBtn.addEventListener("click", () => {
      showNewBookingPopup(currentUser);
    });
  }

  if (!container) return;

  container.innerHTML = "";

  const bookings = await select("bookings", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId
  });

  if (!bookings.length) {
    container.innerHTML = "<p>No bookings found.</p>";
    return;
  }

  for (const b of bookings) {
    const client = (await select("clients", "*", {
      column: "id",
      operator: "eq",
      value: b.clientId
    }))[0];

    const clientName = client
      ? `${client.forename} ${client.surname} (${client.companyName})`
      : "None";

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="image" style="background-image: url('https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/bookingImages/${b.id}')"></div>
      <div>
        <h4>Event</h4>
        <p>${b.name}</p>
      </div>
      <div>
        <h4>Dates</h4>
        <p>${new Date(b.startDate).toLocaleDateString()} - ${new Date(b.endDate).toLocaleDateString()}</p>
      </div>
      <div>
        <h4>Client Name</h4>
        <p>${clientName}</p>
      </div>
      <a href="#/bookings/view?id=${b.id}"><button class="primaryButton fullWidth" style="margin-top:5px">View</button></a>
    `;

    container.appendChild(card);
  }
}
