import { select } from "../js/db.js";
import { renderTablePage, updateDropdownOptions } from "../js/interacttable.js";
import { showInsertPopup } from "../js/popup.js";

export function bookableEquipmentHTML() {
  return `
    <section class="fullHeight">
      <div id="spaces" ></div>
      <div id="departments" class="third"></div>
    </section>
    <div id="statusForm" style="display:none;"></div>
  `;
}

export async function bookableEquipmentAfterRender(currentUser) {
  const spaces = await select("equipment", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });

  const departments = await select("orgDepartments", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });

  const depDrop = departments.map(d => ({
    value: d.id,
    label: d.departmentName,
  }));
  const roomGroups = await select("rooms", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });

  const rgDrop = roomGroups.map(r => ({
    value: r.id,
    label: r.room,
  }));

  if (!Array.isArray(spaces)) return;

  renderTablePage("spaces", {
    tableLabel: "Bookable Equipment",
    columns: ["name", "description", "cost", "dId", "rId", "billingFrequency"],
    friendlyNames: ["Name", "Description", "Cost", "Department", "Room", "Frequency"],
    tableName: "equipment",
    data: spaces,
    idColumn: "id",
    extraInsertFields: {
      oId: currentUser.organisationId,
    },
    dropdowns: {
      billingFrequency: {
        options: [
          { value: "Weekly", label: "Weekly" },
          { value: "Daily", label: "Daily" },
          { value: "Hourly", label: "Hourly" },
          { value: "One Time", label: "One Time" },
        ],
        formId: "statusForm",
         allowCreate: false,
      },
      dId: {
        options: depDrop,
        formId: "statusForm",
        allowCreate: true,
        onCreateNew: () => {
          showInsertPopup({
            tableName: "orgDepartments",
            columns: ["departmentName"],
            friendlyNames: ["Department Name"],
            extraInsertFields: {
              oId: currentUser.organisationId,
            },
            onInsert: async () => {
              const updatedDeps = await select("orgDepartments", "*", {
                column: "oId",
                operator: "eq",
                value: currentUser.organisationId,
              });

              const updatedDepDrop = updatedDeps.map(d => ({
                value: d.id,
                label: d.departmentName,
              }));

              updateDropdownOptions("oDep", updatedDepDrop);
            },
          });
        },
      },rId: {
        options: rgDrop,
        allowCreate: false,
      },
    },
  });
  renderTablePage("departments", {
    tableLabel: "Departments",
    columns: ["departmentName"],
    friendlyNames: ["Name"],
    tableName: "orgDepartments",
    data: departments,
    idColumn: "id",
    extraInsertFields: {
      oId: currentUser.organisationId,
    },
  });
}
