#!/bin/bash

for f in `ls templates/*.tmpl`
do
    cheetah compile --odir cmpltmpl --idir templates $(basename $f)
done

