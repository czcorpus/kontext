#!/bin/sh

nohup bash -c "python3 worker/rqworker.py &"
gunicorn -c scripts/install/conf/docker/gunicorn-conf.py public.app:application
