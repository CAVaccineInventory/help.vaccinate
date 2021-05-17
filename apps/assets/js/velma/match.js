import { getUser } from "../util/auth.js";
import { fetchJsonFromEndpoint } from "../util/api.js";
import { fillTemplateIntoDom, showErrorModal, bindClick, showLoadingScreen, hideLoadingScreen } from "../util/fauxFramework.js";
import { distance } from "./distance.js";

import matchActionsTemplate from "../templates/velma/matchActions.handlebars";
import matchKeybindsTemplate from "../templates/velma/matchKeybinds.handlebars";

export const matchLogic = () => {
  return {
    getData,
    initActions,
    handleKeybind,
    role: "match",
    supportsRedo: true,
    keybindTemplate: matchKeybindsTemplate,
  };
};

const getData = async (id, onError) => {
  const user = await getUser();
  const response = await fetchJsonFromEndpoint(`/searchSourceLocations?${createSearchQueryParams(id)}`, "GET");
  if (response.error) {
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
  const currentLocationDebugJson = JSON.stringify(sourceLocation, null, 2);

  // massage sourceLocation into a standard location object
  const currentLocation = {};
  currentLocation.id = sourceLocation?.import_json?.id;
  currentLocation.name = sourceLocation.name;
  currentLocation.latitude = Math.round(sourceLocation.latitude * 10000) / 10000;
  currentLocation.longitude = Math.round(sourceLocation.longitude * 10000) / 10000;

  const websites = sourceLocation?.import_json?.contact?.filter((method) => !!method.website);
  currentLocation.website =
        websites?.find((method) => method.contact_type === "general")?.website || websites?.[0]?.website;
  currentLocation.phone_number = sourceLocation?.import_json?.contact?.find((method) => !!method.phone)?.phone;
  currentLocation.full_address = `${sourceLocation.import_json.address.street1}, ${sourceLocation.import_json.address.city}, ${sourceLocation.import_json.address.state} ${sourceLocation.import_json.address.zip}`;

  const candidatesResponse = await fetchJsonFromEndpoint(
    "/searchLocations?size=50&latitude=" +
      location.latitude +
      "&longitude=" +
      location.longitude +
      "&radius=2000",
    "GET"
  );

  if (candidatesResponse.error) {
    showErrorModal(
      "Error fetching locations to match against",
      "We ran into an error trying to fetch you locations to match against. Please show this error message to your captain or lead on Slack." +
            " They may also need to know that you are logged in as " +
            user?.email +
            ".",
      error
    );
    return;
  }

  let candidates = candidatesResponse?.results || [];

  // record the distance. then sort the results by it
  candidates.forEach((item) => {
    item.distance =
      Math.round(100 * distance(item.latitude, item.longitude, location.latitude, location.longitude)) /
      100;
  });
  candidates.sort((a, b) => (a.distance > b.distance ? 1 : -1));
  candidates.forEach((candidate) => {
    if (candidate && candidate.latitude && candidate.longitude) {
      candidate.latitude = Math.round(candidate.latitude * 10000) / 10000;
      candidate.longitude = Math.round(candidate.longitude * 10000) / 10000;
    }
  });

  return {
    currentLocation,
    currentLocationDebugJson,
    candidates,
  };
};

const initActions = (currentLocation, candidate, actions) => {
  fillTemplateIntoDom(matchActionsTemplate, "#actionsContainer", {
    candidate,
  });

  bindClick(".js-skip", actions.skipLocation);
  bindClick(".js-tryagain", actions.restart);
  bindClick(".js-close", actions.dismissItem);
  bindClick(".js-match", () => !!candidate && matchLocation(currentLocation?.id, candidate.id, actions.completeLocation));
  bindClick(".js-create", () => createLocation(currentLocation?.id, actions.completeLocation));
};

const handleKeybind = (key, currentLocation, candidate, actions) => {
  switch (key) {
    case "1":
    case "m":
      if (candidate?.id) {
        document.querySelector(".js-match")?.classList?.add("active");
        matchLocation(currentLocation?.id, candidate.id, actions.completeLocation);
      }
      break;
    case "2":
    case "d":
      if (candidate?.id) {
        actions.dismissItem();
      } else {
        actions.restart();
      }
      break;
    case "3":
    case "c":
      document.querySelector(".js-create")?.classList?.add("active");
      createLocation(currentLocation?.id, actions.completeLocation);
      break;
    case "4":
    case "s":
      document.querySelector(".js-skip")?.classList?.add("active");
      actions.skipLocation();
      break;
    case "5":
    case "u":
      actions.undoPreviousLocation();
      break;
  }
};


const matchLocation = async (currentLocationId, candidateId, completeLocation) => {
  showLoadingScreen();
  const response = await fetchJsonFromEndpoint(
    "/updateSourceLocationMatch",
    "POST",
    JSON.stringify({
      source_location: currentLocationId,
      location: candidateId,
    })
  );
  hideLoadingScreen();
  if (response.error) {
    showErrorModal(
      "Error matching location",
      "We ran into an error trying to match the location. Please show this error message to your captain or lead on Slack.",
      response
    );
    return;
  }
  completeLocation("match");
};

const createLocation = async (id, completeLocation) => {
  showLoadingScreen();
  const response = await fetchJsonFromEndpoint(
    "/createLocationFromSourceLocation",
    "POST",
    JSON.stringify({
      source_location: id,
    })
  );
  hideLoadingScreen();
  if (response.error) {
    showErrorModal(
      "Error creating location",
      "We ran into an error trying to create the location. Please show this error message to your captain or lead on Slack.",
      response
    );
    return;
  }
  completeLocation("create");
};

const createSearchQueryParams = (id) => {
  const params = {};
  if (id) {
    params.id = id;
    params.haspoint = 1;
  } else {
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
  }
  return new URLSearchParams(params).toString();
};
