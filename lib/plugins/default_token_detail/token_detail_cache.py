import sqlite3
from hashlib import md5
from functools import wraps
import time
import os

from plugins.abstract.token_detail import AbstractBackend
from plugins.ucnk_live_attributes import cached


def prepare_cache():
    db_dir = '/tmp/token_cache/'
    db_filename = 'token_detail_cache.db'
    if not os.path.exists(db_dir):
        os.mkdir(db_dir)
    db_full_path = os.path.join(db_dir, db_filename)
    conn = sqlite3.connect(db_full_path)
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS cache ("
              "key text, "
              "data text, "
              "created integer NOT NULL, "
              "PRIMARY KEY (key))")
    c.execute("INSERT INTO cache VALUES ('fc1cfaa1958623cf4946802e25847afe', 'DATA', 0)")
    conn.commit()
    conn.close()


# def get_cached():


def mk_token_detail_cache_key(pth, cls, word, lemma, pos, aligned_corpora, lang):
    """
    Returns a hashed cache key based on the passed parameters.
    """
    return md5('%r %r %r %r %r %r %r' % (pth, cls, word, lemma, pos, aligned_corpora, lang)).hexdigest()


def cached(f):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """

    @wraps(f)
    def wrapper(self, word, lemma, pos, aligned_corpora, lang):
        key = mk_token_detail_cache_key(self._path, self._class, word, lemma, pos, aligned_corpora, lang)
        print key
        # to-do: move to config
        db_dir = '/tmp/token_cache/'
        db_filename = 'token_detail_cache.db'
        if not os.path.exists(db_dir):
            os.mkdir(db_dir)
        db_full_path = os.path.join(db_dir, db_filename)
        conn = sqlite3.connect(db_full_path)
        curs = conn.cursor()
        res = curs.execute("SELECT data FROM cache WHERE key = ?", (key,)).fetchone()
        if res is None:
            res = f(self, word, lemma, pos, aligned_corpora, lang)
            if res is not None:
                curs.execute("INSERT INTO cache (key, data, created) VALUES (?,?,?)",
                             (key, res, int(round(time.time()))))
        conn.commit()
        conn.close()
        return res[0] if res else None

    return wrapper


class MyBackend(AbstractBackend):
    def __init__(self, conf):
        # self._conf = conf
        self._class = self.__class__.__name__
        self._path = __file__

    @cached
    def fetch_data(self, word, lemma, pos, aligned_corpora, lang):
        return None

    # def cache_store(self, word, lemma, pos, aligned_corpora, lang):

    def mk_hash(self, word, lemma, pos, aligned_corpora, lang):
        hash = md5('%r %r %r %r %r' % (word, lemma, pos, aligned_corpora, lang))
        print hash


# prepare_cache()
mybcknd = MyBackend(None)
print mybcknd.fetch_data("word", "lemma", "pos", "aligned_corpora", "lang")
