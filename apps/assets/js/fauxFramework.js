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

const enableInputDataBinding =() => {
  // init for radio inputs. Because radio inputs do not fire events on un-check, we find all radio inputs in a container and check against each on every change event.
  document.querySelectorAll("[data-radio-toggle-container]").forEach(container => {
    const elements = container.querySelectorAll("input[type=radio]");
    elements.forEach(element => {
      element.addEventListener('change', () => {
        elements.forEach(e => {
          toggleElement(e);
        });
      });
    });
  })

  // init for non-radio inputs
  const elements = Array.from(document.querySelectorAll("[data-show-also], [data-hide-on-select]")).filter(element => element.getAttribute('type') !== 'radio');
  elements.forEach(element => {
    element.addEventListener('change', () => {
      toggleElement(element);
    });
  });

}

const toggleElement = (element) => {
  const showId = element.getAttribute('data-show-also');
  const hideId = element.getAttribute('data-hide-on-select');

  if (showId) {
    if (element.checked) {
      showElement(`#${showId}`);
    } else if (!document.querySelector(`[data-show-also=${showId}]:checked`)) {
      hideElement(`#${showId}`);
    }
  }

  if (hideId) {
    if (element.checked) {
      hideElement(`#${hideId}`);
    } else if (!document.querySelector(`[data-hide-on-select=${hideId}]:checked`)) {
      showElement(`#${hideId}`);
    }
  }
}

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

export {
  bindClick,
  fillTemplateIntoDom,
  enableInputDataBinding,
  hideElement,
  showElement,
  showLoadingScreen,
  hideLoadingScreen,
};
