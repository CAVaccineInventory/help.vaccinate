"use strict";

const { loggedHandler } = require("../../lib/logger.js");
const { requirePermission, getUserinfo } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");
const { logEvent } = require("../../lib/log.js");
const fetch = require('node-fetch');

const SKIP_TAG_PREFIX = "Skip: call back later";
const TRAINEE_ROLE_NAME = "Trainee";

const handler = async (event, context, logger) => {
  // save off a raw report in case something goes wrong below.
  //
  // note: if we wanted to be extra fancy, rather than await here we
  // could save off the promise and await it where we return.

  try {
    await logEvent({
      event,
      context,
      endpoint: "submitReport",
      name: "raw",
      payload: event.body,
    });
  } catch (err) {
    logger.error("error writing to event log", err);
  }

  let input = null;
  try {
    input = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "bad json" }),
    };
  }

  // validation, such as it is
  if (!input.Location || !input.Availability) {
    const output = { error: "location validation failed" };
    try {
      await logEvent({
        event,
        context,
        endpoint: "submitReport",
        name: "err",
        payload: JSON.stringify(output),
      });
    } catch (err) {
      logger.error("error writing to event log", err);
    }

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
  try {
    const userinfo = await getUserinfo(context.identityContext.token);
    const roles = userinfo["https://help.vaccinateca.com/roles"] || [];
    Object.assign(input, {
      auth0_reporter_name: userinfo.name,
      auth0_reporter_roles: roles.join(","),
      is_pending_review: roles.includes(TRAINEE_ROLE_NAME)
    });
  } catch (err) {
    logger.error({ err: err }, "Failed to get userinfo"); // XXX
  }

  let output = {};

  // Silently dual-write to the new Django system to test it
  try {
    await fetch("https://vaccinateca-preview.herokuapp.com/api/submitReport", {
      method: "POST",
      body: event.body,
      headers: {
        Authorization: `Bearer ${context.identityContext.token}`,
      },
    });
  } catch (err) {
    logger.error("failed to dual-write to Django", err);
  }

  try {
    const result = await base("Reports").create([{ fields: input }]);
    const resultIds = (result && result.map((r) => r.id)) || [];
    output.created = resultIds;
  } catch (err) {
    logger.error({ err: err }, "Failed to insert to airtable"); // XXX

    logEvent({
      event,
      context,
      endpoint: "submitReport",
      name: "err",
      payload: JSON.stringify({ error: err }),
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "airtable insert failed",
        message: err.message,
      }),
    };
  }

  // update Locations to de-force-prioritize a call
  //
  // this copies logic from:
  // https://github.com/CAVaccineInventory/airtableApps/blob/1e5fe26a437e2d2ea885acb480694f467178d5f8/caller/frontend/CallFlow.tsx#L474
  try {
    // if the call is non-skip, updated some other tables.
    if (input.Availability && !input.Availability.some((x) => x.startsWith(SKIP_TAG_PREFIX))) {
      const locationId = input.Location[0];
      logger.info("non-skip, updating location id", locationId);
      // kick off location update to set force-prioritize to false.
      const results = await base("Locations").update(
        [{id: locationId, fields: {
          "Force-prioritize in next call": false,
        }}]);

      const updatedId = results && results[0] && results[0].id;
      logger.info("updated location", updatedId);
    }
  } catch (err) {
    logger.error("failed to update location on non-skip report", err);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(output),
  };

};

exports.handler = loggedHandler(requirePermission("caller", handler));
