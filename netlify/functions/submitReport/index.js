"use strict";

const { requirePermission, getUserinfo } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");


const handler = requirePermission("caller", async (event, context) => {
  let input = null;
  try {
    input = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({error: "bad json"})
    };
  }

  // validation, such as it is
  if (!input.Location || !input.Availability) {
    return {
      statusCode: 400,
      body: JSON.stringify({error: "location validation failed"})
    };
  }

  // if locations is not a list, make it one. convenience.
  if (!Array.isArray(input.Location)) {
    input.Location = [input.Location];
  }

  // Add user id to report
  Object.assign(input, {
    "auth0_reporter_id": context.identityContext.claims.sub,
  });

  // fetch user info to add to report
  try {
    const userinfo = await getUserinfo(context.identityContext.token);
    const roles = userinfo['https://help.vaccinateca.com/roles'] || [];
    Object.assign(input, {
      "auth0_reporter_name": userinfo.name,
      "auth0_reporter_roles": roles.join(','),
    });
  } catch (err) {
    console.log("Failed to get userinfo", err); // XXX
  }

  try {
    const result = await base('Reports').create([{fields: input}]);
    const resultIds = result && result.map((r) => r.id) || [];
    return {
      statusCode: 200,
      body: JSON.stringify({created: resultIds})
    };
  } catch (err) {
    console.log("Failed to insert to airtable", err); // XXX
    return {
      statusCode: 500,
      body: JSON.stringify({error: "airtable insert failed",
                            message: err.message})
    };
  }
});

exports.handler = handler;
