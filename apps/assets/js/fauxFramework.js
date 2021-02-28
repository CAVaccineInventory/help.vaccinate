import "core-js/stable";
import "regenerator-runtime/runtime";

const bindClick = (selector, handler) => {
  const el = document.querySelector(selector);
  if (el !== null) {
    el.addEventListener("click", handler);
  } else {
    console.log("Could not find element with selector " + selector);
  }
};
const fillTemplateIntoDom = (template, selector, data) => {
  const el = document.querySelector(selector);
  if (el !== null) {
    el.innerHTML = template(data);
  } else {
    console.log("Could not find element with selector " + selector);
  }

  enableTooltips(selector);
  enablePopups(selector);
};

const hideElement = (selector) => {
  document.querySelector(selector)?.classList.add("hidden");
};

const showElement = (selector) => {
  document.querySelector(selector)?.classList.remove("hidden");
};

const enableShowAlso = () => {
  // This bit of js will automatically make clicking on any checkbox that has a data-show-also attribute
  // automatically toggle on the element with the id in the data-show-also attr
  document.querySelectorAll("[data-show-also]").forEach(function (sel) {
    document.querySelectorAll('input[name="' + sel.name + '"]').forEach(function (x) {
      addEventListener("change", function () {
        const selector = "#" + x.getAttribute("data-show-also");
        if (x.checked) {
          showElement(selector);
        } else if (!document.querySelector("[data-show-also=" + x.getAttribute("data-show-also") + "]:checked")) {
          hideElement(selector);
        }
      });
    });
  });
};

const enableHideOnSelect = () => {
  // This bit of js will automatically make clicking on any checkbox that has a data-hide-on-select attribute
  // automatically toggle on the element with the id in the data-hide-on-select attr
  document.querySelectorAll("[data-hide-on-select]").forEach(function (sel) {
    document.querySelectorAll('input[name="' + sel.name + '"]')?.forEach(function (x) {
      addEventListener("change", function () {
        const selector = "#" + x.getAttribute("data-hide-on-select");
        if (x.checked) {
          hideElement(selector);
        } else if (
          !document.querySelector("[data-hide-on-select=" + x.getAttribute("data-hide-on-select") + "]:checked")
        ) {
          // If any of the other radio buttons hide this section are picked, don't show it
          showElement(selector);
        }
      });
    });
  });
};

const enablePopups = (selector) => {
  const popupOptions = "status=no,location=no,toolbar=no,menubar=no,width=400,height=500,left=100,top=100";
  document.querySelectorAll(selector + " a.open-as-popup").forEach(function (el) {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      const popup = window.open(el.href, "corrections", popupOptions);
      if (window.focus) {
        popup.focus();
      }
      return false;
    });
  });
};

const enableTooltips = (selector) => {
  // enable tooltips inside the new template
  const tooltipTriggerList = [].slice.call(document.querySelectorAll(selector + ' [data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
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


export { bindClick, fillTemplateIntoDom, enableShowAlso, enableHideOnSelect, hideElement, showElement, hideToast, showToast, showErrorModal };
