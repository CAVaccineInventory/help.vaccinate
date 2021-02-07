import { doLogin, doLogout, fetchJsonFromEndpoint,initAuth0, handleAuth0Login } from "./main.js";


document.addEventListener("DOMContentLoaded", function () {
initAuth0();
  handleAuth0Login();
});

const debugOutput = (data) => {
  console.log("RESULTS", data);
  const target = document.querySelector("#results");
  target.innerHTML = JSON.stringify(data); // XXX THE HORROR
};

const addNetlifyTesterListeners = () => {
  document.querySelector("#login").addEventListener("click", doLogin);
  document.querySelector("#logout").addEventListener("click", doLogout);

  document
    .querySelector("#checkAuthButton")
    .addEventListener("click", async () => {
      debugOutput("loading");
      const data = await fetchJsonFromEndpoint("/.netlify/functions/checkAuth");
      debugOutput(data);
    });

  document
    .querySelector("#requestCallButton")
    .addEventListener("click", async () => {
      debugOutput("loading");
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/requestCall"
      );
      debugOutput(data);
    });

  document
    .querySelector("#submitReportButton")
    .addEventListener("click", async () => {
      const body = document.querySelector("#submitReportText").value;
      debugOutput("loading");
      const data = await fetchJsonFromEndpoint(
        "/.netlify/functions/submitReport",
        "POST",
        body
      );
      debugOutput(data);
    });
};

document.addEventListener("DOMContentLoaded", function () {
  addNetlifyTesterListeners();
});
