import { createCandidates } from "./candidates.js";
import { getUser } from "../util/auth.js";
import { fetchJsonFromEndpoint } from "../util/api.js";

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
  };
  const handleKeybind = (key, currentLocation, candidate, actions) => {
    return null;
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
