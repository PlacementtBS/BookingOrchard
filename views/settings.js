import { select } from "../js/db.js";
export function settingsPage(currentUser) {
  return (`
    <section>
      <div>
        <h1>User Profile</h1>
        <table class="static">
          <tr>
            <td><h4>Name</h4></td>
            <td>${currentUser.forename} ${currentUser.surname}</td>
          </tr>
          <tr>
            <td><h4>Email</h4></td>
            <td>${currentUser.email}</td>
          </tr>
          <tr>
            <td><h4>Organisation</h4></td>
            <td id="org">Loading...</td>
          </tr>
          <tr>
            <td><h4>Account Created</h4></td>
            <td>${new Date(currentUser.created_at).toLocaleDateString()}</td>
          </tr>
        </table>
      </div>
    </section>
  `);
}

export async function loadSettings(currentUser) {
  const orgs = await select("organisations", "*", {
    column: "id",
    operator: "eq",
    value: currentUser.organisationId
  });

  if (orgs.length > 0) {
    const section = document.getElementById("org");
    section.innerText = orgs[0].name;
  } else {
    console.warn("Organisation not found");
  }
}
