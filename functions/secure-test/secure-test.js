"use strict";

// Import the Okta JWT verifier
const OktaJwtVerifier = require("@okta/jwt-verifier");

// Verify the access token passed to the function
const verifyToken = async (authHeader) => {
  try {
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      // No access token was passed
      return null;
    }
    const accessToken = parts[1];

    // Create an instance of the verifier using the Okta application's
    // Org URL and client ID
    const jwtVerifier = new OktaJwtVerifier({
      issuer: `${process.env.OKTA_ORG_URL}/oauth2/default`,
      clientId: process.env.OKTA_CLIENT_ID
    });

    // verify the token
    // if there's a problem with the token, such as expired or it has been
    // tampered with, the verifier will throw an exception
    const jwt = await jwtVerifier.verifyAccessToken(accessToken, "api://default");

    // returned the decoded JWT
    return jwt;
  } catch (err) {
    console.log(err);
    return null;
  }
};

exports.handler = async (event, context) => {
  try {
    const jwt = await verifyToken(event.headers.authorization);

    // if no access token was provided, return a 401 unauthorized
    if (!jwt) {
      return {
        statusCode: 401,
        body: "You are not authorized to access this resource"
      };
    }
    // Return a message using the decoded JWT subject (user name)
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: `Hello ${jwt.claims.sub}` })
    };
  } catch (err) {
    console.log(err);
    return { statusCode: 500, body: err.toString() };
  }
};
