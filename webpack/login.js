import axios from "axios";
import OktaSignIn from "@okta/okta-signin-widget";

const oktaOrgUrl = "https://dev-74290771.okta.com";
const oktaClientId = "0oa4yvgvhWye97rIv5d6";

// helper function to update the results text
const displayMessage = msg => {
    document.getElementById("results").innerHTML = msg;
};

// Displays a welcome message and enables the "Sign out" button
const updateProfile = idToken => {
    try {
        // Show Sign Out button
        document.getElementById("signOut").style.visibility = "visible";
        displayMessage(`Hello, ${idToken.claims.name} (${idToken.claims.email})`);
    } catch (err) {
        console.log(err);
        displayMessage(err.message);
    }
};

const signOut = (signInWidget) => {
    displayMessage("");

    // clear local stored tokens and sign out of Okta
    signInWidget.authClient.tokenManager.clear();
    signInWidget.authClient.signOut();

    // reload page
    window.location.reload();
};

const registerButtonEvents = async (signInWidget) => {
    // "Test public API" button click event handler
    document.getElementById("publicButton").addEventListener("click", async function () {
        try {
            displayMessage("");
            // Use axios to make a call to the public serverless function
            const res = await axios.get("/api/public-test");
            displayMessage(JSON.stringify(res.data));
        } catch (err) {
            console.log(err);
            displayMessage(err.message);
        }
    });

    // "Test secure API" button click event handler
    document.getElementById("secureButton").addEventListener("click", async function () {
        displayMessage("");
        try {
            // get the current access token to make the request
            const accessToken = await signInWidget.authClient.tokenManager.get("accessToken");
            if (!accessToken) {
                displayMessage("You are not logged in");
                return;
            }
            // use axios to make a call to the secure serverless function,
            // passing the access token in the Authorization header
            const res = await axios.get("/api/secure-test", {
                headers: {
                    Authorization: "Bearer " + accessToken.accessToken
                }
            });
            // display the returned data
            displayMessage(JSON.stringify(res.data));
        }
        catch (err) {
            displayMessage(err.message);
        }
    });

    // "Sign out" button click event handler
    document.getElementById("signOut").addEventListener("click", async function () {
        signOut(signInWidget);
    });
};

const showSignIn = (signInWidget) => {
    signInWidget.showSignInToGetTokens({
        clientId: oktaClientId,
        redirectUri: window.location.origin,
        // Return an access token from the authorization server
        getAccessToken: true,
        // Return an ID token from the authorization server
        getIdToken: true,
        scope: "openid profile email",
    });
};

const runOktaLogin = async (signInWidget) => {
    try {
        // Check if there's an existing login session
        const session = await signInWidget.authClient.session.get();

        if (session.status === "ACTIVE") {
            // Check if there are tokens in the URL after a redirect
            if (signInWidget.hasTokensInUrl()) {
                const res = await signInWidget.authClient.token.parseFromUrl();
                signInWidget.authClient.tokenManager.add("idToken", res.tokens.idToken);
                signInWidget.authClient.tokenManager.add("accessToken", res.tokens.accessToken);
            }

            // See if the idToken has already been added to the token manager
            const idToken = await signInWidget.authClient.tokenManager.get("idToken");
            if (idToken) {
                // There's already a login session and tokens, so update the welcome message
                return updateProfile(idToken);
            }

            // It's possible to have logged in somewhere else and have an active session,
            // but not have the idToken we want for this application
            showSignIn(signInWidget);

        } else {
            // User has not yet logged in, so show the login form
            showSignIn(signInWidget);
        }
    } catch (err) {
        console.log(err);
        displayMessage(err.message);
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // create an instance of the Okta Sign-In Widget
        const signInWidget = new OktaSignIn({
            baseUrl: oktaOrgUrl,
            el: "#widget-container",
            redirectUrl: window.location.origin,
            clientId: oktaClientId,
            authParams: {
                pkce: true,
                display: "page",
                issuer: `${oktaOrgUrl}/oauth2/default`
            },
            features: {
                registration: true
            }
        });
        await registerButtonEvents(signInWidget);
        await runOktaLogin(signInWidget);
    } catch (err) {
        console.log(err);
        displayMessage(err.message);
    }
}, false);
