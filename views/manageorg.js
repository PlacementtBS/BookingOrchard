import createOrganisation from "../js/organisations.js";
import { renderTablePage } from "../js/interacttable.js";
import { select } from "../js/db.js";
export default function manageorg() {
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

          <input type="submit" class="primaryButton">
        </form>
      </div>

      <div id="org-list">
      </div>
    </section>
  `;
}

export async function attachManageOrgListeners() {
  const form = document.getElementById('add-org-form');
  const orgTableBody = document.getElementById('organisations-table');
 
  // Handle adding organisation
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
 

    const organisations = await select("organisations");
  
    const users = await select("users");
  
    const usersDrop = users.map(u => ({
      value: u.id,
      label: u.forename+" "+u.surname+" ("+u.email+")"
    }));
    
  
    if (!Array.isArray(organisations)) return;
  
    renderTablePage("org-list", {
      tableLabel: "Organisationslist",
      columns: ["name", "admin"],
      friendlyNames: ["Name", "Admin"],
      tableName: "organisations",
      data: organisations,
      idColumn: "id",
      dropdowns: {
        admin: {
          options:usersDrop,
           allowCreate: false,
        },
      },
});}