def get_protocol(environ):
    if 'HTTP_X_FORWARDED_PROTO' in environ:
        return environ['HTTP_X_FORWARDED_PROTO']
    elif 'HTTP_X_FORWARDED_PROTOCOL' in environ:
        return environ['HTTP_X_FORWARDED_PROTOCOL']
    else:
        return environ['wsgi.url_scheme']
