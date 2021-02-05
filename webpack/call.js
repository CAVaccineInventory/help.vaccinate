// This is the AQI.WTF js. I just wanted a really basic structure to crib from.


(() => {
  window.addEventListener("load", onStart);

  let coord;
  let closestSensor;

  function onStart() {
  //  document.getElementById("powerwash").onclick = clearStorage;
    getNextCall();
  }


  function getNextCall() {
    const url =
      "https://www.ourbackend.com/data.json?opt=1/mAQI/a10/cC0&fetch=true&fields=,";

    window
      .fetch(url)
      .then((response) => response.json())
      .then((response) => {
        if (response.code && response.code >= 400 && response.message) {
          throw new Error(response.message);
        }
        return response;
      })
      .then(parseData)
      .then(setupCall)
      .catch(reportError);
  }


  function setupCall(location) {

    resetForm();
    fillTemplate(location);

  }
  
  function resetForm() {
	  
	  }

  function fillTemplate(location) {

    fillElem("phone", location.phoneNumber);

  }

  function fillElem(id,content) {
	  		const e = document.getElementById(id);
	  		e.innerHTML = content;
	  }



  // ffunction that loads data from a json blob into some fields we can work with
  
  function parseData(json) {
    let sensors = [];
    let fields = [];
    fields["indoor"] = json.fields.findIndex((e) => e === "Type");
    fields["latitude"] = json.fields.findIndex((e) => e === "Lat");
    fields["longitude"] = json.fields.findIndex((e) => e === "Lon");
    fields["id"] = json.fields.findIndex((e) => e === "ID");
    fields["age"] = json.fields.findIndex((e) => e === "age");
    for (const sensor of json.data) {
      // Ignore sensors which are either indoor or updated over 5 minutes ago
      if (sensor[fields["indoor"]] === 0 && sensor[fields["age"]] < 5) {
        sensors.push({
          id: sensor[fields["id"]],
          latitude: sensor[fields["latitude"]],
          longitude: sensor[fields["longitude"]],
        });
      }
    }
  }

})();