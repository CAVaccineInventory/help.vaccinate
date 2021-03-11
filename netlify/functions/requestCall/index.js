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
  "_scooby_prioritized_calls",
  "To-call priority list (internal)",
  "To-call from Eva reports list (internal)",
  "Stale reports (with Eva tip)",
  "To-call list (internal)",
];

const INTERNAL_CC_VIEWS_TO_LOAD = [
  "Internal Caller List"
];

const TRAINEE_VIEWS_TO_LOAD = [
  "Training Call List"
];

const ROLE_VIEW_MAP = new Map([ //List roles in decreasing priority
  ["Trainee", TRAINEE_VIEWS_TO_LOAD],
  ["CC1 callers", INTERNAL_CC_VIEWS_TO_LOAD]
]);

// how long to lock a location after returning it before returning to
// the next person.
const LOCK_MINUTES = 20;

const handler = async (event, context, logger) => {

  // NOTE: there is a race condition here where two callers could get the same location.
  // this is no worse than the current app, though.

  let locationsToCall = [];
  let pickedView = ""; // which view did we use. for debugging.

  const locationOverride = event.queryStringParameters.location_id;
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
      pickedView = "override";
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
        const locs = await base("Locations")
          .select({
            view,
   	    // Only fetch the first 20 results from the view
  	    // this may result in a race condition causing multiple folks
 	    // making the same call. but yolo
            maxRecords: 20,
            fields: LOCATION_FIELDS_TO_LOAD,
          })
          .firstPage();
        if (locs.length > 0) {
          locationsToCall = locs;
          pickedView = view;
          break;
        }
      } catch (err) {
        logger.error({ err: err, view: view }, "Failed to load location view");
      }
    }
  }

  // Can't find anyone to call?
  if (locationsToCall.length === 0) {
    logger.warn("No locations to call");
    try {
      await logEvent({
        event,
        context,
        endpoint: "requestCall",
        name: "empty",
        payload: "",
      });
    } catch (err) {
      logger.error("error writing to event log", err);
    }
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
    // use ?no_claim=1 in the URL to avoid writing the field that
    // stops others from claiming this row. This is for debugging or
    // monitoring purposes.
    if (event.queryStringParameters.no_claim !== '1') {
      await base("Locations").update([
        {
          id: locationToCall.id,
          fields: { "Next available to app flow": today },
        },
      ]);
    } else {
      logger.info("not writing claim for record", locationToCall.id);
    }
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

  // save off an audit log entry noting that this caller got this
  // location.  note: we wait for this to complete because otherwise
  // AWS Lambda (aka Netlify Functions) might shut things down and cut
  // off the write to airtable.
  try {
    await logEvent({
      event,
      context,
      endpoint: "requestCall",
      name: "assigned",
      payload: JSON.stringify(Object.assign({picked_view: pickedView}, output)),
    });
  } catch (err) {
    logger.error("error writing to event log", err);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(output),
  };
};

exports.handler = loggedHandler(requirePermission("caller", handler));
