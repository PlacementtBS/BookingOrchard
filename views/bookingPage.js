import { select, update, insert, remove } from "../js/db.js";
import { showUpdatePopup, showInsertPopup } from "../js/popup.js";
import { sendEmail } from "../js/email.js";
import { completeStage } from "../js/bookingWorkflowActions.js";
import { supabase, uploadFile } from "../js/supabaseUpload.js"; // Supabase client

function showSystemMessage(text, type = "alert") {
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.className = type; // "alert" or "success"
  document.getElementById("systemMessages").appendChild(msg);
}

export default function bookingHTML() {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const bookingId = urlParams.get("id");
  return `
    <section class="fullHeight">
      <div id="mainBookingContent">
        <!-- Booking Banner -->
        <div id="bookingHeaderImage" style="position: relative; width: 100%; height: 200px; overflow:hidden;" class="background">
          <img id="bookingBannerImage" style="width: 100%; height: 100%; object-fit: cover;" />
          <h2 id="bookingName" style="position:absolute; bottom:40px; left:20px; color:white; text-shadow:1px 1px 3px black;">...</h2>
          <p id="bookingDates" style="position:absolute; bottom:10px; left:20px; color:white; text-shadow:1px 1px 3px black;">...</p>
        </div>
        <div class="halfContainer">
          <div class="background half">
            <h3>Basic Details</h3>
            <table class="static">
              <tr><td><h4>Name</h4></td><td><p id="basicName">...</p></td></tr>
              <tr><td><h4>Start Date</h4></td><td><p id="basicStart">...</p></td></tr>
              <tr><td><h4>End Date</h4></td><td><p id="basicEnd">...</p></td></tr>
              <tr><td><h4>Recurrence</h4></td><td><p id="basicRecurrence">None</p></td></tr>
              <tr><td><h4>Notes</h4></td><td><p id="notes">...</p></td></tr>
            </table>
          </div>
          <div class="background half">
            <h3>Client Information</h3>
            <div id="clientInfoContainer"></div>
          </div>
        </div>
        <div class="background">
          <div id="invoiceLink"></div>
        </div>
        <div class="background">
          <h3>Timings <button id="editTimingsBtn" class="outlineButton">Edit</button></h3>
          <div class="cardGallery" id="timingsTable"></div>
        </div>
        <div class="background">
          <h3>Requirements</h3>
          <table class="static">
            <tr><td><h4>Rooms Booked</h4></td><td id="roomsBookedContainer"><p id="roomsBooked">...</p></td></tr>
          </table>
        </div>
        <div>
          <div id="formResponses">Loading...</div>
        </div>
      </div>

      <div class="third">
        <div class="background">
          <h3 id="progressLabel">Progress</h3>
          <div id="workflowProgress">
            <div id="workflowProgressBar"></div>
          </div>
          <div id="bookingTasks">Loading...</div>
        </div>
        <div class="background">
          <h3>Staff Scheduled During This Event</h3>
          <div id="bookingRota">Loading...</div>
        </div>
      </div>
    </section>
  `;
}

