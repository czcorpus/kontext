#!/usr/bin/python

if __name__ == '__main__':
    import sys
    import os
    sys.path.insert(0, '%s/../lib' % os.path.dirname(os.path.abspath(__file__)))
    from plugins import ucnk_auth
    import crypt

    if len(sys.argv) < 2:
        print('No password entered')
    else:
        print('\nYour encrypted password is: %s\n' % crypt.crypt(sys.argv[1], ucnk_auth.create_salt()))
