// this file must be served outside KonText (e.g. by setting up an alias in Nginx)

(function(w) {
        'use strict';
        w.document.addEventListener('DOMContentLoaded', function() {
            w.document.getElementById('switch-to-en').addEventListener('click', function () {
                document.cookie = "kontext_ui_lang=en; expires=Fri, 31 Dec 2200 23:59:59 GMT";
                w.location.reload();
            });
            w.document.getElementById('switch-to-cs').addEventListener('click', function () {
               document.cookie = "kontext_ui_lang=cs; expires=Fri, 31 Dec 2200 23:59:59 GMT";
               w.location.reload();
            });
        });
})(window);
