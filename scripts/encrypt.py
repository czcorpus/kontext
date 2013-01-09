#!/usr/bin/python

if __name__ == '__main__':
    import sys

    sys.path.insert(0, 'lib')
    import settings
    import crypt

    if len(sys.argv) < 2:
        print('No password entered')
    else:
        print('\nYour encrypted password is: %s\n' % crypt.crypt(sys.argv[1], settings.create_salt()))