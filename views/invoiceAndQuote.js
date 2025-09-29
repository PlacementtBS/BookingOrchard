import { select, insert, update } from "../js/db.js";
import { sendEmail } from "../js/email.js";

export default function invoicePage() {
  return `
    <section class="fullHeight">
      <div>
        <h1>Invoice / Quote</h1>
        <div id="invoiceBookingInfo">Loading booking info...</div>
        <hr>
        <h3>Quote / Invoice Details</h3>
        <div id="quoteDetails">Loading...</div>
        <div id="versionMenu" style="margin-top:1em;"></div>
        <button class="secondaryButton" id="addItemBtn">+ Add Item</button>
        <button class="primaryButton" id="saveQuoteBtn">Save New Version</button>
        <button class="primaryButton" id="sendQuoteBtn">Send Quote</button>
        <button class="primaryButton" id="sendAsInvoiceBtn">Send as Invoice</button>
        <button class="dangerButton" id="removeInvoiceBtn" style="display:none;">Remove Invoice</button>
      </div>
    </section>
  `;
}

export async function loadInvoice(currentUser) {
  const urlParams = new URLSearchParams(location.hash.split("?")[1]);
  const bookingId = urlParams.get("bid");
  if (!bookingId) return;

  const [booking] = await select("bookings", "*", { column: "id", operator: "eq", value: bookingId });
  if (!booking) return;

  document.getElementById("invoiceBookingInfo").innerHTML = `
    <p><strong>${booking.name}</strong></p>
    <p>${new Date(booking.startDate).toLocaleDateString("en-GB")} - ${new Date(booking.endDate).toLocaleDateString("en-GB")}</p>
  `;

  // Fetch existing invoices/quotes
  let existing = await select("invoicesAndQuotes", "*", { column: "bId", operator: "eq", value: bookingId });
  const hasInvoice = existing.some(r => r.type === true);
  const latest = existing.length ? existing.reduce((a, b) => (a.version > b.version ? a : b)) : null;

  // Load requirements form responses
  let reqResponses = await select("requirementsFormResponses", "*", { column: "bId", operator: "eq", value: bookingId }) || [];
  let latestReq = reqResponses.length
    ? reqResponses.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
    : null;

  let requirements = [];
  try { requirements = latestReq ? JSON.parse(latestReq.response) : []; } catch { requirements = []; }

  const allRooms = await select("rooms", "*");
  const allEquipment = await select("equipment", "*");

  // Calculate total hire hours
  let totalHours = 0;
  try {
    const timings = booking.timings ? JSON.parse(booking.timings) : {};
    for (const day of Object.values(timings)) {
      const [sH, sM] = day.start.split(":").map(Number);
      const [eH, eM] = day.end.split(":").map(Number);
      totalHours += ((eH * 60 + eM) - (sH * 60 + sM)) / 60;
    }
    totalHours = Math.round(totalHours * 100) / 100;
  } catch { totalHours = 0; }

  // Build initial items from requirements
  let initialItems = [];
  for (const req of requirements) {
    if (req.response) {
      const room = allRooms.find(r => r.id === req.roomId);
      if (room) initialItems.push({
        item: room.room,
        description: `Hire for ${totalHours} hours`,
        quantity: totalHours,
        price: parseFloat(room.cost || 0),
        tax: 0
      });
    }
    for (const eqResp of req.equipment || []) {
      if (eqResp.response) {
        const eq = allEquipment.find(e => e.id === eqResp.equipmentId);
        if (eq) initialItems.push({
          item: eq.name,
          description: `Hire for ${totalHours} hours`,
          quantity: totalHours,
          price: parseFloat(eq.cost || 0),
          tax: 0
        });
      }
    }
  }

  // --- QUOTE TABLE RENDERING ---
  function renderQuoteEditor(items, readOnly = false) {
    let html = `<table class="static" style="width:100%; border-collapse:collapse;" id="quoteTable">
      <tr style="background:#f0f0f0;">
        <th>Item</th><th>Description</th><th>Qty</th><th>Price</th><th>Tax</th><th>Total</th>${readOnly ? "" : "<th></th>"}
      </tr>`;

    items.forEach((q, idx) => {
      html += `<tr>
        <td ${!readOnly ? 'contenteditable="true"' : ""} data-field="item">${q.item || ""}</td>
        <td ${!readOnly ? 'contenteditable="true"' : ""} data-field="description">${q.description || ""}</td>
        <td ${!readOnly ? 'contenteditable="true"' : ""} data-field="quantity">${q.quantity || 1}</td>
        <td ${!readOnly ? 'contenteditable="true"' : ""} data-field="price">${q.price || 0}</td>
        <td>
          ${readOnly ? (q.tax ? (q.tax*100)+"%" : "No Tax") : `<select data-field="tax" data-index="${idx}">
            <option value="0" ${q.tax==0?"selected":""}>No Tax</option>
            <option value="0.05" ${q.tax==0.05?"selected":""}>5%</option>
            <option value="0.20" ${q.tax==0.20?"selected":""}>20%</option>
          </select>`}
        </td>
        <td class="lineTotal">£0.00</td>
        ${!readOnly ? `<td><button class="deleteRowBtn" data-index="${idx}">❌</button></td>` : "" }
      </tr>`;
    });

    html += `<tr style="font-weight:bold;">
      <td colspan="5" style="text-align:right">Total:</td>
      <td id="grandTotal">£0.00</td>
      ${!readOnly ? "<td></td>" : "" }
    </tr></table>`;

    document.getElementById("quoteDetails").innerHTML = html;
    recalcTotals();
    if(!readOnly) attachRowEvents();
  }

  function recalcTotals() {
    const rows = document.querySelectorAll("#quoteTable tr");
    let grandTotal = 0;
    rows.forEach(row => {
      const qtyCell = row.querySelector('[data-field="quantity"]');
      const priceCell = row.querySelector('[data-field="price"]');
      const taxSel = row.querySelector('[data-field="tax"]');
      const totalCell = row.querySelector(".lineTotal");
      if(qtyCell && priceCell && totalCell){
        const qty = parseFloat(qtyCell.textContent) || 0;
        const price = parseFloat(priceCell.textContent) || 0;
        const taxRate = taxSel ? parseFloat(taxSel.value) || 0 : 0;
        const lineTotal = qty * price * (1 + taxRate);
        totalCell.textContent = `£${lineTotal.toFixed(2)}`;
        grandTotal += lineTotal;
      }
    });
    const gTotal = document.getElementById("grandTotal");
    if(gTotal) gTotal.textContent = `£${grandTotal.toFixed(2)}`;
  }

  function attachRowEvents() {
    document.querySelectorAll("#quoteTable td[contenteditable]").forEach(cell => cell.addEventListener("input", recalcTotals));
    document.querySelectorAll("#quoteTable select[data-field='tax']").forEach(sel => sel.addEventListener("change", recalcTotals));
    document.querySelectorAll(".deleteRowBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const items = getCurrentItems();
        items.splice(parseInt(btn.dataset.index), 1);
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
      if(item && desc && qty && price){
        items.push({
          item: item.textContent.trim(),
          description: desc.textContent.trim(),
          quantity: parseFloat(qty.textContent) || 0,
          price: parseFloat(price.textContent) || 0,
          tax: taxSel ? parseFloat(taxSel.value) || 0 : 0
        });
      }
    });
    return items;
  }

  // --- INITIAL RENDER ---
  let itemsToRender = [];
  if (latest?.schema) {
    try {
      const parsed = JSON.parse(latest.schema);
      itemsToRender = Array.isArray(parsed) && parsed.length ? parsed : initialItems;
    } catch {
      itemsToRender = initialItems;
    }
  } else {
    itemsToRender = initialItems;
  }

  renderQuoteEditor(itemsToRender, hasInvoice);

  // Show/hide remove invoice button
  const removeInvoiceBtn = document.getElementById("removeInvoiceBtn");
  removeInvoiceBtn.style.display = hasInvoice ? "inline-block" : "none";

  // --- BUTTON HOOKS ---
  const addItemBtn = document.getElementById("addItemBtn");
  const saveQuoteBtn = document.getElementById("saveQuoteBtn");
  const sendQuoteBtn = document.getElementById("sendQuoteBtn");
  const sendAsInvoiceBtn = document.getElementById("sendAsInvoiceBtn");

  addItemBtn.onclick = () => {
    const items = getCurrentItems();
    items.push({ item: "New Item", description: "", quantity: 1, price: 0, tax: 0 });
    renderQuoteEditor(items);
  };

  async function saveOrSendQuote(isInvoice = false, stageName = "Quote") {
    const items = getCurrentItems();

    // Reload existing to ensure correct version
    existing = await select("invoicesAndQuotes", "*", { column: "bId", operator: "eq", value: bookingId });
    const version = existing.length ? Math.max(...existing.map(r => r.version || 0)) + 1 : 1;

    const recordId = crypto.randomUUID();
    await insert("invoicesAndQuotes", {
      id: recordId,
      bId: bookingId,
      version,
      createdBy: currentUser?.id || null,
      schema: JSON.stringify(items),
      type: isInvoice
    });

    // Lookup workflow stage ID for this org + action
    const workflowStages = await select("bookingWorkflows", "*", {
      column: "oId",
      operator: "eq",
      value: booking.oId
    });
    const stage = workflowStages.find(s => s.actionType === stageName);
    if (stage) {
      await insert("bookingWorkflowCompletion", {
        id: crypto.randomUUID(),
        bookingId,
        stageId: stage.id,   // ✅ use stageId, not name
        completedAt: new Date().toISOString(),
        completedby: currentUser?.id || null
      });
    }

    // Send email to client
    const [client] = await select("clients", "*", { column:"id", operator:"eq", value:booking.clientId });
    if(client?.email){
      const html = `
        <h2>${stageName} for ${booking.name}</h2>
        ${items.map(i=>`<p><strong>${i.item}</strong> (${i.quantity}x) - £${(i.price*(1+i.tax)).toFixed(2)}</p>`).join("")}
        <p><strong>Total:</strong> £${items.reduce((sum,i)=>sum+i.quantity*i.price*(1+i.tax),0).toFixed(2)}</p>
      `;
      await sendEmail({
        to: client.email,
        subject: `${stageName} for ${booking.name}`,
        message: html,
        forename: client.forename,
        surname: client.surname
      });
    }

    alert(`${stageName} saved and ${isInvoice ? "invoice" : "quote"} sent!`);
    loadInvoice(currentUser);
  }

  saveQuoteBtn.onclick = () => saveOrSendQuote(false, "Quote");
  sendQuoteBtn.onclick = () => saveOrSendQuote(false, "Quote");
  sendAsInvoiceBtn.onclick = () => saveOrSendQuote(true, "Invoice");

  removeInvoiceBtn.onclick = async () => {
    if(!latest?.type) return;
    await update("invoicesAndQuotes", { type:false }, { column:"id", operator:"eq", value:latest.id });
    alert(`Invoice reverted back to quote.`);
    loadInvoice(currentUser);
  };
}
