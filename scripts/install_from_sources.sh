#!/bin/bash

# ---------------------
# set version constants
# ---------------------
FINLIB_VER=2.36.5
MANATEE_VER=2.151.5

# -------------------------
# set install path constant
# -------------------------
# run the install script from the installation root directory
INSTALL_DIR="$( readlink -f "$( dirname "$0" )" )"
echo Fullpath to the current KonText installation directory: $INSTALL_DIR

# ------------------
# set up environment
# ------------------

sudo apt-get update -y
sudo apt-get upgrade -y

sudo locale-gen en_US.UTF-8

# install general & manatee prerequisites
sudo apt-get install -y openssh-server net-tools nginx redis-server build-essential openssl ca-certificates libssl-dev pkg-config curl
sudo apt-get install -y python python-dev python-pip python-lxml python-cheetah python-simplejson 
sudo apt-get install -y libltdl7 libpcre3 libpcre++-dev libxml2-dev libxslt-dev libltdl-dev

sudo pip install --upgrade pip
sudo pip install redis gunicorn celery

# install nodejs etc.
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash
sudo apt-get install -y nodejs
npm install -g webpack

# install kontext requirements
sudo pip install -r $INSTALL_DIR/requirements.txt

# ----------------------------
# install finlib, manatee etc.
# ----------------------------
# build Finlib from sources
cd /var/cache/apt
wget http://corpora.fi.muni.cz/noske/src/finlib/finlib-$FINLIB_VER.tar.gz
tar xzvf finlib-$FINLIB_VER.tar.gz
cd finlib-$FINLIB_VER
./configure --with-pcre; make
sudo make install; ldconfig

# build Manatee from sources
cd /var/cache/apt
wget http://corpora.fi.muni.cz/noske/src/manatee-open/manatee-open-$MANATEE_VER.tar.gz
tar xzvf manatee-open-$MANATEE_VER.tar.gz; cd manatee-open-$MANATEE_VER
./configure --with-pcre; make
sudo make install; ldconfig

# get Susanne corpus from tar.bz
cd /var/cache/apt
wget https://corpora.fi.muni.cz/noske/src/example-corpora/susanne-example-source.tar.bz2
tar xvjf susanne-example-source.tar.bz2

# get python signal fd
wget https://corpora.fi.muni.cz/noske/deb/1604/python-signalfd/python-signalfd_0.1-1ubuntu1_amd64.deb
sudo dpkg -i python-signalfd_0.1-1ubuntu1_amd64.deb

# --------------------
# set up sample corpus
# --------------------
# create necessary dirs for manatee
mkdir -p /var/lib/manatee/registry
mkdir -p /var/lib/manatee/vert
mkdir -p /var/lib/manatee/data/susanne

# copy Susanne files from sample sources
cd /var/cache/apt/susanne-example-source
sed -i 's%PATH susanne%PATH "/var/lib/manatee/data/susanne"%' ./config
cp ./source /var/lib/manatee/vert/susanne.vert
cp ./config /var/lib/manatee/registry/susanne

# generate data
encodevert -v -c ./config -p /var/lib/manatee/data/susanne  ./source


# --------------
# set up Kontext
# --------------
# copy sample config files into working config files
cd $INSTALL_DIR/conf
cp config.default.xml config.xml
cp corplist.default.xml corplist.xml
cp beatconfig.sample.py beatconfig.py
cp celeryconfig.sample.py celeryconfig.py

# update config.xml with current install path
sed -i s%/opt/kontext%$INSTALL_DIR% config.xml

# create directories, set permissions
cd /var/local
mkdir corpora
cd corpora
mkdir registry
mkdir subcorp
mkdir freqs-precalc
mkdir freqs-cache
mkdir colls-cache
chown www-data:www-data subcorp
chown www-data:www-data freqs-precalc
chown www-data:www-data freqs-cache
chown www-data:www-data colls-cache
chmod -R 775 subcorp

cd /var/log
mkdir kontext
chown www-data: kontext

cd /tmp
mkdir kontext-upload
chown www-data: kontext-upload
chmod -R 775 kontext-upload

# run config test
cd $INSTALL_DIR
python scripts/validate_setup.py conf/config.xml

# build kontext
npm install; make production

echo Fullpath to the current KonText installation directory: $INSTALL_DIR
echo Please specify the full path to the required deployment directory:
read deployDir

mkdir -p $deployDir
cp -r {cmpltmpl,conf,lib,locale,package.json,public,scripts,worker.py} $deployDir

echo Kontext installation successfully completed
echo You can now change to the deployment directory: $deployDir
echo And enter the following command to start KonText:
echo python public/app.py --address [IP address] --port [TCP port]
echo "(--address and --port parameters are optional; default serving address is 127.0.0.1:5000)"