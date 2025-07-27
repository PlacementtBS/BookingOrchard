import { insert } from "./db";

export default function createBooking(name, recurring, recurrence, startDate, endDate, oId, uId, requirements, clientId){
    await(insert("bookings", {name: name, recurring: recurring, recurrence: recurrence, startDate: startDate, endDate: endDate, oId:oId, uId: uId, requirements: requirements, clientId: clientId}))

}