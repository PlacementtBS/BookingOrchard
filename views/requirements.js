import { select, insert } from "../js/db.js";

export default async function customFormHTML() {
  const query = location.hash.includes("?") ? location.hash.split("?")[1] : "";
  const urlParams = new URLSearchParams(query);
  const booking = urlParams.get("bid");

  if (!booking) {
    return `<div><h1>Error 404: This form cannot be reached</h1></div>`;
  }

  const [existingResponse] = await select("requirementsFormResponses", "*", {
    column: "bId",
    operator: "eq",
    value: booking,
  });

  if (existingResponse) {
    return `
      <div>
        <h1>A submission has already been received</h1>
        <h2>If you believe this is incorrect please contact <a href="mailto:ben@bookingorchard.com">Support</a></h2>
      </div>`;
  }

  // Get booking record (needed for oId and org info)
  const [form] = await select("bookings", "*", {
    column: "id",
    operator: "eq",
    value: booking,
  });

  if (!form) {
    return `<div><h1>Error: Booking not found</h1></div>`;
  }

  const rooms = await select("rooms", "*", {
    column: "oId",
    operator: "eq",
    value: form.oId,
  });

  const allEquipment = await select("equipment", "*", {
    column: "oId",
    operator: "eq",
    value: form.oId,
  });

  const [org] = await select("organisations", "*", {
    column: "id",
    operator: "eq",
    value: form.oId,
  });

  const qArray = rooms.map((r, i) => {
    // Build room question (include roomId in name for easier parsing later)
    let roomHtml = `
      <div>
        <label>
          <input type="checkbox" id="room_${r.id}" name="room_${r.id}" data-room-id="${r.id}" />
          Check the box to hire ${r.room}
        </label>
      </div>
    `;

    // Filter equipment by rId = room.id
    const roomEquipment = allEquipment.filter(e => e.rId === r.id);

    // Build equipment subquestions
    let eqHtml = roomEquipment
      .map(
        e => `
        <div style="margin-left:20px;">
          <label>
            <input type="checkbox" id="equip_${e.id}" name="equip_${e.id}" data-room-id="${r.id}" data-equip-id="${e.id}" />
            Hire ${e.name} for ${r.room}
          </label>
        </div>
      `
      )
      .join("");

    return roomHtml + eqHtml;
  });

  return `
    <div>
      <h1>Requirements Form</h1>
      <p>Please fill out this requirements form for your upcoming booking with ${
        org?.name || "an organisation using BookingOrchard"
      }.</p>
      <form id="renderedForm">
        ${qArray.join("")}
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = location.hash.includes("?") ? location.hash.split("?")[1] : "";
    const urlParams = new URLSearchParams(query);
    const formId = "00000000-0000-4000-8000-000000000001";
    const booking = urlParams.get("bid");

    if (!formId || !booking) {
      form.innerHTML = `<h2>Invalid link</h2>`;
      return;
    }

    // Build structured response
    const response = [];
    const roomInputs = [...form.querySelectorAll("input[data-room-id]")];

    // Get unique rooms from data-room-id attributes
    const roomIds = [...new Set(roomInputs.map(el => el.dataset.roomId))];

    for (const roomId of roomIds) {
      // room checkbox
      const roomCheckbox = form.querySelector(`input[name="room_${roomId}"]`);
      const roomResponse = roomCheckbox ? roomCheckbox.checked : false;

      // equipment for this room
      const equipCheckboxes = form.querySelectorAll(
        `input[data-room-id="${roomId}"][data-equip-id]`
      );

      const equipment = [...equipCheckboxes].map(el => ({
        equipmentId: el.dataset.equipId,
        response: el.checked,
      }));

      response.push({
        roomId,
        response: roomResponse,
        equipment,
      });
    }

    try {
      await insert("requirementsFormResponses", {
        bId: booking,
        response,
      });

      form.innerHTML = `<h2>Thank you for your submission</h2>`;
    } catch (err) {
      console.error("Failed to submit form", err);
      alert("Failed to submit form");
    }
  });
}
