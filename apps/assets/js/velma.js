import "core-js/stable";
import "regenerator-runtime/runtime";

import { initAuth0, getAccessToken, loginWithRedirect, logout, getUser } from "./util/auth.js";

import {
  enableInputDataBinding,
  showElement,
  hideElement,
  showLoadingScreen,
  hideLoadingScreen,
  fillTemplateIntoDom,
  bindClick,
} from "./util/fauxFramework.js";

import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";

import nextItemPromptTemplate from "./templates/velma/nextItemPrompt.handlebars";
import locationMatchTemplate from "./templates/velma/locationMatch.handlebars";
import sourceLocationTemplate from "./templates/velma/sourceLocation.handlebars";

document.addEventListener("DOMContentLoaded", function () {
  initVelma();
});

let sourceLocation;

const initVelma = async () => {
  showLoadingScreen();

  await initAuth0();
  const user = await getUser();
  console.log(user);
  updateLogin(user);
  hideLoadingScreen();
  fillTemplateIntoDom(nextItemPromptTemplate, "#nextItemPrompt", {});
  bindClick("#requestItemButton", authOrLoadAndFillItem);
};

const updateLogin = (user) => {
  if (user && user.email) {
    fillTemplateIntoDom(loggedInAsTemplate, "#loggedInAs", {
      email: user.email,
    });
    bindClick("#logoutButton", logout);
  } else {
    fillTemplateIntoDom(notLoggedInTemplate, "#loggedInAs", {});
    bindClick("#loginButton", loginWithRedirect);
  }
};

const fetchJsonFromEndpoint = async (endpoint, method, body) => {
  const apiTarget =
    process.env.DEPLOY === "prod" ? "https://vial.calltheshots.us/api" : "https://vial-staging.calltheshots.us/api";

  if (!method) {
    method = "POST";
  }
  const accessToken = await getAccessToken();
  const result = await fetch(`${apiTarget}${endpoint}`, {
    method,
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  try {
    return await result.json();
  } catch (e) {
    // didnt get json back - treat as an error
    return { error: true, error_description: result.statusText };
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
    const urlParams = new URLSearchParams(window.location.search);
    const forceSourceLocation = urlParams.get("source_location_id");
    requestItem(forceSourceLocation);
  } else {
    loginWithRedirect();
  }
};

const skipItem = () => {
  requestItem();
};
const requestItem = async (id) => {
  let sourceLocationContainer;
  showLoadingScreen();
  // we appear to have some source locations with no latlon !?
  while (!sourceLocationContainer?.results[0]?.latitude) {
    if (id) {
      // sourceLocation = await fetchJsonFromEndpoint("/requestItem?location_id=" + id);
    } else {
      sourceLocationContainer = await fetchJsonFromEndpoint(
        "/searchSourceLocations?random=1&unmatched=1&size=1",
        "GET"
      );
    }
  }
  sourceLocation = sourceLocationContainer.results[0];
  const candidates = await fetchJsonFromEndpoint(
    "/searchLocations?size=50&latitude=" +
      sourceLocation.latitude +
      "&longitude=" +
      sourceLocation.longitude +
      "&radius=2000",
    "GET"
  );

  // record the distance. then sort the results by it
  candidates?.results.forEach((item) => {
    item.distance =
      Math.round(100 * distance(item.latitude, item.longitude, sourceLocation.latitude, sourceLocation.longitude)) /
      100;
  });
  candidates?.results.sort((a, b) => (a.distance > b.distance ? 1 : -1));

  hideLoadingScreen();
  const user = await getUser();
  if (sourceLocation.error) {
    showErrorModal(
      "Error fetching a call",
      "It looks like you might not yet have permission to use this tool. Please show this error message to your captain or lead on Slack: '" +
        sourceLocation.error_description +
        "'. They may also need to know that you are logged in as " +
        user?.email +
        ".",
      { user: user, error: sourceLocation }
    );
  } else {
    hideLoadingScreen();
    showElement("#velmaUI");
    fillItemTemplate(sourceLocation, candidates?.results);
    hideElement("#nextItemPrompt");
  }
};

const fillItemTemplate = (data, candidates) => {
  const sourceAddr =
    data.import_json.address.street1 +
    ", " +
    data.import_json.address.city +
    ", " +
    data.import_json.address.state +
    " " +
    data.import_json.address.zip;
  candidates?.forEach((candidate) => {
    // For some reason I can't access other keys inside a handlebars template's each
    // so i shove them in the candidate struct
    candidate.sourceAddress = sourceAddr;
    candidate.sourceName = data.name;
    if (candidate.latitude && candidate.longitude) {
      candidate.latitude = Math.round(candidate.latitude * 10000) / 10000;
      candidate.longitude = Math.round(candidate.longitude * 10000) / 10000;
    }
  });

  fillTemplateIntoDom(locationMatchTemplate, "#locationMatchCandidates", {
    candidates: candidates,
  });

  data.latitude = Math.round(data.latitude * 10000) / 10000;
  data.longitude = Math.round(data.longitude * 10000) / 10000;

  let url = "";
  try {
    url = data.import_json?.contact?.[0]?.website || data.import_json?.contact?.[1]?.website;
  } catch (e) {
    console.log("Jesse was too lazy to figure out how to find the first contact that had a website on this location");
  }
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
    website: url,
  });
  console.log(data.import_json);
  candidates?.forEach((candidate) => {
    if (candidate.latitude && candidate.longitude) {
      const mymap = L.map("map-" + candidate.id).setView([candidate.latitude, candidate.longitude], 13);

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
    bindClick("#match-" + candidate.id, matchLocation);
  });
};
const matchLocation = () => {
  const target = event.target;
  const id = target?.getAttribute("data-id");
  fetchJsonFromEndpoint(
    "/updateSourceLocationMatch",
    "POST",
    JSON.stringify({
      source_location: sourceLocation?.import_json?.id,
      location: id,
    })
  )
    .then(console.log("ok"))
    .then(requestItem());
};
const createLocation = () => {
  fetchJsonFromEndpoint(
    "/createLocationFromSourceLocation",
    "POST",
    JSON.stringify({
      source_location: sourceLocation?.import_json?.id,
    })
  )
    .then(console.log("ok"))
    .then(requestItem());
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
