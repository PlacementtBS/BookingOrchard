import { select, insert } from "./db.js";
import { sendEmail } from "./email.js";

export async function completeStage(bookingId, stageId, meta = {}) {
  if (!bookingId || !stageId) throw new Error("Booking ID and stage ID required");

  // 1️⃣ Load booking
  const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: bookingId }))[0];
  if (!booking) return;

  // 2️⃣ Load workflow stages for the organisation
  let workflow = await select("bookingWorkflows", "*", { column: "oId", operator: "eq", value: booking.oId }) || [];
  workflow.sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0));

  const currentIndex = workflow.findIndex(w => w.id === stageId);
  if (currentIndex < 0) return;
  const currentStage = workflow[currentIndex];

  // 3️⃣ Mark current stage as completed
  await insert("bookingWorkflowCompletion", {
    bookingId,
    stageId: currentStage.id,
    completedAt: new Date().toISOString()
  });

  // 📨 Figure out client email
  const clients = await select("clients", "*") || [];
  const client = clients.find(c => c.id === booking.clientId);
  const clientEmail = client?.email || meta.email || "client@example.com";
  const origin = location.origin;

  // 4️⃣ Special case: If first stage is "Booking Requirements", send right away
  if (currentIndex === 0 && currentStage.actionType === "Booking Requirements") {
    await sendEmail({
      to: clientEmail,
      subject: "Booking Requirements Form – Action Required",
      message: `<p>Dear ${client?.forename || ""},</p>
                <p>Please complete your booking requirements form:</p>
                <p><a href="${origin}/#/requirements-form?bid=${booking.id}" target="_blank">Open Form</a></p>
                <p>Thank you.</p>`,
      forename: client?.forename || "",
      surname: client?.surname || ""
    });
  }

  // 5️⃣ Get next stage
  const nextStage = workflow[currentIndex + 1];
  if (!nextStage) return; // no next stage

  try {
    switch (nextStage.actionType) {

      case "Booking Requirements":
        await sendEmail({
          to: clientEmail,
          subject: "Booking Requirements Form – Action Required",
          message: `<p>Dear ${client?.forename || ""},</p>
                    <p>Please complete your booking requirements form:</p>
                    <p><a href="${origin}/#/requirements-form?bid=${booking.id}" target="_blank">Open Form</a></p>
                    <p>Thank you.</p>`,
          forename: client?.forename || "",
          surname: client?.surname || ""
        });
        break;

      case "Custom Form":
        let schema = {};
        try { schema = nextStage.actionSchema ? JSON.parse(nextStage.actionSchema) : {}; }
        catch { schema = {}; }

        const formId = schema.options[0].value || "";
        const recipient = schema.options[1].value || "Client";

        if (recipient === "Client") {
          await sendEmail({
            to: clientEmail,
            subject: "Custom Form – Action Required",
            message: `<p>Dear ${client?.forename || ""},</p>
                      <p>Please complete the form:</p>
                      <p><a href="${origin}/#/form?id=${formId}&bId=${booking.id}" target="_blank">Open Form</a></p>`,
            forename: client?.forename || "",
            surname: client?.surname || ""
          });
        } else if (recipient === "Admin") {
          const users = await select("users", "*", { column: "organisationId", operator: "eq", value: booking.oId });
          for (const u of users) {
            await sendEmail({
              to: u.email,
              subject: "Custom Form – Action Required",
              message: `<p>Please complete the form:</p>
                        <p><a href="${origin}/#/form?id=${formId}&bId=${booking.id}" target="_blank">Open Form</a></p>`
            });
          }
        }
        break;

      case "Schedule Staff":
      case "Quote":
      case "Invoice":
        // Nothing to do
        break;

      case "Booking Agreement":
        let agreementSchema = {};
        try { agreementSchema = nextStage.actionSchema ? JSON.parse(nextStage.actionSchema) : {}; }
        catch { agreementSchema = {}; }

        const docOption = agreementSchema.options?.find(o => o.label === "Document");
        const docId = docOption?.value;
        if (docId) {
          const doc = (await select("documents", "*", { column: "id", operator: "eq", value: docId }))[0];
          if (doc) {
            const agreementLink = `${origin}/#/agreements?id=${doc.id}&bId=${booking.id}&email=${encodeURIComponent(clientEmail)}`;
            await sendEmail({
              to: clientEmail,
              subject: "Booking Agreement – Action Required",
              message: `<p>Dear ${client?.forename || ""},</p>
                        <p>Please review and sign your booking agreement:</p>
                        <p><a href="${agreementLink}" target="_blank">View Agreement</a></p>`
            });
          }
        }
        break;

      case "Send Email":
        let emailSchema = {};
        try { emailSchema = nextStage.actionSchema ? JSON.parse(nextStage.actionSchema) : {}; }
        catch { emailSchema = {}; }

        const recipientType = emailSchema.recipient || "Client";

        if (recipientType === "Admin") {
          const users = await select("users", "*", { column: "organisationId", operator: "eq", value: booking.oId });
          for (const u of users) {
            await sendEmail({
              to: u.email,
              subject: emailSchema.subject || "Notification",
              message: emailSchema.message || "<p>Please review the update.</p>"
            });
          }
        } else {
          await sendEmail({
            to: clientEmail,
            subject: emailSchema.subject || "Notification",
            message: emailSchema.message || "<p>Please review the update.</p>"
          });
        }

        // ✅ Mark Send Email stage completed automatically
        await insert("bookingWorkflowCompletion", {
          bookingId,
          stageId: nextStage.id,
          completedAt: new Date().toISOString()
        });
        break;

      case "Event Confirmation":
        const bookingInfo = `
          <p>Booking: ${booking.name}</p>
          <p>Dates: ${new Date(booking.startDate).toLocaleDateString("en-GB")} - ${new Date(booking.endDate).toLocaleDateString("en-GB")}</p>
          <p>Notes: ${booking.notes || "None"}</p>
        `;
        await sendEmail({
          to: clientEmail,
          subject: "Event Confirmation",
          message: `<p>Dear ${client?.forename || ""},</p>${bookingInfo}<p>Thank you.</p>`
        });

        // ✅ Mark Event Confirmation stage completed automatically
        await insert("bookingWorkflowCompletion", {
          bookingId,
          stageId: nextStage.id,
          completedAt: new Date().toISOString()
        });
        break;

      default:
        console.warn("Unknown stage type:", nextStage.actionType);
    }

    console.log(`Stage complete → initialized next stage '${nextStage.actionType}' for booking ${bookingId}`);

  } catch (err) {
    console.error("Error initializing next stage:", err);
  }
}
