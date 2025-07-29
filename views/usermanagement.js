import { select } from "../js/db.js";
import { renderTablePage } from "../js/interacttable.js";

export function usersPageHtml(){
    return(`
        <section>
            <div id="users-table">

            </div>
        </section>
        `)
}
export async function loadUsersPage(currentUser){
    if(!currentUser){
        return
    }
    if(currentUser){
        const users = await select("users", "*", {column:"organisationId", operator:"eq", value:currentUser.organisationId});
    
    return(
    renderTablePage("users-table",
        {
            columns:["forename", "surname", "email"],
            friendlyNames:["Forename", "Surname", "Email"],
            data:users,
            tableName:"users",
            tableLabel:"Users",
            idColumn:"id",
            extraInsertFields:{
                organisationId:currentUser.organisationId
            },
            editable: false
        }
    )
)
}
    
}