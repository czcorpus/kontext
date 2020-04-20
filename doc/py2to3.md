# Moving KonText from Python 2.7 to Python 3.6+

Starting from commit tagged as [py3_initial_version](https://github.com/czcorpus/kontext/releases/tag/py3_initial_version) in the
master branch, KonText runs only within a Python 3 environment (versions 3.6 and higher are supported).

## How to upgrade

First of all, make sure you've downloaded a proper version of Manatee-open (e.g. `manatee-open-2.167.8` and newer)
along with proper [Python 3 API](https://corpora.fi.muni.cz/noske/deb/1804/manatee-open/manatee-open-python3_2.167.8-1ubuntu1_amd64.deb).
In case you compile Manatee open from sources, please select proper `PYTHON=/path/to/py3/binary` when running
`./configure`. You can test the installation e.g. by running `python3 -c "import manatee"`.

Depending on your operating system configuration, you may need to uninstall `Gunicorn` and `Celery` and install their
Python 3 versions to make sure the proper binaries are located in operating system's search path.

Then install other KonText dependencies using pip3: `pip3 install -r requirements.txt`. In case you prefer
system package manager, make sure you are using python3 versions of the packages.

Once you're done, just start your `Gunicorn` and `Celery` services again and everything should be running.

## Possible issues

Due to the way how Manatee-open Python API handles character encoding and how Python 2 and 3 differ in string representation
and processing, KonText has dropped support for non-UTF8 encoded corpora. The easiest way how to upgrade in case you
have such a corpus is to convert your source vertical and registry file and reindex the corpus using `encodevert` again.
