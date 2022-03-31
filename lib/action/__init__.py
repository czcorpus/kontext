# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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


def get_protocol(environ):
    if 'HTTP_X_FORWARDED_PROTO' in environ:
        return environ['HTTP_X_FORWARDED_PROTO']
    elif 'HTTP_X_FORWARDED_PROTOCOL' in environ:
        return environ['HTTP_X_FORWARDED_PROTOCOL']
    else:
        return environ['wsgi.url_scheme']
