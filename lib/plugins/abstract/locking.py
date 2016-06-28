# Copyright (c) 2015 Institute of the Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.


class DummyLock(object):

    def __enter__(self):
        return None

    def __exit__(self, type, value, traceback):
        pass

    def create(self, *args):
        return self


class AbstractLock(object):
    """
    General locking plug-in implementation. All the parameters including
    lock ID are expected to be passed via __init__ method. User of the plug-in
    does not have to know about __init__ signature as she uses lock factory
    object (lock_factory.create(lock_id)).
    """

    def __enter__(self):
        """
        Acquires lock with a specific ID (= an attribute of self)
        """
        raise NotImplementedError()

    def __exit__(self, exc_type, exc_val, exc_tb):
        raise NotImplementedError()


class LockTimeout(Exception):
    """
    This exception should be thrown once the number of allowed attempts was reached.
    """
    pass