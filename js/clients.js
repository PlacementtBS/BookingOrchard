import { insert, remove } from "./db.js";

export function createClient(forename,surname,email,phone,oId,company){
    insert("clients", {forename,surname,email,phone,oId,company});
}
export function deleteClient(id){
    remove("clients", {column:"id", operator:"eq",value:id});
}