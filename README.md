# help.vaccinateca.com


## Report bugs and feature requests using Github [Issues](https://github.com/CAVaccineInventory/help.vaccinate/issues)
We use GitHub Issues to track potential work. Please add to this list, whether you are proposing a new feature, reporting a bug, or even raising a subject requiring discussion by [opening a new issue](https://github.com/CAVaccineInventory/help.vaccinate/issues/new).

## How to begin local development


### Running the linter
The linter - [Prettier](https://prettier.io/) - runs on every PR automatically. If you'd like to run it locally, run `npm install` once to set up npm and then `npm run lint:fix` to run the linter. 

### Using Docker

You can run a local development version of the Netlify functions and static file serving using Docker. This development environment will write to our staging Airtable base, so it's safe to try out new things without worrying about writing to the production Airtable.

The staging Airtable base is at  https://airtable.com/tblyRimzws6YcAy3q

You can get access to the staging Airtable base with this URL which grants editor access to anyone who clicks it: https://airtable.com/invite/l?inviteId=invOOcpFrjSbJzfPR&inviteToken=4c051c1cbb39be88c580cf59950a4ff48f8f19030ae70d276d0c6c3daa4a885c  


Create a file called Makefile.local. It should contain only the line:

```
AIRTABLE_API_KEY=...your key here...
```
You can obtain an Airtable API key from https://airtable.com/account

To run an end-to-end stack using Docker, pointed at the staging Base:
```
make docker-run
```
