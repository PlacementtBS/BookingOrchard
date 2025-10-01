import { select, insert, update } from "../js/db.js";
import { sendEmail } from "../js/email.js";
import { completeStage } from "../js/bookingWorkflowActions.js";

export default async function customFormHTML() {
  const query = location.hash.includes("?") ? location.hash.split("?")[1] : "";
  const urlParams = new URLSearchParams(query);
  const bookingId = urlParams.get("bid");

  if (!bookingId) return `<div><h1>Error 404: This form cannot be reached</h1></div>`;

  const [existingResponse] = await select("requirementsFormResponses", "*", {
    column: "bId",
    operator: "eq",
    value: bookingId,
  });

  if (existingResponse) {
    return `
      <div>
        <h1>A submission has already been received</h1>
        <h2>If you believe this is incorrect please contact <a href="mailto:ben@bookingorchard.com">Support</a></h2>
      </div>`;
  }

  const [booking] = await select("bookings", "*", { column: "id", operator: "eq", value: bookingId });
  if (!booking) return `<div><h1>Error: Booking not found</h1></div>`;

  const rooms = await select("rooms", "*", { column: "oId", operator: "eq", value: booking.oId });
  const allEquipment = await select("equipment", "*", { column: "oId", operator: "eq", value: booking.oId });
  const [org] = await select("organisations", "*", { column: "id", operator: "eq", value: booking.oId });

  // --- Room / equipment checkboxes ---
  const roomHtmlArray = rooms.map(r => {
    const roomCheckbox = `
      <div>
        <label>
          <input type="checkbox" name="room_${r.id}" data-room-id="${r.id}" />
          Hire ${r.room}
        </label>
      </div>
    `;
    const roomEquipment = allEquipment.filter(e => e.rId === r.id);
    const equipHtml = roomEquipment.map(e => `
      <div style="margin-left:20px;">
        <label>
          <input type="checkbox" name="equip_${e.id}" data-room-id="${r.id}" data-equip-id="${e.id}" />
          Hire ${e.name} for ${r.room}
        </label>
      </div>
    `).join("");

    return roomCheckbox + equipHtml;
  });

  // --- Timing inputs for single/recurring patterns ---
  let timingFields = "";
  if (!booking.recurrence || booking.recurrence?.basis === "SingleDates") {
    timingFields = booking.recurrence?.dates.map(date => `
      <div class="dateRow">
        <label>${new Date(date).toLocaleDateString()}</label>
        <input type="time" name="start_${date}" required />
        <span>to</span>
        <input type="time" name="end_${date}" required />
      </div>
    `).join("");
  } else if (booking.recurrence.basis === "Weekly") {
    timingFields = booking.recurrence.days.map(day => `
      <div class="dayRow">
        <label>${day}</label>
        <input type="time" name="start_${day}" required />
        <span>to</span>
        <input type="time" name="end_${day}" required />
      </div>
    `).join("");
  } else if (booking.recurrence.basis === "Monthly") {
    timingFields = `
      <div class="monthRow">
        <label>${booking.recurrence.week} ${booking.recurrence.day}</label>
        <input type="time" name="start_monthly" required />
        <span>to</span>
        <input type="time" name="end_monthly" required />
      </div>
    `;
  }

  return `
    <div>
      <h1>Requirements Form</h1>
      <p>Please fill out this requirements form for your upcoming booking with ${org?.name || "an organisation using BookingOrchard"}.</p>
      <form id="renderedForm">
        ${roomHtmlArray.join("")}

        <h3>Set Timings</h3>
        <p>Provide timings for each date or recurring day/week pattern:</p>
        <div id="timingsContainer">
          ${timingFields}
        </div>

        <div>
          <button type="submit" class="primaryButton">Submit</button>
        </div>
      </form>
    </div>
  `;
}

