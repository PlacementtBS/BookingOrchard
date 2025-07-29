import { insert, update, remove } from './db.js';

export function renderTablePage(
  targetId,
  {
    tableLabel,
    columns,
    friendlyNames,
    data,
    tableName,
    idColumn = 'id',
    extraInsertFields = {},
    dropdowns = {},
    editable = true // <-- NEW
  }
)
 {
  const container = document.getElementById(targetId);

  if (!container) {
    console.error(`Element with id "${targetId}" not found`);
    return;
  }

  const headers =
    Array.isArray(friendlyNames) && friendlyNames.length === columns.length
      ? friendlyNames
      : columns;

  const allHeaders = [...headers, 'Delete'];

  container.innerHTML = `
    <h2>${tableLabel ? tableLabel : ''}</h2>
    <table id="excel-table">
      <thead>
        <tr>
          ${allHeaders.map((col) => `<th>${col}</th>`).join('')}
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = container.querySelector('#excel-table tbody');

  function setupFormClose(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('click', (e) => {
      if (e.target === form) {
        form.style.display = 'none';
      }
    });
  }

  function renderTable() {
    tbody.innerHTML = '';

    data.forEach((rowObj, rowIndex) => {
  const id = rowObj.id;
  const values = Array.isArray(rowObj.values)
    ? rowObj.values
    : columns.map((col) => rowObj[col]);

  data[rowIndex].values = values; // ✅ ADD THIS LINE

  const tr = document.createElement('tr');


      columns.forEach((colName, colIndex) => {
        const td = document.createElement('td');
        const currentValue = values[colIndex] ?? '';

        if (dropdowns[colName]) {
    const { options = [], formId, allowCreate = false } = dropdowns[colName]; // <-- get allowCreate

    const select = document.createElement('select');

    // Build options array, add Create New only if allowCreate is true
    const allOptions = [{ value: '', label: '' }, ...options];
    if (allowCreate && !allOptions.some((opt) => opt.value === '__create__')) {
      allOptions.push({ value: '__create__', label: '(Create New)' });
    }

    allOptions.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value == currentValue) option.selected = true;
      select.appendChild(option);
    });

          select.addEventListener('change', async () => {
            const newValue = select.value;

            if (newValue === '__create__') {
              if (dropdowns[colName].onCreateNew) {
                dropdowns[colName].onCreateNew();
              } else if (formId) {
                const form = document.getElementById(formId);
                if (form) {
                  form.style.display = 'flex';
                  setupFormClose(formId);
                } else {
                  console.error(`Form with id "${formId}" not found`);
                }
              }
              select.value = '';
              return;
            }

            if (data[rowIndex].values[colIndex] !== newValue) {
              data[rowIndex].values[colIndex] = newValue;

              const obj = { ...extraInsertFields };
              columns.forEach((c, i) => {
                const val = data[rowIndex].values[i] ?? '';
                if (val !== '') obj[c] = val;
              });

              try {
                await update(tableName, obj, {
                  column: idColumn,
                  operator: 'eq',
                  value: id
                });
                console.log(`Updated row ${id}`, obj);
              } catch (err) {
                console.error(`Failed to update row ${id}:`, err);
              }
            }
          });

          td.appendChild(select);
        } else {
          td.textContent = currentValue;
          td.contentEditable = true;
          td.addEventListener('blur', async () => {
            const newValue = td.textContent.trim();
            if (data[rowIndex].values[colIndex] !== newValue) {
              data[rowIndex].values[colIndex] = newValue;

              const obj = { ...extraInsertFields };
              columns.forEach((c, i) => {
                const val = data[rowIndex].values[i]?.trim() ?? '';
                if (val !== '') obj[c] = val;
              });

              try {
                await update(tableName, obj, {
                  column: idColumn,
                  operator: 'eq',
                  value: id
                });
                console.log(`Updated row ${id}`, obj);
              } catch (err) {
                console.error(`Failed to update row ${id}:`, err);
              }
            }
          });
        }

        tr.appendChild(td);
      });

      const deleteTd = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.classList.add('deleteButton');

      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this row?')) {
          try {
            await remove(tableName, {
              column: idColumn,
              operator: 'eq',
              value: id
            });
            console.log(`Deleted row ${id}`);

            data.splice(rowIndex, 1);
            renderTable();
          } catch (err) {
            console.error(`Failed to delete row ${id}:`, err);
          }
        }
      });

      deleteTd.appendChild(deleteBtn);
      tr.appendChild(deleteTd);

      tbody.appendChild(tr);
    });

// New row for insert
if (editable) {
  const tr = document.createElement('tr');

  columns.forEach((colName, colIndex) => {
    const td = document.createElement('td');

    if (dropdowns[colName]) {
      const { options = [], formId } = dropdowns[colName];
      const select = document.createElement('select');

      const allOptions = [{ value: '', label: '' }, ...options];
      if (!allOptions.some((opt) => opt.value === '__create__')) {
        allOptions.push({ value: '__create__', label: '(Create New)' });
      }

      allOptions.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });

      select.addEventListener('change', () => {
        const newValue = select.value;

        if (newValue === '__create__') {
          if (formId) {
            const form = document.getElementById(formId);
            if (form) {
              form.style.display = 'block';
              setupFormClose(formId);
            } else {
              console.error(`Form with id "${formId}" not found`);
            }
          }
        }
      });

      td.appendChild(select);
      td.addEventListener('blur', handleInsert);
    } else {
      td.contentEditable = true;

      if (colIndex === 0) {
        td.textContent = 'New';
        td.style.color = 'gray';

        td.addEventListener('focus', () => {
          if (td.textContent === 'New') {
            td.textContent = '';
            td.style.color = 'black';
          }
        });

        td.addEventListener('blur', () => {
          if (td.textContent.trim() === '') {
            td.textContent = 'New';
            td.style.color = 'gray';
          }
          handleInsert();
        });
      } else {
        td.addEventListener('blur', handleInsert);
      }
    }

    tr.appendChild(td);
  });

  const emptyDeleteTd = document.createElement('td');
  tr.appendChild(emptyDeleteTd);

  tbody.appendChild(tr);

  async function handleInsert() {
    const rowValues = Array.from(tr.children)
      .slice(0, columns.length)
      .map((td) => {
        if (td.querySelector?.('select')) return td.querySelector('select').value;
        return td.textContent.trim();
      });

    if (!rowValues.some((v) => v !== '')) return;

    const obj = { ...extraInsertFields };
    columns.forEach((c, i) => {
      const val = rowValues[i];
      if (val !== '') obj[c] = val;
    });

    try {
      const result = await insert(tableName, obj);
      const inserted = Array.isArray(result) ? result[0] : result;
      data.push({ id: inserted[idColumn], values: rowValues });
      console.log(`Inserted row`, inserted);
      renderTable();
    } catch (err) {
      console.error('Failed to insert row:', err);
    }
  }
}



    async function handleInsert() {
      const rowValues = Array.from(tr.children)
        .slice(0, columns.length)
        .map((td) => {
          if (td.querySelector?.('select')) return td.querySelector('select').value;
          return td.textContent.trim();
        });

      if (!rowValues.some((v) => v !== '')) return;

      const obj = { ...extraInsertFields };
      columns.forEach((c, i) => {
        const val = rowValues[i];
        if (val !== '') obj[c] = val;
      });

      try {
        const result = await insert(tableName, obj);
        const inserted = Array.isArray(result) ? result[0] : result;
        data.push({ id: inserted[idColumn], values: rowValues });
        console.log(`Inserted row`, inserted);
        renderTable();
      } catch (err) {
        console.error('Failed to insert row:', err);
      }
    }
  }
  

  renderTable();
}
export function updateDropdownOptions(columnName, newOptions) {
  const dropdownSelects = document.querySelectorAll(`[data-dropdown="${columnName}"]`);
  dropdownSelects.forEach(select => {
    select.innerHTML = ""; // Clear existing options
    newOptions.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
  });
}
