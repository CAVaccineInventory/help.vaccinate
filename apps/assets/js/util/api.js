import { getAccessToken } from "./auth.js";

export const fetchJsonFromEndpoint = async (endpoint, method, body) => {
  const apiTarget =
    process.env.DEPLOY === "prod" ? "https://vial.calltheshots.us/api" : "https://vial-staging.calltheshots.us/api";

  if (!method) {
    method = "POST";
  }
  const accessToken = await getAccessToken();
  const result = await fetch(`${apiTarget}${endpoint}`, {
    method,
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  try {
    return await result.json();
  } catch (e) {
    // didnt get json back - treat as an error
    return { error: true, error_description: result.statusText };
  }
};