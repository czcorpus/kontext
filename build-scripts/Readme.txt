## How to debug using PyCharm and docker

Tested: on Windows

Follow https://www.jetbrains.com/help/pycharm/using-docker-compose-as-a-remote-interpreter.html but
instead of using the example `Dockerfile` and `docker-compose.yml` use `build-scripts/Dockerfile-debug` and `build-scripts/docker-compose.yml`.
Both files should be copied to the main directory.

The idea is simple, docker-compose.yml will start two containers, one containing redis 
and one in our container (called `master_kontext_1` on Windows) that has manatee pre-installed. 

Notes:
- assume path to kontext repository is KPATH (e.g., `c:\projects\kontext\`)
- in the Debug configuration, the Working directory should be set to $KPATH;
- Parameters should be: `--port=5000 --address=0.0.0.0`;
- compiled corpora should be in $KPATH/../test-corpora
- registry files should be in $KPATH/../test-corpora/registry (see `docker-compose.yml`)
- config.xml, celeryconfig.py, beatconfig.py must be changed from `localhost:6379` to `redis:6379`

## How to test locally on Ubuntu 16

```
cp build-scripts/Dockerfile-build-and-test Dockerfile
docker build -t kontext-build-and-test .
```

If you want to run `kontext` in the image execute
```
docker run -it kontext-build-and-test bash
redis-server conf/redis.conf &
pm2 start public/app.py --interpreter=python --name "kontext" -- --address 0.0.0.0 --port 5000
```
and e.g.,
```
INTEGRATIONTEST=true PORT=5000 ./build-scripts/test.sh
```