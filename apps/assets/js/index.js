import "core-js/stable";
import "regenerator-runtime/runtime";
import "custom-event-polyfill";
import "whatwg-fetch";

const AUTH0_DOMAIN = "vaccinateca.us.auth0.com";
const AUTH0_CLIENTID = "ZnpcUDelsgbXXXMTayxzdPWTX8wikGi5";
const AUTH0_AUDIENCE = "https://help.vaccinateca.com";

// https://auth0.com/docs/libraries/auth0-single-page-app-sdk
import createAuth0Client from "@auth0/auth0-spa-js";

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
  const redirectResult = await auth0.handleRedirectCallback();
  // XXX maybe remove url paramaters now?
  const user = await auth0.getUser();
  updateLogin(user);
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

const el = (elementId, value) => {
	const element = document.getElementById(elementId);
	if (element !== null) {
		element.innerHTML = value;
	}	
}

const link_target = (elementId, value) => {
	const element = document.getElementById(elementId);
	if (element !== null) {
		element.setAttribute('href',value);
	}	
}
const fillScoobyTemplate = (data) => {
	el('location-name', data.Name);
	el('location-address', data.Address);
	el('location-phone', data["Phone number"]);	
	link_target('location-phone-url', "tel:" .concat( data["Phone number"]));	
	el('location-county-name', data["County"]);	
	el('location-type', data["Location Type"]);	
	el('location-affiliation', data["Location Affiliation"]);	

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


}) ;
