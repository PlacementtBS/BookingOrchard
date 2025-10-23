import { select, insert } from "../js/db.js";
import { completeStage } from "../js/bookingWorkflowActions.js";
import { sendEmail } from "../js/email.js";

export default function documentViewerHTML() {
  return `
    <section class="fullHeight doc-viewer">
      <div class="doc-container">
        <h1 id="documentTitle">Loading...</h1>
        <hr class="doc-divider">
        <div id="documentContent" class="doc-content"></div>

        <div id="docActions" class="doc-actions">
          <button id="reject" class="outlineButton">Reject</button>
          <button id="accept" class="primaryButton">Accept</button>
        </div>

        <div id="docVerdict" class="doc-verdict"></div>
      </div>

      <style>
  /* Reset all padding, margin, and gap inside the viewer */
 
  .doc-viewer {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 2rem;
    height:fit-content;
  }

  .doc-container {
    max-width: 900px;
    width: 100%;
    padding: 2rem;
    border-radius: 10px;
  }

  #documentTitle {
    font-size: 2rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .doc-divider {
    height: 1px;
    background: #ddd;
    border: none;
    margin-bottom: 1.5rem;
  }

  .doc-content {
    font-family: "Times New Roman", Times, serif;
    font-size: 1rem;
    line-height: 1.6;
    color: #222;

    margin-bottom: 1.5rem;
  }

  .doc-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .doc-actions button {
    cursor: pointer;
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }

  .doc-verdict {
    font-weight: bold;
    font-size: 1.1rem;
  }

  /* Tables and images inside document content */
  .doc-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }
  .doc-content th, .doc-content td {
    border: 1px solid #ccc;
    padding: 0.5rem;
    text-align: left;
  }
  .doc-content th {
    background: #f0f0f0;
  }
  .doc-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.5rem 0;
  }
</style>

    </section>
  `;
}

export async function documentViewerAfterRender() {
  const urlParams = new URLSearchParams(location.hash.split("?")[1]);
  const docId = urlParams.get("id");
  const bId = urlParams.get("bId");
  const email = urlParams.get("email");

  if (!docId) return;

  const doc = (await select("documents", "*", { column: "id", operator: "eq", value: docId }))[0];
  if (!doc) {
    document.getElementById("documentTitle").textContent = "Document not found";
    return;
  }

  document.getElementById("documentTitle").textContent = doc.name || "Untitled Document";
  document.getElementById("documentContent").innerHTML = doc.content || "<p>No content</p>";

  const actions = document.getElementById("docActions");
  const verdictEl = document.getElementById("docVerdict");

  const existing = await select("agreements", "*", { column: "docId", operator: "eq", value: docId });
  const userVerdict = existing.find(r => r.bId == bId && r.signatureInfo?.includes(email || ""));

  if (userVerdict) {
    actions.style.display = "none";
    let infoText = "";
    try { infoText = `<pre>${JSON.stringify(JSON.parse(userVerdict.signatureInfo || "{}"), null, 2)}</pre>`; } catch {}
    verdictEl.innerHTML = userVerdict.verdict
      ? "✅ Document accepted.<br>" + infoText
      : "❌ Document rejected.<br>" + infoText;
    return;
  }

  function getSignatureInfo() {
    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || null,
      url: window.location.href,
      ip: null,
      email: email || null
    };
  }

  async function fetchIp() {
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      return data.ip || null;
    } catch {
      return null;
    }
  }

  const signatureInfo = getSignatureInfo();
  signatureInfo.ip = await fetchIp();

  // --- Accept flow ---
  document.getElementById("accept").addEventListener("click", async () => {
    await insert("agreements", {
      docId: doc.id,
      oId: doc.oId,
      bId,
      verdict: true,
      signatureInfo: JSON.stringify(signatureInfo)
    });

    try {
      const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: bId }))[0];
      if (booking) {
        const workflow = await select("bookingWorkflows", "*", { column: "oId", operator: "eq", value: booking.oId });
        const agreementStage = workflow.find(w => w.actionType === "Booking Agreement");
        if (agreementStage) {
          await completeStage(bId, agreementStage.id, { email });
        }
      }
    } catch (err) {
      console.error("Error completing Booking Agreement stage:", err);
    }

    location.reload();
  });

  // --- Reject flow ---
  document.getElementById("reject").addEventListener("click", async () => {
    await insert("agreements", {
      docId: doc.id,
      oId: doc.oId,
      bId,
      verdict: false,
      signatureInfo: JSON.stringify(signatureInfo)
    });

    try {
      const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: bId }))[0];
      if (booking) {
        const orgUsers = await select("users", "*", { column: "organisationId", operator: "eq", value: booking.oId });
        for (const u of orgUsers) {
          if (u.email) {
            await sendEmail({
              to: u.email,
              subject: "Booking Agreement Rejected",
              message: `<p>The booking agreement for <strong>${booking.name}</strong> has been rejected by the client.</p>`,
              forename: u.forename || "",
              surname: u.surname || ""
            });
          }
        }
      }
    } catch (err) {
      console.error("Error sending rejection emails:", err);
    }

    location.reload();
  });
};
