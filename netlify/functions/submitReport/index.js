"use strict";

const { requirePermission } = require("../../lib/auth.js");
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

  const result = await base('Reports').create([{fields: input}]);
  return {
    statusCode: 200,
    body: JSON.stringify({created: result && result.length})
  };
});

exports.handler = handler;
