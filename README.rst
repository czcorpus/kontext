=======
KonText
=======

Introduction
============

This program started as a fork of the Bonito 2.68 web interface to the corpus management tool Manatee
(http://nlp.fi.muni.cz/trac/noske). It is maintained by the Institute of the Czech National Corpus.
Current version contains all the key features of the Bonito 2.98.3 (primarily a support for parallel
corpora).

Features
========

  * miscellaneous bug fixes
  * code-level changes

    * partially refactored Python code
    * completely refactored/rewritten JavaScript code (based on the RequireJS library)
    * improved logging and error processing

  * general changes
    - based on WSGI interface (original version runs as a CGI script)
    - authentication/sessions/query history/user settings implemented as custom modules
    - support for spoken corpora
    - simplified installation and configuration

  * enhanced user interface

    - improved user interface and design
    - access to previous queries
    - hierarchical corpora organization
    - extended corpora information (size, structures, attributes)
    - concordance results contain also the Average Reduced Frequency (see for example http://lrec.elra.info/proceedings/lrec2006/pdf/11_pdf.pdf for the explanation)
    - sub-corpus can be created by a custom CQL expression
    - on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
    - interactive "tag" and "within condition" building widget in CQL query mode
    - result shuffling can be pre-set


Requirements
============

  * Apache 2.x web server

    - WSGI module

  * Python *2.6* or *2.7*

    - lxml module
    - docutils module (optional)
    - werkzeug.debug middleware (required in case the 'debug' mode is on)

  * `Manatee corpus search engine <http://nlp.fi.muni.cz/trac/noske>`_, version *2.83* and up
