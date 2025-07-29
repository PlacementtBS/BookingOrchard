import { select, update, insert } from "../js/db.js";

export default function formBuilderPage() {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const id = urlParams.get("id");
  return `
    <section>
      
        <div id="formBuilderContainer"></div>
        <div id="formBuilderPreview"></div>
    </section>
  `;
}

export async function loadFormBuilderPage(currentUser) {
  const query = location.hash.includes('?') ? location.hash.split('?')[1] : "";
  const urlParams = new URLSearchParams(query);
  const formId = urlParams.get("id");

  const container = document.getElementById("formBuilderContainer");
  const container2 = document.getElementById("formBuilderPreview");
  container.innerHTML = "";
  container2.innerHTML = "";

  let formTitle = "";
  let schema = [];

  if (!formId) {
    // No ID - create new form UI
    const titleInput = document.createElement("input");
    titleInput.placeholder = "Enter form title...";
    titleInput.style.marginBottom = "10px";
    titleInput.className = "input";

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Create Form";
    submitBtn.className = "primaryButton";

    container.appendChild(titleInput);
    container.appendChild(submitBtn);

    submitBtn.addEventListener("click", async () => {
      formTitle = titleInput.value.trim();
      if (!formTitle) return alert("Please enter a valid title.");

      const result = await insert("customForms", {
        name: formTitle,
        createdBy: currentUser.id,
        oId: currentUser.organisationId,
        content: [] // empty schema initially
      });

      if (!result || !result.id) {
        alert("Failed to create form. Please try again.");
        return;
      }

      location.hash = `#/create-form?id=${result.id}`;
    });

  } else {
    // Load existing form
    const rows = await select("customForms", "*", {
      column: "id",
      operator: "eq",
      value: formId,
    });

    if (!rows.length) {
      container.innerHTML = "<p>Form not found.</p>";
      return;
    }

    const form = rows[0];
    formTitle = form.name;
    schema = form.content || [];

    renderBuilder();
  }

  function renderBuilder() {
    container.innerHTML = `
      <h3>Form Title: ${formTitle}</h3>
      <div id="fieldsContainer"></div>
      <button id="addField" class="outlineButton">Add Field</button>
    `;

    const fieldsContainer = document.getElementById("fieldsContainer");
    const addFieldBtn = document.getElementById("addField");

    const modifiableTypes = ["dropdown", "checkbox", "rating"];

const renderSchema = () => {
  fieldsContainer.innerHTML = "";
  container2.innerHTML = "";

  schema.forEach((field, index) => {
    if (!field.modifiers) field.modifiers = {};

    // LEFT SIDE — create a grouped block for the editable field
    const fieldDiv = document.createElement("section");
    fieldDiv.style.marginBottom = "5px";
    fieldDiv.style.display = `flex`;
    fieldDiv.innerHTML = `
      
        <div><label>Field Name:</label><br>
      <input type="text" value="${field.name}" data-index="${index}" class="field-name" placeholder="Name (used in answers)" /><br/><br/>
      </div>

      <div><label>Field Type:</label><br/>
      <select data-index="${index}" class="field-type">
        <option value="text" ${field.type === "text" ? "selected" : ""}>Text</option>
        <option value="number" ${field.type === "number" ? "selected" : ""}>Number</option>
        <option value="checkbox" ${field.type === "checkbox" ? "selected" : ""}>Checkbox</option>
        <option value="dropdown" ${field.type === "dropdown" ? "selected" : ""}>Dropdown</option>
        <option value="rating" ${field.type === "rating" ? "selected" : ""}>Rating</option>
      </select><br/><br/></div>
    `;

    if (modifiableTypes.includes(field.type)) {
      fieldDiv.innerHTML += renderModifiers(field, index);
    }

    fieldDiv.innerHTML += `<br/><button class="primaryButton" data-index="${index}" data-action="remove">Remove</button>`;

    fieldsContainer.appendChild(fieldDiv);

    // RIGHT SIDE — preview
    const rightDiv = document.createElement("div");
    rightDiv.style.marginBottom = "15px";
    rightDiv.innerHTML = `${renderPreview(field)}`;
    container2.appendChild(rightDiv);
  });

  // Set up all listeners
  fieldsContainer.querySelectorAll(".field-name").forEach(input => {
    input.addEventListener("input", async (e) => {
      const i = +e.target.dataset.index;
      schema[i].name = e.target.value;
      await persistSchema();
    });
  });

  fieldsContainer.querySelectorAll(".field-type").forEach(select => {
    select.addEventListener("change", async (e) => {
      const i = +e.target.dataset.index;
      schema[i].type = e.target.value;
      if (!modifiableTypes.includes(schema[i].type)) {
        schema[i].modifiers = {};
      } else if (!schema[i].modifiers) {
        schema[i].modifiers = {};
      }
      await persistSchema();
      renderSchema();
    });
  });

  fieldsContainer.querySelectorAll("[data-action='remove']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const i = +e.target.dataset.index;
      schema.splice(i, 1);
      await persistSchema();
      renderSchema();
    });
  });

  fieldsContainer.querySelectorAll(".modifier-input").forEach(input => {
    input.addEventListener("input", async (e) => {
      const i = +e.target.dataset.index;
      const modKey = e.target.dataset.modkey;
      const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;

      if (modKey === "options") {
        schema[i].modifiers.options = val.split(",").map(opt => opt.trim()).filter(Boolean);
      } else if (modKey === "maxRating") {
        schema[i].modifiers.maxRating = Math.max(1, parseInt(val) || 5);
      } else if (modKey === "checkboxLabel") {
        schema[i].modifiers.checkboxLabel = val;
      }
      await persistSchema();
    });
  });
};


    function renderModifiers(field, index) {
      switch (field.type) {
        case "dropdown":
          return `
          <div>
            <label>Options (comma separated):</label><br/>
            <input type="text" class="modifier-input" data-index="${index}" data-modkey="options" value="${(field.modifiers.options || []).join(", ")}" placeholder="Option1, Option2, Option3" />
          </div>`;
        case "rating":
          return `
          <div>
            <label>Max Rating (1-10):</label><br/>
            <input type="number" min="1" max="10" class="modifier-input" data-index="${index}" data-modkey="maxRating" value="${field.modifiers.maxRating || 5}" /></div>
          `;
        case "checkbox":
          return `<div>
            <label>Checkbox Label:</label><br/>
            <input type="text" class="modifier-input" data-index="${index}" data-modkey="checkboxLabel" value="${field.modifiers.checkboxLabel || field.name}" /></div>
          `;
        default:
          return "";
      }
    }

    function renderPreview(field) {
      const name = field.name || "(unnamed)";
      switch (field.type) {
        case "text":
          return `<label for="${name}">${field.name}</label><br><input type="text" id="${name}" placeholder="${name}" />`;
        case "number":
          return `<label for="${name}">${field.name}</label><br><input type="number"  id="${name}" placeholder="${name}" />`;
        case "checkbox":
          return `
            <label>
              <input type="checkbox"  />
              ${field.modifiers.checkboxLabel || name}
            </label>
          `;
        case "dropdown":
          const opts = (field.modifiers.options || []).map(opt => `<option>${opt}</option>`).join("");
          return `
          <label for="${name}">${field.name}</label><br>
            <select id="${name}">
              <option value="">Select...</option>
              ${opts}
            </select>
          `;
        case "rating":
          const max = field.modifiers.maxRating || 5;
          return `
          <label for="${name}">${field.name}</label><br>
            <input type="number" id="${name}"  min="1" max="${max}" value="${Math.ceil(max / 2)}" />
            <small>(1 to ${max} stars)</small>
          `;
        default:
          return `<input type="text"  placeholder="${name}" />`;
      }
    }

    addFieldBtn.addEventListener("click", async () => {
      schema.push({ name: "", type: "text", modifiers: {} });
      await persistSchema();
      renderSchema();
    });

    renderSchema();
  }

  async function persistSchema() {
    await update("customForms", { content: schema }, { column: "id", operator: "eq", value: formId });
  }
}
