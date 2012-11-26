#!/bin/bash

for f in `ls templates/*.tmpl`
do
    cheetah compile --odir cmpltmpl --idir templates $(basename $f)
done

DEFAULT_YUICOMP_PATH=/usr/local/lib/YUI/yuicompressor.jar

if [ -z $1 ]; then
  read -p "Where is your yui compressor jar located? [$DEFAULT_YUICOMP_PATH]:" yuiloc
  if [ -z $yuiloc ]; then
    yuiloc=$DEFAULT_YUICOMP_PATH
  fi
else
  yuiloc=$1
fi

for f in `find . -name "*.js"`; do
  if echo $f | grep -Eqv '/[^/]+min[^/]+$'; then
    java -jar $yuiloc $f -o $f
    echo "Minified [$f]"
  else
    echo "Ignored  [$f]"
  fi
done

for f in `find . -name "*.css"`; do
  java -jar $yuiloc $f -o $f
  echo "Minified [$f]"
done