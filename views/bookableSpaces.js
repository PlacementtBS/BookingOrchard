import { select } from "../js/db.js";
import { renderTablePage } from "../js/interacttable.js";

export function bookableSpacesHTML() {
  return `
    <section>
      <div id="spaces"></div>
    </section>
    <div id="statusForm" style="display:none;"></div>
  `;
}

export async function bookableSpacesAfterRender(currentUser) {
  const spaces = await select("rooms", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });
  const departments = await select("orgDepartments", "*", {column: "oId", operator:"eq", value:currentUser.organisationId});
  const depDrop = departments.map(d => ({
    value: d.id,
    label: d.departmentName
  }))
  console.log("Returned spaces data:", spaces); // ✅ for debugging

  if (!Array.isArray(spaces)) return;

  renderTablePage("spaces", {
    tableLabel: "Bookable Spaces",
    columns: ["room", "cost", "capacity", "oDep", "costBillingFrequency"],
    friendlyNames: ["Name", "Cost", "Capacity", "Department", "Frequency"],
    tableName: "rooms",
    data: spaces,
    idColumn: "id",
    extraInsertFields:{
        oId:currentUser.organisationId
    },
    dropdowns: {
      costBillingFrequency: {
        options: [
          { value: "Weekly", label: "Weekly" },
          { value: "Hourly", label: "Hourly" },
        ],
        formId: "statusForm",
      },oDep: {
        options: depDrop,
        formId: "statusForm",
      },
    },
  });
}
