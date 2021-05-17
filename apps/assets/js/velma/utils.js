// This distance routine is licensed under LGPLv3.
// source: https://www.geodatasource.com/developers/javascript
export const distance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == lat2 && lon1 == lon2) {
    return 0;
  } else {
    const radlat1 = (Math.PI * lat1) / 180;
    const radlat2 = (Math.PI * lat2) / 180;
    const theta = lon1 - lon2;
    const radtheta = (Math.PI * theta) / 180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = (dist * 180) / Math.PI;
    dist = dist * 60 * 1.1515;
    return dist;
  }
};

export const setupMap = (currentLocation, candidate) => {
  if (candidate && candidate.latitude && candidate.longitude) {
    const mymap = L.map(`map-${candidate.id}`).setView([candidate.latitude, candidate.longitude], 13);

    L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}", {
      attribution:
        'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: "mapbox/streets-v11",
      tileSize: 512,
      zoomOffset: -1,
      accessToken: "pk.eyJ1IjoiY2FsbHRoZXNob3RzIiwiYSI6ImNrbzNod3B0eDB3cm4ycW1ieXJpejR4cGQifQ.oZSg34AkLAVhksJjLt7kKA",
    }).addTo(mymap);
    const srcLoc = L.circle([currentLocation.latitude, currentLocation.longitude], {
      color: "red",
      fillColor: "#f03",
      fillOpacity: 0.5,
      radius: 15,
    }).addTo(mymap);
    const candidateLoc = L.circle([candidate.latitude, candidate.longitude], {
      color: "blue",
      fillColor: "#30f",
      fillOpacity: 0.5,
      radius: 15,
    }).addTo(mymap);

    // eslint-disable-next-line
    const group = new L.featureGroup([srcLoc, candidateLoc]);
    mymap.fitBounds(group.getBounds(), { padding: L.point(5, 5) });
  }
};
