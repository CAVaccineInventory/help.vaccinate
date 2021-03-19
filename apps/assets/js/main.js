const AUTH0_DOMAIN = "vaccinateca.us.auth0.com";
const AUTH0_CLIENTID = "ZnpcUDelsgbXXXMTayxzdPWTX8wikGi5";
const AUTH0_AUDIENCE = "https://help.vaccinateca.com";

import "core-js/stable";
import "regenerator-runtime/runtime";

import {
  bindClick,
  fillTemplateIntoDom,
  enableShowAlso,
  enableHideOnSelect,
  hideElement,
  showElement,
  showLoadingScreen,
  hideLoadingScreen,
} from "./fauxFramework.js";

import createAuth0Client from "@auth0/auth0-spa-js";
import locationTemplate from "./templates/location.handlebars";
import youAreCallingTemplate from "./templates/youAreCalling.handlebars";
import ctaTemplate from "./templates/cta.handlebars";
import nextCallPromptTemplate from "./templates/nextCallPrompt.handlebars";
import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";
import dialResultTemplate from "./templates/dialResult.handlebars";
import callLogTemplate from "./templates/callLog.handlebars";
import toastTemplate from "./templates/toast.handlebars";
import affiliationNotesTemplate from "./templates/affiliationNotes.handlebars";
import callScriptTemplate from "./templates/callScript.handlebars";
import errorModalTemplate from "./templates/errorModal.handlebars";

// https://auth0.com/docs/libraries/auth0-single-page-app-sdk
// global auth0 object. probably a better way to do this
let auth0 = null;
let userRoles = null;
let currentReport = {};
let currentLocation = null;
let previousLocation = null;

let previousCallScriptDom = null;

let providerSchedulingUrl = null;

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
  showLoadingScreen();
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
  hideLoadingScreen();
  return data;
};

const doLogin = () => {
  auth0.loginWithRedirect();
};

const doLogout = () => {
  auth0.logout({ returnTo: window.location.href });
};

const handleAuth0Login = async () => {
  if (auth0) {
    await auth0.handleRedirectCallback();
    // XXX maybe remove url paramaters now?
    const user = await auth0.getUser();
    if (user) {
      updateLogin(user);
    }
  }
};

const showErrorModal = (title, body, json) => {
  hideLoadingScreen();
  fillTemplateIntoDom(errorModalTemplate, "#applicationError", {
    title: title,
    body: body,
    json: JSON.stringify(json, null, 2),
  });

  const myModal = new bootstrap.Modal(document.getElementById("errorModal"), {});
  myModal.show();
};

const authOrLoadAndFillCall = async () => {
  const user = await auth0.getUser();
  if (user && user.email) {
    const urlParams = new URLSearchParams(window.location.search);
    const forceLocation = urlParams.get("location_id");
    requestCall(forceLocation);
  } else {
    doLogin();
  }
};

const requestCall = async (id) => {
  if (id) {
    currentLocation = await fetchJsonFromEndpoint("/.netlify/functions/requestCall?location_id=" + id);
  } else {
    currentLocation = await fetchJsonFromEndpoint("/.netlify/functions/requestCall");
  }
  const user = await auth0.getUser();
  userRoles = user['https://help.vaccinateca.com/roles'];
  if (currentLocation.error) {
    showErrorModal(
      "Error fetching a call",
      "It looks like you might not yet have permission to use this tool. Please show this error message to your captain or lead on Slack: '" +
        currentLocation.error_description +
        "'. They may also need to know that you are logged in as " +
        user?.email +
        ".",
      { user: user, error: currentLocation }
    );
  } else {
    hideLoadingScreen();
    hideElement("#nextCallPrompt");
    showElement("#callerTool");
    showScriptForLocation(currentLocation);
    activateCallTemplate();
  }
};

const loadAndFillPreviousCall = () => {
  hideToast(); // should do this somewhere smarter.
  currentLocation = previousLocation;
  previousLocation = null;
  showScriptForLocation(currentLocation);
  // Replace the call script with the call script from the previous report
  const callScript = document.getElementById("callScript");
  callScript.parentNode.replaceChild(previousCallScriptDom, callScript);
  activateCallTemplate();
};

