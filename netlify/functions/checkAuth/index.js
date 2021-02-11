"use strict";

const { loggedHandler } = require("../../lib/logger.js");

const { requireAuth, ROLE_SCOPE } = require("../../lib/auth.js");

const handler = async (event, context, logger) => {
  // The user information is available here.
  const { claims } = context.identityContext;

  const perms = claims && claims.permissions ? claims.permissions : [];
  const roles = claims && claims[ROLE_SCOPE] ? claims[ROLE_SCOPE] : [];
  const user = claims && claims.sub;
  logger.info(
    { permissions: perms, roles: roles, user: user },
    "Authentication"
  );

  const authorizedCaller = !!(perms.indexOf("caller") !== -1);

  return {
    statusCode: 200,
    body: JSON.stringify({
      authorizedCaller,
    }),
  };
};

exports.handler = loggedHandler(requireAuth(handler));
