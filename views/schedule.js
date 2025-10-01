import { select, insert, update, remove } from "../js/db.js";

export default function rotaPage() {
  return `
<section>
  <div class="rota-headerBar">
    <h1>Staff Rota</h1>
    <button id="prevWeek" class="primaryButton">&lt; Prev Week</button>
    <button id="nextWeek" class="primaryButton">Next Week &gt;</button>
  </div>
</section>
<section class="rota-body" style="display:flex;">
  <div id="roleSidebarWrapper" class="role-sidebar-wrapper">
    <div id="roleSidebar" class="role-sidebar">
      <h2>Roles</h2>
      <div id="roleList"></div>
      <div class="role-actions">
        <input type="text" id="newRoleName" placeholder="New Role">
        <button id="addRoleBtn">Add Role</button>
      </div>
    </div>
    <button id="toggleRoleSidebar" class="toggle-button">⬅️</button>
  </div>

  <div class="rota-wrapper" id="rota-container" style="max-height:80vh;">
    <table id="rotaTable" class="rota-grid"></table>
  </div>
</section>

<div id="hoverCard" class="hover-card hidden"></div>

<div id="shiftModal" class="modal hidden">
  <div class="modal-content">
    <h2>Edit Shift</h2>
    <form id="shiftForm">
      <label>Staff:
        <select name="staff"></select>
      </label>
      <label>Start Time: <input type="time" name="start"></label>
      <label>End Time: <input type="time" name="end"></label>
      <div class="modal-buttons">
        <button type="submit">Save</button>
        <button type="button" id="deleteShift">Delete</button>
        <button type="button" id="cancelShift">Cancel</button>
      </div>
    </form>
  </div>
</div>
`;
}