const showScriptForLocation = (place) => {
  // Initialize the report
  currentReport = {};
  currentReport["Location"] = place.id;

  // TODO Create a history entry for the new location
  // and bake all of our state into the state object. then also
  // implement a popstate handler, so we get proper back button support
  //  const url = new URL(window.location);
  //  url.searchParams.set("location_id", place.id);
  //  url.searchParams.delete("code");
  //  url.searchParams.delete("state");
  //  window.history.pushState({}, "", url);

  providerSchedulingUrl = null;
  fillCallTemplate(place);
};

const initScooby = () => {
  showLoadingScreen();
  initAuth0(function () {
    handleAuth0Login();
    hideLoadingScreen();
    fillTemplateIntoDom(nextCallPromptTemplate, "#nextCallPrompt", {});
    bindClick("#requestCallButton", authOrLoadAndFillCall);
    showElement("#nextCallPrompt");
    hideElement("#callerTool");
    // this shouldn't be here, but it only needs to get run once. So maybe it's ok?
    document.querySelector("#autodial")?.addEventListener("change", function () {
      if (this.checked) {
        document.querySelector("#location-phone-url")?.click();
      }
    });
  });
};

const constructReportFromDom = () => {
  const answers = [];
  let isYes = false;
  let isNo = false;
  const topLevelAnswer = document.querySelector("[name=yesNoSelect]:checked")?.value;
  switch (topLevelAnswer) {
    case "yesJustYes":
      isYes = true;
      // We don't have a tag for this one
      break;
    case "yesSoon":
      isYes = true;
      answers.push("Yes: coming soon");
      break;
    case "noJustNo":
      isNo = true;
      break;
    default:
      console.log("No top level answer selected ");
  }

  if (isNo === true) {
    const noReason = document.querySelector("[name=noReasonSelect]:checked")?.value;
    switch (noReason) {
      case "never":
        answers.push("No: will never be a vaccination site");
        break;
      case "private":
        answers.push("No: not open to the public");
        break;
      case "staffOnly":
        answers.push("No: only vaccinating staff");
        break;
      case "hcwOnly":
        answers.push("No: only vaccinating health care workers");
        break;
      case "notYet":
        answers.push("No: may be a vaccination site in the future");
        break;
      default:
        console.log("No 'no' reason selected");
    }
  }

  if (isYes === true) {
    const minAgeAnswer = document.querySelector("[name=minAgeSelect]:checked")?.value;
    if (minAgeAnswer) {
      answers.push("Yes: vaccinating " + minAgeAnswer + "+");
    }
    const apptRequired = document.querySelector("[name=appointmentRequired]:checked")?.value;

    switch (apptRequired) {
      case "walkinOk":
        answers.push("Yes: walk-ins accepted");
        break;
      case "required":
        answers.push("Yes: appointment required");
        break;
      default:
        answers.push("Yes: appointment required");
        console.log("no appt required selected - defaulting to appt required");
    }

    if (apptRequired === "required") {
      if (document.querySelector("[name=appointmentsAvailable]:checked")?.value === "full") {
        answers.push("Yes: appointment calendar currently full");
      }

      const apptMethod = document.querySelector("[name=appointmentMethod]:checked")?.value;
      switch (apptMethod) {
        case "phone":
          currentReport["Appointments by phone?"] = true;
          currentReport["Appointment scheduling instructions"] = document.querySelector("#appointmentPhone")?.value;
          break;
        case "county":
          currentReport["Appointment scheduling instructions"] = "Uses county scheduling system";
          break;
        case "myturn":
          currentReport["Appointment scheduling instructions"] = "https://myturn.ca.gov/";
          break;
        case "web":
          currentReport["Appointment scheduling instructions"] = document.querySelector("#appointmentWebsite")?.value;
          break;
        case "other":
          currentReport["Appointment scheduling instructions"] = document.querySelector(
            "#appointmentOtherInstructions"
          )?.value;
          break;
        default:
          break;
      }
    }
    if (document.querySelector("#essentialWorkersAccepted")?.checked) {
      answers.push("Vaccinating essential workers");
    }
    if (document.querySelector("#emergencyServicesAccepted")?.checked) {
      answers.push("Vaccinating emergency services workers");
    }
    if (document.querySelector("#educatorsAccepted")?.checked) {
      answers.push("Vaccinating education and childcare workers");
    }
    if (document.querySelector("#foodAndAgAccepted")?.checked) {
      answers.push("Vaccinating agriculture and food workers");
    }
    if (document.querySelector("#highRiskIndividualsAccepted")?.checked) {
      answers.push("Vaccinating high-risk individuals");
    }

    if (document.querySelector("#veteransOnly")?.checked) {
      answers.push("Yes: must be a veteran");
    }

    if (document.querySelector("#patientsOnly")?.checked) {
      answers.push("Yes: must be a current patient");
    }
    if (document.querySelector("#countyOnly")?.checked) {
      answers.push("Yes: restricted to county residents");
    }
    if (document.querySelector("#cityOnly")?.checked) {
      answers.push("Yes: restricted to city residents");
    }

    if (document.querySelector("#secondDoseOnly")?.checked) {
      answers.push(AVAIL_SECOND_DOSE_ONLY);
    }
  }

  if (document.querySelector("#reviewRequested")?.checked) {
    currentReport["is_pending_review"] = true;
  }

  currentReport["Availability"] = answers;
  currentReport["Notes"] = document.querySelector("#callScriptPublicNotes")?.innerText;
  currentReport["Internal Notes"] = document.querySelector("#callScriptPrivateNotes")?.innerText;
  currentReport["extra_dose_info"] = document.querySelector("#callScriptExtraDoseNotes")?.innerText;
  currentReport["documentation_requirements"] = document.querySelector("#callScriptHighRiskDocNotes")?.innerText;
  console.log(currentReport);
};

