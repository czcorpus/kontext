#!/bin/bash

for f in `ls templates/*.tmpl`
do
    cheetah compile --odir cmpltmpl --idir templates $(basename $f)
done

DEFAULT_YUICOMP_PATH=/usr/local/lib/YUI/yuicompressor.jar
read -p "Where is your yui compressor jar located? [$DEFAULT_YUICOMP_PATH]:" yuiloc
if [ -z $yuiloc ]; then
  yuiloc=$DEFAULT_YUICOMP_PATH
fi

for f in `find . -name "*.js"`; do
  echo $f
  if echo $f | grep -Eqv '/[^/]+min[^/]+$'; then
    java -jar $yuiloc $f -o $f
  fi
done
