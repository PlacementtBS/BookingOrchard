import { select } from "../js/db.js";
import { supabase } from "../js/supabaseUpload.js";

export function settingsPage(currentUser) {
  return (`
    <section>
      <div>
        <h1>User Profile</h1>
        <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
          <div style="position:relative; width:100px; height:100px;">
            <img id="profileImage" 
                 style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:2px solid #ccc;" 
                 alt="Profile Image"/>
            <input type="file" id="profileImageInput" accept="image/*" style="display:none;" />
            <button id="uploadProfileBtn" 
                    style="position:absolute; bottom:0; right:0; font-size:0.8rem; padding:2px 6px;">
              📷
            </button>
          </div>
          <div>
            <table class="static">
              <tr>
                <td><h4>Name</h4></td>
                <td>${currentUser.forename} ${currentUser.surname}</td>
              </tr>
              <tr>
                <td><h4>Email</h4></td>
                <td>${currentUser.email}</td>
              </tr>
              <tr>
                <td><h4>Organisation</h4></td>
                <td id="org">Loading...</td>
              </tr>
              <tr>
                <td><h4>Account Created</h4></td>
                <td>${new Date(currentUser.created_at).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </section>
  `);
}

export async function loadSettings(currentUser) {
  // --- Organisation ---
  const orgs = await select("organisations", "*", {
    column: "id",
    operator: "eq",
    value: currentUser.organisationId
  });
  if (orgs.length > 0) {
    document.getElementById("org").innerText = orgs[0].name;
  }

  // --- Profile Image Handling ---
  const imgEl = document.getElementById("profileImage");
  const inputEl = document.getElementById("profileImageInput");
  const uploadBtn = document.getElementById("uploadProfileBtn");

  const path = currentUser.id; // always extension-less

  // Helper to load existing image
  async function loadProfileImage() {
    const { data, error } = supabase
      .storage.from("profileImages")
      .getPublicUrl(path);

    if (!error && data?.publicUrl) {
      imgEl.src = `${data.publicUrl}?t=${Date.now()}`; // cache-bust
    } else {
      imgEl.src = "https://placehold.co/100x100?text=User";
    }
  }

  await loadProfileImage();

  // Upload handler
  uploadBtn.addEventListener("click", () => inputEl.click());

  inputEl.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Always remove existing first
      await supabase.storage.from("profileImages").remove([path]);

      // Upload without extension
      const { error: uploadError } = await supabase.storage
        .from("profileImages")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type, // preserve image MIME
        });

      if (uploadError) throw uploadError;

      await loadProfileImage();
      console.log("Profile image uploaded!");
    } catch (err) {
      console.error("Error uploading profile image:", err);
      alert("Failed to upload profile image.");
    }
  });
}
