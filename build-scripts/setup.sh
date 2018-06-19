#!/bin/bash
set -e -o pipefail

THISDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Working in `pwd`"
source ${THISDIR}/functions.sh

if [[ "x$REPO_NAME" == "x" ]]; then
    REPO_NAME=kontext
fi

THISSCRIPT=`basename "$0"`
minisep "$THISSCRIPT ($REPO_NAME)" 
start=`date +%s`

# =========
# env

if [[ "x$MANATEE_FROM_PACKAGES" == "x" ]]; then
    MANATEE_FROM_PACKAGES=true
fi
if [[ "x$MANATEE_OS_VERSION" == "x" ]]; then
    MANATEE_OS_VERSION=1604
fi

export FS=${THISDIR}/..

# allow multiple instances
if [[ "x$KONTEXT_PREFIX" == "x" ]]; then
    export KONTEXT_PREFIX=/opt/kontext
fi

export DEPSDIR=${KONTEXT_PREFIX}/bits
export DATADIR=${KONTEXT_PREFIX}/data
export CACHEDIR=${KONTEXT_PREFIX}/cache

# allow having source code somewhere else
if [[ "x$KONTEXTDIR" == "x" ]]; then
    export KONTEXTDIR=${KONTEXT_PREFIX}/installation
fi

export CONFIGDIR=${KONTEXTDIR}/conf

export DEPS_PREFIX=${KONTEXT_PREFIX}
export DEPSLIBDIR=${DEPS_PREFIX}/lib
export DEPSINCLUDEDIR=${DEPS_PREFIX}/include

if [[ "x$PORT" == "x" ]]; then
    export PORT=5000
fi

mkdir -p ${DEPSDIR}
sudo chown -R ${USER}:${USER} ${KONTEXT_PREFIX} || echo "Invalid user/group - check ${KONTEXT_PREFIX} permissions"
if [[ ! -d ${KONTEXTDIR} ]]; then
    ln -sf ${FS} ${KONTEXTDIR}
fi

# =========
# prereq

if [[ -f ${FS}/apt-requirements.txt ]]; then
    minisep "apt-ing"
    sudo apt-get -qq update > /dev/null
    minisep "apt-ing $FS/apt-requirements.txt"
    sudo xargs apt-get -q install -y < ${FS}/apt-requirements.txt
fi

if [[ -f ${FS}/requirements.txt ]]; then
    minisep "pip-ing"
    pip install -U --ignore-installed -r ${FS}/requirements.txt || echo "problematic pip"
fi

minisep "node"
NODE_VER=`node --version || true`
if [[ "x$NODE_VER" == "x" ]]; then
    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash - > /dev/null
    sudo apt-get install -y nodejs
fi
echo ${NODE_VER}
which node || true
which npm || true

NODEBIN=`which node`
NODEJSBIN="/usr/bin/nodejs"
if [[ ! -f $NODEJSBIN ]]; then 
    sudo ln -s $NODEBIN $NODEJSBIN
fi


minisep "redis"
REDIS_TEST_INSTANCE=false
REDIS_VER=`redis-server --version || true`
if [[ "x$REDIS_VER" == "x" ]]; then
    echo "You have to install (and secure) redis!"
    
    # TOO OLD - use raw installation
    # sudo apt-get install -y redis-server
    
    cd ${DEPSDIR}
    curl -O http://download.redis.io/redis-stable.tar.gz
    tar xzvf redis-stable.tar.gz
    cd redis-stable
    make
    sudo make install
    REDIS_TEST_INSTANCE=true
fi
echo ${REDIS_VER}


# =========
# manatee

cd ${DEPSDIR}
if [[ "x$MANATEE_FROM_PACKAGES" == "xtrue" ]]; then
    minisep "Installing manatee and dependencies"
    if [[ ! -d corpora.fi.muni.cz ]]; then
        URL=https://corpora.fi.muni.cz/noske/deb/${MANATEE_OS_VERSION}
        for i in finlib manatee-open; do
            wget -r --accept "*.deb" --level 1 ${URL}/${i} || echo "$i not present"
        done
        for p in libantlr3c_ finlib_ manatee-open_ manatee-open-python_; do
            find corpora.fi.muni.cz/ -name "*$p*.deb" -exec bash -c 'echo "installing $0" && (sudo dpkg -i $0 || echo "install failed softly")' {} \;
        done
    else
        echo "Already present"
    fi

