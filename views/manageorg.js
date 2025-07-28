import { select } from "../js/db.js";
import createOrganisation from "../js/organisations.js";

export default async function manageorg() {
    const organisation = await select("organisations");

  const rows = (organisation || [])
    .map(
      (o) => `
      <tr>
        <td>${o.name}</td>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
      </tr>
    `
    )
    .join("");

//david is an absolute fuckwit at js, but its okay
  return `
    <section>
        <div> 
            <h2>Manage Organisations</h2>
        </div>
    </section>

    <section>
      <div class="third">
        <form id="add-org-form">
          <label for="org-name">Organisation Name</label>
          <input type="text" id="org-name" name="org-name" placeholder="Enter organisation name" required />

          <label for="user-fname">Admin First Name</label>
          <input type="text" id="user-fname" name="user-fname" placeholder="Enter first name" required />

          <label for="user-sname">Admin Surname</label>
          <input type="text" id="user-sname" name="user-sname" placeholder="Enter surname" required />

          <label for="user-email">Admin Email</label>
          <input type="email" id="user-email" name="user-email" placeholder="Enter email" required />

          <label for="user-password">Admin Password</label>
          <input type="password" id="user-password" name="user-password" placeholder="Enter password" required />

          <button type="submit" class="primaryButton">Add Organisation</button>
        </form>
      </div>

      <div id="org-list-container">
        <h3>Existing Organisations</h3>
<table>
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody id="organisations-table">
          ${rows}
        </tbody>
      </table>
      </div>
      </section>
  `;
}

// Export the init logic so it can be called manually
export async function attachManageOrgListeners() {
  const form = document.getElementById('add-org-form');
  const orgList = document.getElementById('org-list');

  async function fetchAndRenderOrgs() {
    orgList.innerHTML = '<li>Loading organisations...</li>';
    try {
     const res = await fetch('/api/organisations/');
if (!res.ok) throw new Error('Failed to fetch');
const orgs = await res.json();


      if (orgs.length === 0) {
        orgList.innerHTML = '<li>No organisations found.</li>';
        return;
      }

      orgList.innerHTML = orgs.map(org => `
        <li style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
          <span>${org.name}</span>
          <button class="outlineButton delete-org-btn" data-id="${org.id}" style="padding: 4px 8px; font-size: 0.9rem;">
            Remove
          </button>
        </li>
      `).join('');
    } catch (error) {
      orgList.innerHTML = '<li style="color: red;">Error loading organisations.</li>';
    }
  }

  // Initial render
  await fetchAndRenderOrgs();

  // Form submission
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const name = document.getElementById('org-name').value.trim();
    const fname = document.getElementById('user-fname').value.trim();
    const sname = document.getElementById('user-sname').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;

    if (!name || !fname || !sname || !email || !password) {
      return alert('All fields are required.');
    }

    try {
      await createOrganisation(name, fname, sname, email, password);
      form.reset();
      await fetchAndRenderOrgs();
    } catch (err) {
      console.error(err);
      alert('Failed to create organisation');
    }
  });

  // Delegated event listener for delete buttons
  orgList.addEventListener('click', async e => {
    if (e.target.classList.contains('delete-org-btn')) {
      const id = e.target.dataset.id;
      if (!confirm('Are you sure you want to delete this organisation?')) return;

      try {
        const res = await fetch(`/api/organisations/${id}/`, { method: 'DELETE' });
        if (res.ok) {
          await fetchAndRenderOrgs();
        } else {
          alert('Failed to delete organisation.');
        }
      } catch (err) {
        alert('Error deleting organisation.');
      }
    }
  });
}
