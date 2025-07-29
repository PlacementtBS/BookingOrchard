import { select } from "../js/db.js";

export async function renderFormById() {
  const query = location.hash.includes('?') ? location.hash.split('?')[1] : "";
  const urlParams = new URLSearchParams(query);
  const formId = urlParams.get("id");
  if (!formId) return `<p>No form ID provided.</p>`;

  const rows = await select("customForms", "*", {
    column: "id",
    operator: "eq",
    value: formId,
  });

  if (!rows.length) {
    return `<p>Form not found for ID ${formId}</p>`;
  }

  const form = rows[0];
  const schema = Array.isArray(form.content) ? form.content : [];

  const orgRows = await select("organisations", "*", {
    column: "id",
    operator: "eq",
    value: form.oId
  });
  const org = orgRows[0]; // ✅ safe access to org.name

  const fieldsHTML = schema
    .map((field, i) => {
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
    })
    .join("\n");

  return `
    <div>
      <h1>${form.name}</h1>
      <p>You have been requested to complete this form by ${org?.name || "An organisation using BookingOrchard to manage their venue"}.</p>
      <form id="renderedForm">
        ${fieldsHTML}
        <div>
          <button type="submit" class="primaryButton">Submit</button>
        </div>
      </form>
    </div>
  `;
}
