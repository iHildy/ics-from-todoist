import express from "express";
import { TodoistApi } from "@doist/todoist-api-typescript";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { formatDateToICS, createICSEvent } from "./utils/ics.js";

// Load environment variables
console.log("Starting server initialization...");
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable JSON body parsing for webhooks
app.use(express.json());

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
console.log("Initializing Todoist API client...");
const api = new TodoistApi(process.env.TODOIST_API_TOKEN || "");

// Function to fetch and process tasks from Todoist
async function generateCalendarContent(projectId: string): Promise<string> {
  try {
    console.log(`[Calendar Generation] Starting for project ${projectId}`);

    // Fetch tasks
    console.log(`[Calendar Generation] Fetching tasks...`);
    const tasks = await api.getTasks({ projectId });
    console.log(`[Calendar Generation] Found ${tasks.length} tasks`);

    // Fetch project details
    console.log(`[Calendar Generation] Fetching project details...`);
    const project = await api.getProject(projectId);
    console.log(`[Calendar Generation] Project name: ${project.name}`);

    const events: string[] = [];

    // Process each task
    console.log(`[Calendar Generation] Processing tasks...`);
    for (const task of tasks) {
      if (task.due?.date) {
        console.log(
          `[Calendar Generation] Processing task: "${task.content}" due ${task.due.date}`
        );
        const startDate = formatDateToICS(task.due.date);
        const uid = uuidv4();
        const description = task.description || "No description provided";

        const event = createICSEvent(
          `${task.content} | ${project.name}`,
          startDate,
          uid,
          description,
          task.id
        );
        events.push(event);
        console.log(
          `[Calendar Generation] Added event for task: ${task.content} (ID: ${task.id})`
        );
      } else {
        console.log(
          `[Calendar Generation] Skipping task without due date: ${task.content}`
        );
      }
    }

    console.log(
      `[Calendar Generation] Generated ${events.length} calendar events`
    );

    // Generate final iCal content
    console.log(`[Calendar Generation] Generating final iCal content...`);
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Todoist Calendar Sync//EN",
      "X-WR-CALNAME:" + project.name,
      ...events,
      "END:VCALENDAR",
    ].join("\n");

    console.log(
      `[Calendar Generation] Successfully generated calendar content`
    );
    return icsContent;
  } catch (error) {
    console.error("[Calendar Generation] Error:", error);
    throw error;
  }
}

// Middleware to validate Todoist API token
app.use((req, res, next) => {
  if (!process.env.TODOIST_API_TOKEN) {
    console.error("[Error] Todoist API token not configured");
    return res.status(500).send("Todoist API token not configured");
  }
  next();
});

// Root endpoint with instructions
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Todoist Calendar Sync</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 2em auto; padding: 0 1em; line-height: 1.6; }
          code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Todoist Calendar Sync</h1>
        <p>To use this service:</p>
        <ol>
          <li>Get your Todoist project ID from the project URL (e.g., <code>projectName-9ZTqLmDkrYyBWKhN</code>)</li>
          <li>Use the following URL format in your calendar app:</li>
          <code>http://localhost:${port}/calendar/YOUR_PROJECT_ID</code>
        </ol>
        <p>Example: <code>http://localhost:${port}/calendar/projectName-9ZTqLmDkrYyBWKhN</code></p>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("[Health Check] Received health check request");
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Handle old URL format and redirect
app.get("/:projectName-:projectId", (req, res) => {
  const { projectId } = req.params;
  console.log(
    `[Redirect] Redirecting old URL format to /calendar/${projectId}`
  );
  res.redirect(`/calendar/${projectId}`);
});

// Endpoint to get calendar for a specific project
app.get("/calendar/:projectId", async (req, res) => {
  const { projectId } = req.params;
  console.log(`[Request] Received calendar request for project ${projectId}`);

  try {
    // Check cache
    const cached = calendarCache[projectId];
    const now = new Date();

    if (
      cached &&
      now.getTime() - cached.lastUpdated.getTime() < CACHE_DURATION
    ) {
      console.log(`[Cache] Serving cached content for project ${projectId}`);
      res.set("Content-Type", "text/calendar");
      return res.send(cached.content);
    }

    // Generate new calendar content
    console.log(
      `[Request] Cache miss, generating fresh content for project ${projectId}`
    );
    const calendarContent = await generateCalendarContent(projectId);

    // Update cache
    console.log(`[Cache] Updating cache for project ${projectId}`);
    calendarCache[projectId] = {
      content: calendarContent,
      lastUpdated: now,
    };

    res.set("Content-Type", "text/calendar");
    res.send(calendarContent);
    console.log(
      `[Request] Successfully served calendar for project ${projectId}`
    );
  } catch (error) {
    console.error(
      `[Error] Failed to generate calendar for project ${projectId}:`,
      error
    );

    // Check if it's a 404 error from Todoist
    if (error instanceof Error && error.message.includes("404")) {
      res.status(404).json({
        error: "Project not found",
        message:
          "The specified Todoist project could not be found. Please check your project ID.",
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: "Error generating calendar",
        message:
          "There was an error generating your calendar. Please try again later.",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

// Webhook endpoint for Todoist updates
app.post("/webhook", async (req, res) => {
  console.log("[Webhook] Received Todoist webhook");
  const { project_id } = req.body;
  const receivedToken = req.headers["x-todoist-verification-token"];

  // Verify the token
  if (receivedToken !== process.env.TODOIST_VERIFICATION_TOKEN) {
    console.error("[Webhook] Verification token mismatch");
    return res.status(403).send("Forbidden: Invalid verification token");
  }

  if (project_id) {
    console.log(`[Webhook] Processing update for project ${project_id}`);
    if (calendarCache[project_id]) {
      console.log(`[Cache] Invalidating cache for project ${project_id}`);
      delete calendarCache[project_id];
    }
  } else {
    console.log("[Webhook] No project_id in webhook payload");
  }

  res.status(200).send("OK");
});

// Handle 404s
app.use((req, res) => {
  res.status(404).send(`
    <html>
      <head>
        <title>404 - Page Not Found</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 2em auto; padding: 0 1em; line-height: 1.6; }
          code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>404 - Page Not Found</h1>
        <p>The correct URL format is: <code>http://localhost:${port}/calendar/YOUR_PROJECT_ID</code></p>
        <p>Example: <code>http://localhost:${port}/calendar/projectName-9ZTqLmDkrYyBWKhN</code></p>
        <p><a href="/">Return to homepage</a></p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`[Server] Running at http://localhost:${port}`);
  console.log(
    `[Server] Todoist API token ${
      process.env.TODOIST_API_TOKEN ? "is" : "is NOT"
    } configured`
  );
  console.log(
    `[Server] Cache duration set to ${CACHE_DURATION / 1000} seconds`
  );
  console.log("[Server] Ready to serve calendar requests");
});
