import { select, insert, update, remove } from "../js/db.js";

export function bookingWorflowHTML() {
  return `
<section class="fullHeight">
  <div id="stages-container">
    <div class="stage-section" data-stage="enquiry">
      <h3>Enquiry</h3>
      <div class="stage-container" id="enquiry-container"></div>
    </div>

    <div class="stage-section" data-stage="confirmed">
      <h3>Event Confirmed</h3>
      <div class="stage-container" id="confirmed-container"></div>
    </div>

    <div class="stage-section" data-stage="during">
      <h3>During Event</h3>
      <div class="stage-container" id="during-container"></div>
    </div>

    <div class="stage-section" data-stage="after">
      <h3>After Event</h3>
      <div class="stage-container" id="after-container"></div>
    </div>
  </div>

  <div class="third">
    <h2>Options</h2>
    <div id="options" class="options-panel"></div>
  </div>
</section>

<style>
/* ... keep your existing styles ... */
</style>
  `;
}

export async function loadBookingWorkflow(currentUser) {

  async function reorderStages(){
    const allStages = await select("bookingWorkflows","*",{ column:"oId", operator:"eq", value:currentUser.organisationId })||[];
    allStages.sort((a,b)=>(a.stageNumber||0)-(b.stageNumber||0));
    let stageCounter = 1;
    const groups = ["enquiry","confirmed","during","after"];
    for(const g of groups){
      const groupStages = allStages.filter(s=>s.group===g);
      for(const s of groupStages){
        await update("bookingWorkflows",{ stageNumber: stageCounter++ },{ column:"id", operator:"eq", value:s.id });
      }
    }
  }

  const containers = {
    enquiry: document.getElementById("enquiry-container"),
    confirmed: document.getElementById("confirmed-container"),
    during: document.getElementById("during-container"),
    after: document.getElementById("after-container")
  };
  const optionsHTML = document.getElementById("options");

  Object.values(containers).forEach(c => { if(c) c.innerHTML=''; });
  optionsHTML.innerHTML='';

  const stageOptions = {
    enquiry: ["Booking Requirements Form", "Custom Form", "Schedule Staff", "Quote", "Booking Agreement", "Send Email"],
    confirmed: ["Event Confirmation", "Send Email"],
    during: ["Custom Form", "Send Email"],
    after: ["Send Email", "Custom Form", "Invoice"]
  };

  let workflow = await select("bookingWorkflows","*",{ column:"oId", operator:"eq", value:currentUser.organisationId })||[];
  workflow.sort((a,b)=>(a.stageNumber||0)-(b.stageNumber||0));

  const nonEditableTypes = [
    "Booking Requirements Form","Schedule Staff","Quote","Booking Agreement","Event Confirmation","Invoice"
  ];
  const nonRemovableTypes = ["Booking Requirements Form","Event Confirmation"];

  // Ensure Booking Requirements Form exists
  const hasRequirements = workflow.some(w=>w.actionType==="Booking Requirements Form");
  if(!hasRequirements){
    const insertObj = {
      oId: currentUser.organisationId,
      group: "enquiry",
      actionType: "Booking Requirements Form",
      stageNumber: 1,
      actionSchema: JSON.stringify({ title:"Booking Requirements Form", editable:false, options:[] })
    };
    await insert("bookingWorkflows", insertObj);
    workflow.unshift({...insertObj, id: crypto.randomUUID(), actionSchema: insertObj.actionSchema});
  }

  // Ensure Event Confirmation exists
  const hasConfirmation = workflow.some(w=>w.actionType==="Event Confirmation");
  if(!hasConfirmation){
    const insertObj = {
      oId: currentUser.organisationId,
      group: "confirmed",
      actionType: "Event Confirmation",
      stageNumber: workflow.length+1,
      actionSchema: JSON.stringify({ title:"Event Confirmation", editable:false, options:[] })
    };
    await insert("bookingWorkflows", insertObj);
    workflow.push({...insertObj, id: crypto.randomUUID(), actionSchema: insertObj.actionSchema});
  }

  await reorderStages();

  workflow = await select("bookingWorkflows","*",{ column:"oId", operator:"eq", value:currentUser.organisationId })||[];
  workflow.sort((a,b)=>(a.stageNumber||0)-(b.stageNumber||0));

  // ------------------------
// RENDER CARD
// ------------------------
async function renderCard(action, container){
  const schema = typeof action.actionSchema==="string" ? JSON.parse(action.actionSchema) : (action.actionSchema||{});
  const editable = schema.editable===true;
  const title = schema.title || action.actionType || "Stage";

  const wrapper = document.createElement("div");
  wrapper.className = "card-wrapper";

  const groupStages = workflow.filter(s => s.group === action.group);
  const idx = groupStages.findIndex(s => s.id === action.id);

  // --- add button BEFORE card (only if first in section)
  if(idx === 0){
    const addBefore = document.createElement("button");
    addBefore.className = "add-step-btn";
    addBefore.textContent = "+ Step";
    addBefore.onclick = ()=>renderOptions(action.group);
    wrapper.appendChild(addBefore);
  }

  const card = document.createElement("div"); 
  card.className="workflow-card";

  const contentDiv = document.createElement("div"); 
  contentDiv.className="card-content";

  const h4 = document.createElement("h4");
  h4.textContent = editable ? title : action.actionType;

  if(editable){
    const editBtn = document.createElement("button");
    editBtn.textContent = "✎";
    editBtn.className = "inline-btn edit-btn";
    editBtn.onclick = async()=>await renderEditForm(card,action,schema);
    h4.appendChild(editBtn);
  }

  if(!nonRemovableTypes.includes(action.actionType)){
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "🗑";
    removeBtn.className = "deleteMarker";
    removeBtn.onclick = async()=>{
      if(confirm(`Remove "${action.actionType}" stage?`)){
        await remove("bookingWorkflows",{ column:"id", operator:"eq", value:action.id });
        await reorderStages();
        await loadBookingWorkflow(currentUser);
      }
    };
    h4.appendChild(removeBtn);
  }

  contentDiv.appendChild(h4);

  if(schema.options && schema.options.length>0){
    const ul=document.createElement("ul");
    for(const o of schema.options){
      const li=document.createElement("li");
      if(action.actionType === "Booking Agreement"){
        let docName = "No document selected";
        if(o.value){ 
          const doc = await select("documents","*",{column:"id",operator:"eq",value:o.value});
          if(doc && doc[0]) docName = doc[0].name;
        }
        li.textContent = `Document: ${docName}`;
      } else if(action.actionType === "Custom Form") {
        const form = await select("customForms","*",{column:"id",operator:"eq",value:o.value});
        li.textContent = `Form: ${form?.[0]?.name || "Unknown"}`;
      } else {
        li.textContent = `${o.label}: ${o.value}`;
      }
      ul.appendChild(li);
    }
    contentDiv.appendChild(ul);
  }

  card.appendChild(contentDiv);

  // --- arrows
  const arrows=document.createElement("div"); 
  arrows.className="arrow-container";

  if(idx > 0){ 
    const upBtn=document.createElement("button"); 
    upBtn.className="arrow-btn"; 
    upBtn.textContent="↑";
    upBtn.onclick=async()=>{ await swapStage(action.id,-1); await loadBookingWorkflow(currentUser); }; 
    arrows.appendChild(upBtn); 
  }
  if(idx < groupStages.length-1){ 
    const downBtn=document.createElement("button"); 
    downBtn.className="arrow-btn"; 
    downBtn.textContent="↓";
    downBtn.onclick=async()=>{ await swapStage(action.id,1); await loadBookingWorkflow(currentUser); }; 
    arrows.appendChild(downBtn); 
  }
  card.appendChild(arrows);

  wrapper.appendChild(card);

  // --- add button AFTER card (only if NOT the last in section)
  if(idx < groupStages.length - 1){
    const addAfter = document.createElement("button");
    addAfter.className = "add-step-btn";
    addAfter.textContent = "+ Step";
    addAfter.onclick = ()=>renderOptions(action.group);
    wrapper.appendChild(addAfter);
  }

  container.appendChild(wrapper);
}


  // ------------------------
  // RENDER EDIT FORM
  // ------------------------
  async function renderEditForm(card,action,schema){
    card.innerHTML=""; 
    const form=document.createElement("form");

    // (same as before – no changes)
    // ...
    
    const saveBtn=document.createElement("button");
    saveBtn.type="button"; saveBtn.textContent="Save";
    saveBtn.onclick=async()=>{
      const newSchema={...schema, options:[]};
      if(action.actionType==="Custom Form"){
        const formSelect = form.querySelector("select[name=formName]");
        const selectedFormId = formSelect.value;
        const selectedFormName = formSelect.options[formSelect.selectedIndex].text;

        newSchema.options=[
          {label:"Form", value:selectedFormId},
          {label:"Recipient", value:form.querySelector("select[name=recipient]").value}
        ];
        newSchema.title = selectedFormName;
      }
      if(action.actionType==="Send Email"){
        newSchema.options=[
          {label:"Recipient", value:form.querySelector("select[name=recipient]").value},
          {label:"Subject", value:form.querySelector("input[placeholder='Subject']").value},
          {label:"Message", value:form.querySelector("textarea[placeholder='Message']").value}
        ];
      }
      if(action.actionType==="Booking Agreement"){
        newSchema.options=[{label:"Document", value:form.querySelector("select[name=documentId]").value}];
      }
      await update("bookingWorkflows",{ actionSchema: JSON.stringify(newSchema) },{ column:"id", operator:"eq", value:action.id });
      await loadBookingWorkflow(currentUser);
    };
    form.appendChild(saveBtn);
    card.appendChild(form);
  }

  // ------------------------
  // ADD STAGE
  // ------------------------
  async function addStage(stage,opt){
    let actionSchema={title:opt, editable:false, options:[]};

    if(opt==="Custom Form"){
      const customForms=await select("customForms","*",{ column:"oId", operator:"eq", value:currentUser.organisationId })||[];
      const firstForm = customForms[0];
      const formId = firstForm?.id || crypto.randomUUID();
      const formName = firstForm?.name || "Default Form";
      const recipient = "Client";

      actionSchema={title:formName, editable:true, options:[{label:"Form", value:formId},{label:"Recipient",value:recipient}]};

      const duplicate = workflow.some(w=>{
        const s=typeof w.actionSchema==="string"?JSON.parse(w.actionSchema):w.actionSchema||{};
        return s.options && s.options[0] && s.options[0].value===formId;
      });
      if(duplicate){ alert("This form is already added."); return; }
    }

    if(opt==="Send Email"){ 
      actionSchema={title:"Send Email", editable:true, options:[{label:"Recipient",value:"Client"},{label:"Subject",value:""},{label:"Message",value:""}]}; 
    }

    if(opt==="Booking Agreement"){
      actionSchema={title:"Booking Agreement", editable:true, options:[{label:"Document", value:""}]};
    }

    const stageNumber = workflow.length ? Math.max(...workflow.map(w=>w.stageNumber||0))+1 : 1;
    await insert("bookingWorkflows",{ oId:currentUser.organisationId, group:stage, actionType:opt, stageNumber, actionSchema:JSON.stringify(actionSchema) });
    await reorderStages();
    await loadBookingWorkflow(currentUser);
  }

  // ------------------------
  // SWAP STAGES
  // ------------------------
  async function swapStage(id,direction){
    const allStages=await select("bookingWorkflows","*",{ column:"oId", operator:"eq", value:currentUser.organisationId })||[];
    allStages.sort((a,b)=>(a.stageNumber||0)-(b.stageNumber||0));
    const idx=allStages.findIndex(s=>s.id===id); if(idx<0) return;
    const swapIdx=idx+direction; if(swapIdx<0||swapIdx>=allStages.length) return;
    await update("bookingWorkflows",{ stageNumber: allStages[idx].stageNumber },{ column:"id", operator:"eq", value:allStages[swapIdx].id });
    await update("bookingWorkflows",{ stageNumber: allStages[swapIdx].stageNumber },{ column:"id", operator:"eq", value:allStages[idx].id });
  }

  // ------------------------
  // RENDER OPTIONS
  // ------------------------
  function renderOptions(stage){
    optionsHTML.innerHTML="";
    const usedTypes = workflow.map(w=>w.actionType);
    stageOptions[stage].forEach(opt=>{
      if(["Booking Requirements Form","Schedule Staff","Quote","Booking Agreement","Event Confirmation","Invoice"].includes(opt) && usedTypes.includes(opt)) return;
      const row=document.createElement("div"); 
      row.className="option-row";
      row.textContent = opt; // ✅ plain text, no icons
      row.onclick=()=>addStage(stage,opt);
      optionsHTML.appendChild(row);
    });
  }

  // ------------------------
  // FINAL RENDER
  // ------------------------
  workflow.forEach(stageItem=>{
    const container = containers[stageItem.group];
    if(!container) return;
    renderCard(stageItem, container);
  });

  Object.keys(containers).forEach(group=>{
    const container = containers[group];
    const addBtn = document.createElement("button");
    addBtn.className="add-step-btn";
    addBtn.textContent="+ Step";
    addBtn.onclick = ()=>renderOptions(group);
    container.appendChild(addBtn);
  });

  Object.keys(containers).forEach(stage=>{
    const h3=document.querySelector(`.stage-section[data-stage="${stage}"] h3`);
    if(h3) h3.onclick=()=>renderOptions(stage);
  });
}
