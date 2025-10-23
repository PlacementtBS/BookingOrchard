import { select, update } from "../js/db.js";
import { supabase } from "../js/supabaseUpload.js";

/* ========================================
   PERMISSIONS CONFIGURATION
======================================== */
const PRODUCTS = {};
PRODUCTS["Basic"] = [
  "Bookings Tab",
  "Manage and Create Forms",
  "Manage and Create Documents",
  "Calendar of Bookings",
  "Manage Rota",
  "Personal Rota",
  "Manage Timeclock",
  "Personal Timeclock",
  "Manage Organisation"
];

const DEFAULT_PERMISSIONS = {};
for (const prod in PRODUCTS) {
  DEFAULT_PERMISSIONS[prod] = [...PRODUCTS[prod]]; 
}

/* ========================================
   USERS PAGE HTML
======================================== */
export function usersPageHtml() {
  return `
    <section>
      <div><h1>Organisation Users</h1></div>
    </section>
    <section>
      <div id="users-container" class="users-grid"></div>
    </section>

    <!-- Popup -->
    <div id="userManagePopup" class="hidden" style="
        position:fixed;
        top:50%;
        left:50%;
        transform:translate(-50%, -50%);
        background:#fff;
        width:60vw;
        height:60vh;
        padding:1rem;
        border-radius:8px;
        box-shadow:0 4px 12px rgba(0,0,0,0.2);
        z-index:1000;
        overflow:auto;
      ">
      <button id="closeUserPopup" style="position:absolute; top:8px; right:8px;">✖</button>
      <div id="userManageContent"></div>
    </div>
    <div id="overlay" class="hidden" style="
        position:fixed;
        top:0;
        left:0;
        width:100%;
        height:100%;
        background:rgba(0,0,0,0.4);
        z-index:900;
      "></div>

    <style>
      .users-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1rem;
        padding: 1rem;
        background:none;
      }
      .user-card-container {
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        padding: 1rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        position: relative;
      }
      .user-card-container img {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: 2px solid #ccc;
        object-fit: cover;
        margin-bottom: 0.5rem;
        cursor: pointer;
      }
      .user-card-container h3 {
        margin: 0 0 0.25rem;
        font-size: 1.1rem;
        font-weight: 600;
        text-align: center;
      }
      .user-card-container p {
        margin: 0.2rem 0;
        font-size: 0.9rem;
        color: #555;
        text-align: center;
      }
      .user-card-container button:hover {
        background: #f0f0f0;
      }
      .user-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .hidden-file-input {
        display: none;
      }
      .hidden {
        display: none;
      }
    </style>
  `;
}

