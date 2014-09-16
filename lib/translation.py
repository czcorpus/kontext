# Copyright (c) 2013 Institute of the Czech National Corpus
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

"""
This module acts as a WSGI-compatible wrapper around gettext.

The module must be initialized first by calling the load_translations()
function. It is sufficient to do this just once (when KonText service
starts).

Each request must call the activate() function to ensure that
the client has a proper language set.

To use common underscore function just make the following:

from translation import ugettext as _
"""


from threading import local
import gettext
import os
import logging

_translations = {}  # global (all requests share this)
_current = local()  # thread local is used to allow per-request translation


def load_translations(languages):
    """
    arguments:
    languages -- list of required languages; languages should be encoded in xx_YY form
                 but basically it can have any form matching locale/ subdirectories names
                 (i.e. if you have locale/klingon subdirectory containing gettext translations
                 then languages = ('klingon',) is a valid argument)
    """
    global _translations

    gettext.install('kontext', '%s/../locale' % os.path.dirname(__file__), unicode=1)
    languages = tuple([x for x in languages if x != 'en_US'])  # english translation is implicit
    for lang in languages:
        try:
            _translations[lang] = gettext.translation('kontext', localedir='%s/../locale' % os.path.dirname(__file__),
                                                      languages=[lang])
        except IOError as e:
            logging.getLogger(__name__).warning('Failed to load translations for %s with error: %r' % (lang, e))


def activate(lang):
    """
    Activates translation for current thread

    arguments:
    lang -- a language code
    """
    t = _translations.get(lang)
    if t is not None:
        _current.ugettext = t.ugettext
    else:
        _current.ugettext = lambda s: s


def ugettext(s):
    """
    Translates a string according to the current (thread local) translation
    """
    return _current.ugettext(s)