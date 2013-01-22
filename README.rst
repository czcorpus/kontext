========================
Bonito 2 - The UCNK fork
========================

Introduction
============

This program is a fork of the Bonito 2.68 web interface to the corpus management tool Manatee
(http://nlp.fi.muni.cz/trac/noske). It is maintained by the Czech National Corpus.

Features
========

  * miscellaneous bug fixes
  * code-level changes

    * removed legacy code required by Python 2.5 and older
    * modularized JavaScript code via RequireJS
    * improved logging and error processing

  * enhanced user interface

    - corpora information (size, structures, attributes)
    - hierarchical corpora organization
    - on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
    - tag query building widget

  * support for spoken corpora
  * simplified installation and configuration


Requirements
============

  * Apache 2 web server

    - CGI
    - mod_rewrite

  * Python *2.6* or *2.7*

    - lxml
    - pymox (if you want to run the unit tests)

  * Manatee corpus manager: from the version *open-2.33.1* to the *open-2.59.1*
