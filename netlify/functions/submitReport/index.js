"use strict";

const { loggedHandler } = require("../../lib/logger.js");
const { requirePermission, getUserinfo } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");
const { logEvent } = require("../../lib/log.js");

const handler = loggedHandler(
  requirePermission("caller", async (event, context, logger) => {
    // save off a raw report in case something goes wrong below.
    logEvent({
      event,
      context,
      endpoint: "submitReport",
      name: "raw",
      payload: event.body,
    });

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
      logEvent({
        event,
        context,
        endpoint: "submitReport",
        name: "err",
        payload: JSON.stringify(output),
      });
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
      });
    } catch (err) {
      logger.error({ err: err }, "Failed to get userinfo"); // XXX
    }

    try {
      const result = await base("Reports").create([{ fields: input }]);
      const resultIds = (result && result.map((r) => r.id)) || [];

      return {
        statusCode: 200,
        body: JSON.stringify({ created: resultIds }),
      };
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
  })
);

exports.handler = handler;
