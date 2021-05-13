import { createCandidates } from "./candidates.js";
import { getUser } from "../util/auth.js";
import { fetchJsonFromEndpoint } from "../util/api.js";
import { fillTemplateIntoDom, showErrorModal, bindClick } from "../util/fauxFramework.js";

import mergeActionsTemplate from "../templates/velma/mergeActions.handlebars";

export const mergeLogic = () => {
  const getData = async (id, onError) => {
    if (id) {
      console.error("merge logic doesn't support forced IDs");
      return;
    }
    const user = await getUser();
    const response = await fetchJsonFromEndpoint("/requestTask", "POST", JSON.stringify({
      task_type: "Potential duplicate",
    }));
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
        response
      );
      onError();
      return;
    }
    const currentLocation = response.task.location;
    const currentLocationDebugJson = JSON.stringify(currentLocation, null, 2);
    // add taskId to current location to later resolve
    currentLocation.task_id = response.task.id;

    const candidates = await createCandidates(currentLocation, response.task.other_location, (error) => {
      showErrorModal(
        "Error fetching locations to merge against",
        "We ran into an error trying to fetch you locations to merge against. Please show this error message to your captain or lead on Slack." +
            " They may also need to know that you are logged in as " +
            user?.email +
            ".",
        error
      );
      onError();
      return;
    });

    return {
      currentLocation,
      currentLocationDebugJson,
      candidates,
    };
  };

  const initActions = (currentLocation, candidate, actions) => {
    fillTemplateIntoDom(mergeActionsTemplate, "#actionsContainer", {
      candidate,
    });

    bindClick(".js-skip", actions.skipLocation);
    bindClick(".js-tryagain", actions.restart);
    bindClick(".js-close", actions.dismissItem);
    bindClick(".js-current-wins", () => mergeLocations(currentLocation.id, candidate.id, currentLocation.task_id, actions.completeLocation));
    bindClick(".js-candidate-wins", () => mergeLocations(candidate.id, currentLocation.id, currentLocation.task_id, actions.completeLocation));
    bindClick(".js-no-merges", () => resolveTask(currentLocation.task_id, actions.completeLocation));
  };

  const handleKeybind = (key, currentLocation, candidate, actions) => {
    switch (key) {
      case "1":
      case "r":
        if (currentLocation.id && candidate.id) {
          document.querySelector(".js-current-wins")?.classList?.add("active");
          mergeLocations(currentLocation.id, candidate.id, actions.completeLocation);
        }
        break;
      case "2":
      case "b":
        if (currentLocation.id && candidate.id) {
          document.querySelector(".js-candidate-wins")?.classList?.add("active");
          mergeLocations(candidate.id, currentLocation.id, actions.completeLocation);
        }
        break;
      case "3":
      case "d":
        if (candidate?.id) {
          actions.dismissItem();
        } else {
          actions.restart();
        }
        break;
      case "4":
      case "n":
        if (currentLocation.task_id) {
          document.querySelector(".js-no-merges")?.classList?.add("active");
          resolveTask(currentLocation.task_id, actions.completeLocation);
        }
        break;
      case "5":
      case "s":
        document.querySelector(".js-skip")?.classList?.add("active");
        actions.skipLocation();
        break;
    }
  };

  const getKeybindsHintTemplate = () => {
    return null;
  };

  return {
    getData,
    initActions,
    getKeybindsHintTemplate,
    handleKeybind,
    role: "merge",
    extensions: {
      compareHours: true,
    },
    supportsRedo: false,
  };
};

const mergeLocations = async (winner, loser, taskId, completeLocation) => {
    const response = await fetchJsonFromEndpoint("/mergeLocations", "POST", JSON.stringify({
        winner,
        loser,
        task_id: taskId
    }));

  if (response.error) {
    showErrorModal(
      "Error merging locations",
      "We ran into an error trying to merge these locations. Please show this error message to your captain or lead on Slack.",
      response
    );
    return;
  }
  completeLocation("merged");
}

const resolveTask = async (taskId, completeLocation) => {
    const user = await getUser();
    const response = await fetchJsonFromEndpoint("/resolveTask", "POST", JSON.stringify({
        task_id: taskId,
        resolution: {"resolver": user?.email}
    }));

  if (response.error) {
    showErrorModal(
      "Error resolving task",
      "We ran into an error trying to resolve this merge task. Please show this error message to your captain or lead on Slack.",
      response
    );
    return;
  }
  completeLocation("nomerge");
}