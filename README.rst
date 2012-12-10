========================
Bonito 2 - The UCNK fork
========================

Introduction
============

This program is a fork of the Bonito 2 web interface to the corpus management tool Manatee
(http://nlp.fi.muni.cz/trac/noske). It is maintained by the Czech National Corpus.

Features
========

  * miscellaneous bug fixes
  * removed legacy code required by Python 2.5 and less
  * enhanced user interface

    - corpora information
    - hierarchical corpora organization
    - on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
    - tag query building widget

  * support for spoken corpora
  * simplified installation and configuration


Requirements
============

  * CGI capable Apache web server
  * MySQL database server
  * Python 2.6+

    - lxml
    - pymox (if you want to run the unit tests)

  * manatee: open-2.33.1
