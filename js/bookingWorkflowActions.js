import { select, insert } from "./db.js";
import { sendEmail } from "./email.js";

export async function completeStage(bookingId, stageId, meta = {}) {
  if (!bookingId && stageId !== 0) throw new Error("Booking ID and stage ID required");

  // 1️⃣ Load booking
  const booking = (await select("bookings", "*", { column: "id", operator: "eq", value: bookingId }))[0];
  if (!booking) return;

  // 2️⃣ Load workflow stages for the organisation
  let workflow = await select("bookingWorkflows", "*", { column: "oId", operator: "eq", value: booking.oId }) || [];
  workflow.sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0));
  if (!workflow.length) return;

  // Resolve currentIndex
  let currentIndex;
  let currentStage;

  if (stageId === 0) {
    // Treat as if first step was just completed
    currentIndex = 0;
    currentStage = workflow[0];
  } else {
    currentIndex = workflow.findIndex(w => w.id === stageId);
    if (currentIndex < 0) return;
    currentStage = workflow[currentIndex];

    // Mark explicitly completed stage
    await insert("bookingWorkflowCompletion", {
      bookingId,
      stageId: currentStage.id,
      completedAt: new Date().toISOString()
    });
  }

  // 📨 Figure out client email
  const clients = await select("clients", "*") || [];
  const client = clients.find(c => c.id === booking.clientId);
  const clientEmail = client?.email || meta.email || "client@example.com";
  const origin = location.origin;

  // Helper: run a stage
  async function runStage(stage) {
    switch (stage.actionType) {
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

      case "Custom Form": {
        let schema = {};
        try { schema = stage.actionSchema ? JSON.parse(stage.actionSchema) : {}; }
        catch { schema = {}; }

        const formId = schema.options?.[0]?.value || "";
        const recipient = schema.options?.[1]?.value || "Client";

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
      }

      case "Schedule Staff":
      case "Quote":
      case "Invoice":
        // Nothing automatic to do
        return "manual";

      case "Booking Agreement": {
        let agreementSchema = {};
        try { agreementSchema = stage.actionSchema ? JSON.parse(stage.actionSchema) : {}; }
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
      }

      case "Send Email": {
        let emailSchema = {};
        try { emailSchema = stage.actionSchema ? JSON.parse(stage.actionSchema) : {}; }
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
        break;
      }

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
        break;

      default:
        console.warn("Unknown stage type:", stage.actionType);
        return "manual";
    }

    // ✅ Auto-complete this stage
    await insert("bookingWorkflowCompletion", {
      bookingId,
      stageId: stage.id,
      completedAt: new Date().toISOString()
    });

    return "auto";
  }

  // 3️⃣ Progress through stages
  let nextIndex = currentIndex + 1;
  while (nextIndex < workflow.length) {
    const result = await runStage(workflow[nextIndex]);
    if (result === "manual") break; // stop at first manual stage
    nextIndex++;
  }

  console.log(`Stage complete → progressed to index ${nextIndex} for booking ${bookingId}`);
}
