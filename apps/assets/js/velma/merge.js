import { getUser } from "../util/auth.js";
import { fetchJsonFromEndpoint } from "../util/api.js";
import { fillTemplateIntoDom, showErrorModal, bindClick, showLoadingScreen, hideLoadingScreen } from "../util/fauxFramework.js";
import { distance, setupMap } from "./utils.js";

import compareMergeTemplate from "../templates/velma/compareMerge.handlebars";
import mergeKeybindsTemplate from "../templates/velma/mergeKeybinds.handlebars";

export const mergeLogic = () => {
  return {
    getData,
    compareCandidates,
    handleKeybind,
    supportsRedo: false,
    keybindTemplate: mergeKeybindsTemplate,
  };
};

const getData = async (id, onError) => {
  if (id) {
    console.error("merge logic doesn't support forced IDs");
    return;
  }
  const user = await getUser();
  const urlParams = new URLSearchParams(window.location.search);
  const requestBody = { task_type: "Potential duplicate" };
  if (urlParams.get("source_q")) {
    requestBody.q = urlParams.get("source_q");
  }
  if (urlParams.get("source_state")) {
    requestBody.state = urlParams.get("source_state");
  }

  const response = await fetchJsonFromEndpoint(`/requestTask?${createRequestTaskQueryParams()}`, "POST", JSON.stringify(requestBody));
  if (response.error) {
    showErrorModal(
      "Error fetching location to merge",
      "We ran into an error trying to fetch you a location to merge. Please show this error message to your captain or lead on Slack." +
            " They may also need to know that you are logged in as " +
            user?.email +
            ".",
      response
    );
    onError();
    return;
  }
  if (!response.task) {
    showErrorModal(
      "No locations left to merge",
      "We could not find a location that needed to be merged:",
      {
        requestBody,
        response,
      }
    );
    onError();
    return;
  }
  if (!response.task.location || !response.task.other_location) {
    showErrorModal(
      "Missing location in task",
      "We did not get a location in the task:",
      response
    );
    onError();
    return;
  }

  const currentLocation = response.task.location;
  const currentLocationDebugJson = JSON.stringify(currentLocation, null, 2);
  // add taskId to current location to later resolve
  currentLocation.task_id = response.task.id;
  const otherLocation = response.task.other_location;
  otherLocation.distance = Math.round(100 * distance(otherLocation.latitude, otherLocation.longitude, currentLocation.latitude, currentLocation.longitude)) / 100;
  const candidates = [otherLocation];

  return {
    currentLocation,
    currentLocationDebugJson,
    candidates,
  };
};

const compareCandidates = ({ currentLocation, candidate, actions, selector }) => {
  const locationUrl = `https://vaccinatethestates.com?lat=${currentLocation.latitude}&lng=${currentLocation.longitude}#${currentLocation.id}`;
  let candidateUrl;
  if (candidate) {
    candidateUrl = `https://vaccinatethestates.com?lat=${candidate.latitude}&lng=${candidate.longitude}#${candidate.id}`;
  }

  fillTemplateIntoDom(compareMergeTemplate, selector, {
    currentLocation,
    candidate,
    candidateUrl,
    locationUrl,
  });

  setupMap(currentLocation, candidate);

  bindClick(".js-current-wins", () => mergeLocations(currentLocation.id, candidate.id, currentLocation.task_id, actions.completeLocation));
  bindClick(".js-candidate-wins", () => mergeLocations(candidate.id, currentLocation.id, currentLocation.task_id, actions.completeLocation));
  bindClick(".js-close", () => resolveTask(currentLocation.task_id, actions.completeLocation));
  bindClick(".js-skip", actions.skipLocation);
};

const handleKeybind = ({ key, currentLocation, candidate, actions }) => {
  switch (key) {
    case "1":
    case "r":
      if (currentLocation.id && candidate.id && currentLocation.task_id) {
        document.querySelector(".js-current-wins")?.classList?.add("active");
        mergeLocations(currentLocation.id, candidate.id, currentLocation.task_id, actions.completeLocation);
      }
      break;
    case "2":
    case "b":
      if (currentLocation.id && candidate.id && currentLocation.task_id) {
        document.querySelector(".js-candidate-wins")?.classList?.add("active");
        mergeLocations(candidate.id, currentLocation.id, currentLocation.task_id, actions.completeLocation);
      }
      break;
    case "3":
    case "d":
      if (currentLocation.task_id) {
        document.querySelector(".js-close")?.classList?.add("active");
        resolveTask(currentLocation.task_id, actions.completeLocation);
      }
      break;
    case "4":
    case "s":
      document.querySelector(".js-skip")?.classList?.add("active");
      actions.skipLocation();
      break;
  }
};


const mergeLocations = async (winner, loser, taskId, completeLocation) => {
  showLoadingScreen();
  const response = await fetchJsonFromEndpoint("/mergeLocations", "POST", JSON.stringify({
    winner,
    loser,
    task_id: taskId,
  }));
  hideLoadingScreen();

  if (response.error) {
    showErrorModal(
      "Error merging locations",
      "We ran into an error trying to merge these locations. Please show this error message to your captain or lead on Slack.",
      response
    );
    return;
  }
  completeLocation("merged");
};

const resolveTask = async (taskId, completeLocation) => {
  showLoadingScreen();
  const user = await getUser();
  const response = await fetchJsonFromEndpoint("/resolveTask", "POST", JSON.stringify({
    task_id: taskId,
    resolution: { "resolver": user?.email },
  }));
  hideLoadingScreen();

  if (response.error) {
    showErrorModal(
      "Error resolving task",
      "We ran into an error trying to resolve this merge task. Please show this error message to your captain or lead on Slack.",
      response
    );
    return;
  }
  completeLocation("nomerge");
};

const createRequestTaskQueryParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const params = {};
  const q = urlParams.get("source_q");
  const state = urlParams.get("source_state");
  if (q) {
    params.q = q;
  }
  if (state) {
    params.state = state;
  }
  return new URLSearchParams(params).toString();
};
