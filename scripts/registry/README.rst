====================
Registry file parser
====================

These scripts can be used to extract values from Manatee registry files without need to have Manatee installed.
They are not required to run KonText.

Please note that current version is unable to handle UTF-8 characters properly (e.g. if you use a
national-specific character as a value somewhere the parser will not be able to match the string as a proper value).

List of files
=============

+-------------------+-----------------------------------------------------------------+
| confparsing.py    | wrapper around parser which provides a functionality producing  |
|                   | object representation of a registry file                        |
+-------------------+-----------------------------------------------------------------+
| parser.py         | automatically generated parser code                             |
+-------------------+-----------------------------------------------------------------+
| README.rst        | this file                                                       |
+-------------------+-----------------------------------------------------------------+
| reg_grammar.ebnf  | EBNF grammar definition                                         |
+-------------------+-----------------------------------------------------------------+
| test.py           | a testing script                                                |
+-------------------+-----------------------------------------------------------------+