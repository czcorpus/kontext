requirejs.config({
    paths: {
        'discojuice'  : '//engine.discojuice.org/discojuice-stable.min',
        'aai'         : '//lindat.mff.cuni.cz/aai/aai',
    },
    shim : {
        'aai' : {
            deps: ['jquery','discojuice']
        }
    }
});

define(['conf', 'aai'], function (conf) {

    var lib = {};

    lib.init = function () {
        if (!("aai" in window)) {
            throw "Failed to find LINDAT/CLARIN AAI object. See https://redmine.ms.mff.cuni.cz/projects/lindat-aai for more details!";
        }
        var opts = (function () {
            var instance = {};
            //if ever port is needed (eg. testing other tomcat) it should be in responseUrl and target
            instance.port = (window.location.port === "" ? "" : ":" + window.location.port);
            instance.host = window.location.protocol + '//' +
                window.location.hostname;
            instance.repoPath = '/repository/xmlui';
            if (instance.repoPath.charAt(instance.repoPath.length - 1) !== '/') {
                instance.repoPath = instance.repoPath + '/';
            }
            instance.target = instance.host + instance.port + '/services/kontext-dev/run.cgi/loginx';
            //In order to use the discojuice store (improve score of used IDPs)
            //Works only with "verified" SPs - ie. ufal-point, displays error on ufal-point-dev
            instance.responseUrl =
                (window.location.hostname.search("ufal-point-dev") >= 0) ?
                        "" :
                        instance.host + instance.port + instance.repoPath +
                            "themes/UFAL/lib/html/disco-juice.html?";
            instance.metadataFeed = instance.host + instance.port + instance.repoPath + "discojuice/feeds";
            instance.serviceName = "LINDAT/CLARIN KonText Login";
            instance.localauth =
                    '<form method="post" action="' + instance.target + '"> ' +
                    '<p>Sign in using your local account obtained from the LINDAT/CLARIN administrator.</p>' +
                    '<p style="margin: 5px; color: #888" ><input type="text" name="username" style="font-size: 160%; width: 100%" id="login" /> <label for="login">Username</label></p>' +
                    '<p style="margin: 5px; color: #888" ><input type="password" name="password" style="font-size: 160%; width: 100%" id="pass" /> <label for="pass">Password</label></p>' +
                    '<p  style="" ><input type="submit" style="margin: 20px 2px" name="submit" value="Sign in" /></p>' +
                    '</form>';
            return instance;
        })();
        aai.setup(opts);
        return aai;
    };

    return lib;

});
