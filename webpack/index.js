import "core-js/stable";
import "regenerator-runtime/runtime";
import "custom-event-polyfill";
import "whatwg-fetch";

const AUTH0_DOMAIN = 'vaccinateca.us.auth0.com';
const AUTH0_CLIENTID = 'ZnpcUDelsgbXXXMTayxzdPWTX8wikGi5';
const AUTH0_AUDIENCE = 'https://help.vaccinateca.com';

// https://auth0.com/docs/libraries/auth0-single-page-app-sdk
import createAuth0Client from '@auth0/auth0-spa-js';

// global auth0 object. probably a better way to do this
let auth0 = null;


const updateLogin = (user) => {
  const e = document.getElementById('login-email');
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
  redirect_uri: location.origin
}).then(a0 => {
  console.log("Auth0 setup complete");
  auth0 = a0;

  auth0.getUser().then(user => {
    updateLogin(user);
  });

}).catch(err => {
  console.log("XXX", err);
});


// handle login urls
window.addEventListener('load', async () => {
  const redirectResult = await auth0.handleRedirectCallback();
  // XXX maybe remove url paramaters now?

  const user = await auth0.getUser();
  updateLogin(user);
});

// wire up login/logout buttons
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById('login').addEventListener('click', () => {
    auth0.loginWithRedirect();
  });

  document.getElementById('logout').addEventListener('click', () => {
    auth0.logout({returnTo: location.origin});
  });

  document.getElementById('secureButton').addEventListener('click', async () => {
    const accessToken = await auth0.getTokenSilently({
        audience: AUTH0_AUDIENCE
      });
    const result = await fetch('/.netlify/functions/secure-test', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const data = await result.json();
    console.log("RESULTS", data);
    document.getElementById('results').innerHTML = JSON.stringify(data); // XXX THE HORROR
  });

  document.getElementById('requestCallButton').addEventListener('click', async () => {
    const accessToken = await auth0.getTokenSilently({
        audience: AUTH0_AUDIENCE
      });
    const result = await fetch('/.netlify/functions/requestCall', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const data = await result.json();
    console.log("RESULTS", data);
    document.getElementById('results').innerHTML = JSON.stringify(data); // XXX THE HORROR
  });
});
