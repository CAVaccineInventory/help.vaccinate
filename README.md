# help.vaccinateca.com


## All changes happen through Pull Requests

Pull requests are the best way to propose changes to the codebase (we use [Github Flow](https://guides.github.com/introduction/flow/index.html)). To get started:

1. Clone the repo, if you haven't already, and create your branch from `main`.
2. Begin working on the new branch to make your change(s).
3. Push your branch to Github and create a Pull Request for it. Doing even while it's still a work-in-progress is useful, as it makes it easy for you to ask others for ongoing feedback or help.
4. When you have completed your changes, ask for reviews of your Pull Request. At least 1 approval is required before the Pull Request can be merged.

## Report bugs and feature requests using Github [Issues](https://github.com/CAVaccineInventory/help.vaccinate/issues)
We use GitHub Issues to track potential work. Please add to this list, whether you are proposing a new feature, reporting a bug, or even raising a subject requiring discussion by [opening a new issue](https://github.com/CAVaccineInventory/help.vaccinate/issues/new).

## How to begin local development


### Running the linter
The linter - [Prettier](https://prettier.io/) - runs on every PR automatically. If you'd like to run it locally, run `npm install` once to set up npm and then `npm run lint:fix` to run the linter. 

### Using Docker

Create a file called Makefile.local. It should contain only the line:

```
AIRTABLE_API_KEY=...your key here...
```

To run an end-to-end stack using Docker, pointed at the staging Base:
```
make docker-run
```
