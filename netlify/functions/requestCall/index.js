"use strict";

const { loggedHandler } = require("../../lib/logger.js");
const { requirePermission, extractRolesFromContext } = require("../../lib/auth.js");
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
//
// The order of this list is important. We pick the first view of
// these that has any entries.
//
// This should match the logic from:
// https://github.com/CAVaccineInventory/airtableApps/blob/main/caller/frontend/index.tsx

const DEFAULT_VIEWS_TO_LOAD = [
  "Stale reports (with Eva tip)",
  "To-call priority list (internal)",
  "To-call from Eva reports list (internal)",
  "To-call list (internal)",
];

const INTERNAL_CC_VIEWS_TO_LOAD = [
  "Internal Caller List"
];

const ROLE_VIEW_MAP = new Map([ //List roles in decreasing priority
  ["CC1 callers", INTERNAL_CC_VIEWS_TO_LOAD]
]);

// how long to lock a location after returning it before returning to
// the next person.
const LOCK_MINUTES = 20;

const handler = async (event, context, logger) => {

  // NOTE: there is a race condition here where two callers could get the same location.
  // this is no worse than the current app, though.

  let locationsToCall = [];

  const locationOverride = event.queryStringParameters.locationID;
  if (locationOverride) {
    logger.info("got locationID override", locationOverride);
    try {
      // use select() over find() so we can specify fields, and for consistency of API.
      //
      // The `escape` should help prevent people from doing anything funny.
      // All legit airtable IDs should not contain any characters.
      const locs = await base("Locations").select({
        filterByFormula: `RECORD_ID() = "${escape(locationOverride)}"`,
        fields: LOCATION_FIELDS_TO_LOAD,
      }).firstPage();
      if (locs.length === 0) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            error: `Couldn't find override location: "${locationOverride}"`,
          }),
        };
      }
      // got a valid location.
      locationsToCall = locs;
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: `Failed to find location override "${locationOverride}"`,
          message: err.message,
        }),
      };
    }
  } else {
    let viewsToLoad = [];

    const roles = extractRolesFromContext(context);

    ROLE_VIEW_MAP.forEach((views, role) => {
      if(roles.includes(role)) {
        viewsToLoad = viewsToLoad.concat(views);
      }
    });

    viewsToLoad = viewsToLoad.concat(DEFAULT_VIEWS_TO_LOAD);

    for (const view of viewsToLoad) {
      try {
        const locs = await base("Locations").select({
          view, fields: LOCATION_FIELDS_TO_LOAD,
        }).firstPage();
        if (locs.length > 0) {
          locationsToCall = locs;
          break;
        }
      } catch (err) {
        logger.error({ err: err, view: view }, "Failed to load location view");
      }
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

  // Defer checking on this record for N minutes, to avoid multiple people picking up the same row:
  const today = new Date();
  today.setMinutes(today.getMinutes() + LOCK_MINUTES);

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
};

exports.handler = loggedHandler(requirePermission("caller", handler));
