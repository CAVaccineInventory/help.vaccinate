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
