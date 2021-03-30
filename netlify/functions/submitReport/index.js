"use strict";

const { loggedHandler } = require("../../lib/logger.js");
const { requirePermission, getUserinfo } = require("../../lib/auth.js");
const { base, duplicateBase } = require("../../lib/airtable.js");
const { logEvent } = require("../../lib/log.js");
const fetch = require("node-fetch");

const SKIP_TAG_PREFIX = "Skip: call back later";
const TRAINEE_ROLE_NAME = "Trainee";
const JOURNEYMAN_ROLE_NAME = "Journeyman";
const REVIEW_IF_UNCHANGED_NOTES_TAGS = new Set([
  "No: incorrect contact information",
  "No: will never be a vaccination site",
  "No: location permanently closed",
  "No: not open to the public",
]);
const REVIEW_ALWAYS_TAGS = new Set([
  "Yes: vaccinating 16+",
  "Yes: vaccinating 18+",
  "Yes: walk-ins accepted",
]);

class HTTPResponseError extends Error {
  constructor(response, ...args) {
    super(
      `HTTP Error Response: ${response.status} ${response.statusText}`,
      ...args
    );
    this.response = response;
  }
}

function shouldReview(event, roles) {
  // Flag based on user roles; 100% of trainee, 15% of journeyman
  if (roles.includes(TRAINEE_ROLE_NAME)) {
    return true;
  } else if (roles.includes(JOURNEYMAN_ROLE_NAME)) {
    if (Math.random() < 0.15) {
      return true;
    }
  }

  // Flag based on public notes containing email addresses or phone numbers
  if (event.Notes) {
    // This regex matches "(800)-123-4567", "+1 800 123 4567" and most things in between.
    const phoneNumberRegex = /\s+(\+?\d{1,2}(\s|-)*)?(\(\d{3}\)|\d{3})(\s|-)*\d{3}(\s|-)*\d{4}/;
    // This is very much not RFC-compliant, but generally matches common addresses.
    const emailRegex = /\S+@\S+\.\S+/;
    if (event.Notes.match(phoneNumberRegex)) {
      return true;
    } else if (event.Notes.match(emailRegex)) {
      return true;
    }
  }

  // Flag based on tags that we expect to be very infrequent
  const tags = new Set(event.Availability);
  let suspectTags = new Set( // Intersection
    [...tags].filter((value) => REVIEW_ALWAYS_TAGS.has(value))
  );
  if (suspectTags.size) {
    return true;
  }

  // Flag based on tags that require explanation; flag if their internal notes are unchanged
  if (
    [...tags].filter((value) => REVIEW_IF_UNCHANGED_NOTES_TAGS.has(value)).size
  ) {
    // Note that we trust the client to tell us the previous notes value; a
    // malicious client could thus fake having changed the internal notes in
    // order to escape being flagged.  A more correct implementation would be to
    // HMAC sign the internal notes in requestCall, and verify that signature
    // and compare it to the regenerate version of that here.
    const prev = event["Previous Internal Notes"] || "";
    const curr = event["Internal Notes"] || "";
    if (prev === curr) {
      return true;
    }
  }

  // If they checked the box, then we also mark it for review.
  return event.is_pending_review;
}

