"use strict";

const { requirePermission } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");


const LOCATION_FIELDS_TO_LOAD = [
  "Name",
  "County",
  "Phone number",
  "Internal notes",
  "Latest report",
  "Latest report notes",
  "Address",
  "Affiliation",
  "Location Type",
];


const handler = requirePermission("caller", async (event, context) => {
  const locations = await base('Locations').select({
    view: "To-call priority list (internal)",
    fields: LOCATION_FIELDS_TO_LOAD,
  }).firstPage();

  return {
    statusCode: 200,
    body: JSON.stringify({
      count: locations.length,
      first: locations.length && locations[0].get('Name')
    })
  };
});

exports.handler = handler;
