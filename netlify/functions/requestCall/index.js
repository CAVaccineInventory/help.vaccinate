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

  // logic copied from:
  // https://github.com/CAVaccineInventory/airtableApps/blob/main/caller/frontend/index.tsx

  // NOTE: there is a race condition here where two callers could get the same location.
  // this is no worse than the current app, though.
  const getView = (view) => (
    base('Locations').select({
      view, fields: LOCATION_FIELDS_TO_LOAD,
    }).firstPage()
  );

  const evaLocations = await getView("To-call from Eva reports list (internal)");
  let locationsToCall = evaLocations;

  if (locationsToCall.length === 0) {
    const locationsToPrioritize = await getView("To-call priority list (internal)");
    locationsToCall = locationsToPrioritize;
  }

  if (locationsToCall.length === 0) {
    const locationsToCallNormally = await getView("To-call priority list (internal)");
    locationsToCall = locationsToCallNormally;
  }

  // Can't find anyone to call?
  if (locationsToCall.length === 0) {
    return {
      statusCode: 404,
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

  const updated = await base('Locations').update([{
    id: locationToCall.id,
    fields: { "Next available to app flow": today }
  }]);


  return {
    statusCode: 200,
    body: JSON.stringify(Object.assign(
      {id: locationToCall.id}, locationToCall.fields))
  };
});

exports.handler = handler;
