"use strict";

// XXX this endpoint currently fetches all the reports for a the
// calling user. This will do N/100 API calls (airtable fetches 100
// rows max per call). While this is inefficient, it is much simpler,
// and hopefully adequate for the short to medium term.
//
// We may be able to avoid this by doing some airtable formula magic
// on the reports table to be table to do a single fetch from a view
// or computed table.
//
// We can also bound this by only fetching the last N days of calls
// and not reporting total count. Or by only fetching the first N
// pages and maxing out the report (eg: you've made more than 100
// calls, 23 today, etc).

const { loggedHandler } = require("../../lib/logger.js");
const { requirePermission } = require("../../lib/auth.js");
const { base } = require("../../lib/airtable.js");

const REPORTS_FIELDS_TO_LOAD = [
  'Date',
  'Availability',
];

const handler = async (event, context, logger) => {
  const output = {};

  try {
    // fetch all reports from airtable
    const sub = context.identityContext.claims.sub;
    const stats = await base('Reports').select({
      fields: REPORTS_FIELDS_TO_LOAD,
      filterByFormula: `{auth0_reporter_id} = "${sub}"`
    }).all();

    // count them and do stats

    // total number of reports i've filed
    output.total = stats.length;

    // how many of them are today (PST)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: "America/Los_Angeles",
    });
    const nowDate = formatter.format(new Date());
    output.today = stats.filter((r) => (
      nowDate === formatter.format(new Date(r.get('Date')))
    )).length;

    /* XXX not doing these for now. Let's figure out more stats to give users later.
    // how many of them have yes tags
    output.yesses = stats.filter((r) => (
      r.get('Availability').some((s) => s.startsWith("Yes:"))
    )).length;
    */

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({error: err.message})
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(output)
  };
};

exports.handler = loggedHandler(requirePermission("caller", handler));
