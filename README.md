![KonText screenshot](https://github.com/czcorpus/kontext/blob/master/doc/images/kontext-screenshot1.jpg)

[![Build status](https://travis-ci.org/czcorpus/kontext.svg?branch=master)](https://travis-ci.org/czcorpus/kontext)

## Important note

Please note that due to [Python 2 EOL](https://www.python.org/doc/sunset-python-2/), KonText **version 0.13.x is the last one running in Python 2**. It means that the **next release** (planned for Q1 2020) **will run only in Python 3**. For the `master` branch users - the last commit supporting Python 2 is tagged [py2_last_version](https://github.com/czcorpus/kontext/releases/tag/py2_last_version) and the first one supporting Python 3 is tagged  [py3_initial_version](https://github.com/czcorpus/kontext/releases/tag/py3_initial_version). The upgrade won't require any data/configuration change in KonText.  Please refer to [doc/py2to3.md](doc/py2to3.md) file for details.

## Contents

* [Introduction](#introduction)
* [Features](#features)
* [Requirements](#requirements)
* [Build and installation](#build-and-installation)
* [Customization and contribution](#customization-and-contribution)
* [Notable users](#notable-users)

## Introduction

KonText is an **advanced corpus query interface** and corpus data integration middleware built around corpus search engine [Manatee-open](http://nlp.fi.muni.cz/trac/noske). The development is maintained by the [Institute of the Czech National Corpus](http://ucnk.ff.cuni.cz/).

## Features

### notable end-user features

* fully **editable query chain**
    * any operation from a user defined sequence (e.g. query -&gt; filter -&gt; sample -&gt; sorting) can be changed
    and the whole sequence is then re-executed.
* **advanced CQL editor** with **syntax highlighting** and **attribute recognition**
* support for **spoken corpora**
    * defined concordance segments can be played back as audio
    * KWIC detail provides a custom rendering with **easily distinguishable speeches**
* support for **user-defined line groups**
    * user can define custom numeric tags attached to concordance lines, filter out other lines, review groups ratios
* **improved subcorpus creation**
    * user can easily examine corpus structure by selecting some text types and see how other text type attributes
      availability changed ("which publishers are there in case only *fiction* is selected?")
    * a **custom text types ratio** can be defined ("give me 20% fiction and 80% journalism")
    * a sub-corpus can be created by a custom CQL expression
    * a sub-corpus can be published so other users can access it
    * subcorpora are backed up as CQL queries which makes further modification/restoring possible
* **frequency distribution**
    * **2-dimensional frequency distribution** for both positional and structural attributes
    * result caching decreases time required to navigate between pages
    * on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
* **persistent URL for any query** - you can send a link to someone even if the query string was megabytes long
* access to **previous queries**, named queries
* **access to favorite corpora** (subcorpora, aligned corpora)
* **interactive PoS tag tool** - in case of positional PoS tag formats an interactive tool can be used to write tag queries
* a concordance/frequency/collocation listing can be **saved in Excel format** (xlsx)
* concordance tokens and KWICs can be connected to external data services (e.g. dictionaries, encyclopedias)
* a correct (i.e. the one calculating only with selected text types) i.p.m. can be calculated on-demand for ad-hoc subcorpora
* integrability with external data resources (e.g. dictionaries, media libraries)


### internal features

* server-side written as a **WSGI application**
* modern client-side application (event stream architecture, React components, extensible, written in TypeScript)
* modular code design with dynamically loadable plug-ins providing custom functionality implementation (e.g. custom database
adapters, authentication method, corpus listing widgets, HTTP session management)
* fully **decoupled background concordance/frequency/collocation calculation** based on the
[Celery task queue](http://www.celeryproject.org/)  (alternatively, Python's *multiprocessing* package can be used)
* improved logging, error processing and debugging support
* improved code documentation


## Requirements

* Rerverse proxy server
  + [Nginx](http://nginx.org/) (recommended), [Apache](http://httpd.apache.org/) (tested)
* Python *3.6* (or newer) and:
    * WSGI-compatible server
      * [Gunicorn](http://gunicorn.org/) (recommended)
      * or [uWsgi](https://uwsgi-docs.readthedocs.io/en/latest/) (tested)
    * [Werkzeug](http://werkzeug.pocoo.org/) web application library
    * [Jinja2](https://jinja.palletsprojects.com/en/2.10.x/) template engine
    * [lxml](http://lxml.de/) library
    * [PyICU](https://pypi.python.org/pypi/PyICU) library (optional but preferred)
    * [markdown](https://pypi.python.org/pypi/Markdown) library (optional, for formatted corpora references)
    * [openpyxl](https://pythonhosted.org/openpyxl/) library (optional, for XLSX export)
* corpus search engine [Manatee](http://nlp.fi.muni.cz/trac/noske)
    * versions from *2.83.3* to *2.158.8* are supported (the latest one is highly recommended); unless there is an incompatible change in Manatee, newer versions should work too
* a key-value storage
    * any custom implementation ([Redis](http://redis.io/) and [SQLite](https://sqlite.org/) backends are available by default)
* (optional) [Celery task queue](http://www.celeryproject.org/) task queue for (asynchronous) background calculations and maintenance tasks

Note: KonText versions up to 0.13.x (incl.) run on Python 2. To use Python 3, 0.15.x and newer versions of KonText must be used.


## Build and installation

KonText provides a [script](scripts/install/install.py) for automatic installation
to an existing Ubuntu system. The easiest way to install KonText is to create an LXC/LXD container, clone
the repository there and run the script. On a decently fast network, the whole process takes only a couple
of seconds. Please refer to the [doc/INSTALL.md](doc/INSTALL.md) file for details.


## Customization and contribution

Please refer to our [Wiki](https://github.com/czcorpus/kontext/wiki/Development-and-customization).

## Notable users

* [Institute of the Czech National Corpus](https://kontext.korpus.cz/first_form)
* [LINDAT](https://ufal.mff.cuni.cz/lindat-kontext)
* [Clarin-PL](https://kontext.clarin-pl.eu/)
* [Інститут української](https://mova.institute/kontext/first_form)
* [Serbski Institut](https://www.serbski-institut.de) (API version of KonText)
