# API between frontend and backend

## checkAuth

Check the user's permissions.


- **Path**: `/.netlify/functions/checkAuth`
- **Permissions**: Must be logged in.
- **Req Type**: `GET`
- **Req Body**: _none_
- **Response**: A JSON object with keys representing the permissions the user has.
- **Example response**:
```json
{"authorizedCaller":true}
```


## requestCall

Gets a location for the user to call. 'Locks' the location for 10 minutes so it will not be returned to other users while this user is calling.

- **Path**: `/.netlify/functions/requestCall`
- **Parameters**:
    - `location_id`: Override location selection. Pass the airtable ID of a Locations record (eg `recfPJuDROS46lPY9`) to skip the normal view selection code and return that ID specifically.
    - `no_claim`: Pass `1` to skip updating the record to lock it from other callers. Use this for testing.
- **Permissions**: Must have the `caller` permission.
- **Req Type**: `POST`
- **Req Body**: _none_
- **Response**: A single JSON object corresponding to the location to call. If there are no places to call, or some other error, the result will not contain an `id` field and instead will contain an `error` field.
- **Example response**:
```json
{
  "id": "recRd4p2FWgJJbLc1",
  "Name": "SAVE MART PHARMACY - STANDIFORD #49",
  "Phone number": "209-577-1350",
  "Address": "2100 STANDIFORD AVE, MODESTO, CA 95350",
  "Internal notes": "...",
  "Hours": "Monday - Sunday: 6:00 AM – 10:00 PM",
  "County": "Stanislaus County",
  "Location Type": "Pharmacy",
  "Affiliation": "Save Mart Pharmacy",
  "Latest report": "2021-01-26T01:00:58.000Z",
  "Latest report notes": [
    "Expecting to have doses around February 1st"
  ],
  "County vaccine info URL": [
    "http://schsa.org/coronavirus/vaccine/"
  ],
  "County Vaccine locations URL": [
    "http://schsa.org/coronavirus/vaccine/pdf/approved-providers.pdf"
  ],
  "Latest Internal Notes": [
    null
  ],
  "Availability Info": [
    "No: no vaccine inventory"
  ],
  "Number of Reports": 7,
  "county_record": {
    "id": "recOaUFuQI8CnfiCP",
    "County": "Stanislaus County",
    "Vaccine info URL": "http://schsa.org/coronavirus/vaccine/",
    "Vaccine locations URL": "http://schsa.org/coronavirus/vaccine/pdf/approved-providers.pdf",
    "Notes": "# ..."
  },
  "provider_record": {
    "id": "recnRg7E8Yi7YbX61",
    "Provider": "Save Mart Pharmacy",
    "Vaccine info URL": "https://www.savemart.com/covid-19-vaccine",
    "Public Notes": "...",
    "Phase": [
      "Not currently vaccinating"
    ],
    "Provider network type": "Pharmacy",
    "Last Updated": "2021-02-08"
  }
}
}
OR
{
  "error": "Couldn't find somewhere to call"
}
```

## submitReport

Submits a report based on what the user found during a call.

- **Path**: `/.netlify/functions/submitReport`
- **Permissions**: Must have the `caller` permission.
- **Req Type**: `POST`
- **Req Body**: A single JSON object corresponding to the report to create. Fields match Airtable `Reports` column names.
- **Response**: a JSON blob with `created: ["ID_OF_NEW_ROW"]` on success, `error: "some string"` on error.
- **Example**:
```json
Request:
{
  "Location": "recRd4p2FWgJJbLc1",
  "Vaccines available?": "No",
  "Availability": ["No: not open to the public"],
  "Notes": "just testing",
  "Internal Notes": "just testing"
}

Response:
{"created":["recFhKLYJku2jiQyM"]}
```
