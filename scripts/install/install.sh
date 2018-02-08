#!/bin/bash
# ----------------------------------------
# check if supported os distro and release
# ----------------------------------------

distro=""
# check if Ubuntu 16.04
file="/etc/lsb-release"
if [ -f "$file" ]
then
    distroDetail="Ubuntu 16.04"
    if grep -Fq "$distroDetail" $file
    then
        distro="Ubuntu"
        packageToolDir="apt"
    fi
else
    # check if CentOS 7.4
    file="/etc/centos-release"
    if [ -f "$file" ]
    then
        distroDetail="CentOS Linux release 7.4"
        if grep -Fq "$distroDetail" $file
        then
            distro="CentOS"
            packageToolDir="yum"
        fi
    fi
fi

# evaluate distro
if  ! [ $distro=='Ubuntu' -o $distro=='CentOS' ];
then
    echo "We are sorry, but the install script does not support your Linux distribution. Please install manually."
else
    echo "Your Linux distribution seems to be: $distroDetail"
fi

# ---------------------
# set version constants
# ---------------------
FINLIB_VER=2.36.5
MANATEE_VER=2.151.5

# -------------------------
# set install path constant
# -------------------------
# run the install script from the installation root directory
INSTALL_DIR="$(dirname $(dirname $(readlink -f $(dirname "$0" ))))"
echo Fullpath to the current KonText installation directory: $INSTALL_DIR

# ---------------------
# set installation type
# ---------------------
INSTALL_TYPE="default"

# check installation type parameter
while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    -t|--type)
    if [ $2 == 'ucnk' ]
    then
        INSTALL_TYPE='ucnk'    
    fi
    echo Installation type $INSTALL_TYPE
    shift
    shift
    ;;
esac
done

# ------------------
# set up environment
# ------------------
cd /
trap 'exit' ERR

if [ $distro=='Ubuntu' ]
then
    # sudo apt-get update -y

    sudo locale-gen en_US.UTF-8

    # install nodejs
    sudo apt-get install -y ca-certificates curl
    curl https://deb.nodesource.com/setup_6.x | sudo -E bash
    sudo apt-get install -y nodejs
    npm install -g webpack

    # install general & manatee prerequisites
    sudo apt-get install -y openssh-server net-tools nginx redis-server build-essential openssl libssl-dev pkg-config wget
    sudo apt-get install -y python python-dev python-pip python-lxml python-cheetah python-simplejson 
    sudo apt-get install -y libltdl7 libpcre3 libpcre++-dev libxml2-dev libxslt-dev libltdl-dev

    sudo pip install --upgrade pip
    sudo pip install redis gunicorn celery

    # install kontext requirements
    sudo pip install -r $INSTALL_DIR/requirements.txt

# -------------------------------------
# install & set up finlib, manatee etc.
# -------------------------------------
# python signal fd common for both scenarios
    cd /var/cache/$packageToolDir
    wget https://corpora.fi.muni.cz/noske/deb/1604/python-signalfd/python-signalfd_0.1-1ubuntu1_amd64.deb
    sudo dpkg -i python-signalfd_0.1-1ubuntu1_amd64.deb
else 
    localedef -c -f UTF-8 -i en_US en_US.UTF-8
    export LANG="en_US.UTF-8"
    export LC_ALL=en_US.UTF-8

    # nodejs etc.
    yum check-update

    yum install -y curl sudo which ca-certificates
    curl https://rpm.nodesource.com/setup_6.x | sudo -E bash -
    sudo yum install -y nodejs
    sudo yum install -y gcc-c++ make 
    # create symlink for nodejs, will need it along with node for KonText install
    sudo ln -s "$(which node)" /usr/bin/nodejs
    npm install -g webpack

    sudo yum install -y epel-release
    sudo yum install -y openssh-server net-tools nginx openssl wget openssl-devel redis pkgconfig pcre httpd m4 parallel patch bzip2
    sudo yum install -y python python-devel python-pip python-lxml python-cheetah python-simplejson 
    sudo yum install -y libxml2 libxslt-devel libxml2-devel libxslt libicu-devel libtool-ltdl libtool-ltdl-devel

    sudo pip install --upgrade pip
    sudo pip install redis gunicorn celery


    # install kontext requirements
    # shows uninstall message for Markdown 2.4.1
    sudo pip install -r $INSTALL_DIR/requirements.txt

    # -------------------------------------
    # install & set up finlib, manatee etc.
    # -------------------------------------
    # python signal fd common for both scenarios
    cd /var/cache/yum
    wget https://corpora.fi.muni.cz/noske/rpm/centos7/python-signalfd/python-signalfd-0.1-5.el7.centos.x86_64.rpm
    sudo rpm -ivh python-signalfd-0.1-5.el7.centos.x86_64.rpm
