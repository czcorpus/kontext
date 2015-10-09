KonText
=======

Introduction
------------

KonText started as a fork of the Bonito 2.68 web interface to the corpus management tool
[Manatee](http://nlp.fi.muni.cz/trac/noske). The current development is focused on 

It is maintained by the
[Institute of the Czech National Corpus](http://ucnk.ff.cuni.cz/).
Current version contains all the key features of the Bonito 2.98.3 (primarily a support for parallel
corpora).

Features
--------

### code-level changes

* rewritten as a WSGI application (Bonito2 is CGI-based)
* modular code design with dynamically loadable plug-ins providing custom functionality implementation
* background concordance calculation based on Python's high-level *multiprocessing* package
* completely rewritten client-side code (AMD modules, code separated from templates)
* improved logging, error processing and debugging support
* improved code documentation

### new features

* added support for spoken corpora - defined segments can be played back as audio
* persistent links for large queries - you can send a link to someone even if the query was in megabytes
* access to previous queries
* easy access to favorite corpora/subcorpora/aligned corpora
* interactive subcorpus selection - you can select text types and see how other attributes' available values changed
* interactive PoS tag tool - in case of positional PoS tag formats an interactive tool can be used to write tag queries
* a concordance/frequency/collocation listing can be saved in Excel format (xlsx)
* an interactive text type selection tool can be used when creating a subcorpus (including ad-hoc one)

### enhanced user interface

* improved user interface and design
* extended corpora information (size, structures, attributes, citation information)
* concordance results contain also the [Average Reduced Frequency](http://lrec.elra.info/proceedings/lrec2006/pdf/11_pdf.pdf)
* sub-corpus can be created by a custom CQL expression
* on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
* result shuffling can be pre-set


Requirements
------------

* a WSGI-compatible server
    * (e.g. Apache2 with [mod_wsgi](https://code.google.com/p/modwsgi/), or [Gunicorn](http://gunicorn.org/) + [Nginx](http://nginx.org/))
* Python *2.6* or *2.7*
    * [lxml](http://lxml.de/) library
    * [werkzeug](http://werkzeug.pocoo.org/) library (provides WSGI middleware)
    * [PyICU](https://pypi.python.org/pypi/PyICU) library (optional but preferred)
    * [markdown](https://pypi.python.org/pypi/Markdown) library (optional, for formatted corpora references)
    * [openpyxl](https://pythonhosted.org/openpyxl/) library (optional, for XLSX export)
* corpus search engine [Manatee](http://nlp.fi.muni.cz/trac/noske)
    * versions from *2.83.3* to *2.121.1* are supported (the latest one is highly recommended); unless there is an incompatible change in Manatee, newer versions should work too
* a key-value storage
    * any custom implementation ([Redis](http://redis.io/) and [SQLite](https://sqlite.org/) backends are available by default) 


Installation
------------

Please refer to the [INSTALL.md](INSTALL.md) file.


Customization and contribution
------------------------------

Please refer to the [DEVELOPMENT.md](DEVELOPMENT.md) file.