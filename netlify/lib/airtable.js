if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE) {
  console.log(
    "You must specify an the AIRTABLE_API_KEY and AIRTABLE_BASE environment variables."
  );
  // XXX error here?
}

const Airtable = require("airtable");

// default base, with default API key (from environment)
const base = Airtable.base(process.env.AIRTABLE_BASE);
module.exports.base = base;

// base to send log events to and api key to send them with. Defaults
// to the same as the main base, but can be overriden (eg staging and prod).
const logApiKey =
  process.env.AIRTABLE_LOG_API_KEY || process.env.AIRTABLE_API_KEY;
const logBaseId = process.env.AIRTABLE_LOG_BASE || process.env.AIRTABLE_BASE;
const logAirtable = new Airtable({ apiKey: logApiKey });
module.exports.logBase = logAirtable.base(logBaseId);
