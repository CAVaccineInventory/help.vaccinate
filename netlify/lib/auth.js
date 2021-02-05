const { NetlifyJwtVerifier } = require('@serverless-jwt/netlify');


const verifyJwt = NetlifyJwtVerifier({
  issuer: process.env.JWT_ISSUER || 'https://vaccinateca.us.auth0.com/',
  audience: process.env.JWT_AUDIENCE || 'https://help.vaccinateca.com'
});


const json = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
};


module.exports.requireAuth = verifyJwt;

/**
 * Require the token to contain a certain permissions.
 * @param {string} scope
 * @param {*} handler
 */
module.exports.requirePermission = (permission, handler) =>
  verifyJwt(async (event, context, cb) => {
    const { claims } = context.identityContext;

    // Require the token to contain a specific permission.
    if (!claims || !claims.permissions || claims.permissions.indexOf(permission) === -1) {
      return json(403, {
        error: 'access_denied',
        error_description: `Token does not contain the required '${permission}' permission`
      });
    }

    // Continue.
    return handler(event, context, cb);
  });




/**
 * Require the token to contain a certain scope.
 * @param {string} scope
 * @param {*} handler
 */
module.exports.requireScope = (scope, handler) =>
  verifyJwt(async (event, context, cb) => {
    const { claims } = context.identityContext;

    // Require the token to contain a specific scope.
    if (!claims || !claims.scope || claims.scope.indexOf(scope) === -1) {
      return json(403, {
        error: 'access_denied',
        error_description: `Token does not contain the required '${scope}' scope`
      });
    }

    // Continue.
    return handler(event, context, cb);
  });

/**
 * Require the user to have a specific role.
 * @param {string} role
 * @param {*} handler
 */
module.exports.requireRole = (role, handler) =>
  verifyJwt(async (event, context, cb) => {
    const { claims } = context.identityContext;

    // Require the user to have a specific role.
    if (!claims || !claims.roles || claims.roles.indexOf(role) === -1) {
      return json(403, {
        error: 'access_denied',
        error_description: `User does not have the '${role}' role`
      });
    }

    // Continue.
    return handler(event, context, cb);
  });
