import { insert } from './db.js';

export function showInsertPopup({
  tableName,
  columns,
  friendlyNames = [],
  dropdowns = {},
  extraInsertFields = {},
  onInsert = () => {}
}) {
  const existing = document.getElementById('dynamic-insert-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.classList.add('popup');
  popup.id = 'dynamic-insert-popup';
  popup.style.display = 'flex';

  popup.addEventListener('click', (e) => {
    if (e.target === popup) popup.remove();
  });

  const form = document.createElement('form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const obj = { ...extraInsertFields };

    columns.forEach((colEntry, i) => {
      const col = typeof colEntry === 'string' ? colEntry : colEntry.name;
      const type = typeof colEntry === 'string' ? 'text' : colEntry.type || 'text';

      if (type === 'customGroup') {
        const subfields = {};
        colEntry.fields.forEach(sub => {
          const fullName = `${col}_${sub.name}`;
          if (sub.type === 'checkboxGroup') {
            const checkboxes = form.querySelectorAll(`input[name="${fullName}"]:checked`);
            subfields[sub.name] = Array.from(checkboxes).map(cb => cb.value);
          } else if (sub.type === 'checkbox') {
            subfields[sub.name] = formData.get(fullName) === 'on';
          } else {
            const value = formData.get(fullName);
            if (value !== '') subfields[sub.name] = value;
          }
        });
        obj[col] = subfields;
      } else if (type === 'checkbox') {
        obj[col] = formData.get(col) === 'on';
      } else {
        const val = formData.get(col);
        if (val !== '') obj[col] = val;
      }
    });

    try {
      const result = await insert(tableName, obj);
      const inserted = Array.isArray(result) ? result[0] : result;
      console.log(`Inserted row into ${tableName}:`, inserted);
      onInsert(inserted);
      popup.remove();
    } catch (err) {
      console.error(`Failed to insert into ${tableName}:`, err);
      alert("Insert failed. See console for details.");
    }
  });

  columns.forEach((colEntry, i) => {
    const col = typeof colEntry === 'string' ? colEntry : colEntry.name;
    const type = typeof colEntry === 'string' ? 'text' : colEntry.type || 'text';
    const labelText = friendlyNames[i] || col;

    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.display = 'block';
    label.style.marginTop = '10px';

    if (type === 'customGroup') {
      form.appendChild(label);

      colEntry.fields.forEach((sub) => {
        const fullName = `${col}_${sub.name}`;
        const subLabel = document.createElement('label');
        subLabel.textContent = sub.label || sub.name;
        subLabel.style.display = 'block';

        if (sub.type === 'select') {
          const select = document.createElement('select');
          select.name = fullName;
          (sub.options || []).forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            select.appendChild(option);
          });
          form.appendChild(subLabel);
          form.appendChild(select);

        } else if (sub.type === 'checkboxGroup') {
          form.appendChild(subLabel);
          (sub.options || []).forEach(opt => {
            const wrapper = document.createElement('label');
            wrapper.style.display = 'inline-block';
            wrapper.style.marginRight = '10px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = fullName;
            checkbox.value = opt;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(document.createTextNode(opt));
            form.appendChild(wrapper);
          });

        } else {
          const input = document.createElement('input');
          input.type = sub.type === 'date' ? 'date' : sub.type === 'checkbox' ? 'checkbox' : 'text';
          input.name = fullName;

          form.appendChild(subLabel);
          form.appendChild(input);
        }
      });

    } else if (dropdowns[col]) {
      const select = document.createElement('select');
      select.name = col;

      const options = [{ value: '', label: '' }, ...dropdowns[col].options];
      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });

      form.appendChild(label);
      form.appendChild(select);

    } else {
      const input = document.createElement('input');
      input.name = col;
      input.type = type === 'date' ? 'date' : type === 'checkbox' ? 'checkbox' : 'text';

      form.appendChild(label);
      form.appendChild(input);
    }
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
