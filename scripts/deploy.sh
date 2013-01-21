#!/bin/bash
# Copyright (c) 2012 Czech National Corpus
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

for f in `ls templates/*.tmpl`
do
    cheetah compile --odir cmpltmpl --idir templates $(basename $f)
done

DEFAULT_YUICOMP_PATH=/usr/local/lib/YUI/yuicompressor.jar

read -p "Do you want to minify CSS and JS [N/y]? " action_id
case $action_id in
"Y"|"y")
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
;;
"N"|"n"|"")
    echo "Skipped JS and CSS minification"
;;
esac