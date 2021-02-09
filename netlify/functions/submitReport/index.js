"use strict";

const { requirePermission, getUserinfo } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");


const handler = requirePermission("caller", async (event, context) => {

  // save off raw report ASAP. Note that we don't block on this
  // completing, so it shouldn't slow things down too much.
  try {
    const fields = {
      auth0_reporter_id: context.identityContext.claims.sub,
      hostname: event.headers.host,
      remote_ip: event.headers['client-ip'],
      endpoint: 'submitReport',
      extra_json: JSON.stringify({body: event.body})
    };
    base('Caller Audit Log').create([{fields}]).then((results) => {
      if (results && results.length > 0) {
        console.log(`AUDIT log ${fields.auth0_reporter_id} ${results[0].id}`);
      } else {
        console.log("Failed to insert audit log results:", results);
      }
    }).catch((err) => {
      console.log("Failed to insert audit log err:", err);
    });
  } catch (e) {
    console.log("ERR failed to kick off audit log entry.", e);
  }


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
