import { select, update, insert } from "../js/db.js";

export default function formBuilderPage() {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const id = urlParams.get("id");
  return `
    <section class="fullHeight">
      <div id="formBuilderContainer"></div>
      <div id="formBuilderPreview"></div>
    </section>
  `;
}

export async function loadFormBuilderPage(currentUser) {

  /**
   * Make a rating input interactive (connects number input + clickable stars).
   * containerEl is the container DOM element that contains .starRow and .ratingNumber
   */
  function makeInteractiveRating(containerEl, max = 5) {
    const starRow = containerEl.querySelector('.starRow');
    const numberInput = containerEl.querySelector('.ratingNumber');

    function draw(value) {
      starRow.innerHTML = '';
      const val = Math.max(0, Math.min(max, Number(value) || 0));
      for (let i = 1; i <= max; i++) {
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'starBtn';
        star.dataset.value = i;
        star.setAttribute('aria-label', `Set rating to ${i}`);
        if (i <= Math.floor(val)) {
          star.innerHTML = '★';
          star.classList.add('filled');
        } else if (i === Math.floor(val) + 1 && val % 1 >= 0.5) {
          star.innerHTML = '⯨';
          star.classList.add('half');
        } else {
          star.innerHTML = '☆';
        }
        star.addEventListener('click', () => {
          const clickedValue = Number(star.dataset.value);
          numberInput.value = clickedValue;
          draw(clickedValue);
        });
        starRow.appendChild(star);
      }
    }

    // sync from number input
    numberInput.addEventListener('input', () => draw(numberInput.value));
    draw(numberInput.value);
  }

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

      location.hash = `#/forms/create?id=${result.id}`;
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
        fieldDiv.className = `formFieldRow`
        fieldDiv.innerHTML = `
          <section>
            <div><label>${index+1}</label>
            <input type="text" value="${field.name}" data-index="${index}" class="field-name" placeholder="Name (used in answers)" />
            </div>
          </section>
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

        fieldDiv.innerHTML += `<br/><button class="deleteMarker" data-index="${index}" data-action="remove">🗑</button>`;

        fieldsContainer.appendChild(fieldDiv);

        // RIGHT SIDE — preview
        const rightDiv = document.createElement("div");
        rightDiv.style.marginBottom = "15px";
        rightDiv.innerHTML = `${renderPreview(field)}`;
        container2.appendChild(rightDiv);
      });

      // Make rating previews interactive
      container2.querySelectorAll('.ratingInput').forEach(el => makeInteractiveRating(el, Number(el.querySelector('.ratingNumber').max) || 5));

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
          <div class="ratingInput">
            <div class="starRow"></div>
            <input type="number" min="1" max="10" class="modifier-input ratingNumber" data-index="${index}" data-modkey="maxRating" value="${field.modifiers.maxRating || 5}" />
          </div>`;
        case "checkbox":
          return `<div>
            <label>Checkbox Label:</label><br/>
            <input type="text" class="modifier-input" data-index="${index}" data-modkey="checkboxLabel" value="${field.modifiers.checkboxLabel || field.name}" />
          </div>`;
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
          return `<label for="${name}">${field.name}</label><br><input type="number" id="${name}" placeholder="${name}" />`;
        case "checkbox":
          return `<label><input type="checkbox" />${field.modifiers.checkboxLabel || name}</label>`;
        case "dropdown":
          const opts = (field.modifiers.options || []).map(opt => `<option>${opt}</option>`).join("");
          return `<label for="${name}">${field.name}</label><br><select id="${name}"><option value="">Select...</option>${opts}</select>`;
        case "rating":
          const max = field.modifiers.maxRating || 5;
          return `<label for="${name}">${field.name}</label><br>
            <div class="ratingInput" id="preview-${name}">
              <div class="starRow"></div>
              <input type="number" class="ratingNumber" value="${Math.ceil(max/2)}" min="1" max="${max}" style="display:none;" />
            </div>`;
        default:
          return `<input type="text" placeholder="${name}" />`;
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
