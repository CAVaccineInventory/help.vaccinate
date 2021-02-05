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
- **Permissions**: Must have the `caller` permission.
- **Req Type**: `POST`
- **Req Body**: _none_
- **Response**: A single JSON object corresponding to the location to call.
- **Example response**:
```json
{
  "id": "recRPSSfimvslExuU",
  "Name": "RITE AID PHARMACY 05463",
  "Phone number": "310-837-2122",
  "Address": "3802 CULVER CENTER STREET CULVER CENTER, CULVER CITY, CA 90232",
  "County": "Los Angeles County",
  "Location Type": "Pharmacy",
  "Affiliation": "Rite-Aid"
}
```

## submitReport

Submits a report based on what the user found during a call.

- **Path**: `/.netlify/functions/submitReport`
- **Permissions**: Must have the `caller` permission.
- **Req Type**: `POST`
- **Req Body**: A single JSON object corresponding to the report to create. Fields match Airtable `Reports` column names.
- **Response**: a JSON blob with `created: 1` on success, `error: "some string"` on error.
- **Example**:
```json
Request:
{
  "Location": "recRPSSfimvslExuU",
  "Vaccines available?": "No",
  "Availability": ["No: not open to the public"],
  "Notes": "just testing",
  "Internal Notes": "just testing"
}

Response:
{"created":1}
```
