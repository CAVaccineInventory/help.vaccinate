const AUTH0_DOMAIN = "vaccinateca.us.auth0.com";
const AUTH0_CLIENTID = "ZnpcUDelsgbXXXMTayxzdPWTX8wikGi5";
const AUTH0_AUDIENCE = "https://help.vaccinateca.com";

import "core-js/stable";
import "regenerator-runtime/runtime";
import createAuth0Client from "@auth0/auth0-spa-js";
import emptyTemplate from "./templates/empty.handlebars";
import locationTemplate from "./templates/location.handlebars";
import latestReportTemplate from "./templates/latestReport.handlebars";
import ctaTemplate from "./templates/cta.handlebars";
import nextCallPromptTemplate from "./templates/nextCallPrompt.handlebars";
import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";
import dialResultTemplate from "./templates/dialResult.handlebars";
import callLogTemplate from "./templates/callLog.handlebars";
import rewindCallTemplate from "./templates/rewindCall.handlebars";
import loadingScreenTemplate from "./templates/loadingScreen.handlebars";
import affiliationNotesTemplate from "./templates/affiliationNotes.handlebars";
import callScriptTemplate from "./templates/callScript.handlebars";

// https://auth0.com/docs/libraries/auth0-single-page-app-sdk
// global auth0 object. probably a better way to do this
let auth0 = null;

const currentReport = {};
let currentLocation = null;
let previousLocation = null;

const updateLogin = (user) => {
  if (user && user.email) {
    fillTemplateIntoDom(loggedInAsTemplate, "#loggedInAs", {
      email: user.email,
    });
    bindClick("#logoutButton", doLogout);
  } else {
    fillTemplateIntoDom(notLoggedInTemplate, "#loggedInAs", {});
    bindClick("#loginButton", doLogin);
  }
};

const initAuth0 = (cb) => {
  createAuth0Client({
    domain: AUTH0_DOMAIN,
    client_id: AUTH0_CLIENTID,
    audience: AUTH0_AUDIENCE,
    redirect_uri: window.location.href,
  })
    .then((a0) => {
      console.log("Auth0 setup complete");
      auth0 = a0;

      auth0.getUser().then((user) => {
        updateLogin(user);
        cb();
      });
    })
    .catch((err) => {
      console.log("XXX", err);
    });
};

