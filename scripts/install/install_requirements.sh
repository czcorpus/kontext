#!/bin/bash

apt-get update -y
locale-gen en_US.UTF-8
apt-get install -y ca-certificates curl nodejs npm openssh-server net-tools nginx redis-server build-essential openssl libssl-dev pkg-config wget libltdl7 libpcre3 swig libpcre++-dev libxml2-dev libxslt-dev libltdl-dev
pip3 install simplejson gunicorn celery signalfd -r requirements.txt