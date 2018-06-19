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