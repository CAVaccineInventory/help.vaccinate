import "core-js/stable";
import "regenerator-runtime/runtime";

import { initAuth0, getUser, logout, loginWithRedirect } from "./util/auth.js";
import { showLoadingScreen, hideLoadingScreen, fillTemplateIntoDom, bindClick } from "./util/fauxFramework.js";

import loggedInAsTemplate from "./templates/loggedInAs.handlebars";
import notLoggedInTemplate from "./templates/notLoggedIn.handlebars";

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
