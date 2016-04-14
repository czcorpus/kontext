SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
export PYTHONPATH="${SCRIPT_DIR}/../lib"
export LUIGI_CONFIG_PATH="${SCRIPT_DIR}/../conf/luigi.cfg"
luigi "$@"
