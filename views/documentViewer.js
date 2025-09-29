import { select, insert } from "../js/db.js";
import { completeStage } from "../js/bookingWorkflowActions.js";
import { sendEmail } from "../js/email.js";

export default function documentViewerHTML() {
  return `
    <section class="fullHeight">
      <div>
        <h1 id="documentTitle">Loading...</h1>
        <hr>
        <div id="documentContent" style="white-space: pre-wrap;"></div>
        <div id="docActions" style="margin-top:10px;">
          <button id="reject" class="outlineButton">Reject</button>
          <button id="accept" class="primaryButton">Accept</button>
        </div>
        <div id="docVerdict" style="margin-top:10px; font-weight:bold;"></div>
      </div>
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
      // Look up booking + org workflow stage ID
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
