import createAuth0Client from "@auth0/auth0-spa-js";

const AUTH0_DOMAIN = "vaccinateca.us.auth0.com";
const AUTH0_CLIENTID = "ZnpcUDelsgbXXXMTayxzdPWTX8wikGi5";
const AUTH0_AUDIENCE = "https://help.vaccinateca.com";

let auth0;

const initAuth0 = async () => {
  try {
    auth0 = await createAuth0Client({
      domain: AUTH0_DOMAIN,
      client_id: AUTH0_CLIENTID,
      audience: AUTH0_AUDIENCE,
      redirect_uri: window.location.href,
    });

    console.log("Auth0 setup complete");

    // TODO: throws if not logging in now, gross but works
    await auth0.handleRedirectCallback();
  } catch (err) {
    console.warn(err);
  }
};

const getAccessToken = async () => {
  return await auth0.getTokenSilently({
    audience: AUTH0_AUDIENCE,
  });
};

const loginWithRedirect = () => {
  auth0.loginWithRedirect();
};

const logout = () => {
  auth0.logout({ returnTo: window.location.href });
};

const getUser = async () => {
  return await auth0.getUser();
};

export { initAuth0, getAccessToken, loginWithRedirect, logout, getUser };
