const AUTH0_DOMAIN = "vaccinateca.us.auth0.com";
const AUTH0_CLIENTID = "ZnpcUDelsgbXXXMTayxzdPWTX8wikGi5";
const AUTH0_AUDIENCE = "https://help.vaccinateca.com";

import "core-js/stable";
import "regenerator-runtime/runtime";
import createAuth0Client from "@auth0/auth0-spa-js";
import locationTemplate from "./templates/location.handlebars";
import countyTemplate from "./templates/county.handlebars";
import latestReportTemplate from "./templates/latestReport.handlebars";
import ctaTemplate from "./templates/cta.handlebars";
import callReportFormTemplate from "./templates/callReportForm.handlebars";
import nextCallPromptTemplate from "./templates/nextCallPrompt.handlebars";
import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";
import dialResultTemplate from "./templates/dialResult.handlebars";
import callLogTemplate from "./templates/callLog.handlebars";

// https://auth0.com/docs/libraries/auth0-single-page-app-sdk
// global auth0 object. probably a better way to do this
let auth0 = null;

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

const initAuth0 = () => {
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
  logDebug("hiding " + selector);
  document.querySelector(selector).classList.add("hidden");
};

const showElement = (selector) => {
  logDebug("showing " + selector);
  document.querySelector(selector).classList.remove("hidden");
};

const hideScript = () => {
  hideElement("#callerTool");
};
const showScript = (location) => {
  hideElement("#nextCallPrompt");
  prepareCallTemplate(location);
  showElement("#callerTool");
};

const loadAndFillCall = async () => {
  logDebug("loading");
  const data = await fetchJsonFromEndpoint("/.netlify/functions/requestCall");
  initializeReport(data["id"]);
  showScript(data);
};

const showNextCallPrompt = () => {
  fillTemplateIntoDom(nextCallPromptTemplate, "#nextCallPrompt", {});
  bindClick("#requestCallButton", loadAndFillCall);
  showElement("#nextCallPrompt");
  hideScript();
};

const initScooby = () => {
  initAuth0();
  handleAuth0Login();
  showNextCallPrompt();
};

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



let currentReport = {};
let currentLocation = null;
let previousLocation = null;
let previousReport = null;


const initializeReport = (locationId) => {
	currentReport['Location'] = locationId;
};



const fillReportFromDom = () => {
    currentReport["Availability"] = Array.from( document.querySelector("#report_Availability").selectedOptions).map((el) => el.value);
    currentReport["Notes"] = document.querySelector("#report_Notes").value;
    currentReport["Phone"] = document.querySelector("#report_Phone").value;
    currentReport["Internal Notes"] = document.querySelector("#report_InternalNotes").value;
}

const submitCallReport = async () => {

  fillReportFromDom(); 
  logDebug("loading");
  console.log(currentReport);
  const callId = await recordCall(currentReport);
  logCallLocally(callId);

  if (callId) {
    showNextCallPrompt();
  }
};

const logCallLocally = (callId) => {
  fillTemplateIntoDom(callLogTemplate, "#callLog", { callId: callId });
}
const prepareCallTemplate = (data) => {
  fillTemplateIntoDom(locationTemplate, "#locationInfo", {
    locationName: data.Name,
    locationAddress: data.Address,
    locationHours: "9am to 6m , lunch 12-1",
    locationType: data["Location Type"],
    locationAffiliation: data["Location Affiliation"],
  });

  fillTemplateIntoDom(dialResultTemplate, "#dialResult", {});

  fillTemplateIntoDom(callReportFormTemplate, "#callReportForm", {
    LocationId: data.id,
  });

  fillTemplateIntoDom(latestReportTemplate, "#latestReport", {
    latestReportTime: data["Latest report"],
    latestReportStatus: "❌ No vaccine inventory",
    latestReportPublicNotes: "Expect something",
    latestReportInternalNotes: "Call again tomorrow",
  });

  fillTemplateIntoDom(countyTemplate, "#countyInfo", {
    countyName: data.County,
    countyInfo:
      "county vaccine info, common appointment url: https://www.rivcoph.org/COVID-19-Vaccine",
  });

  fillTemplateIntoDom(ctaTemplate, "#cta", {
    locationPhone: data["Phone number"],
  });

  bindClick("#scoobyRecordCall", submitCallReport);
};

export {
  doLogin,
  doLogout,
  initScooby,
  fetchJsonFromEndpoint,
  handleAuth0Login,
  initAuth0,
};
