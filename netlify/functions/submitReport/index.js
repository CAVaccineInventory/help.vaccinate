"use strict";

const { validateReport } = require("../../../common/validators.js");
const { loggedHandler } = require("../../lib/logger.js");
const { requirePermission, getUserinfo } = require("../../lib/auth.js");
const { base, duplicateBase } = require("../../lib/airtable.js");
const { logEvent } = require("../../lib/log.js");

const SKIP_TAG_PREFIX = "Skip: call back later";
const TRAINEE_ROLE_NAME = "Trainee";
const JOURNEYMAN_ROLE_NAME = "Journeyman";

function shouldReview(event, roles) {
  // Flag based on user roles; 100% of trainee, 15% of journeyman
  if (roles.includes(TRAINEE_ROLE_NAME)) {
    return true;
  } else if (roles.includes(JOURNEYMAN_ROLE_NAME)) {
    if (Math.random() < 0.15) {
      return true;
    }
  }

  /**
   * Note that we trust the client to tell us if the internal notes are
   * unchanged; a malicious client could thus fake having changed the internal
   * notes in order to escape being flagged.  A more correct implementation
   * would be to HMAC sign the internal notes in requestCall, and verify that
   * signature and compare it to a regenerate version of that here.
   */
  const issues = validateReport(event);
  if (issues.requiresReview) {
    return true;
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
  delete input["County"];
  delete input["internal_notes_unchanged"];
  delete input["unexpected_min_age"];

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
