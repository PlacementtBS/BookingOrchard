import { select} from "../js/db.js";

export default function bookingHTML() {
  return `
    <section class="fullHeight">
      <div>
        <div class="image" id="bookingHeaderImage">
          <div>
            <h1 id="bookingName">Loading...</h1>
            <h2 id="bookingDates">...</h2>
          </div>
        </div>

        <h3>Basic Details</h3>
        <table class="static">
          <tr><td><h4>Name</h4></td><td><p id="basicName">...</p></td></tr>
          <tr><td><h4>Start Date</h4></td><td><p id="basicStart">...</p></td></tr>
          <tr><td><h4>End Date</h4></td><td><p id="basicEnd">...</p></td></tr>
          <tr><td><h4>Recurrence</h4></td><td><p id="basicRecurrence">None</p></td></tr>
        </table>

        <hr>
        <h3>Requirements</h3>
        <table class="static">
          <tr><td><h4>Rooms Booked</h4></td><td><p id="roomsBooked">...</p></td></tr>
          <tr><td><h4>Notes</h4></td><td><p id="notes">...</p></td></tr>
        </table>

        <hr>
        <h3>Form Responses</h3>
        <div id="formResponses">Loading...</div>
      </div>

      <div class="third">
        <h1>Client Information</h1>
        <table class="static">
          <tr><td><h4>Name</h4></td><td><p id="clientName">...</p></td></tr>
          <tr><td><h4>Email</h4></td><td><p id="clientEmail">...</p></td></tr>
          <tr><td><h4>Phone Number</h4></td><td><p id="clientPhone">...</p></td></tr>
          <tr><td><h4>Company</h4></td><td><p id="clientCompany">...</p></td></tr>
        </table>

        <hr>
        <h1>Tasks</h1>
        <div id="bookingTasks">Loading...</div>
      </div>
    </section>
  `;
}

export async function bookingAfterRender(currentUser) {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const idFromUrl = urlParams.get("id");
  // Set header background image with fallback


  if (!idFromUrl) return;

  const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: idFromUrl }))[0];

  if (!booking) return;

  document.getElementById("bookingName").textContent = booking.name;
  document.getElementById("basicName").textContent = booking.name;
  document.getElementById("basicStart").textContent = new Date(booking.startDate).toLocaleDateString();
  document.getElementById("basicEnd").textContent = new Date(booking.endDate).toLocaleDateString();
  document.getElementById("bookingDates").textContent = `${new Date(booking.startDate).toLocaleDateString()} - ${new Date(booking.endDate).toLocaleDateString()}`;
  document.getElementById("notes").textContent = booking.notes || "None";
  document.getElementById("roomsBooked").textContent = booking.roomsBooked?.join(', ') || "None";
  const headerDiv = document.getElementById("bookingHeaderImage");
const imageUrl =  booking.imageUrl || "https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Vector.svg";
headerDiv.style.backgroundImage = `url('${imageUrl}')`;
headerDiv.style.backgroundColor = `#1c824f`;


  // Recurrence parsing
  if (booking.recurrence) {
    try {
      const rec = typeof booking.recurrence === 'string' ? JSON.parse(booking.recurrence) : booking.recurrence;
      document.getElementById("basicRecurrence").textContent = `${rec.basis}: ${rec.days?.join(', ')}`;
    } catch {
      document.getElementById("basicRecurrence").textContent = "Invalid format";
    }
  }

  // Client info placeholder
  if (booking.client) {
    document.getElementById("clientName").textContent = booking.client.name || "-";
    document.getElementById("clientEmail").textContent = booking.client.email || "-";
    document.getElementById("clientPhone").textContent = booking.client.phone || "-";
    document.getElementById("clientCompany").textContent = booking.client.company || "-";
  }

  // Form responses placeholder
  const formResponses = booking.formResponses || [];
  const formContainer = document.getElementById("formResponses");
  if (formResponses.length) {
    formContainer.innerHTML = formResponses.map(f => `
      <h4>${f.formName}</h4>
      <table class="static">
        ${f.questions.map(q => `
          <tr><td><h4>${q.question}</h4></td><td><p>${q.response}</p></td></tr>
        `).join('')}
      </table>
    `).join('');
  } else {
    formContainer.innerHTML = "<p>No responses submitted.</p>";
  }

  // Tasks placeholder
  const taskContainer = document.getElementById("bookingTasks");
  taskContainer.innerHTML = "<ul><li>Example Task 1</li><li>Example Task 2</li></ul>";
}
