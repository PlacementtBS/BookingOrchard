import { select } from "../js/db.js";

export default function bookingsPage() {
  // Return the static structure with an empty container
  return `
    <section>
      <div class="cardContainer" id="bookings">
        <p>Loading bookings...</p>
      </div>
    </section>
  `;
}

// Call this AFTER rendering to the DOM
export async function loadBookings(currentUser) {
  const container = document.getElementById("bookings");
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

  bookings.forEach(b => {
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
        <p>${b.startDate} - ${b.endDate}</p>
      </div>
      <div>
        <h4>Client Name</h4>
        <p>${b.clientId}</p>
      </div>
      <button class="primaryButton">View More</button>
    `;
    container.appendChild(card);
  });
}
