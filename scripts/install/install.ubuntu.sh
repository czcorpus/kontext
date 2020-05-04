#!/bin/bash
# ----------------------------------------
# Installation script for Ubuntu 18.04
# ----------------------------------------

WEBSERVER_USER="www-data"
MANATEE_VER=2.167.8
# run the install script from the installation root directory
INSTALL_DIR="$(dirname $(dirname $(readlink -f $(dirname "$0" ))))"
echo "Fullpath to the current KonText installation directory: $INSTALL_DIR"

# ---------------------
# set installation type
# ---------------------
INSTALL_TYPE="default"

# check installation type parameter
while [[ $# -gt 0 ]]
do
key="$1"

case ${key} in
    -t|--type)
    if [ $2 == 'ucnk' ]
    then
        INSTALL_TYPE='ucnk'
    fi
    echo Installation type ${INSTALL_TYPE}
    shift
    shift
    ;;
esac
done

# ------------------
# set up environment
# ------------------
cd /
# trap 'exit' ERR

# --------------------------------------
# Install prerequisites for Ubuntu 18.04
# --------------------------------------
apt-get update -y
locale-gen en_US.UTF-8

# install nodejs
apt-get install -y ca-certificates curl nodejs npm
npm install -g webpack

# install general & manatee prerequisites
apt-get install -y openssh-server net-tools nginx redis-server build-essential openssl libssl-dev pkg-config wget
apt-get install -y python python-dev python-pip python-lxml python-jinja2 python-simplejson
apt-get install -y libltdl7 libpcre3 libpcre++-dev libxml2-dev libxslt-dev libltdl-dev

pip install redis gunicorn celery

# install kontext requirements
pip install -r ${INSTALL_DIR}/requirements.txt

# -------------------------------------
# install & set up manatee etc.
# -------------------------------------
# python signal fd common for both scenarios
cd /usr/local/bin
wget https://corpora.fi.muni.cz/noske/deb/1604/python-signalfd/python-signalfd_0.1-1ubuntu1_amd64.deb
dpkg -i python-signalfd_0.1-1ubuntu1_amd64.deb

# Celery
useradd -r -s /bin/false celery
adduser celery ${WEBSERVER_USER}
mkdir /etc/conf.d
cp /opt/kontext/scripts/install/conf/celery-conf.d /etc/conf.d/celery
cp /opt/kontext/scripts/install/conf/celery.service /etc/systemd/system
cp /opt/kontext/scripts/install/conf/celery.tmpfiles /usr/lib/tmpfiles.d/celery.conf
mkdir /var/log/celery
chown celery:root /var/log/celery
mkdir /var/run/celery
chown celery:root /var/run/celery
systemctl enable celery
systemctl daemon-reload

# Nginx
cp /opt/kontext/scripts/install/conf/nginx /etc/nginx/sites-available/default


case ${INSTALL_TYPE} in
    ucnk)
        # build from sources, use ucnk manatee patch
        # Manatee
        cd /usr/local/src
        wget http://corpora.fi.muni.cz/noske/src/manatee-open/manatee-open-${MANATEE_VER}.tar.gz
        tar xzvf manatee-open-${MANATEE_VER}.tar.gz; cd manatee-open-${MANATEE_VER}
        cp ${INSTALL_DIR}/scripts/install/ucnk-manatee-${MANATEE_VER}.patch ./
        patch -p0 < ucnk-manatee-${MANATEE_VER}.patch
        ./configure --with-pcre; make
        make install; ldconfig

        # move manatee files in case of CentOS
        cd /usr/local/lib64/python2.7/site-packages/
        cp * /usr/lib/python2.7/site-packages/

        # Susanne corpus
        cd /usr/local/src
        wget https://corpora.fi.muni.cz/noske/src/example-corpora/susanne-example-source.tar.bz2
        tar xvjf susanne-example-source.tar.bz2

        # set up sample corpus
        mkdir -p /var/lib/manatee/registry
        mkdir -p /var/lib/manatee/vert
        mkdir -p /var/lib/manatee/data/susanne

        # create user filter files directory
        mkdir -p /var/local/corpora/user_filter_files

        # copy Susanne files from sample sources
        cd /usr/local/src/susanne-example-source
        sed -i 's%PATH susanne%PATH "/var/lib/manatee/data/susanne"%' ./config
        cp ./source /var/lib/manatee/vert/susanne.vert
        cp ./config /var/lib/manatee/registry/susanne

        # generate data
        encodevert -v -c ./config -p /var/lib/manatee/data/susanne  ./source
        ;;

    *)
        # default: install from binary packages
        cd /usr/local/bin
        wget https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open_${MANATEE_VER}-1ubuntu1_amd64.deb
        wget https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open-python_${MANATEE_VER}-1ubuntu1_amd64.deb
        wget https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open-susanne_${MANATEE_VER}-1ubuntu1_amd64.deb
        dpkg -i manatee-open_${MANATEE_VER}-1ubuntu1_amd64.deb
        dpkg -i manatee-open-python_${MANATEE_VER}-1ubuntu1_amd64.deb
        dpkg -i manatee-open-susanne_${MANATEE_VER}-1ubuntu1_amd64.deb
        ;;
