import "core-js/stable";
import "regenerator-runtime/runtime";

import { initAuth0, getUser } from "./util/auth.js";
import { showLoadingScreen, hideLoadingScreen } from "./util/fauxFramework.js";

document.addEventListener("DOMContentLoaded", function () {
  initVelma();
});

const initVelma = async () => {
  showLoadingScreen();

  await initAuth0();
  const user = await getUser();
  console.log(user);

  hideLoadingScreen();
};
