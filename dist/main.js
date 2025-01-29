// Import necessary modules
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import readline from 'readline';
// Function to format date for iCalendar
export function formatDateToICS(date) {
    // Remove time component and set to start of day
    const dateObj = new Date(date);
    const formatted = dateObj.toISOString().split('T')[0].replace(/-/g, '');
    return formatted; // Removed Z suffix for all-day events
}
// Function to create an iCalendar event
export function createICSEvent(summary, startDate, uid, description) {
    // Calculate end date (next day for all-day events)
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
// Main function to process the CSV and generate the ICS file
export function generateICSFromCSV(csvFilePath, outputDirectory) {
    const events = [];
    let sectionContent = null;
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const file = fs.createReadStream(csvFilePath);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const processEvents = async () => {
                // If no section is found, prompt for it
                if (!sectionContent) {
                    sectionContent = await new Promise((resolve) => {
                        rl.question('No section name found. Please enter the section name (e.g., ACCT 2301): ', (answer) => {
                            resolve(answer.trim());
                        });
                    });
                }
                // Process the section name for the filename
                const sanitizedSectionName = sectionContent.replace(/[^a-zA-Z0-9]/g, '');
                const outputFilePath = path.resolve(outputDirectory, `${sanitizedSectionName}.ics`);
                results.data.forEach((row) => {
                    if (row.TYPE === "section") {
                        sectionContent = row.CONTENT;
                        return;
                    }
                    if (row.DEADLINE) {
                        const startDate = formatDateToICS(row.DEADLINE);
                        const uid = uuidv4();
                        const eventName = row.CONTENT;
                        const eventDescription = row.DESCRIPTION || "No description provided";
                        const event = createICSEvent(`${eventName} | ${sectionContent || 'Unknown Section'}`, startDate, uid, eventDescription);
                        events.push(event);
                    }
                });
                // Write the ICS file
                const icsContent = [
                    "BEGIN:VCALENDAR",
                    "VERSION:2.0",
                    "PRODID:-//Your App//EN",
                    ...events,
                    "END:VCALENDAR",
                ].join("\n");
                fs.writeFileSync(outputFilePath, icsContent);
                console.log(`ICS file generated: ${outputFilePath}`);
                rl.close();
            };
            processEvents().catch(console.error);
        },
        error: (err) => {
            console.error("Error processing CSV:", err);
            rl.close();
        },
    });
}
// Run the script
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const csvFilePath = path.resolve(__dirname, "ACCT2301.csv");
const outputDirectory = __dirname;
generateICSFromCSV(csvFilePath, outputDirectory);
