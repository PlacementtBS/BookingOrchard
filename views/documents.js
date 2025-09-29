import { select } from "../js/db.js";
export default function documentsPage() {
    
  return `
    <section class="fullHeight">
      <div class="cardGallery" id="forms">
        <p>Loading bookings...</p>
      </div>
    </section>
  `;
}

// Call this AFTER rendering to the DOM
export async function loadDocuments(currentUser) {
  const container = document.getElementById("forms");
  if (!container) return;
    

  container.innerHTML = ""; // Clear loading message

  const forms = await select("documents", "*", {
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

  // ✅ Format date nicely
  const createdDate = new Date(f.created_at).toLocaleDateString("en-GB", {
    weekday: "short", // "Mon"
    day: "2-digit",   // "25"
    month: "short",   // "Sep"
    year: "numeric"   // "2025"
  });

  card.innerHTML = `
    <div>
      <h4>${f.name}</h4>
      <a href="#/document-builder?id=${f.id}">
      <button class="primaryButton">Edit</button>
    </a>
    <a href="#/document?id=${f.id}" target="_blank">
      <button class="outlineButton">View</button>
    </a>
      <hr>
      <p>Created</p>
      <p>${createdDate}</p>
    </div>
    
  `;

  container.appendChild(card);
}
}
