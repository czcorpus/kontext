from plugins.abstract.token_detail import AbstractBackend
from plugins.default_token_detail.backends import cached


class HTTPBackend(AbstractBackend):
    def __init__(self, conf):
        super(HTTPBackend, self).__init__()
        self._conf = conf

    @cached
    def fetch_data(self, word, lemma, tag, aligned_corpora, lang):
        return ["mocked HTTP backend output - word: %s, lemma: %s" % (word, lemma), True]

