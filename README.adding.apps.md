TODO: Is this wrong? should we always be creating new apps in auth0 for each SPA on help.?

To add another microapp to help that uses the same auth0 SPA auth as scooby:

1. Create another page in apps/pages 
2. If the app will be doing auth, you will need to configure auth0 to know about your endpoint, since they don't allow wildcards. 
You will need to add endpoints for local testing, staging, and prod at

https://manage.auth0.com/dashboard/us/vaccinateca/applications/ZnpcUDelsgbXXXMTayxzdPWTX8wikGi5/settings

For example for the 'call' app you'd add these 3 to Allowed Callback URLs :

http://localhost:4000/call/, 
https://staging-help-vaccinateca.netlify.app/call/, 
https://help.vaccinateca.com/call/


You probably also want to have the same list in logout locations
