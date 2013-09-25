========================
Bonito 2-UCNK
========================

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

    * removed legacy code required by Python 2.5 and older
    * modularized JavaScript code based on the RequireJS library
    * improved logging and error processing

  * enhanced user interface

    - hierarchical corpora organization
    - extended corpora information (size, structures, attributes)
    - concordance results contain also the Average Reduced Frequency (see for example http://lrec.elra.info/proceedings/lrec2006/pdf/11_pdf.pdf for the explanation)
    - sub-corpus can be created by a custom CQL expression
    - on the multilevel frequency distribution page, starting word can be specified for multi-word KWICs
    - interactive "tag" and "within condition" building widget in CQL query mode
    - result shuffling can be pre-set

  * support for spoken corpora
  * simplified installation and configuration


Requirements
============

  * Apache 2 web server

    - CGI
    - mod_rewrite (suitable but not necessary)

  * Python *2.6* or *2.7*

    - lxml
    - pymox (if you want to run the unit tests)

  * Manatee corpus manager: from version *open-2.68* to *open-2.73.2*