else
    VER=3.4
    PACKAGE=libantlr3c-${VER}
    if [[ ! -d ${DEPSDIR}/antlr/${PACKAGE} ]]; then
        minisep "Installing antlr"
        mkdir -p ${DEPSDIR}/antlr && cd ${DEPSDIR}/antlr
        FILE=${PACKAGE}.tar.gz
        URL=http://www.antlr3.org/download/C/${FILE}
        install ${FILE} ${PACKAGE} ${URL} "tar xzf" "--enable-64bit --disable-abiflags --prefix=$DEPS_PREFIX"
        sudo ldconfig
    fi

    VER=2.35.2
    PACKAGE=finlib-${VER}
    if [[ ! -d ${DEPSDIR}/finlib/${PACKAGE} ]]; then
        minisep "Installing finlib"
        mkdir -p ${DEPSDIR}/finlib && cd ${DEPSDIR}/finlib
        FILE=${PACKAGE}.tar.gz
        URL=$(url_exists_archive https://corpora.fi.muni.cz/noske/src/finlib ${FILE})
        install ${FILE} ${PACKAGE} ${URL} "tar xzf" "--with-pcre --prefix=$DEPS_PREFIX"
        FINLIBPATH=${DEPSDIR}/finlib/${PACKAGE}
        sudo ldconfig
    fi

    VER=2.139.3
    PACKAGE=manatee-open-${VER}
    if [[ ! -d ${DEPSDIR}/manatee-open/${PACKAGE} ]]; then
        minisep "Installing manatee"
        mkdir -p ${DEPSDIR}/manatee-open && cd ${DEPSDIR}/manatee-open
        # package finlib will be used
        CONFIGUREENV="CPPFLAGS=\"-I$DEPSINCLUDEDIR\" LDFLAGS=\"-L$DEPSLIBDIR\""
        INSTALLENV="DESTDIR=\"/\""
        FILE=${PACKAGE}.tar.gz
        URL=$(url_exists_archive https://corpora.fi.muni.cz/noske/src/manatee-open ${FILE})
        install ${FILE} ${PACKAGE} ${URL} "tar xzf" "--with-pcre  --prefix=$DEPS_PREFIX --with-finlib=$FINLIBPATH"
        sudo ldconfig
    fi

fi

minisep "Testing python manatee import - if it fails (and you need it), please update PYTHONPATH"
python -c "import manatee; dir(manatee); print; print manatee.version()" || true
python -c "import _manatee; dir(_manatee); print; print _manatee.version()" || true
sep


# =========
# data

minisep "Creating data dir structure"
sudo mkdir -p /tmp/kontext-upload
mkdir -p ${KONTEXT_PREFIX}/pids/
mkdir -p ${DATADIR}/{subcorp,cache,registry}
mkdir -p ${DATADIR}/corpora/{conc,speech,vert}
mkdir -p ${CACHEDIR}/{freqs-precalc,freqs-cache,colls-cache}


# =========
# kontext configuration

minisep "Using test configs"
if [[ ! -f ${CONFIGDIR}/config.xml ]]; then
    ln -sf ${THISDIR}/configs/test_config.xml ${CONFIGDIR}/config.xml
fi

if [[ ! -f ${CONFIGDIR}/redis.conf ]]; then
    ln -sf ${THISDIR}/configs/redis.conf ${CONFIGDIR}/redis.conf
fi

if [[ ! -f ${CONFIGDIR}/syntax-viewer.json ]]; then
    ln -sf ${THISDIR}/configs/syntax-viewer.json ${CONFIGDIR}/syntax-viewer.json
fi

# celery - first, install it
minisep "Using task queue celery for specific async. processing"
sudo pip install Celery
cp $FS/conf/celeryconfig.sample.py $FS/conf/celeryconfig.py
cp $FS/conf/beatconfig.sample.py $FS/conf/beatconfig.py


minisep "Using beat provided sample configs"
#cp $FS/conf/beatconfig.sample.py $FS/conf/beatconfig.py


if [[ ! -d ${KONTEXTDIR} ]]; then
    ln -s ${FS} ${KONTEXTDIR}
fi


# =========
# Test configuration
cd $FS
python scripts/validate_setup.py conf/config.xml

# =========
# configuration from config.xml

MANATEE_REGISTRY_PATH=`xmllint --xpath '//manatee_registry/text()' ${CONFIGDIR}/config.xml`
CORPARCH_FILE_PATH=`xmllint --xpath '//corparch/file/text()' ${CONFIGDIR}/config.xml`
LOG_PATH=`xmllint --xpath '//logging/path/text()' ${CONFIGDIR}/config.xml`

sep
echo "Using MANATEE_REGISTRY_PATH: ${MANATEE_REGISTRY_PATH}"
echo "Using CORPARCH_FILE_PATH:    ${CORPARCH_FILE_PATH}"
echo "Using LOG_PATH:              ${LOG_PATH}"
sep


# =========
# example data

if [[ "x$TESTCORPORA" == "x" ]]; then
    TESTCORPORA=/opt/lindat/lindat-test-corpora
fi

if [[ ! -d ${TESTCORPORA} ]]; then
    minisep "Fetching test corpora"
    mkdir -p $TESTCORPORA/..
    pushd $TESTCORPORA/..
    git clone https://github.com/ufal/lindat-test-corpora
    cd $TESTCORPORA
    # copy corplist
    cp ./corplist.xml ${CORPARCH_FILE_PATH}
    # copy registry files
    cd registry
    for config in `ls`; do
        ln -s $(readlink -e ${config}) ${MANATEE_REGISTRY_PATH}/$config
    done
    popd
fi

# =========
# kontext compilation

minisep "Compiling kontext"
cd ${KONTEXTDIR}
npm install
make production


# =========
# kontext start and pm2 process manager

mkdir -p ${KONTEXT_PREFIX}/log/

npm install -g pm2
export PM2_HOME=/opt/pm2

# =========
# databases first
minisep "Running redis"
if [[ "x$REDIS_TEST_INSTANCE" == "xtrue" ]]; then
    sep
    echo "Installing default redis server with an example configuration..."
    echo "SECURE IT!!!"
    sep
    #nohup redis-server ${CONFIGDIR}/redis.conf &
    pm2 start redis-server --interpreter=none --name "kontext-redis" -- ${CONFIGDIR}/redis.conf
fi

minisep "Starting kontext using pm2"
pm2 start public/app.py --interpreter=python --name "kontext" -- --address 0.0.0.0 --port ${PORT}

sleep 5
pm2 l
pm2 logs --lines 20 --nostream
tail -100 ${LOG_PATH}


# =========

sudo chown -R ${USER}:${USER} ${DEPS_PREFIX} || echo "Invalid user/group - check ${DEPS_PREFIX} permissions"


sep
end=`date +%s`
echo "Script $THISSCRIPT ($REPO_NAME) took $((end-start)) seconds"
sep
