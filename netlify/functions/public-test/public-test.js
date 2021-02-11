"use strict";

const { loggedHandler } = require("../../lib/logger.js");

// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
const handler = loggedHandler(async (event) => {
  const subject = event.queryStringParameters.name || "World";
  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Hello ${subject}` }),
    // // more keys you can return:
    // headers: { "headerName": "headerValue", ... },
    // isBase64Encoded: true,
  };
});

module.exports = { handler };
