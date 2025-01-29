// Import necessary modules
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import readline from "readline";
import { formatDateToICS, createICSEvent } from "./src/utils/ics.js";

// Main function to process the CSV and generate the ICS file
export function generateICSFromCSV(
  csvFilePath: string,
  outputDirectory: string
): void {
  const events: string[] = [];
  let sectionContent: string | null = null;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const file = fs.createReadStream(csvFilePath);
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const processEvents = async () => {
        // If no section is found, prompt for it
        if (!sectionContent) {
          sectionContent = await new Promise<string>((resolve) => {
            rl.question(
              "No section name found. Please enter the section name (e.g., ACCT 2301): ",
              (answer) => {
                resolve(answer.trim());
              }
            );
          });
        }

        // Process the section name for the filename
        const sanitizedSectionName = sectionContent.replace(
          /[^a-zA-Z0-9]/g,
          ""
        );
        const outputFilePath = path.resolve(
          outputDirectory,
          `${sanitizedSectionName}.ics`
        );

        results.data.forEach((row: any) => {
          if (row.TYPE === "section") {
            sectionContent = row.CONTENT;
            return;
          }
          if (row.DEADLINE) {
            const startDate = formatDateToICS(row.DEADLINE);
            const uid = uuidv4();
            const eventName = row.CONTENT;
            const eventDescription =
              row.DESCRIPTION || "No description provided";
            const event = createICSEvent(
              `${eventName} | ${sectionContent || "Unknown Section"}`,
              startDate,
              uid,
              eventDescription
            );
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

// Run the script if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  const csvFilePath = path.resolve(__dirname, "ACCT2301.csv");
  const outputDirectory = __dirname;
  generateICSFromCSV(csvFilePath, outputDirectory);
}
