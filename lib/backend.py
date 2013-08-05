import imp


class Auth(object):
    pass


class VoidService():

    def __getattr__(self, *args, **kwargs):
        def fallback(*args, **kwargs):
            pass

        return fallback



auth = Auth()

query_storage = VoidService()