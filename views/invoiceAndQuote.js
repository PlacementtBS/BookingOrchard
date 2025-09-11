import { select, insert } from "../js/db.js";

export default function invoicePage() {
  return `
    <section class="fullHeight">
      <div>
        <h1>Invoice / Quote</h1>
        <div id="invoiceBookingInfo">Loading booking info...</div>
        <hr>
        <h3>Quote Details</h3>
        <div id="quoteDetails">Loading...</div>
        <div id="versionMenu" style="margin-top:1em;"></div>
        <button class="secondaryButton" id="addItemBtn">+ Add Item</button>
        <button class="primaryButton" id="saveQuoteBtn">Save New Version</button>
      </div>
    </section>
  `;
}

export async function loadInvoice(currentUser) {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const bookingId = urlParams.get("bid");
  if (!bookingId) return;

  // --- Fetch booking info ---
  const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: bookingId }))[0];
  if (!booking) return;

  document.getElementById("invoiceBookingInfo").innerHTML = `
    <p><strong>${booking.name}</strong></p>
    <p>${new Date(booking.startDate).toLocaleDateString("en-GB")} - ${new Date(booking.endDate).toLocaleDateString("en-GB")}</p>
  `;

  // --- Calculate total hours from booking.timings ---
  let totalHours = 0;
  if (booking.timings) {
    for (const t of Object.values(booking.timings)) {
      if (t.start && t.end) {
        const [startH, startM] = t.start.split(":").map(Number);
        const [endH, endM] = t.end.split(":").map(Number);
        totalHours += (endH + endM / 60) - (startH + startM / 60);
      }
    }
  }

  // --- Fetch requirements responses ---
  const responses = await select("requirementsFormResponses", "*", { column: "bId", operator: "eq", value: bookingId });
  if (!responses.length) {
    document.getElementById("quoteDetails").innerHTML = "<p>No responses available to generate quote.</p>";
    return;
  }

  let responseData = responses[0].response;
  if (typeof responseData === "string") {
    try { responseData = JSON.parse(responseData); } catch { responseData = []; }
  }

  let generatedItems = [];

  for (const r of responseData) {
    // --- Rooms ---
    if (r.response && r.roomId) {
      const room = (await select("rooms", "*", { column: "id", operator: "eq", value: r.roomId }))[0];
      if (room) {
        generatedItems.push({
          item: room.room,
          description: "Room Booking",
          quantity: totalHours || 1,
          price: Number(room.cost) || 0,
          tax: 0
        });
      }
    }

    // --- Equipment ---
    if (Array.isArray(r.equipment)) {
      for (const eq of r.equipment) {
        if (eq.response) {
          const equipment = (await select("equipment", "*", { column: "id", operator: "eq", value: eq.equipmentId }))[0];
          if (equipment) {
            generatedItems.push({
              item: equipment.name,
              description: "Equipment",
              quantity: totalHours || 1,
              price: Number(equipment.cost) || 0,
              tax: 0
            });
          }
        }
      }
    }
  }

  // --- Load existing versions ---
  const existing = await select("invoicesAndQuotes", "*", { column: "bId", operator: "eq", value: bookingId });
  const filtered = existing.filter(r => r.type === false); // false = quote
  const latest = filtered.length ? filtered.reduce((a, b) => (a.version > b.version ? a : b)) : null;

  // --- Editable Table Renderer ---
  function renderQuoteEditor(items) {
    let html = `<table class="static" style="width:100%; border-collapse:collapse;" id="quoteTable">
      <tr style="background:#f0f0f0;">
        <th>Item</th><th>Description</th><th>Qty</th><th>Price</th><th>Tax</th><th>Total</th><th></th>
      </tr>`;

    items.forEach((q, idx) => {
      html += `<tr>
        <td contenteditable="true" data-field="item">${q.item || ""}</td>
        <td contenteditable="true" data-field="description">${q.description || ""}</td>
        <td contenteditable="true" data-field="quantity">${q.quantity || 1}</td>
        <td contenteditable="true" data-field="price">${q.price || 0}</td>
        <td>
          <select data-field="tax" data-index="${idx}">
            <option value="0" ${q.tax == 0 ? "selected" : ""}>No Tax</option>
            <option value="0.05" ${q.tax == 0.05 ? "selected" : ""}>5%</option>
            <option value="0.20" ${q.tax == 0.20 ? "selected" : ""}>20%</option>
          </select>
        </td>
        <td class="lineTotal">£0.00</td>
        <td><button class="deleteRowBtn" data-index="${idx}">❌</button></td>
      </tr>`;
    });

    html += `<tr style="font-weight:bold;">
      <td colspan="5" style="text-align:right">Total:</td>
      <td id="grandTotal">£0.00</td>
      <td></td>
    </tr>`;
    html += `</table>`;

    document.getElementById("quoteDetails").innerHTML = html;
    recalcTotals();
    attachRowEvents();
  }

  // --- Helpers ---
  function recalcTotals() {
    const rows = document.querySelectorAll("#quoteTable tr");
    let grandTotal = 0;
    rows.forEach((row, idx) => {
      const qtyCell = row.querySelector('[data-field="quantity"]');
      const priceCell = row.querySelector('[data-field="price"]');
      const taxSel = row.querySelector('[data-field="tax"]');
      const totalCell = row.querySelector(".lineTotal");
      if (qtyCell && priceCell && taxSel && totalCell) {
        const qty = parseFloat(qtyCell.textContent) || 0;
        const price = parseFloat(priceCell.textContent) || 0;
        const taxRate = parseFloat(taxSel.value) || 0;
        const base = qty * price;
        const lineTotal = base + (base * taxRate);
        totalCell.textContent = `£${lineTotal.toFixed(2)}`;
        grandTotal += lineTotal;
      }
    });
    const gTotal = document.getElementById("grandTotal");
    if (gTotal) gTotal.textContent = `£${grandTotal.toFixed(2)}`;
  }

  function attachRowEvents() {
    document.querySelectorAll("#quoteTable td[contenteditable]").forEach(cell => {
      cell.addEventListener("input", recalcTotals);
    });
    document.querySelectorAll("#quoteTable select[data-field='tax']").forEach(sel => {
      sel.addEventListener("change", recalcTotals);
    });
    document.querySelectorAll(".deleteRowBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-index"));
        let items = getCurrentItems();
        items.splice(idx, 1);
        renderQuoteEditor(items);
      });
    });
  }

  function getCurrentItems() {
    const rows = document.querySelectorAll("#quoteTable tr");
    let items = [];
    rows.forEach(row => {
      const item = row.querySelector('[data-field="item"]');
      const desc = row.querySelector('[data-field="description"]');
      const qty = row.querySelector('[data-field="quantity"]');
      const price = row.querySelector('[data-field="price"]');
      const taxSel = row.querySelector('[data-field="tax"]');
      if (item && desc && qty && price && taxSel) {
        items.push({
          item: item.textContent.trim(),
          description: desc.textContent.trim(),
          quantity: parseFloat(qty.textContent) || 0,
          price: parseFloat(price.textContent) || 0,
          tax: parseFloat(taxSel.value) || 0
        });
      }
    });
    return items;
  }

  // --- If no versions exist, auto-save generated items as v1 ---
  if (!filtered.length && generatedItems.length) {
    const newEntry = {
      bId: bookingId,
      version: 1,
      createdBy: currentUser.id,
      schema: JSON.stringify(generatedItems),
      type: false
    };
    await insert("invoicesAndQuotes", newEntry);
    return loadInvoice(currentUser); // reload so editor loads v1
  }

  // --- Render version menu ---
  const versionMenu = document.getElementById("versionMenu");
  versionMenu.innerHTML = "";
  if (filtered.length > 0) {
    filtered.sort((a, b) => b.version - a.version);
    filtered.forEach(r => {
      const btn = document.createElement("button");
      btn.textContent = `Version ${r.version} (${new Date(r.created_at).toLocaleString()})`;
      btn.onclick = () => {
        let schema = r.schema;
        if (typeof schema === "string") {
          try { schema = JSON.parse(schema); } catch { schema = []; }
        }
        renderQuoteEditor(schema);
      };
      versionMenu.appendChild(btn);
    });

    // Show latest version by default
    if (latest) {
      let schema = latest.schema;
      if (typeof schema === "string") {
        try { schema = JSON.parse(schema); } catch { schema = []; }
      }
      renderQuoteEditor(schema);
    }
  }

  // --- Add item button ---
  document.getElementById("addItemBtn").onclick = () => {
    let items = getCurrentItems();
    items.push({ item: "New Item", description: "", quantity: 1, price: 0, tax: 0 });
    renderQuoteEditor(items);
  };

  // --- Save new version ---
  document.getElementById("saveQuoteBtn").onclick = async () => {
    const items = getCurrentItems();
    const maxVersion = filtered.length ? Math.max(...filtered.map(r => r.version || 0)) : 0;

    const newEntry = {
      bId: bookingId,
      version: maxVersion + 1,
      createdBy: currentUser.id,
      schema: JSON.stringify(items),
      type: false // false = quote
    };

    await insert("invoicesAndQuotes", newEntry);
    alert(`Quote version ${newEntry.version} saved successfully!`);
    loadInvoice(currentUser); // reload to refresh menu
  };
}
