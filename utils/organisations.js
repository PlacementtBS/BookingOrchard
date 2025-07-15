import { insert, select, update } from "./db.js";
import createAccount from "./auth.js";

export default async function createOrganisation(name, ufname, usname, uemail, upassword){
    const acc = await createAccount(ufname,usname,uemail,upassword);
        const users = await select("users", "*", {
          column: "email",
          operator: "eq",
          value: uemail
        });
    
        const user = users[0];
    if (user){
        insert("organisations", {
            name: name,
            admin: user.id
        },)
    
    const organisations = await select("organisations", "*", {
        column: "admin",
        operator: "eq",
        value: user.id
    },)
    const organisation = organisations[0];
    if(organisation){
        update("users",{organisationId:organisation.id},{
            column: "id",
            operator: "eq",
            value: user.id
        })
    }
    }

}