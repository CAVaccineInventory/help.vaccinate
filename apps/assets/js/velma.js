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

const requestItem = async (id) => {
  var sourceLocation;
  showLoadingScreen();
  if (id) {
    //sourceLocation = await fetchJsonFromEndpoint("/requestItem?location_id=" + id);
  } else {
    // sourceLocation = await fetchJsonFromEndpoint("/requestItem?state=all");
  }

  sourceLocation = {
    name: "name blah",
    street1: "22 street st",
    city: "Oakland",
    state: "CA",
    zip: "94609",
    lat: "37.84096048875298",
    lon: "-122.2658426695491",
  };
  var candidates = fetchJsonFromEndpoint(
    "/searchLocations?size=20&latitude=" + sourceLocation.lat + "&longitude=" + sourceLocation.lon + "&radius=1000"
  );
  hideLoadingScreen();
  const user = await getUser();
  const userRoles = user["https://help.vaccinateca.com/roles"];
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
    fillItemTemplate(sourceLocation, candidates);
    activateItemTemplate();
    hideElement("#nextItemPrompt");
  }
};

const fillItemTemplate = (data, candidates) => {
  fillTemplateIntoDom(locationMatchTemplate, "#locationMatchCandidates", {
    candidates: candidates,
  });

  fillTemplateIntoDom(sourceLocationTemplate, "#sourceLocation", {
    id: data.id,
    name: data.name,
    address: data.address || "No address information available",
    hours: data.hours,
    lat: data.lat,
    lon: data.lon,
    website: data.website,
  });
  candidates.forEach((candidate) => {
    if (candidate.lat && candidate.lon) {
      var mymap = L.map("map-" + candidate.id).setView([candidate.latitude, candidate.longitude], 13);

      L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "mapbox/streets-v11",
        tileSize: 512,
        zoomOffset: -1,
        accessToken: "pk.eyJ1IjoiY2FsbHRoZXNob3RzIiwiYSI6ImNrbzNod3B0eDB3cm4ycW1ieXJpejR4cGQifQ.oZSg34AkLAVhksJjLt7kKA",
      }).addTo(mymap);
      var srcLoc = L.circle([data.lat, data.lon], {
        color: "red",
        fillColor: "#f03",
        fillOpacity: 0.5,
        radius: 5,
      }).addTo(mymap);
      var candidateLoc = L.circle([candidate.laitudet, candidate.longitude], {
        color: "blue",
        fillColor: "#30f",
        fillOpacity: 0.5,
        radius: 5,
      }).addTo(mymap);
      var group = new L.featureGroup([srcLoc, candidateLoc]);

      mymap.fitBounds(group.getBounds(), { padding: L.point(5, 5) });
    }
  });
  //fillTemplateIntoDom(callLogTemplate, "#callLog", { callId: data["id"] });
};
const activateItemTemplate = () => {
  enableInputDataBinding();
  //bindClick("#longHold", submitItemTwoHours);

  if (document.querySelector("#autodial")?.checked) {
    document.querySelector("#location-phone-url")?.click();
  }
};
