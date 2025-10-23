// /functions/api/rota.ics.js
import { select } from "../../js/db.js"; // adjust if your db helper is elsewhere

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const userId = url.searchParams.get("user");
  const token = url.searchParams.get("token");

  if (!userId || !token) {
    return new Response("Missing user or token", { status: 400 });
  }

  // Fetch the user from your database
  const [user] = await select("users", "*", {
    column: "id",
    operator: "eq",
    value: userId,
  });

  if (!user || user.calendarToken !== token) {
    return new Response("Invalid token", { status: 403 });
  }

  // Fetch rota assignments
  const assignments = await select("rotaAssignments", "*", {
    column: "uId",
    operator: "eq",
    value: userId,
  });

  const published = assignments.filter((a) => a.published);

  const fmtICSDate = (dateStr, timeStr = "09:00") => {
    const d = new Date(`${dateStr}T${timeStr}`);
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const events = published.map((a) => {
    const start = fmtICSDate(a.date, a.start);
    const end = fmtICSDate(a.date, a.end);
    const summary = a.role || "Shift";
    const desc = `Shift: ${summary}\nStart: ${a.start}\nEnd: ${a.end}`;
    return `
BEGIN:VEVENT
UID:${a.id}@yourdomain.com
DTSTAMP:${fmtICSDate(new Date().toISOString())}
DTSTART:${start}
DTEND:${end}
SUMMARY:${summary}
DESCRIPTION:${desc}
END:VEVENT
`;
  });

  const ics = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YourApp//Rota Calendar//EN
X-WR-CALNAME:${user.forename || "My"} Rota
X-WR-TIMEZONE:Europe/London
${events.join("")}
END:VCALENDAR
`;

  return new Response(ics.trim(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rota.ics"',
    },
  });
}
