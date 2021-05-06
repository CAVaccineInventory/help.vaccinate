import "core-js/stable";
import "regenerator-runtime/runtime";

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

import debugModalTemplate from "./templates/velma/debugModal.handlebars";
import nextItemPromptTemplate from "./templates/velma/nextItemPrompt.handlebars";
import locationMatchTemplate from "./templates/velma/locationMatch.handlebars";
import sourceLocationTemplate from "./templates/velma/sourceLocation.handlebars";

document.addEventListener("DOMContentLoaded", () => {
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
  const user = await getUser();

  // we appear to have some source locations with no latlon !?
  while (!sourceLocationContainer?.results[0]?.latitude) {
    let response;
    if (id) {
      response = await fetchJsonFromEndpoint("/searchSourceLocations?id=" + id, "GET");
    } else {
      response = await fetchJsonFromEndpoint("/searchSourceLocations?random=1&unmatched=1&size=1", "GET");
    }

    if (response.error) {
      showErrorModal(
        "Error fetching source location",
        "We ran into an error trying to fetch you a source location to match. Please show this error message to your captain or lead on Slack." +
          " They may also need to know that you are logged in as " +
          user?.email +
          ".",
        response
      );
      return;
    } else {
      sourceLocationContainer = response;
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

  if (candidates.error) {
    showErrorModal(
      "Error fetching locations to match against",
      "We ran into an error trying to fetch you a locations to match against. Please show this error message to your captain or lead on Slack." +
        " They may also need to know that you are logged in as " +
        user?.email +
        ".",
      response
    );
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

  console.log(data.import_json);
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
  }
  requestItem();
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
  }
  requestItem();
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
