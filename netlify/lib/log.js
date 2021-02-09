
const { base } = require("./airtable.js");

// It might be nice if this wrote to something other than airtable.
// Both for performace reasons (API rate limits) and for reliability
// reasons (eg, not losing in-flight data if airtable hiccups).
module.exports.logEvent = ({event, context, endpoint, payload, name}) => {

  // save off raw report ASAP. Note that we don't block on this
  // completing, so it shouldn't slow things down too much.
  try {
    const auth0_reporter_id = (
      context && context.identityContext && context.identityContext.claims &&
        context.identityContext.claims.sub);

    const fields = {
      auth0_reporter_id, endpoint, payload,
      event_name: name,
      hostname: event.headers.host,
      remote_ip: event.headers['client-ip'],
    };
    base('call_report_event_log').create([{fields}]).then((results) => {
      if (results && results.length > 0) {
        console.log('EVENTLOG', endpoint, name, auth0_reporter_id, results[0].id);
      } else {
        console.log("Failed to insert audit log results:", results);
      }
    }).catch((err) => {
      console.log("Failed to insert audit log err:", err);
    });
  } catch (e) {
    console.log("ERR failed to kick off audit log entry.", e);
  }
};
