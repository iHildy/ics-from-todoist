# Todoist Calendar Sync

This application creates a dynamic iCal feed from your Todoist projects that can be imported into Google Calendar or other calendar applications.

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Create a `.env` file in the root directory with your Todoist API token:
   ```
   TODOIST_API_TOKEN=your_todoist_api_token_here
   PORT=3000
   ```
   You can get your API token from Todoist Settings -> Integrations -> API token

4. Build and start the server:
   ```bash
   npm run build
   npm start
   # or
   yarn build
   yarn start
   ```

## Usage

1. Get your Todoist project ID from the project URL in Todoist web interface
   - Open your project in Todoist
   - The URL will look like: `https://todoist.com/app/project/1234567890`
   - The number at the end is your project ID

2. Use the following URL format to get your calendar:
   ```
   http://localhost:3000/calendar/YOUR_PROJECT_ID
   ```

3. Add this URL to Google Calendar:
   - In Google Calendar, click the + next to "Other calendars"
   - Select "From URL"
   - Paste your calendar URL
   - Click "Add calendar"

The calendar will automatically update when tasks in Todoist are modified. The server caches responses for 5 minutes to prevent excessive API calls.

## Features

- Dynamic iCal feed generation from Todoist projects
- Automatic updates when tasks change
- Response caching for better performance
- Webhook support for instant updates
- All-day event support
- Project name included in calendar name

## Development

To run in development mode with auto-reload:
```bash
npm run dev
# or
yarn dev
``` 