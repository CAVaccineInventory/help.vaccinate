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
  "County vaccine info URL", // retire this now that county is fetched
  "County Vaccine locations URL", // retire this now that county is fetched
  "county_notes",
  "Availability Info",
  "Address",
  "Website",
  "Affiliation",
  "Location Type",
  "Number of Reports",
  "Hours"
];

const PROVIDER_FIELDS_TO_LOAD = [
  "Provider",
  "Vaccine info URL",
  "Vaccine locations URL",
  "Public Notes",
  "Phase",
  "Appointments URL",
  "Provider network type",
  "Last Updated",
  "Internal notes",
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

  // try to fetch provider record
  const aff = locationToCall.get('Affiliation');
  if (aff && aff !== "None / Unknown / Unimportant") {
    try {
      const providerRecords = await base('Provider networks').select({
        fields: PROVIDER_FIELDS_TO_LOAD,
        // XXX there are single quotes in some names, so we use "
        // here. Add real escaping before we add " to names.
        filterByFormula: `{Provider} = "${aff}"`,
        maxRecords: 1
      }).firstPage();
      if (providerRecords && providerRecords.length) {
        output.provider_record = Object.assign(
          {id: providerRecords[0].id}, providerRecords[0].fields);
      } else {
        console.log("No affiliation found for location",
                    locationToCall.id, aff);
      }
    } catch (err) {
      console.log("Failure getting provider for location", locationToCall.id, err);
    }
  }

  // save off an audit log entry noting that this caller got this location.
  //
  // Note that we don't block on this completing, so it shouldn't slow things down too much.
  try {
    const fields = {
      auth0_reporter_id: context.identityContext.claims.sub,
      hostname: event.headers.host,
      remote_ip: event.headers['client-ip'],
      endpoint: 'requestCall',
      extra_json: JSON.stringify({
        location_id: output.id,
        location_name: output.Name,
        release_time: today,
        affiliation: aff
      })
    };
    base('Caller Audit Log').create([{fields}]).then((results) => {
      if (results && results.length > 0) {
        console.log(`AUDIT log ${fields.auth0_reporter_id} ${results[0].id}`);
      } else {
        console.log("Failed to insert audit log results:", results);
      }
    }).catch((err) => {
      console.log("Failed to insert audit log err:", err);
    });
  } catch (e) {
    console.log("ERR failed to kick off audit log entry.", e);
  }



  return {
    statusCode: 200,
    body: JSON.stringify(output)
  };
});

exports.handler = handler;
