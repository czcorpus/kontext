#!/bin/bash

# ----------------------------------
# set installation & deployment path
# ----------------------------------

installDir="$( readlink -f "$( dirname "$0" )" )"
echo Fullpath to the current KonText installation directory: $installDir

# ------------------
# set up environment
# ------------------

sudo apt-get update -y
sudo apt-get upgrade -y

# add kontext user, set locale
# sudo adduser kontext
# sudo usermod -a -G sudo kontext
sudo locale-gen en_US.UTF-8

# install general & manatee prerequisites
sudo apt-get install -y openssh-server net-tools nginx redis-server build-essential openssl ca-certificates libssl-dev pkg-config curl
sudo apt-get install -y python python-dev python-pip python-lxml python-cheetah python-simplejson 
sudo apt-get install -y libltdl7 libpcre3 libpcre++-dev libxml2-dev libxslt-dev

sudo pip install --upgrade pip
sudo pip install redis gunicorn celery

# install nodejs etc.
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash
sudo apt-get install -y nodejs
npm install -g webpack

# install kontext requirements
sudo pip install -r requirements.txt

# install finlib, manatee etc.
cd /var/cache/apt
wget https://corpora.fi.muni.cz/noske/deb/1604/finlib/finlib_2.36.5-1_amd64.deb
wget https://corpora.fi.muni.cz/noske/deb/1604/manatee-open/manatee-open_2.151.5-1ubuntu1_amd64.deb
wget https://corpora.fi.muni.cz/noske/deb/1604/manatee-open/manatee-open-python_2.151.5-1ubuntu1_amd64.deb
wget https://corpora.fi.muni.cz/noske/deb/1604/python-signalfd/python-signalfd_0.1-1ubuntu1_amd64.deb
wget https://corpora.fi.muni.cz/noske/deb/1604/manatee-open/manatee-open-susanne_2.151.5-1ubuntu1_amd64.deb


sudo dpkg -i python-signalfd_0.1-1ubuntu1_amd64.deb
sudo dpkg -i finlib_2.36.5-1_amd64.deb
sudo dpkg -i manatee-open_2.151.5-1ubuntu1_amd64.deb
sudo dpkg -i manatee-open-python_2.151.5-1ubuntu1_amd64.deb
sudo dpkg -i manatee-open-susanne_2.151.5-1ubuntu1_amd64.deb

# --------------
# set up kontext
# --------------

# copy sample config files into working config files

cd $installDir/conf
cp config.default.xml config.xml
cp corplist.default.xml corplist.xml
cp beatconfig.sample.py beatconfig.py
cp celeryconfig.sample.py celeryconfig.py

# update config.xml with current install path
sed -i s%/opt/kontext%$installDir% config.xml

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
cd $installDir
python scripts/validate_setup.py conf/config.xml

# build kontext
npm install; make production

echo Fullpath to the current KonText installation directory: $installDir
echo Please specify the full path to the required deployment directory:
read deployDir

mkdir -p $deployDir
cp -r {cmpltmpl,conf,lib,locale,package.json,public,scripts,worker.py} $deployDir
cd $deployDir
python public/app.py


