# coding=utf-8
"""
    Authentication and authorization based on Federated login (Shibboleth) and
    limited local user support.

    This auth is not generic enough to be called ShibbolethAuth because it uses
    specific database backed etc.

"""
import logging
import os
import plugins
from actions import corpora, user
from controller import exposed
from controller.errors import ImmediateRedirectException
from plugins.abstract.auth import AbstractSemiInternalAuth
from plugins.abstract import PluginException

_logger = logging.getLogger(__name__)


def uni(str_str, encoding="utf-8"):
    """ Try to get unicode without errors """
    try:
        if isinstance(str_str, str):
            return str_str
        elif isinstance(str_str, str):
            return str(str_str, encoding)
    except UnicodeError:
        pass
    try:
        return str(str(str_str), encoding=encoding, errors='ignore')
    except UnicodeError:
        pass
    return str_str.decode(encoding=encoding, errors="ignore")


@exposed()
def lindat_login(self, request):
    with plugins.runtime.AUTH as auth:
        ans = {}
        self._session['user'] = auth.validate_user(self._plugin_api,
                                                   request.form['username'] if request.form else None,
                                                   request.form['password'] if request.form else None)
        if not auth.is_anonymous(self._session['user'].get('id', None)):
            if request.args.get('redirectTo', None):
                self.redirect(request.args.get('redirectTo'))
            else:
                self.redirect(self.create_url('first_form', {}))
        else:
            self.disabled_menu_items = user.USER_ACTIONS_DISABLED_ITEMS
            self.add_system_message('error', _('Incorrect username or password'))
        self.refresh_session_id()
        return ans


class FederatedAuthWithFailover(AbstractSemiInternalAuth):
    """
        A Shibboleth authentication module with a failover
        solution. Please note that the failover solution should be
        used only in exceptional cases because no high security
        measures have been applied (as opposed to federated login).
    """
    ID_KEYS = ('HTTP_EPPN', 'HTTP_PERSISTENT_ID', 'HTTP_MAIL')
    RESERVED_USER = '__user_count'

    def get_user_info(self, plugin_api):
        raise NotImplementedError()

    def __init__(self, corplist, db, sessions, conf, failover):
        """

        Arguments:
            corplist -- default (unfiltered) corpora list
            db_provider -- default database
            sessions -- a session plugin

        Note:
            login_url - used e.g., in dialog ``
        """
        anonymous_id = int(conf['anonymous_user_id'])
        super(FederatedAuthWithFailover, self).__init__(anonymous_id=anonymous_id)
        self._db = db
        self._sessions = sessions
        self._corplist = corplist
        self._failover_auth = failover
        self._logout_url = conf['logout_url']
        self._login_url = conf['login_url']
        self._conf = conf
        self._entitlement2group = {entitlement: group for entitlement, group
                                   in map(_e2g_splitter, self._conf.get('lindat:entitlements_to_groups', []))}

    def validate_user(self, plugin_api, username, password):
        """
            Try to find the user using two methods.
        """
        if username is not None and 0 < len(username):
            if username == FederatedAuthWithFailover.RESERVED_USER:
                _logger.warn("Reserved username used [%s]!", username)
                return self.anonymous_user()
            user_d = self._failover_auth.auth(self._db, username, password)
        else:
            user_d = self._auth(plugin_api)

        if user_d is not None:
            user_d['id'] = int(user_d['id'])
            user_d['user'] = user_d.get("username", "unknown")
            user_d['fullname'] = user_d.get("fullname", "Mr. No Name")
            return user_d
        else:
            return self.anonymous_user()

    def get_logout_url(self, return_url=None):
        return self._logout_url

    def get_login_url(self, return_url=None):
        return self._login_url

    def logout(self, session):
        self._sessions.delete(session)
        session.clear()

    def permitted_corpora(self, user_dict):
        """
        Returns a dictionary containing corpora IDs user can access.

        :param user_id -- database user ID
        :return:
        a dict canonical_corpus_id=>corpus_id
        """
        # fetch groups based on user_id (manual and shib based) intersect with corplist
        groups = self.get_groups_for(user_dict)
        return dict([(corpora['ident'], '') for corpora in self._corplist
                     if len(set(corpora['access']).intersection(set(groups))) > 0])

    def on_forbidden_corpus(self, plugin_api, corpname, corp_variant):
        if self.is_anonymous(plugin_api.user_id):
            raise ImmediateRedirectException(
                '{0}{1}first_form?corpname={2}'.format(self.get_login_url(), plugin_api.root_url, corpname))
        else:
            super(FederatedAuthWithFailover, self).on_forbidden_corpus(
                plugin_api, corpname, corp_variant)

    def is_administrator(self, user_id):
        # TODO(jm)
        return False

    def logout_hook(self, plugin_api):
        plugin_api.redirect('%sfirst_form' % (plugin_api.root_url,))

    def _new_user_id(self):
        return self._db.incr(FederatedAuthWithFailover.RESERVED_USER)

    def _auth(self, plugin_api):
        """
            Inspect HTTP headers and try to find a shibboleth user.
        """
        username = _get_non_empty_header(
            plugin_api.get_from_environ, *FederatedAuthWithFailover.ID_KEYS)
        if username is None or username == FederatedAuthWithFailover.RESERVED_USER:
            return None

        firstname = uni(_get_non_empty_header(
            plugin_api.get_from_environ, 'HTTP_GIVENNAME') or "")
        surname = uni(_get_non_empty_header(
            plugin_api.get_from_environ, 'HTTP_SN') or "")
        displayname = uni(_get_non_empty_header(
            plugin_api.get_from_environ, 'HTTP_DISPLAYNAME', 'HTTP_CN') or "")

        # this will work most of the times but very likely not
        # always (no unification in what IdPs are sending)
        if 0 == len(firstname) and 0 == len(surname):
            names = displayname.split()
            if 1 < len(names):
                firstname = " ".join(names[:-1])
                surname = names[-1]

        idp = uni(_get_non_empty_header(
            plugin_api.get_from_environ, "HTTP_SHIB_IDENTITY_PROVIDER") or "")

        db_user_d = self._db.hash_get_all(username)
        if 0 == len(db_user_d):
            user_d = {
                "id": self._new_user_id(),
                "username": username,
                "idp": idp,
                "fullname": "%s %s" % (firstname, surname)
            }
            self._db.hash_set_map(username, user_d)
        else:
            if idp != db_user_d["idp"]:
                _logger.warn("User's [%s] idp has changed [%s]->[%s]",
                             username, idp, db_user_d["idp"])
                return None
            user_d = db_user_d

        if 'groups' in user_d:
            groups = user_d['groups'].split(';')
        else:
            groups = []
        shib_groups = self._get_shibboleth_groups_from_entitlement_vals(uni(_get_non_empty_header(
            plugin_api.get_from_environ, "HTTP_ENTITLEMENT") or ""))
        groups = groups + shib_groups
        user_d['groups'] = groups

        return user_d

    def export(self, plugin_api):
        return {
            'metadataFeed': self._conf['lindat:metadataFeed'],
            'login_url': plugin_api.root_url + self._conf['login_url'],
            'service_name': self._conf['lindat:service_name'],
            'response_url': self._conf['lindat:response_url']
            if self._conf['lindat:response_url'] else '',
            'local_action': self._conf['lindat:local_action'],
        }

    def export_actions(self):
        return {corpora.Corpora: [ajax_get_permitted_corpora],
                user.User: [lindat_login]}

    def get_groups_for(self, user_dict):
        groups = ['anonymous']
        user_id = user_dict['id']
        if not self.is_anonymous(user_id):
            groups.append('authenticated')
            if 'groups' in user_dict:
                groups = groups + user_dict['groups']
        return groups

    def _get_shibboleth_groups_from_entitlement_vals(self, entitlement_string):
        return [self._entitlement2group[entitlement] for entitlement in entitlement_string.split(';')
                if entitlement in self._entitlement2group]


