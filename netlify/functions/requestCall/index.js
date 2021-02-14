"use strict";

const { loggedHandler } = require("../../lib/logger.js");
const { requirePermission } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");
const { logEvent } = require("../../lib/log.js");

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
  "county_notes",
  "Availability Info",
  "Address",
  "Website",
  "Affiliation",
  "Location Type",
  "Hours",
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
  "Stale reports (with Eva tip)",
  "To-call from Eva reports list (internal)",
  "To-call priority list (internal)",
  "To-call list (internal)",
];

const handler = loggedHandler(
  requirePermission("caller", async (event, context, logger) => {
    // logic copied from:
    // https://github.com/CAVaccineInventory/airtableApps/blob/main/caller/frontend/index.tsx

    // NOTE: there is a race condition here where two callers could get the same location.
    // this is no worse than the current app, though.

    let locationsToCall = [];

    for (const view of VIEWS_TO_LOAD) {
      try {
        const locs = await base("Locations")
          .select({
            view,
            fields: LOCATION_FIELDS_TO_LOAD,
          })
          .firstPage();
        if (locs.length > 0) {
          locationsToCall = locs;
          break;
        }
      } catch (err) {
        logger.error({ err: err, view: view }, "Failed to load location view");
      }
    }

    // Can't find anyone to call?
    if (locationsToCall.length === 0) {
      logEvent({
        event,
        context,
        endpoint: "requestCall",
        name: "empty",
        payload: "",
      });
      logger.warn("No locations to call");
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: "Couldn't find somewhere to call",
        }),
      };
    }

    // pick a row
    const locationIndex = Math.floor(Math.random() * locationsToCall.length);
    const locationToCall = locationsToCall[locationIndex];

    // Defer checking on this record for 10 minutes, to avoid multiple people picking up the same row:
    const today = new Date();
    today.setMinutes(today.getMinutes() + 10);

    try {
      await base("Locations").update([
        {
          id: locationToCall.id,
          fields: { "Next available to app flow": today },
        },
      ]);
    } catch (err) {
      // this is unexpected. return an error to the client.
      logger.error(
        { err: err, location: locationToCall },
        "Failed to update location for locking"
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Failed to update location for locking",
          message: err.message,
        }),
      };
    }

    const output = Object.assign(
      { id: locationToCall.id },
      locationToCall.fields
    );

    // get some additional infomation for the user

    // try to fetch provider record
    const aff = locationToCall.get("Affiliation");
    if (aff && aff !== "None / Unknown / Unimportant") {
      try {
        const providerRecords = await base("Provider networks")
          .select({
            fields: PROVIDER_FIELDS_TO_LOAD,
            // XXX there are single quotes in some names, so we use "
            // here. Add real escaping before we add " to names.
            filterByFormula: `{Provider} = "${aff}"`,
            maxRecords: 1,
          })
          .firstPage();
        if (providerRecords && providerRecords.length) {
          output.provider_record = Object.assign(
            { id: providerRecords[0].id },
            providerRecords[0].fields
          );
        } else {
          logger.error(
            { location: locationToCall, affiliation: aff },
            "No affiliation found for location"
          );
        }
      } catch (err) {
        logger.error(
          { err: err, location: locationToCall },
          "Failure getting provider for location"
        );
      }
    }

    // save off an audit log entry noting that this caller got this location.
    logEvent({
      event,
      context,
      endpoint: "requestCall",
      name: "assigned",
      payload: JSON.stringify(output),
    });

    return {
      statusCode: 200,
      body: JSON.stringify(output),
    };
  })
);

exports.handler = handler;
