import { select, update } from "../js/db.js";
import { showUpdatePopup, showInsertPopup } from "../js/popup.js";

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
          <div id="invoiceLink"></div>
        <hr>
        <h3>Timings</h3>
        <table class="static" id="timings"></table>

        <hr>
        <h3>Requirements</h3>
        <table class="static">
          <tr><td><h4>Rooms Booked</h4></td><td id="roomsBookedContainer"><p id="roomsBooked">...</p></td></tr>
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
        <hr>
        <h1>Staff Scheduled During This Event</h1>
        <div id="bookingRota" style="display:flex; flex-direction:column; gap:12px;">Loading...</div>
      </div>
    </section>
  `;
}

export async function bookingAfterRender(currentUser) {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const idFromUrl = urlParams.get("id");
  if (!idFromUrl) return;

  document.getElementById("invoiceLink").innerHTML = `
  <a href="http://127.0.0.1:5500/#/invoice-and-quote?bid=${idFromUrl}">Invoice</a>
`;

  const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: idFromUrl }))[0];
  if (!booking) return;

  // --- Populate basic info ---
  document.getElementById("bookingName").textContent = booking.name;
  document.getElementById("basicName").textContent = booking.name;
  document.getElementById("basicStart").textContent = new Date(booking.startDate).toLocaleDateString("en-GB");
  document.getElementById("basicEnd").textContent = new Date(booking.endDate).toLocaleDateString("en-GB");
  document.getElementById("bookingDates").textContent = `${new Date(booking.startDate).toLocaleDateString("en-GB")} - ${new Date(booking.endDate).toLocaleDateString("en-GB")}`;
  document.getElementById("notes").textContent = booking.notes || "None";

  // --- Load rooms booked safely ---
  const reqResponses = await select("requirementsFormResponses", "*", { column: "bId", operator: "eq", value: idFromUrl });
  const roomsContainer = document.getElementById("roomsBookedContainer");

  if (reqResponses.length > 0) {
    let responseData = reqResponses[0].response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); } catch { responseData = []; }
    }

    const roomIdsSelected = responseData.filter(r => r.response).map(r => r.roomId);
    if (roomIdsSelected.length > 0) {
      const rooms = await select("rooms", "*", { column: "oId", operator: "eq", value: booking.oId });
      const roomNames = rooms.filter(r => roomIdsSelected.includes(r.id)).map(r => r.room);
      roomsContainer.innerHTML = `<p>${roomNames.join(", ")}</p>`;
    } else {
      const formLink = `requirements-form?bid=${booking.id}`;
      roomsContainer.innerHTML = `
        <a href="#/${formLink}">Visit Requirements Form</a>
        <button class="outlineButton" onclick="navigator.clipboard.writeText('${location.origin}/#/${formLink}')">Copy Link</button>
      `;
    }
  } else {
    const formLink = `requirements-form?bid=${booking.id}`;
    roomsContainer.innerHTML = `
      <a href="#/${formLink}">Visit Requirements Form</a>
      <button class="outlineButton" onclick="navigator.clipboard.writeText('${location.origin}/#/${formLink}')">Copy Link</button>
    `;
  }

  // --- Parse recurrence safely ---
  let rec = {};
  try { rec = typeof booking.recurrence === 'string' ? JSON.parse(booking.recurrence) : booking.recurrence || {}; } catch { rec = {}; }

  // --- Timings ---
  if (!booking.timings) {
    document.getElementById("timings").innerHTML = `
      <tr>
        <td>
          Please set the timings of your event here
          <button class="primaryButton" id="set-timings">Set Timings</button>
        </td>
      </tr>
    `;

    const dates = [];
    let currentDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);

    if (rec.basis === "Daily") {
      while (currentDate <= endDate) { dates.push(currentDate.toISOString().split('T')[0]); currentDate.setDate(currentDate.getDate() + 1); }
    } else if (rec.basis === "Weekly") {
      const daysOfWeek = rec.days || [];
      while (currentDate <= endDate) {
        const dayAbbr = ["Su","Mo","Tu","We","Th","Fr","Sa"][currentDate.getDay()];
        if (daysOfWeek.includes(dayAbbr)) dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (rec.basis === "Monthly") {
      while (currentDate <= endDate) { dates.push(currentDate.toISOString().split('T')[0]); currentDate.setMonth(currentDate.getMonth() + 1); }
    } else {
      dates.push(new Date(booking.startDate).toISOString().split('T')[0]);
    }

    document.getElementById("set-timings").addEventListener("click", () => {
      showUpdatePopup({
        tableName: "bookings",
        id: idFromUrl,
        columns: [{ name: "timings", type: "bookingtime", dates }],
        extraInsertFields: { oId: currentUser.organisationId, uId: currentUser.id }
      });
    });
  } else {
    let timingsObj = {};
    if (typeof booking.timings === 'string') { try { timingsObj = JSON.parse(booking.timings); } catch { timingsObj = {}; } }
    else if (typeof booking.timings === 'object' && booking.timings !== null) timingsObj = booking.timings;

    const timingsEntries = Object.entries(timingsObj);
    if (timingsEntries.length > 0) {
      const timingsHtml = timingsEntries.map(([date, time]) => `
        <tr>
          <td>${date}</td>
          <td>${time.start || "-"}</td>
          <td>${time.end || "-"}</td>
        </tr>
      `);
      document.getElementById("timings").innerHTML = timingsHtml.join('');
    } else {
      document.getElementById("timings").innerHTML = "<p>No Timings Given.</p>";
    }
  }

  // --- Header image ---
  const headerDiv = document.getElementById("bookingHeaderImage");
  const imageUrl = booking.imageUrl || "https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/public1//Vector.svg";
  headerDiv.style.backgroundImage = `url('${imageUrl}')`;
  headerDiv.style.backgroundColor = `#1c824f`;

  // --- Form responses ---
  const forms = await select("formResponses", "*", { column: "bId", operator: "eq", value: idFromUrl });
  const formResponsesContainer = document.getElementById("formResponses");

  if (forms.length > 0) {
    const formsHtml = await Promise.all(forms.map(async f => {
      const form = (await select("customForms", "*", { column: "id", operator: "eq", value: f.formId }))[0];
      let responseData = f.response;
      if (typeof responseData === "string") { try { responseData = JSON.parse(responseData); } catch { responseData = {}; } }

      return `
        <div>
          <h4>${form?.name || "Untitled Form"}</h4>
          <a href="#/form?id=${f.formId}&bid=${idFromUrl}">Manual Completion</a>
          <button class="outlineButton" onclick="navigator.clipboard.writeText('${location.origin}/#/form?id=${f.formId}&bid=${idFromUrl}')">Copy Link</button>
          <table class="static">
            ${Object.entries(responseData).map(([q,a])=>`<tr><td><h4>${q}</h4></td><td><p>${a}</p></td></tr>`).join('')}
          </table>
        </div>
      `;
    }));
    formResponsesContainer.innerHTML = formsHtml.join('');
  } else { formResponsesContainer.innerHTML = "<p>No responses submitted.</p>"; }

  // --- Recurrence display ---
  if (rec.basis) document.getElementById("basicRecurrence").textContent = `${rec.basis}${rec.days?.length ? ": " + rec.days.join(', ') : ""}`;

  // --- Client info ---
  const clientBlock = document.getElementById("clientInfoContainer");
  const clients = await select("clients", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
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
    const clientOptions = clients.map(c => `<option value="${c.id}">${c.companyName} (${c.forename} ${c.surname})</option>`).join('');
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
          columns: ["forename","surname","email","phone","companyName"],
          friendlyNames:["Forename","Surname","Email","Phone","Company"],
          extraInsertFields:{ oId: currentUser.organisationId }
        });
      } else if (selectedValue) {
        await update("bookings",{ clientId:selectedValue },{ column:"id", operator:"eq", value:idFromUrl });
        bookingAfterRender(currentUser);
      }
    });
  }

  // --- Tasks placeholder ---
  document.getElementById("bookingTasks").textContent = "Loading tasks...";

  // --- Staff scheduled (updated with blocks, showing each shift's own times) ---
  const schedule = await select("rotaAssignments", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
  const users = await select("users", "*", { column: "organisationId", operator: "eq", value: currentUser.organisationId });
  const rotaRoles = await select("rotaRoles", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
  const bookingRotaEl = document.getElementById("bookingRota");
  bookingRotaEl.textContent = "";

  if (booking.timings) {
    for (const [bDate, t] of Object.entries(booking.timings)) {
      if (!t?.start || !t?.end) continue;

      const [bStartH, bStartM] = t.start.split(":").map(Number);
      const [bEndH, bEndM] = t.end.split(":").map(Number);
      const bookingStartMinutes = bStartH * 60 + bStartM;
      const bookingEndMinutes = bEndH * 60 + bEndM;

      const overlappingShifts = schedule.filter(shift => {
        if (shift.date !== bDate || !shift.start || !shift.end) return false;
        const [sH, sM] = shift.start.split(":").map(Number);
        const [eH, eM] = shift.end.split(":").map(Number);
        const shiftStart = sH * 60 + sM;
        const shiftEnd = eH * 60 + eM;
        return !(shiftEnd <= bookingStartMinutes || shiftStart >= bookingEndMinutes);
      });

      if (!overlappingShifts.length) continue;

      const uniqueShiftsMap = new Map();
      overlappingShifts.forEach(shift => {
        const key = `${shift.role}-${shift.uId}-${shift.start}-${shift.end}`;
        if (!uniqueShiftsMap.has(key)) uniqueShiftsMap.set(key, shift);
      });

      const bookingDiv = document.createElement("div");
      bookingDiv.style.border = "1px solid #ccc";
      bookingDiv.style.borderRadius = "6px";
      bookingDiv.style.padding = "8px";
      bookingDiv.style.background = "#f5f5f5";
      bookingDiv.style.display = "flex";
      bookingDiv.style.flexDirection = "column";
      bookingDiv.style.gap = "4px";

      const titleDiv = document.createElement("div");
      titleDiv.textContent = `${booking.name} (${bDate} ${t.start}-${t.end})`;
      titleDiv.style.fontWeight = "bold";
      bookingDiv.appendChild(titleDiv);

      uniqueShiftsMap.forEach(shift => {
        const role = rotaRoles.find(r => r.id === shift.role);
        const user = users.find(u => u.id === shift.uId);
        const staffName = user ? `${user.forename} ${user.surname}` : "(Unassigned)";
        const roleName = role ? role.roleName : "Unknown Role";

        const shiftDiv = document.createElement("div");
        shiftDiv.textContent = `${shift.start}-${shift.end} | ${roleName}: ${staffName}`;
        shiftDiv.style.background = "#c5e1a5";
        shiftDiv.style.padding = "4px 8px";
        shiftDiv.style.borderRadius = "4px";
        shiftDiv.style.fontSize = "0.9em";
        bookingDiv.appendChild(shiftDiv);
      });

      bookingRotaEl.appendChild(bookingDiv);
    }
  }
}
