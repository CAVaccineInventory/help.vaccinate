import "core-js/stable";
import "regenerator-runtime/runtime";

import * as Sentry from "@sentry/browser";
import { Integrations } from "@sentry/tracing";

import { initAuth0, loginWithRedirect, logout, getUser } from "./util/auth.js";

import {
  showElement,
  hideElement,
  showLoadingScreen,
  hideLoadingScreen,
  fillTemplateIntoDom,
  bindClick,
  showModal,
} from "./util/fauxFramework.js";
import { matchLogic } from "./velma/match.js";
import { mergeLogic } from "./velma/merge.js";

import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";

import optionsModalTemplate from "./templates/velma/optionsModal.handlebars";
import completionToastTemplate from "./templates/velma/completionToast.handlebars";
import debugModalTemplate from "./templates/velma/debugModal.handlebars";
import nextItemPromptTemplate from "./templates/velma/nextItemPrompt.handlebars";
import compareTemplate from "./templates/velma/compare.handlebars";

document.addEventListener("DOMContentLoaded", () => {
  Sentry.init({
    dsn: "https://f4f6dd9c4060438da4ae154183d9f7c6@o509416.ingest.sentry.io/5737071",
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 0.2,
  });
  initVelma();
});

const POWER_USER_KEY = "power_user";

let currentLocationDebugJson;
let currentLocation;
let previousLocationId;
let currentCandidates = [];
let currentCandidateIndex = 0;
let logic;

const initVelma = async () => {
  showLoadingScreen();

  await initAuth0();
  const user = await getUser();
  updateLogin(user);
  hideLoadingScreen();
  fillTemplateIntoDom(nextItemPromptTemplate, "#nextItemPrompt", {});
  bindClick(".js-start-matching", () => {
    logic = matchLogic();
    authOrLoadAndFillItem();
  });
  bindClick(".js-start-merging", () => {
    logic = mergeLogic();
    authOrLoadAndFillItem();
  });
  bindClick("#optionsButton", showPowerUserModal);
  bindClick(".navbar-brand", showHomeUI);
  enablePowerUserKeybindings();
};

const showHomeUI = () => {
  document.querySelector("#keybindingsHint").innerHTML = "";
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
    updateKeybindHintsDom();
    requestItem();
  } else {
    loginWithRedirect();
  }
};

const requestItem = async (id) => {
  showLoadingScreen();

  const data = await logic.getData(id, () => showHomeUI());
  currentLocation = data.currentLocation;
  currentLocationDebugJson = data.currentLocationDebugJson;
  currentCandidates = data.candidates || [];
  currentCandidateIndex = 0;

  hideLoadingScreen();
  showElement("#velmaUI");
  hideElement("#nextItemPrompt");
  showCandidate();
};

const showCandidate = () => {
  const candidate = currentCandidates[currentCandidateIndex];

  let locationUrl;
  let candidateUrl;
  locationUrl = `https://vaccinatethestates.com?lat=${currentLocation.latitude}&lng=${currentLocation.longitude}#${currentLocation.id}`
  if (candidate) {
    candidateUrl = `https://vaccinatethestates.com?lat=${candidate.latitude}&lng=${candidate.longitude}#${candidate.id}`
  }

  fillTemplateIntoDom(compareTemplate, "#compareCandidate", {
    currentLocation: currentLocation,
    candidate: candidate,
    numCandidates: currentCandidates.length,
    curNumber: currentCandidateIndex + 1,
    matching: logic.role === "match",
    locationUrl,
    candidateUrl,
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
    const srcLoc = L.circle([currentLocation.latitude, currentLocation.longitude], {
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
      currentJson: currentLocationDebugJson,
      candidateJson: candidate ? JSON.stringify(candidate, null, 2) : null,
    });
  });

  logic.initActions(currentLocation, candidate, actions);
};

const showCompletionToast = (source) => {
  fillTemplateIntoDom(completionToastTemplate, "#toastContainer", {
    title: currentLocation?.name,
    reasonSkip: source === "skip",
    reasonMatch: source === "match",
    reasonCreate: source === "create",
    reasonMerged: source === "merged",
    reasonNoMerge: source === "nomerge",
    supportsRedo: logic.supportsRedo,
  });

  bindClick("#toastMakeChange", () => {
    actions.undoPreviousLocation();
  });

  new bootstrap.Toast(document.querySelector("#completionToast"), {
    autohide: true,
  }).show();
};

const updateKeybindHintsDom = () => {
  if (isPowerUserEnabled()) {
    fillTemplateIntoDom(logic.keybindTemplate, "#keybindingsHint", {});
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
  let isPressed = false;

  document.addEventListener("keyup", () => {
    isPressed = false;
  });

  document.addEventListener("keydown", (e) => {
    if (!isPowerUserEnabled() || isPressed) {
      return;
    }
    isPressed = true;
    logic.handleKeybind(e.key, currentLocation, currentCandidates[currentCandidateIndex], actions);
  });
};

const actions = {
  restart: () => {
    currentCandidateIndex = 0;
    showCandidate();
  },
  dismissItem: () => {
    currentCandidateIndex++;
    showCandidate();
  },
  skipLocation: () => {
    actions.completeLocation("skip");
  },
  completeLocation: (source) => {
    previousLocationId = currentLocation?.id;
    showCompletionToast(source);
    requestItem();
  },
  undoPreviousLocation: () => {
    document.querySelector("#completionToast")?.classList?.add("hide");
    if (previousLocationId) {
      requestItem(previousLocationId);
    }
    previousLocationId = null;
  },
};
