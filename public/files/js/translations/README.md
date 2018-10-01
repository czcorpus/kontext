# KonText - user interface translations

This directory contains translations for core KonText application.
Please note that many plug-ins (see *public/files/js/plugins*) contain
also their additional translation files (the name is always *messages.json*
or *messages.[lang].json*).

Each "messages" file may contain one or more language blocks. The convention
is the following:

* first-level key is always a language code (e.g. *en-US*),
* plug-ins should use a single *messages.json* file as the are expected to
contain only a few messages,
* core translation files should contain only a single language or multiple
variants for a single language (e.g. en-US, en-GB).
* the language code used in a file name does not have to be a standard one.

(KonText does not check the value) but a standard value is always preferred
(e.g. *messages.it.json*, *messages.pl.json*)

## Project building versus translations

When building the client-side application, only languages defined
in *config.xml* (*global/translations*) are packed into the final code
to reduce the application size. It means that in case you change supported
languages in your application, the project must be rebuilt.
