// Import necessary modules
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import readline from "readline";
import cliProgress from "cli-progress";
import { formatDateToICS, createICSEvent } from "./src/utils/ics.js";
// Main function to process the CSV and generate the ICS file
export function generateICSFromCSV(csvFilePath, outputDirectory, filter) {
    const events = [];
    let sectionContent = null;
    let rlClosed = false;
    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
        format: 'Converting tasks |{bar}| {percentage}% | {value}/{total} tasks | ETA: {eta}s',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true
    });
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    function closeRL() {
        if (!rlClosed) {
            rl.close();
            rlClosed = true;
        }
    }
    const file = fs.createReadStream(csvFilePath);
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const processEvents = async () => {
                // Count total tasks with deadlines first
                const totalTasks = results.data.filter((row) => row.DEADLINE).length;
                // If no section is found, prompt for it (only if stdin is interactive)
                if (!sectionContent) {
                    if (process.stdin.isTTY) {
                        sectionContent = await new Promise((resolve) => {
                            rl.question("No section name found. Please enter the section name (e.g., ACCT 2301): ", (answer) => {
                                resolve(answer.trim());
                            });
                        });
                    }
                    else {
                        sectionContent = "Unknown";
                        console.log("No section found in CSV, using 'Unknown'");
                    }
                }
                // Process the section name for the filename
                let sanitizedSectionName = sectionContent.replace(/[^a-zA-Z0-9]/g, "");
                // Append filter to filename if provided
                if (filter) {
                    sanitizedSectionName += `_filtered_${filter.replace(/[^a-zA-Z0-9]/g, "")}`;
                    console.log(`Filtering tasks matching: "${filter}"`);
                }
                const outputFilePath = path.resolve(outputDirectory, `${sanitizedSectionName}.ics`);
                // Start progress bar
                if (totalTasks > 0) {
                    progressBar.start(totalTasks, 0);
                }
                let processedCount = 0;
                results.data.forEach((row) => {
                    if (row.TYPE === "section") {
                        sectionContent = row.CONTENT;
                        return;
                    }
                    if (row.DEADLINE) {
                        const eventName = row.CONTENT;
                        // Apply filter if provided
                        if (filter && !eventName.toLowerCase().includes(filter.toLowerCase())) {
                            processedCount++;
                            progressBar.update(processedCount);
                            return;
                        }
                        const startDate = formatDateToICS(row.DEADLINE);
                        const uid = uuidv4();
                        const eventDescription = row.DESCRIPTION || "No description provided";
                        const event = createICSEvent(`${eventName} | ${sectionContent || "Unknown Section"}`, startDate, uid, eventDescription);
                        events.push(event);
                        processedCount++;
                        progressBar.update(processedCount);
                    }
                });
                // Stop progress bar
                progressBar.stop();
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
                closeRL();
            };
            processEvents().catch(console.error);
        },
        error: (err) => {
            console.error("Error processing CSV:", err);
            closeRL();
        },
    });
}
// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-anything" && i + 1 < args.length) {
            result.filter = args[i + 1];
            i++;
        }
        else if (args[i].endsWith(".csv")) {
            result.csvFile = args[i];
        }
        else if (!args[i].startsWith("-")) {
            result.outputDir = args[i];
        }
    }
    return result;
}
// Run the script if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    const args = parseArgs();
    const csvFilePath = args.csvFile
        ? path.resolve(args.csvFile)
        : path.resolve(__dirname, "ACCT2301.csv");
    const outputDirectory = args.outputDir
        ? path.resolve(args.outputDir)
        : __dirname;
    generateICSFromCSV(csvFilePath, outputDirectory, args.filter);
}
