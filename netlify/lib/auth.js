const {
  NetlifyJwtVerifier: netlifyJwtVerifier,
} = require("@serverless-jwt/netlify");
const fetch = require("node-fetch");

const ISSUER = process.env.JWT_ISSUER || "https://vaccinateca.us.auth0.com/";
const AUDIENCE = process.env.JWT_AUDIENCE || "https://help.vaccinateca.com";

const verifyJwt = netlifyJwtVerifier({
  issuer: ISSUER,
  audience: AUDIENCE,
});

const json = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
};

module.exports.requireAuth = verifyJwt;

const ROLE_SCOPE = "https://help.vaccinateca.com/roles";
module.exports.ROLE_SCOPE = ROLE_SCOPE;

const extractUserInfoFromContext = (context) => {
  const { claims } = context.identityContext;

  const perms = claims && claims.permissions ? claims.permissions : [];
  const roles = claims && claims[ROLE_SCOPE] ? claims[ROLE_SCOPE] : [];
  const user = claims && claims.sub;

  return { perms, roles, user };
};

const extractRolesFromContext = (context) => {
  const { roles } = extractUserInfoFromContext(context);
  return roles;
};

module.exports.extractRolesFromContext = extractRolesFromContext;

/**
 * Require the token to contain a certain permissions.
 * @param {string} permission
 * @param {function} handler
 * @return {function} A new handler
 */
module.exports.requirePermission = (permission, handler) =>
  verifyJwt(async (event, context, logger) => {
    const { perms, roles, user } = extractUserInfoFromContext(context);

    logger.info(
      { permissions: perms, roles: roles, user: user },
      "Authentication"
    );

    // Require the token to contain a specific permission.
    if (perms.indexOf(permission) === -1) {
      return json(403, {
        error: "access_denied",
        error_description: `Token does not contain the required '${permission}' permission`,
      });
    }

    // Continue.
    return handler(event, context, logger);
  });

/**
 * Fetch the user's info from auth0.
 * Pass in the user's token.
 * @param {string} token
 * @return {Object}
 */
module.exports.getUserinfo = async (token) => {
  const userinfo = await fetch("https://vaccinateca.us.auth0.com/userinfo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await userinfo.json();
  return data;
};
