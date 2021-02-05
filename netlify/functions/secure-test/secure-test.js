"use strict";

const { NetlifyJwtVerifier } = require('@serverless-jwt/netlify');

const verifyJwt = NetlifyJwtVerifier({
  issuer: process.env.JWT_ISSUER || 'https://vaccinateca.us.auth0.com/',
  audience: process.env.JWT_AUDIENCE || 'https://help.vaccinateca.com'
});

console.log("QQQ");

const handler = async (event, context) => {
  // The user information is available here.
  const { claims } = context.identityContext;

  console.log(claims);
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


exports.handler = verifyJwt(handler);
