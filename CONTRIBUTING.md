# Contributing to KonText


## Workflow

* create a fork of the [repository](https://github.com/czcorpus/kontext)
* create you feature branch from the *master* branch
  * be sure to keep your repository in sync with upstream
* once your changes are ready, create a pull request

## Coding style


### Python code

* [PEP8 Style Guide](https://www.python.org/dev/peps/pep-0008/)
  * line length of *100* characters

### Client-side code in general

* except for unit/integration tests, everything should be written in TypeScript
* eny asynchronous code should be based on RxJS (i.e. no async/await, no Promise etc.)
* state management and binding to components is realized via [kombo](https://github.com/tomachalek/kombo) framework
* array and object manipulation is done via [cnc-tskit](https://github.com/czcorpus/cnc-tskit)
* locations:
  * most general types are stored in `public/files/js/types`
  * application models are located in `public/files/js/models`
  * *React* views are located in `public/files/js/views`
  * plugin-related code is in `public/files/js/plugins`


### TypeScript

* we roughly stick with the latest version of TS (currently, it's 4.4.x)
* we do not use `strictNullChecks` (yet) but we strongly encourage you to define types in a compatible way
* do not use *any* type (if necessary use `unknown`)


## Testing

### Integration tests

To run integration tests, Docker and Docker Compose must be installed

1) create required images

```
docker-compose -f docker-compose.yml -f docker-compose.cypress.yml  --env-file .env.mysql build
```

2) run the application

```
docker-compose -f docker-compose.yml -f docker-compose.cypress.yml  --env-file .env.mysql up
```

3) run Cypress

```
./node_modules/.bin/cypress open
```

4) Use Cypress GUI to run the tests


Once containers are installed and rut at least once, a clean-up should be performed before each testing:

```
docker-compose -f docker-compose.yml -f docker-compose.cypress.yml  down --volumes
```


## License

By contributing to KonText, you agree that your contributions will be licensed under its 
GNU General Public License version 2.