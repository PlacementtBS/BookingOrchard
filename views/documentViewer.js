import { select, insert } from "../js/db.js";

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

export async function documentViewerAfterRender(currentUser) {
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const docId = urlParams.get("id");
  const bId = urlParams.get("bId");

  if (!docId) return;

  // Fetch document
  const doc = (await select("documents", "*", { column: "id", operator: "eq", value: docId }))[0];
  if (!doc) {
    document.getElementById("documentTitle").textContent = "Document not found";
    return;
  }

  // Set document title and content
  document.getElementById("documentTitle").textContent = doc.name || "Untitled Document";
  document.getElementById("documentContent").innerHTML = doc.content || "<p>No content</p>";

  const actions = document.getElementById("docActions");
  const verdictEl = document.getElementById("docVerdict");

  // --- Check if user already responded ---
  const existing = await select("agreements", "*", {
    column: "docId", operator: "eq", value: docId
  });

  const userVerdict = existing.find(
    (r) => r.bId == bId && r.uId == currentUser.id
  );

  if (userVerdict) {
    // Hide buttons
    actions.style.display = "none";
    // Show verdict text
    verdictEl.textContent = userVerdict.verdict
      ? "✅ You accepted this document."
      : "❌ You rejected this document.";
    return;
  }

  // --- If no verdict exists, show buttons ---
  document.getElementById("reject").addEventListener("click", async () => {
    await insert("agreements", {
      docId: doc.id,
      oId: doc.oId,
      bId,
      uId: currentUser.id,
      verdict: false
    });
    location.reload(); // refresh view to hide buttons and show verdict
  });

  document.getElementById("accept").addEventListener("click", async () => {
    await insert("agreements", {
      docId: doc.id,
      oId: doc.oId,
      bId,
      uId: currentUser.id,
      verdict: true
    });
    location.reload();
  });
}
