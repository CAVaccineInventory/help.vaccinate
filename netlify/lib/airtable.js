if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE) {
  console.log(
    "You must specify an the AIRTABLE_API_KEY and AIRTABLE_BASE environment variables."
  );
  // XXX error here?
}

const base = require("airtable").base(process.env.AIRTABLE_BASE);

module.exports.base = base;
