import subprocess
import sys
import pyinotify
import logging


class OnWriteHandler(pyinotify.ProcessEvent):
    def my_init(self, extension, cmd):
        self.extensions = extension.split(',')
        self.cmd = cmd

        logging.info('==> Running new process')
        self.process = subprocess.Popen(self.cmd.split(' '))

    def _run_cmd(self):
        logging.info('==> Modification detected')
        if self.process.poll() is None:
            logging.info(f'==> Killing process {self.process.pid}')
            self.process.kill()
        logging.info('==> Running new process')
        self.process = subprocess.Popen(self.cmd.split(' '))

    def process_IN_MODIFY(self, event):
        if not any(event.pathname.endswith(ext) for ext in self.extensions):
            return
        self._run_cmd()


def on_file_change(path, extension, cmd):
    wm = pyinotify.WatchManager()
    handler = OnWriteHandler(extension=extension, cmd=cmd)
    notifier = pyinotify.Notifier(wm, default_proc_fun=handler)
    wm.add_watch(path, pyinotify.ALL_EVENTS, rec=True, auto_add=True)
    logging.info('==> Start monitoring %s' % path)
    notifier.loop()


if __name__ == '__main__':
    logging.basicConfig(
        format='%(asctime)s [reloader] %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[logging.StreamHandler(sys.stderr)],
        level=logging.DEBUG
    )

    if len(sys.argv) < 4:
        logging.error("Command line error: missing argument(s).")
        sys.exit(1)

    path = sys.argv[1]
    extension = sys.argv[2]
    cmd = sys.argv[3]

    on_file_change(path, extension, cmd)