const saveCallReport = async () => {
  constructReportFromDom();
  submitCallReport();
};

const AVAIL_BAD_CONTACT_INFO = "No: incorrect contact information";
const AVAIL_PERMANENTLY_CLOSED = "No: location permanently closed";
const AVAIL_SKIP = "Skip: call back later";
const AVAIL_SECOND_DOSE_ONLY = "Scheduling second dose only";

const submitBadContactInfo = async () => {
  submitWithAvail(AVAIL_BAD_CONTACT_INFO);
};

const submitPermanentlyClosed = async () => {
  submitWithAvail(AVAIL_PERMANENTLY_CLOSED);
};

const submitWithAvail = async (avail) => {
  constructReportFromDom();
  currentReport["Availability"] = [avail];
  submitCallReport();
};

const submitSkipUntil = async (when) => {
  constructReportFromDom();
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
  const data = await fetchJsonFromEndpoint("/.netlify/functions/submitReport", "POST", JSON.stringify(currentReport));
  if (data.error) {
    showErrorModal(
      "Error submitting your report",
      "I'm really sorry, but it looks like something has gone wrong while trying to submit your report. The specific error the system sent back was '" +
        data.error_description +
        "'. This is not your fault. You can try clicking the 'Close' button on this box and submitting your report again. If that doesn't work, copy the technical information below and paste it into Slack, so we can get this sorted out for you",
      { report: currentReport, result: data }
    );
  } else {
    const callId = data.created;

    if (callId) {
      showToast(currentLocation.Name, "Got your report!", "Need to make a change?", loadAndFillPreviousCall);

      previousLocation = currentLocation;
      previousCallScriptDom = document.getElementById("callScript").cloneNode(1);
      requestCall();
    }
  }
};

// If the caller is in the liveops group we want them to dial through the liveops dialer, not ours
const liveopsDial = (event) => {
	var button =  document.getElementById('location-phone-url');
	var num = button?.getAttribute('data-phone-number');
	num = num.replace(/[^\d]/g, '');
        button.target='scratch-frame';
	button.href = "https://app-scl.five9.com/appsvcs/rs/svc/orgs/131050/interactions/click_to_dial?number="+num+"&campaignId=VaccinateCA&contactId=&dialImmediately=false";
};


