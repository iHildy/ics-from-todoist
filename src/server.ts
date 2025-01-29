import express from "express";
import { TodoistApi } from "@doist/todoist-api-typescript";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { formatDateToICS, createICSEvent } from "../main.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Cache for storing calendar data
interface CalendarCache {
  [projectId: string]: {
    content: string;
    lastUpdated: Date;
  };
}

const calendarCache: CalendarCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Initialize Todoist API client
const api = new TodoistApi(process.env.TODOIST_API_TOKEN || "");

// Function to fetch and process tasks from Todoist
async function generateCalendarContent(projectId: string): Promise<string> {
  try {
    const tasks = await api.getTasks({ projectId });
    const project = await api.getProject(projectId);

    const events: string[] = [];

    for (const task of tasks) {
      if (task.due?.date) {
        const startDate = formatDateToICS(task.due.date);
        const uid = uuidv4();
        const description = task.description || "No description provided";

        const event = createICSEvent(
          `${task.content} | ${project.name}`,
          startDate,
          uid,
          description
        );
        events.push(event);
      }
    }

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Todoist Calendar Sync//EN",
      "X-WR-CALNAME:" + project.name,
      ...events,
      "END:VCALENDAR",
    ].join("\n");

    return icsContent;
  } catch (error) {
    console.error("Error generating calendar content:", error);
    throw error;
  }
}

// Middleware to validate Todoist API token
app.use((req, res, next) => {
  if (!process.env.TODOIST_API_TOKEN) {
    return res.status(500).send("Todoist API token not configured");
  }
  next();
});

// Endpoint to get calendar for a specific project
app.get("/calendar/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check cache
    const cached = calendarCache[projectId];
    const now = new Date();

    if (
      cached &&
      now.getTime() - cached.lastUpdated.getTime() < CACHE_DURATION
    ) {
      res.set("Content-Type", "text/calendar");
      return res.send(cached.content);
    }

    // Generate new calendar content
    const calendarContent = await generateCalendarContent(projectId);

    // Update cache
    calendarCache[projectId] = {
      content: calendarContent,
      lastUpdated: now,
    };

    res.set("Content-Type", "text/calendar");
    res.send(calendarContent);
  } catch (error) {
    console.error("Error serving calendar:", error);
    res.status(500).send("Error generating calendar");
  }
});

// Webhook endpoint for Todoist updates
app.post("/webhook", express.json(), async (req, res) => {
  const { project_id } = req.body;

  if (project_id && calendarCache[project_id]) {
    // Invalidate cache for this project
    delete calendarCache[project_id];
  }

  res.status(200).send("OK");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