/* ========================================
   LOAD USERS PAGE FUNCTION
======================================== */
export async function loadUsersPage(currentUser) {
  if (!currentUser) return;

  let users = await select("users", "*", {
    column: "organisationId",
    operator: "eq",
    value: currentUser.organisationId,
  });

  // ===== SORT USERS BY SURNAME, THEN FORENAME =====
  users.sort((a, b) => {
    const surnameA = a.surname?.toLowerCase() || '';
    const surnameB = b.surname?.toLowerCase() || '';
    if (surnameA < surnameB) return -1;
    if (surnameA > surnameB) return 1;
    const forenameA = a.forename?.toLowerCase() || '';
    const forenameB = b.forename?.toLowerCase() || '';
    if (forenameA < forenameB) return -1;
    if (forenameA > forenameB) return 1;
    return 0;
  });

  const container = document.getElementById("users-container");
  if (!container) return;

  container.innerHTML = users
    .map((user) => {
      const profilePicUrl = `https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${user.id}`;
      return `
        <div class="user-card-container" data-user-id="${user.id}">
          <img src="${profilePicUrl}" alt="${user.forename} ${user.surname}" onerror="this.src='https://via.placeholder.com/64?text=?'" title="Click to upload new image" />
          <input type="file" accept="image/*" class="hidden-file-input" />
          <h3>${user.forename} ${user.surname}</h3>
          <p><strong>Position:</strong> ${user.position || "—"}</p>
          <p><strong>Email:</strong> <a href="mailto:${user.email}">${user.email}</a></p>
          <p><strong>Status:</strong> ${user.activated ? "Active" : "Deactivated"}</p>
          <div class="user-actions">
            <button data-user-id="${user.id}" data-action="manage">Manage</button>
            <button data-user-id="${user.id}" data-action="toggle">${user.activated ? "Deactivate" : "Activate"}</button>
          </div>
        </div>
      `;
    })
    .join("");

  const popup = document.getElementById("userManagePopup");
  const overlay = document.getElementById("overlay");
  const popupContent = document.getElementById("userManageContent");
  const closePopup = document.getElementById("closeUserPopup");

  closePopup.onclick = () => {
    popup.classList.add("hidden");
    overlay.classList.add("hidden");
  };
  overlay.onclick = closePopup.onclick;

  container.querySelectorAll(".user-actions button").forEach((btn) => {
    btn.onclick = async () => {
      const userId = btn.dataset.userId;
      const action = btn.dataset.action;
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      if (action === "manage") {
        const orgs = await select("organisations", "*", {
          column: "id",
          operator: "eq",
          value: currentUser.organisationId
        });
        const orgProducts = orgs.length > 0 ? orgs[0].products || {} : {};

        const userPermissions = user.permissionJSON
          ? JSON.parse(user.permissionJSON)
          : {};

        let permissionsHtml = '';
        for (const key in orgProducts) {
          const product = orgProducts[key].product;
          if (!PRODUCTS[product]) continue;

          const items = PRODUCTS[product];
          permissionsHtml += `<fieldset style="margin-bottom:0.5rem;">
            <legend><strong>${product}</strong></legend>`;
          items.forEach(item => {
            const checked = userPermissions[product]?.includes(item) ? 'checked' : '';
            permissionsHtml += `<label style="display:block;">
              <input type="checkbox" data-product="${product}" data-item="${item}" ${checked}/>
              ${item}
            </label>`;
          });
          permissionsHtml += `</fieldset>`;
        }

        popupContent.innerHTML = `
          <h3>${user.forename} ${user.surname}</h3>
          <div style="display:flex; gap:1rem; align-items:flex-start; margin-bottom:1rem;">
            <div style="position:relative;">
              <img id="popupProfileImage" src="https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${user.id}" 
                   alt="${user.forename}" style="width:100px;height:100px;border-radius:50%;border:2px solid #ccc;object-fit:cover;cursor:pointer;" />
              <input type="file" id="popupProfileInput" accept="image/*" style="display:none;" />
            </div>
            <div>
              <table>
                <tr><td><strong>Forename:</strong></td><td><input id="popupForename" value="${user.forename}" /></td></tr>
                <tr><td><strong>Surname:</strong></td><td><input id="popupSurname" value="${user.surname}" /></td></tr>
                <tr><td><strong>Position:</strong></td><td><input id="popupPosition" value="${user.position || ''}" /></td></tr>
                <tr><td><strong>Email:</strong></td><td>${user.email}</td></tr>
                <tr><td><strong>Status:</strong></td><td><button id="popupToggle">${user.activated ? "Deactivate" : "Activate"}</button></td></tr>
              </table>
              <div style="margin-top:1rem;">
                <h4>Permissions</h4>
                <div id="permissionsContainer" style="max-height:250px; overflow-y:auto; padding-right:0.5rem;">${permissionsHtml}</div>
              </div>
              <button id="popupSave" style="margin-top:0.5rem;">Save Changes</button>
              <button id="popupReset" style="margin-top:0.5rem;">Reset Password</button>
            </div>
          </div>
        `;

        popup.classList.remove("hidden");
        overlay.classList.remove("hidden");

        const imgEl = document.getElementById("popupProfileImage");
        const inputEl = document.getElementById("popupProfileInput");
        imgEl.addEventListener("click", () => inputEl.click());
        inputEl.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            await supabase.storage.from("profileImages").remove([user.id]);
            const { error } = await supabase.storage
              .from("profileImages")
              .upload(user.id, file, { cacheControl: "3600", upsert: true, contentType: file.type });
            if (error) throw error;
            imgEl.src = `https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${user.id}?t=${Date.now()}`;
          } catch (err) {
            console.error(err);
            alert("Failed to upload profile image.");
          }
        });

        document.getElementById("popupToggle").onclick = async () => {
          await update("users", { activated: !user.activated }, { column: "id", operator: "eq", value: user.id });
          await loadUsersPage(currentUser);
          popup.classList.add("hidden");
          overlay.classList.add("hidden");
        };

        document.getElementById("popupSave").onclick = async () => {
          const permContainer = document.getElementById("permissionsContainer");
          const perms = {};
          permContainer.querySelectorAll("input[type=checkbox]").forEach(cb => {
            const product = cb.dataset.product;
            const item = cb.dataset.item;
            if (!perms[product]) perms[product] = [];
            if (cb.checked) perms[product].push(item);
          });

          await update(
            "users",
            {
              forename: document.getElementById("popupForename").value,
              surname: document.getElementById("popupSurname").value,
              position: document.getElementById("popupPosition").value,
              permissionJSON: JSON.stringify(perms)
            },
            { column: "id", operator: "eq", value: user.id }
          );

          await loadUsersPage(currentUser);
          popup.classList.add("hidden");
          overlay.classList.add("hidden");
        };

        document.getElementById("popupReset").onclick = () => {
          alert(`Reset password for ${user.forename} ${user.surname} (ID: ${user.id})`);
        };
      }

      if (action === "toggle") {
        await update(
          "users",
          { activated: !user.activated },
          { column: "id", operator: "eq", value: userId }
        );
        await loadUsersPage(currentUser);
      }
    };
  });

  container.querySelectorAll(".user-card-container").forEach((card) => {
    const imgEl = card.querySelector("img");
    const inputEl = card.querySelector(".hidden-file-input");
    const userId = card.dataset.userId;

    imgEl.addEventListener("click", () => inputEl.click());
    inputEl.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await supabase.storage.from("profileImages").remove([userId]);
        const { error } = await supabase.storage
          .from("profileImages")
          .upload(userId, file, { cacheControl: "3600", upsert: true, contentType: file.type });
        if (error) throw error;
        imgEl.src = `https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${userId}?t=${Date.now()}`;
      } catch (err) {
        console.error(err);
        alert("Failed to upload profile image.");
      }
    });
  });
}