const handler = async (event, context, logger) => {
  const awaits = [];

  // save off a raw report in case something goes wrong below.
  awaits.push(
    logEvent({
      event,
      context,
      endpoint: "submitReport",
      name: "raw",
      payload: event.body,
    })
  );

  let input = null;
  try {
    input = JSON.parse(event.body);
  } catch (e) {
    await Promise.all(awaits);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "bad json" }),
    };
  }

  // validation, such as it is
  if (!input.Location || !input.Availability) {
    const output = { error: "location validation failed" };
    await logEvent({
      event,
      context,
      endpoint: "submitReport",
      name: "err",
      payload: JSON.stringify(output),
    });

    await Promise.all(awaits);
    return {
      statusCode: 400,
      body: JSON.stringify(output),
    };
  }

  // Start the dual-write to VIAL; it is not authoritative, so we swallow its
  // failures.  Because of that, it may also succeed even if we return 400 or
  // 500 due to failures in the Airtable path.
  awaits.push(
    new Promise(async (resolve) => {
      try {
        const response = await fetch(
          "https://vial-staging.calltheshots.us/api/submitReport",
          {
            method: "POST",
            body: event.body,
            headers: {
              Authorization: `Bearer ${context.identityContext.token}`,
            },
          }
        );
        if (!response.ok) {
          throw new HTTPResponseError(response);
        }
      } catch (err) {
        logger.error("failed to dual-write to VIAL", err);
        // No re-raise; this is not authoritative.
      }
      resolve();
    })
  );

  // if locations is not a list, make it one. convenience.
  if (!Array.isArray(input.Location)) {
    input.Location = [input.Location];
  }

  // Add user id to report
  Object.assign(input, {
    auth0_reporter_id: context.identityContext.claims.sub,
  });

  // fetch user info to add to report
  let roles = [];
  try {
    const userinfo = await getUserinfo(context.identityContext.token);
    roles = userinfo["https://help.vaccinateca.com/roles"] || [];
    Object.assign(input, {
      auth0_reporter_name: userinfo.name,
      auth0_reporter_roles: roles.join(","),
      // allow the client to turn on is_pending_review but never to turn it off
    });
  } catch (err) {
    logger.error({ err: err }, "Failed to get userinfo");
    // If we don't have information on the user (auth0 outage?) it's better to
    // flag the rows but keep going, so we don't lose the call data.
    Object.assign(input, {
      auth0_reporter_name: "UNKNOWN - authentication error: " + err,
      auth0_reporter_roles: "",
      is_pending_review: true,
    });
  }

  if (shouldReview(input, roles)) {
    input.is_pending_review = true;
  }
  delete input["Previous Internal Notes"];

  const creation = new Promise(async (resolve) => {
    try {
      const createdReport = await base("Reports").create([{ fields: input }]);
      const resultIds = (createdReport && createdReport.map((r) => r.id)) || [];
      const numericIds =
        (createdReport && createdReport.map((r) => r.fields.ID)) || [];
      resolve({
        statusCode: 200,
        body: JSON.stringify({
          created: resultIds,
          numeric: numericIds,
        }),
      });
    } catch (err) {
      await logEvent({
        event,
        context,
        endpoint: "submitReport",
        name: "err",
        payload: JSON.stringify({ error: err }),
      });
      logger.error({ err: err }, "Failed to insert to airtable");
      resolve({
        statusCode: 500,
        body: JSON.stringify({
          error: "airtable insert failed",
          message: err.message,
        }),
      });
    }
  });
  awaits.push(creation);

  if (duplicateBase) {
    awaits.push(
      new Promise(async (resolve) => {
        try {
          const duplicate = Object.assign({}, input);
          const lookupLocationId = input.Location[0];
          const locs = await duplicateBase("Locations")
            .select({
              maxRecords: 1,
              fields: ["Location ID"],
              filterByFormula: "{Location ID} = '" + lookupLocationId + "'",
            })
            .firstPage();
          if (locs.length > 0) {
            duplicate.Location = [locs[0].id];
          } else {
            duplicate.Location = [];
          }
          const result = await creation;
          if (result.statusCode == 200) {
            const responseBody = JSON.parse(result.body);
            duplicate["Original report ID"] = responseBody.created[0];
            duplicate["Original report numeric ID"] = responseBody.numeric[0];
          }
          await duplicateBase("Reports").create([{ fields: duplicate }]);
        } catch (err) {
          logger.error("Failed to dual-write to duplicate base", err);
          // No re-raise; this is for ease of QA and not authoritative.
        }
        resolve();
      })
    );
  }

  const result = await creation;
  if (result.statusCode != 200) {
    await Promise.all(awaits);
    return result;
  }

  // Update Locations to de-force-prioritize a call
  try {
    // if the call is non-skip, updated some other tables.
    if (
      input.Availability &&
      !input.Availability.some((x) => x.startsWith(SKIP_TAG_PREFIX))
    ) {
      const locationId = input.Location[0];
      logger.info("non-skip, updating location id", locationId);
      // kick off location update to set force-prioritize to false.
      const updatedLocation = await base("Locations").update([
        {
          id: locationId,
          fields: {
            call_priority: "99-not_prioritized",
          },
        },
      ]);

      const updatedId =
        updatedLocation && updatedLocation[0] && updatedLocation[0].id;
      logger.info("updated location", updatedId);
    }
  } catch (err) {
    logger.error("failed to update location on non-skip report", err);
  }

  await Promise.all(awaits);
  return result;
};

exports.handler = loggedHandler(requirePermission("caller", handler));
