# common functions that should can be `source`d to other scripts
# 

sep() {
    echo "------------------------"
}

minisep() {
    if [[ "x$1" != "x" ]]; then
        echo
        echo "  ==================== $1 ======================="
    else
        echo "  ====                                       ===="
    fi
}

microsep() {
    if [[ "x$1" != "x" ]]; then
        echo
        echo "  --- $1"
    else
        echo "  ---"
    fi
}

install() {
    FILE=$1
    PACKAGE=$2
    URL=$3
    UNPACK=$4
    CONFIGUREPARAMS=$5

    minisep $PACKAGE

    if [ -f $FILE ]; then
       echo "File $FILE already exists - skipping."
    else
        wget --no-check-certificate  -nv $URL -O $FILE > /dev/null
    fi
    if [ ! -d $PACKAGE ]; then
        $UNPACK $FILE > /dev/null
        cd $PACKAGE
        echo "Installing from `pwd`"
        echo $CONFIGUREENV ./configure $CONFIGUREPARAMS
        bash -c "$CONFIGUREENV ./configure $CONFIGUREPARAMS"
        make -j2
        bash -c "$INSTALLENV make install"
    fi

    export CONFIGUREENV=
    export INSTALLENV=
}

url_exists_archive() {
    URL=$1
    FILE=$2
    
    set +e
    if ! curl --output /dev/null --silent --head --fail "$URL/$FILE"; then
        echo $URL/archive/$FILE
    else
        echo $URL/$FILE
    fi
    set -e
}