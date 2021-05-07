#!/bin/sh

nohup bash -c "python3 -m debugpy --listen 0.0.0.0:5679 /opt/kontext/worker/rqworker.py &"
nohup bash -c "python3 public/app.py --address 0.0.0.0 --port 8080 --use-reloader --debugpy --debugmode &"
bash --login -c "npm start devel-server"