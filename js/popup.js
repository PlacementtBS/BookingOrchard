import { insert } from './db.js';

export function showInsertPopup({
  tableName,
  columns,
  friendlyNames = [],
  dropdowns = {}, // same format as in renderTablePage
  extraInsertFields = {},
  onInsert = () => {}
}) {
  // Remove existing popup if present
  const existing = document.getElementById('dynamic-insert-popup');
  if (existing) existing.remove();

  // Create popup container
  const popup = document.createElement('div');
  popup.classList.add('popup');
  popup.id = 'dynamic-insert-popup';
  popup.style.display = 'flex';

  // Close popup when clicking outside form
  popup.addEventListener('click', (e) => {
    if (e.target === popup) popup.remove();
  });

  const form = document.createElement('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const obj = { ...extraInsertFields };
    columns.forEach((col) => {
      const val = formData.get(col);
      if (val !== '') obj[col] = val;
    });

    try {
      const result = await insert(tableName, obj);
      const inserted = Array.isArray(result) ? result[0] : result;
      console.log(`Inserted row into ${tableName}:`, inserted);
      onInsert(inserted); // callback
      popup.remove();
    } catch (err) {
      console.error(`Failed to insert into ${tableName}:`, err);
      alert("Insert failed. See console for details.");
    }
  });

  columns.forEach((col, i) => {
    const fieldId = `insert-popup-${col}`;

    // Create label with for attribute
    const label = document.createElement('label');
    label.textContent = friendlyNames[i] || col;
    label.setAttribute('for', fieldId);
    label.style.display = 'block';
    label.style.marginTop = '10px';

    let inputOrSelect;

    if (dropdowns[col]) {
      const select = document.createElement('select');
      select.name = col;
      select.id = fieldId;

      const options = [{ value: '', label: '' }, ...dropdowns[col].options];
      options.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });

      inputOrSelect = select;
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = col;
      input.id = fieldId;

      inputOrSelect = input;
    }

    form.appendChild(label);
    form.appendChild(inputOrSelect);
  });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Create';
  submitBtn.className = 'primaryButton';
  submitBtn.style.marginTop = '15px';
  form.appendChild(submitBtn);

  popup.appendChild(form);
  document.body.appendChild(popup);
}
