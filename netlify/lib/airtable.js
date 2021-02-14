if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE) {
  console.log(
    "You must specify an the AIRTABLE_API_KEY and AIRTABLE_BASE environment variables."
  );
  // XXX error here?
}

const Airtable = require('airtable');

// uses the default connection which reads the API key from the environment.
const base = Airtable.base(process.env.AIRTABLE_BASE);
module.exports.base = base;


// The AIRTABLE_READ_KEYS environment variable can be set to a comma
// separated list of API keys. These keys may have read only access to
// the database for extra safety.
//
// If this is not set or empty, it will default to using the same API
// key as above, AIRTABLE_API_KEY
const readKeys = (
  process.env.AIRTABLE_READ_KEYS || process.env.AIRTABLE_API_KEY || '')
      .split(',');
const readClients = readKeys.map((k) => new Airtable({apiKey: k}));

module.exports.getReadBase = () => {
  const c = readClients[Math.floor(Math.random() * readClients.length)];
  return c.base(process.env.AIRTABLE_BASE);
};
