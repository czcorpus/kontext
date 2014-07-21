KonText
=======

Introduction
------------

This program started as a fork of the Bonito 2.68 web interface to the corpus management tool
[Manatee](http://nlp.fi.muni.cz/trac/noske). It is maintained by the
[Institute of the Czech National Corpus](http://ucnk.ff.cuni.cz/).
Current version contains all the key features of the Bonito 2.98.3 (primarily a support for parallel
corpora).

Features
--------

* code-level changes
    * improved Python code and software architecture
    * completely refactored/rewritten JavaScript code (based on the RequireJS library)
    * improved logging, error processing and debugging support
    * improved code documentation
* general changes
    * rewritten as a WSGI application (original version runs as a CGI script)
    * added support for spoken corpora
    * installation-specific functions (database backend, sessions, query history,...) are written as replaceable plugins
    * simplified installation and configuration
* enhanced user interface
    * improved user interface and design
    * access to previous queries
    * hierarchical corpora organization
    * extended corpora information (size, structures, attributes)
    * concordance results contain also the Average Reduced Frequency (see for example http://lrec.elra.info/proceedings/lrec2006/pdf/11_pdf.pdf for the explanation)
    * sub-corpus can be created by a custom CQL expression
    * on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
    * interactive "tag" and "within condition" building widget in CQL query mode
    * result shuffling can be pre-set


Requirements
------------

* Apache 2.x web server
    * enabled WSGI module (e.g. [mod_wsgi](https://code.google.com/p/modwsgi/))
* Python *2.6* or *2.7*
    * [lxml](http://lxml.de/) library
    * [werkzeug](http://werkzeug.pocoo.org/) library (provides WSGI middleware)
    * [PyICU](http://pyicu.osafoundation.org/) library (optional but preferred)
    * [markdown](https://pypi.python.org/pypi/Markdown) module (optional, for formatted corpora references)

  * corpus search engine [Manatee](http://nlp.fi.muni.cz/trac/noske), version *2.83.x* (2.107.1 is not supported yet)
