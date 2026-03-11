# Concept and Instructions

**The architecture for this deployment setup is the following:**

- You have one docker-compose.yml in /deploy, this docker-compose is used for the main server and collects the app core (Redis, Postgres, Frontend and Backend) together with all the service modules as extra profiles, so you can have an all-in one instance with all the necesary containers to run the app.

- The docker-compose.yml inside /deploy/services is the one used for OTHER instances aside from the main one, it doesn't have an app core, it just has the service modules so you can deploy whichever services you want in your other instances.

- For example, let's say you have your local PC and a VPS, you host the core app in your local PC through the deploy\docker-compose.yml along with the "images" service. And in the VPS you host through the deploy\services\docker-compose.yml the "livekit" and "minIO" services. Now you have a multi-instance deployment that can be useful if for any reason you don't want the standalone all-in one deployment in your local PC or in any other server.
