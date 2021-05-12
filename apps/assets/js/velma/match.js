import { getUser } from "../util/auth.js";
import { fetchJsonFromEndpoint } from "../util/api.js";
import { distance } from "./distance.js";
import { showErrorModal } from "../util/fauxFramework.js";

export const MatchLogic = () => {
  const getData = async (onError) => {
    const user = await getUser();

    const response = await fetchJsonFromEndpoint(`/searchSourceLocations?${createSearchQueryParams()}`, "GET");
    if (response.error) {
      // TODO: import
      showErrorModal(
        "Error fetching source location",
        "We ran into an error trying to fetch you a source location to match. Please show this error message to your captain or lead on Slack." +
            " They may also need to know that you are logged in as " +
            user?.email +
            ".",
        response
      );
      onError();
      return;
    } else if (response.results && !response.results.length) {
      // no results
      showErrorModal(
        "No locations to match",
        "It looks like we've matched every single source location for the provided query parameters!",
        createSearchQueryParams(id)
      );
      onError();
      return;
    }

    const sourceLocation = response.results[0];
    const originalSourceLocationJson = JSON.stringify(sourceLocation, null, 2);

    // some "fun" modifications to sourceLocation to make it more usable
    sourceLocation.latitude = Math.round(sourceLocation.latitude * 10000) / 10000;
    sourceLocation.longitude = Math.round(sourceLocation.longitude * 10000) / 10000;

    const websites = sourceLocation?.import_json?.contact?.filter((method) => !!method.website);
    sourceLocation.website =
        websites?.find((method) => method.contact_type === "general")?.website || websites?.[0]?.website;
    sourceLocation.phone = sourceLocation?.import_json?.contact?.find((method) => !!method.phone)?.phone;
    sourceLocation.addr = `${sourceLocation.import_json.address.street1}, ${sourceLocation.import_json.address.city}, ${sourceLocation.import_json.address.state} ${sourceLocation.import_json.address.zip}`;

    let candidates = await fetchJsonFromEndpoint(
      "/searchLocations?size=50&latitude=" +
        sourceLocation.latitude +
        "&longitude=" +
        sourceLocation.longitude +
        "&radius=2000",
      "GET"
    );

    if (candidates.error) {
      showErrorModal(
        "Error fetching locations to match against",
        "We ran into an error trying to fetch you a locations to match against. Please show this error message to your captain or lead on Slack." +
            " They may also need to know that you are logged in as " +
            user?.email +
            ".",
        response
      );
      onError();
      return;
    }

    // record the distance. then sort the results by it
    candidates?.results.forEach((item) => {
      item.distance =
        Math.round(100 * distance(item.latitude, item.longitude, sourceLocation.latitude, sourceLocation.longitude)) /
        100;
    });
    candidates?.results.sort((a, b) => (a.distance > b.distance ? 1 : -1));
    candidates = candidates?.results || [];
    candidates.forEach(candidate => {
        if (candidate && candidate.latitude && candidate.longitude) {
            candidate.latitude = Math.round(candidate.latitude * 10000) / 10000;
            candidate.longitude = Math.round(candidate.longitude * 10000) / 10000;
        }
    })

    return {
      sourceLocation,
      originalSourceLocationJson,
      candidates,
    };
  };

  return {
      getData: getData,
  }
};

const createSearchQueryParams = () => {
  const params = {};
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get("source_q");
  const state = urlParams.get("source_state");
  const sourceName = urlParams.get("source_name");
  params.random = 1;
  params.unmatched = 1;
  params.size = 1;
  params.haspoint = 1;
  if (q) {
    params.q = q;
  }
  if (state) {
    params.state = state;
  }
  if (sourceName) {
    params.source_name = sourceName;
  }
  return new URLSearchParams(params).toString();
};