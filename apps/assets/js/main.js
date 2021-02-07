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



// https://auth0.com/docs/libraries/auth0-single-page-app-sdk
// global auth0 object. probably a better way to do this
let auth0 = null;

const updateLogin = (user) => {
  const e = document.querySelector("#login-email");
  if (!e) {
    console.log("XXX dom not ready");
    return;
  }

  if (user && user.email) {
    e.innerHTML = user.email; // THE HORROR
  } else {
    e.innerHTML = "not logged in";
  }
};

createAuth0Client({
  domain: AUTH0_DOMAIN,
  client_id: AUTH0_CLIENTID,
  audience: AUTH0_AUDIENCE,
  redirect_uri: location.origin,
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

const fetchJsonFromEndpoint = async (endpoint, method, body) => {
  if (!method) {
    method = "POST";
  }
  const accessToken = await auth0.getTokenSilently({
    audience: AUTH0_AUDIENCE,
  });
  const result = await fetch(endpoint, {
    method, body,
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

// handle login urls
window.addEventListener("load", async () => {
  if (auth0) {
    const redirectResult = await auth0.handleRedirectCallback();
    // XXX maybe remove url paramaters now?
    const user = await auth0.getUser();
    if (user) {
      updateLogin(user);
    }
  }
});


const fillTemplateIntoDom = (template, selector, data) => {
const filled = template(data);
document.querySelector(selector).innerHTML = filled;

}
const logDebug = (msg) => {
	console.log(msg);
}
const hideElement = (selector) =>{
      logDebug("hiding "+selector);
      document.querySelector(selector).classList.add('hidden');
}

const showElement = (selector) =>{
      logDebug("showing "+selector);
      document.querySelector(selector).classList.remove('hidden');
}


const hideScript = () => { 
	hideElement("#callerTool");
}
const showScript = (location) => {
	hideElement("#nextCallPrompt");
        fillScoobyTemplate(location);
	showElement("#callerTool");
}


const showNextCallPrompt = () => {
	fillTemplateIntoDom(nextCallPromptTemplate, '#nextCallPrompt', {});
  document
    .querySelector("#requestCallButton")
    .addEventListener("click", async () => {
      logDebug("loading");
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/requestCall"
      );
	showScript(data);
    });
	showElement("#nextCallPrompt");
	hideScript();
	
}


const addScoobyListeners = () => {
	showNextCallPrompt();
}

const submitCallReport = async () => {
      var report = {
		"Location": document.querySelector('#report_LocationId').value,
		"Availability": Array.from( document.querySelector('#report_Availability').selectedOptions).map(el => el.value) ,
		"Notes": document.querySelector('#report_Notes').value,
		"Phone": document.querySelector('#report_Phone').value,
		"Internal Notes": document.querySelector('#report_InternalNotes').value
	};

      logDebug("loading");
	console.log(report);
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/submitReport",
        "POST", JSON.stringify(report)
      );
	logDebug("XXXXXXX HANDLE ERRORS!");
showNextCallPrompt();

      logDebug(data);


}


const fillScoobyTemplate = (data) => {
  const previousReportLocation = locationTemplate({
    locationName: data.Name,
    locationAddress: data.Address,
    locationHours: "9am to 6m , lunch 12-1",
    locationType: data["Location Type"],
    locationAffiliation: data["Location Affiliation"]
  });
  const filledForm = callReportFormTemplate({
	LocationId: data.id
  });
  document.querySelector('#locationInfo').innerHTML = previousReportLocation;
  document.querySelector('#callReportForm').innerHTML = filledForm;

  const latestReport = latestReportTemplate({
    latestReportTime: data['Latest report'],
    latestReportStatus: "❌ No vaccine inventory",
    latestReportPublicNotes: "Expect something",
    latestReportInternalNotes: "Call again tomorrow"
  });
  document.querySelector("#latestReport").innerHTML = latestReport;

  const countyInfo = countyTemplate({
    countyName: data.County,
    countyInfo: "county vaccine info, common appointment url: https://www.rivcoph.org/COVID-19-Vaccine"
  });
  document.querySelector("#countyInfo").innerHTML = countyInfo;
  document.querySelector("#scoobyRecordCall").addEventListener("click", submitCallReport);

  const cta = ctaTemplate({
    locationPhone: data["Phone number"],
  });
  document.querySelector("#cta").innerHTML = cta;

};




export { doLogin, doLogout, addScoobyListeners, fetchJsonFromEndpoint };
