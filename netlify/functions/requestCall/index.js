"use strict";

const { requirePermission } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");


const LOCATION_FIELDS_TO_LOAD = [
  "Name",
  "County",
  "Phone number",
  "Internal notes", // really location notes
  "Latest report",
  "Latest report notes",
  "Latest Internal Notes",
  "County vaccine info URL",
  "County Vaccine locations URL",
  "Availability Info",
  "Address",
  "Website",
  "Affiliation",
  "Location Type",
  "Number of Reports",
  "Hours"
];

const COUNTIES_FIELDS_TO_LOAD = [
  "County",
  "Vaccine info URL",
  "Vaccine locations URL",
  "Notes",
];


// someday soon we might load this dynamically from airtable.
const VIEWS_TO_LOAD = [
  "To-call from Eva reports list (internal)",
  "To-call priority list (internal)",
  "To-call list (internal)",
];

const handler = requirePermission("caller", async (event, context) => {
  // logic copied from:
  // https://github.com/CAVaccineInventory/airtableApps/blob/main/caller/frontend/index.tsx

  // NOTE: there is a race condition here where two callers could get the same location.
  // this is no worse than the current app, though.

  let locationsToCall = [];

  for (const view of VIEWS_TO_LOAD) {
    try {
      const locs = await base('Locations').select({
        view, fields: LOCATION_FIELDS_TO_LOAD,
      }).firstPage();
      if (locs.length > 0) {
        locationsToCall = locs;
        break;
      }
    } catch (err) {
      console.log("Failed to load location view", view, err);
    }
  }

  // Can't find anyone to call?
  if (locationsToCall.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        error: "Couldn't find somewhere to call"
      })
    };
  }

  // pick a row
  const locationIndex = Math.floor(Math.random() * locationsToCall.length);
  const locationToCall = locationsToCall[locationIndex];

  // Defer checking on this record for 10 minutes, to avoid multiple people picking up the same row:
  const today = new Date();
  today.setMinutes(today.getMinutes() + 10);

  try {
    const updated = await base('Locations').update([{
      id: locationToCall.id,
      fields: { "Next available to app flow": today }
    }]);
  } catch (err) {
    // this is unexpected. return an error to the client.
    console.log("Failed to update location for locking",
                locationToCall.id, err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to update location for locking",
        message: err.message
      })
    };
  }

  const output = Object.assign(
    {id: locationToCall.id}, locationToCall.fields);

  // get some additional infomation for the user

  // try to fetch county record
  const county = locationToCall.get('County');
  if (county) {
    try {
      const countyRecords = await base('Counties').select({
        fields: COUNTIES_FIELDS_TO_LOAD,
        filterByFormula: `{County enum} = '${county}'`,
        maxRecords: 1
      }).firstPage();
      if (countyRecords && countyRecords.length) {
        output.county_record = Object.assign(
          {id: countyRecords[0].id}, countyRecords[0].fields);
      }
    } catch (err) {
      console.log("Failure getting county for location", locationToCall.id, err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(output)
  };
});

exports.handler = handler;
