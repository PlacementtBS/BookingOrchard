import { insert } from "./db.js";

export default async function createBooking(name, recurring, recurrence, startDate, endDate, oId, uId, requirements, clientId) {
  await insert("bookings", {
    name,
    recurring,
    recurrence,
    startDate,
    endDate,
    oId,
    uId,
    requirements,
    clientId
  });
}
