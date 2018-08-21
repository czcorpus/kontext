#!/bin/bash

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
if [[ ! -d ${KONTEXTDIR} ]]; then
    ln -sf ${FS} ${KONTEXTDIR}
fi

# =========
# data

minisep "Creating data dir structure"
mkdir -p /tmp/kontext-upload
mkdir -p ${KONTEXT_PREFIX}/pids/
mkdir -p ${DATADIR}/{subcorp,cache,registry}
mkdir -p ${DATADIR}/corpora/{conc,speech,vert}
mkdir -p ${CACHEDIR}/{freqs-precalc,freqs-cache,colls-cache}


# =========
# kontext configuration

minisep "Using test configs"
if [[ ! -f ${CONFIGDIR}/config.xml ]]; then
    cp ${THISDIR}/configs/test_config.xml ${CONFIGDIR}/config.xml
fi

if [[ ! -f ${CONFIGDIR}/redis.conf ]]; then
    cp ${THISDIR}/configs/redis.conf ${CONFIGDIR}/redis.conf
fi

if [[ ! -f ${CONFIGDIR}/syntax-viewer.json ]]; then
    cp ${THISDIR}/configs/syntax-viewer.json ${CONFIGDIR}/syntax-viewer.json
fi

# celery
cp $FS/conf/celeryconfig.sample.py ${CONFIGDIR}/celeryconfig.py
cp $FS/conf/beatconfig.sample.py ${CONFIGDIR}/beatconfig.py


# =========
# Test configuration
echo "Installing dependencies for validate_setup.py"
apt-get update -y -q &> /dev/null && apt install -y sudo || true
sudo apt-get update -y -q  &> /dev/null && \
    sudo apt-get install -y libxml2-utils python-lxml libxml2-dev libxslt1-dev python-dev git python-pip &> /dev/null
pip install -U lxml  &> /dev/null

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
    export TESTCORPORA=/opt/lindat/lindat-test-corpora
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
        cp $(readlink -e ${config}) ${MANATEE_REGISTRY_PATH}/$config
    done
    popd
fi

echo "Configdir contents"
ls -lah ${CONFIGDIR}