# =============================================================================
def _e2g_splitter(i):
    parts = i.split('=', 2)
    return parts[0].strip(), parts[1].strip()


@exposed(return_type='json', skip_corpus_init=True)
def ajax_get_permitted_corpora(ctrl, request):
    """
    An exposed HTTP action showing permitted corpora required by client-side widget.
    """
    return dict(permitted_corpora=plugins.runtime.AUTH.instance.permitted_corpora(ctrl.session_get('user')))


# =============================================================================

class LocalFailover(object):
    """
        Get user info from the underlying database.
    """
    min_pass = 5

    def __init__(self):
        pass

    def auth(self, db, user, password):
        d = db.hash_get_all(user)
        if 0 == len(d):
            return None
        p = d.get("password", "")
        if LocalFailover.min_pass > len(p):
            return None
        if p != password:
            return None
        del d["password"]
        d["username"] = user
        return d


# =============================================================================

def _load_corplist(corptree_path):
    """
        This auth relies on a list of corpora in a file
        from which we get the public ones. At the moment,
        all corpora in that file are considered public.

        Private can be added via user database.
    """
    from plugins.lindat_corparch import CorptreeParser
    data, metadata = CorptreeParser().parse_xml_tree(corptree_path)
    flat_corplist = _flatten_corplist(data['corplist'])
    return flat_corplist


def _flatten_corplist(corp_list):
    ans = []
    for item in corp_list:
        if 'corplist' in item:
            ans += _flatten_corplist(item['corplist'])
        else:
            ans.append(item)
    return ans


def _get_non_empty_header(ftor, *args):
    """
        Get values using the specified ftor. Empty or null values
        are treated as missing.
    """
    for header in args:
        val = ftor(header)
        if val is None or 0 == len(val):
            continue
        return val
    return None


# =============================================================================

@plugins.inject(plugins.runtime.DB, plugins.runtime.SESSIONS)
def create_instance(conf, db, sessions):
    auth_conf = conf.get('plugins', 'auth')
    corparch_conf = conf.get('plugins', 'corparch')
    corplist_file = corparch_conf['lindat:file']
    if not os.path.exists(corplist_file):
        raise PluginException("Corplist file [%s] in lindat_auth does not exist!" % corplist_file)
    corplist = _load_corplist(corplist_file)

    # use different shard for the user storage
    auth_db = db.get_instance('auth')

    # this can get handy when federated login is not possible
    failover_auth = LocalFailover()

    return FederatedAuthWithFailover(
        corplist=corplist,
        db=auth_db,
        sessions=sessions,
        conf=auth_conf,
        failover=failover_auth
    )
