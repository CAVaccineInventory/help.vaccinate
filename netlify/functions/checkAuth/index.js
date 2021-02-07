"use strict";

const { requireAuth } = require("../../lib/auth.js");

const handler = async (event, context) => {
  // The user information is available here.
  const { claims } = context.identityContext;

  const authorizedCaller = !!(
    claims && claims.permissions &&
      claims.permissions.indexOf("caller") !== -1);

  return {
    statusCode: 200,
    body: JSON.stringify({
      authorizedCaller
    })
  };
};


exports.handler = requireAuth(handler);
