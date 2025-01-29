// Move the existing ICS generation functions to this file
export function formatDateToICS(date) {
    const dateObj = new Date(date);
    const formatted = dateObj.toISOString().split('T')[0].replace(/-/g, '');
    return formatted;
}
export function createICSEvent(summary, startDate, uid, description) {
    const dtStart = startDate;
    const dtEnd = new Date(parseInt(startDate.substring(0, 4)), parseInt(startDate.substring(4, 6)) - 1, parseInt(startDate.substring(6, 8)) + 1)
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '');
    const summaryParts = summary.split(" | ");
    const baseSummary = summaryParts[0];
    const sectionName = summaryParts.length > 1 ? summaryParts[1] : summaryParts[0];
    return `BEGIN:VEVENT
UID:${uid}
SUMMARY:${baseSummary} | ${sectionName}
DESCRIPTION:${description}
DTSTART;VALUE=DATE:${dtStart}
DTEND;VALUE=DATE:${dtEnd}
DTSTAMP:${startDate}
END:VEVENT\n`;
}
