# help.vaccinateca.com (AKA: Scooby)

## What does Scooby do?

Scooby is the web frontend for phone banking and web banking. Scooby requests calls from VIAL, 
displays a script of questions callers use to ask sites about vaccines, and then submits the results back to VIAL.
[This document](apimapping.md) is a human readable mapping of script answers to VIAL details.

## Report bugs and feature requests using Github [Issues](https://github.com/CAVaccineInventory/help.vaccinate/issues)

We use GitHub Issues to track potential work. Please add to this list,
whether you are proposing a new feature, reporting a bug, or even
raising a subject requiring discussion by [opening a new
issue](https://github.com/CAVaccineInventory/help.vaccinate/issues/new).

## How to begin local development

### Running the linter

The linter - [Prettier](https://prettier.io/) - runs on every PR
automatically. If you'd like to run it locally, run `npm install` once
to set up npm and then `npm run lint:fix` to run the linter.

### Run locally

You can build and run the app locally via `./script/server`. Local
development works against staging VIAL, so it's safe to try out new
things without worrying about writing to production.

### Using Docker

Alternatively, you can run the app via docker, which ensures a clean
environment: `./script/docker-server`