export async function requirementsFormAfterRender() {
  const form = document.getElementById("renderedForm");
  if (!form) return;

  const query = location.hash.includes("?") ? location.hash.split("?")[1] : "";
  const urlParams = new URLSearchParams(query);
  const bookingId = urlParams.get("bid");
  if (!bookingId) return;

  const [booking] = await select("bookings", "*", { column: "id", operator: "eq", value: bookingId });
  if (!booking) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // --- Rooms and equipment ---
    const response = [];
    const roomInputs = [...form.querySelectorAll("input[data-room-id]")];
    const roomIds = [...new Set(roomInputs.map(el => el.dataset.roomId).filter(Boolean))];

    for (const roomId of roomIds) {
      const roomCheckbox = form.querySelector(`input[name="room_${roomId}"]`);
      const roomResponse = roomCheckbox ? roomCheckbox.checked : false;

      const equipCheckboxes = form.querySelectorAll(`input[data-room-id="${roomId}"][data-equip-id]`);
      const equipment = [...equipCheckboxes].map(el => ({
        equipmentId: el.dataset.equipId,
        response: el.checked
      }));

      response.push({
        roomId,
        response: roomResponse,
        equipment,
      });
    }

    // --- Timings ---
    let timings = {};

    if (!booking.recurrence || booking.recurrence?.basis === "SingleDates") {
      booking.recurrence?.dates.forEach(date => {
        const start = form.querySelector(`input[name="start_${date}"]`)?.value;
        const end = form.querySelector(`input[name="end_${date}"]`)?.value;
        timings[date] = { start, end };
      });
    } else if (booking.recurrence.basis === "Weekly") {
      const dayTimes = {};
      booking.recurrence.days.forEach(day => {
        const start = form.querySelector(`input[name="start_${day}"]`)?.value;
        const end = form.querySelector(`input[name="end_${day}"]`)?.value;
        dayTimes[day] = { start, end };
      });

      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      const current = new Date(start);

      while (current <= end) {
        const dayName = ["Su","Mo","Tu","We","Th","Fr","Sa"][current.getDay()];
        if (dayTimes[dayName]) {
          timings[current.toISOString().split("T")[0]] = dayTimes[dayName];
        }
        current.setDate(current.getDate() + 1);
      }
    } else if (booking.recurrence.basis === "Monthly") {
      const patternStart = form.querySelector(`input[name="start_monthly"]`)?.value;
      const patternEnd = form.querySelector(`input[name="end_monthly"]`)?.value;

      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      const current = new Date(start);

      while (current <= end) {
        const d = new Date(current);
        const nth = Math.ceil(d.getDate() / 7);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const dayName = ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()];

        if (dayName === booking.recurrence.day &&
            (booking.recurrence.week === "last" ? d.getDate() > last.getDate() - 7 : nth == booking.recurrence.week)) {
          timings[d.toISOString().split("T")[0]] = { start: patternStart, end: patternEnd };
        }
        current.setDate(current.getDate() + 1);
      }
    }

    try {
      // Save timings in bookings
      await update(
        "bookings",
        { timings: JSON.stringify(timings) },
        { column: "id", operator: "eq", value: bookingId }
      );

      // Save form response
      await insert("requirementsFormResponses", { 
        bId: bookingId, 
        response,
      });

      form.innerHTML = `<h2>Thank you for your submission</h2>`;

      // Trigger workflow stage completion properly
      const workflowStages = await select("bookingWorkflows", "*", {
        column: "oId",
        operator: "eq",
        value: booking.oId,
      });

      const reqStage = workflowStages.find(s => s.actionType === "Booking Requirements Form");
      if (reqStage) {
        await completeStage(bookingId, reqStage.id, { response });
      }

      // Send email to client if exists
      if (booking.clientId) {
        const [client] = await select("clients", "*", { column: "id", operator: "eq", value: booking.clientId });
        if (client?.email) {
          await sendEmail({
            to: client.email,
            subject: `Your Requirements Form for ${booking.name}`,
            message: `Hi ${client.forename},</br>Thank you for completing the requirements form for <strong>${booking.name}</strong>. Your response has been sent to the organisation.`,
            forename: client.forename,
            surname: client.surname,
          });
        }
      }

    } catch (err) {
      console.error("Failed to submit form", err);
      alert("Failed to submit form");
    }
  });
}
