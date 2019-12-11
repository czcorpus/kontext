from typing import List

import os
import sys
import subprocess
import inspect
import steps

KONTEXT_PATH = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))


if __name__ == "__main__":
    # install prerequisites
    subprocess.check_call(['./scripts/install/install_requirements.sh'], cwd=KONTEXT_PATH)
    
    # installation steps
    steps.SetupManatee(KONTEXT_PATH).run()
    steps.SetupKontext(KONTEXT_PATH).run()
    steps.SetupDefaultUsers(KONTEXT_PATH).run()
    
    # finalize instalation
    subprocess.check_call(['systemctl', 'start', 'celery'])
    subprocess.check_call(['systemctl', 'restart', 'nginx'])
    for message in steps.InstallationStep.final_messages:
        print(inspect.cleandoc(message))
