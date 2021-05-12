import "core-js/stable";
import "regenerator-runtime/runtime";

import * as Sentry from "@sentry/browser";
import { Integrations } from "@sentry/tracing";

import { fetchJsonFromEndpoint } from "./util/api.js";
import { initAuth0, loginWithRedirect, logout, getUser } from "./util/auth.js";

import {
  showElement,
  hideElement,
  showLoadingScreen,
  hideLoadingScreen,
  fillTemplateIntoDom,
  bindClick,
  showModal,
  showErrorModal
} from "./util/fauxFramework.js";
import { MatchLogic } from "./velma/match.js";

import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";

import optionsModalTemplate from "./templates/velma/optionsModal.handlebars";
import completionToastTemplate from "./templates/velma/completionToast.handlebars";
import debugModalTemplate from "./templates/velma/debugModal.handlebars";
import nextItemPromptTemplate from "./templates/velma/nextItemPrompt.handlebars";
import locationMatchTemplate from "./templates/velma/locationMatch.handlebars";
import keybindingsHintTemplate from "./templates/velma/keybindingsHint.handlebars";

document.addEventListener("DOMContentLoaded", () => {
  Sentry.init({
    dsn: "https://f4f6dd9c4060438da4ae154183d9f7c6@o509416.ingest.sentry.io/5737071",
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 0.2,
  });
  initVelma();
});

const POWER_USER_KEY = "power_user";

let originalSourceLocationJson;
let sourceLocation;
let previousLocationId;
let currentCandidates;
let currentCandidateIndex;
let logic = MatchLogic();

const initVelma = async () => {
  showLoadingScreen();

  await initAuth0();
  const user = await getUser();
  updateLogin(user);
  hideLoadingScreen();
  fillTemplateIntoDom(nextItemPromptTemplate, "#nextItemPrompt", {});
  bindClick("#requestItemButton", authOrLoadAndFillItem);
  bindClick("#optionsButton", showPowerUserModal);
  enablePowerUserKeybindings();
};

const showHomeUI = () => {
  hideElement("#velmaUI");
  showElement("#nextItemPrompt");
};

const updateLogin = (user) => {
  if (user && user.email) {
    fillTemplateIntoDom(loggedInAsTemplate, "#loggedInAs", {
      email: user.email,
      cta: "Done Matching - Log out",
      displayOptions: true,
    });
    bindClick("#logoutButton", logout);
  } else {
    fillTemplateIntoDom(notLoggedInTemplate, "#loggedInAs", {});
    bindClick("#loginButton", loginWithRedirect);
  }
};

const authOrLoadAndFillItem = async () => {
  const user = await getUser();
  if (user && user.email) {
    requestItem();
  } else {
    loginWithRedirect();
  }
};

const requestItem = async () => {
  showLoadingScreen();

  const data = await logic.getData(() => showHomeUI());
  sourceLocation = data.sourceLocation;
  originalSourceLocationJson = data.originalSourceLocationJson;
  currentCandidates = data.candidates;
  currentCandidateIndex = 0;

  hideLoadingScreen();
  showElement("#velmaUI");
  hideElement("#nextItemPrompt");
  showCandidate();
};

const showCandidate = () => {
  const candidate = currentCandidates[currentCandidateIndex];

  fillTemplateIntoDom(locationMatchTemplate, "#locationMatchCandidates", {
    name: sourceLocation.name,
    address: sourceLocation.addr,
    website: sourceLocation.website,
    phone: sourceLocation.phone,

    candidate: candidate,
    numCandidates: currentCandidates.length,
    curNumber: currentCandidateIndex + 1,
  });

  if (candidate && candidate.latitude && candidate.longitude) {
    const mymap = L.map(`map-${candidate.id}`).setView([candidate.latitude, candidate.longitude], 13);

    L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
      attribution:
        'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: "mapbox/streets-v11",
      tileSize: 512,
      zoomOffset: -1,
      accessToken: "pk.eyJ1IjoiY2FsbHRoZXNob3RzIiwiYSI6ImNrbzNod3B0eDB3cm4ycW1ieXJpejR4cGQifQ.oZSg34AkLAVhksJjLt7kKA",
    }).addTo(mymap);
    const srcLoc = L.circle([sourceLocation.latitude, sourceLocation.longitude], {
      color: "red",
      fillColor: "#f03",
      fillOpacity: 0.5,
      radius: 15,
    }).addTo(mymap);
    const candidateLoc = L.circle([candidate.latitude, candidate.longitude], {
      color: "blue",
      fillColor: "#30f",
      fillOpacity: 0.5,
      radius: 15,
    }).addTo(mymap);

    // eslint-disable-next-line
    const group = new L.featureGroup([srcLoc, candidateLoc]);
    mymap.fitBounds(group.getBounds(), { padding: L.point(5, 5) });
  }

  bindClick(".js-debug", () => {
    showModal(debugModalTemplate, {
      sourceJson: originalSourceLocationJson,
      candidateJson: candidate ? JSON.stringify(candidate, null, 2) : null,
    });
  });
  bindClick(".js-skip", skipLocation);
  bindClick(".js-match", () => !!candidate && matchLocation(candidate.id));
  bindClick(".js-close", dismissItem);
  bindClick(".js-create", createLocation);
  bindClick(".js-tryagain", tryAgain);
};

