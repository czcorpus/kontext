#!/bin/bash

apt-get update -y
locale-gen en_US.UTF-8
apt-get install -y ca-certificates wget curl openssh-server net-tools redis-server build-essential openssl pkg-config libltdl7 libpcre3 swig nginx nodejs npm libicu-dev libpcre++-dev libxml2-dev libxslt-dev libltdl-dev libssl-dev
pip3 install simplejson celery signalfd -r requirements.txt