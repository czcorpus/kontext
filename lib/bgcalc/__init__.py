# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


class UnfinishedConcordanceError(Exception):
    """
    This error is used whenever a concordance
    used by some background calculation is 
    not completed yet (i.e. this applies only
    in case async=1).
    """
    pass


def is_celery_error(err):
    """
    Because Celery when using json serialization cannot (de)serialize original exceptions,
    errors it throws to a client are derived ones dynamically generated within package
    'celery.backends.base'. It means that static 'except' blocks are impossible and we
    must catch Exception and investigate further. This function helps with that. 
    """
    return isinstance(err, Exception) and err.__class__.__module__ == 'celery.backends.base'


def is_celery_user_error(err):
    """
    Tests whether a provided exception is a Celery derived exception generated from
    KonText's UserActionException. Please see is_bgcalc_error for more explanation.

    """
    return is_celery_error(err) and err.__class__.__name__ == 'UserActionException'
