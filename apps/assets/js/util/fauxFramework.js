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

const uncheckRadio = (name) => {
  const radio = document.querySelector(`input[name=${name}][type=radio]:checked`);
  if (radio) {
    radio.checked = false;
  }
};

const isHidden = (selector) => {
  return !!document.querySelector(selector)?.classList?.contains("hidden");
}

const enableInputDataBinding = () => {
  // Automatically makes clicking any input with the data-show-also and data-hide-on-select attribute automatically toggle the associated element.
  const inputs = Array.from(document.querySelectorAll("input[data-show-also], input[data-hide-on-select]"));

  // Init for radio inputs. Because radio inputs do not fire events on un-check, we find all radio inputs with the same name and group them together.
  // On check of any radio input in the group, check the state of each radio input.
  const radios = inputs.filter((input) => input.getAttribute("type") === "radio");
  const names = radios.reduce((set, radio) => {
    set.add(radio.getAttribute("name"));
    return set;
  }, new Set());

  names.forEach((name) => {
    const relatedRadios = document.querySelectorAll(`input[name=${name}][type=radio]`);
    relatedRadios.forEach((element) => {
      element.addEventListener("change", () => {
        relatedRadios.forEach((e) => {
          toggleElement(e);
        });
      });
    });
  });

  // init for non-radio inputs
  const nonRadios = inputs.filter((input) => input.getAttribute("type") !== "radio");
  nonRadios.forEach((element) => {
    element.addEventListener("change", () => {
      toggleElement(element);
    });
  });
};

const toggleElement = (element) => {
  const showIds = element.getAttribute("data-show-also")?.split(" ");
  const hideIds = element.getAttribute("data-hide-on-select")?.split(" ");

  if (showIds) {
    showIds.forEach((showId) => {
      if (element.checked) {
        showElement(`#${showId}`);
      } else {
        const checkedItems = Array.from(document.querySelectorAll("[data-show-also]:checked"));
        if (!checkedItems.some((item) => item.getAttribute("data-show-also").split(" ").includes(showId))) {
          hideElement(`#${showId}`);
        }
      }
    });
  }

  if (hideIds) {
    hideIds.forEach((hideId) => {
      if (element.checked) {
        hideElement(`#${hideId}`);
      } else {
        const checkedItems = Array.from(document.querySelectorAll("[data-hide-on-select]:checked"));
        if (!checkedItems.some((item) => item.getAttribute("data-hide-on-select").split(" ").includes(hideId))) {
          showElement(`#${hideId}`);
        }
      }
    });
  }
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

const showLoadingScreen = () => {
  showElement("#loading");
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const hideLoadingScreen = () => {
  hideElement("#loading");
};

const showModal = (template, templateVars, onShownCallback = null) => {
  hideLoadingScreen();
  fillTemplateIntoDom(template, "#modalContainer", templateVars);
  const modalDom = document.querySelector("#modalContainer .modal");
  const modal = new bootstrap.Modal(modalDom, {});
  modalDom.addEventListener("show.bs.modal", () => {
    if (onShownCallback) {
      onShownCallback(modal);
    }
  });

  modal.show();
};

export {
  bindClick,
  fillTemplateIntoDom,
  enableInputDataBinding,
  hideElement,
  showElement,
  isHidden,
  showLoadingScreen,
  hideLoadingScreen,
  uncheckRadio,
  showModal,
};
