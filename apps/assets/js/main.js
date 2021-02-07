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

// https://auth0.com/docs/libraries/auth0-single-page-app-sdk
// global auth0 object. probably a better way to do this
let auth0 = null;

const updateLogin = (user) => {
  const e = document.getElementById("login-email");
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

const debugOutput = (data) => {
  console.log("RESULTS", data);
  const target = document.getElementById("results");
  target.innerHTML = JSON.stringify(data); // XXX THE HORROR
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


const addScoobyListeners = () => {
  document
    .getElementById("requestCallButton")
    .addEventListener("click", async () => {
      document.getElementById("call-to-action").classList.add('hidden');
      debugOutput("loading");
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/requestCall"
      );
      fillScoobyTemplate(data);
      document.getElementById("caller-tool").classList.remove('hidden');
    });

}

const fillScoobyTemplate = (data) => {
  const previousReportLocation = locationTemplate({
    locationName: data.Name,
    locationAddress: data.Address,
    locationHours: "9am to 6m , lunch 12-1",
    locationType: data["Location Type"],
    locationAffiliation: data["Location Affiliation"]
  });
  document.getElementById('locationInfo').innerHTML = previousReportLocation;


  const latestReport = latestReportTemplate({
    latestReportTime: data['Latest report'],
    latestReportStatus: "❌ No vaccine inventory",
    latestReportPublicNotes: "Expect something",
    latestReportInternalNotes: "Call again tomorrow"
  });
  document.getElementById("latestReport").innerHTML = latestReport;

  const countyInfo = countyTemplate({
    countyName: data.County,
    countyInfo: "county vaccine info, common appointment url: https://www.rivcoph.org/COVID-19-Vaccine"
  });
  document.getElementById("countyInfo").innerHTML = countyInfo;

  const cta = ctaTemplate({
    locationPhone: data["Phone number"],
  });
  document.getElementById("cta").innerHTML = cta;
};


const addNetlifyTesterListeners = () => {
  document.getElementById("login").addEventListener("click", doLogin);
  document.getElementById("logout").addEventListener("click", doLogout);

  document.getElementById("checkAuthButton")
    .addEventListener("click", async () => {
      debugOutput("loading");
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/checkAuth"
      );
      debugOutput(data);
    });

  document.getElementById("requestCallButton")
    .addEventListener("click", async () => {
      debugOutput("loading");
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/requestCall"
      );
      debugOutput(data);
    });


  document.getElementById("submitReportButton")
    .addEventListener("click", async () => {
      const body = document.getElementById("submitReportText").value;
      debugOutput("loading");
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/submitReport",
        "POST", body
      );
      debugOutput(data);
    });

};


document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById('app-netlify-tester')) {
    addNetlifyTesterListeners();
  } else if (document.getElementById('app-scooby')) {
    addScoobyListeners();
  }
});

export { addNetlifyTesterListeners, addScoobyListeners };