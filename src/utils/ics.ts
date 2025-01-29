// Function to format date for iCalendar
export function formatDateToICS(date: string): string {
  // Remove time component and set to start of day
  const dateObj = new Date(date);
  const formatted = dateObj.toISOString().split("T")[0].replace(/-/g, "");
  return formatted; // Removed Z suffix for all-day events
}

// Function to create an iCalendar event
export function createICSEvent(
  summary: string,
  startDate: string,
  uid: string,
  description: string
): string {
  // Calculate end date (next day for all-day events)
  const dtStart = startDate;
  const dtEnd = new Date(
    parseInt(startDate.substring(0, 4)),
    parseInt(startDate.substring(4, 6)) - 1,
    parseInt(startDate.substring(6, 8)) + 1
  )
    .toISOString()
    .split("T")[0]
    .replace(/-/g, "");

  return `BEGIN:VEVENT
UID:${uid}
SUMMARY:${summary}
DESCRIPTION:${description}
DTSTART;VALUE=DATE:${dtStart}
DTEND;VALUE=DATE:${dtEnd}
DTSTAMP:${startDate}
END:VEVENT\n`;
}