const fillCallTemplate = (data) => {
  fillTemplateIntoDom(affiliationNotesTemplate, "#affiliationNotes", {});

  let affiliation = data.Affiliation || "";
  affiliation = affiliation
    .toLowerCase()
    .replace(/pharmacy/, "")
    .replace(/\W/g, "");
  const affs = document.querySelectorAll("#affiliationNotes .provider");
  if (affs !== null) {
    affs.forEach((e) => {
      e.classList.add("hidden");
    });
  }

  if (affiliation && affiliation !== "") {
    const providerDiv = document.querySelector("#affiliationNotes .provider." + affiliation);
    if (providerDiv !== null) {
      providerDiv.classList.remove("hidden");
      providerSchedulingUrl = providerDiv.getAttribute("data-scheduling-url");
    }
  }
  if (data.Address === "" || !data.Address) {
    showElement("#requestAddress");
  }


  fillTemplateIntoDom(youAreCallingTemplate, "#youAreCalling", { 
    locationName: data.Name,
    locationAddress: data.Address || "No address information available",
    countyName: data.County,
    countyURL: data["County vaccine info URL"],
});

  fillTemplateIntoDom(locationTemplate, "#locationInfo", {
    locationId: data.id,
    locationName: data.Name,
    locationAddress: data.Address || "No address information available",
    locationHours: data.Hours,
    locationWebsite: data.Website,
    locationType: data["Location Type"],
    locationAffiliation: data["Location Affiliation"],
    countyName: data.County,
    countyURL: data["County vaccine info URL"],
    countyInfo: data.county_notes,
    internalNotes: data["Internal Notes"],
  });
  fillTemplateIntoDom(dialResultTemplate, "#dialResult", {});

  let responsiblePerson = "the right person";
  if (data["Location Type"] === "Pharmacy") {
    responsiblePerson = "the pharmacist on duty";
  }

  fillTemplateIntoDom(ctaTemplate, "#cta", {
    locationPhone: data["Phone number"],
  });

  fillTemplateIntoDom(callScriptTemplate, "#callScript", {
    locationId: data.id,
    locationAddress: data.Address,
    locationWebsite: providerSchedulingUrl || data.Website,
    responsiblePerson: responsiblePerson,
    locationPhone: data["Phone number"],
    locationPrivateNotes: data["Latest Internal Notes"],
  });

  fillTemplateIntoDom(callLogTemplate, "#callLog", { callId: data["id"] });
};

const activateCallTemplate = () => {
  enableShowAlso();
  enableHideOnSelect();

  bindClick("#scoobyRecordCall", saveCallReport);
  bindClick("#wrongNumber", submitBadContactInfo);
  bindClick("#permanentlyClosed", submitPermanentlyClosed);
  bindClick("#noAnswer", submitNoAnswer);
  bindClick("#phoneBusy", submitBusy);
  bindClick("#closedForTheDay", submitCallTomorrow);
  bindClick("#closedForTheWeekend", submitCallMonday);
  bindClick("#longHold", submitLongHold);

  if (userRoles.includes("CC: Liveops")) {
    bindClick("#location-phone-url", liveopsDial);
  } 


  // don't show "on hold for more than 4 minutes" until 4 min have elapsed
  const el = document.querySelector("#longHold");
  if (el !== null) {
    el.style.visibility = "hidden";
    setTimeout(function () {
      el.style.visibility = "visible";
    }, 240000);
  }
  if (document.querySelector("#autodial")?.checked) {
    document.querySelector("#location-phone-url")?.click();
  }
};

// assumes we only have one toast at a time
const showToast = (title, body, buttonLabel, clickHandler) => {
  fillTemplateIntoDom(toastTemplate, "#toastContainer", {
    body: body,
    title: title,
    buttonLabel: buttonLabel,
  });

  bindClick("#onlyToastButton", clickHandler);
  const t = new bootstrap.Toast(document.querySelector("#onlyToast"), {
    autohide: true,
  });
  t.show();
};

const hideToast = () => {
  const el = document.querySelector("#onlyToast");
  if (el) {
    el.classList.add("hide");
  }
};

export { doLogin, doLogout, initScooby, fetchJsonFromEndpoint, handleAuth0Login, initAuth0 };
