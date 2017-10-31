import argparse
import os
import sys

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../../lib')))
from plugins.ucnk_conc_persistence3 import ArchMan
import settings

conf_path = os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../../conf/config.xml'))
settings.load(conf_path)
plugin_conf = settings.get('plugins', 'conc_persistence3')
db_path = plugin_conf.get('ucnk:archive_db_path')
rows_limit = int(plugin_conf.get('ucnk:archive_rows_limit'))
archMan = ArchMan(db_path, rows_limit)

parser = argparse.ArgumentParser()
parser.add_argument("source_archive", help="full path to the source archive db file")
parser.add_argument("-si", "--splitinto", help="number of files the source archive should be split into")
parser.add_argument("-c", "--clear", action="store_true", help="clear the archives directory before splitting")
parser.add_argument("-v", "--verbose", action="store_true", help="clear the archives directory before splitting")

args = parser.parse_args()
source_path = args.source_archive

if not os.path.exists(source_path):
    raise NameError("the specified file does not exist")
if not archMan.is_archive_correct(source_path):
    raise TypeError("invalid file contents")

verbose = True if args.verbose else False

if args.clear:
    for f in sorted(os.listdir(db_path)):
        os.remove(db_path + f)

archMan.copy_archive_file(source_path)
filename = os.path.basename(source_path)
numrows = archMan.get_arch_numrows(filename)

if verbose:
    print("archives directory config value: " + db_path)
    print("archive rows limit config value: " + str(rows_limit))
    print("source archive size: " + str(numrows))

if args.splitinto:
    splitinto = args.splitinto
else:
    splitinto = int(numrows / rows_limit)

archMan.split_archive(source_path, int(splitinto))

if verbose:
    print("split into archives:")
    for f in reversed(sorted(os.listdir(db_path))):
        print(f + ", size: " + str(archMan.get_arch_numrows(f)))
