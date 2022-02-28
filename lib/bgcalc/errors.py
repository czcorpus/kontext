# Copyright (c) 2017 Charles University, Faculty of Arts,
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


class BgCalcError(Exception):
    pass


class CalcTaskNotFoundError(BgCalcError):
    pass


class UnfinishedConcordanceError(BgCalcError):
    """
    This error is used whenever a concordance
    used by some background calculation is
    not completed yet (i.e. this applies only
    in case asnc=1).
    """
    pass


class CalcArgsAssertionError(BgCalcError):
    """
    CalcArgsAssertionError represents a semantically
    incorrect combination of function arguments for
    a background calculation.
    """