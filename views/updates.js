import { select } from "../js/db.js";

export async function updates() {
  const updates = await select("updates");

  const rows = (updates || [])
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
    <div class="hero">
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
  `;
}
