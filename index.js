const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { uuid } = require("uuidv4");
const app = express();

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */

app.use(express.json());
const port = 3000;

const startHttpServer = (async = () => {
  try {
    app.listen(port, () =>
      console.log(`Example app listening at http://localhost:${port}`)
    );
  } catch (error) {
    console.log(error);
  }
});
startHttpServer();

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
const loadClient = async () => {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  let client = await loadSavedCredentialsIfExist();

  const key = keys.installed || keys.web;
  const auth = new google.auth.OAuth2(
    key.client_id,
    key.client_secret,
    key.redirect_urls
  );
  auth.setCredentials({ refresh_token: client.credentials.refresh_token });
  google.options({ auth });
};

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

app.post("/create-events", (req, res) => {
  createEvents((events) => res.json(events));
});
app.post("/delete-events", async (req, res) => {
  const calendar = google.calendar({ version: "v3" });
  const event = await calendar.events.delete({
    calendarId: req.body.calendarId,
    eventId: req.body.eventId,
    sendNotifications: true,
  });
  res.json(event);
});

app.post("/update-events", async (req, res) => {
  const calendar = google.calendar({ version: "v3" });
  await calendar.events.update({
    calendarId: req.body.calendarId,
    eventId: req.body.eventId,
    resource: {
      description: req.body.description,
      location: req.body.location,
      start: {
        dateTime: "2023-01-18T16:15:00+05:30",
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: "2023-01-18T17:15:00+05:30",
        timeZone: "Asia/Kolkata",
      },
      summary: req.body.summary,
      timeZone: req.body.timeZone,
    },
  });
  res.send("updated");
});
app.get("/get-events", async (req, res) => {
  const calendar = google.calendar({ version: "v3" });
  // Get the events that changed during the webhook timestamp by using timeMin property.
  const event = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    // maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });
  // console.log(event.data.items);
  // log in the console the total events that changed since the webhook was called.
  res.json(event.data.items);
  // return res.status(200).send("Webhook received");
});
app.post("/webhook/:syncToken", async (request, reply) => {
  const resourceState = request.headers["x-goog-resource-state"];
  const { syncToken } = request.params;
  // Use the channel token to validate the webhook
  if (resourceState === "sync") {
    return reply.status(200).send();
  }

  console.log(request?.body);

  // Authorization details for google API are explained in previous steps.
  const calendar = google.calendar({ version: "v3" });
  // console.log(channelToken, resourceState);

  // Get the events that changed during the webhook timestamp by using timeMin property.
  const event = await calendar.events.list({
    calendarId: "primary",
    syncToken: syncToken,
  });
  // log in the console the total events that changed since the webhook was called.
  console.log(event.data.items);
  // console.log(reply.status(200).send("Webhook received"));

  return reply.send("Webhook Received");
});
// async function updateEvents(callback) {}

async function createEvents(callback) {
  const calendar = google.calendar({ version: "v3" });
  const event = {
    summary: "Google I/O 2023",
    location: "800 Howard St., San Francisco, CA 94103",
    description: "A chance to hear more about Google's developer products.",
    start: {
      dateTime: "2023-01-13T10:00:00+05:30",
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: "2023-01-16T17:00:00+05:30",
      timeZone: "Asia/Kolkata",
    },
    recurrence: ["RRULE:FREQ=DAILY;COUNT=2"],
    attendees: [
      { email: "lalithsaran19@gmail.com" },
      { email: "lalithsaran28@gmail.com" },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 10 },
      ],
    },
  };
  calendar.events.insert(
    {
      calendarId: "primary",
      resource: event,
    },
    (err, event) => {
      if (err) {
        console.log(
          "There was an error contacting the Calendar service: " + err
        );
        return;
      }
      callback(event);
    }
  );
}

loadClient().then(async () => {
  const calendar = google.calendar({ version: "v3" });

  const syncToken = await calendar.settings.list();

  console.log(syncToken?.data?.nextSyncToken);

  const data = await calendar.events.watch({
    resource: {
      id: uuidv4(),
      type: "web_hook",
      address: `https://996a-103-207-6-203.ngrok.io/webhook/${syncToken?.data?.nextSyncToken}`,
      syncToken: syncToken?.data?.nextSyncToken,
    },
    calendarId: "primary",
  });
  console.log(data?.data);
});
