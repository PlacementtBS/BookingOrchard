import { insert, select } from "./db.js";
import { sendEmail } from "./email.js";
import { completeStage } from "./bookingWorkflowActions.js";

/**
 * Create a new booking and initiate the workflow
 */
export default async function createBooking(name, recurring, recurrence, startDate, endDate, oId, uId, requirements, clientId) {
  try {
    // 1️⃣ Insert booking
    const bookingData = {
      name,
      recurring,
      recurrence,
      startDate,
      endDate,
      oId,
      uId,
      requirements,
      clientId
    };
    await insert("bookings", bookingData);

    console.log("Booking created:", bookingData);

    // 2️⃣ Retrieve the newly created booking to get its ID
    const bookings = await select("bookings", "*", { column: "name", operator: "eq", value: name }) || [];
    const booking = bookings.find(b => b.name === name && b.startDate === startDate && b.oId === oId);
    if (!booking) throw new Error("Booking not found after creation");

    const bookingId = booking.id;

    // 3️⃣ Get workflow stages for the organisation
    const workflow = await select("bookingWorkflows", "*", { column: "oId", operator: "eq", value: oId }) || [];
    workflow.sort((a,b) => (a.stageNumber || 0) - (b.stageNumber || 0));
    console.log("Workflow loaded for organisation:", workflow);

    // 4️⃣ Find stage 1 (first stage)
    const firstStage = workflow.find(s => s.stageNumber === 1);
    if (!firstStage) {
      console.warn("No stage 1 found for organisation:", oId);
      return;
    }

    // 5️⃣ Send completion link
    const link = `http://domain/#/requirements-form?bId=${bookingId}`;
    if (clientId) {
      // Send to client email
      const clients = await select("clients", "*") || [];
      const client = clients.find(c => c.id === clientId);
      if (client) {
        await sendEmail({
          to: client.email,
          subject: "Complete your booking requirements",
          message: `<p>Please complete your booking requirements using the link below:</p><p><a href="${link}">${link}</a></p>`,
          forename: client.forename,
          surname: client.surname
        });
        console.log("Email sent to client:", client.email);
      }
    } else {
      // Send to all users in the organisation
      const users = await select("users", "*", { column: "organisationId", operator: "eq", value: oId }) || [];
      for (const user of users) {
        await sendEmail({
          to: user.email,
          subject: "Booking requirements to complete",
          message: `<p>A new booking has been created. Please complete the requirements using the link below:</p><p><a href="${link}">${link}</a></p>`,
          forename: user.forename,
          surname: user.surname
        });
        console.log("Email sent to organisation user:", user.email);
      }
    }

    // 6️⃣ Mark stage 1 as started/completed automatically
    await completeStage(bookingId, firstStage.actionType);
    console.log(`Stage ${firstStage.actionType} triggered for booking ${bookingId}`);

  } catch (err) {
    console.error("Error creating booking:", err);
    throw err;
  }
}
