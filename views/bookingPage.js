import { select, update } from "../js/db.js";
import { showInsertPopup } from "../js/popup.js";

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
        <div id="clientBlock">
          <div id="clientInfoContainer"></div>
        </div>

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
  if (!idFromUrl) return;

  const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: idFromUrl }))[0];
  if (!booking) return;

  document.getElementById("bookingName").textContent = booking.name;
  document.getElementById("basicName").textContent = booking.name;
  document.getElementById("basicStart").textContent = new Date(booking.startDate).toLocaleDateString("en-GB");
  document.getElementById("basicEnd").textContent = new Date(booking.endDate).toLocaleDateString("en-GB");
  document.getElementById("bookingDates").textContent = `${new Date(booking.startDate).toLocaleDateString("en-GB")} - ${new Date(booking.endDate).toLocaleDateString("en-GB")}`;
  document.getElementById("notes").textContent = booking.notes || "None";
  document.getElementById("roomsBooked").textContent = booking.roomsBooked?.join(', ') || "None";

  const headerDiv = document.getElementById("bookingHeaderImage");
  const imageUrl = booking.imageUrl || "https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Vector.svg";
  headerDiv.style.backgroundImage = `url('${imageUrl}')`;
  headerDiv.style.backgroundColor = `#1c824f`;

  // Load and display form responses
  const forms = await select("formResponses", "*", { column: "bId", operator: "eq", value: idFromUrl });
  const formResponsesContainer = document.getElementById("formResponses");

  if (forms.length > 0) {
    const formsHtml = await Promise.all(forms.map(async f => {
      const form = (await select("customForms", "*", { column: "id", operator: "eq", value: f.formId }))[0];
      const responseData = typeof f.response === 'string' ? JSON.parse(f.response) : f.response;

      return `
        <div>
          <h4>${form?.name || "Untitled Form"}</h4><a href="#/form?id=${f.formId}&bid=${idFromUrl}">Manual Completion </a><button class="outlineButton" onclick="navigator.clipboard.writeText('${location.origin}/#/form?id=${f.formId}&bid=${idFromUrl}')">Copy Link</button>
          <table class="static">
            ${Object.entries(responseData).map(([q, a]) => `
              <tr><td><h4>${q}</h4></td><td><p>${a}</p></td></tr>
            `).join('')}
          </table>
        </div>
      `;
    }));

    formResponsesContainer.innerHTML = formsHtml.join('');
  } else {
    formResponsesContainer.innerHTML = "<p>No responses submitted.</p>";
  }

  if (booking.recurrence) {
    try {
      const rec = typeof booking.recurrence === 'string' ? JSON.parse(booking.recurrence) : booking.recurrence;
      document.getElementById("basicRecurrence").textContent = `${rec.basis}: ${rec.days?.join(', ')}`;
    } catch {
      document.getElementById("basicRecurrence").textContent = "Invalid format";
    }
  }

  const clientBlock = document.getElementById("clientInfoContainer");
  const clients = await select("clients", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId
  });
  const clientId = booking.clientId || null;
  const selectedClient = clients.find(c => c.id === clientId);

  if (selectedClient) {
    clientBlock.innerHTML = `
      <table class="static">
        <tr><td><h4>Name</h4></td><td><p>${selectedClient.forename || "-"} ${selectedClient.surname || ""}</p></td></tr>
        <tr><td><h4>Email</h4></td><td><p>${selectedClient.email || "-"}</p></td></tr>
        <tr><td><h4>Phone Number</h4></td><td><p>${selectedClient.phone || "-"}</p></td></tr>
        <tr><td><h4>Company</h4></td><td><p>${selectedClient.companyName || "-"}</p></td></tr>
      </table>
    `;
  } else {
    const clientOptions = clients.map(c =>
      `<option value="${c.id}">${c.companyName} (${c.forename} ${c.surname})</option>`
    ).join('');

    clientBlock.innerHTML = `
      <h1>No client assigned, choose a client</h1>
      <select id="clientSelect" class="dropdown">
        <option value="">-- Select client --</option>
        <option value="create">➕ Create New Client</option>
        ${clientOptions}
      </select>
    `;

    document.getElementById("clientSelect").addEventListener("change", async (e) => {
      const selectedValue = e.target.value;

      if (selectedValue === "create") {
        showInsertPopup({
          tableName: "clients",
          columns: ["forename", "surname", "email", "phone", "companyName"],
          friendlyNames: ["Forename", "Surname", "Email", "Phone", "Company"],
          extraInsertFields: {
            oId: currentUser.organisationId
          }
        });
      } else if (selectedValue) {
        await update("bookings", { clientId: selectedValue }, {
          column: "id",
          operator: "eq",
          value: idFromUrl
        });
        location.reload();
      }
    });
  }

  document.getElementById("bookingTasks").innerHTML = "<ul><li>Example Task 1</li><li>Example Task 2</li></ul>";
}
