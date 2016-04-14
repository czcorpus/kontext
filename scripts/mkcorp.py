if __name__ == '__main__':
    import sys
    import os
    import argparse
    sys.path.insert(0, os.path.realpath(os.path.dirname(__file__)))
    import autoconf


    parser = argparse.ArgumentParser(description='A script to control UCNK metadata cache')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='Just analyze, do not modify anything')