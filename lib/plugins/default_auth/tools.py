import os
from werkzeug.security import pbkdf2_hex


def mk_pwd_hash_default(data):
    """
    Returns a pbkdf2_hex hash of the passed data with default parameters
    """
    iterations = 1000
    keylen = 24
    algo = 'sha512'
    salt = str(os.urandom(keylen))
    return mk_pwd_hash(data, salt, iterations, keylen, algo)


def mk_pwd_hash(data, salt, iterations, keylen, algo):
    """
    Returns a pbkdf2_hex hash of the passed data with specified parameters
    """
    hashed = pbkdf2_hex(data, salt, iterations, keylen, algo)
    return algo + "$" + salt + ":" + str(iterations) + "$" + hashed


def split_pwd_hash(hashed):
    """
    Splits a string expected to have an "algorithm$salt:iterations$hashed_pwd" format and returns a dictionary of
    the values. For legacy pwd hashes, a dictionary with a single value (i.e. {'data': legacyHash}) is returned.
    """
    res = {}
    first_split = hashed.split("$")
    # no dollar-sign means legacy pwd format
    if len(first_split) == 1:
        res['data'] = hashed
    else:
        # expected format: "algorithm$salt:iterations$hashed_pwd"
        if len(first_split) >= 3 and ':' in first_split[-2]:
            res['algo'] = first_split[0]
            # in case salt contains $
            res['salt'] = '$'.join(first_split[1:-1]).split(":")[0]
            res['iterations'] = int(first_split[-2].split(":")[1])
            res['data'] = first_split[-1]
            res['keylen'] = len(res['data']) / 2
        else:
            raise TypeError("wrong hash format")
    return res