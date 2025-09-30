import { select } from "../js/db.js";

export async function updates() {
  const updates = await select("updates");

  // Sort by releaseNumber (desc), then created_at (desc)
  const sorted = (updates || []).sort((a, b) => {
    const relDiff = Number(b.releaseNumber) - Number(a.releaseNumber);
    if (relDiff !== 0) return relDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const rows = sorted
    .map(
      (u) => `
      <tr>
        <td>${u.releaseNumber}</td>
        <td>${u.title}</td>
        <td>${u.description}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
      </tr>
    `
    )
    .join("");

  return `
      <section class="hero">
        <h1>View Product<br>Updates and Version History</h1><br>
        <h2>Here in our live release table</h2>
      </section>
      <section class="underhero"></section>
      <section>
        <div>
          <h1>Live update logs</h1>
          <h3>Welcome to the updates page, here you can view all our live product versioning updates, every time we release a new version or patch of bookingorchard we will share notes on the release below.</h3>
        </div>
      </section>
      <section>
        <div>
          <table>
            <thead>
              <tr>
                <th>Release</th>
                <th>Title</th>
                <th>Notes</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody id="updates-table">
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
  `;
}