esac

# --------------
# set up KonText
# --------------
# copy sample config files into working config files
cd ${INSTALL_DIR}/conf
cp config.default.xml config.xml
cp corplist.default.xml corplist.xml
cp beatconfig.sample.py beatconfig.py

# update config.xml with current install path
sed -i s%/opt/kontext%${INSTALL_DIR}% config.xml

# create directories, set permissions
cd /var/local
mkdir -p corpora
cd corpora
mkdir -p registry
mkdir -p cache
mkdir -p subcorp
mkdir -p freqs-precalc
mkdir -p freqs-cache
mkdir -p colls-cache
chown ${WEBSERVER_USER}:${WEBSERVER_USER} cache
chmod g+ws cache
chown ${WEBSERVER_USER}:${WEBSERVER_USER} subcorp
chmod g+ws subcorp
chown ${WEBSERVER_USER}:${WEBSERVER_USER} freqs-precalc
chmod g+ws freqs-precalc
chown ${WEBSERVER_USER}:${WEBSERVER_USER} freqs-cache
chmod g+ws freqs-cache
chown ${WEBSERVER_USER}:${WEBSERVER_USER} colls-cache
chmod g+ws colls-cache
chmod -R 775 subcorp

cd /var/log
mkdir -p kontext
chown ${WEBSERVER_USER}: kontext

cd /tmp
mkdir -p kontext-upload
chown ${WEBSERVER_USER}: kontext-upload
chmod -R 775 kontext-upload

# run config test
cd ${INSTALL_DIR}
python scripts/validate_setup.py conf/config.xml

# build kontext
npm install; make production

# set the anonymous user in Redis
redis-cli -n 1 set user:1 "{\"id\": 1, \"user\": \"public\", \"fullname\": \"public user\", \"pwd_hash\": \"\"}"

# generate random password for the "kontext" user and its hash using default parameters
cd ${INSTALL_DIR}
response=$(python scripts/generate_random_pwd.py)
pwd=${response%-*}
hash=${response:9}

# set the "kontext" user in redis
redis-cli -n 1 hset user_index "kontext" "\"user:2\""
redis-cli -n 1 set user:2 "{\"username\": \"kontext\", \"firstname\": \"Kontext\", \"lastname\": \"Test\", \"id\": 2, \"pwd_hash\": \"$hash\", \"email\": \"test@example.com\"}"
redis-cli -n 1 set corplist:user:1 "[\"susanne\"]"
redis-cli -n 1 set corplist:user:2 "[\"susanne\"]"

systemctl start celery
systemctl restart nginx

cd ${INSTALL_DIR}

# print final info
echo "KonText installation successfully completed."
echo "To start KonText, enter the following command in the KonText install root directory (i.e. $INSTALL_DIR):"
echo ""
echo "sudo -u $WEBSERVER_USER python public/app.py --address 127.0.0.1 --port 8080"
echo ""
echo "(--address and --port parameters are optional; default serving address is 127.0.0.1:5000)"
echo "-------------"
echo "To login as a test user, please use the following credentials:"
echo "username: kontext"
echo "password: $pwd"
