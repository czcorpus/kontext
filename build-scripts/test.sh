#!/bin/bash
set -e -o pipefail

if [[ "x$INTEGRATIONTEST" == "xtrue" ]]; then

    URL=http://localhost:${PORT}

    echo "============================================"
    echo "Testing ${URL}/corpora/corplist"
    curl -v ${URL} || echo "curl problem"
    curl -s ${URL}/corpora/corplist | grep -i ovm

    declare -a urls=(
    " "
    "corpora/ajax_get_corptree_data"
    )

    # not working properly in 0.9 (not according to standard)
    # curl -v http://localhost:5000/fcs/scan/?version=1.2&operation=explain

    for q in "${urls[@]}"
    do
        echo "============================================"
        echo "Testing ${URL}/${q}"
        curl -vs ${URL}/${q}
        echo
    done

    echo "============================================"
    # simple blackbox fcs test
    curl -vs "${URL}/fcs/v1?version=1.2&operation=searchRetrieve&query=klaus" | grep "fcs:DataView"
    curl -vs "${URL}/fcs/v1?version=1.2&operation=scan&scanClause=fcs.resource=root" | grep "sru:displayTerm"
    curl -vs "${URL}/fcs/v1?version=1.2&operation=explain" | grep "zr:title"


    # =========================================================================
    tail /opt/kontext/log/kontext.log || true

fi