fi

case $INSTALL_TYPE in 
    ucnk)
        # build from sources, use ucnk manatee patch
        # Finlib
        cd /var/cache/$packageToolDir
        wget http://corpora.fi.muni.cz/noske/src/finlib/finlib-$FINLIB_VER.tar.gz
        tar xzvf finlib-$FINLIB_VER.tar.gz
        cd finlib-$FINLIB_VER
        ./configure --with-pcre; make
        sudo make install; ldconfig

        # Manatee
        cd /var/cache/$packageToolDir
        wget http://corpora.fi.muni.cz/noske/src/manatee-open/manatee-open-$MANATEE_VER.tar.gz
        tar xzvf manatee-open-$MANATEE_VER.tar.gz; cd manatee-open-$MANATEE_VER
        cp $INSTALL_DIR/scripts/install/ucnk-manatee-$MANATEE_VER.patch ./
        patch -p0 < ucnk-manatee-$MANATEE_VER.patch
        ./configure --with-pcre; make
        sudo make install; ldconfig

        # Susanne corpus
        cd /var/cache/$packageToolDir
        wget https://corpora.fi.muni.cz/noske/src/example-corpora/susanne-example-source.tar.bz2
        tar xvjf susanne-example-source.tar.bz2

        # set up sample corpus
        mkdir -p /var/lib/manatee/registry
        mkdir -p /var/lib/manatee/vert
        mkdir -p /var/lib/manatee/data/susanne

        # copy Susanne files from sample sources
        cd /var/cache/$packageToolDir/susanne-example-source
        sed -i 's%PATH susanne%PATH "/var/lib/manatee/data/susanne"%' ./config
        cp ./source /var/lib/manatee/vert/susanne.vert
        cp ./config /var/lib/manatee/registry/susanne

        # generate data
        encodevert -v -c ./config -p /var/lib/manatee/data/susanne  ./source
        ;;

    *)
        # default: install from binary packages 
        cd /var/cache/$packageToolDir
        if [ $distro == 'Ubuntu' ]
        then 
            wget https://corpora.fi.muni.cz/noske/deb/1604/finlib/finlib_$FINLIB_VER-1_amd64.deb
            wget https://corpora.fi.muni.cz/noske/deb/1604/manatee-open/manatee-open_$MANATEE_VER-1ubuntu1_amd64.deb
            wget https://corpora.fi.muni.cz/noske/deb/1604/manatee-open/manatee-open-python_$MANATEE_VER-1ubuntu1_amd64.deb    
            wget https://corpora.fi.muni.cz/noske/deb/1604/manatee-open/manatee-open-susanne_$MANATEE_VER-1ubuntu1_amd64.deb
            sudo dpkg -i finlib_$FINLIB_VER-1_amd64.deb
            sudo dpkg -i manatee-open_$MANATEE_VER-1ubuntu1_amd64.deb
            sudo dpkg -i manatee-open-python_$MANATEE_VER-1ubuntu1_amd64.deb
            sudo dpkg -i manatee-open-susanne_$MANATEE_VER-1ubuntu1_amd64.deb  
        else
            wget https://corpora.fi.muni.cz/noske/rpm/centos7/finlib/finlib-$FINLIB_VER-1.el7.centos.x86_64.rpm
            wget https://corpora.fi.muni.cz/noske/rpm/centos7/manatee-open/manatee-open-$MANATEE_VER-1.el7.centos.x86_64.rpm
            wget https://corpora.fi.muni.cz/noske/rpm/centos7/manatee-open/manatee-open-python-$MANATEE_VER-1.el7.centos.x86_64.rpm
            wget https://corpora.fi.muni.cz/noske/rpm/centos7/manatee-open/manatee-open-susanne-$MANATEE_VER-1.el7.centos.noarch.rpm
            sudo rpm -ivh finlib-$FINLIB_VER-1.el7.centos.x86_64.rpm 
            sudo rpm -ivh manatee-open-$MANATEE_VER-1.el7.centos.x86_64.rpm 
            sudo rpm -ivh manatee-open-python-$MANATEE_VER-1.el7.centos.x86_64.rpm
            sudo rpm -ivh manatee-open-susanne-$MANATEE_VER-1.el7.centos.noarch.rpm
        fi        
        ;;

esac

# --------------
# set up KonText
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

# in centos, redis must be started manually
if [ $distro == 'CentOS' ]
then
    sudo systemctl start redis
    sudo systemctl enable redis
fi

echo "KonText installation successfully completed."
echo "To start KonText, enter the following command in the KonText install root directory (i.e. $INSTALL_DIR):"
echo "python public/app.py --address [IP address] --port [TCP port]"
echo "(--address and --port parameters are optional; default serving address is 127.0.0.1:5000)"