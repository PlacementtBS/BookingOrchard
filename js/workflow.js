import { select, update } from "./db.js";

export async function workflowAction(actionLink, booking, oId) {
  const workflowRecords = await select("workflows", "*", { column: "oId", operator: "eq", value: oId });
  const workflowRecord = workflowRecords[0];

  if (!workflowRecord) {
    console.error(`No workflow found for oId ${oId}`);
    return;
  }

  const results = workflowRecord.workflow.map(w => ({
    stage: w.stage,
    actionType: w.type,
    actionLink: w.link,
    actionCustomisation: w.customisation
  }));

  const currentStage = results.find(stage => stage.actionLink === actionLink);

  if (!currentStage) {
    console.warn(`No stage found matching actionLink: ${actionLink}`);
    return results;
  }

  const nextStageNumber = parseInt(currentStage.stage, 10) + 1;
  const nextStage = results.find(stage => parseInt(stage.stage, 10) === nextStageNumber) || null;

  if (nextStage) {
    try {
      await update(
        "bookings",
        { stage: nextStage.stage },
        { column: "id", operator: "eq", value: booking.id }
      );
    } catch (err) {
      console.error(`Failed to update booking stage to ${nextStage.stage}:`, err);
    }

    // Now check nextStage.actionType and act accordingly:
    if (nextStage.actionType === "form") {
      if (nextStage.actionCustomisation === "client") {
        // Get client recipient data
        const recipients = await select("clients", "*", {
          column: "id",
          operator: "eq",
          value: booking.clientId
        });
        const recipient = recipients[0];

        if (recipient) {
          exampleSendEmailFunction(actionLink, recipient);
        } else {
          console.warn(`No client found with id ${booking.clientId}`);
        }
      }
      // Add more customisations here if needed
    }

    // Add other actionType checks here, e.g.:
    // else if (nextStage.actionType === "notify") { ... }
  }

  return {
    currentStage,
    nextStage,
    allStages: results
  };
}

// Dummy example send email function for demo
function exampleSendEmailFunction(actionLink, recipient) {
  console.log(`Sending email for action ${actionLink} to recipient`, recipient);
  // your email sending logic here
}
