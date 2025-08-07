import { select, insert } from "../js/db.js";

export default async function customFormHTML() {
  const query = location.hash.includes('?') ? location.hash.split('?')[1] : "";
  const urlParams = new URLSearchParams(query);
  const formId = urlParams.get("id");
  const booking = urlParams.get("bid");

  if (!formId || !booking) {
    return `<div><h1>Error 404: This form cannot be reached</h1></div>`;
  }

  const [existingResponse] = await select("formResponses", "*", {
    column: "formId",
    operator: "eq",
    value: formId,
  }, {
    and: [
      { column: "bId", operator: "eq", value: booking }
    ]
  });

  if (existingResponse) {
    return `<div><h1>A submission has already been received</h1><h2>If you believe this is incorrect please contact <a href="mailto:ben@bookingorchard.com">Support</a></h2></div>`;
  }

  const [form] = await select("customForms", "*", {
    column: "id",
    operator: "eq",
    value: formId,
  });

  if (!form) return `<h2>Invalid link</h2>`;

  const schema = Array.isArray(form.content) ? form.content : [];

  const [org] = await select("organisations", "*", {
    column: "id",
    operator: "eq",
    value: form.oId
  });

  const fieldsHTML = schema.map((field, i) => {
    const name = field.name || `field_${i + 1}`;
    const mods = field.modifiers || {};

    switch (field.type) {
      case "text":
      case "number":
        return `
          <div>
            <label for="field_${i}">${name}</label>
            <input type="${field.type}" id="field_${i}" name="${name}" />
          </div>
        `;
      case "checkbox":
        return `
          <div>
            <label>
              <input type="checkbox" id="field_${i}" name="${name}" />
              ${mods.checkboxLabel || name}
            </label>
          </div>
        `;
      case "dropdown":
        const options = Array.isArray(mods.options) ? mods.options : [];
        return `
          <div>
            <label for="field_${i}">${name}</label>
            <select id="field_${i}" name="${name}">
              <option value="">Select...</option>
              ${options.map(opt => `<option value="${opt}">${opt}</option>`).join("")}
            </select>
          </div>
        `;
      case "rating":
        const maxRating = mods.maxRating || 5;
        return `
          <div>
            <label for="field_${i}">${name}</label>
            <input type="number" id="field_${i}" name="${name}" min="1" max="${maxRating}" />
          </div>
        `;
      default:
        return `
          <div>
            <label for="field_${i}">${name}</label>
            <input type="text" id="field_${i}" name="${name}" />
          </div>
        `;
    }
  }).join("\n");

  return `
    <div>
      <h1>${form.name}</h1>
      <p>You have been requested to complete this form by ${org?.name || "an organisation using BookingOrchard"}.</p>
      <form id="renderedForm">
        ${fieldsHTML}
        <div>
          <button type="submit" class="primaryButton">Submit</button>
        </div>
      </form>
    </div>
  `;
}

export async function customFormAfterRender() {
  const form = document.getElementById('renderedForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const query = location.hash.includes('?') ? location.hash.split('?')[1] : "";
    const urlParams = new URLSearchParams(query);
    const formId = urlParams.get("id");
    const booking = urlParams.get("bid");

    if (!formId || !booking) {
      form.innerHTML = `<h2>Invalid link</h2>`;
      return;
    }

    const response = {};
    for (const element of form.elements) {
      if (!element.name) continue;
      response[element.name] = (element.type === "checkbox") ? element.checked : element.value;
    }

    try {
      await insert("formResponses", {
        formId,
        bId: booking,
        response
      });

      form.innerHTML = `<h2>Thank you for your submission</h2>`;
    } catch (err) {
      console.error("Failed to submit form", err);
      alert("Failed to submit form");
    }
  });
}
