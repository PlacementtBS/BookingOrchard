import { select } from "../js/db.js";

export function usersPageHtml(){
    return(`
        <section>
            <div id="users-cards" class="users-cards-container">

            </div>
        </section>
        <style>
            .users-cards-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1rem;
                padding: 1rem;
            }
            .user-card {
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 12px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                padding: 1rem;
                transition: transform 0.2s ease;
            }
            .user-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 4px 10px rgba(0,0,0,0.12);
            }
            .user-card h3 {
                margin: 0 0 0.25rem;
                font-size: 1.1rem;
                font-weight: 600;
            }
            .user-card p {
                margin: 0.2rem 0;
                color: #555;
                font-size: 0.9rem;
            }
        </style>
        `)
}

export async function loadUsersPage(currentUser){
    if(!currentUser){
        return;
    }

    const users = await select("users", "*", { 
        column: "organisationId", 
        operator: "eq", 
        value: currentUser.organisationId 
    });

    const container = document.getElementById("users-cards");
    if(!container) return;

    container.innerHTML = users.map(user => `
        <div class="user-card">
            <h3>${user.forename} ${user.surname}</h3>
            <p><strong></strong> ${user.position}</p>
            <a href="mailto:${user.email}">${user.email}</a>
            <div>
                <button class="outlineButton">Reset Password</button>
                <button class="outlineButton">Deactivate</button>
            </div>
        </div>
    `).join("");
}