const fetchJsonFromEndpoint = async (endpoint, method, body) => {
  if (!method) {
    method = "POST";
  }
  const accessToken = await auth0.getTokenSilently({
    audience: AUTH0_AUDIENCE,
  });
  const result = await fetch(endpoint, {
    method,
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await result.json();
  console.log(data);
  return data;
};

const doLogin = () => {
  auth0.loginWithRedirect();
};

const doLogout = () => {
  auth0.logout({ returnTo: location.origin });
};

const handleAuth0Login = async () => {
  if (auth0) {
    const redirectResult = await auth0.handleRedirectCallback();
    // XXX maybe remove url paramaters now?
    logDebug(redirectResult);
    const user = await auth0.getUser();
    if (user) {
      updateLogin(user);
    }
  }
};

const bindClick = (selector, handler) => {
  const el = document.querySelector(selector);
  if (el !== null) {
    el.addEventListener("click", handler);
  } else {
    logDebug("Could not find element with selector " + selector);
  }
};
const fillTemplateIntoDom = (template, selector, data) => {
  const el = document.querySelector(selector);
  if (el !== null) {
    el.innerHTML = template(data);
  } else {
    logDebug("Could not find element with selector " + selector);
  }
};
const logDebug = (msg) => {
  console.log(msg);
};
const hideElement = (selector) => {
  document.querySelector(selector).classList.add("hidden");
};

const showElement = (selector) => {
  document.querySelector(selector).classList.remove("hidden");
};

const loadAndFillCall = async () => {
  showLoadingScreen();
  previousLocation = currentLocation;
  currentLocation = await fetchJsonFromEndpoint(
    "/.netlify/functions/requestCall"
  );
  loadAndFill(currentLocation);
};

const loadAndFillPreviousCall = () => {
  logDebug("loading previous location");
  logDebug("it was " + previousLocation.Name);
  currentLocation = previousLocation;
  previousLocation = null;
  loadAndFill(currentLocation);
};

const loadAndFill = (place) => {
  // It is not a true "undo", but a "record a new call on this site"
  if (previousLocation !== null) {
    fillTemplateIntoDom(rewindCallTemplate, "#undoCall", {
      locationName: previousLocation.Name,
    });
    bindClick("#replaceReport", loadAndFillPreviousCall);
  } else {
    fillTemplateIntoDom(emptyTemplate, "#undoCall", {});
  }
  initializeReport(place["id"]);
  hideLoadingScreen();
  hideElement("#nextCallPrompt");
  prepareCallTemplate(place);
  showElement("#callerTool");
};

const showNextCallPrompt = () => {
  fillTemplateIntoDom(nextCallPromptTemplate, "#nextCallPrompt", {});
  bindClick("#requestCallButton", loadAndFillCall);
  showElement("#nextCallPrompt");
  hideElement("#callerTool");
};

const initScooby = () => {
  fillTemplateIntoDom(loadingScreenTemplate, "#loadingScreen", {});
  showLoadingScreen();
  initAuth0(function () {
    hideLoadingScreen();
    showNextCallPrompt();
  });
  handleAuth0Login();
};

const showLoadingScreen = () => { showElement("#loading"); };

const hideLoadingScreen = () => { hideElement("#loading"); };

const recordCall = async (callReport) => {
  console.log(callReport);
  const data = await fetchJsonFromEndpoint(
    "/.netlify/functions/submitReport",
    "POST",
    JSON.stringify(callReport)
  );
  if (data.created) {
    logDebug("Created a call");
    logDebug(data.created[0]);
  }
  return data.created;
};

const initializeReport = (locationId) => {
  currentReport["Location"] = locationId;
};

const fillReportFromDom = () => {
  const data = new FormData(document.querySelector("#callScriptForm"));
  const answers = [];
  for (const entry of data) {
    answers.push(entry[1]);
  }
  logDebug(answers);
  currentReport["Availability"] = answers;
  currentReport["Notes"] = document.querySelector(
    "#callScriptPublicNotes"
  ).value;
  // currentReport["Phone"] = document.querySelector("#report_Phone").value;
  currentReport["Internal Notes"] = document.querySelector(
    "#callScriptPrivateNotes"
  ).value;
};

const saveCallReport = async () => {
  fillReportFromDom();
  submitCallReport();
};

const AVAIL_BAD_CONTACT_INFO = "No: incorrect contact information";
const AVAIL_PERMANENTLY_CLOSED = "No: location permanently closed";
const AVAIL_SKIP = "Skip: call back later";

const submitBadContactInfo = async () => {
  submitWithAvail(AVAIL_BAD_CONTACT_INFO);
};

const submitPermanentlyClosed = async () => {
  submitWithAvail(AVAIL_PERMANENTLY_CLOSED);
};

const submitWithAvail = async (avail) => {
  fillReportFromDom();
  currentReport["Availability"] = [avail];
  submitCallReport();
};

const submitSkipUntil = async (when) => {
  fillReportFromDom();
  currentReport["Do not call until"] = when.toISOString();
  currentReport["Availability"] = [AVAIL_SKIP];
  submitCallReport();
};

const MINUTE = 60 * 1000;
const HOUR = MINUTE * 60;

// busy = 15 min delay
const submitBusy = async () => {
  const when = new Date();
  when.setTime(when.getTime() + 15 * MINUTE);
  submitSkipUntil(when);
};

// no answer = an hour delay - totally arbitrary choice
const submitNoAnswer = async () => {
  const when = new Date();
  when.setTime(when.getTime() + 1 * HOUR);
  submitSkipUntil(when);
};

// long hold = an hour delay - totally arbitrary choice
const submitLongHold = async () => {
  const when = new Date();
  when.setTime(when.getTime() + 1 * HOUR);
  submitSkipUntil(when);
};

const submitCallTomorrow = async () => {
  const when = new Date();
  // Advance the clock 24 hours to get to tomorrow, then bounce back to 8am localtime.
  // / TODO this shouldn't be in localtime
  when.setTime(when.getTime() + 24 * HOUR);
  when.setHours(8);
  when.setMinutes(0);
  submitSkipUntil(when);
};

const submitCallMonday = async () => {
  const when = new Date();
  when.setDate(when.getDate() + ((1 + 7 - when.getDay()) % 7));
  when.setHours(8);
  when.setMinutes(0);
  submitSkipUntil(when);
};

const submitCallReport = async () => {
  logDebug("loading");
  console.log(currentReport);
  const callId = await recordCall(currentReport);
  logCallLocally(callId);

  if (callId) {
    loadAndFillCall();
  }
};

const logCallLocally = (callId) => {
  fillTemplateIntoDom(callLogTemplate, "#callLog", { callId: callId });
};
const prepareCallTemplate = (data) => {
  fillTemplateIntoDom(locationTemplate, "#locationInfo", {
    locationId: data.id,
    locationName: data.Name,
    locationAddress: data.Address || 'No address information available',
    locationHours: data.Hours,
    locationWebsite: data.Website,
    locationType: data["Location Type"],
    locationAffiliation: data["Location Affiliation"],
    countyName: data.County,
    countyURL: data["County vaccine info URL"],
    countyInfo: data.county_notes,
    internalNotes: data["Internal Notes"]
  });

  console.log(data);
  fillTemplateIntoDom(dialResultTemplate, "#dialResult", {});
  fillTemplateIntoDom(affiliationNotesTemplate, "#affiliationNotes", {});

  let affiliation = data.Affiliation;
  affiliation = affiliation.replace(/\W/g, "").toLowerCase();
  console.log(affiliation);

  const affs = document.querySelectorAll("#affiliationNotes .provider");
  if (affs !== null) {
    affs.forEach((e) => {
      e.classList.add("hidden");
    });
  }

  const af = document.querySelector(
    "#affiliationNotes .provider." + affiliation
  );
  if (af !== null) {
    af.classList.remove("hidden");
  }

  fillTemplateIntoDom(ctaTemplate, "#cta", {
    locationPhone: data["Phone number"],
  });
  fillTemplateIntoDom(callScriptTemplate, "#callScript", {
    locationId: data.id,
    locationAddress: data.Address,
    locationPublicNotes: data.['Latest report notes'],
    locationPrivateNotes: data.["Latest Internal Notes"]
  });

  bindClick("#wrongNumber", submitBadContactInfo);
  bindClick("#permanentlyClosed", submitPermanentlyClosed);
  bindClick("#noAnswer", submitNoAnswer);
  bindClick("#phoneBusy", submitBusy);
  bindClick("#closedForTheDay", submitCallTomorrow);
  bindClick("#closedForTheWeekend", submitCallMonday);

  // don't show "on hold for more than 2 minutes" until 2 min have elapsed
  const el = document.querySelector("#longHold");
  if (el !== null) {
    el.style.visibility = "hidden";
    setTimeout(function () {
      el.style.visibility = "visible";
      bindClick("#longHold", submitLongHold);
    }, 120000);
  }

  bindClick("#scoobyRecordCall", saveCallReport);
};

export {
  doLogin,
  doLogout,
  initScooby,
  fetchJsonFromEndpoint,
  handleAuth0Login,
  initAuth0,
};
