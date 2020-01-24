import os
import sys
import random
import string

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../lib'))

from plugins.default_auth.tools import mk_pwd_hash_default

random = ''.join([random.choice(string.ascii_letters + string.digits) for n in range(8)])
print(random + "-" + mk_pwd_hash_default(random))
