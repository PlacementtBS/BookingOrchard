// /functions/api/rota.ics.js

// Supabase REST info
const SUPABASE_URL = 'https://jkvthdkqqckhipdlnpuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdnRoZGtxcWNraGlwZGxucHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTU2NTQsImV4cCI6MjA2NzQ5MTY1NH0.jQHWBy-jKpocqiRcgb3caYicjJPa-3tCpWkVdK7Y3Wg';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// helper to call Supabase REST
async function supabaseFetch(table, query = {}) {
  const params = new URLSearchParams();
  for (const key in query) {
    params.append(key, `eq.${query[key]}`);
  }
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json();
}

// format ICS date with timezone reference
function fmtICSDate(dateStr, timeStr = '09:00') {
  const d = new Date(`${dateStr}T${timeStr}`);
  // return as YYYYMMDDTHHMMSS
  return d.toISOString().replace(/[-:]/g, '').split('.')[0];
}

// CRLF helper for ICS compliance
function crlf(str) {
  return str.replace(/\n/g, '\r\n');
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const userId = url.searchParams.get('user');
  const token = url.searchParams.get('token');

  if (!userId || !token) return new Response('Missing user or token', { status: 400 });

  // fetch user
  let users;
  try {
    users = await supabaseFetch('users', { id: userId });
  } catch (e) {
    return new Response('Failed to fetch user', { status: 500 });
  }

  if (!users || users.length === 0) return new Response('User not found', { status: 404 });

  const user = users[0];
  if (user.calendarToken !== token) return new Response('Invalid token', { status: 403 });

  // fetch rota assignments
  let assignments;
  try {
    assignments = await supabaseFetch('rotaAssignments', { uId: userId });
  } catch (e) {
    return new Response('Failed to fetch assignments', { status: 500 });
  }

  const published = assignments.filter(a => a.published);

  // Build ICS events
  const events = published.map(a => {
    const uid = `${a.id}-${userId}@bookingorchard.com`;
    const dtstamp = fmtICSDate(new Date().toISOString());
    const dtstart = fmtICSDate(a.date, a.start);
    const dtend = fmtICSDate(a.date, a.end);
    const summary = a.role || 'Shift';
    const description = `Shift: ${summary}\nStart: ${a.start}\nEnd: ${a.end}`;

    return `
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}Z
DTSTART;TZID=Europe/London:${dtstart}
DTEND;TZID=Europe/London:${dtend}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT
`;
  }).join('');

  // Full ICS calendar with timezone info
  const ics = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BookingOrchard//Rota Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${user.forename || 'My'} Rota
X-WR-TIMEZONE:Europe/London
BEGIN:VTIMEZONE
TZID:Europe/London
X-LIC-LOCATION:Europe/London
BEGIN:STANDARD
TZOFFSETFROM:+0100
TZOFFSETTO:+0000
DTSTART:19701025T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
TZNAME:GMT
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETFROM:+0000
TZOFFSETTO:+0100
DTSTART:19700329T010000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
TZNAME:BST
END:DAYLIGHT
END:VTIMEZONE
${events}
END:VCALENDAR
`;

  return new Response(crlf(ics.trim()), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="rota.ics"'
    }
  });
}
