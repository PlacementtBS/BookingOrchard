// /functions/api/rota.ics.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.33.0/dist/module/supabase.mjs";

// Supabase client
const supabaseUrl = "https://jkvthdkqqckhipdlnpuk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdnRoZGtxcWNraGlwZGxucHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTU2NTQsImV4cCI6MjA2NzQ5MTY1NH0.jQHWBy-jKpocqiRcgb3caYicjJPa-3tCpWkVdK7Y3Wg";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const userId = url.searchParams.get("user");
  const token = url.searchParams.get("token");

  if (!userId || !token) {
    return new Response("Missing user or token", { status: 400 });
  }

  // Fetch user
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .limit(1);

  if (userError || !users || users.length === 0) {
    return new Response("User not found", { status: 404 });
  }

  const user = users[0];
  if (user.calendarToken !== token) {
    return new Response("Invalid token", { status: 403 });
  }

  // Fetch rota assignments
  const { data: assignments, error: assignError } = await supabase
    .from("rotaAssignments")
    .select("*")
    .eq("uId", userId);

  if (assignError) {
    return new Response("Failed to fetch assignments", { status: 500 });
  }

  const published = assignments.filter(a => a.published);

  // Helper: format ICS date
  const fmtICSDate = (dateStr, timeStr) => {
    // If no start/end provided, default to 09:00-17:00
    const t = timeStr || (dateStr ? "09:00" : "00:00");
    const d = new Date(`${dateStr}T${t}`);
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const events = published.map(a => {
    const start = fmtICSDate(a.date, a.start);
    const end = fmtICSDate(a.date, a.end || "17:00");
    const summary = a.role || "Shift";
    const desc = `Shift: ${summary}\nStart: ${a.start || "TBC"}\nEnd: ${a.end || "TBC"}`;

    return `
BEGIN:VEVENT
UID:${a.id}@rota.yourdomain.com
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}
