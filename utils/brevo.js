import { select } from "./db.js";

export async function sendEmail(template, recipient) {
    let rec, temp;

    try {
        console.log("🔍 Looking up user with id:", recipient);
        rec = await select("users", "*", {
            column: "id",
            operator: "eq",
            value: recipient
        });
        console.log("📋 User lookup result:", rec);
        if (!rec || rec.length === 0) {
            throw new Error(`No user found with id: ${recipient}`);
        }
    } catch (err) {
        console.error("❌ Error selecting user:", err);
        alert(`Error fetching user: ${err.message}`);
        return;
    }

    try {
        console.log("🔍 Looking up template with id:", template);
        temp = await select("etemplates", "*", {
            column: "id",
            operator: "eq",
            value: template
        });
        console.log("📋 Template lookup result:", temp);
        if (!temp || temp.length === 0) {
            throw new Error(`No template found with id: ${template}`);
        }
    } catch (err) {
        console.error("❌ Error selecting template:", err);
        alert(`Error fetching template: ${err.message}`);
        return;
    }

    const data = {
        forename: rec[0].forename,
        surname: rec[0].surname,
        email: rec[0].email,
        message: temp[0].html,
        subject: temp[0].subject
    };

    console.log("📨 Data to send:", data);

    try {
        const res = await fetch('https://send-email.bscott2219.workers.dev/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server returned ${res.status}: ${text}`);
        }

        const json = await res.json();
        console.log("✅ Email sent successfully:", json);
        alert(json.message);
    } catch (err) {
        console.error("❌ Error sending email:", err);
        alert(`Error sending email: ${err.message}`);
    }
}
