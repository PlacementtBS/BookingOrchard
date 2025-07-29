import { select } from "../js/db.js";
import { renderTablePage, updateDropdownOptions } from "../js/interacttable.js";
import { showInsertPopup } from "../js/popup.js";
import { subnav } from "../js/subnav.js";

export function bookableSpacesHTML() {
  return `
    <section class="halfHeight">
      <div id="spaces" ></div>
    </section>
    <section class="halfHeight">
      <div id="departments"></div>
      <div id="groups"></div>
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

  const departments = await select("orgDepartments", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });

  const depDrop = departments.map(d => ({
    value: d.id,
    label: d.departmentName,
  }));
  const roomGroups = await select("orgRoomGroups", "*", {
    column: "oId",
    operator: "eq",
    value: currentUser.organisationId,
  });

  const rgDrop = roomGroups.map(r => ({
    value: r.id,
    label: r.groupName,
  }));

  if (!Array.isArray(spaces)) return;

  renderTablePage("spaces", {
    tableLabel: "Bookable Spaces",
    columns: ["room", "cost", "capacity", "oDep", "oRGroup", "costBillingFrequency"],
    friendlyNames: ["Name", "Cost", "Capacity", "Department", "Group", "Frequency"],
    tableName: "rooms",
    data: spaces,
    idColumn: "id",
    extraInsertFields: {
      oId: currentUser.organisationId,
    },
    dropdowns: {
      costBillingFrequency: {
        options: [
          { value: "Weekly", label: "Weekly" },
          { value: "Daily", label: "Daily" },
          { value: "Hourly", label: "Hourly" },
          { value: "One Time", label: "One Time" },
        ],
        formId: "statusForm",
         allowCreate: false,
      },
      oDep: {
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
      },oRGroup: {
        options: rgDrop,
        formId: "statusForm",
        allowCreate: true,
        onCreateNew: () => {
          showInsertPopup({
            tableName: "orgRoomGroups",
            columns: ["groupName"],
            friendlyNames: ["Group Name"],
            extraInsertFields: {
              oId: currentUser.organisationId,
            },
            onInsert: async () => {
              const updatedDeps = await select("orgRoomGroups", "*", {
                column: "oId",
                operator: "eq",
                value: currentUser.organisationId,
              });

              const updatedDepDrop = updatedDeps.map(r => ({
                value: r.id,
                label: r.groupName,
              }));

              updateDropdownOptions("oDep", updatedDepDrop);
            },
          });
        },
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
  renderTablePage("groups", {
    tableLabel: "Room Groups",
    columns: ["groupName"],
    friendlyNames: ["Name"],
    tableName: "orgRoomGroups",
    data: roomGroups,
    idColumn: "id",
    extraInsertFields: {
      oId: currentUser.organisationId,
    },
  });
}