export async function loadRota(currentUser) {
  const rotaTable = document.getElementById("rotaTable");
  if (!rotaTable) return;
  const roleList = document.getElementById("roleList");
  const hoverCard = document.getElementById("hoverCard");
  const shiftModal = document.getElementById("shiftModal");
  const shiftForm = document.getElementById("shiftForm");
  const slotsPerHour = 4;
  let dragDisabled = false;
  let currentEditShift = null;

  const addRoleBtn = document.getElementById("addRoleBtn");
  const newRoleInput = document.getElementById("newRoleName");

  let weekStart = new Date();
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (dow === 0 ? -6 : 1 - dow));
  weekStart.setHours(0, 0, 0, 0);

  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const parseTimeToSlot = t => t ? t.split(":").map(Number).reduce((a,v,i)=>i===0?a+v*slotsPerHour:a+Math.floor(v/(60/slotsPerHour)),0):null;
  const slotToTime = s => { const h=Math.floor(s/slotsPerHour); const m=(s%slotsPerHour)*(60/slotsPerHour); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; };

  let rotaData = { bookings: [], roles: [], assignments: [], users: [] };

  async function fetchRotaData() {
    const [bookings, roles, assignments, users] = await Promise.all([
      select("bookings","*",{column:"oId",operator:"eq",value:currentUser.organisationId}),
      select("rotaRoles","*",{column:"oId",operator:"eq",value:currentUser.organisationId}),
      select("rotaAssignments","*",{column:"weekStart",operator:"eq",value:ymd(weekStart)}),
      select("users","*",{column:"organisationId",operator:"eq",value:currentUser.organisationId})
    ]);
    rotaData = { bookings: bookings||[], roles: roles||[], assignments: assignments||[], users: users||[] };
  }

  function preserveScroll(fn) {
    const container = document.getElementById("rota-container");
    const scrollTop = container.scrollTop;
    fn();
    container.scrollTop = scrollTop;
  }

  function scrollToHour(hour = 8) {
    const container = document.getElementById("rota-container");
    const slot = hour * slotsPerHour;
    const row = rotaTable.querySelectorAll("tr")[slot+1]; // +1 for header
    if(row) container.scrollTop = row.offsetTop;
  }

  // --- ROLES ---
  async function renderRoles() {
    const roleColors = {};
    rotaData.roles.forEach((r,i)=>roleColors[r.id]=`hsl(${(i*60)%360},70%,60%)`);
    roleList.innerHTML = rotaData.roles.map(r => `
      <div class="role-item" draggable="true" data-roleid="${r.id}" style="border-left:6px solid ${roleColors[r.id]};">
        ${r.roleName}
        <span class="delete-role-bin" title="Delete Role" data-roleid="${r.id}" style="display:none; cursor:pointer; float:right;">🗑️</span>
      </div>`).join("");

    roleList.querySelectorAll(".role-item").forEach(el=>{
      el.ondragstart = e => {
        if(dragDisabled) e.preventDefault();
        else e.dataTransfer.setData("roleId", el.dataset.roleid);
      };
      el.onmouseenter = ()=> el.querySelector(".delete-role-bin").style.display="inline";
      el.onmouseleave = ()=> el.querySelector(".delete-role-bin").style.display="none";
    });

    roleList.querySelectorAll(".delete-role-bin").forEach(bin=>{
      bin.onclick=async e=>{
        e.stopPropagation();
        if(!confirm("Delete this role? This will remove all shifts with this role.")) return;
        await remove("rotaRoles",{column:"id",operator:"eq",value:bin.dataset.roleid});
        await remove("rotaAssignments",{column:"role",operator:"eq",value:bin.dataset.roleid});
        await fetchRotaData();
        preserveScroll(renderRoles);
        preserveScroll(renderWeek);
      };
    });
  }

  // --- WEEK TABLE ---
  async function renderWeek() {
    rotaTable.innerHTML = "";
    const days = Array.from({length:7},(_,i)=>{ const d=new Date(weekStart); d.setDate(d.getDate()+i); return d; });
    const dayKey = d=>ymd(d);
    const roleColors = {};
    rotaData.roles.forEach((r,i)=>roleColors[r.id]=`hsl(${(i*60)%360},70%,60%)`);

    // Maps
    const asgMap = new Map(days.map(d=>[dayKey(d),[]]));
    rotaData.assignments.forEach(a=>{
      if(!a.start) return;
      const s=parseTimeToSlot(a.start);
      const e=a.end?parseTimeToSlot(a.end):s+4*slotsPerHour;
      if(s==null||e==null) return;
      if(!asgMap.has(a.date)) asgMap.set(a.date,[]);
      asgMap.get(a.date).push({...a,startSlot:s,endSlot:e});
    });

    const bookingMap = new Map(days.map(d=>[dayKey(d),[]]));
    let bookingColors={}; let colorIndex=0;
    const colors=["#f48fb1","#ffcc80","#81d4fa","#b39ddb","#a5d6a7"];
    for(const b of rotaData.bookings){
      if(!bookingColors[b.id]) bookingColors[b.id]=colors[colorIndex++%colors.length];
      let timings={};
      try{timings=typeof b.timings==="string"?JSON.parse(b.timings):b.timings||{}}catch{}
      for(const dk of Object.keys(timings)){
        if(!bookingMap.has(dk)) continue;
        const t=timings[dk];
        const s=parseTimeToSlot(t.start); const e=parseTimeToSlot(t.end);
        if(s!=null && e!=null) bookingMap.get(dk).push({...t,id:b.id,name:b.name,startSlot:s,endSlot:e,color:bookingColors[b.id]});
      }
    }

    // Header
    const headerRow=document.createElement("tr");
    headerRow.innerHTML=`<th>Time</th>`+days.map(d=>`<th style="min-width:100px">${d.toDateString().slice(0,10)}</th>`).join("");
    rotaTable.appendChild(headerRow);

    const shiftColumnsMap = new Map();
    days.forEach(d=>{
      const dk=dayKey(d);
      const shiftsThisDay=asgMap.get(dk)||[];
      shiftColumnsMap.set(dk, assignShiftColumns(shiftsThisDay));
    });

    function assignShiftColumns(shifts){
      const columns=[];
      shifts.sort((a,b)=>a.startSlot-b.startSlot);
      shifts.forEach(s=>{
        let col=0;
        while(columns[col] && columns[col].some(o=>o.startSlot<s.endSlot && o.endSlot>s.startSlot)) col++;
        if(!columns[col]) columns[col]=[];
        columns[col].push(s);
        s.column=col;
      });
      return columns.length;
    }

    const bookingColumnsMap=new Map();
    days.forEach(d=>{
      const dk=dayKey(d);
      const dayBookings=bookingMap.get(dk)||[];
      assignBookingColumns(dayBookings);
      bookingColumnsMap.set(dk,dayBookings);
    });

    function assignBookingColumns(bookings){
      const columns=[];
      bookings.sort((a,b)=>a.startSlot-b.startSlot);
      bookings.forEach(b=>{
        let col=0;
        while(columns[col] && columns[col].some(o=>o.startSlot<b.endSlot && o.endSlot>b.startSlot)) col++;
        if(!columns[col]) columns[col]=[];
        columns[col].push(b);
        b.column=col;
      });
      return columns.length;
    }

    // Rows
    for(let slot=0;slot<24*slotsPerHour;slot++){
      const tr=document.createElement("tr");
      tr.innerHTML=`<th>${slotToTime(slot)}</th>`;
      for(const d of days){
        const dk=dayKey(d);
        const td=document.createElement("td");
        const innerDiv=document.createElement("div"); innerDiv.className="cell-inner"; td.appendChild(innerDiv);

        td.ondragover = e => e.preventDefault();
        td.ondrop = async e => {
          e.preventDefault();
          if(dragDisabled) return;
          const roleId = e.dataTransfer.getData("roleId");
          const shiftId = e.dataTransfer.getData("shiftId");
          if(roleId){
            const newShift = { role: roleId, date: dk, start: slotToTime(slot), end: slotToTime(slot+4), uId:null, weekStart: ymd(weekStart) };
            await insert("rotaAssignments", newShift);
          } else if(shiftId){
            await update("rotaAssignments", {date: dk, start: slotToTime(slot)}, {column:"id",operator:"eq",value:shiftId});
          }
          await fetchRotaData();
          preserveScroll(renderWeek);
        };

        const shiftCols = shiftColumnsMap.get(dk)||0;

        const bookingsThisSlot=bookingColumnsMap.get(dk)?.filter(b=>b.startSlot<=slot && b.endSlot>slot);
        if(bookingsThisSlot?.length){
          bookingsThisSlot.forEach(b=>{
            const div=document.createElement("div");
            div.className="booking-block";
            div.style.background=b.color;
            div.style.position="absolute";
            div.style.top="0";
            div.style.height="100%";
            div.style.left=`${shiftCols*30 + b.column*16}px`;
            div.style.right="0";
            div.style.zIndex=1;
            if(b.startSlot===slot) div.textContent=b.name;
            innerDiv.appendChild(div);
          });
        }

        const shiftsThisSlot=asgMap.get(dk)?.filter(s=>s.startSlot<=slot && s.endSlot>slot);
        if(shiftsThisSlot?.length){
          shiftsThisSlot.forEach((s)=>{
            const roleColor = roleColors[s.role]||"#666";
            const lineLeft = s.column*30;
            const line=document.createElement("div");
            line.className="shift-block-line";
            line.style.left=`${lineLeft}px`;
            line.style.top="0";
            line.style.height="100%";
            line.style.borderLeft=`3px solid ${roleColor}`;
            line.style.position="absolute";
            line.style.zIndex=5;
            innerDiv.appendChild(line);

            if(s.startSlot===slot){
              const user=rotaData.users.find(u=>u.id===s.uId);
              const initials=user?`${user.forename[0]}${user.surname[0]}`:"??";
              const imgDiv=document.createElement("div");
              imgDiv.className="shift-image";
              imgDiv.dataset.uid=s.uId||"";
              imgDiv.dataset.name=user?`${user.forename} ${user.surname}`:"Unassigned";
              imgDiv.dataset.role=rotaData.roles.find(r=>r.id===s.role)?.roleName||"Unknown";
              imgDiv.style.border=`2px solid ${roleColor}`;
              imgDiv.style.left=`${lineLeft-1}px`;

              const img=new Image();
              img.src=`https://jkvthdkqqckhipdlnpuk.supabase.co/storage/v1/object/public/profileImages/${s.uId}`;
              img.onerror=()=>{ imgDiv.textContent=initials; imgDiv.style.background=roleColor; };
              img.style.borderRadius="50%";
              imgDiv.appendChild(img);

              imgDiv.onmouseenter=(e)=>{
                hoverCard.innerHTML=`<strong>${imgDiv.dataset.name}</strong><br>${imgDiv.dataset.role}<br>${slotToTime(s.startSlot)} - ${slotToTime(s.endSlot)}`;
                hoverCard.style.top=e.pageY+"px";
                hoverCard.style.left=e.pageX+"px";
                hoverCard.classList.remove("hidden");
              };
              imgDiv.onmouseleave=()=>hoverCard.classList.add("hidden");

              imgDiv.onclick=async ()=>{
                dragDisabled=true;
                currentEditShift=s;
                const staffSelect=shiftForm.staff;
                staffSelect.innerHTML=`<option value="">Unassigned</option>`+rotaData.users.map(u=>`<option value="${u.id}" ${u.id===s.uId?'selected':''}>${u.forename} ${u.surname}</option>`).join("");
                shiftForm.start.value=slotToTime(s.startSlot);
                shiftForm.end.value=slotToTime(s.endSlot);
                shiftModal.classList.remove("hidden");
              };
              innerDiv.appendChild(imgDiv);
            }
          });
        }

        tr.appendChild(td);
      }
      rotaTable.appendChild(tr);
    }
  }

  // --- MODAL HANDLERS ---
  document.getElementById("cancelShift").onclick = ()=>{ shiftModal.classList.add("hidden"); dragDisabled=false; };
  document.getElementById("deleteShift").onclick = async ()=>{
    if(!currentEditShift) return;
    await remove("rotaAssignments",{column:"id",operator:"eq",value:currentEditShift.id});
    currentEditShift=null;
    shiftModal.classList.add("hidden");
    dragDisabled=false;
    await fetchRotaData();
    preserveScroll(renderWeek);
  };
  shiftForm.onsubmit=async e=>{
    e.preventDefault();
    if(!currentEditShift) return;
    const staff=shiftForm.staff.value||null;
    const start=shiftForm.start.value;
    const end=shiftForm.end.value;
    await update("rotaAssignments",{uId:staff,start,end},{column:"id",operator:"eq",value:currentEditShift.id});
    currentEditShift=null;
    shiftModal.classList.add("hidden");
    dragDisabled=false;
    await fetchRotaData();
    preserveScroll(renderWeek);
  };

  // --- WEEK NAV ---
  document.getElementById("prevWeek").onclick=async ()=>{
    weekStart.setDate(weekStart.getDate()-7);
    await fetchRotaData();
    preserveScroll(renderWeek);
  };
  document.getElementById("nextWeek").onclick=async ()=>{
    weekStart.setDate(weekStart.getDate()+7);
    await fetchRotaData();
    preserveScroll(renderWeek);
  };

  // --- TOGGLE SIDEBAR ---
  const sidebarWrapper = document.getElementById("roleSidebarWrapper");
  const toggleBtn = document.getElementById("toggleRoleSidebar");
  toggleBtn.onclick = () => {
    sidebarWrapper.classList.toggle("role-sidebar-collapsed");
    toggleBtn.textContent = sidebarWrapper.classList.contains("role-sidebar-collapsed") ? "➡️" : "⬅️";
  };

  // --- ADD ROLE ---
  addRoleBtn.onclick=async ()=>{
    const roleName=newRoleInput.value.trim();
    if(!roleName) return;
    await insert("rotaRoles",{roleName,oId:currentUser.organisationId});
    newRoleInput.value="";
    await fetchRotaData();
    preserveScroll(renderRoles);
    preserveScroll(renderWeek);
    scrollToHour(8);
  };

  // --- INITIAL LOAD ---
  await fetchRotaData();
  preserveScroll(renderRoles);
  preserveScroll(renderWeek);
  scrollToHour(8);

  // --- AUTO REFRESH EVERY 5s ---
  setInterval(async ()=>{
    await fetchRotaData();
    preserveScroll(renderRoles);
    preserveScroll(renderWeek);
  },5000);
}
