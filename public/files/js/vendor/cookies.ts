/*\
|*|
|*|  :: cookies.js ::
|*|
|*|  A complete cookies reader/writer framework with full unicode support.
|*|
|*|  Revision #1 - September 4, 2014
|*|
|*|  https://developer.mozilla.org/en-US/docs/Web/API/document.cookie
|*|  https://developer.mozilla.org/User:fusionchess
|*|
|*|  This framework is released under the GNU Public License, version 3 or later.
|*|  http://www.gnu.org/licenses/gpl-3.0-standalone.html
|*|
|*|  Syntaxes:
|*|
|*|  * docCookies.setItem(name, value[, end[, path[, domain[, secure]]]])
|*|  * docCookies.getItem(name)
|*|  * docCookies.removeItem(name[, path[, domain]])
|*|  * docCookies.hasItem(name)
|*|  * docCookies.keys()
|*|
\*/

class Cookies {

    getItem(sKey:string):string {
        if (!sKey) { 
            return null;
        }
        return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + 
                encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + 
                "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
    }

    setItem(sKey:string, sValue:string, vEnd?:number|string|Date, sPath?:string, 
                sDomain?:string, bSecure?:boolean):boolean {
        if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { 
            return false; 
        }
        let sExpires = "";
        if (vEnd) {
            if (typeof vEnd === 'number') {
                sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; max-age=" + vEnd;
            
            } else if (typeof vEnd === 'string') {
                sExpires = "; expires=" + vEnd;

            } else {
                sExpires = "; expires=" + vEnd.toUTCString();
            }
        }
        document.cookie = encodeURIComponent(sKey) + "=" + encodeURIComponent(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
        return true;
    }

    removeItem(sKey:string, sPath:string, sDomain?:string):boolean {
        if (!this.hasItem(sKey)) { 
            return false; 
        }
        document.cookie = encodeURIComponent(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "");
        return true;
    }

    hasItem(sKey:string):boolean {
        if (!sKey) { 
            return false; 
        }
        return (new RegExp("(?:^|;\\s*)" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
    }

    keys():Array<string> {
        const aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
        for (var nLen = aKeys.length, nIdx = 0; nIdx < nLen; nIdx++) { aKeys[nIdx] = decodeURIComponent(aKeys[nIdx]); }
        return aKeys;
    }
}

export default new Cookies();