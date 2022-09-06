#!/bin/bash

dir_path=$(dirname $0)
export GLOBAL_CONF_PATH="$dirname/kontext-deploy.json"
python3 "$dir_path/kontext-update.py" "$@"
ret=$?
if [ $ret -eq 0 ]; then
    echo "new version installed, now going to restart the services..."
    sudo bash -c 'systemctl restart sanic-kontext && systemctl restart rq-all.target && systemctl restart rqscheduler && systemctl restart nginx'
    echo "...done"
elif [ $ret -eq 2 ]; then
    printf "\nfailed to install latest KonText - the services won't be restarted\n\n"
fi