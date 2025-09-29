export async function sendEmail({ to, subject, message, forename = "", surname = "" }) {
    // --- Prepare email payload ---
    const data = {
        forename,
        surname,
        email: to,
        subject,
        message
    };

    console.log("📨 Data to send:", data);

    // --- Send request to email worker ---
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
        return json;
    } catch (err) {
        console.error("❌ Error sending email:", err);
        throw err;
    }
}
/*
await sendEmail({
    to: "test@example.com",
    subject: "Booking Confirmation",
    message: "<p>Thanks for booking with us!</p>",
    forename: "Ben",
    surname: "Scott"
});
*/