export async function bookingAfterRender(currentUser) {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const bookingId = urlParams.get("id");
  if (!bookingId) return;

  const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: bookingId }))[0];
  if (!booking) return;

  // --- Banner Image Elements ---
  const headerDiv = document.getElementById("bookingHeaderImage");
  let imgEl = document.getElementById("bookingBannerImage");

  let fileInput = document.getElementById("bookingImageInput");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "bookingImageInput";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    headerDiv.appendChild(fileInput);
  }

  headerDiv.style.cursor = "pointer";
  headerDiv.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const filePath = booking.id;

    try {
      const { data: existingFiles, error: listError } = await supabase
        .storage
        .from("bookingImages")
        .list("", { limit: 1000 });

      if (!listError) {
        const toDelete = existingFiles.filter(f => f.name === filePath).map(f => f.name);
        if (toDelete.length) {
          await supabase.storage.from("bookingImages").remove(toDelete);
        }
      }

      const publicURL = await uploadFile(file, "bookingImages", filePath);
      imgEl.src = publicURL;
      showSystemMessage("Image uploaded successfully", "success");
    } catch (err) {
      showSystemMessage("Upload Failed: " + err.message, "alert");
    }
  });

  // --- Load existing banner image ---
  async function loadBannerImage() {
    const { data, error } = await supabase.storage.from("bookingImages").download(booking.id);
    if (!error && data) {
      const url = URL.createObjectURL(data);
      imgEl.src = url;
    } else {
      imgEl.src = "";
    }
  }
  await loadBannerImage();

  // --- Basic Info ---
  document.getElementById("bookingName").textContent = booking.name;
  document.getElementById("basicName").textContent = booking.name;
  document.getElementById("basicStart").textContent = new Date(booking.startDate).toLocaleDateString("en-GB");
  document.getElementById("basicEnd").textContent = new Date(booking.endDate).toLocaleDateString("en-GB");
  document.getElementById("bookingDates").textContent = `${new Date(booking.startDate).toLocaleDateString("en-GB")} - ${new Date(booking.endDate).toLocaleDateString("en-GB")}`;
  document.getElementById("notes").textContent = booking.notes || "None";

  // --- Delete Booking Button ---
  if (!document.getElementById("deleteBookingBtn")) {
    const deleteBtn = document.createElement("button");
    deleteBtn.id = "deleteBookingBtn";
    deleteBtn.textContent = "   🗑";
    deleteBtn.className = "deleteMarker";

    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete this booking? This cannot be undone.")) return;
      try {
        const tables = ["requirementsFormResponses","agreements","invoicesAndQuotes"];
        for (const table of tables) await remove(table, { column: "bId", operator: "eq", value: booking.id });
        await remove("bookings", { column: "id", operator: "eq", value: booking.id });
        await remove("bookingWorkflowCompletion", { column: "bookingId", operator: "eq", value: booking.id });
        showSystemMessage("Booking Deleted", "success");
        window.location.href = "#/bookings";
      } catch (err) {
        showSystemMessage("Failed to delete booking: " + err.message, "alert");
      }
    });

    document.getElementById("bookingName").append(deleteBtn);
  }

  // --- Invoice Link ---
  document.getElementById("invoiceLink").innerHTML = `<a href="#/invoice-and-quote?bid=${booking.id}">Invoice</a>`;

  // --- Requirements / Rooms ---
  (async () => {
    const reqResponses = await select("requirementsFormResponses", "*", { column: "bId", operator: "eq", value: bookingId });
    const roomsContainer = document.getElementById("roomsBookedContainer");
    const formLink = `requirements-form?bid=${booking.id}`;

    if (!roomsContainer) return;

    if (reqResponses && reqResponses.length > 0) {
      let responseData = reqResponses[0].response;
      if (typeof responseData === "string") {
        try { responseData = JSON.parse(responseData); } 
        catch { showSystemMessage("Failed to parse room response data", "alert"); responseData = []; }
      }

      const roomIdsSelected = Array.isArray(responseData)
        ? responseData.filter(r => r.response).map(r => r.roomId)
        : [];

      if (roomIdsSelected.length > 0) {
        const rooms = await select("rooms", "*", { column: "oId", operator: "eq", value: booking.oId });
        const roomNames = rooms
          .filter(r => roomIdsSelected.includes(r.id))
          .map(r => r.room);

        roomsContainer.innerHTML = `<p>${roomNames.join(", ")}</p>`;
      } else {
        roomsContainer.innerHTML = `
          <a href="#/${formLink}">Visit Requirements Form</a>
          <button class="outlineButton" onclick="navigator.clipboard.writeText('${location.origin}/#/${formLink}')">Copy Link</button>`;
      }
    } else {
      roomsContainer.innerHTML = `
        <a href="#/${formLink}">Visit Requirements Form</a>
        <button class="outlineButton" onclick="navigator.clipboard.writeText('${location.origin}/#/${formLink}')">Copy Link</button>`;
    }
  })();

  // --- Recurrence ---
  let rec = {};
  try { rec = typeof booking.recurrence === 'string' ? JSON.parse(booking.recurrence) : booking.recurrence || {}; } catch { rec = {}; }
  if (rec.basis) document.getElementById("basicRecurrence").textContent = `${rec.basis}${rec.days?.length ? ": " + rec.days.join(', ') : ""}`;

  // --- Client Info ---
  const clientBlock = document.getElementById("clientInfoContainer");
  const clients = await select("clients", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
  const selectedClient = clients.find(c => c.id === booking.clientId);

  if (!selectedClient) {
    clientBlock.innerHTML = `<div class="alert">Please set a client to proceed with this booking</div>
      <select id="clientSelect" class="dropdown">
        <option value="">-- Select client --</option>
        <option value="create">➕ Create New Client</option>
        ${clients.map(c => `<option value="${c.id}">${c.companyName} (${c.forename} ${c.surname})</option>`).join('') }
      </select>`;
    document.getElementById("clientSelect").addEventListener("change", async (e) => {
      const val = e.target.value;
      if (val === "create") {
        showInsertPopup({ tableName: "clients", columns: ["forename","surname","email","phone","companyName"], friendlyNames:["Forename","Surname","Email","Phone","Company"], extraInsertFields:{ oId: currentUser.organisationId }});
      } else if (val) {
        await update("bookings", { clientId: val }, { column: "id", operator: "eq", value: bookingId });
        const workflow = await select("bookingWorkflows", "*", { column: "oId", operator: "eq", value: currentUser.organisationId });
        workflow.sort((a,b) => (a.stageNumber || 0) - (b.stageNumber || 0));
        const completions = await select("bookingWorkflowCompletion", "*", { column: "bookingId", operator: "eq", value: bookingId });
        const reqStage = workflow.find(s => s.actionType === "Booking Requirements");
        if (reqStage && !completions.find(c => c.stageId === reqStage.id)) {
          try { await completeStage(bookingId, reqStage.id); } 
          catch { showSystemMessage("Error Starting Workflow", "alert"); }
        }
        bookingAfterRender(currentUser);
      }
    });
    return;
  } else {
    clientBlock.innerHTML = `<table class="static">
        <tr><td><h4>Name</h4></td><td><p>${selectedClient.forename} ${selectedClient.surname}</p></td></tr>
        <tr><td><h4>Email</h4></td><td><p>${selectedClient.email || "-"}</p></td></tr>
        <tr><td><h4>Phone Number</h4></td><td><p>${selectedClient.phone || "-"}</p></td></tr>
        <tr><td><h4>Company</h4></td><td><p>${selectedClient.companyName || "-"}</p></td></tr>
      </table>`;
  }

  // --- Workflow / Tasks ---
  const workflowRaw = await select("bookingWorkflows", "*", { column: "oId", operator: "eq", value: booking.oId });
  workflowRaw.sort((a, b) => Number(a.stageNumber) - Number(b.stageNumber));

  const tasksContainer = document.getElementById("bookingTasks");
  const completions = await select("bookingWorkflowCompletion", "*", { column: "bookingId", operator: "eq", value: bookingId });
  tasksContainer.innerHTML = "";

  const stages = workflowRaw.map(w => ({ id: w.id, name: w.actionType }));

  let currentStageFound = false;
  let completedCount = 0;

  for (const stage of stages) {
    let status = "upcoming";
    const completedRecord = completions.find(c => c.stageId === stage.id);

    if (completedRecord) {
      status = "completed";
      completedCount++;
    } else if (!currentStageFound) {
      status = "current";
      currentStageFound = true;
    }

    const stageDiv = document.createElement("div");
    stageDiv.className = `workflowStage ${status}`;

    if (status === "completed") {
      stageDiv.style.backgroundColor = "#d4edda";
      stageDiv.style.borderLeft = "5px solid #28a745";
    } else if (status === "current") {
      stageDiv.style.backgroundColor = "#fff3cd";
      stageDiv.style.borderLeft = "5px solid #ffc107";
    } else {
      stageDiv.style.backgroundColor = "#f8d7da";
      stageDiv.style.borderLeft = "5px solid #dc3545";
    }

    const stageText = document.createElement("span");
    stageText.textContent = `${stage.name}`;
    stageDiv.appendChild(stageText);

    const btnContainer = document.createElement("div");

    if (status === "current") {
      const completeBtn = document.createElement("button");
      completeBtn.className = "primaryButton";
      completeBtn.textContent = "Mark as Complete";
      completeBtn.addEventListener("click", async () => {
        completeBtn.disabled = true;
        try {
          await completeStage(bookingId, stage.id);
          bookingAfterRender(currentUser);
        } catch { showSystemMessage("Error completing stage", "alert"); completeBtn.disabled = false; }
      });
      btnContainer.appendChild(completeBtn);
    }

    if (status === "completed") {
      const retryBtn = document.createElement("button");
      retryBtn.className = "outlineButton";
      retryBtn.textContent = "Try Again";
      retryBtn.addEventListener("click", async () => {
        retryBtn.disabled = true;
        try {
          await completeStage(bookingId, stage.id);
          bookingAfterRender(currentUser);
        } catch { showSystemMessage("Error retrying stage", "alert"); retryBtn.disabled = false; }
      });
      btnContainer.appendChild(retryBtn);
    }

    stageDiv.appendChild(btnContainer);
    tasksContainer.appendChild(stageDiv);
  }

  // Update progress bar
  const progressPercent = Math.round((completedCount / stages.length) * 100);
  document.getElementById("workflowProgressBar").style.width = `${progressPercent}%`;
  document.getElementById("progressLabel").innerHTML = `Progress ${progressPercent}%`;

  // --- Timings display and edit ---
  const timingsTable = document.getElementById("timingsTable");
  timingsTable.innerHTML = "";
  let timingsData = {};
  try { timingsData = typeof booking.timings === "string" ? JSON.parse(booking.timings) : booking.timings || {}; } catch { timingsData={}; }

  if (booking.recurrence) {
    let rec = typeof booking.recurrence === "string" ? JSON.parse(booking.recurrence) : booking.recurrence;
    if (rec.basis === "Weekly" && rec.days?.length) {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      const dayMap = { Mo:1, Tu:2, We:3, Th:4, Fr:5, Sa:6, Su:0 };
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        const dayAbbr = Object.keys(dayMap).find(k=>dayMap[k]===d.getDay());
        if (rec.days.includes(dayAbbr)) {
          const dateStr = d.toISOString().split("T")[0];
          if (!timingsData[dateStr]) timingsData[dateStr] = { start: "09:00", end: "17:00" };
        }
      }
    }
  }

  if (Object.keys(timingsData).length === 0) timingsTable.innerHTML = "<tr><td>No timings set</td></tr>";
  else {
    timingsTable.innerHTML = ``;
    for (const [date,t] of Object.entries(timingsData)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<div class="card"><h3>${new Date(date).toLocaleDateString("en-GB")}</h3><h4>Start: ${t.start}</h4><h4>End ${t.end}</h4></div>`;
      timingsTable.appendChild(tr);
    }
  }

  document.getElementById("editTimingsBtn").addEventListener("click", () => {
    showUpdatePopup({ tableName:"bookings", id:booking.id, columns:["timings"], friendlyNames:["Timings"]});
  });
  // --- Staff Scheduled During This Event ---
const bookingRotaEl = document.getElementById("bookingRota");
bookingRotaEl.innerHTML = "Loading...";

(async () => {
  // Get all users for this organisation
  const users = await select("users", "*", { column: "organisationId", operator: "eq", value: currentUser.organisationId });

  // Get all rotaAssignments for this organisation
  const assignmentsRaw = await select("rotaAssignments", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId
  });

  const bookingDates = Object.keys(timingsData).sort((a, b) => new Date(a) - new Date(b));

  let rotaHTML = "";

  for (const date of bookingDates) {
    const t = timingsData[date];
    if (!t?.start || !t?.end) continue;

    const [bStartH, bStartM] = t.start.split(":").map(Number);
    const [bEndH, bEndM] = t.end.split(":").map(Number);
    const bookingStart = bStartH * 60 + bStartM;
    const bookingEnd = bEndH * 60 + bEndM;

    const shiftsForDate = assignmentsRaw
      .filter(a => a.date === date)
      .filter(shift => {
        if (!shift.start || !shift.end) return false;
        const [sH, sM] = shift.start.split(":").map(Number);
        const [eH, eM] = shift.end.split(":").map(Number);
        const shiftStart = sH * 60 + sM;
        const shiftEnd = eH * 60 + eM;
        return shiftEnd > bookingStart && shiftStart < bookingEnd; // overlap
      })
      .map(shift => {
        const user = users.find(u => u.id === shift.uId);
        if (!user) return null;
        return {
          name: `${user.forename} ${user.surname}`,
          role: shift.role || "-",
          start: shift.start,
          end: shift.end
        };
      })
      .filter(Boolean);

    rotaHTML += `<h4>${new Date(date).toLocaleDateString("en-GB")}</h4>`;

    if (shiftsForDate.length === 0) {
      rotaHTML += `<p>No staff scheduled for this date.</p>`;
    } else {
      rotaHTML += `<ul>`;
      for (const s of shiftsForDate) {
        rotaHTML += `<li>${s.name} (${s.role}) – ${s.start} to ${s.end}</li>`;
      }
      rotaHTML += `</ul>`;
    }
  }

  bookingRotaEl.innerHTML = rotaHTML || "No staff scheduled for this booking.";
})();

  // --- Form Responses ---
  const formResponsesEl = document.getElementById("formResponses");
  const responses = await select("formResponses", "*", { column: "bId", operator: "eq", value: bookingId });

  if (responses.length > 0) {
    let responseData = responses[0].response;
    if (typeof responseData === "string") {
      try { responseData = JSON.parse(responseData); } catch { responseData = null; }
    }

    if (responseData && typeof responseData === "object") {
      const formRecord = await select("customForms", "*", { column: "id", operator: "eq", value: responses[0].formId });
      const formName = formRecord.length > 0 ? formRecord[0].name : "Form Response";
      let formSchema = [];
      if (formRecord.length > 0) {
        try { formSchema = typeof formRecord[0].content === "string" ? JSON.parse(formRecord[0].content) : formRecord[0].content; } 
        catch { formSchema = []; }
      }

      const fields = Object.entries(responseData).map(([question, answer]) => {
        const schemaField = formSchema.find(f => f.name === question);
        let value = answer;

        if (schemaField && schemaField.type === "rating") {
          const maxRating = schemaField.modifiers?.maxRating || 5;
          const numericAnswer = Number(answer) || 0;
          const filledStars = "⭐".repeat(numericAnswer);
          const emptyStars = "☆".repeat(Math.max(0, maxRating - numericAnswer));
          value = `<span class="stars">${filledStars}${emptyStars}</span> <span class="numeric">(${numericAnswer}/${maxRating})</span>`;
        } else {
          if (typeof value === "boolean") value = value ? "Yes" : "No";
          if (Array.isArray(value)) value = value.join(", ");
        }

        return `
          <div class="responseField">
            <label><strong>${question}</strong></label>
            <p>${value ?? "No response"}</p>
          </div>
        `;
      });

      formResponsesEl.innerHTML = `
        <div class="formResponseCard">
          <h3>Form: ${formName}</h3>
          <div class="responseFields">
            ${fields.join("")}
          </div>
        </div>
      `;
    } else {
      formResponsesEl.textContent = "No form responses yet.";
    }
  } else {
    formResponsesEl.textContent = "No form responses yet.";
  }
}
