import { fetchJsonFromEndpoint } from "../util/api.js";

export const createCandidates = async (location, seedCandidate, onError) => {
  const response = await fetchJsonFromEndpoint(
    "/searchLocations?size=50&latitude=" +
      location.latitude +
      "&longitude=" +
      location.longitude +
      "&radius=2000",
    "GET"
  );

  if (response.error) {
    onError(response);
    return;
  }

  const candidates = response?.results || [];

  // TODO: dedupe
  if (seedCandidate) {
    candidates.push(seedCandidate);
  }

  // TODO: remove location from candidates

  // record the distance. then sort the results by it
  candidates.forEach((item) => {
    item.distance =
      Math.round(100 * distance(item.latitude, item.longitude, location.latitude, location.longitude)) /
      100;
  });
  candidates.sort((a, b) => (a.distance > b.distance ? 1 : -1));
  candidates.forEach((candidate) => {
    if (candidate && candidate.latitude && candidate.longitude) {
      candidate.latitude = Math.round(candidate.latitude * 10000) / 10000;
      candidate.longitude = Math.round(candidate.longitude * 10000) / 10000;
    }
  });

  return candidates;
};


// This distance routine is licensed under LGPLv3.
// source: https://www.geodatasource.com/developers/javascript
const distance = (lat1, lon1, lat2, lon2) => {
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
