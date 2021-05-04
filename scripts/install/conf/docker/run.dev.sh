#!/bin/sh

nohup bash -c "python3 /opt/kontext/worker/rqworker.py &"
nohup bash -c "python3 public/app.py --address 0.0.0.0 --port 8080 &"
bash --login -c "npm start devel-server"