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
    document
      .querySelectorAll('input[name="' + sel.name + '"]')
      .forEach(function (x) {
        addEventListener("change", function () {
          const selector = "#" + x.getAttribute("data-show-also");
          if (x.checked) {
            showElement(selector);
          } else if (
            !document.querySelector(
              "[data-show-also=" +
                x.getAttribute("data-show-also") +
                "]:checked"
            )
          ) {
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
    document
      .querySelectorAll('input[name="' + sel.name + '"]')
      ?.forEach(function (x) {
        addEventListener("change", function () {
          const selector = "#" + x.getAttribute("data-hide-on-select");
          if (x.checked) {
            hideElement(selector);
          } else if (
            !document.querySelector(
              "[data-hide-on-select=" +
                x.getAttribute("data-hide-on-select") +
                "]:checked"
            )
          ) {
            // If any of the other radio buttons hide this section are picked, don't show it
            showElement(selector);
          }
        });
      });
  });
};

export {
	bindClick,
	fillTemplateIntoDom,
	enableShowAlso,
	enableHideOnSelect,
	hideElement,
	showElement
};