const tryAgain = () => {
  currentCandidateIndex = 0;
  showCandidate();
};

const dismissItem = () => {
  currentCandidateIndex++;
  showCandidate();
};

const skipLocation = () => {
  completeLocation("skip");
};

const matchLocation = async (id) => {
  const response = await fetchJsonFromEndpoint(
    "/updateSourceLocationMatch",
    "POST",
    JSON.stringify({
      source_location: sourceLocation?.import_json?.id,
      location: id,
    })
  );
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

const createLocation = async () => {
  const response = await fetchJsonFromEndpoint(
    "/createLocationFromSourceLocation",
    "POST",
    JSON.stringify({
      source_location: sourceLocation?.import_json?.id,
    })
  );
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

const completeLocation = (source) => {
    previousLocationId = sourceLocation?.id;
    showCompletionToast(source);
    requestItem();
};

const showCompletionToast = (source) => {
  fillTemplateIntoDom(completionToastTemplate, "#toastContainer", {
    title: sourceLocation?.name,
    reasonSkip: source === "skip",
    reasonMatch: source === "match",
    reasonCreate: source === "create",
  });

  bindClick("#toastMakeChange", () => {
    redoPreviousLocation();
  });

  new bootstrap.Toast(document.querySelector("#completionToast"), {
    autohide: true,
  }).show();
};

const redoPreviousLocation = () => {
  document.querySelector("#completionToast")?.classList?.add("hide");
  if (previousLocationId) {
    requestItem(previousLocationId);
  }
  previousLocationId = null;
};

const updateKeybindHintsDom = () => {
  if (isPowerUserEnabled()) {
    fillTemplateIntoDom(keybindingsHintTemplate, "#keybindingsHint", {});
  } else if (document.querySelector("#keybindingsHint")) {
    document.querySelector("#keybindingsHint").innerHTML = "";
  }
};

const isPowerUserEnabled = () => {
  return localStorage.getItem(POWER_USER_KEY);
};

const showPowerUserModal = () => {
  showModal(
    optionsModalTemplate,
    {
      powerUserEnabled: isPowerUserEnabled(),
    },
    () => {
      const check = document.querySelector("#enablePowerUserMode");
      check?.addEventListener("change", () => {
        localStorage.setItem(POWER_USER_KEY, check?.checked ? "enabled" : "");
        updateKeybindHintsDom();
      });
    }
  );
};

const enablePowerUserKeybindings = () => {
  updateKeybindHintsDom();
  let isPressed = false;

  document.addEventListener("keyup", () => {
    isPressed = false;
  });

  document.addEventListener("keydown", (e) => {
    if (!isPowerUserEnabled() || isPressed) {
      return;
    }
    isPressed = true;

    const currentCandidate = document.querySelector(".candidateContainer");
    const id = currentCandidate?.getAttribute("data-id");
    switch (e.key) {
      case "1":
      case "m":
        if (id) {
          document.querySelector(".js-match")?.classList?.add("active");
          matchLocation(id);
        }
        break;
      case "2":
      case "d":
        if (id) {
          dismissItem();
        } else {
          tryAgain();
        }
        break;
      case "3":
      case "c":
        document.querySelector(".js-create")?.classList?.add("active");
        createLocation();
        break;
      case "4":
      case "s":
        document.querySelector(".js-skip")?.classList?.add("active");
        skipLocation();
        break;
      case "5":
      case "r":
        redoPreviousLocation();
        break;
    }
  });
};
