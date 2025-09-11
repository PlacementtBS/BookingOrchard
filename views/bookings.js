import { select } from "../js/db.js";
import { showInsertPopup } from "../js/popup.js";

export default function bookingsPage() {
  return (`
    <section>
      <div>
        <h1>Bookings</h1>
        <button id="NewBooking" class="primaryButton">New Booking</button>
      </div>
      </section>
      <section>
        <div class="cardContainer" id="bookings">
          <p>Loading bookings...</p>
        </div>
      </section>
    
  `);
}

// Call this AFTER rendering to the DOM
export async function loadBookings(currentUser) {
  const container = document.getElementById("bookings");
  const newBookingBtn = document.getElementById("NewBooking");

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
              {
                name: "basis",
                label: "Recurrence Basis",
                type: "select",
                options: ["Daily", "Weekly", "Monthly"]
              },
              {
                name: "days",
                label: "Days of Week",
                type: "checkboxGroup",
                options: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
              }
            ]
          }
        ],
        friendlyNames: [
          "Booking Name",
          "Start Date",
          "End Date",
          "Recurring?",
          "Recurrence Settings"
        ],
        extraInsertFields: {
          oId: currentUser.organisationId,
          uId: currentUser.id
        }
      });
    });
  }

  if (!container) return;

  container.innerHTML = ""; // Clear loading message

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
      <div class="image" style="background-image: url('https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/800px-Placeholder_view_vector.svg.png')"></div>
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
      <a href="#/bookings/view?id=${b.id}"><button class="primaryButton">View More</button></a>
    `;

    container.appendChild(card);
  }
}
