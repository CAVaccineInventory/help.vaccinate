import "core-js/stable";
import "regenerator-runtime/runtime";

import * as Sentry from "@sentry/browser";
import { Integrations } from "@sentry/tracing";

import { fetchJsonFromEndpoint } from "./util/api.js";
import { initAuth0, loginWithRedirect, logout, getUser } from "./util/auth.js";

import {
  enableInputDataBinding,
  showElement,
  hideElement,
  showLoadingScreen,
  hideLoadingScreen,
  fillTemplateIntoDom,
  bindClick,
  showModal,
} from "./util/fauxFramework.js";

import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";
import errorModalTemplate from "./templates/errorModal.handlebars";

import completionToastTemplate from "./templates/velma/completionToast.handlebars";
import debugModalTemplate from "./templates/velma/debugModal.handlebars";
import nextItemPromptTemplate from "./templates/velma/nextItemPrompt.handlebars";
import locationMatchTemplate from "./templates/velma/locationMatch.handlebars";
import sourceLocationTemplate from "./templates/velma/sourceLocation.handlebars";
import noMatchesTemplate from "./templates/velma/noMatches.handlebars";

document.addEventListener("DOMContentLoaded", () => {
  Sentry.init({
    dsn: "https://f4f6dd9c4060438da4ae154183d9f7c6@o509416.ingest.sentry.io/5737071",
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 0.2,
  });
  initVelma();
});

let sourceLocation;

const initVelma = async () => {
  showLoadingScreen();

  await initAuth0();
  const user = await getUser();
  updateLogin(user);
  hideLoadingScreen();
  fillTemplateIntoDom(nextItemPromptTemplate, "#nextItemPrompt", {});
  bindClick("#requestItemButton", authOrLoadAndFillItem);

  if (getForceLocation()) {
    authOrLoadAndFillItem();
  }
};

const updateLogin = (user) => {
  if (user && user.email) {
    fillTemplateIntoDom(loggedInAsTemplate, "#loggedInAs", {
      email: user.email,
      cta: "Done Matching - Log out",
    });
    bindClick("#logoutButton", logout);
  } else {
    fillTemplateIntoDom(notLoggedInTemplate, "#loggedInAs", {});
    bindClick("#loginButton", loginWithRedirect);
  }
};

const showErrorModal = (title, body, json) => {
  showModal(errorModalTemplate, {
    title,
    body,
    json: JSON.stringify(json, null, 2),
  });
};

const authOrLoadAndFillItem = async () => {
  const user = await getUser();
  if (user && user.email) {
    const id = getForceLocation();
    requestItem(id);
  } else {
    loginWithRedirect();
  }
};

const requestItem = async (id) => {
  showLoadingScreen();
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
    showHomeUI();
    return;
  } else if (response.results && !response.results.length) {
    // no results
    showErrorModal(
      "No locations to match",
      "It looks like we've matched every single source location for the provided query parameters!",
      createSearchQueryParams(id)
    );
    showHomeUI();
    return;
  }

  sourceLocation = response.results[0];
  const candidates = await fetchJsonFromEndpoint(
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
    showHomeUI();
    return;
  }

  // record the distance. then sort the results by it
  candidates?.results.forEach((item) => {
    item.distance =
      Math.round(100 * distance(item.latitude, item.longitude, sourceLocation.latitude, sourceLocation.longitude)) /
      100;
  });
  candidates?.results.sort((a, b) => (a.distance > b.distance ? 1 : -1));

  hideLoadingScreen();
  showElement("#velmaUI");
  fillItemTemplate(sourceLocation, candidates?.results);
  hideElement("#nextItemPrompt");
};

const fillItemTemplate = (data, candidates) => {
  const sourceAddr = `${data.import_json.address.street1}, ${data.import_json.address.city}, ${data.import_json.address.state} ${data.import_json.address.zip}`;
  candidates?.forEach((candidate) => {
    if (candidate.latitude && candidate.longitude) {
      candidate.latitude = Math.round(candidate.latitude * 10000) / 10000;
      candidate.longitude = Math.round(candidate.longitude * 10000) / 10000;
    }
  });

  fillTemplateIntoDom(locationMatchTemplate, "#locationMatchCandidates", {
    candidates: candidates,
    sourceAddress: sourceAddr,
    sourceName: data.name,
  });

  fillTemplateIntoDom(noMatchesTemplate, "#locationNoMatchesOptions", {
    hasCandidates: !!candidates?.length,
  });

  data.latitude = Math.round(data.latitude * 10000) / 10000;
  data.longitude = Math.round(data.longitude * 10000) / 10000;

  const website = data.import_json?.contact?.[0]?.website || data.import_json?.contact?.[1]?.website;
  fillTemplateIntoDom(sourceLocationTemplate, "#sourceLocation", {
    id: data.id,
    name: data.name,
    phone: data.phone_number,
    city: data.import_json.address.city,
    state: data.import_json.address.state,
    zip: data.import_json.address.zip,
    address: data.import_json.address.street1 || "No address information available",
    hours: data.hours,
    latitude: data.latitude,
    longitude: data.longitude,
    website,
  });

  candidates?.forEach((candidate) => {
    if (candidate.latitude && candidate.longitude) {
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
      const srcLoc = L.circle([data.latitude, data.longitude], {
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
  });
  enableInputDataBinding();
  bindClick("#skip", skipItem);
  bindClick("#createLocation", createLocation);
  candidates?.forEach((candidate) => {
    const id = candidate.id;
    bindClick(`#match-${id}`, matchLocation);
    bindClick(`#record-${id} .js-close`, () => {
      hideElement(`#record-${id}`);
    });
  });
  bindClick("#debugSource", () => {
    const debugData = {
      id: data.id,
      source_uid: data.source_uid,
      source_name: data.source_name,
      name: data.name,
    };
    showModal(debugModalTemplate, {
      sourceJson: JSON.stringify(debugData, null, 2),
    });
  });
};

const skipItem = () => {
  completeLocation();
};

const matchLocation = async (e) => {
  const target = e.target;
  const id = target?.getAttribute("data-id");
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
  completeLocation();
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
  completeLocation();
};

const completeLocation = () => {
  if (getForceLocation()) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete("source_location_id");
    window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
    showHomeUI();
  } else {
    showCompletionToast();
    requestItem();
  }
};

const showHomeUI = () => {
  hideElement("#velmaUI");
  showElement("#nextItemPrompt");
};

const showCompletionToast = () => {
  const previousId = sourceLocation?.id;
  fillTemplateIntoDom(completionToastTemplate, "#toastContainer", {
    title: sourceLocation?.name,
  });

  bindClick("#toastMakeChange", () => {
    requestItem(previousId);
  });

  new bootstrap.Toast(document.querySelector("#completionToast"), {
    autohide: true,
  }).show();
};

// This distance routine is licensed under LGPLv3.
// source: https://www.geodatasource.com/developers/javascript
const distance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == lat2 && lon1 == lon2) {
    return 0;
  } else {
    const radlat1 = (Math.PI * lat1) / 180;
    const radlat2 = (Math.PI * lat2) / 180;
    const theta = lon1 - lon2;
    const radtheta = (Math.PI * theta) / 180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = (dist * 180) / Math.PI;
    dist = dist * 60 * 1.1515;
    return dist;
  }
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
    const source_name = urlParams.get("source_name");
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
    if (source_name) {
      params.source_name = source_name;
   }
  }
  return new URLSearchParams(params).toString();
};

const getForceLocation = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("source_location_id");
};
