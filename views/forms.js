import { select } from "../js/db.js";
export default function formsPage() {
    
  return `
    <section>

    </section>
    <section class="fullHeight">
      <div class="cardGallery" id="forms">
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

for (const f of forms) {
  const card = document.createElement("div");
  card.className = "card";

  // ✅ Await user lookup
  const [user] = await select("users", "*", { column: "id", operator: "eq", value: f.createdBy });

  // ✅ Format date nicely
  const createdDate = new Date(f.created_at).toLocaleDateString("en-GB", {
    weekday: "short", // "Mon"
    day: "2-digit",   // "25"
    month: "short",   // "Sep"
    year: "numeric"   // "2025"
  });

  card.innerHTML = `
    <div>
      <h3>${f.name}</h3>
      <a href="#/forms/create?id=${f.id}">
      <button class="primaryButton">Edit</button>
    </a>
    <a href="#/form?id=${f.id}" target="_blank">
      <button class="outlineButton">View</button>
    </a>
      <hr>
      <h4>Created by</h4>
      <p>${user ? user.forename + " " + user.surname : "Unknown"}</p>
      <p>${createdDate}</p>
    </div>
    
  `;

  container.appendChild(card);
}
}
