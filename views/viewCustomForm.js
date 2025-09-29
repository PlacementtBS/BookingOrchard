import { select, insert } from "../js/db.js";
import { completeStage } from "../js/bookingWorkflowActions.js";

/** Helper to turn a number input into interactive stars */
function makeInteractiveRating(containerEl, max = 5) {
  const starRow = document.createElement("div");
  starRow.className = "starRow";
  const numberInput = containerEl.querySelector("input[type='number']");
  containerEl.insertBefore(starRow, numberInput);
  numberInput.style.display = "none"; // hide original number input

  function draw(value) {
    starRow.innerHTML = "";
    const val = Math.max(0, Math.min(max, Number(value) || 0));
    for (let i = 1; i <= max; i++) {
      const star = document.createElement("button");
      star.type = "button";
      star.className = "starBtn";
      star.dataset.value = i;
      star.setAttribute("aria-label", `Set rating to ${i}`);
      star.style.border = "none";
      star.style.background = "transparent";
      star.style.fontSize = "1.5em";
      star.style.cursor = "pointer";
      star.innerHTML = i <= val ? "★" : "☆";
      star.addEventListener("click", () => {
        numberInput.value = i;
        draw(i);
      });
      starRow.appendChild(star);
    }
  }

  draw(numberInput.value);
}

export default async function customFormHTML() {
  const query = location.hash.includes("?") ? location.hash.split("?")[1] : "";
  const urlParams = new URLSearchParams(query);
  const formId = urlParams.get("id");
  const bookingId = urlParams.get("bId");

  if (!formId || !bookingId) {
    return `<div><h1>Error 404: This form cannot be reached</h1></div>`;
  }

  const bookings = await select("bookings", "*") || [];
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return `<h2>Invalid booking</h2>`;

  const existingResponses = await select("formResponses", "*") || [];
  const existingResponse = existingResponses.find(r => r.formId === formId && r.bId === bookingId);
  if (existingResponse) {
    return `<div>
      <h1>A submission has already been received</h1>
      <h2>If you believe this is incorrect please contact <a href="mailto:ben@bookingorchard.com">Support</a></h2>
    </div>`;
  }

  const forms = await select("customForms", "*") || [];
  const form = forms.find(f => f.id === formId);
  if (!form) return `<h2>Invalid link</h2>`;
  const schema = Array.isArray(form.content) ? form.content : [];

  const orgs = await select("organisations", "*") || [];
  const org = orgs.find(o => o.id === booking.oId);

  const fieldsHTML = schema.map((field, i) => {
    const name = field.name || `field_${i + 1}`;
    const mods = field.modifiers || {};
    switch (field.type) {
      case "text":
      case "number":
        return `<div><label for="field_${i}">${name}</label><input type="${field.type}" id="field_${i}" name="${name}" /></div>`;
      case "checkbox":
        return `<div><label><input type="checkbox" id="field_${i}" name="${name}" />${mods.checkboxLabel || name}</label></div>`;
      case "dropdown":
        const options = Array.isArray(mods.options) ? mods.options : [];
        return `<div><label for="field_${i}">${name}</label><select id="field_${i}" name="${name}"><option value="">Select...</option>${options.map(opt => `<option value="${opt}">${opt}</option>`).join("")}</select></div>`;
      case "rating":
        const maxRating = mods.maxRating || 5;
        return `<div class="ratingInput" data-max="${maxRating}"><label for="field_${i}">${name}</label><input type="number" id="field_${i}" name="${name}" min="1" max="${maxRating}" value="${Math.ceil(maxRating/2)}" /></div>`;
      default:
        return `<div><label for="field_${i}">${name}</label><input type="text" id="field_${i}" name="${name}" /></div>`;
    }
  }).join("\n");

  return `
    <div>
      <h1>${form.name}</h1>
      <p>You have been requested to complete this form by ${org?.name || "an organisation using BookingOrchard"}.</p>
      <form id="renderedForm">${fieldsHTML}<div><button type="submit" class="primaryButton">Submit</button></div></form>
    </div>
  `;
}

export async function customFormAfterRender() {
  // Turn all rating number inputs into interactive stars
  document.querySelectorAll(".ratingInput").forEach(container => {
    const max = Number(container.dataset.max) || 5;
    makeInteractiveRating(container, max);
  });

  const form = document.getElementById("renderedForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = location.hash.includes("?") ? location.hash.split("?")[1] : "";
    const urlParams = new URLSearchParams(query);
    const formId = urlParams.get("id");
    const bookingId = urlParams.get("bId");

    if (!formId || !bookingId) {
      form.innerHTML = `<h2>Invalid link</h2>`;
      return;
    }

    const response = {};
    for (const element of form.elements) {
      if (!element.name) continue;
      response[element.name] = element.type === "checkbox" ? element.checked : element.value;
    }

    try {
      await insert("formResponses", { formId, bId: bookingId, response });

      const bookings = await select("bookings", "*") || [];
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) throw new Error("Booking not found");

      const workflow = await select("bookingWorkflows", "*", { column: "oId", operator: "eq", value: booking.oId }) || [];
      const stage = workflow.find(w => w.actionType === "Custom Form");
      if (stage) {
        await completeStage(bookingId, stage.id, { formId, oId: booking.oId });
      }

      form.innerHTML = `<h2>Thank you for your submission</h2>`;
    } catch (err) {
      console.error("Failed to submit form", err);
      alert("Failed to submit form");
    }
  });
}
