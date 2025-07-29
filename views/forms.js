import { select } from "../js/db.js";
export default function formsPage() {
  return `
    <section>
    <div>
    <h1>Forms</h1>
    <a href="#/create-form"><button class="primaryButton">New</button></a>
    </div>
    </section>
    <section>
      <div class="cardContainer" id="forms">
        <p>Loading bookings...</p>
      </div>
    </section>
  `;
}

// Call this AFTER rendering to the DOM
export async function loadForms(currentUser) {
  const container = document.getElementById("forms");
  if (!container) return;

  container.innerHTML = ""; // Clear loading message

  const forms = await select("customForms", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId
  });

  if (!forms.length) {
    container.innerHTML = "<p>No forms found.</p>";
    return;
  }

  forms.forEach(f => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div>
        <h4>Name</h4>
        <p>${f.name}</p>
      </div>
      <a href="#/create-form?id=${f.id}"><button class="primaryButton">Edit</button></a>
      <a href="#/form?id=${f.id}" target="_blank"><button class="outlineButton">View</button></a>
    `;
    container.appendChild(card);
  });
}
