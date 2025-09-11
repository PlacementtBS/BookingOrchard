import { insert, update, select } from "../js/db.js";
import { showInsertPopup } from "../js/popup.js";

export function documentBuilderHTML() {
  return `
    <section class="fullHeight">
      <div>
        <h1>Document Builder</h1>
        <input type="text" id="docName" placeholder="Document Name">

        <div id="docToolbar" class="toolbar">
          <button type="button" data-cmd="bold"><b>B</b></button>
          <button type="button" data-cmd="italic"><i>I</i></button>
          <button type="button" data-cmd="underline"><u>U</u></button>
          <button type="button" data-cmd="strikeThrough"><s>S</s></button>
          <button type="button" data-cmd="insertOrderedList">OL</button>
          <button type="button" data-cmd="insertUnorderedList">UL</button>
          <button type="button" data-cmd="createLink">Link</button>
          <button type="button" data-cmd="removeFormat">Clear</button>
        </div>

        <div id="docEditor" contenteditable="true" class="editor" style="border:1px solid #ccc; padding:10px; min-height:300px;"></div>

        <div style="margin-top:10px;">
          <button class="primaryButton" id="saveDocument">Save Document</button>
        </div>
      </div>
    </section>
  `;
}

export async function documentBuilderAfterRender(currentUser) {
  const editor = document.getElementById("docEditor");
  const nameInput = document.getElementById("docName");

  // --- Get docId from URL if defined ---
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  const docId = urlParams.get("id") || null;

  // --- Load existing document if editing ---
  let documentData = null;
  if (docId) {
    const docs = await select("documents", "*", { column: "id", operator: "eq", value: docId });
    if (docs.length > 0) {
      documentData = docs[0];
      editor.innerHTML = documentData.content || "";
      nameInput.value = documentData.name || "";
    }
  }

  // --- Toolbar actions ---
  document.getElementById("docToolbar").addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    const cmd = button.dataset.cmd;

    if (cmd === "createLink") {
      const url = prompt("Enter the link URL:", "https://");
      if (url) document.execCommand(cmd, false, url);
    } else {
      document.execCommand(cmd, false, null);
    }

    editor.focus();
  });

  // --- Save document ---
  document.getElementById("saveDocument").addEventListener("click", async () => {
    const content = editor.innerHTML; // preserve formatting
    const docName = nameInput.value.trim();

    if (!docName) {
      alert("Please enter a document name.");
      return;
    }

    if (docId && documentData) {
      await update("documents", { content, name: docName }, { column: "id", operator: "eq", value: docId });
      alert("Document updated successfully!");
    } else {
      await insert("documents", { content, oId: currentUser.organisationId, name: docName });
      alert("Document created successfully!");
      editor.innerHTML = "";
      nameInput.value = "";
    }
  });
}
