!function (t) {
    function n(r) {
        if (e[r])return e[r].exports;
        var i = e[r] = {exports: {}, id: r, loaded: !1};
        return t[r].call(i.exports, i, i.exports, n), i.loaded = !0, i.exports
    }

    var e = {};
    return n.m = t, n.c = e, n.p = "", n(0)
}([function (t, n, e) {
    "use strict";
    var r = e(4);
    r.fn.treexView = e(12)
}, function (t, n) {
    t.exports = function () {
        var t = [];
        return t.toString = function () {
            for (var t = [], n = 0; n < this.length; n++) {
                var e = this[n];
                e[2] ? t.push("@media " + e[2] + "{" + e[1] + "}") : t.push(e[1])
            }
            return t.join("")
        }, t.i = function (n, e) {
            "string" == typeof n && (n = [[null, n, ""]]);
            for (var r = {}, i = 0; i < this.length; i++) {
                var o = this[i][0];
                "number" == typeof o && (r[o] = !0)
            }
            for (i = 0; i < n.length; i++) {
                var u = n[i];
                "number" == typeof u[0] && r[u[0]] || (e && !u[2] ? u[2] = e : e && (u[2] = "(" + u[2] + ") and (" + e + ")"), t.push(u))
            }
        }, t
    }
}, function (t, n, e) {
    var r, i;
    !function () {
        function o(t) {
            return t && (t.ownerDocument || t.document || t).documentElement
        }

        function u(t) {
            return t && (t.ownerDocument && t.ownerDocument.defaultView || t.document && t || t.defaultView)
        }

        function a(t, n) {
            return n > t ? -1 : t > n ? 1 : t >= n ? 0 : NaN
        }

        function s(t) {
            return null === t ? NaN : +t
        }

        function l(t) {
            return !isNaN(t)
        }

        function c(t) {
            return {
                left: function (n, e, r, i) {
                    for (arguments.length < 3 && (r = 0), arguments.length < 4 && (i = n.length); i > r;) {
                        var o = r + i >>> 1;
                        t(n[o], e) < 0 ? r = o + 1 : i = o
                    }
                    return r
                }, right: function (n, e, r, i) {
                    for (arguments.length < 3 && (r = 0), arguments.length < 4 && (i = n.length); i > r;) {
                        var o = r + i >>> 1;
                        t(n[o], e) > 0 ? i = o : r = o + 1
                    }
                    return r
                }
            }
        }

        function f(t) {
            return t.length
        }

        function h(t) {
            for (var n = 1; t * n % 1;)n *= 10;
            return n
        }

        function g(t, n) {
            for (var e in n)Object.defineProperty(t.prototype, e, {value: n[e], enumerable: !1})
        }

        function p() {
            this._ = Object.create(null)
        }

        function d(t) {
            return (t += "") === bu || t[0] === Mu ? Mu + t : t
        }

        function v(t) {
            return (t += "")[0] === Mu ? t.slice(1) : t
        }

        function m(t) {
            return d(t)in this._
        }

        function y(t) {
            return (t = d(t))in this._ && delete this._[t]
        }

        function x() {
            var t = [];
            for (var n in this._)t.push(v(n));
            return t
        }

        function b() {
            var t = 0;
            for (var n in this._)++t;
            return t
        }

        function M() {
            for (var t in this._)return !1;
            return !0
        }

        function w() {
            this._ = Object.create(null)
        }

        function _(t) {
            return t
        }

        function k(t, n, e) {
            return function () {
                var r = e.apply(n, arguments);
                return r === n ? t : r
            }
        }

        function S(t, n) {
            if (n in t)return n;
            n = n.charAt(0).toUpperCase() + n.slice(1);
            for (var e = 0, r = wu.length; r > e; ++e) {
                var i = wu[e] + n;
                if (i in t)return i
            }
        }

        function N() {
        }

        function E() {
        }

        function A(t) {
            function n() {
                for (var n, r = e, i = -1, o = r.length; ++i < o;)(n = r[i].on) && n.apply(this, arguments);
                return t
            }

            var e = [], r = new p;
            return n.on = function (n, i) {
                var o, u = r.get(n);
                return arguments.length < 2 ? u && u.on : (u && (u.on = null, e = e.slice(0, o = e.indexOf(u)).concat(e.slice(o + 1)), r.remove(n)), i && e.push(r.set(n, {on: i})), t)
            }, n
        }

        function C() {
            au.event.preventDefault()
        }

        function z() {
            for (var t, n = au.event; t = n.sourceEvent;)n = t;
            return n
        }

        function L(t) {
            for (var n = new E, e = 0, r = arguments.length; ++e < r;)n[arguments[e]] = A(n);
            return n.of = function (e, r) {
                return function (i) {
                    try {
                        var o = i.sourceEvent = au.event;
                        i.target = t, au.event = i, n[i.type].apply(e, r)
                    } finally {
                        au.event = o
                    }
                }
            }, n
        }

        function T(t) {
            return ku(t, Au), t
        }

        function R(t) {
            return "function" == typeof t ? t : function () {
                return Su(t, this)
            }
        }

        function q(t) {
            return "function" == typeof t ? t : function () {
                return Nu(t, this)
            }
        }

        function D(t, n) {
            function e() {
                this.removeAttribute(t)
            }

            function r() {
                this.removeAttributeNS(t.space, t.local)
            }

            function i() {
                this.setAttribute(t, n)
            }

            function o() {
                this.setAttributeNS(t.space, t.local, n)
            }

            function u() {
                var e = n.apply(this, arguments);
                null == e ? this.removeAttribute(t) : this.setAttribute(t, e)
            }

            function a() {
                var e = n.apply(this, arguments);
                null == e ? this.removeAttributeNS(t.space, t.local) : this.setAttributeNS(t.space, t.local, e)
            }

            return t = au.ns.qualify(t), null == n ? t.local ? r : e : "function" == typeof n ? t.local ? a : u : t.local ? o : i
        }

        function P(t) {
            return t.trim().replace(/\s+/g, " ")
        }

        function U(t) {
            return new RegExp("(?:^|\\s+)" + au.requote(t) + "(?:\\s+|$)", "g")
        }

        function j(t) {
            return (t + "").trim().split(/^|\s+/)
        }

        function O(t, n) {
            function e() {
                for (var e = -1; ++e < i;)t[e](this, n)
            }

            function r() {
                for (var e = -1, r = n.apply(this, arguments); ++e < i;)t[e](this, r)
            }

            t = j(t).map(H);
            var i = t.length;
            return "function" == typeof n ? r : e
        }

        function H(t) {
            var n = U(t);
            return function (e, r) {
                if (i = e.classList)return r ? i.add(t) : i.remove(t);
                var i = e.getAttribute("class") || "";
                r ? (n.lastIndex = 0, n.test(i) || e.setAttribute("class", P(i + " " + t))) : e.setAttribute("class", P(i.replace(n, " ")))
            }
        }

        function B(t, n, e) {
            function r() {
                this.style.removeProperty(t)
            }

            function i() {
                this.style.setProperty(t, n, e)
            }

            function o() {
                var r = n.apply(this, arguments);
                null == r ? this.style.removeProperty(t) : this.style.setProperty(t, r, e)
            }

            return null == n ? r : "function" == typeof n ? o : i
        }

        function F(t, n) {
            function e() {
                delete this[t]
            }

            function r() {
                this[t] = n
            }

            function i() {
                var e = n.apply(this, arguments);
                null == e ? delete this[t] : this[t] = e
            }

            return null == n ? e : "function" == typeof n ? i : r
        }

        function Y(t) {
            function n() {
                var n = this.ownerDocument, e = this.namespaceURI;
                return e ? n.createElementNS(e, t) : n.createElement(t)
            }

            function e() {
                return this.ownerDocument.createElementNS(t.space, t.local)
            }

            return "function" == typeof t ? t : (t = au.ns.qualify(t)).local ? e : n
        }

        function X() {
            var t = this.parentNode;
            t && t.removeChild(this)
        }

        function I(t) {
            return {__data__: t}
        }

        function Z(t) {
            return function () {
                return Eu(this, t)
            }
        }

        function J(t) {
            return arguments.length || (t = a), function (n, e) {
                return n && e ? t(n.__data__, e.__data__) : !n - !e
            }
        }

        function V(t, n) {
            for (var e = 0, r = t.length; r > e; e++)for (var i, o = t[e], u = 0, a = o.length; a > u; u++)(i = o[u]) && n(i, u, e);
            return t
        }

        function $(t) {
            return ku(t, zu), t
        }

        function Q(t) {
            var n, e;
            return function (r, i, o) {
                var u, a = t[o].update, s = a.length;
                for (o != e && (e = o, n = 0), i >= n && (n = i + 1); !(u = a[n]) && ++n < s;);
                return u
            }
        }

        function W(t, n, e) {
            function r() {
                var n = this[u];
                n && (this.removeEventListener(t, n, n.$), delete this[u])
            }

            function i() {
                var i = s(n, lu(arguments));
                r.call(this), this.addEventListener(t, this[u] = i, i.$ = e), i._ = n
            }

            function o() {
                var n, e = new RegExp("^__on([^.]+)" + au.requote(t) + "$");
                for (var r in this)if (n = r.match(e)) {
                    var i = this[r];
                    this.removeEventListener(n[1], i, i.$), delete this[r]
                }
            }

            var u = "__on" + t, a = t.indexOf("."), s = G;
            a > 0 && (t = t.slice(0, a));
            var l = Lu.get(t);
            return l && (t = l, s = K), a ? n ? i : r : n ? N : o
        }

        function G(t, n) {
            return function (e) {
                var r = au.event;
                au.event = e, n[0] = this.__data__;
                try {
                    t.apply(this, n)
                } finally {
                    au.event = r
                }
            }
        }

        function K(t, n) {
            var e = G(t, n);
            return function (t) {
                var n = this, r = t.relatedTarget;
                r && (r === n || 8 & r.compareDocumentPosition(n)) || e.call(n, t)
            }
        }

        function tt(t) {
            var n = ".dragsuppress-" + ++Ru, e = "click" + n, r = au.select(u(t)).on("touchmove" + n, C).on("dragstart" + n, C).on("selectstart" + n, C);
            if (null == Tu && (Tu = "onselectstart"in t ? !1 : S(t.style, "userSelect")), Tu) {
                var i = o(t).style, a = i[Tu];
                i[Tu] = "none"
            }
            return function (t) {
                if (r.on(n, null), Tu && (i[Tu] = a), t) {
                    var o = function () {
                        r.on(e, null)
                    };
                    r.on(e, function () {
                        C(), o()
                    }, !0), setTimeout(o, 0)
                }
            }
        }

        function nt(t, n) {
            n.changedTouches && (n = n.changedTouches[0]);
            var e = t.ownerSVGElement || t;
            if (e.createSVGPoint) {
                var r = e.createSVGPoint();
                if (0 > qu) {
                    var i = u(t);
                    if (i.scrollX || i.scrollY) {
                        e = au.select("body").append("svg").style({
                            position: "absolute",
                            top: 0,
                            left: 0,
                            margin: 0,
                            padding: 0,
                            border: "none"
                        }, "important");
                        var o = e[0][0].getScreenCTM();
                        qu = !(o.f || o.e), e.remove()
                    }
                }
                return qu ? (r.x = n.pageX, r.y = n.pageY) : (r.x = n.clientX, r.y = n.clientY), r = r.matrixTransform(t.getScreenCTM().inverse()), [r.x, r.y]
            }
            var a = t.getBoundingClientRect();
            return [n.clientX - a.left - t.clientLeft, n.clientY - a.top - t.clientTop]
        }

        function et() {
            return au.event.changedTouches[0].identifier
        }

        function rt(t) {
            return t > 0 ? 1 : 0 > t ? -1 : 0
        }

        function it(t, n, e) {
            return (n[0] - t[0]) * (e[1] - t[1]) - (n[1] - t[1]) * (e[0] - t[0])
        }

        function ot(t) {
            return t > 1 ? 0 : -1 > t ? Uu : Math.acos(t)
        }

        function ut(t) {
            return t > 1 ? Hu : -1 > t ? -Hu : Math.asin(t)
        }

        function at(t) {
            return ((t = Math.exp(t)) - 1 / t) / 2
        }

        function st(t) {
            return ((t = Math.exp(t)) + 1 / t) / 2
        }

        function lt(t) {
            return ((t = Math.exp(2 * t)) - 1) / (t + 1)
        }

        function ct(t) {
            return (t = Math.sin(t / 2)) * t
        }

        function ft() {
        }

        function ht(t, n, e) {
            return this instanceof ht ? (this.h = +t, this.s = +n, void(this.l = +e)) : arguments.length < 2 ? t instanceof ht ? new ht(t.h, t.s, t.l) : Nt("" + t, Et, ht) : new ht(t, n, e)
        }

        function gt(t, n, e) {
            function r(t) {
                return t > 360 ? t -= 360 : 0 > t && (t += 360), 60 > t ? o + (u - o) * t / 60 : 180 > t ? u : 240 > t ? o + (u - o) * (240 - t) / 60 : o
            }

            function i(t) {
                return Math.round(255 * r(t))
            }

            var o, u;
            return t = isNaN(t) ? 0 : (t %= 360) < 0 ? t + 360 : t, n = isNaN(n) ? 0 : 0 > n ? 0 : n > 1 ? 1 : n, e = 0 > e ? 0 : e > 1 ? 1 : e, u = .5 >= e ? e * (1 + n) : e + n - e * n, o = 2 * e - u, new wt(i(t + 120), i(t), i(t - 120))
        }

        function pt(t, n, e) {
            return this instanceof pt ? (this.h = +t, this.c = +n, void(this.l = +e)) : arguments.length < 2 ? t instanceof pt ? new pt(t.h, t.c, t.l) : t instanceof vt ? yt(t.l, t.a, t.b) : yt((t = At((t = au.rgb(t)).r, t.g, t.b)).l, t.a, t.b) : new pt(t, n, e)
        }

        function dt(t, n, e) {
            return isNaN(t) && (t = 0), isNaN(n) && (n = 0), new vt(e, Math.cos(t *= Bu) * n, Math.sin(t) * n)
        }

        function vt(t, n, e) {
            return this instanceof vt ? (this.l = +t, this.a = +n, void(this.b = +e)) : arguments.length < 2 ? t instanceof vt ? new vt(t.l, t.a, t.b) : t instanceof pt ? dt(t.h, t.c, t.l) : At((t = wt(t)).r, t.g, t.b) : new vt(t, n, e)
        }

        function mt(t, n, e) {
            var r = (t + 16) / 116, i = r + n / 500, o = r - e / 200;
            return i = xt(i) * Gu, r = xt(r) * Ku, o = xt(o) * ta, new wt(Mt(3.2404542 * i - 1.5371385 * r - .4985314 * o), Mt(-.969266 * i + 1.8760108 * r + .041556 * o), Mt(.0556434 * i - .2040259 * r + 1.0572252 * o))
        }

        function yt(t, n, e) {
            return t > 0 ? new pt(Math.atan2(e, n) * Fu, Math.sqrt(n * n + e * e), t) : new pt(NaN, NaN, t)
        }

        function xt(t) {
            return t > .206893034 ? t * t * t : (t - 4 / 29) / 7.787037
        }

        function bt(t) {
            return t > .008856 ? Math.pow(t, 1 / 3) : 7.787037 * t + 4 / 29
        }

        function Mt(t) {
            return Math.round(255 * (.00304 >= t ? 12.92 * t : 1.055 * Math.pow(t, 1 / 2.4) - .055))
        }

        function wt(t, n, e) {
            return this instanceof wt ? (this.r = ~~t, this.g = ~~n, void(this.b = ~~e)) : arguments.length < 2 ? t instanceof wt ? new wt(t.r, t.g, t.b) : Nt("" + t, wt, gt) : new wt(t, n, e)
        }

        function _t(t) {
            return new wt(t >> 16, t >> 8 & 255, 255 & t)
        }

        function kt(t) {
            return _t(t) + ""
        }

        function St(t) {
            return 16 > t ? "0" + Math.max(0, t).toString(16) : Math.min(255, t).toString(16)
        }

        function Nt(t, n, e) {
            t = t.toLowerCase();
            var r, i, o, u = 0, a = 0, s = 0;
            if (r = /([a-z]+)\((.*)\)/.exec(t))switch (i = r[2].split(","), r[1]) {
                case"hsl":
                    return e(parseFloat(i[0]), parseFloat(i[1]) / 100, parseFloat(i[2]) / 100);
                case"rgb":
                    return n(zt(i[0]), zt(i[1]), zt(i[2]))
            }
            return (o = ra.get(t)) ? n(o.r, o.g, o.b) : (null == t || "#" !== t.charAt(0) || isNaN(o = parseInt(t.slice(1), 16)) || (4 === t.length ? (u = (3840 & o) >> 4, u = u >> 4 | u, a = 240 & o, a = a >> 4 | a, s = 15 & o, s = s << 4 | s) : 7 === t.length && (u = (16711680 & o) >> 16, a = (65280 & o) >> 8, s = 255 & o)), n(u, a, s))
        }

        function Et(t, n, e) {
            var r, i, o = Math.min(t /= 255, n /= 255, e /= 255), u = Math.max(t, n, e), a = u - o, s = (u + o) / 2;
            return a ? (i = .5 > s ? a / (u + o) : a / (2 - u - o), r = t == u ? (n - e) / a + (e > n ? 6 : 0) : n == u ? (e - t) / a + 2 : (t - n) / a + 4, r *= 60) : (r = NaN, i = s > 0 && 1 > s ? 0 : r), new ht(r, i, s)
        }

        function At(t, n, e) {
            t = Ct(t), n = Ct(n), e = Ct(e);
            var r = bt((.4124564 * t + .3575761 * n + .1804375 * e) / Gu), i = bt((.2126729 * t + .7151522 * n + .072175 * e) / Ku), o = bt((.0193339 * t + .119192 * n + .9503041 * e) / ta);
            return vt(116 * i - 16, 500 * (r - i), 200 * (i - o))
        }

        function Ct(t) {
            return (t /= 255) <= .04045 ? t / 12.92 : Math.pow((t + .055) / 1.055, 2.4)
        }

        function zt(t) {
            var n = parseFloat(t);
            return "%" === t.charAt(t.length - 1) ? Math.round(2.55 * n) : n
        }

        function Lt(t) {
            return "function" == typeof t ? t : function () {
                return t
            }
        }

        function Tt(t) {
            return function (n, e, r) {
                return 2 === arguments.length && "function" == typeof e && (r = e, e = null), Rt(n, e, t, r)
            }
        }

        function Rt(t, n, e, r) {
            function i() {
                var t, n = s.status;
                if (!n && Dt(s) || n >= 200 && 300 > n || 304 === n) {
                    try {
                        t = e.call(o, s)
                    } catch (r) {
                        return void u.error.call(o, r)
                    }
                    u.load.call(o, t)
                } else u.error.call(o, s)
            }

            var o = {}, u = au.dispatch("beforesend", "progress", "load", "error"), a = {}, s = new XMLHttpRequest, l = null;
            return !this.XDomainRequest || "withCredentials"in s || !/^(http(s)?:)?\/\//.test(t) || (s = new XDomainRequest), "onload"in s ? s.onload = s.onerror = i : s.onreadystatechange = function () {
                s.readyState > 3 && i()
            }, s.onprogress = function (t) {
                var n = au.event;
                au.event = t;
                try {
                    u.progress.call(o, s)
                } finally {
                    au.event = n
                }
            }, o.header = function (t, n) {
                return t = (t + "").toLowerCase(), arguments.length < 2 ? a[t] : (null == n ? delete a[t] : a[t] = n + "", o)
            }, o.mimeType = function (t) {
                return arguments.length ? (n = null == t ? null : t + "", o) : n
            }, o.responseType = function (t) {
                return arguments.length ? (l = t, o) : l
            }, o.response = function (t) {
                return e = t, o
            }, ["get", "post"].forEach(function (t) {
                o[t] = function () {
                    return o.send.apply(o, [t].concat(lu(arguments)))
                }
            }), o.send = function (e, r, i) {
                if (2 === arguments.length && "function" == typeof r && (i = r, r = null), s.open(e, t, !0), null == n || "accept"in a || (a.accept = n + ",*/*"), s.setRequestHeader)for (var c in a)s.setRequestHeader(c, a[c]);
                return null != n && s.overrideMimeType && s.overrideMimeType(n), null != l && (s.responseType = l), null != i && o.on("error", i).on("load", function (t) {
                    i(null, t)
                }), u.beforesend.call(o, s), s.send(null == r ? null : r), o
            }, o.abort = function () {
                return s.abort(), o
            }, au.rebind(o, u, "on"), null == r ? o : o.get(qt(r))
        }

        function qt(t) {
            return 1 === t.length ? function (n, e) {
                t(null == n ? e : null)
            } : t
        }

        function Dt(t) {
            var n = t.responseType;
            return n && "text" !== n ? t.response : t.responseText
        }

        function Pt() {
            var t = Ut(), n = jt() - t;
            n > 24 ? (isFinite(n) && (clearTimeout(aa), aa = setTimeout(Pt, n)), ua = 0) : (ua = 1, la(Pt))
        }

        function Ut() {
            var t = Date.now();
            for (sa = ia; sa;)t >= sa.t && (sa.f = sa.c(t - sa.t)), sa = sa.n;
            return t
        }

        function jt() {
            for (var t, n = ia, e = 1 / 0; n;)n.f ? n = t ? t.n = n.n : ia = n.n : (n.t < e && (e = n.t), n = (t = n).n);
            return oa = t, e
        }

        function Ot(t, n) {
            return n - (t ? Math.ceil(Math.log(t) / Math.LN10) : 1)
        }

        function Ht(t, n) {
            var e = Math.pow(10, 3 * xu(8 - n));
            return {
                scale: n > 8 ? function (t) {
                    return t / e
                } : function (t) {
                    return t * e
                }, symbol: t
            }
        }

        function Bt(t) {
            var n = t.decimal, e = t.thousands, r = t.grouping, i = t.currency, o = r && e ? function (t, n) {
                for (var i = t.length, o = [], u = 0, a = r[0], s = 0; i > 0 && a > 0 && (s + a + 1 > n && (a = Math.max(1, n - s)), o.push(t.substring(i -= a, i + a)), !((s += a + 1) > n));)a = r[u = (u + 1) % r.length];
                return o.reverse().join(e)
            } : _;
            return function (t) {
                var e = fa.exec(t), r = e[1] || " ", u = e[2] || ">", a = e[3] || "-", s = e[4] || "", l = e[5], c = +e[6], f = e[7], h = e[8], g = e[9], p = 1, d = "", v = "", m = !1, y = !0;
                switch (h && (h = +h.substring(1)), (l || "0" === r && "=" === u) && (l = r = "0", u = "="), g) {
                    case"n":
                        f = !0, g = "g";
                        break;
                    case"%":
                        p = 100, v = "%", g = "f";
                        break;
                    case"p":
                        p = 100, v = "%", g = "r";
                        break;
                    case"b":
                    case"o":
                    case"x":
                    case"X":
                        "#" === s && (d = "0" + g.toLowerCase());
                    case"c":
                        y = !1;
                    case"d":
                        m = !0, h = 0;
                        break;
                    case"s":
                        p = -1, g = "r"
                }
                "$" === s && (d = i[0], v = i[1]), "r" != g || h || (g = "g"), null != h && ("g" == g ? h = Math.max(1, Math.min(21, h)) : ("e" == g || "f" == g) && (h = Math.max(0, Math.min(20, h)))), g = ha.get(g) || Ft;
                var x = l && f;
                return function (t) {
                    var e = v;
                    if (m && t % 1)return "";
                    var i = 0 > t || 0 === t && 0 > 1 / t ? (t = -t, "-") : "-" === a ? "" : a;
                    if (0 > p) {
                        var s = au.formatPrefix(t, h);
                        t = s.scale(t), e = s.symbol + v
                    } else t *= p;
                    t = g(t, h);
                    var b, M, w = t.lastIndexOf(".");
                    if (0 > w) {
                        var _ = y ? t.lastIndexOf("e") : -1;
                        0 > _ ? (b = t, M = "") : (b = t.substring(0, _), M = t.substring(_))
                    } else b = t.substring(0, w), M = n + t.substring(w + 1);
                    !l && f && (b = o(b, 1 / 0));
                    var k = d.length + b.length + M.length + (x ? 0 : i.length), S = c > k ? new Array(k = c - k + 1).join(r) : "";
                    return x && (b = o(S + b, S.length ? c - M.length : 1 / 0)), i += d, t = b + M, ("<" === u ? i + t + S : ">" === u ? S + i + t : "^" === u ? S.substring(0, k >>= 1) + i + t + S.substring(k) : i + (x ? t : S + t)) + e
                }
            }
        }

        function Ft(t) {
            return t + ""
        }

        function Yt() {
            this._ = new Date(arguments.length > 1 ? Date.UTC.apply(this, arguments) : arguments[0])
        }

        function Xt(t, n, e) {
            function r(n) {
                var e = t(n), r = o(e, 1);
                return r - n > n - e ? e : r
            }

            function i(e) {
                return n(e = t(new pa(e - 1)), 1), e
            }

            function o(t, e) {
                return n(t = new pa(+t), e), t
            }

            function u(t, r, o) {
                var u = i(t), a = [];
                if (o > 1)for (; r > u;)e(u) % o || a.push(new Date(+u)), n(u, 1); else for (; r > u;)a.push(new Date(+u)), n(u, 1);
                return a
            }

            function a(t, n, e) {
                try {
                    pa = Yt;
                    var r = new Yt;
                    return r._ = t, u(r, n, e)
                } finally {
                    pa = Date
                }
            }

            t.floor = t, t.round = r, t.ceil = i, t.offset = o, t.range = u;
            var s = t.utc = It(t);
            return s.floor = s, s.round = It(r), s.ceil = It(i), s.offset = It(o), s.range = a, t
        }

        function It(t) {
            return function (n, e) {
                try {
                    pa = Yt;
                    var r = new Yt;
                    return r._ = n, t(r, e)._
                } finally {
                    pa = Date
                }
            }
        }

        function Zt(t) {
            function n(t) {
                function n(n) {
                    for (var e, i, o, u = [], a = -1, s = 0; ++a < r;)37 === t.charCodeAt(a) && (u.push(t.slice(s, a)), null != (i = va[e = t.charAt(++a)]) && (e = t.charAt(++a)), (o = A[e]) && (e = o(n, null == i ? "e" === e ? " " : "0" : i)), u.push(e), s = a + 1);
                    return u.push(t.slice(s, a)), u.join("")
                }

                var r = t.length;
                return n.parse = function (n) {
                    var r = {y: 1900, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0, Z: null}, i = e(r, t, n, 0);
                    if (i != n.length)return null;
                    "p"in r && (r.H = r.H % 12 + 12 * r.p);
                    var o = null != r.Z && pa !== Yt, u = new (o ? Yt : pa);
                    return "j"in r ? u.setFullYear(r.y, 0, r.j) : "w"in r && ("W"in r || "U"in r) ? (u.setFullYear(r.y, 0, 1), u.setFullYear(r.y, 0, "W"in r ? (r.w + 6) % 7 + 7 * r.W - (u.getDay() + 5) % 7 : r.w + 7 * r.U - (u.getDay() + 6) % 7)) : u.setFullYear(r.y, r.m, r.d), u.setHours(r.H + (r.Z / 100 | 0), r.M + r.Z % 100, r.S, r.L), o ? u._ : u
                }, n.toString = function () {
                    return t
                }, n
            }

            function e(t, n, e, r) {
                for (var i, o, u, a = 0, s = n.length, l = e.length; s > a;) {
                    if (r >= l)return -1;
                    if (i = n.charCodeAt(a++), 37 === i) {
                        if (u = n.charAt(a++), o = C[u in va ? n.charAt(a++) : u], !o || (r = o(t, e, r)) < 0)return -1
                    } else if (i != e.charCodeAt(r++))return -1
                }
                return r
            }

            function r(t, n, e) {
                w.lastIndex = 0;
                var r = w.exec(n.slice(e));
                return r ? (t.w = _.get(r[0].toLowerCase()), e + r[0].length) : -1
            }

            function i(t, n, e) {
                b.lastIndex = 0;
                var r = b.exec(n.slice(e));
                return r ? (t.w = M.get(r[0].toLowerCase()), e + r[0].length) : -1
            }

            function o(t, n, e) {
                N.lastIndex = 0;
                var r = N.exec(n.slice(e));
                return r ? (t.m = E.get(r[0].toLowerCase()), e + r[0].length) : -1
            }

            function u(t, n, e) {
                k.lastIndex = 0;
                var r = k.exec(n.slice(e));
                return r ? (t.m = S.get(r[0].toLowerCase()), e + r[0].length) : -1
            }

            function a(t, n, r) {
                return e(t, A.c.toString(), n, r)
            }

            function s(t, n, r) {
                return e(t, A.x.toString(), n, r)
            }

            function l(t, n, r) {
                return e(t, A.X.toString(), n, r)
            }

            function c(t, n, e) {
                var r = x.get(n.slice(e, e += 2).toLowerCase());
                return null == r ? -1 : (t.p = r, e)
            }

            var f = t.dateTime, h = t.date, g = t.time, p = t.periods, d = t.days, v = t.shortDays, m = t.months, y = t.shortMonths;
            n.utc = function (t) {
                function e(t) {
                    try {
                        pa = Yt;
                        var n = new pa;
                        return n._ = t, r(n)
                    } finally {
                        pa = Date
                    }
                }

                var r = n(t);
                return e.parse = function (t) {
                    try {
                        pa = Yt;
                        var n = r.parse(t);
                        return n && n._
                    } finally {
                        pa = Date
                    }
                }, e.toString = r.toString, e
            }, n.multi = n.utc.multi = gn;
            var x = au.map(), b = Vt(d), M = $t(d), w = Vt(v), _ = $t(v), k = Vt(m), S = $t(m), N = Vt(y), E = $t(y);
            p.forEach(function (t, n) {
                x.set(t.toLowerCase(), n)
            });
            var A = {
                a: function (t) {
                    return v[t.getDay()]
                }, A: function (t) {
                    return d[t.getDay()]
                }, b: function (t) {
                    return y[t.getMonth()]
                }, B: function (t) {
                    return m[t.getMonth()]
                }, c: n(f), d: function (t, n) {
                    return Jt(t.getDate(), n, 2)
                }, e: function (t, n) {
                    return Jt(t.getDate(), n, 2)
                }, H: function (t, n) {
                    return Jt(t.getHours(), n, 2)
                }, I: function (t, n) {
                    return Jt(t.getHours() % 12 || 12, n, 2)
                }, j: function (t, n) {
                    return Jt(1 + ga.dayOfYear(t), n, 3)
                }, L: function (t, n) {
                    return Jt(t.getMilliseconds(), n, 3)
                }, m: function (t, n) {
                    return Jt(t.getMonth() + 1, n, 2)
                }, M: function (t, n) {
                    return Jt(t.getMinutes(), n, 2)
                }, p: function (t) {
                    return p[+(t.getHours() >= 12)]
                }, S: function (t, n) {
                    return Jt(t.getSeconds(), n, 2)
                }, U: function (t, n) {
                    return Jt(ga.sundayOfYear(t), n, 2)
                }, w: function (t) {
                    return t.getDay()
                }, W: function (t, n) {
                    return Jt(ga.mondayOfYear(t), n, 2)
                }, x: n(h), X: n(g), y: function (t, n) {
                    return Jt(t.getFullYear() % 100, n, 2)
                }, Y: function (t, n) {
                    return Jt(t.getFullYear() % 1e4, n, 4)
                }, Z: fn, "%": function () {
                    return "%"
                }
            }, C = {
                a: r,
                A: i,
                b: o,
                B: u,
                c: a,
                d: on,
                e: on,
                H: an,
                I: an,
                j: un,
                L: cn,
                m: rn,
                M: sn,
                p: c,
                S: ln,
                U: Wt,
                w: Qt,
                W: Gt,
                x: s,
                X: l,
                y: tn,
                Y: Kt,
                Z: nn,
                "%": hn
            };
            return n
        }

        function Jt(t, n, e) {
            var r = 0 > t ? "-" : "", i = (r ? -t : t) + "", o = i.length;
            return r + (e > o ? new Array(e - o + 1).join(n) + i : i)
        }

        function Vt(t) {
            return new RegExp("^(?:" + t.map(au.requote).join("|") + ")", "i")
        }

        function $t(t) {
            for (var n = new p, e = -1, r = t.length; ++e < r;)n.set(t[e].toLowerCase(), e);
            return n
        }

        function Qt(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 1));
            return r ? (t.w = +r[0], e + r[0].length) : -1
        }

        function Wt(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e));
            return r ? (t.U = +r[0], e + r[0].length) : -1
        }

        function Gt(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e));
            return r ? (t.W = +r[0], e + r[0].length) : -1
        }

        function Kt(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 4));
            return r ? (t.y = +r[0], e + r[0].length) : -1
        }

        function tn(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 2));
            return r ? (t.y = en(+r[0]), e + r[0].length) : -1
        }

        function nn(t, n, e) {
            return /^[+-]\d{4}$/.test(n = n.slice(e, e + 5)) ? (t.Z = -n, e + 5) : -1
        }

        function en(t) {
            return t + (t > 68 ? 1900 : 2e3)
        }

        function rn(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 2));
            return r ? (t.m = r[0] - 1, e + r[0].length) : -1
        }

        function on(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 2));
            return r ? (t.d = +r[0], e + r[0].length) : -1
        }

        function un(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 3));
            return r ? (t.j = +r[0], e + r[0].length) : -1
        }

        function an(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 2));
            return r ? (t.H = +r[0], e + r[0].length) : -1
        }

        function sn(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 2));
            return r ? (t.M = +r[0], e + r[0].length) : -1
        }

        function ln(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 2));
            return r ? (t.S = +r[0], e + r[0].length) : -1
        }

        function cn(t, n, e) {
            ma.lastIndex = 0;
            var r = ma.exec(n.slice(e, e + 3));
            return r ? (t.L = +r[0], e + r[0].length) : -1
        }

        function fn(t) {
            var n = t.getTimezoneOffset(), e = n > 0 ? "-" : "+", r = xu(n) / 60 | 0, i = xu(n) % 60;
            return e + Jt(r, "0", 2) + Jt(i, "0", 2)
        }

        function hn(t, n, e) {
            ya.lastIndex = 0;
            var r = ya.exec(n.slice(e, e + 1));
            return r ? e + r[0].length : -1
        }

        function gn(t) {
            for (var n = t.length, e = -1; ++e < n;)t[e][0] = this(t[e][0]);
            return function (n) {
                for (var e = 0, r = t[e]; !r[1](n);)r = t[++e];
                return r[0](n)
            }
        }

        function pn() {
        }

        function dn(t, n, e) {
            var r = e.s = t + n, i = r - t, o = r - i;
            e.t = t - o + (n - i)
        }

        function vn(t, n) {
            t && wa.hasOwnProperty(t.type) && wa[t.type](t, n)
        }

        function mn(t, n, e) {
            var r, i = -1, o = t.length - e;
            for (n.lineStart(); ++i < o;)r = t[i], n.point(r[0], r[1], r[2]);
            n.lineEnd()
        }

        function yn(t, n) {
            var e = -1, r = t.length;
            for (n.polygonStart(); ++e < r;)mn(t[e], n, 1);
            n.polygonEnd()
        }

        function xn() {
            function t(t, n) {
                t *= Bu, n = n * Bu / 2 + Uu / 4;
                var e = t - r, u = e >= 0 ? 1 : -1, a = u * e, s = Math.cos(n), l = Math.sin(n), c = o * l, f = i * s + c * Math.cos(a), h = c * u * Math.sin(a);
                ka.add(Math.atan2(h, f)), r = t, i = s, o = l
            }

            var n, e, r, i, o;
            Sa.point = function (u, a) {
                Sa.point = t, r = (n = u) * Bu, i = Math.cos(a = (e = a) * Bu / 2 + Uu / 4), o = Math.sin(a)
            }, Sa.lineEnd = function () {
                t(n, e)
            }
        }

        function bn(t) {
            var n = t[0], e = t[1], r = Math.cos(e);
            return [r * Math.cos(n), r * Math.sin(n), Math.sin(e)]
        }

        function Mn(t, n) {
            return t[0] * n[0] + t[1] * n[1] + t[2] * n[2]
        }

        function wn(t, n) {
            return [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]]
        }

        function _n(t, n) {
            t[0] += n[0], t[1] += n[1], t[2] += n[2]
        }

        function kn(t, n) {
            return [t[0] * n, t[1] * n, t[2] * n]
        }

        function Sn(t) {
            var n = Math.sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2]);
            t[0] /= n, t[1] /= n, t[2] /= n
        }

        function Nn(t) {
            return [Math.atan2(t[1], t[0]), ut(t[2])]
        }

        function En(t, n) {
            return xu(t[0] - n[0]) < Du && xu(t[1] - n[1]) < Du
        }

        function An(t, n) {
            t *= Bu;
            var e = Math.cos(n *= Bu);
            Cn(e * Math.cos(t), e * Math.sin(t), Math.sin(n))
        }

        function Cn(t, n, e) {
            ++Na, Aa += (t - Aa) / Na, Ca += (n - Ca) / Na, za += (e - za) / Na
        }

        function zn() {
            function t(t, i) {
                t *= Bu;
                var o = Math.cos(i *= Bu), u = o * Math.cos(t), a = o * Math.sin(t), s = Math.sin(i), l = Math.atan2(Math.sqrt((l = e * s - r * a) * l + (l = r * u - n * s) * l + (l = n * a - e * u) * l), n * u + e * a + r * s);
                Ea += l, La += l * (n + (n = u)), Ta += l * (e + (e = a)), Ra += l * (r + (r = s)), Cn(n, e, r)
            }

            var n, e, r;
            Ua.point = function (i, o) {
                i *= Bu;
                var u = Math.cos(o *= Bu);
                n = u * Math.cos(i), e = u * Math.sin(i), r = Math.sin(o), Ua.point = t, Cn(n, e, r)
            }
        }

        function Ln() {
            Ua.point = An
        }

        function Tn() {
            function t(t, n) {
                t *= Bu;
                var e = Math.cos(n *= Bu), u = e * Math.cos(t), a = e * Math.sin(t), s = Math.sin(n), l = i * s - o * a, c = o * u - r * s, f = r * a - i * u, h = Math.sqrt(l * l + c * c + f * f), g = r * u + i * a + o * s, p = h && -ot(g) / h, d = Math.atan2(h, g);
                qa += p * l, Da += p * c, Pa += p * f, Ea += d, La += d * (r + (r = u)), Ta += d * (i + (i = a)), Ra += d * (o + (o = s)), Cn(r, i, o)
            }

            var n, e, r, i, o;
            Ua.point = function (u, a) {
                n = u, e = a, Ua.point = t, u *= Bu;
                var s = Math.cos(a *= Bu);
                r = s * Math.cos(u), i = s * Math.sin(u), o = Math.sin(a), Cn(r, i, o)
            }, Ua.lineEnd = function () {
                t(n, e), Ua.lineEnd = Ln, Ua.point = An
            }
        }

        function Rn(t, n) {
            function e(e, r) {
                return e = t(e, r), n(e[0], e[1])
            }

            return t.invert && n.invert && (e.invert = function (e, r) {
                return e = n.invert(e, r), e && t.invert(e[0], e[1])
            }), e
        }

        function qn() {
            return !0
        }

        function Dn(t, n, e, r, i) {
            var o = [], u = [];
            if (t.forEach(function (t) {
                    if (!((n = t.length - 1) <= 0)) {
                        var n, e = t[0], r = t[n];
                        if (En(e, r)) {
                            i.lineStart();
                            for (var a = 0; n > a; ++a)i.point((e = t[a])[0], e[1]);
                            return void i.lineEnd()
                        }
                        var s = new Un(e, t, null, !0), l = new Un(e, null, s, !1);
                        s.o = l, o.push(s), u.push(l), s = new Un(r, t, null, !1), l = new Un(r, null, s, !0), s.o = l, o.push(s), u.push(l)
                    }
                }), u.sort(n), Pn(o), Pn(u), o.length) {
                for (var a = 0, s = e, l = u.length; l > a; ++a)u[a].e = s = !s;
                for (var c, f, h = o[0]; ;) {
                    for (var g = h, p = !0; g.v;)if ((g = g.n) === h)return;
                    c = g.z, i.lineStart();
                    do {
                        if (g.v = g.o.v = !0, g.e) {
                            if (p)for (var a = 0, l = c.length; l > a; ++a)i.point((f = c[a])[0], f[1]); else r(g.x, g.n.x, 1, i);
                            g = g.n
                        } else {
                            if (p) {
                                c = g.p.z;
                                for (var a = c.length - 1; a >= 0; --a)i.point((f = c[a])[0], f[1])
                            } else r(g.x, g.p.x, -1, i);
                            g = g.p
                        }
                        g = g.o, c = g.z, p = !p
                    } while (!g.v);
                    i.lineEnd()
                }
            }
        }

        function Pn(t) {
            if (n = t.length) {
                for (var n, e, r = 0, i = t[0]; ++r < n;)i.n = e = t[r], e.p = i, i = e;
                i.n = e = t[0], e.p = i
            }
        }

        function Un(t, n, e, r) {
            this.x = t, this.z = n, this.o = e, this.e = r, this.v = !1, this.n = this.p = null
        }

        function jn(t, n, e, r) {
            return function (i, o) {
                function u(n, e) {
                    var r = i(n, e);
                    t(n = r[0], e = r[1]) && o.point(n, e)
                }

                function a(t, n) {
                    var e = i(t, n);
                    v.point(e[0], e[1])
                }

                function s() {
                    y.point = a, v.lineStart()
                }

                function l() {
                    y.point = u, v.lineEnd()
                }

                function c(t, n) {
                    d.push([t, n]);
                    var e = i(t, n);
                    b.point(e[0], e[1])
                }

                function f() {
                    b.lineStart(), d = []
                }

                function h() {
                    c(d[0][0], d[0][1]), b.lineEnd();
                    var t, n = b.clean(), e = x.buffer(), r = e.length;
                    if (d.pop(), p.push(d), d = null, r)if (1 & n) {
                        t = e[0];
                        var i, r = t.length - 1, u = -1;
                        if (r > 0) {
                            for (M || (o.polygonStart(), M = !0), o.lineStart(); ++u < r;)o.point((i = t[u])[0], i[1]);
                            o.lineEnd()
                        }
                    } else r > 1 && 2 & n && e.push(e.pop().concat(e.shift())), g.push(e.filter(On))
                }

                var g, p, d, v = n(o), m = i.invert(r[0], r[1]), y = {
                    point: u,
                    lineStart: s,
                    lineEnd: l,
                    polygonStart: function () {
                        y.point = c, y.lineStart = f, y.lineEnd = h, g = [], p = []
                    },
                    polygonEnd: function () {
                        y.point = u, y.lineStart = s, y.lineEnd = l, g = au.merge(g);
                        var t = In(m, p);
                        g.length ? (M || (o.polygonStart(), M = !0), Dn(g, Bn, t, e, o)) : t && (M || (o.polygonStart(), M = !0), o.lineStart(), e(null, null, 1, o), o.lineEnd()), M && (o.polygonEnd(), M = !1), g = p = null
                    },
                    sphere: function () {
                        o.polygonStart(), o.lineStart(), e(null, null, 1, o), o.lineEnd(), o.polygonEnd()
                    }
                }, x = Hn(), b = n(x), M = !1;
                return y
            }
        }

        function On(t) {
            return t.length > 1
        }

        function Hn() {
            var t, n = [];
            return {
                lineStart: function () {
                    n.push(t = [])
                }, point: function (n, e) {
                    t.push([n, e])
                }, lineEnd: N, buffer: function () {
                    var e = n;
                    return n = [], t = null, e
                }, rejoin: function () {
                    n.length > 1 && n.push(n.pop().concat(n.shift()))
                }
            }
        }

        function Bn(t, n) {
            return ((t = t.x)[0] < 0 ? t[1] - Hu - Du : Hu - t[1]) - ((n = n.x)[0] < 0 ? n[1] - Hu - Du : Hu - n[1])
        }

        function Fn(t) {
            var n, e = NaN, r = NaN, i = NaN;
            return {
                lineStart: function () {
                    t.lineStart(), n = 1
                }, point: function (o, u) {
                    var a = o > 0 ? Uu : -Uu, s = xu(o - e);
                    xu(s - Uu) < Du ? (t.point(e, r = (r + u) / 2 > 0 ? Hu : -Hu), t.point(i, r), t.lineEnd(), t.lineStart(), t.point(a, r), t.point(o, r), n = 0) : i !== a && s >= Uu && (xu(e - i) < Du && (e -= i * Du), xu(o - a) < Du && (o -= a * Du), r = Yn(e, r, o, u), t.point(i, r), t.lineEnd(), t.lineStart(), t.point(a, r), n = 0), t.point(e = o, r = u), i = a
                }, lineEnd: function () {
                    t.lineEnd(), e = r = NaN
                }, clean: function () {
                    return 2 - n
                }
            }
        }

        function Yn(t, n, e, r) {
            var i, o, u = Math.sin(t - e);
            return xu(u) > Du ? Math.atan((Math.sin(n) * (o = Math.cos(r)) * Math.sin(e) - Math.sin(r) * (i = Math.cos(n)) * Math.sin(t)) / (i * o * u)) : (n + r) / 2
        }

        function Xn(t, n, e, r) {
            var i;
            if (null == t)i = e * Hu, r.point(-Uu, i), r.point(0, i), r.point(Uu, i), r.point(Uu, 0), r.point(Uu, -i), r.point(0, -i), r.point(-Uu, -i), r.point(-Uu, 0), r.point(-Uu, i); else if (xu(t[0] - n[0]) > Du) {
                var o = t[0] < n[0] ? Uu : -Uu;
                i = e * o / 2, r.point(-o, i), r.point(0, i), r.point(o, i)
            } else r.point(n[0], n[1])
        }

        function In(t, n) {
            var e = t[0], r = t[1], i = [Math.sin(e), -Math.cos(e), 0], o = 0, u = 0;
            ka.reset();
            for (var a = 0, s = n.length; s > a; ++a) {
                var l = n[a], c = l.length;
                if (c)for (var f = l[0], h = f[0], g = f[1] / 2 + Uu / 4, p = Math.sin(g), d = Math.cos(g), v = 1; ;) {
                    v === c && (v = 0), t = l[v];
                    var m = t[0], y = t[1] / 2 + Uu / 4, x = Math.sin(y), b = Math.cos(y), M = m - h, w = M >= 0 ? 1 : -1, _ = w * M, k = _ > Uu, S = p * x;
                    if (ka.add(Math.atan2(S * w * Math.sin(_), d * b + S * Math.cos(_))), o += k ? M + w * ju : M, k ^ h >= e ^ m >= e) {
                        var N = wn(bn(f), bn(t));
                        Sn(N);
                        var E = wn(i, N);
                        Sn(E);
                        var A = (k ^ M >= 0 ? -1 : 1) * ut(E[2]);
                        (r > A || r === A && (N[0] || N[1])) && (u += k ^ M >= 0 ? 1 : -1)
                    }
                    if (!v++)break;
                    h = m, p = x, d = b, f = t
                }
            }
            return (-Du > o || Du > o && 0 > ka) ^ 1 & u
        }

        function Zn(t) {
            function n(t, n) {
                return Math.cos(t) * Math.cos(n) > o
            }

            function e(t) {
                var e, o, s, l, c;
                return {
                    lineStart: function () {
                        l = s = !1, c = 1
                    }, point: function (f, h) {
                        var g, p = [f, h], d = n(f, h), v = u ? d ? 0 : i(f, h) : d ? i(f + (0 > f ? Uu : -Uu), h) : 0;
                        if (!e && (l = s = d) && t.lineStart(), d !== s && (g = r(e, p), (En(e, g) || En(p, g)) && (p[0] += Du, p[1] += Du, d = n(p[0], p[1]))), d !== s)c = 0, d ? (t.lineStart(), g = r(p, e), t.point(g[0], g[1])) : (g = r(e, p), t.point(g[0], g[1]), t.lineEnd()), e = g; else if (a && e && u ^ d) {
                            var m;
                            v & o || !(m = r(p, e, !0)) || (c = 0, u ? (t.lineStart(), t.point(m[0][0], m[0][1]), t.point(m[1][0], m[1][1]), t.lineEnd()) : (t.point(m[1][0], m[1][1]), t.lineEnd(), t.lineStart(), t.point(m[0][0], m[0][1])))
                        }
                        !d || e && En(e, p) || t.point(p[0], p[1]), e = p, s = d, o = v
                    }, lineEnd: function () {
                        s && t.lineEnd(), e = null
                    }, clean: function () {
                        return c | (l && s) << 1
                    }
                }
            }

            function r(t, n, e) {
                var r = bn(t), i = bn(n), u = [1, 0, 0], a = wn(r, i), s = Mn(a, a), l = a[0], c = s - l * l;
                if (!c)return !e && t;
                var f = o * s / c, h = -o * l / c, g = wn(u, a), p = kn(u, f), d = kn(a, h);
                _n(p, d);
                var v = g, m = Mn(p, v), y = Mn(v, v), x = m * m - y * (Mn(p, p) - 1);
                if (!(0 > x)) {
                    var b = Math.sqrt(x), M = kn(v, (-m - b) / y);
                    if (_n(M, p), M = Nn(M), !e)return M;
                    var w, _ = t[0], k = n[0], S = t[1], N = n[1];
                    _ > k && (w = _, _ = k, k = w);
                    var E = k - _, A = xu(E - Uu) < Du, C = A || Du > E;
                    if (!A && S > N && (w = S, S = N, N = w), C ? A ? S + N > 0 ^ M[1] < (xu(M[0] - _) < Du ? S : N) : S <= M[1] && M[1] <= N : E > Uu ^ (_ <= M[0] && M[0] <= k)) {
                        var z = kn(v, (-m + b) / y);
                        return _n(z, p), [M, Nn(z)]
                    }
                }
            }

            function i(n, e) {
                var r = u ? t : Uu - t, i = 0;
                return -r > n ? i |= 1 : n > r && (i |= 2), -r > e ? i |= 4 : e > r && (i |= 8), i
            }

            var o = Math.cos(t), u = o > 0, a = xu(o) > Du, s = xe(t, 6 * Bu);
            return jn(n, e, s, u ? [0, -t] : [-Uu, t - Uu])
        }

        function Jn(t, n, e, r) {
            return function (i) {
                var o, u = i.a, a = i.b, s = u.x, l = u.y, c = a.x, f = a.y, h = 0, g = 1, p = c - s, d = f - l;
                if (o = t - s, p || !(o > 0)) {
                    if (o /= p, 0 > p) {
                        if (h > o)return;
                        g > o && (g = o)
                    } else if (p > 0) {
                        if (o > g)return;
                        o > h && (h = o)
                    }
                    if (o = e - s, p || !(0 > o)) {
                        if (o /= p, 0 > p) {
                            if (o > g)return;
                            o > h && (h = o)
                        } else if (p > 0) {
                            if (h > o)return;
                            g > o && (g = o)
                        }
                        if (o = n - l, d || !(o > 0)) {
                            if (o /= d, 0 > d) {
                                if (h > o)return;
                                g > o && (g = o)
                            } else if (d > 0) {
                                if (o > g)return;
                                o > h && (h = o)
                            }
                            if (o = r - l, d || !(0 > o)) {
                                if (o /= d, 0 > d) {
                                    if (o > g)return;
                                    o > h && (h = o)
                                } else if (d > 0) {
                                    if (h > o)return;
                                    g > o && (g = o)
                                }
                                return h > 0 && (i.a = {x: s + h * p, y: l + h * d}), 1 > g && (i.b = {
                                    x: s + g * p,
                                    y: l + g * d
                                }), i
                            }
                        }
                    }
                }
            }
        }

        function Vn(t, n, e, r) {
            function i(r, i) {
                return xu(r[0] - t) < Du ? i > 0 ? 0 : 3 : xu(r[0] - e) < Du ? i > 0 ? 2 : 1 : xu(r[1] - n) < Du ? i > 0 ? 1 : 0 : i > 0 ? 3 : 2
            }

            function o(t, n) {
                return u(t.x, n.x)
            }

            function u(t, n) {
                var e = i(t, 1), r = i(n, 1);
                return e !== r ? e - r : 0 === e ? n[1] - t[1] : 1 === e ? t[0] - n[0] : 2 === e ? t[1] - n[1] : n[0] - t[0]
            }

            return function (a) {
                function s(t) {
                    for (var n = 0, e = v.length, r = t[1], i = 0; e > i; ++i)for (var o, u = 1, a = v[i], s = a.length, l = a[0]; s > u; ++u)o = a[u], l[1] <= r ? o[1] > r && it(l, o, t) > 0 && ++n : o[1] <= r && it(l, o, t) < 0 && --n, l = o;
                    return 0 !== n
                }

                function l(o, a, s, l) {
                    var c = 0, f = 0;
                    if (null == o || (c = i(o, s)) !== (f = i(a, s)) || u(o, a) < 0 ^ s > 0) {
                        do l.point(0 === c || 3 === c ? t : e, c > 1 ? r : n); while ((c = (c + s + 4) % 4) !== f)
                    } else l.point(a[0], a[1])
                }

                function c(i, o) {
                    return i >= t && e >= i && o >= n && r >= o
                }

                function f(t, n) {
                    c(t, n) && a.point(t, n)
                }

                function h() {
                    C.point = p, v && v.push(m = []), k = !0, _ = !1, M = w = NaN
                }

                function g() {
                    d && (p(y, x), b && _ && E.rejoin(), d.push(E.buffer())), C.point = f, _ && a.lineEnd()
                }

                function p(t, n) {
                    t = Math.max(-Oa, Math.min(Oa, t)), n = Math.max(-Oa, Math.min(Oa, n));
                    var e = c(t, n);
                    if (v && m.push([t, n]), k)y = t, x = n, b = e, k = !1, e && (a.lineStart(), a.point(t, n)); else if (e && _)a.point(t, n); else {
                        var r = {a: {x: M, y: w}, b: {x: t, y: n}};
                        A(r) ? (_ || (a.lineStart(), a.point(r.a.x, r.a.y)), a.point(r.b.x, r.b.y), e || a.lineEnd(), S = !1) : e && (a.lineStart(), a.point(t, n), S = !1)
                    }
                    M = t, w = n, _ = e
                }

                var d, v, m, y, x, b, M, w, _, k, S, N = a, E = Hn(), A = Jn(t, n, e, r), C = {
                    point: f,
                    lineStart: h,
                    lineEnd: g,
                    polygonStart: function () {
                        a = E, d = [], v = [], S = !0
                    },
                    polygonEnd: function () {
                        a = N, d = au.merge(d);
                        var n = s([t, r]), e = S && n, i = d.length;
                        (e || i) && (a.polygonStart(), e && (a.lineStart(), l(null, null, 1, a), a.lineEnd()), i && Dn(d, o, n, l, a), a.polygonEnd()), d = v = m = null
                    }
                };
                return C
            }
        }

        function $n(t) {
            var n = 0, e = Uu / 3, r = fe(t), i = r(n, e);
            return i.parallels = function (t) {
                return arguments.length ? r(n = t[0] * Uu / 180, e = t[1] * Uu / 180) : [n / Uu * 180, e / Uu * 180]
            }, i
        }

        function Qn(t, n) {
            function e(t, n) {
                var e = Math.sqrt(o - 2 * i * Math.sin(n)) / i;
                return [e * Math.sin(t *= i), u - e * Math.cos(t)]
            }

            var r = Math.sin(t), i = (r + Math.sin(n)) / 2, o = 1 + r * (2 * i - r), u = Math.sqrt(o) / i;
            return e.invert = function (t, n) {
                var e = u - n;
                return [Math.atan2(t, e) / i, ut((o - (t * t + e * e) * i * i) / (2 * i))]
            }, e
        }

        function Wn() {
            function t(t, n) {
                Ba += i * t - r * n, r = t, i = n
            }

            var n, e, r, i;
            Za.point = function (o, u) {
                Za.point = t, n = r = o, e = i = u
            }, Za.lineEnd = function () {
                t(n, e)
            }
        }

        function Gn(t, n) {
            Fa > t && (Fa = t), t > Xa && (Xa = t), Ya > n && (Ya = n), n > Ia && (Ia = n)
        }

        function Kn() {
            function t(t, n) {
                u.push("M", t, ",", n, o)
            }

            function n(t, n) {
                u.push("M", t, ",", n), a.point = e
            }

            function e(t, n) {
                u.push("L", t, ",", n)
            }

            function r() {
                a.point = t
            }

            function i() {
                u.push("Z")
            }

            var o = te(4.5), u = [], a = {
                point: t, lineStart: function () {
                    a.point = n
                }, lineEnd: r, polygonStart: function () {
                    a.lineEnd = i
                }, polygonEnd: function () {
                    a.lineEnd = r, a.point = t
                }, pointRadius: function (t) {
                    return o = te(t), a
                }, result: function () {
                    if (u.length) {
                        var t = u.join("");
                        return u = [], t
                    }
                }
            };
            return a
        }

        function te(t) {
            return "m0," + t + "a" + t + "," + t + " 0 1,1 0," + -2 * t + "a" + t + "," + t + " 0 1,1 0," + 2 * t + "z"
        }

        function ne(t, n) {
            Aa += t, Ca += n, ++za
        }

        function ee() {
            function t(t, r) {
                var i = t - n, o = r - e, u = Math.sqrt(i * i + o * o);
                La += u * (n + t) / 2, Ta += u * (e + r) / 2, Ra += u, ne(n = t, e = r)
            }

            var n, e;
            Va.point = function (r, i) {
                Va.point = t, ne(n = r, e = i)
            }
        }

        function re() {
            Va.point = ne
        }

        function ie() {
            function t(t, n) {
                var e = t - r, o = n - i, u = Math.sqrt(e * e + o * o);
                La += u * (r + t) / 2, Ta += u * (i + n) / 2, Ra += u, u = i * t - r * n, qa += u * (r + t), Da += u * (i + n), Pa += 3 * u, ne(r = t, i = n)
            }

            var n, e, r, i;
            Va.point = function (o, u) {
                Va.point = t, ne(n = r = o, e = i = u)
            }, Va.lineEnd = function () {
                t(n, e)
            }
        }

        function oe(t) {
            function n(n, e) {
                t.moveTo(n + u, e), t.arc(n, e, u, 0, ju)
            }

            function e(n, e) {
                t.moveTo(n, e), a.point = r
            }

            function r(n, e) {
                t.lineTo(n, e)
            }

            function i() {
                a.point = n
            }

            function o() {
                t.closePath()
            }

            var u = 4.5, a = {
                point: n, lineStart: function () {
                    a.point = e
                }, lineEnd: i, polygonStart: function () {
                    a.lineEnd = o
                }, polygonEnd: function () {
                    a.lineEnd = i, a.point = n
                }, pointRadius: function (t) {
                    return u = t, a
                }, result: N
            };
            return a
        }

        function ue(t) {
            function n(t) {
                return (a ? r : e)(t)
            }

            function e(n) {
                return le(n, function (e, r) {
                    e = t(e, r), n.point(e[0], e[1])
                })
            }

            function r(n) {
                function e(e, r) {
                    e = t(e, r), n.point(e[0], e[1])
                }

                function r() {
                    x = NaN, k.point = o, n.lineStart()
                }

                function o(e, r) {
                    var o = bn([e, r]), u = t(e, r);
                    i(x, b, y, M, w, _, x = u[0], b = u[1], y = e, M = o[0], w = o[1], _ = o[2], a, n), n.point(x, b)
                }

                function u() {
                    k.point = e, n.lineEnd()
                }

                function s() {
                    r(), k.point = l, k.lineEnd = c
                }

                function l(t, n) {
                    o(f = t, h = n), g = x, p = b, d = M, v = w, m = _, k.point = o
                }

                function c() {
                    i(x, b, y, M, w, _, g, p, f, d, v, m, a, n), k.lineEnd = u, u()
                }

                var f, h, g, p, d, v, m, y, x, b, M, w, _, k = {
                    point: e,
                    lineStart: r,
                    lineEnd: u,
                    polygonStart: function () {
                        n.polygonStart(), k.lineStart = s
                    },
                    polygonEnd: function () {
                        n.polygonEnd(), k.lineStart = r
                    }
                };
                return k
            }

            function i(n, e, r, a, s, l, c, f, h, g, p, d, v, m) {
                var y = c - n, x = f - e, b = y * y + x * x;
                if (b > 4 * o && v--) {
                    var M = a + g, w = s + p, _ = l + d, k = Math.sqrt(M * M + w * w + _ * _), S = Math.asin(_ /= k), N = xu(xu(_) - 1) < Du || xu(r - h) < Du ? (r + h) / 2 : Math.atan2(w, M), E = t(N, S), A = E[0], C = E[1], z = A - n, L = C - e, T = x * z - y * L;
                    (T * T / b > o || xu((y * z + x * L) / b - .5) > .3 || u > a * g + s * p + l * d) && (i(n, e, r, a, s, l, A, C, N, M /= k, w /= k, _, v, m), m.point(A, C), i(A, C, N, M, w, _, c, f, h, g, p, d, v, m))
                }
            }

            var o = .5, u = Math.cos(30 * Bu), a = 16;
            return n.precision = function (t) {
                return arguments.length ? (a = (o = t * t) > 0 && 16, n) : Math.sqrt(o)
            }, n
        }

        function ae(t) {
            var n = ue(function (n, e) {
                return t([n * Fu, e * Fu])
            });
            return function (t) {
                return he(n(t))
            }
        }

        function se(t) {
            this.stream = t
        }

        function le(t, n) {
            return {
                point: n, sphere: function () {
                    t.sphere()
                }, lineStart: function () {
                    t.lineStart()
                }, lineEnd: function () {
                    t.lineEnd()
                }, polygonStart: function () {
                    t.polygonStart()
                }, polygonEnd: function () {
                    t.polygonEnd()
                }
            }
        }

        function ce(t) {
            return fe(function () {
                return t
            })()
        }

        function fe(t) {
            function n(t) {
                return t = a(t[0] * Bu, t[1] * Bu), [t[0] * h + s, l - t[1] * h]
            }

            function e(t) {
                return t = a.invert((t[0] - s) / h, (l - t[1]) / h), t && [t[0] * Fu, t[1] * Fu]
            }

            function r() {
                a = Rn(u = de(m, y, x), o);
                var t = o(d, v);
                return s = g - t[0] * h, l = p + t[1] * h, i()
            }

            function i() {
                return c && (c.valid = !1, c = null), n
            }

            var o, u, a, s, l, c, f = ue(function (t, n) {
                return t = o(t, n), [t[0] * h + s, l - t[1] * h]
            }), h = 150, g = 480, p = 250, d = 0, v = 0, m = 0, y = 0, x = 0, b = ja, M = _, w = null, k = null;
            return n.stream = function (t) {
                return c && (c.valid = !1), c = he(b(u, f(M(t)))), c.valid = !0, c
            }, n.clipAngle = function (t) {
                return arguments.length ? (b = null == t ? (w = t, ja) : Zn((w = +t) * Bu), i()) : w
            }, n.clipExtent = function (t) {
                return arguments.length ? (k = t, M = t ? Vn(t[0][0], t[0][1], t[1][0], t[1][1]) : _, i()) : k
            }, n.scale = function (t) {
                return arguments.length ? (h = +t, r()) : h
            }, n.translate = function (t) {
                return arguments.length ? (g = +t[0], p = +t[1], r()) : [g, p]
            }, n.center = function (t) {
                return arguments.length ? (d = t[0] % 360 * Bu, v = t[1] % 360 * Bu, r()) : [d * Fu, v * Fu]
            }, n.rotate = function (t) {
                return arguments.length ? (m = t[0] % 360 * Bu, y = t[1] % 360 * Bu, x = t.length > 2 ? t[2] % 360 * Bu : 0, r()) : [m * Fu, y * Fu, x * Fu]
            }, au.rebind(n, f, "precision"), function () {
                return o = t.apply(this, arguments), n.invert = o.invert && e, r()
            }
        }

        function he(t) {
            return le(t, function (n, e) {
                t.point(n * Bu, e * Bu)
            })
        }

        function ge(t, n) {
            return [t, n]
        }

        function pe(t, n) {
            return [t > Uu ? t - ju : -Uu > t ? t + ju : t, n]
        }

        function de(t, n, e) {
            return t ? n || e ? Rn(me(t), ye(n, e)) : me(t) : n || e ? ye(n, e) : pe
        }

        function ve(t) {
            return function (n, e) {
                return n += t, [n > Uu ? n - ju : -Uu > n ? n + ju : n, e]
            }
        }

        function me(t) {
            var n = ve(t);
            return n.invert = ve(-t), n
        }

        function ye(t, n) {
            function e(t, n) {
                var e = Math.cos(n), a = Math.cos(t) * e, s = Math.sin(t) * e, l = Math.sin(n), c = l * r + a * i;
                return [Math.atan2(s * o - c * u, a * r - l * i), ut(c * o + s * u)]
            }

            var r = Math.cos(t), i = Math.sin(t), o = Math.cos(n), u = Math.sin(n);
            return e.invert = function (t, n) {
                var e = Math.cos(n), a = Math.cos(t) * e, s = Math.sin(t) * e, l = Math.sin(n), c = l * o - s * u;
                return [Math.atan2(s * o + l * u, a * r + c * i), ut(c * r - a * i)]
            }, e
        }

        function xe(t, n) {
            var e = Math.cos(t), r = Math.sin(t);
            return function (i, o, u, a) {
                var s = u * n;
                null != i ? (i = be(e, i), o = be(e, o), (u > 0 ? o > i : i > o) && (i += u * ju)) : (i = t + u * ju, o = t - .5 * s);
                for (var l, c = i; u > 0 ? c > o : o > c; c -= s)a.point((l = Nn([e, -r * Math.cos(c), -r * Math.sin(c)]))[0], l[1])
            }
        }

        function be(t, n) {
            var e = bn(n);
            e[0] -= t, Sn(e);
            var r = ot(-e[1]);
            return ((-e[2] < 0 ? -r : r) + 2 * Math.PI - Du) % (2 * Math.PI)
        }

        function Me(t, n, e) {
            var r = au.range(t, n - Du, e).concat(n);
            return function (t) {
                return r.map(function (n) {
                    return [t, n]
                })
            }
        }

        function we(t, n, e) {
            var r = au.range(t, n - Du, e).concat(n);
            return function (t) {
                return r.map(function (n) {
                    return [n, t]
                })
            }
        }

        function _e(t) {
            return t.source
        }

        function ke(t) {
            return t.target
        }

        function Se(t, n, e, r) {
            var i = Math.cos(n), o = Math.sin(n), u = Math.cos(r), a = Math.sin(r), s = i * Math.cos(t), l = i * Math.sin(t), c = u * Math.cos(e), f = u * Math.sin(e), h = 2 * Math.asin(Math.sqrt(ct(r - n) + i * u * ct(e - t))), g = 1 / Math.sin(h), p = h ? function (t) {
                var n = Math.sin(t *= h) * g, e = Math.sin(h - t) * g, r = e * s + n * c, i = e * l + n * f, u = e * o + n * a;
                return [Math.atan2(i, r) * Fu, Math.atan2(u, Math.sqrt(r * r + i * i)) * Fu]
            } : function () {
                return [t * Fu, n * Fu]
            };
            return p.distance = h, p
        }

        function Ne() {
            function t(t, i) {
                var o = Math.sin(i *= Bu), u = Math.cos(i), a = xu((t *= Bu) - n), s = Math.cos(a);
                $a += Math.atan2(Math.sqrt((a = u * Math.sin(a)) * a + (a = r * o - e * u * s) * a), e * o + r * u * s), n = t, e = o, r = u
            }

            var n, e, r;
            Qa.point = function (i, o) {
                n = i * Bu, e = Math.sin(o *= Bu), r = Math.cos(o), Qa.point = t
            }, Qa.lineEnd = function () {
                Qa.point = Qa.lineEnd = N
            }
        }

        function Ee(t, n) {
            function e(n, e) {
                var r = Math.cos(n), i = Math.cos(e), o = t(r * i);
                return [o * i * Math.sin(n), o * Math.sin(e)]
            }

            return e.invert = function (t, e) {
                var r = Math.sqrt(t * t + e * e), i = n(r), o = Math.sin(i), u = Math.cos(i);
                return [Math.atan2(t * o, r * u), Math.asin(r && e * o / r)]
            }, e
        }

        function Ae(t, n) {
            function e(t, n) {
                u > 0 ? -Hu + Du > n && (n = -Hu + Du) : n > Hu - Du && (n = Hu - Du);
                var e = u / Math.pow(i(n), o);
                return [e * Math.sin(o * t), u - e * Math.cos(o * t)]
            }

            var r = Math.cos(t), i = function (t) {
                return Math.tan(Uu / 4 + t / 2)
            }, o = t === n ? Math.sin(t) : Math.log(r / Math.cos(n)) / Math.log(i(n) / i(t)), u = r * Math.pow(i(t), o) / o;
            return o ? (e.invert = function (t, n) {
                var e = u - n, r = rt(o) * Math.sqrt(t * t + e * e);
                return [Math.atan2(t, e) / o, 2 * Math.atan(Math.pow(u / r, 1 / o)) - Hu]
            }, e) : ze
        }

        function Ce(t, n) {
            function e(t, n) {
                var e = o - n;
                return [e * Math.sin(i * t), o - e * Math.cos(i * t)]
            }

            var r = Math.cos(t), i = t === n ? Math.sin(t) : (r - Math.cos(n)) / (n - t), o = r / i + t;
            return xu(i) < Du ? ge : (e.invert = function (t, n) {
                var e = o - n;
                return [Math.atan2(t, e) / i, o - rt(i) * Math.sqrt(t * t + e * e)]
            }, e)
        }

        function ze(t, n) {
            return [t, Math.log(Math.tan(Uu / 4 + n / 2))]
        }

        function Le(t) {
            var n, e = ce(t), r = e.scale, i = e.translate, o = e.clipExtent;
            return e.scale = function () {
                var t = r.apply(e, arguments);
                return t === e ? n ? e.clipExtent(null) : e : t
            }, e.translate = function () {
                var t = i.apply(e, arguments);
                return t === e ? n ? e.clipExtent(null) : e : t
            }, e.clipExtent = function (t) {
                var u = o.apply(e, arguments);
                if (u === e) {
                    if (n = null == t) {
                        var a = Uu * r(), s = i();
                        o([[s[0] - a, s[1] - a], [s[0] + a, s[1] + a]])
                    }
                } else n && (u = null);
                return u
            }, e.clipExtent(null)
        }

        function Te(t, n) {
            return [Math.log(Math.tan(Uu / 4 + n / 2)), -t]
        }

        function Re(t) {
            return t[0]
        }

        function qe(t) {
            return t[1]
        }

        function De(t) {
            for (var n = t.length, e = [0, 1], r = 2, i = 2; n > i; i++) {
                for (; r > 1 && it(t[e[r - 2]], t[e[r - 1]], t[i]) <= 0;)--r;
                e[r++] = i
            }
            return e.slice(0, r)
        }

        function Pe(t, n) {
            return t[0] - n[0] || t[1] - n[1]
        }

        function Ue(t, n, e) {
            return (e[0] - n[0]) * (t[1] - n[1]) < (e[1] - n[1]) * (t[0] - n[0])
        }

        function je(t, n, e, r) {
            var i = t[0], o = e[0], u = n[0] - i, a = r[0] - o, s = t[1], l = e[1], c = n[1] - s, f = r[1] - l, h = (a * (s - l) - f * (i - o)) / (f * u - a * c);
            return [i + h * u, s + h * c]
        }

        function Oe(t) {
            var n = t[0], e = t[t.length - 1];
            return !(n[0] - e[0] || n[1] - e[1])
        }

        function He() {
            ar(this), this.edge = this.site = this.circle = null
        }

        function Be(t) {
            var n = ss.pop() || new He;
            return n.site = t, n
        }

        function Fe(t) {
            Ge(t), os.remove(t), ss.push(t), ar(t)
        }

        function Ye(t) {
            var n = t.circle, e = n.x, r = n.cy, i = {x: e, y: r}, o = t.P, u = t.N, a = [t];
            Fe(t);
            for (var s = o; s.circle && xu(e - s.circle.x) < Du && xu(r - s.circle.cy) < Du;)o = s.P, a.unshift(s), Fe(s), s = o;
            a.unshift(s), Ge(s);
            for (var l = u; l.circle && xu(e - l.circle.x) < Du && xu(r - l.circle.cy) < Du;)u = l.N, a.push(l), Fe(l), l = u;
            a.push(l), Ge(l);
            var c, f = a.length;
            for (c = 1; f > c; ++c)l = a[c], s = a[c - 1], ir(l.edge, s.site, l.site, i);
            s = a[0], l = a[f - 1], l.edge = er(s.site, l.site, null, i), We(s), We(l)
        }

        function Xe(t) {
            for (var n, e, r, i, o = t.x, u = t.y, a = os._; a;)if (r = Ie(a, u) - o, r > Du)a = a.L; else {
                if (i = o - Ze(a, u), !(i > Du)) {
                    r > -Du ? (n = a.P, e = a) : i > -Du ? (n = a, e = a.N) : n = e = a;
                    break
                }
                if (!a.R) {
                    n = a;
                    break
                }
                a = a.R
            }
            var s = Be(t);
            if (os.insert(n, s), n || e) {
                if (n === e)return Ge(n), e = Be(n.site), os.insert(s, e), s.edge = e.edge = er(n.site, s.site), We(n), void We(e);
                if (!e)return void(s.edge = er(n.site, s.site));
                Ge(n), Ge(e);
                var l = n.site, c = l.x, f = l.y, h = t.x - c, g = t.y - f, p = e.site, d = p.x - c, v = p.y - f, m = 2 * (h * v - g * d), y = h * h + g * g, x = d * d + v * v, b = {
                    x: (v * y - g * x) / m + c,
                    y: (h * x - d * y) / m + f
                };
                ir(e.edge, l, p, b), s.edge = er(l, t, null, b), e.edge = er(t, p, null, b), We(n), We(e)
            }
        }

        function Ie(t, n) {
            var e = t.site, r = e.x, i = e.y, o = i - n;
            if (!o)return r;
            var u = t.P;
            if (!u)return -(1 / 0);
            e = u.site;
            var a = e.x, s = e.y, l = s - n;
            if (!l)return a;
            var c = a - r, f = 1 / o - 1 / l, h = c / l;
            return f ? (-h + Math.sqrt(h * h - 2 * f * (c * c / (-2 * l) - s + l / 2 + i - o / 2))) / f + r : (r + a) / 2
        }

        function Ze(t, n) {
            var e = t.N;
            if (e)return Ie(e, n);
            var r = t.site;
            return r.y === n ? r.x : 1 / 0
        }

        function Je(t) {
            this.site = t, this.edges = []
        }

        function Ve(t) {
            for (var n, e, r, i, o, u, a, s, l, c, f = t[0][0], h = t[1][0], g = t[0][1], p = t[1][1], d = is, v = d.length; v--;)if (o = d[v], o && o.prepare())for (a = o.edges, s = a.length, u = 0; s > u;)c = a[u].end(), r = c.x, i = c.y, l = a[++u % s].start(), n = l.x, e = l.y, (xu(r - n) > Du || xu(i - e) > Du) && (a.splice(u, 0, new or(rr(o.site, c, xu(r - f) < Du && p - i > Du ? {
                x: f,
                y: xu(n - f) < Du ? e : p
            } : xu(i - p) < Du && h - r > Du ? {x: xu(e - p) < Du ? n : h, y: p} : xu(r - h) < Du && i - g > Du ? {
                x: h,
                y: xu(n - h) < Du ? e : g
            } : xu(i - g) < Du && r - f > Du ? {x: xu(e - g) < Du ? n : f, y: g} : null), o.site, null)), ++s)
        }

        function $e(t, n) {
            return n.angle - t.angle
        }

        function Qe() {
            ar(this), this.x = this.y = this.arc = this.site = this.cy = null
        }

        function We(t) {
            var n = t.P, e = t.N;
            if (n && e) {
                var r = n.site, i = t.site, o = e.site;
                if (r !== o) {
                    var u = i.x, a = i.y, s = r.x - u, l = r.y - a, c = o.x - u, f = o.y - a, h = 2 * (s * f - l * c);
                    if (!(h >= -Pu)) {
                        var g = s * s + l * l, p = c * c + f * f, d = (f * g - l * p) / h, v = (s * p - c * g) / h, f = v + a, m = ls.pop() || new Qe;
                        m.arc = t, m.site = i, m.x = d + u, m.y = f + Math.sqrt(d * d + v * v), m.cy = f, t.circle = m;
                        for (var y = null, x = as._; x;)if (m.y < x.y || m.y === x.y && m.x <= x.x) {
                            if (!x.L) {
                                y = x.P;
                                break
                            }
                            x = x.L
                        } else {
                            if (!x.R) {
                                y = x;
                                break
                            }
                            x = x.R
                        }
                        as.insert(y, m), y || (us = m)
                    }
                }
            }
        }

        function Ge(t) {
            var n = t.circle;
            n && (n.P || (us = n.N), as.remove(n), ls.push(n), ar(n), t.circle = null)
        }

        function Ke(t) {
            for (var n, e = rs, r = Jn(t[0][0], t[0][1], t[1][0], t[1][1]), i = e.length; i--;)n = e[i], (!tr(n, t) || !r(n) || xu(n.a.x - n.b.x) < Du && xu(n.a.y - n.b.y) < Du) && (n.a = n.b = null, e.splice(i, 1))
        }

        function tr(t, n) {
            var e = t.b;
            if (e)return !0;
            var r, i, o = t.a, u = n[0][0], a = n[1][0], s = n[0][1], l = n[1][1], c = t.l, f = t.r, h = c.x, g = c.y, p = f.x, d = f.y, v = (h + p) / 2, m = (g + d) / 2;
            if (d === g) {
                if (u > v || v >= a)return;
                if (h > p) {
                    if (o) {
                        if (o.y >= l)return
                    } else o = {x: v, y: s};
                    e = {x: v, y: l}
                } else {
                    if (o) {
                        if (o.y < s)return
                    } else o = {x: v, y: l};
                    e = {x: v, y: s}
                }
            } else if (r = (h - p) / (d - g), i = m - r * v, -1 > r || r > 1)if (h > p) {
                if (o) {
                    if (o.y >= l)return
                } else o = {x: (s - i) / r, y: s};
                e = {x: (l - i) / r, y: l}
            } else {
                if (o) {
                    if (o.y < s)return
                } else o = {x: (l - i) / r, y: l};
                e = {x: (s - i) / r, y: s}
            } else if (d > g) {
                if (o) {
                    if (o.x >= a)return
                } else o = {x: u, y: r * u + i};
                e = {x: a, y: r * a + i}
            } else {
                if (o) {
                    if (o.x < u)return
                } else o = {x: a, y: r * a + i};
                e = {x: u, y: r * u + i}
            }
            return t.a = o, t.b = e, !0
        }

        function nr(t, n) {
            this.l = t, this.r = n, this.a = this.b = null
        }

        function er(t, n, e, r) {
            var i = new nr(t, n);
            return rs.push(i), e && ir(i, t, n, e), r && ir(i, n, t, r), is[t.i].edges.push(new or(i, t, n)), is[n.i].edges.push(new or(i, n, t)), i
        }

        function rr(t, n, e) {
            var r = new nr(t, null);
            return r.a = n, r.b = e, rs.push(r), r
        }

        function ir(t, n, e, r) {
            t.a || t.b ? t.l === e ? t.b = r : t.a = r : (t.a = r, t.l = n, t.r = e)
        }

        function or(t, n, e) {
            var r = t.a, i = t.b;
            this.edge = t, this.site = n, this.angle = e ? Math.atan2(e.y - n.y, e.x - n.x) : t.l === n ? Math.atan2(i.x - r.x, r.y - i.y) : Math.atan2(r.x - i.x, i.y - r.y)
        }

        function ur() {
            this._ = null
        }

        function ar(t) {
            t.U = t.C = t.L = t.R = t.P = t.N = null
        }

        function sr(t, n) {
            var e = n, r = n.R, i = e.U;
            i ? i.L === e ? i.L = r : i.R = r : t._ = r, r.U = i, e.U = r, e.R = r.L, e.R && (e.R.U = e), r.L = e
        }

        function lr(t, n) {
            var e = n, r = n.L, i = e.U;
            i ? i.L === e ? i.L = r : i.R = r : t._ = r, r.U = i, e.U = r, e.L = r.R, e.L && (e.L.U = e), r.R = e
        }

        function cr(t) {
            for (; t.L;)t = t.L;
            return t
        }

        function fr(t, n) {
            var e, r, i, o = t.sort(hr).pop();
            for (rs = [], is = new Array(t.length), os = new ur, as = new ur; ;)if (i = us, o && (!i || o.y < i.y || o.y === i.y && o.x < i.x))(o.x !== e || o.y !== r) && (is[o.i] = new Je(o), Xe(o), e = o.x, r = o.y), o = t.pop(); else {
                if (!i)break;
                Ye(i.arc)
            }
            n && (Ke(n), Ve(n));
            var u = {cells: is, edges: rs};
            return os = as = rs = is = null, u
        }

        function hr(t, n) {
            return n.y - t.y || n.x - t.x
        }

        function gr(t, n, e) {
            return (t.x - e.x) * (n.y - t.y) - (t.x - n.x) * (e.y - t.y)
        }

        function pr(t) {
            return t.x
        }

        function dr(t) {
            return t.y
        }

        function vr() {
            return {leaf: !0, nodes: [], point: null, x: null, y: null}
        }

        function mr(t, n, e, r, i, o) {
            if (!t(n, e, r, i, o)) {
                var u = .5 * (e + i), a = .5 * (r + o), s = n.nodes;
                s[0] && mr(t, s[0], e, r, u, a), s[1] && mr(t, s[1], u, r, i, a), s[2] && mr(t, s[2], e, a, u, o), s[3] && mr(t, s[3], u, a, i, o)
            }
        }

        function yr(t, n, e, r, i, o, u) {
            var a, s = 1 / 0;
            return function l(t, c, f, h, g) {
                if (!(c > o || f > u || r > h || i > g)) {
                    if (p = t.point) {
                        var p, d = n - t.x, v = e - t.y, m = d * d + v * v;
                        if (s > m) {
                            var y = Math.sqrt(s = m);
                            r = n - y, i = e - y, o = n + y, u = e + y, a = p
                        }
                    }
                    for (var x = t.nodes, b = .5 * (c + h), M = .5 * (f + g), w = n >= b, _ = e >= M, k = _ << 1 | w, S = k + 4; S > k; ++k)if (t = x[3 & k])switch (3 & k) {
                        case 0:
                            l(t, c, f, b, M);
                            break;
                        case 1:
                            l(t, b, f, h, M);
                            break;
                        case 2:
                            l(t, c, M, b, g);
                            break;
                        case 3:
                            l(t, b, M, h, g)
                    }
                }
            }(t, r, i, o, u), a
        }

        function xr(t, n) {
            t = au.rgb(t), n = au.rgb(n);
            var e = t.r, r = t.g, i = t.b, o = n.r - e, u = n.g - r, a = n.b - i;
            return function (t) {
                return "#" + St(Math.round(e + o * t)) + St(Math.round(r + u * t)) + St(Math.round(i + a * t))
            }
        }

        function br(t, n) {
            var e, r = {}, i = {};
            for (e in t)e in n ? r[e] = _r(t[e], n[e]) : i[e] = t[e];
            for (e in n)e in t || (i[e] = n[e]);
            return function (t) {
                for (e in r)i[e] = r[e](t);
                return i
            }
        }

        function Mr(t, n) {
            return t = +t, n = +n, function (e) {
                return t * (1 - e) + n * e
            }
        }

        function wr(t, n) {
            var e, r, i, o = fs.lastIndex = hs.lastIndex = 0, u = -1, a = [], s = [];
            for (t += "", n += ""; (e = fs.exec(t)) && (r = hs.exec(n));)(i = r.index) > o && (i = n.slice(o, i), a[u] ? a[u] += i : a[++u] = i), (e = e[0]) === (r = r[0]) ? a[u] ? a[u] += r : a[++u] = r : (a[++u] = null, s.push({
                i: u,
                x: Mr(e, r)
            })), o = hs.lastIndex;
            return o < n.length && (i = n.slice(o), a[u] ? a[u] += i : a[++u] = i), a.length < 2 ? s[0] ? (n = s[0].x, function (t) {
                return n(t) + ""
            }) : function () {
                return n
            } : (n = s.length, function (t) {
                for (var e, r = 0; n > r; ++r)a[(e = s[r]).i] = e.x(t);
                return a.join("")
            })
        }

        function _r(t, n) {
            for (var e, r = au.interpolators.length; --r >= 0 && !(e = au.interpolators[r](t, n)););
            return e
        }

        function kr(t, n) {
            var e, r = [], i = [], o = t.length, u = n.length, a = Math.min(t.length, n.length);
            for (e = 0; a > e; ++e)r.push(_r(t[e], n[e]));
            for (; o > e; ++e)i[e] = t[e];
            for (; u > e; ++e)i[e] = n[e];
            return function (t) {
                for (e = 0; a > e; ++e)i[e] = r[e](t);
                return i
            }
        }

        function Sr(t) {
            return function (n) {
                return 0 >= n ? 0 : n >= 1 ? 1 : t(n)
            }
        }

        function Nr(t) {
            return function (n) {
                return 1 - t(1 - n)
            }
        }

        function Er(t) {
            return function (n) {
                return .5 * (.5 > n ? t(2 * n) : 2 - t(2 - 2 * n))
            }
        }

        function Ar(t) {
            return t * t
        }

        function Cr(t) {
            return t * t * t
        }

        function zr(t) {
            if (0 >= t)return 0;
            if (t >= 1)return 1;
            var n = t * t, e = n * t;
            return 4 * (.5 > t ? e : 3 * (t - n) + e - .75)
        }

        function Lr(t) {
            return function (n) {
                return Math.pow(n, t)
            }
        }

        function Tr(t) {
            return 1 - Math.cos(t * Hu)
        }

        function Rr(t) {
            return Math.pow(2, 10 * (t - 1))
        }

        function qr(t) {
            return 1 - Math.sqrt(1 - t * t)
        }

        function Dr(t, n) {
            var e;
            return arguments.length < 2 && (n = .45), arguments.length ? e = n / ju * Math.asin(1 / t) : (t = 1, e = n / 4), function (r) {
                return 1 + t * Math.pow(2, -10 * r) * Math.sin((r - e) * ju / n)
            }
        }

        function Pr(t) {
            return t || (t = 1.70158), function (n) {
                return n * n * ((t + 1) * n - t)
            }
        }

        function Ur(t) {
            return 1 / 2.75 > t ? 7.5625 * t * t : 2 / 2.75 > t ? 7.5625 * (t -= 1.5 / 2.75) * t + .75 : 2.5 / 2.75 > t ? 7.5625 * (t -= 2.25 / 2.75) * t + .9375 : 7.5625 * (t -= 2.625 / 2.75) * t + .984375
        }

        function jr(t, n) {
            t = au.hcl(t), n = au.hcl(n);
            var e = t.h, r = t.c, i = t.l, o = n.h - e, u = n.c - r, a = n.l - i;
            return isNaN(u) && (u = 0, r = isNaN(r) ? n.c : r), isNaN(o) ? (o = 0, e = isNaN(e) ? n.h : e) : o > 180 ? o -= 360 : -180 > o && (o += 360), function (t) {
                return dt(e + o * t, r + u * t, i + a * t) + ""
            }
        }

        function Or(t, n) {
            t = au.hsl(t), n = au.hsl(n);
            var e = t.h, r = t.s, i = t.l, o = n.h - e, u = n.s - r, a = n.l - i;
            return isNaN(u) && (u = 0, r = isNaN(r) ? n.s : r), isNaN(o) ? (o = 0, e = isNaN(e) ? n.h : e) : o > 180 ? o -= 360 : -180 > o && (o += 360), function (t) {
                return gt(e + o * t, r + u * t, i + a * t) + ""
            }
        }

        function Hr(t, n) {
            t = au.lab(t), n = au.lab(n);
            var e = t.l, r = t.a, i = t.b, o = n.l - e, u = n.a - r, a = n.b - i;
            return function (t) {
                return mt(e + o * t, r + u * t, i + a * t) + ""
            }
        }

        function Br(t, n) {
            return n -= t, function (e) {
                return Math.round(t + n * e)
            }
        }

        function Fr(t) {
            var n = [t.a, t.b], e = [t.c, t.d], r = Xr(n), i = Yr(n, e), o = Xr(Ir(e, n, -i)) || 0;
            n[0] * e[1] < e[0] * n[1] && (n[0] *= -1, n[1] *= -1, r *= -1, i *= -1), this.rotate = (r ? Math.atan2(n[1], n[0]) : Math.atan2(-e[0], e[1])) * Fu, this.translate = [t.e, t.f], this.scale = [r, o], this.skew = o ? Math.atan2(i, o) * Fu : 0
        }

        function Yr(t, n) {
            return t[0] * n[0] + t[1] * n[1]
        }

        function Xr(t) {
            var n = Math.sqrt(Yr(t, t));
            return n && (t[0] /= n, t[1] /= n), n
        }

        function Ir(t, n, e) {
            return t[0] += e * n[0], t[1] += e * n[1], t
        }

        function Zr(t, n) {
            var e, r = [], i = [], o = au.transform(t), u = au.transform(n), a = o.translate, s = u.translate, l = o.rotate, c = u.rotate, f = o.skew, h = u.skew, g = o.scale, p = u.scale;
            return a[0] != s[0] || a[1] != s[1] ? (r.push("translate(", null, ",", null, ")"), i.push({
                i: 1,
                x: Mr(a[0], s[0])
            }, {
                i: 3,
                x: Mr(a[1], s[1])
            })) : s[0] || s[1] ? r.push("translate(" + s + ")") : r.push(""), l != c ? (l - c > 180 ? c += 360 : c - l > 180 && (l += 360), i.push({
                i: r.push(r.pop() + "rotate(", null, ")") - 2,
                x: Mr(l, c)
            })) : c && r.push(r.pop() + "rotate(" + c + ")"), f != h ? i.push({
                i: r.push(r.pop() + "skewX(", null, ")") - 2,
                x: Mr(f, h)
            }) : h && r.push(r.pop() + "skewX(" + h + ")"), g[0] != p[0] || g[1] != p[1] ? (e = r.push(r.pop() + "scale(", null, ",", null, ")"), i.push({
                i: e - 4,
                x: Mr(g[0], p[0])
            }, {
                i: e - 2,
                x: Mr(g[1], p[1])
            })) : (1 != p[0] || 1 != p[1]) && r.push(r.pop() + "scale(" + p + ")"), e = i.length, function (t) {
                for (var n, o = -1; ++o < e;)r[(n = i[o]).i] = n.x(t);
                return r.join("")
            }
        }

        function Jr(t, n) {
            return n = (n -= t = +t) || 1 / n, function (e) {
                return (e - t) / n
            }
        }

        function Vr(t, n) {
            return n = (n -= t = +t) || 1 / n, function (e) {
                return Math.max(0, Math.min(1, (e - t) / n))
            }
        }

        function $r(t) {
            for (var n = t.source, e = t.target, r = Wr(n, e), i = [n]; n !== r;)n = n.parent, i.push(n);
            for (var o = i.length; e !== r;)i.splice(o, 0, e), e = e.parent;
            return i
        }

        function Qr(t) {
            for (var n = [], e = t.parent; null != e;)n.push(t), t = e, e = e.parent;
            return n.push(t), n
        }

        function Wr(t, n) {
            if (t === n)return t;
            for (var e = Qr(t), r = Qr(n), i = e.pop(), o = r.pop(), u = null; i === o;)u = i, i = e.pop(), o = r.pop();
            return u
        }

        function Gr(t) {
            t.fixed |= 2
        }

        function Kr(t) {
            t.fixed &= -7
        }

        function ti(t) {
            t.fixed |= 4, t.px = t.x, t.py = t.y
        }

        function ni(t) {
            t.fixed &= -5
        }

        function ei(t, n, e) {
            var r = 0, i = 0;
            if (t.charge = 0, !t.leaf)for (var o, u = t.nodes, a = u.length, s = -1; ++s < a;)o = u[s], null != o && (ei(o, n, e), t.charge += o.charge, r += o.charge * o.cx, i += o.charge * o.cy);
            if (t.point) {
                t.leaf || (t.point.x += Math.random() - .5, t.point.y += Math.random() - .5);
                var l = n * e[t.point.index];
                t.charge += t.pointCharge = l, r += l * t.point.x, i += l * t.point.y
            }
            t.cx = r / t.charge, t.cy = i / t.charge
        }

        function ri(t, n) {
            return au.rebind(t, n, "sort", "children", "value"), t.nodes = t, t.links = li, t
        }

        function ii(t, n) {
            for (var e = [t]; null != (t = e.pop());)if (n(t), (i = t.children) && (r = i.length))for (var r, i; --r >= 0;)e.push(i[r])
        }

        function oi(t, n) {
            for (var e = [t], r = []; null != (t = e.pop());)if (r.push(t), (o = t.children) && (i = o.length))for (var i, o, u = -1; ++u < i;)e.push(o[u]);
            for (; null != (t = r.pop());)n(t)
        }

        function ui(t) {
            return t.children
        }

        function ai(t) {
            return t.value
        }

        function si(t, n) {
            return n.value - t.value
        }

        function li(t) {
            return au.merge(t.map(function (t) {
                return (t.children || []).map(function (n) {
                    return {source: t, target: n}
                })
            }))
        }

        function ci(t) {
            return t.x
        }

        function fi(t) {
            return t.y
        }

        function hi(t, n, e) {
            t.y0 = n, t.y = e
        }

        function gi(t) {
            return au.range(t.length)
        }

        function pi(t) {
            for (var n = -1, e = t[0].length, r = []; ++n < e;)r[n] = 0;
            return r
        }

        function di(t) {
            for (var n, e = 1, r = 0, i = t[0][1], o = t.length; o > e; ++e)(n = t[e][1]) > i && (r = e, i = n);
            return r
        }

        function vi(t) {
            return t.reduce(mi, 0)
        }

        function mi(t, n) {
            return t + n[1]
        }

        function yi(t, n) {
            return xi(t, Math.ceil(Math.log(n.length) / Math.LN2 + 1))
        }

        function xi(t, n) {
            for (var e = -1, r = +t[0], i = (t[1] - r) / n, o = []; ++e <= n;)o[e] = i * e + r;
            return o
        }

        function bi(t) {
            return [au.min(t), au.max(t)]
        }

        function Mi(t, n) {
            return t.value - n.value
        }

        function wi(t, n) {
            var e = t._pack_next;
            t._pack_next = n, n._pack_prev = t, n._pack_next = e, e._pack_prev = n
        }

        function _i(t, n) {
            t._pack_next = n, n._pack_prev = t
        }

        function ki(t, n) {
            var e = n.x - t.x, r = n.y - t.y, i = t.r + n.r;
            return .999 * i * i > e * e + r * r
        }

        function Si(t) {
            function n(t) {
                c = Math.min(t.x - t.r, c), f = Math.max(t.x + t.r, f), h = Math.min(t.y - t.r, h), g = Math.max(t.y + t.r, g)
            }

            if ((e = t.children) && (l = e.length)) {
                var e, r, i, o, u, a, s, l, c = 1 / 0, f = -(1 / 0), h = 1 / 0, g = -(1 / 0);
                if (e.forEach(Ni), r = e[0], r.x = -r.r, r.y = 0, n(r), l > 1 && (i = e[1], i.x = i.r, i.y = 0, n(i), l > 2))for (o = e[2], Ci(r, i, o), n(o), wi(r, o), r._pack_prev = o, wi(o, i), i = r._pack_next, u = 3; l > u; u++) {
                    Ci(r, i, o = e[u]);
                    var p = 0, d = 1, v = 1;
                    for (a = i._pack_next; a !== i; a = a._pack_next, d++)if (ki(a, o)) {
                        p = 1;
                        break
                    }
                    if (1 == p)for (s = r._pack_prev; s !== a._pack_prev && !ki(s, o); s = s._pack_prev, v++);
                    p ? (v > d || d == v && i.r < r.r ? _i(r, i = a) : _i(r = s, i), u--) : (wi(r, o), i = o, n(o))
                }
                var m = (c + f) / 2, y = (h + g) / 2, x = 0;
                for (u = 0; l > u; u++)o = e[u], o.x -= m, o.y -= y, x = Math.max(x, o.r + Math.sqrt(o.x * o.x + o.y * o.y));
                t.r = x, e.forEach(Ei)
            }
        }

        function Ni(t) {
            t._pack_next = t._pack_prev = t
        }

        function Ei(t) {
            delete t._pack_next, delete t._pack_prev
        }

        function Ai(t, n, e, r) {
            var i = t.children;
            if (t.x = n += r * t.x, t.y = e += r * t.y, t.r *= r, i)for (var o = -1, u = i.length; ++o < u;)Ai(i[o], n, e, r)
        }

        function Ci(t, n, e) {
            var r = t.r + e.r, i = n.x - t.x, o = n.y - t.y;
            if (r && (i || o)) {
                var u = n.r + e.r, a = i * i + o * o;
                u *= u, r *= r;
                var s = .5 + (r - u) / (2 * a), l = Math.sqrt(Math.max(0, 2 * u * (r + a) - (r -= a) * r - u * u)) / (2 * a);
                e.x = t.x + s * i + l * o, e.y = t.y + s * o - l * i
            } else e.x = t.x + r, e.y = t.y
        }

        function zi(t, n) {
            return t.parent == n.parent ? 1 : 2
        }

        function Li(t) {
            var n = t.children;
            return n.length ? n[0] : t.t
        }

        function Ti(t) {
            var n, e = t.children;
            return (n = e.length) ? e[n - 1] : t.t
        }

        function Ri(t, n, e) {
            var r = e / (n.i - t.i);
            n.c -= r, n.s += e, t.c += r, n.z += e, n.m += e
        }

        function qi(t) {
            for (var n, e = 0, r = 0, i = t.children, o = i.length; --o >= 0;)n = i[o], n.z += e, n.m += e, e += n.s + (r += n.c)
        }

        function Di(t, n, e) {
            return t.a.parent === n.parent ? t.a : e
        }

        function Pi(t) {
            return 1 + au.max(t, function (t) {
                    return t.y
                })
        }

        function Ui(t) {
            return t.reduce(function (t, n) {
                    return t + n.x
                }, 0) / t.length
        }

        function ji(t) {
            var n = t.children;
            return n && n.length ? ji(n[0]) : t
        }

        function Oi(t) {
            var n, e = t.children;
            return e && (n = e.length) ? Oi(e[n - 1]) : t
        }

        function Hi(t) {
            return {x: t.x, y: t.y, dx: t.dx, dy: t.dy}
        }

        function Bi(t, n) {
            var e = t.x + n[3], r = t.y + n[0], i = t.dx - n[1] - n[3], o = t.dy - n[0] - n[2];
            return 0 > i && (e += i / 2, i = 0), 0 > o && (r += o / 2, o = 0), {x: e, y: r, dx: i, dy: o}
        }

        function Fi(t) {
            var n = t[0], e = t[t.length - 1];
            return e > n ? [n, e] : [e, n]
        }

        function Yi(t) {
            return t.rangeExtent ? t.rangeExtent() : Fi(t.range())
        }

        function Xi(t, n, e, r) {
            var i = e(t[0], t[1]), o = r(n[0], n[1]);
            return function (t) {
                return o(i(t))
            }
        }

        function Ii(t, n) {
            var e, r = 0, i = t.length - 1, o = t[r], u = t[i];
            return o > u && (e = r, r = i, i = e, e = o, o = u, u = e), t[r] = n.floor(o), t[i] = n.ceil(u), t
        }

        function Zi(t) {
            return t ? {
                floor: function (n) {
                    return Math.floor(n / t) * t
                }, ceil: function (n) {
                    return Math.ceil(n / t) * t
                }
            } : _s
        }

        function Ji(t, n, e, r) {
            var i = [], o = [], u = 0, a = Math.min(t.length, n.length) - 1;
            for (t[a] < t[0] && (t = t.slice().reverse(), n = n.slice().reverse()); ++u <= a;)i.push(e(t[u - 1], t[u])), o.push(r(n[u - 1], n[u]));
            return function (n) {
                var e = au.bisect(t, n, 1, a) - 1;
                return o[e](i[e](n))
            }
        }

        function Vi(t, n, e, r) {
            function i() {
                var i = Math.min(t.length, n.length) > 2 ? Ji : Xi, s = r ? Vr : Jr;
                return u = i(t, n, s, e), a = i(n, t, s, _r), o
            }

            function o(t) {
                return u(t)
            }

            var u, a;
            return o.invert = function (t) {
                return a(t)
            }, o.domain = function (n) {
                return arguments.length ? (t = n.map(Number), i()) : t
            }, o.range = function (t) {
                return arguments.length ? (n = t, i()) : n
            }, o.rangeRound = function (t) {
                return o.range(t).interpolate(Br)
            }, o.clamp = function (t) {
                return arguments.length ? (r = t, i()) : r
            }, o.interpolate = function (t) {
                return arguments.length ? (e = t, i()) : e
            }, o.ticks = function (n) {
                return Gi(t, n)
            }, o.tickFormat = function (n, e) {
                return Ki(t, n, e)
            }, o.nice = function (n) {
                return Qi(t, n), i()
            }, o.copy = function () {
                return Vi(t, n, e, r)
            }, i()
        }

        function $i(t, n) {
            return au.rebind(t, n, "range", "rangeRound", "interpolate", "clamp")
        }

        function Qi(t, n) {
            return Ii(t, Zi(Wi(t, n)[2]))
        }

        function Wi(t, n) {
            null == n && (n = 10);
            var e = Fi(t), r = e[1] - e[0], i = Math.pow(10, Math.floor(Math.log(r / n) / Math.LN10)), o = n / r * i;
            return .15 >= o ? i *= 10 : .35 >= o ? i *= 5 : .75 >= o && (i *= 2), e[0] = Math.ceil(e[0] / i) * i, e[1] = Math.floor(e[1] / i) * i + .5 * i, e[2] = i, e
        }

        function Gi(t, n) {
            return au.range.apply(au, Wi(t, n))
        }

        function Ki(t, n, e) {
            var r = Wi(t, n);
            if (e) {
                var i = fa.exec(e);
                if (i.shift(), "s" === i[8]) {
                    var o = au.formatPrefix(Math.max(xu(r[0]), xu(r[1])));
                    return i[7] || (i[7] = "." + to(o.scale(r[2]))), i[8] = "f", e = au.format(i.join("")), function (t) {
                        return e(o.scale(t)) + o.symbol
                    }
                }
                i[7] || (i[7] = "." + no(i[8], r)), e = i.join("")
            } else e = ",." + to(r[2]) + "f";
            return au.format(e)
        }

        function to(t) {
            return -Math.floor(Math.log(t) / Math.LN10 + .01)
        }

        function no(t, n) {
            var e = to(n[2]);
            return t in ks ? Math.abs(e - to(Math.max(xu(n[0]), xu(n[1])))) + +("e" !== t) : e - 2 * ("%" === t)
        }

        function eo(t, n, e, r) {
            function i(t) {
                return (e ? Math.log(0 > t ? 0 : t) : -Math.log(t > 0 ? 0 : -t)) / Math.log(n)
            }

            function o(t) {
                return e ? Math.pow(n, t) : -Math.pow(n, -t)
            }

            function u(n) {
                return t(i(n))
            }

            return u.invert = function (n) {
                return o(t.invert(n))
            }, u.domain = function (n) {
                return arguments.length ? (e = n[0] >= 0, t.domain((r = n.map(Number)).map(i)), u) : r
            }, u.base = function (e) {
                return arguments.length ? (n = +e, t.domain(r.map(i)), u) : n
            }, u.nice = function () {
                var n = Ii(r.map(i), e ? Math : Ns);
                return t.domain(n), r = n.map(o), u
            }, u.ticks = function () {
                var t = Fi(r), u = [], a = t[0], s = t[1], l = Math.floor(i(a)), c = Math.ceil(i(s)), f = n % 1 ? 2 : n;
                if (isFinite(c - l)) {
                    if (e) {
                        for (; c > l; l++)for (var h = 1; f > h; h++)u.push(o(l) * h);
                        u.push(o(l))
                    } else for (u.push(o(l)); l++ < c;)for (var h = f - 1; h > 0; h--)u.push(o(l) * h);
                    for (l = 0; u[l] < a; l++);
                    for (c = u.length; u[c - 1] > s; c--);
                    u = u.slice(l, c)
                }
                return u
            }, u.tickFormat = function (t, n) {
                if (!arguments.length)return Ss;
                arguments.length < 2 ? n = Ss : "function" != typeof n && (n = au.format(n));
                var r, a = Math.max(.1, t / u.ticks().length), s = e ? (r = 1e-12, Math.ceil) : (r = -1e-12, Math.floor);
                return function (t) {
                    return t / o(s(i(t) + r)) <= a ? n(t) : ""
                }
            }, u.copy = function () {
                return eo(t.copy(), n, e, r)
            }, $i(u, t)
        }

        function ro(t, n, e) {
            function r(n) {
                return t(i(n))
            }

            var i = io(n), o = io(1 / n);
            return r.invert = function (n) {
                return o(t.invert(n))
            }, r.domain = function (n) {
                return arguments.length ? (t.domain((e = n.map(Number)).map(i)), r) : e
            }, r.ticks = function (t) {
                return Gi(e, t)
            }, r.tickFormat = function (t, n) {
                return Ki(e, t, n)
            }, r.nice = function (t) {
                return r.domain(Qi(e, t))
            }, r.exponent = function (u) {
                return arguments.length ? (i = io(n = u), o = io(1 / n), t.domain(e.map(i)), r) : n
            }, r.copy = function () {
                return ro(t.copy(), n, e)
            }, $i(r, t)
        }

        function io(t) {
            return function (n) {
                return 0 > n ? -Math.pow(-n, t) : Math.pow(n, t)
            }
        }

        function oo(t, n) {
            function e(e) {
                return o[((i.get(e) || ("range" === n.t ? i.set(e, t.push(e)) : NaN)) - 1) % o.length]
            }

            function r(n, e) {
                return au.range(t.length).map(function (t) {
                    return n + e * t
                })
            }

            var i, o, u;
            return e.domain = function (r) {
                if (!arguments.length)return t;
                t = [], i = new p;
                for (var o, u = -1, a = r.length; ++u < a;)i.has(o = r[u]) || i.set(o, t.push(o));
                return e[n.t].apply(e, n.a)
            }, e.range = function (t) {
                return arguments.length ? (o = t, u = 0, n = {t: "range", a: arguments}, e) : o
            }, e.rangePoints = function (i, a) {
                arguments.length < 2 && (a = 0);
                var s = i[0], l = i[1], c = t.length < 2 ? (s = (s + l) / 2, 0) : (l - s) / (t.length - 1 + a);
                return o = r(s + c * a / 2, c), u = 0, n = {t: "rangePoints", a: arguments}, e
            }, e.rangeRoundPoints = function (i, a) {
                arguments.length < 2 && (a = 0);
                var s = i[0], l = i[1], c = t.length < 2 ? (s = l = Math.round((s + l) / 2), 0) : (l - s) / (t.length - 1 + a) | 0;
                return o = r(s + Math.round(c * a / 2 + (l - s - (t.length - 1 + a) * c) / 2), c), u = 0, n = {
                    t: "rangeRoundPoints",
                    a: arguments
                }, e
            }, e.rangeBands = function (i, a, s) {
                arguments.length < 2 && (a = 0), arguments.length < 3 && (s = a);
                var l = i[1] < i[0], c = i[l - 0], f = i[1 - l], h = (f - c) / (t.length - a + 2 * s);
                return o = r(c + h * s, h), l && o.reverse(), u = h * (1 - a), n = {t: "rangeBands", a: arguments}, e
            }, e.rangeRoundBands = function (i, a, s) {
                arguments.length < 2 && (a = 0), arguments.length < 3 && (s = a);
                var l = i[1] < i[0], c = i[l - 0], f = i[1 - l], h = Math.floor((f - c) / (t.length - a + 2 * s));
                return o = r(c + Math.round((f - c - (t.length - a) * h) / 2), h), l && o.reverse(), u = Math.round(h * (1 - a)), n = {
                    t: "rangeRoundBands",
                    a: arguments
                }, e
            }, e.rangeBand = function () {
                return u
            }, e.rangeExtent = function () {
                return Fi(n.a[0])
            }, e.copy = function () {
                return oo(t, n)
            }, e.domain(t)
        }

        function uo(t, n) {
            function e() {
                var e = 0, o = n.length;
                for (i = []; ++e < o;)i[e - 1] = au.quantile(t, e / o);
                return r
            }

            function r(t) {
                return isNaN(t = +t) ? void 0 : n[au.bisect(i, t)]
            }

            var i;
            return r.domain = function (n) {
                return arguments.length ? (t = n.map(s).filter(l).sort(a), e()) : t
            }, r.range = function (t) {
                return arguments.length ? (n = t, e()) : n
            }, r.quantiles = function () {
                return i
            }, r.invertExtent = function (e) {
                return e = n.indexOf(e), 0 > e ? [NaN, NaN] : [e > 0 ? i[e - 1] : t[0], e < i.length ? i[e] : t[t.length - 1]]
            }, r.copy = function () {
                return uo(t, n)
            }, e()
        }

        function ao(t, n, e) {
            function r(n) {
                return e[Math.max(0, Math.min(u, Math.floor(o * (n - t))))]
            }

            function i() {
                return o = e.length / (n - t), u = e.length - 1, r
            }

            var o, u;
            return r.domain = function (e) {
                return arguments.length ? (t = +e[0], n = +e[e.length - 1], i()) : [t, n]
            }, r.range = function (t) {
                return arguments.length ? (e = t, i()) : e
            }, r.invertExtent = function (n) {
                return n = e.indexOf(n), n = 0 > n ? NaN : n / o + t, [n, n + 1 / o]
            }, r.copy = function () {
                return ao(t, n, e)
            }, i()
        }

        function so(t, n) {
            function e(e) {
                return e >= e ? n[au.bisect(t, e)] : void 0
            }

            return e.domain = function (n) {
                return arguments.length ? (t = n, e) : t
            }, e.range = function (t) {
                return arguments.length ? (n = t, e) : n
            }, e.invertExtent = function (e) {
                return e = n.indexOf(e), [t[e - 1], t[e]]
            }, e.copy = function () {
                return so(t, n)
            }, e
        }

        function lo(t) {
            function n(t) {
                return +t
            }

            return n.invert = n, n.domain = n.range = function (e) {
                return arguments.length ? (t = e.map(n), n) : t
            }, n.ticks = function (n) {
                return Gi(t, n)
            }, n.tickFormat = function (n, e) {
                return Ki(t, n, e)
            }, n.copy = function () {
                return lo(t)
            }, n
        }

        function co() {
            return 0
        }

        function fo(t) {
            return t.innerRadius
        }

        function ho(t) {
            return t.outerRadius
        }

        function go(t) {
            return t.startAngle
        }

        function po(t) {
            return t.endAngle
        }

        function vo(t) {
            return t && t.padAngle
        }

        function mo(t, n, e, r) {
            return (t - e) * n - (n - r) * t > 0 ? 0 : 1
        }

        function yo(t, n, e, r, i) {
            var o = t[0] - n[0], u = t[1] - n[1], a = (i ? r : -r) / Math.sqrt(o * o + u * u), s = a * u, l = -a * o, c = t[0] + s, f = t[1] + l, h = n[0] + s, g = n[1] + l, p = (c + h) / 2, d = (f + g) / 2, v = h - c, m = g - f, y = v * v + m * m, x = e - r, b = c * g - h * f, M = (0 > m ? -1 : 1) * Math.sqrt(x * x * y - b * b), w = (b * m - v * M) / y, _ = (-b * v - m * M) / y, k = (b * m + v * M) / y, S = (-b * v + m * M) / y, N = w - p, E = _ - d, A = k - p, C = S - d;
            return N * N + E * E > A * A + C * C && (w = k, _ = S), [[w - s, _ - l], [w * e / x, _ * e / x]]
        }

        function xo(t) {
            function n(n) {
                function u() {
                    l.push("M", o(t(c), a))
                }

                for (var s, l = [], c = [], f = -1, h = n.length, g = Lt(e), p = Lt(r); ++f < h;)i.call(this, s = n[f], f) ? c.push([+g.call(this, s, f), +p.call(this, s, f)]) : c.length && (u(), c = []);
                return c.length && u(), l.length ? l.join("") : null
            }

            var e = Re, r = qe, i = qn, o = bo, u = o.key, a = .7;
            return n.x = function (t) {
                return arguments.length ? (e = t, n) : e
            }, n.y = function (t) {
                return arguments.length ? (r = t, n) : r
            }, n.defined = function (t) {
                return arguments.length ? (i = t, n) : i
            }, n.interpolate = function (t) {
                return arguments.length ? (u = "function" == typeof t ? o = t : (o = Ts.get(t) || bo).key, n) : u
            }, n.tension = function (t) {
                return arguments.length ? (a = t, n) : a
            }, n
        }

        function bo(t) {
            return t.join("L")
        }

        function Mo(t) {
            return bo(t) + "Z"
        }

        function wo(t) {
            for (var n = 0, e = t.length, r = t[0], i = [r[0], ",", r[1]]; ++n < e;)i.push("H", (r[0] + (r = t[n])[0]) / 2, "V", r[1]);
            return e > 1 && i.push("H", r[0]), i.join("")
        }

        function _o(t) {
            for (var n = 0, e = t.length, r = t[0], i = [r[0], ",", r[1]]; ++n < e;)i.push("V", (r = t[n])[1], "H", r[0]);
            return i.join("")
        }

        function ko(t) {
            for (var n = 0, e = t.length, r = t[0], i = [r[0], ",", r[1]]; ++n < e;)i.push("H", (r = t[n])[0], "V", r[1]);
            return i.join("")
        }

        function So(t, n) {
            return t.length < 4 ? bo(t) : t[1] + Ao(t.slice(1, -1), Co(t, n))
        }

        function No(t, n) {
            return t.length < 3 ? bo(t) : t[0] + Ao((t.push(t[0]), t), Co([t[t.length - 2]].concat(t, [t[1]]), n))
        }

        function Eo(t, n) {
            return t.length < 3 ? bo(t) : t[0] + Ao(t, Co(t, n))
        }

        function Ao(t, n) {
            if (n.length < 1 || t.length != n.length && t.length != n.length + 2)return bo(t);
            var e = t.length != n.length, r = "", i = t[0], o = t[1], u = n[0], a = u, s = 1;
            if (e && (r += "Q" + (o[0] - 2 * u[0] / 3) + "," + (o[1] - 2 * u[1] / 3) + "," + o[0] + "," + o[1], i = t[1], s = 2), n.length > 1) {
                a = n[1], o = t[s], s++, r += "C" + (i[0] + u[0]) + "," + (i[1] + u[1]) + "," + (o[0] - a[0]) + "," + (o[1] - a[1]) + "," + o[0] + "," + o[1];
                for (var l = 2; l < n.length; l++, s++)o = t[s], a = n[l], r += "S" + (o[0] - a[0]) + "," + (o[1] - a[1]) + "," + o[0] + "," + o[1]
            }
            if (e) {
                var c = t[s];
                r += "Q" + (o[0] + 2 * a[0] / 3) + "," + (o[1] + 2 * a[1] / 3) + "," + c[0] + "," + c[1]
            }
            return r
        }

        function Co(t, n) {
            for (var e, r = [], i = (1 - n) / 2, o = t[0], u = t[1], a = 1, s = t.length; ++a < s;)e = o, o = u, u = t[a], r.push([i * (u[0] - e[0]), i * (u[1] - e[1])]);
            return r
        }

        function zo(t) {
            if (t.length < 3)return bo(t);
            var n = 1, e = t.length, r = t[0], i = r[0], o = r[1], u = [i, i, i, (r = t[1])[0]], a = [o, o, o, r[1]], s = [i, ",", o, "L", qo(Ds, u), ",", qo(Ds, a)];
            for (t.push(t[e - 1]); ++n <= e;)r = t[n], u.shift(), u.push(r[0]), a.shift(), a.push(r[1]), Do(s, u, a);
            return t.pop(), s.push("L", r), s.join("")
        }

        function Lo(t) {
            if (t.length < 4)return bo(t);
            for (var n, e = [], r = -1, i = t.length, o = [0], u = [0]; ++r < 3;)n = t[r], o.push(n[0]), u.push(n[1]);
            for (e.push(qo(Ds, o) + "," + qo(Ds, u)), --r; ++r < i;)n = t[r], o.shift(), o.push(n[0]), u.shift(), u.push(n[1]), Do(e, o, u);
            return e.join("")
        }

        function To(t) {
            for (var n, e, r = -1, i = t.length, o = i + 4, u = [], a = []; ++r < 4;)e = t[r % i], u.push(e[0]), a.push(e[1]);
            for (n = [qo(Ds, u), ",", qo(Ds, a)], --r; ++r < o;)e = t[r % i], u.shift(), u.push(e[0]), a.shift(), a.push(e[1]), Do(n, u, a);
            return n.join("")
        }

        function Ro(t, n) {
            var e = t.length - 1;
            if (e)for (var r, i, o = t[0][0], u = t[0][1], a = t[e][0] - o, s = t[e][1] - u, l = -1; ++l <= e;)r = t[l], i = l / e, r[0] = n * r[0] + (1 - n) * (o + i * a), r[1] = n * r[1] + (1 - n) * (u + i * s);
            return zo(t)
        }

        function qo(t, n) {
            return t[0] * n[0] + t[1] * n[1] + t[2] * n[2] + t[3] * n[3]
        }

        function Do(t, n, e) {
            t.push("C", qo(Rs, n), ",", qo(Rs, e), ",", qo(qs, n), ",", qo(qs, e), ",", qo(Ds, n), ",", qo(Ds, e))
        }

        function Po(t, n) {
            return (n[1] - t[1]) / (n[0] - t[0])
        }

        function Uo(t) {
            for (var n = 0, e = t.length - 1, r = [], i = t[0], o = t[1], u = r[0] = Po(i, o); ++n < e;)r[n] = (u + (u = Po(i = o, o = t[n + 1]))) / 2;
            return r[n] = u, r
        }

        function jo(t) {
            for (var n, e, r, i, o = [], u = Uo(t), a = -1, s = t.length - 1; ++a < s;)n = Po(t[a], t[a + 1]), xu(n) < Du ? u[a] = u[a + 1] = 0 : (e = u[a] / n, r = u[a + 1] / n, i = e * e + r * r, i > 9 && (i = 3 * n / Math.sqrt(i), u[a] = i * e, u[a + 1] = i * r));
            for (a = -1; ++a <= s;)i = (t[Math.min(s, a + 1)][0] - t[Math.max(0, a - 1)][0]) / (6 * (1 + u[a] * u[a])), o.push([i || 0, u[a] * i || 0]);
            return o
        }

        function Oo(t) {
            return t.length < 3 ? bo(t) : t[0] + Ao(t, jo(t))
        }

        function Ho(t) {
            for (var n, e, r, i = -1, o = t.length; ++i < o;)n = t[i], e = n[0], r = n[1] - Hu, n[0] = e * Math.cos(r), n[1] = e * Math.sin(r);
            return t
        }

        function Bo(t) {
            function n(n) {
                function s() {
                    d.push("M", a(t(m), f), c, l(t(v.reverse()), f), "Z")
                }

                for (var h, g, p, d = [], v = [], m = [], y = -1, x = n.length, b = Lt(e), M = Lt(i), w = e === r ? function () {
                    return g
                } : Lt(r), _ = i === o ? function () {
                    return p
                } : Lt(o); ++y < x;)u.call(this, h = n[y], y) ? (v.push([g = +b.call(this, h, y), p = +M.call(this, h, y)]), m.push([+w.call(this, h, y), +_.call(this, h, y)])) : v.length && (s(), v = [], m = []);
                return v.length && s(), d.length ? d.join("") : null
            }

            var e = Re, r = Re, i = 0, o = qe, u = qn, a = bo, s = a.key, l = a, c = "L", f = .7;
            return n.x = function (t) {
                return arguments.length ? (e = r = t, n) : r
            }, n.x0 = function (t) {
                return arguments.length ? (e = t, n) : e
            }, n.x1 = function (t) {
                return arguments.length ? (r = t, n) : r
            }, n.y = function (t) {
                return arguments.length ? (i = o = t, n) : o
            }, n.y0 = function (t) {
                return arguments.length ? (i = t, n) : i
            }, n.y1 = function (t) {
                return arguments.length ? (o = t, n) : o
            }, n.defined = function (t) {
                return arguments.length ? (u = t, n) : u
            }, n.interpolate = function (t) {
                return arguments.length ? (s = "function" == typeof t ? a = t : (a = Ts.get(t) || bo).key, l = a.reverse || a, c = a.closed ? "M" : "L", n) : s
            }, n.tension = function (t) {
                return arguments.length ? (f = t, n) : f
            }, n
        }

        function Fo(t) {
            return t.radius
        }

        function Yo(t) {
            return [t.x, t.y]
        }

        function Xo(t) {
            return function () {
                var n = t.apply(this, arguments), e = n[0], r = n[1] - Hu;
                return [e * Math.cos(r), e * Math.sin(r)]
            }
        }

        function Io() {
            return 64
        }

        function Zo() {
            return "circle"
        }

        function Jo(t) {
            var n = Math.sqrt(t / Uu);
            return "M0," + n + "A" + n + "," + n + " 0 1,1 0," + -n + "A" + n + "," + n + " 0 1,1 0," + n + "Z"
        }

        function Vo(t) {
            return function () {
                var n, e;
                (n = this[t]) && (e = n[n.active]) && (--n.count ? delete n[n.active] : delete this[t], n.active += .5, e.event && e.event.interrupt.call(this, this.__data__, e.index))
            }
        }

        function $o(t, n, e) {
            return ku(t, Fs), t.namespace = n, t.id = e, t
        }

        function Qo(t, n, e, r) {
            var i = t.id, o = t.namespace;
            return V(t, "function" == typeof e ? function (t, u, a) {
                t[o][i].tween.set(n, r(e.call(t, t.__data__, u, a)))
            } : (e = r(e), function (t) {
                t[o][i].tween.set(n, e)
            }))
        }

        function Wo(t) {
            return null == t && (t = ""), function () {
                this.textContent = t
            }
        }

        function Go(t) {
            return null == t ? "__transition__" : "__transition_" + t + "__"
        }

        function Ko(t, n, e, r, i) {
            var o = t[e] || (t[e] = {active: 0, count: 0}), u = o[r];
            if (!u) {
                var a = i.time;
                u = o[r] = {
                    tween: new p,
                    time: a,
                    delay: i.delay,
                    duration: i.duration,
                    ease: i.ease,
                    index: n
                }, i = null, ++o.count, au.timer(function (i) {
                    function s(e) {
                        if (o.active > r)return c();
                        var i = o[o.active];
                        i && (--o.count, delete o[o.active], i.event && i.event.interrupt.call(t, t.__data__, i.index)), o.active = r, u.event && u.event.start.call(t, t.__data__, n), u.tween.forEach(function (e, r) {
                            (r = r.call(t, t.__data__, n)) && d.push(r)
                        }), h = u.ease, f = u.duration, au.timer(function () {
                            return p.c = l(e || 1) ? qn : l, 1
                        }, 0, a)
                    }

                    function l(e) {
                        if (o.active !== r)return 1;
                        for (var i = e / f, a = h(i), s = d.length; s > 0;)d[--s].call(t, a);
                        return i >= 1 ? (u.event && u.event.end.call(t, t.__data__, n), c()) : void 0
                    }

                    function c() {
                        return --o.count ? delete o[r] : delete t[e], 1
                    }

                    var f, h, g = u.delay, p = sa, d = [];
                    return p.t = g + a, i >= g ? s(i - g) : void(p.c = s)
                }, 0, a)
            }
        }

        function tu(t, n, e) {
            t.attr("transform", function (t) {
                var r = n(t);
                return "translate(" + (isFinite(r) ? r : e(t)) + ",0)"
            })
        }

        function nu(t, n, e) {
            t.attr("transform", function (t) {
                var r = n(t);
                return "translate(0," + (isFinite(r) ? r : e(t)) + ")"
            })
        }

        function eu(t) {
            return t.toISOString()
        }

        function ru(t, n, e) {
            function r(n) {
                return t(n)
            }

            function i(t, e) {
                var r = t[1] - t[0], i = r / e, o = au.bisect(Ws, i);
                return o == Ws.length ? [n.year, Wi(t.map(function (t) {
                    return t / 31536e6
                }), e)[2]] : o ? n[i / Ws[o - 1] < Ws[o] / i ? o - 1 : o] : [tl, Wi(t, e)[2]]
            }

            return r.invert = function (n) {
                return iu(t.invert(n))
            }, r.domain = function (n) {
                return arguments.length ? (t.domain(n), r) : t.domain().map(iu)
            }, r.nice = function (t, n) {
                function e(e) {
                    return !isNaN(e) && !t.range(e, iu(+e + 1), n).length
                }

                var o = r.domain(), u = Fi(o), a = null == t ? i(u, 10) : "number" == typeof t && i(u, t);
                return a && (t = a[0], n = a[1]), r.domain(Ii(o, n > 1 ? {
                    floor: function (n) {
                        for (; e(n = t.floor(n));)n = iu(n - 1);
                        return n
                    }, ceil: function (n) {
                        for (; e(n = t.ceil(n));)n = iu(+n + 1);
                        return n
                    }
                } : t))
            }, r.ticks = function (t, n) {
                var e = Fi(r.domain()), o = null == t ? i(e, 10) : "number" == typeof t ? i(e, t) : !t.range && [{range: t}, n];
                return o && (t = o[0], n = o[1]), t.range(e[0], iu(+e[1] + 1), 1 > n ? 1 : n)
            }, r.tickFormat = function () {
                return e
            }, r.copy = function () {
                return ru(t.copy(), n, e)
            }, $i(r, t)
        }

        function iu(t) {
            return new Date(t)
        }

        function ou(t) {
            return JSON.parse(t.responseText)
        }

        function uu(t) {
            var n = cu.createRange();
            return n.selectNode(cu.body), n.createContextualFragment(t.responseText)
        }

        var au = {version: "3.5.6"}, su = [].slice, lu = function (t) {
            return su.call(t)
        }, cu = this.document;
        if (cu)try {
            lu(cu.documentElement.childNodes)[0].nodeType
        } catch (fu) {
            lu = function (t) {
                for (var n = t.length, e = new Array(n); n--;)e[n] = t[n];
                return e
            }
        }
        if (Date.now || (Date.now = function () {
                return +new Date
            }), cu)try {
            cu.createElement("DIV").style.setProperty("opacity", 0, "")
        } catch (hu) {
            var gu = this.Element.prototype, pu = gu.setAttribute, du = gu.setAttributeNS, vu = this.CSSStyleDeclaration.prototype, mu = vu.setProperty;
            gu.setAttribute = function (t, n) {
                pu.call(this, t, n + "")
            }, gu.setAttributeNS = function (t, n, e) {
                du.call(this, t, n, e + "")
            }, vu.setProperty = function (t, n, e) {
                mu.call(this, t, n + "", e)
            }
        }
        au.ascending = a, au.descending = function (t, n) {
            return t > n ? -1 : n > t ? 1 : n >= t ? 0 : NaN
        }, au.min = function (t, n) {
            var e, r, i = -1, o = t.length;
            if (1 === arguments.length) {
                for (; ++i < o;)if (null != (r = t[i]) && r >= r) {
                    e = r;
                    break
                }
                for (; ++i < o;)null != (r = t[i]) && e > r && (e = r)
            } else {
                for (; ++i < o;)if (null != (r = n.call(t, t[i], i)) && r >= r) {
                    e = r;
                    break
                }
                for (; ++i < o;)null != (r = n.call(t, t[i], i)) && e > r && (e = r)
            }
            return e
        }, au.max = function (t, n) {
            var e, r, i = -1, o = t.length;
            if (1 === arguments.length) {
                for (; ++i < o;)if (null != (r = t[i]) && r >= r) {
                    e = r;
                    break
                }
                for (; ++i < o;)null != (r = t[i]) && r > e && (e = r)
            } else {
                for (; ++i < o;)if (null != (r = n.call(t, t[i], i)) && r >= r) {
                    e = r;
                    break
                }
                for (; ++i < o;)null != (r = n.call(t, t[i], i)) && r > e && (e = r)
            }
            return e
        }, au.extent = function (t, n) {
            var e, r, i, o = -1, u = t.length;
            if (1 === arguments.length) {
                for (; ++o < u;)if (null != (r = t[o]) && r >= r) {
                    e = i = r;
                    break
                }
                for (; ++o < u;)null != (r = t[o]) && (e > r && (e = r), r > i && (i = r))
            } else {
                for (; ++o < u;)if (null != (r = n.call(t, t[o], o)) && r >= r) {
                    e = i = r;
                    break
                }
                for (; ++o < u;)null != (r = n.call(t, t[o], o)) && (e > r && (e = r), r > i && (i = r))
            }
            return [e, i]
        }, au.sum = function (t, n) {
            var e, r = 0, i = t.length, o = -1;
            if (1 === arguments.length)for (; ++o < i;)l(e = +t[o]) && (r += e); else for (; ++o < i;)l(e = +n.call(t, t[o], o)) && (r += e);
            return r
        }, au.mean = function (t, n) {
            var e, r = 0, i = t.length, o = -1, u = i;
            if (1 === arguments.length)for (; ++o < i;)l(e = s(t[o])) ? r += e : --u; else for (; ++o < i;)l(e = s(n.call(t, t[o], o))) ? r += e : --u;
            return u ? r / u : void 0
        }, au.quantile = function (t, n) {
            var e = (t.length - 1) * n + 1, r = Math.floor(e), i = +t[r - 1], o = e - r;
            return o ? i + o * (t[r] - i) : i
        }, au.median = function (t, n) {
            var e, r = [], i = t.length, o = -1;
            if (1 === arguments.length)for (; ++o < i;)l(e = s(t[o])) && r.push(e); else for (; ++o < i;)l(e = s(n.call(t, t[o], o))) && r.push(e);
            return r.length ? au.quantile(r.sort(a), .5) : void 0
        }, au.variance = function (t, n) {
            var e, r, i = t.length, o = 0, u = 0, a = -1, c = 0;
            if (1 === arguments.length)for (; ++a < i;)l(e = s(t[a])) && (r = e - o, o += r / ++c, u += r * (e - o)); else for (; ++a < i;)l(e = s(n.call(t, t[a], a))) && (r = e - o, o += r / ++c, u += r * (e - o));
            return c > 1 ? u / (c - 1) : void 0
        }, au.deviation = function () {
            var t = au.variance.apply(this, arguments);
            return t ? Math.sqrt(t) : t
        };
        var yu = c(a);
        au.bisectLeft = yu.left, au.bisect = au.bisectRight = yu.right, au.bisector = function (t) {
            return c(1 === t.length ? function (n, e) {
                return a(t(n), e)
            } : t)
        }, au.shuffle = function (t, n, e) {
            (o = arguments.length) < 3 && (e = t.length, 2 > o && (n = 0));
            for (var r, i, o = e - n; o;)i = Math.random() * o-- | 0, r = t[o + n], t[o + n] = t[i + n], t[i + n] = r;
            return t
        }, au.permute = function (t, n) {
            for (var e = n.length, r = new Array(e); e--;)r[e] = t[n[e]];
            return r
        }, au.pairs = function (t) {
            for (var n, e = 0, r = t.length - 1, i = t[0], o = new Array(0 > r ? 0 : r); r > e;)o[e] = [n = i, i = t[++e]];
            return o
        }, au.zip = function () {
            if (!(r = arguments.length))return [];
            for (var t = -1, n = au.min(arguments, f), e = new Array(n); ++t < n;)for (var r, i = -1, o = e[t] = new Array(r); ++i < r;)o[i] = arguments[i][t];
            return e
        }, au.transpose = function (t) {
            return au.zip.apply(au, t)
        }, au.keys = function (t) {
            var n = [];
            for (var e in t)n.push(e);
            return n
        }, au.values = function (t) {
            var n = [];
            for (var e in t)n.push(t[e]);
            return n
        }, au.entries = function (t) {
            var n = [];
            for (var e in t)n.push({key: e, value: t[e]});
            return n
        }, au.merge = function (t) {
            for (var n, e, r, i = t.length, o = -1, u = 0; ++o < i;)u += t[o].length;
            for (e = new Array(u); --i >= 0;)for (r = t[i], n = r.length; --n >= 0;)e[--u] = r[n];
            return e
        };
        var xu = Math.abs;
        au.range = function (t, n, e) {
            if (arguments.length < 3 && (e = 1, arguments.length < 2 && (n = t, t = 0)), (n - t) / e === 1 / 0)throw new Error("infinite range");
            var r, i = [], o = h(xu(e)), u = -1;
            if (t *= o, n *= o, e *= o, 0 > e)for (; (r = t + e * ++u) > n;)i.push(r / o); else for (; (r = t + e * ++u) < n;)i.push(r / o);
            return i
        }, au.map = function (t, n) {
            var e = new p;
            if (t instanceof p)t.forEach(function (t, n) {
                e.set(t, n)
            }); else if (Array.isArray(t)) {
                var r, i = -1, o = t.length;
                if (1 === arguments.length)for (; ++i < o;)e.set(i, t[i]); else for (; ++i < o;)e.set(n.call(t, r = t[i], i), r)
            } else for (var u in t)e.set(u, t[u]);
            return e
        };
        var bu = "__proto__", Mu = "\x00";
        g(p, {
            has: m, get: function (t) {
                return this._[d(t)]
            }, set: function (t, n) {
                return this._[d(t)] = n
            }, remove: y, keys: x, values: function () {
                var t = [];
                for (var n in this._)t.push(this._[n]);
                return t
            }, entries: function () {
                var t = [];
                for (var n in this._)t.push({key: v(n), value: this._[n]});
                return t
            }, size: b, empty: M, forEach: function (t) {
                for (var n in this._)t.call(this, v(n), this._[n])
            }
        }), au.nest = function () {
            function t(n, u, a) {
                if (a >= o.length)return r ? r.call(i, u) : e ? u.sort(e) : u;
                for (var s, l, c, f, h = -1, g = u.length, d = o[a++], v = new p; ++h < g;)(f = v.get(s = d(l = u[h]))) ? f.push(l) : v.set(s, [l]);
                return n ? (l = n(), c = function (e, r) {
                    l.set(e, t(n, r, a))
                }) : (l = {}, c = function (e, r) {
                    l[e] = t(n, r, a)
                }), v.forEach(c), l
            }

            function n(t, e) {
                if (e >= o.length)return t;
                var r = [], i = u[e++];
                return t.forEach(function (t, i) {
                    r.push({key: t, values: n(i, e)})
                }), i ? r.sort(function (t, n) {
                    return i(t.key, n.key)
                }) : r
            }

            var e, r, i = {}, o = [], u = [];
            return i.map = function (n, e) {
                return t(e, n, 0)
            }, i.entries = function (e) {
                return n(t(au.map, e, 0), 0)
            }, i.key = function (t) {
                return o.push(t), i
            }, i.sortKeys = function (t) {
                return u[o.length - 1] = t, i
            }, i.sortValues = function (t) {
                return e = t, i
            }, i.rollup = function (t) {
                return r = t, i
            }, i
        }, au.set = function (t) {
            var n = new w;
            if (t)for (var e = 0, r = t.length; r > e; ++e)n.add(t[e]);
            return n
        }, g(w, {
            has: m, add: function (t) {
                return this._[d(t += "")] = !0, t
            }, remove: y, values: x, size: b, empty: M, forEach: function (t) {
                for (var n in this._)t.call(this, v(n))
            }
        }), au.behavior = {}, au.rebind = function (t, n) {
            for (var e, r = 1, i = arguments.length; ++r < i;)t[e = arguments[r]] = k(t, n, n[e]);
            return t
        };
        var wu = ["webkit", "ms", "moz", "Moz", "o", "O"];
        au.dispatch = function () {
            for (var t = new E, n = -1, e = arguments.length; ++n < e;)t[arguments[n]] = A(t);
            return t
        }, E.prototype.on = function (t, n) {
            var e = t.indexOf("."), r = "";
            if (e >= 0 && (r = t.slice(e + 1), t = t.slice(0, e)), t)return arguments.length < 2 ? this[t].on(r) : this[t].on(r, n);
            if (2 === arguments.length) {
                if (null == n)for (t in this)this.hasOwnProperty(t) && this[t].on(r, null);
                return this
            }
        }, au.event = null, au.requote = function (t) {
            return t.replace(_u, "\\$&")
        };
        var _u = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g, ku = {}.__proto__ ? function (t, n) {
            t.__proto__ = n
        } : function (t, n) {
            for (var e in n)t[e] = n[e]
        }, Su = function (t, n) {
            return n.querySelector(t)
        }, Nu = function (t, n) {
            return n.querySelectorAll(t)
        }, Eu = function (t, n) {
            var e = t.matches || t[S(t, "matchesSelector")];
            return (Eu = function (t, n) {
                return e.call(t, n)
            })(t, n)
        };
        "function" == typeof Sizzle && (Su = function (t, n) {
            return Sizzle(t, n)[0] || null
        }, Nu = Sizzle, Eu = Sizzle.matchesSelector), au.selection = function () {
            return au.select(cu.documentElement)
        };
        var Au = au.selection.prototype = [];
        Au.select = function (t) {
            var n, e, r, i, o = [];
            t = R(t);
            for (var u = -1, a = this.length; ++u < a;) {
                o.push(n = []), n.parentNode = (r = this[u]).parentNode;
                for (var s = -1, l = r.length; ++s < l;)(i = r[s]) ? (n.push(e = t.call(i, i.__data__, s, u)), e && "__data__"in i && (e.__data__ = i.__data__)) : n.push(null)
            }
            return T(o)
        }, Au.selectAll = function (t) {
            var n, e, r = [];
            t = q(t);
            for (var i = -1, o = this.length; ++i < o;)for (var u = this[i], a = -1, s = u.length; ++a < s;)(e = u[a]) && (r.push(n = lu(t.call(e, e.__data__, a, i))), n.parentNode = e);
            return T(r)
        };
        var Cu = {
            svg: "http://www.w3.org/2000/svg",
            xhtml: "http://www.w3.org/1999/xhtml",
            xlink: "http://www.w3.org/1999/xlink",
            xml: "http://www.w3.org/XML/1998/namespace",
            xmlns: "http://www.w3.org/2000/xmlns/"
        };
        au.ns = {
            prefix: Cu, qualify: function (t) {
                var n = t.indexOf(":"), e = t;
                return n >= 0 && (e = t.slice(0, n), t = t.slice(n + 1)), Cu.hasOwnProperty(e) ? {
                    space: Cu[e],
                    local: t
                } : t
            }
        }, Au.attr = function (t, n) {
            if (arguments.length < 2) {
                if ("string" == typeof t) {
                    var e = this.node();
                    return t = au.ns.qualify(t), t.local ? e.getAttributeNS(t.space, t.local) : e.getAttribute(t)
                }
                for (n in t)this.each(D(n, t[n]));
                return this
            }
            return this.each(D(t, n))
        }, Au.classed = function (t, n) {
            if (arguments.length < 2) {
                if ("string" == typeof t) {
                    var e = this.node(), r = (t = j(t)).length, i = -1;
                    if (n = e.classList) {
                        for (; ++i < r;)if (!n.contains(t[i]))return !1
                    } else for (n = e.getAttribute("class"); ++i < r;)if (!U(t[i]).test(n))return !1;
                    return !0
                }
                for (n in t)this.each(O(n, t[n]));
                return this
            }
            return this.each(O(t, n))
        }, Au.style = function (t, n, e) {
            var r = arguments.length;
            if (3 > r) {
                if ("string" != typeof t) {
                    2 > r && (n = "");
                    for (e in t)this.each(B(e, t[e], n));
                    return this
                }
                if (2 > r) {
                    var i = this.node();
                    return u(i).getComputedStyle(i, null).getPropertyValue(t)
                }
                e = ""
            }
            return this.each(B(t, n, e))
        }, Au.property = function (t, n) {
            if (arguments.length < 2) {
                if ("string" == typeof t)return this.node()[t];
                for (n in t)this.each(F(n, t[n]));
                return this
            }
            return this.each(F(t, n))
        }, Au.text = function (t) {
            return arguments.length ? this.each("function" == typeof t ? function () {
                var n = t.apply(this, arguments);
                this.textContent = null == n ? "" : n
            } : null == t ? function () {
                this.textContent = ""
            } : function () {
                this.textContent = t
            }) : this.node().textContent
        }, Au.html = function (t) {
            return arguments.length ? this.each("function" == typeof t ? function () {
                var n = t.apply(this, arguments);
                this.innerHTML = null == n ? "" : n
            } : null == t ? function () {
                this.innerHTML = ""
            } : function () {
                this.innerHTML = t
            }) : this.node().innerHTML
        }, Au.append = function (t) {
            return t = Y(t), this.select(function () {
                return this.appendChild(t.apply(this, arguments))
            })
        }, Au.insert = function (t, n) {
            return t = Y(t), n = R(n), this.select(function () {
                return this.insertBefore(t.apply(this, arguments), n.apply(this, arguments) || null)
            })
        }, Au.remove = function () {
            return this.each(X)
        }, Au.data = function (t, n) {
            function e(t, e) {
                var r, i, o, u = t.length, c = e.length, f = Math.min(u, c), h = new Array(c), g = new Array(c), d = new Array(u);
                if (n) {
                    var v, m = new p, y = new Array(u);
                    for (r = -1; ++r < u;)m.has(v = n.call(i = t[r], i.__data__, r)) ? d[r] = i : m.set(v, i), y[r] = v;
                    for (r = -1; ++r < c;)(i = m.get(v = n.call(e, o = e[r], r))) ? i !== !0 && (h[r] = i, i.__data__ = o) : g[r] = I(o), m.set(v, !0);
                    for (r = -1; ++r < u;)m.get(y[r]) !== !0 && (d[r] = t[r])
                } else {
                    for (r = -1; ++r < f;)i = t[r], o = e[r], i ? (i.__data__ = o, h[r] = i) : g[r] = I(o);
                    for (; c > r; ++r)g[r] = I(e[r]);
                    for (; u > r; ++r)d[r] = t[r]
                }
                g.update = h, g.parentNode = h.parentNode = d.parentNode = t.parentNode, a.push(g), s.push(h), l.push(d)
            }

            var r, i, o = -1, u = this.length;
            if (!arguments.length) {
                for (t = new Array(u = (r = this[0]).length); ++o < u;)(i = r[o]) && (t[o] = i.__data__);
                return t
            }
            var a = $([]), s = T([]), l = T([]);
            if ("function" == typeof t)for (; ++o < u;)e(r = this[o], t.call(r, r.parentNode.__data__, o)); else for (; ++o < u;)e(r = this[o], t);
            return s.enter = function () {
                return a
            }, s.exit = function () {
                return l
            }, s
        }, Au.datum = function (t) {
            return arguments.length ? this.property("__data__", t) : this.property("__data__")
        }, Au.filter = function (t) {
            var n, e, r, i = [];
            "function" != typeof t && (t = Z(t));
            for (var o = 0, u = this.length; u > o; o++) {
                i.push(n = []), n.parentNode = (e = this[o]).parentNode;
                for (var a = 0, s = e.length; s > a; a++)(r = e[a]) && t.call(r, r.__data__, a, o) && n.push(r)
            }
            return T(i)
        }, Au.order = function () {
            for (var t = -1, n = this.length; ++t < n;)for (var e, r = this[t], i = r.length - 1, o = r[i]; --i >= 0;)(e = r[i]) && (o && o !== e.nextSibling && o.parentNode.insertBefore(e, o), o = e);
            return this
        }, Au.sort = function (t) {
            t = J.apply(this, arguments);
            for (var n = -1, e = this.length; ++n < e;)this[n].sort(t);
            return this.order()
        }, Au.each = function (t) {
            return V(this, function (n, e, r) {
                t.call(n, n.__data__, e, r)
            })
        }, Au.call = function (t) {
            var n = lu(arguments);
            return t.apply(n[0] = this, n), this
        }, Au.empty = function () {
            return !this.node()
        }, Au.node = function () {
            for (var t = 0, n = this.length; n > t; t++)for (var e = this[t], r = 0, i = e.length; i > r; r++) {
                var o = e[r];
                if (o)return o
            }
            return null
        }, Au.size = function () {
            var t = 0;
            return V(this, function () {
                ++t
            }), t
        };
        var zu = [];
        au.selection.enter = $, au.selection.enter.prototype = zu, zu.append = Au.append, zu.empty = Au.empty, zu.node = Au.node, zu.call = Au.call, zu.size = Au.size, zu.select = function (t) {
            for (var n, e, r, i, o, u = [], a = -1, s = this.length; ++a < s;) {
                r = (i = this[a]).update, u.push(n = []), n.parentNode = i.parentNode;
                for (var l = -1, c = i.length; ++l < c;)(o = i[l]) ? (n.push(r[l] = e = t.call(i.parentNode, o.__data__, l, a)), e.__data__ = o.__data__) : n.push(null)
            }
            return T(u)
        }, zu.insert = function (t, n) {
            return arguments.length < 2 && (n = Q(this)), Au.insert.call(this, t, n)
        }, au.select = function (t) {
            var n;
            return "string" == typeof t ? (n = [Su(t, cu)], n.parentNode = cu.documentElement) : (n = [t], n.parentNode = o(t)), T([n])
        }, au.selectAll = function (t) {
            var n;
            return "string" == typeof t ? (n = lu(Nu(t, cu)), n.parentNode = cu.documentElement) : (n = t, n.parentNode = null), T([n])
        }, Au.on = function (t, n, e) {
            var r = arguments.length;
            if (3 > r) {
                if ("string" != typeof t) {
                    2 > r && (n = !1);
                    for (e in t)this.each(W(e, t[e], n));
                    return this
                }
                if (2 > r)return (r = this.node()["__on" + t]) && r._;
                e = !1
            }
            return this.each(W(t, n, e))
        };
        var Lu = au.map({mouseenter: "mouseover", mouseleave: "mouseout"});
        cu && Lu.forEach(function (t) {
            "on" + t in cu && Lu.remove(t)
        });
        var Tu, Ru = 0;
        au.mouse = function (t) {
            return nt(t, z())
        };
        var qu = this.navigator && /WebKit/.test(this.navigator.userAgent) ? -1 : 0;
        au.touch = function (t, n, e) {
            if (arguments.length < 3 && (e = n, n = z().changedTouches), n)for (var r, i = 0, o = n.length; o > i; ++i)if ((r = n[i]).identifier === e)return nt(t, r)
        }, au.behavior.drag = function () {
            function t() {
                this.on("mousedown.drag", i).on("touchstart.drag", o)
            }

            function n(t, n, i, o, u) {
                return function () {
                    function a() {
                        var t, e, r = n(h, d);
                        r && (t = r[0] - x[0], e = r[1] - x[1], p |= t | e, x = r, g({
                            type: "drag",
                            x: r[0] + l[0],
                            y: r[1] + l[1],
                            dx: t,
                            dy: e
                        }))
                    }

                    function s() {
                        n(h, d) && (m.on(o + v, null).on(u + v, null), y(p && au.event.target === f), g({type: "dragend"}))
                    }

                    var l, c = this, f = au.event.target, h = c.parentNode, g = e.of(c, arguments), p = 0, d = t(), v = ".drag" + (null == d ? "" : "-" + d), m = au.select(i(f)).on(o + v, a).on(u + v, s), y = tt(f), x = n(h, d);
                    r ? (l = r.apply(c, arguments), l = [l.x - x[0], l.y - x[1]]) : l = [0, 0], g({type: "dragstart"})
                }
            }

            var e = L(t, "drag", "dragstart", "dragend"), r = null, i = n(N, au.mouse, u, "mousemove", "mouseup"), o = n(et, au.touch, _, "touchmove", "touchend");
            return t.origin = function (n) {
                return arguments.length ? (r = n, t) : r
            }, au.rebind(t, e, "on")
        }, au.touches = function (t, n) {
            return arguments.length < 2 && (n = z().touches), n ? lu(n).map(function (n) {
                var e = nt(t, n);
                return e.identifier = n.identifier, e
            }) : []
        };
        var Du = 1e-6, Pu = Du * Du, Uu = Math.PI, ju = 2 * Uu, Ou = ju - Du, Hu = Uu / 2, Bu = Uu / 180, Fu = 180 / Uu, Yu = Math.SQRT2, Xu = 2, Iu = 4;
        au.interpolateZoom = function (t, n) {
            function e(t) {
                var n = t * y;
                if (m) {
                    var e = st(d), u = o / (Xu * h) * (e * lt(Yu * n + d) - at(d));
                    return [r + u * l, i + u * c, o * e / st(Yu * n + d)]
                }
                return [r + t * l, i + t * c, o * Math.exp(Yu * n)]
            }

            var r = t[0], i = t[1], o = t[2], u = n[0], a = n[1], s = n[2], l = u - r, c = a - i, f = l * l + c * c, h = Math.sqrt(f), g = (s * s - o * o + Iu * f) / (2 * o * Xu * h), p = (s * s - o * o - Iu * f) / (2 * s * Xu * h), d = Math.log(Math.sqrt(g * g + 1) - g), v = Math.log(Math.sqrt(p * p + 1) - p), m = v - d, y = (m || Math.log(s / o)) / Yu;
            return e.duration = 1e3 * y, e
        }, au.behavior.zoom = function () {
            function t(t) {
                t.on(z, f).on(Ju + ".zoom", g).on("dblclick.zoom", p).on(q, h)
            }

            function n(t) {
                return [(t[0] - k.x) / k.k, (t[1] - k.y) / k.k]
            }

            function e(t) {
                return [t[0] * k.k + k.x, t[1] * k.k + k.y]
            }

            function r(t) {
                k.k = Math.max(N[0], Math.min(N[1], t))
            }

            function i(t, n) {
                n = e(n), k.x += t[0] - n[0], k.y += t[1] - n[1]
            }

            function o(n, e, o, u) {
                n.__chart__ = {
                    x: k.x,
                    y: k.y,
                    k: k.k
                }, r(Math.pow(2, u)), i(v = e, o), n = au.select(n), E > 0 && (n = n.transition().duration(E)), n.call(t.event)
            }

            function a() {
                M && M.domain(b.range().map(function (t) {
                    return (t - k.x) / k.k
                }).map(b.invert)), _ && _.domain(w.range().map(function (t) {
                    return (t - k.y) / k.k
                }).map(w.invert))
            }

            function s(t) {
                A++ || t({type: "zoomstart"})
            }

            function l(t) {
                a(), t({type: "zoom", scale: k.k, translate: [k.x, k.y]})
            }

            function c(t) {
                --A || (t({type: "zoomend"}), v = null)
            }

            function f() {
                function t() {
                    f = 1, i(au.mouse(r), g), l(a)
                }

                function e() {
                    h.on(T, null).on(R, null), p(f && au.event.target === o), c(a)
                }

                var r = this, o = au.event.target, a = D.of(r, arguments), f = 0, h = au.select(u(r)).on(T, t).on(R, e), g = n(au.mouse(r)), p = tt(r);
                Bs.call(r), s(a)
            }

            function h() {
                function t() {
                    var t = au.touches(p);
                    return g = k.k, t.forEach(function (t) {
                        t.identifier in v && (v[t.identifier] = n(t))
                    }), t
                }

                function e() {
                    var n = au.event.target;
                    au.select(n).on(b, u).on(M, a), w.push(n);
                    for (var e = au.event.changedTouches, r = 0, i = e.length; i > r; ++r)v[e[r].identifier] = null;
                    var s = t(), l = Date.now();
                    if (1 === s.length) {
                        if (500 > l - x) {
                            var c = s[0];
                            o(p, c, v[c.identifier], Math.floor(Math.log(k.k) / Math.LN2) + 1), C()
                        }
                        x = l
                    } else if (s.length > 1) {
                        var c = s[0], f = s[1], h = c[0] - f[0], g = c[1] - f[1];
                        m = h * h + g * g
                    }
                }

                function u() {
                    var t, n, e, o, u = au.touches(p);
                    Bs.call(p);
                    for (var a = 0, s = u.length; s > a; ++a, o = null)if (e = u[a], o = v[e.identifier]) {
                        if (n)break;
                        t = e, n = o
                    }
                    if (o) {
                        var c = (c = e[0] - t[0]) * c + (c = e[1] - t[1]) * c, f = m && Math.sqrt(c / m);
                        t = [(t[0] + e[0]) / 2, (t[1] + e[1]) / 2], n = [(n[0] + o[0]) / 2, (n[1] + o[1]) / 2], r(f * g)
                    }
                    x = null, i(t, n), l(d)
                }

                function a() {
                    if (au.event.touches.length) {
                        for (var n = au.event.changedTouches, e = 0, r = n.length; r > e; ++e)delete v[n[e].identifier];
                        for (var i in v)return void t()
                    }
                    au.selectAll(w).on(y, null), _.on(z, f).on(q, h), S(), c(d)
                }

                var g, p = this, d = D.of(p, arguments), v = {}, m = 0, y = ".zoom-" + au.event.changedTouches[0].identifier, b = "touchmove" + y, M = "touchend" + y, w = [], _ = au.select(p), S = tt(p);
                e(), s(d), _.on(z, null).on(q, e)
            }

            function g() {
                var t = D.of(this, arguments);
                y ? clearTimeout(y) : (Bs.call(this), d = n(v = m || au.mouse(this)), s(t)), y = setTimeout(function () {
                    y = null, c(t)
                }, 50), C(), r(Math.pow(2, .002 * Zu()) * k.k), i(v, d), l(t)
            }

            function p() {
                var t = au.mouse(this), e = Math.log(k.k) / Math.LN2;
                o(this, t, n(t), au.event.shiftKey ? Math.ceil(e) - 1 : Math.floor(e) + 1)
            }

            var d, v, m, y, x, b, M, w, _, k = {
                x: 0,
                y: 0,
                k: 1
            }, S = [960, 500], N = Vu, E = 250, A = 0, z = "mousedown.zoom", T = "mousemove.zoom", R = "mouseup.zoom", q = "touchstart.zoom", D = L(t, "zoomstart", "zoom", "zoomend");
            return Ju || (Ju = "onwheel"in cu ? (Zu = function () {
                return -au.event.deltaY * (au.event.deltaMode ? 120 : 1)
            }, "wheel") : "onmousewheel"in cu ? (Zu = function () {
                return au.event.wheelDelta
            }, "mousewheel") : (Zu = function () {
                return -au.event.detail
            }, "MozMousePixelScroll")), t.event = function (t) {
                t.each(function () {
                    var t = D.of(this, arguments), n = k;
                    Os ? au.select(this).transition().each("start.zoom", function () {
                        k = this.__chart__ || {x: 0, y: 0, k: 1}, s(t)
                    }).tween("zoom:zoom", function () {
                        var e = S[0], r = S[1], i = v ? v[0] : e / 2, o = v ? v[1] : r / 2, u = au.interpolateZoom([(i - k.x) / k.k, (o - k.y) / k.k, e / k.k], [(i - n.x) / n.k, (o - n.y) / n.k, e / n.k]);
                        return function (n) {
                            var r = u(n), a = e / r[2];
                            this.__chart__ = k = {x: i - r[0] * a, y: o - r[1] * a, k: a}, l(t)
                        }
                    }).each("interrupt.zoom", function () {
                        c(t)
                    }).each("end.zoom", function () {
                        c(t)
                    }) : (this.__chart__ = k, s(t), l(t), c(t))
                })
            }, t.translate = function (n) {
                return arguments.length ? (k = {x: +n[0], y: +n[1], k: k.k}, a(), t) : [k.x, k.y]
            }, t.scale = function (n) {
                return arguments.length ? (k = {x: k.x, y: k.y, k: +n}, a(), t) : k.k
            }, t.scaleExtent = function (n) {
                return arguments.length ? (N = null == n ? Vu : [+n[0], +n[1]], t) : N
            }, t.center = function (n) {
                return arguments.length ? (m = n && [+n[0], +n[1]], t) : m
            }, t.size = function (n) {
                return arguments.length ? (S = n && [+n[0], +n[1]], t) : S
            }, t.duration = function (n) {
                return arguments.length ? (E = +n, t) : E
            }, t.x = function (n) {
                return arguments.length ? (M = n, b = n.copy(), k = {x: 0, y: 0, k: 1}, t) : M
            }, t.y = function (n) {
                return arguments.length ? (_ = n, w = n.copy(), k = {x: 0, y: 0, k: 1}, t) : _
            }, au.rebind(t, D, "on")
        };
        var Zu, Ju, Vu = [0, 1 / 0];
        au.color = ft, ft.prototype.toString = function () {
            return this.rgb() + ""
        }, au.hsl = ht;
        var $u = ht.prototype = new ft;
        $u.brighter = function (t) {
            return t = Math.pow(.7, arguments.length ? t : 1), new ht(this.h, this.s, this.l / t)
        }, $u.darker = function (t) {
            return t = Math.pow(.7, arguments.length ? t : 1), new ht(this.h, this.s, t * this.l)
        }, $u.rgb = function () {
            return gt(this.h, this.s, this.l)
        }, au.hcl = pt;
        var Qu = pt.prototype = new ft;
        Qu.brighter = function (t) {
            return new pt(this.h, this.c, Math.min(100, this.l + Wu * (arguments.length ? t : 1)))
        }, Qu.darker = function (t) {
            return new pt(this.h, this.c, Math.max(0, this.l - Wu * (arguments.length ? t : 1)))
        }, Qu.rgb = function () {
            return dt(this.h, this.c, this.l).rgb()
        }, au.lab = vt;
        var Wu = 18, Gu = .95047, Ku = 1, ta = 1.08883, na = vt.prototype = new ft;
        na.brighter = function (t) {
            return new vt(Math.min(100, this.l + Wu * (arguments.length ? t : 1)), this.a, this.b)
        }, na.darker = function (t) {
            return new vt(Math.max(0, this.l - Wu * (arguments.length ? t : 1)), this.a, this.b)
        }, na.rgb = function () {
            return mt(this.l, this.a, this.b)
        }, au.rgb = wt;
        var ea = wt.prototype = new ft;
        ea.brighter = function (t) {
            t = Math.pow(.7, arguments.length ? t : 1);
            var n = this.r, e = this.g, r = this.b, i = 30;
            return n || e || r ? (n && i > n && (n = i), e && i > e && (e = i), r && i > r && (r = i), new wt(Math.min(255, n / t), Math.min(255, e / t), Math.min(255, r / t))) : new wt(i, i, i)
        }, ea.darker = function (t) {
            return t = Math.pow(.7, arguments.length ? t : 1), new wt(t * this.r, t * this.g, t * this.b)
        }, ea.hsl = function () {
            return Et(this.r, this.g, this.b)
        }, ea.toString = function () {
            return "#" + St(this.r) + St(this.g) + St(this.b)
        };
        var ra = au.map({
            aliceblue: 15792383,
            antiquewhite: 16444375,
            aqua: 65535,
            aquamarine: 8388564,
            azure: 15794175,
            beige: 16119260,
            bisque: 16770244,
            black: 0,
            blanchedalmond: 16772045,
            blue: 255,
            blueviolet: 9055202,
            brown: 10824234,
            burlywood: 14596231,
            cadetblue: 6266528,
            chartreuse: 8388352,
            chocolate: 13789470,
            coral: 16744272,
            cornflowerblue: 6591981,
            cornsilk: 16775388,
            crimson: 14423100,
            cyan: 65535,
            darkblue: 139,
            darkcyan: 35723,
            darkgoldenrod: 12092939,
            darkgray: 11119017,
            darkgreen: 25600,
            darkgrey: 11119017,
            darkkhaki: 12433259,
            darkmagenta: 9109643,
            darkolivegreen: 5597999,
            darkorange: 16747520,
            darkorchid: 10040012,
            darkred: 9109504,
            darksalmon: 15308410,
            darkseagreen: 9419919,
            darkslateblue: 4734347,
            darkslategray: 3100495,
            darkslategrey: 3100495,
            darkturquoise: 52945,
            darkviolet: 9699539,
            deeppink: 16716947,
            deepskyblue: 49151,
            dimgray: 6908265,
            dimgrey: 6908265,
            dodgerblue: 2003199,
            firebrick: 11674146,
            floralwhite: 16775920,
            forestgreen: 2263842,
            fuchsia: 16711935,
            gainsboro: 14474460,
            ghostwhite: 16316671,
            gold: 16766720,
            goldenrod: 14329120,
            gray: 8421504,
            green: 32768,
            greenyellow: 11403055,
            grey: 8421504,
            honeydew: 15794160,
            hotpink: 16738740,
            indianred: 13458524,
            indigo: 4915330,
            ivory: 16777200,
            khaki: 15787660,
            lavender: 15132410,
            lavenderblush: 16773365,
            lawngreen: 8190976,
            lemonchiffon: 16775885,
            lightblue: 11393254,
            lightcoral: 15761536,
            lightcyan: 14745599,
            lightgoldenrodyellow: 16448210,
            lightgray: 13882323,
            lightgreen: 9498256,
            lightgrey: 13882323,
            lightpink: 16758465,
            lightsalmon: 16752762,
            lightseagreen: 2142890,
            lightskyblue: 8900346,
            lightslategray: 7833753,
            lightslategrey: 7833753,
            lightsteelblue: 11584734,
            lightyellow: 16777184,
            lime: 65280,
            limegreen: 3329330,
            linen: 16445670,
            magenta: 16711935,
            maroon: 8388608,
            mediumaquamarine: 6737322,
            mediumblue: 205,
            mediumorchid: 12211667,
            mediumpurple: 9662683,
            mediumseagreen: 3978097,
            mediumslateblue: 8087790,
            mediumspringgreen: 64154,
            mediumturquoise: 4772300,
            mediumvioletred: 13047173,
            midnightblue: 1644912,
            mintcream: 16121850,
            mistyrose: 16770273,
            moccasin: 16770229,
            navajowhite: 16768685,
            navy: 128,
            oldlace: 16643558,
            olive: 8421376,
            olivedrab: 7048739,
            orange: 16753920,
            orangered: 16729344,
            orchid: 14315734,
            palegoldenrod: 15657130,
            palegreen: 10025880,
            paleturquoise: 11529966,
            palevioletred: 14381203,
            papayawhip: 16773077,
            peachpuff: 16767673,
            peru: 13468991,
            pink: 16761035,
            plum: 14524637,
            powderblue: 11591910,
            purple: 8388736,
            rebeccapurple: 6697881,
            red: 16711680,
            rosybrown: 12357519,
            royalblue: 4286945,
            saddlebrown: 9127187,
            salmon: 16416882,
            sandybrown: 16032864,
            seagreen: 3050327,
            seashell: 16774638,
            sienna: 10506797,
            silver: 12632256,
            skyblue: 8900331,
            slateblue: 6970061,
            slategray: 7372944,
            slategrey: 7372944,
            snow: 16775930,
            springgreen: 65407,
            steelblue: 4620980,
            tan: 13808780,
            teal: 32896,
            thistle: 14204888,
            tomato: 16737095,
            turquoise: 4251856,
            violet: 15631086,
            wheat: 16113331,
            white: 16777215,
            whitesmoke: 16119285,
            yellow: 16776960,
            yellowgreen: 10145074
        });
        ra.forEach(function (t, n) {
            ra.set(t, _t(n))
        }), au.functor = Lt, au.xhr = Tt(_), au.dsv = function (t, n) {
            function e(t, e, o) {
                arguments.length < 3 && (o = e, e = null);
                var u = Rt(t, n, null == e ? r : i(e), o);
                return u.row = function (t) {
                    return arguments.length ? u.response(null == (e = t) ? r : i(t)) : e
                }, u
            }

            function r(t) {
                return e.parse(t.responseText)
            }

            function i(t) {
                return function (n) {
                    return e.parse(n.responseText, t)
                }
            }

            function o(n) {
                return n.map(u).join(t)
            }

            function u(t) {
                return a.test(t) ? '"' + t.replace(/\"/g, '""') + '"' : t
            }

            var a = new RegExp('["' + t + "\n]"), s = t.charCodeAt(0);
            return e.parse = function (t, n) {
                var r;
                return e.parseRows(t, function (t, e) {
                    if (r)return r(t, e - 1);
                    var i = new Function("d", "return {" + t.map(function (t, n) {
                            return JSON.stringify(t) + ": d[" + n + "]"
                        }).join(",") + "}");
                    r = n ? function (t, e) {
                        return n(i(t), e)
                    } : i
                })
            }, e.parseRows = function (t, n) {
                function e() {
                    if (c >= l)return u;
                    if (i)return i = !1, o;
                    var n = c;
                    if (34 === t.charCodeAt(n)) {
                        for (var e = n; e++ < l;)if (34 === t.charCodeAt(e)) {
                            if (34 !== t.charCodeAt(e + 1))break;
                            ++e
                        }
                        c = e + 2;
                        var r = t.charCodeAt(e + 1);
                        return 13 === r ? (i = !0, 10 === t.charCodeAt(e + 2) && ++c) : 10 === r && (i = !0), t.slice(n + 1, e).replace(/""/g, '"')
                    }
                    for (; l > c;) {
                        var r = t.charCodeAt(c++), a = 1;
                        if (10 === r)i = !0; else if (13 === r)i = !0, 10 === t.charCodeAt(c) && (++c, ++a); else if (r !== s)continue;
                        return t.slice(n, c - a)
                    }
                    return t.slice(n)
                }

                for (var r, i, o = {}, u = {}, a = [], l = t.length, c = 0, f = 0; (r = e()) !== u;) {
                    for (var h = []; r !== o && r !== u;)h.push(r), r = e();
                    n && null == (h = n(h, f++)) || a.push(h)
                }
                return a
            }, e.format = function (n) {
                if (Array.isArray(n[0]))return e.formatRows(n);
                var r = new w, i = [];
                return n.forEach(function (t) {
                    for (var n in t)r.has(n) || i.push(r.add(n))
                }), [i.map(u).join(t)].concat(n.map(function (n) {
                    return i.map(function (t) {
                        return u(n[t])
                    }).join(t)
                })).join("\n")
            }, e.formatRows = function (t) {
                return t.map(o).join("\n")
            }, e
        }, au.csv = au.dsv(",", "text/csv"), au.tsv = au.dsv("	", "text/tab-separated-values");
        var ia, oa, ua, aa, sa, la = this[S(this, "requestAnimationFrame")] || function (t) {
                setTimeout(t, 17)
            };
        au.timer = function (t, n, e) {
            var r = arguments.length;
            2 > r && (n = 0), 3 > r && (e = Date.now());
            var i = e + n, o = {c: t, t: i, f: !1, n: null};
            oa ? oa.n = o : ia = o, oa = o, ua || (aa = clearTimeout(aa), ua = 1, la(Pt))
        }, au.timer.flush = function () {
            Ut(), jt()
        }, au.round = function (t, n) {
            return n ? Math.round(t * (n = Math.pow(10, n))) / n : Math.round(t)
        };
        var ca = ["y", "z", "a", "f", "p", "n", "µ", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"].map(Ht);
        au.formatPrefix = function (t, n) {
            var e = 0;
            return t && (0 > t && (t *= -1), n && (t = au.round(t, Ot(t, n))), e = 1 + Math.floor(1e-12 + Math.log(t) / Math.LN10), e = Math.max(-24, Math.min(24, 3 * Math.floor((e - 1) / 3)))), ca[8 + e / 3]
        };
        var fa = /(?:([^{])?([<>=^]))?([+\- ])?([$#])?(0)?(\d+)?(,)?(\.-?\d+)?([a-z%])?/i, ha = au.map({
            b: function (t) {
                return t.toString(2)
            }, c: function (t) {
                return String.fromCharCode(t)
            }, o: function (t) {
                return t.toString(8)
            }, x: function (t) {
                return t.toString(16)
            }, X: function (t) {
                return t.toString(16).toUpperCase()
            }, g: function (t, n) {
                return t.toPrecision(n)
            }, e: function (t, n) {
                return t.toExponential(n)
            }, f: function (t, n) {
                return t.toFixed(n)
            }, r: function (t, n) {
                return (t = au.round(t, Ot(t, n))).toFixed(Math.max(0, Math.min(20, Ot(t * (1 + 1e-15), n))))
            }
        }), ga = au.time = {}, pa = Date;
        Yt.prototype = {
            getDate: function () {
                return this._.getUTCDate()
            }, getDay: function () {
                return this._.getUTCDay()
            }, getFullYear: function () {
                return this._.getUTCFullYear()
            }, getHours: function () {
                return this._.getUTCHours()
            }, getMilliseconds: function () {
                return this._.getUTCMilliseconds()
            }, getMinutes: function () {
                return this._.getUTCMinutes()
            }, getMonth: function () {
                return this._.getUTCMonth()
            }, getSeconds: function () {
                return this._.getUTCSeconds()
            }, getTime: function () {
                return this._.getTime()
            }, getTimezoneOffset: function () {
                return 0
            }, valueOf: function () {
                return this._.valueOf()
            }, setDate: function () {
                da.setUTCDate.apply(this._, arguments)
            }, setDay: function () {
                da.setUTCDay.apply(this._, arguments)
            }, setFullYear: function () {
                da.setUTCFullYear.apply(this._, arguments)
            }, setHours: function () {
                da.setUTCHours.apply(this._, arguments)
            }, setMilliseconds: function () {
                da.setUTCMilliseconds.apply(this._, arguments)
            }, setMinutes: function () {
                da.setUTCMinutes.apply(this._, arguments)
            }, setMonth: function () {
                da.setUTCMonth.apply(this._, arguments)
            }, setSeconds: function () {
                da.setUTCSeconds.apply(this._, arguments)
            }, setTime: function () {
                da.setTime.apply(this._, arguments)
            }
        };
        var da = Date.prototype;
        ga.year = Xt(function (t) {
            return t = ga.day(t), t.setMonth(0, 1), t
        }, function (t, n) {
            t.setFullYear(t.getFullYear() + n)
        }, function (t) {
            return t.getFullYear()
        }), ga.years = ga.year.range, ga.years.utc = ga.year.utc.range, ga.day = Xt(function (t) {
            var n = new pa(2e3, 0);
            return n.setFullYear(t.getFullYear(), t.getMonth(), t.getDate()), n
        }, function (t, n) {
            t.setDate(t.getDate() + n)
        }, function (t) {
            return t.getDate() - 1
        }), ga.days = ga.day.range, ga.days.utc = ga.day.utc.range, ga.dayOfYear = function (t) {
            var n = ga.year(t);
            return Math.floor((t - n - 6e4 * (t.getTimezoneOffset() - n.getTimezoneOffset())) / 864e5)
        }, ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].forEach(function (t, n) {
            n = 7 - n;
            var e = ga[t] = Xt(function (t) {
                return (t = ga.day(t)).setDate(t.getDate() - (t.getDay() + n) % 7), t
            }, function (t, n) {
                t.setDate(t.getDate() + 7 * Math.floor(n))
            }, function (t) {
                var e = ga.year(t).getDay();
                return Math.floor((ga.dayOfYear(t) + (e + n) % 7) / 7) - (e !== n)
            });
            ga[t + "s"] = e.range, ga[t + "s"].utc = e.utc.range, ga[t + "OfYear"] = function (t) {
                var e = ga.year(t).getDay();
                return Math.floor((ga.dayOfYear(t) + (e + n) % 7) / 7)
            }
        }), ga.week = ga.sunday,
            ga.weeks = ga.sunday.range, ga.weeks.utc = ga.sunday.utc.range, ga.weekOfYear = ga.sundayOfYear;
        var va = {"-": "", _: " ", 0: "0"}, ma = /^\s*\d+/, ya = /^%/;
        au.locale = function (t) {
            return {numberFormat: Bt(t), timeFormat: Zt(t)}
        };
        var xa = au.locale({
            decimal: ".",
            thousands: ",",
            grouping: [3],
            currency: ["$", ""],
            dateTime: "%a %b %e %X %Y",
            date: "%m/%d/%Y",
            time: "%H:%M:%S",
            periods: ["AM", "PM"],
            days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        });
        au.format = xa.numberFormat, au.geo = {}, pn.prototype = {
            s: 0, t: 0, add: function (t) {
                dn(t, this.t, ba), dn(ba.s, this.s, this), this.s ? this.t += ba.t : this.s = ba.t
            }, reset: function () {
                this.s = this.t = 0
            }, valueOf: function () {
                return this.s
            }
        };
        var ba = new pn;
        au.geo.stream = function (t, n) {
            t && Ma.hasOwnProperty(t.type) ? Ma[t.type](t, n) : vn(t, n)
        };
        var Ma = {
            Feature: function (t, n) {
                vn(t.geometry, n)
            }, FeatureCollection: function (t, n) {
                for (var e = t.features, r = -1, i = e.length; ++r < i;)vn(e[r].geometry, n)
            }
        }, wa = {
            Sphere: function (t, n) {
                n.sphere()
            }, Point: function (t, n) {
                t = t.coordinates, n.point(t[0], t[1], t[2])
            }, MultiPoint: function (t, n) {
                for (var e = t.coordinates, r = -1, i = e.length; ++r < i;)t = e[r], n.point(t[0], t[1], t[2])
            }, LineString: function (t, n) {
                mn(t.coordinates, n, 0)
            }, MultiLineString: function (t, n) {
                for (var e = t.coordinates, r = -1, i = e.length; ++r < i;)mn(e[r], n, 0)
            }, Polygon: function (t, n) {
                yn(t.coordinates, n)
            }, MultiPolygon: function (t, n) {
                for (var e = t.coordinates, r = -1, i = e.length; ++r < i;)yn(e[r], n)
            }, GeometryCollection: function (t, n) {
                for (var e = t.geometries, r = -1, i = e.length; ++r < i;)vn(e[r], n)
            }
        };
        au.geo.area = function (t) {
            return _a = 0, au.geo.stream(t, Sa), _a
        };
        var _a, ka = new pn, Sa = {
            sphere: function () {
                _a += 4 * Uu
            }, point: N, lineStart: N, lineEnd: N, polygonStart: function () {
                ka.reset(), Sa.lineStart = xn
            }, polygonEnd: function () {
                var t = 2 * ka;
                _a += 0 > t ? 4 * Uu + t : t, Sa.lineStart = Sa.lineEnd = Sa.point = N
            }
        };
        au.geo.bounds = function () {
            function t(t, n) {
                x.push(b = [c = t, h = t]), f > n && (f = n), n > g && (g = n)
            }

            function n(n, e) {
                var r = bn([n * Bu, e * Bu]);
                if (m) {
                    var i = wn(m, r), o = [i[1], -i[0], 0], u = wn(o, i);
                    Sn(u), u = Nn(u);
                    var s = n - p, l = s > 0 ? 1 : -1, d = u[0] * Fu * l, v = xu(s) > 180;
                    if (v ^ (d > l * p && l * n > d)) {
                        var y = u[1] * Fu;
                        y > g && (g = y)
                    } else if (d = (d + 360) % 360 - 180, v ^ (d > l * p && l * n > d)) {
                        var y = -u[1] * Fu;
                        f > y && (f = y)
                    } else f > e && (f = e), e > g && (g = e);
                    v ? p > n ? a(c, n) > a(c, h) && (h = n) : a(n, h) > a(c, h) && (c = n) : h >= c ? (c > n && (c = n), n > h && (h = n)) : n > p ? a(c, n) > a(c, h) && (h = n) : a(n, h) > a(c, h) && (c = n)
                } else t(n, e);
                m = r, p = n
            }

            function e() {
                M.point = n
            }

            function r() {
                b[0] = c, b[1] = h, M.point = t, m = null
            }

            function i(t, e) {
                if (m) {
                    var r = t - p;
                    y += xu(r) > 180 ? r + (r > 0 ? 360 : -360) : r
                } else d = t, v = e;
                Sa.point(t, e), n(t, e)
            }

            function o() {
                Sa.lineStart()
            }

            function u() {
                i(d, v), Sa.lineEnd(), xu(y) > Du && (c = -(h = 180)), b[0] = c, b[1] = h, m = null
            }

            function a(t, n) {
                return (n -= t) < 0 ? n + 360 : n
            }

            function s(t, n) {
                return t[0] - n[0]
            }

            function l(t, n) {
                return n[0] <= n[1] ? n[0] <= t && t <= n[1] : t < n[0] || n[1] < t
            }

            var c, f, h, g, p, d, v, m, y, x, b, M = {
                point: t, lineStart: e, lineEnd: r, polygonStart: function () {
                    M.point = i, M.lineStart = o, M.lineEnd = u, y = 0, Sa.polygonStart()
                }, polygonEnd: function () {
                    Sa.polygonEnd(), M.point = t, M.lineStart = e, M.lineEnd = r, 0 > ka ? (c = -(h = 180), f = -(g = 90)) : y > Du ? g = 90 : -Du > y && (f = -90), b[0] = c, b[1] = h
                }
            };
            return function (t) {
                g = h = -(c = f = 1 / 0), x = [], au.geo.stream(t, M);
                var n = x.length;
                if (n) {
                    x.sort(s);
                    for (var e, r = 1, i = x[0], o = [i]; n > r; ++r)e = x[r], l(e[0], i) || l(e[1], i) ? (a(i[0], e[1]) > a(i[0], i[1]) && (i[1] = e[1]), a(e[0], i[1]) > a(i[0], i[1]) && (i[0] = e[0])) : o.push(i = e);
                    for (var u, e, p = -(1 / 0), n = o.length - 1, r = 0, i = o[n]; n >= r; i = e, ++r)e = o[r], (u = a(i[1], e[0])) > p && (p = u, c = e[0], h = i[1])
                }
                return x = b = null, c === 1 / 0 || f === 1 / 0 ? [[NaN, NaN], [NaN, NaN]] : [[c, f], [h, g]]
            }
        }(), au.geo.centroid = function (t) {
            Na = Ea = Aa = Ca = za = La = Ta = Ra = qa = Da = Pa = 0, au.geo.stream(t, Ua);
            var n = qa, e = Da, r = Pa, i = n * n + e * e + r * r;
            return Pu > i && (n = La, e = Ta, r = Ra, Du > Ea && (n = Aa, e = Ca, r = za), i = n * n + e * e + r * r, Pu > i) ? [NaN, NaN] : [Math.atan2(e, n) * Fu, ut(r / Math.sqrt(i)) * Fu]
        };
        var Na, Ea, Aa, Ca, za, La, Ta, Ra, qa, Da, Pa, Ua = {
            sphere: N,
            point: An,
            lineStart: zn,
            lineEnd: Ln,
            polygonStart: function () {
                Ua.lineStart = Tn
            },
            polygonEnd: function () {
                Ua.lineStart = zn
            }
        }, ja = jn(qn, Fn, Xn, [-Uu, -Uu / 2]), Oa = 1e9;
        au.geo.clipExtent = function () {
            var t, n, e, r, i, o, u = {
                stream: function (t) {
                    return i && (i.valid = !1), i = o(t), i.valid = !0, i
                }, extent: function (a) {
                    return arguments.length ? (o = Vn(t = +a[0][0], n = +a[0][1], e = +a[1][0], r = +a[1][1]), i && (i.valid = !1, i = null), u) : [[t, n], [e, r]]
                }
            };
            return u.extent([[0, 0], [960, 500]])
        }, (au.geo.conicEqualArea = function () {
            return $n(Qn)
        }).raw = Qn, au.geo.albers = function () {
            return au.geo.conicEqualArea().rotate([96, 0]).center([-.6, 38.7]).parallels([29.5, 45.5]).scale(1070)
        }, au.geo.albersUsa = function () {
            function t(t) {
                var o = t[0], u = t[1];
                return n = null, e(o, u), n || (r(o, u), n) || i(o, u), n
            }

            var n, e, r, i, o = au.geo.albers(), u = au.geo.conicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]), a = au.geo.conicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]), s = {
                point: function (t, e) {
                    n = [t, e]
                }
            };
            return t.invert = function (t) {
                var n = o.scale(), e = o.translate(), r = (t[0] - e[0]) / n, i = (t[1] - e[1]) / n;
                return (i >= .12 && .234 > i && r >= -.425 && -.214 > r ? u : i >= .166 && .234 > i && r >= -.214 && -.115 > r ? a : o).invert(t)
            }, t.stream = function (t) {
                var n = o.stream(t), e = u.stream(t), r = a.stream(t);
                return {
                    point: function (t, i) {
                        n.point(t, i), e.point(t, i), r.point(t, i)
                    }, sphere: function () {
                        n.sphere(), e.sphere(), r.sphere()
                    }, lineStart: function () {
                        n.lineStart(), e.lineStart(), r.lineStart()
                    }, lineEnd: function () {
                        n.lineEnd(), e.lineEnd(), r.lineEnd()
                    }, polygonStart: function () {
                        n.polygonStart(), e.polygonStart(), r.polygonStart()
                    }, polygonEnd: function () {
                        n.polygonEnd(), e.polygonEnd(), r.polygonEnd()
                    }
                }
            }, t.precision = function (n) {
                return arguments.length ? (o.precision(n), u.precision(n), a.precision(n), t) : o.precision()
            }, t.scale = function (n) {
                return arguments.length ? (o.scale(n), u.scale(.35 * n), a.scale(n), t.translate(o.translate())) : o.scale()
            }, t.translate = function (n) {
                if (!arguments.length)return o.translate();
                var l = o.scale(), c = +n[0], f = +n[1];
                return e = o.translate(n).clipExtent([[c - .455 * l, f - .238 * l], [c + .455 * l, f + .238 * l]]).stream(s).point, r = u.translate([c - .307 * l, f + .201 * l]).clipExtent([[c - .425 * l + Du, f + .12 * l + Du], [c - .214 * l - Du, f + .234 * l - Du]]).stream(s).point, i = a.translate([c - .205 * l, f + .212 * l]).clipExtent([[c - .214 * l + Du, f + .166 * l + Du], [c - .115 * l - Du, f + .234 * l - Du]]).stream(s).point, t
            }, t.scale(1070)
        };
        var Ha, Ba, Fa, Ya, Xa, Ia, Za = {
            point: N, lineStart: N, lineEnd: N, polygonStart: function () {
                Ba = 0, Za.lineStart = Wn
            }, polygonEnd: function () {
                Za.lineStart = Za.lineEnd = Za.point = N, Ha += xu(Ba / 2)
            }
        }, Ja = {point: Gn, lineStart: N, lineEnd: N, polygonStart: N, polygonEnd: N}, Va = {
            point: ne,
            lineStart: ee,
            lineEnd: re,
            polygonStart: function () {
                Va.lineStart = ie
            },
            polygonEnd: function () {
                Va.point = ne, Va.lineStart = ee, Va.lineEnd = re
            }
        };
        au.geo.path = function () {
            function t(t) {
                return t && ("function" == typeof a && o.pointRadius(+a.apply(this, arguments)), u && u.valid || (u = i(o)), au.geo.stream(t, u)), o.result()
            }

            function n() {
                return u = null, t
            }

            var e, r, i, o, u, a = 4.5;
            return t.area = function (t) {
                return Ha = 0, au.geo.stream(t, i(Za)), Ha
            }, t.centroid = function (t) {
                return Aa = Ca = za = La = Ta = Ra = qa = Da = Pa = 0, au.geo.stream(t, i(Va)), Pa ? [qa / Pa, Da / Pa] : Ra ? [La / Ra, Ta / Ra] : za ? [Aa / za, Ca / za] : [NaN, NaN]
            }, t.bounds = function (t) {
                return Xa = Ia = -(Fa = Ya = 1 / 0), au.geo.stream(t, i(Ja)), [[Fa, Ya], [Xa, Ia]]
            }, t.projection = function (t) {
                return arguments.length ? (i = (e = t) ? t.stream || ae(t) : _, n()) : e
            }, t.context = function (t) {
                return arguments.length ? (o = null == (r = t) ? new Kn : new oe(t), "function" != typeof a && o.pointRadius(a), n()) : r
            }, t.pointRadius = function (n) {
                return arguments.length ? (a = "function" == typeof n ? n : (o.pointRadius(+n), +n), t) : a
            }, t.projection(au.geo.albersUsa()).context(null)
        }, au.geo.transform = function (t) {
            return {
                stream: function (n) {
                    var e = new se(n);
                    for (var r in t)e[r] = t[r];
                    return e
                }
            }
        }, se.prototype = {
            point: function (t, n) {
                this.stream.point(t, n)
            }, sphere: function () {
                this.stream.sphere()
            }, lineStart: function () {
                this.stream.lineStart()
            }, lineEnd: function () {
                this.stream.lineEnd()
            }, polygonStart: function () {
                this.stream.polygonStart()
            }, polygonEnd: function () {
                this.stream.polygonEnd()
            }
        }, au.geo.projection = ce, au.geo.projectionMutator = fe, (au.geo.equirectangular = function () {
            return ce(ge)
        }).raw = ge.invert = ge, au.geo.rotation = function (t) {
            function n(n) {
                return n = t(n[0] * Bu, n[1] * Bu), n[0] *= Fu, n[1] *= Fu, n
            }

            return t = de(t[0] % 360 * Bu, t[1] * Bu, t.length > 2 ? t[2] * Bu : 0), n.invert = function (n) {
                return n = t.invert(n[0] * Bu, n[1] * Bu), n[0] *= Fu, n[1] *= Fu, n
            }, n
        }, pe.invert = ge, au.geo.circle = function () {
            function t() {
                var t = "function" == typeof r ? r.apply(this, arguments) : r, n = de(-t[0] * Bu, -t[1] * Bu, 0).invert, i = [];
                return e(null, null, 1, {
                    point: function (t, e) {
                        i.push(t = n(t, e)), t[0] *= Fu, t[1] *= Fu
                    }
                }), {type: "Polygon", coordinates: [i]}
            }

            var n, e, r = [0, 0], i = 6;
            return t.origin = function (n) {
                return arguments.length ? (r = n, t) : r
            }, t.angle = function (r) {
                return arguments.length ? (e = xe((n = +r) * Bu, i * Bu), t) : n
            }, t.precision = function (r) {
                return arguments.length ? (e = xe(n * Bu, (i = +r) * Bu), t) : i
            }, t.angle(90)
        }, au.geo.distance = function (t, n) {
            var e, r = (n[0] - t[0]) * Bu, i = t[1] * Bu, o = n[1] * Bu, u = Math.sin(r), a = Math.cos(r), s = Math.sin(i), l = Math.cos(i), c = Math.sin(o), f = Math.cos(o);
            return Math.atan2(Math.sqrt((e = f * u) * e + (e = l * c - s * f * a) * e), s * c + l * f * a)
        }, au.geo.graticule = function () {
            function t() {
                return {type: "MultiLineString", coordinates: n()}
            }

            function n() {
                return au.range(Math.ceil(o / v) * v, i, v).map(h).concat(au.range(Math.ceil(l / m) * m, s, m).map(g)).concat(au.range(Math.ceil(r / p) * p, e, p).filter(function (t) {
                    return xu(t % v) > Du
                }).map(c)).concat(au.range(Math.ceil(a / d) * d, u, d).filter(function (t) {
                    return xu(t % m) > Du
                }).map(f))
            }

            var e, r, i, o, u, a, s, l, c, f, h, g, p = 10, d = p, v = 90, m = 360, y = 2.5;
            return t.lines = function () {
                return n().map(function (t) {
                    return {type: "LineString", coordinates: t}
                })
            }, t.outline = function () {
                return {
                    type: "Polygon",
                    coordinates: [h(o).concat(g(s).slice(1), h(i).reverse().slice(1), g(l).reverse().slice(1))]
                }
            }, t.extent = function (n) {
                return arguments.length ? t.majorExtent(n).minorExtent(n) : t.minorExtent()
            }, t.majorExtent = function (n) {
                return arguments.length ? (o = +n[0][0], i = +n[1][0], l = +n[0][1], s = +n[1][1], o > i && (n = o, o = i, i = n), l > s && (n = l, l = s, s = n), t.precision(y)) : [[o, l], [i, s]]
            }, t.minorExtent = function (n) {
                return arguments.length ? (r = +n[0][0], e = +n[1][0], a = +n[0][1], u = +n[1][1], r > e && (n = r, r = e, e = n), a > u && (n = a, a = u, u = n), t.precision(y)) : [[r, a], [e, u]]
            }, t.step = function (n) {
                return arguments.length ? t.majorStep(n).minorStep(n) : t.minorStep()
            }, t.majorStep = function (n) {
                return arguments.length ? (v = +n[0], m = +n[1], t) : [v, m]
            }, t.minorStep = function (n) {
                return arguments.length ? (p = +n[0], d = +n[1], t) : [p, d]
            }, t.precision = function (n) {
                return arguments.length ? (y = +n, c = Me(a, u, 90), f = we(r, e, y), h = Me(l, s, 90), g = we(o, i, y), t) : y
            }, t.majorExtent([[-180, -90 + Du], [180, 90 - Du]]).minorExtent([[-180, -80 - Du], [180, 80 + Du]])
        }, au.geo.greatArc = function () {
            function t() {
                return {type: "LineString", coordinates: [n || r.apply(this, arguments), e || i.apply(this, arguments)]}
            }

            var n, e, r = _e, i = ke;
            return t.distance = function () {
                return au.geo.distance(n || r.apply(this, arguments), e || i.apply(this, arguments))
            }, t.source = function (e) {
                return arguments.length ? (r = e, n = "function" == typeof e ? null : e, t) : r
            }, t.target = function (n) {
                return arguments.length ? (i = n, e = "function" == typeof n ? null : n, t) : i
            }, t.precision = function () {
                return arguments.length ? t : 0
            }, t
        }, au.geo.interpolate = function (t, n) {
            return Se(t[0] * Bu, t[1] * Bu, n[0] * Bu, n[1] * Bu)
        }, au.geo.length = function (t) {
            return $a = 0, au.geo.stream(t, Qa), $a
        };
        var $a, Qa = {
            sphere: N,
            point: N,
            lineStart: Ne,
            lineEnd: N,
            polygonStart: N,
            polygonEnd: N
        }, Wa = Ee(function (t) {
            return Math.sqrt(2 / (1 + t))
        }, function (t) {
            return 2 * Math.asin(t / 2)
        });
        (au.geo.azimuthalEqualArea = function () {
            return ce(Wa)
        }).raw = Wa;
        var Ga = Ee(function (t) {
            var n = Math.acos(t);
            return n && n / Math.sin(n)
        }, _);
        (au.geo.azimuthalEquidistant = function () {
            return ce(Ga)
        }).raw = Ga, (au.geo.conicConformal = function () {
            return $n(Ae)
        }).raw = Ae, (au.geo.conicEquidistant = function () {
            return $n(Ce)
        }).raw = Ce;
        var Ka = Ee(function (t) {
            return 1 / t
        }, Math.atan);
        (au.geo.gnomonic = function () {
            return ce(Ka)
        }).raw = Ka, ze.invert = function (t, n) {
            return [t, 2 * Math.atan(Math.exp(n)) - Hu]
        }, (au.geo.mercator = function () {
            return Le(ze)
        }).raw = ze;
        var ts = Ee(function () {
            return 1
        }, Math.asin);
        (au.geo.orthographic = function () {
            return ce(ts)
        }).raw = ts;
        var ns = Ee(function (t) {
            return 1 / (1 + t)
        }, function (t) {
            return 2 * Math.atan(t)
        });
        (au.geo.stereographic = function () {
            return ce(ns)
        }).raw = ns, Te.invert = function (t, n) {
            return [-n, 2 * Math.atan(Math.exp(t)) - Hu]
        }, (au.geo.transverseMercator = function () {
            var t = Le(Te), n = t.center, e = t.rotate;
            return t.center = function (t) {
                return t ? n([-t[1], t[0]]) : (t = n(), [t[1], -t[0]])
            }, t.rotate = function (t) {
                return t ? e([t[0], t[1], t.length > 2 ? t[2] + 90 : 90]) : (t = e(), [t[0], t[1], t[2] - 90])
            }, e([0, 0, 90])
        }).raw = Te, au.geom = {}, au.geom.hull = function (t) {
            function n(t) {
                if (t.length < 3)return [];
                var n, i = Lt(e), o = Lt(r), u = t.length, a = [], s = [];
                for (n = 0; u > n; n++)a.push([+i.call(this, t[n], n), +o.call(this, t[n], n), n]);
                for (a.sort(Pe), n = 0; u > n; n++)s.push([a[n][0], -a[n][1]]);
                var l = De(a), c = De(s), f = c[0] === l[0], h = c[c.length - 1] === l[l.length - 1], g = [];
                for (n = l.length - 1; n >= 0; --n)g.push(t[a[l[n]][2]]);
                for (n = +f; n < c.length - h; ++n)g.push(t[a[c[n]][2]]);
                return g
            }

            var e = Re, r = qe;
            return arguments.length ? n(t) : (n.x = function (t) {
                return arguments.length ? (e = t, n) : e
            }, n.y = function (t) {
                return arguments.length ? (r = t, n) : r
            }, n)
        }, au.geom.polygon = function (t) {
            return ku(t, es), t
        };
        var es = au.geom.polygon.prototype = [];
        es.area = function () {
            for (var t, n = -1, e = this.length, r = this[e - 1], i = 0; ++n < e;)t = r, r = this[n], i += t[1] * r[0] - t[0] * r[1];
            return .5 * i
        }, es.centroid = function (t) {
            var n, e, r = -1, i = this.length, o = 0, u = 0, a = this[i - 1];
            for (arguments.length || (t = -1 / (6 * this.area())); ++r < i;)n = a, a = this[r], e = n[0] * a[1] - a[0] * n[1], o += (n[0] + a[0]) * e, u += (n[1] + a[1]) * e;
            return [o * t, u * t]
        }, es.clip = function (t) {
            for (var n, e, r, i, o, u, a = Oe(t), s = -1, l = this.length - Oe(this), c = this[l - 1]; ++s < l;) {
                for (n = t.slice(), t.length = 0, i = this[s], o = n[(r = n.length - a) - 1], e = -1; ++e < r;)u = n[e], Ue(u, c, i) ? (Ue(o, c, i) || t.push(je(o, u, c, i)), t.push(u)) : Ue(o, c, i) && t.push(je(o, u, c, i)), o = u;
                a && t.push(t[0]), c = i
            }
            return t
        };
        var rs, is, os, us, as, ss = [], ls = [];
        Je.prototype.prepare = function () {
            for (var t, n = this.edges, e = n.length; e--;)t = n[e].edge, t.b && t.a || n.splice(e, 1);
            return n.sort($e), n.length
        }, or.prototype = {
            start: function () {
                return this.edge.l === this.site ? this.edge.a : this.edge.b
            }, end: function () {
                return this.edge.l === this.site ? this.edge.b : this.edge.a
            }
        }, ur.prototype = {
            insert: function (t, n) {
                var e, r, i;
                if (t) {
                    if (n.P = t, n.N = t.N, t.N && (t.N.P = n), t.N = n, t.R) {
                        for (t = t.R; t.L;)t = t.L;
                        t.L = n
                    } else t.R = n;
                    e = t
                } else this._ ? (t = cr(this._), n.P = null, n.N = t, t.P = t.L = n, e = t) : (n.P = n.N = null, this._ = n, e = null);
                for (n.L = n.R = null, n.U = e, n.C = !0, t = n; e && e.C;)r = e.U, e === r.L ? (i = r.R, i && i.C ? (e.C = i.C = !1, r.C = !0, t = r) : (t === e.R && (sr(this, e), t = e, e = t.U), e.C = !1, r.C = !0, lr(this, r))) : (i = r.L, i && i.C ? (e.C = i.C = !1, r.C = !0, t = r) : (t === e.L && (lr(this, e), t = e, e = t.U), e.C = !1, r.C = !0, sr(this, r))), e = t.U;
                this._.C = !1
            }, remove: function (t) {
                t.N && (t.N.P = t.P), t.P && (t.P.N = t.N), t.N = t.P = null;
                var n, e, r, i = t.U, o = t.L, u = t.R;
                if (e = o ? u ? cr(u) : o : u, i ? i.L === t ? i.L = e : i.R = e : this._ = e, o && u ? (r = e.C, e.C = t.C, e.L = o, o.U = e, e !== u ? (i = e.U, e.U = t.U, t = e.R, i.L = t, e.R = u, u.U = e) : (e.U = i, i = e, t = e.R)) : (r = t.C, t = e), t && (t.U = i), !r) {
                    if (t && t.C)return void(t.C = !1);
                    do {
                        if (t === this._)break;
                        if (t === i.L) {
                            if (n = i.R, n.C && (n.C = !1, i.C = !0, sr(this, i), n = i.R), n.L && n.L.C || n.R && n.R.C) {
                                n.R && n.R.C || (n.L.C = !1, n.C = !0, lr(this, n), n = i.R), n.C = i.C, i.C = n.R.C = !1, sr(this, i), t = this._;
                                break
                            }
                        } else if (n = i.L, n.C && (n.C = !1, i.C = !0, lr(this, i), n = i.L), n.L && n.L.C || n.R && n.R.C) {
                            n.L && n.L.C || (n.R.C = !1, n.C = !0, sr(this, n), n = i.L), n.C = i.C, i.C = n.L.C = !1, lr(this, i), t = this._;
                            break
                        }
                        n.C = !0, t = i, i = i.U
                    } while (!t.C);
                    t && (t.C = !1)
                }
            }
        }, au.geom.voronoi = function (t) {
            function n(t) {
                var n = new Array(t.length), r = a[0][0], i = a[0][1], o = a[1][0], u = a[1][1];
                return fr(e(t), a).cells.forEach(function (e, a) {
                    var s = e.edges, l = e.site, c = n[a] = s.length ? s.map(function (t) {
                        var n = t.start();
                        return [n.x, n.y]
                    }) : l.x >= r && l.x <= o && l.y >= i && l.y <= u ? [[r, u], [o, u], [o, i], [r, i]] : [];
                    c.point = t[a]
                }), n
            }

            function e(t) {
                return t.map(function (t, n) {
                    return {x: Math.round(o(t, n) / Du) * Du, y: Math.round(u(t, n) / Du) * Du, i: n}
                })
            }

            var r = Re, i = qe, o = r, u = i, a = cs;
            return t ? n(t) : (n.links = function (t) {
                return fr(e(t)).edges.filter(function (t) {
                    return t.l && t.r
                }).map(function (n) {
                    return {source: t[n.l.i], target: t[n.r.i]}
                })
            }, n.triangles = function (t) {
                var n = [];
                return fr(e(t)).cells.forEach(function (e, r) {
                    for (var i, o, u = e.site, a = e.edges.sort($e), s = -1, l = a.length, c = a[l - 1].edge, f = c.l === u ? c.r : c.l; ++s < l;)i = c, o = f, c = a[s].edge, f = c.l === u ? c.r : c.l, r < o.i && r < f.i && gr(u, o, f) < 0 && n.push([t[r], t[o.i], t[f.i]])
                }), n
            }, n.x = function (t) {
                return arguments.length ? (o = Lt(r = t), n) : r
            }, n.y = function (t) {
                return arguments.length ? (u = Lt(i = t), n) : i
            }, n.clipExtent = function (t) {
                return arguments.length ? (a = null == t ? cs : t, n) : a === cs ? null : a
            }, n.size = function (t) {
                return arguments.length ? n.clipExtent(t && [[0, 0], t]) : a === cs ? null : a && a[1]
            }, n)
        };
        var cs = [[-1e6, -1e6], [1e6, 1e6]];
        au.geom.delaunay = function (t) {
            return au.geom.voronoi().triangles(t)
        }, au.geom.quadtree = function (t, n, e, r, i) {
            function o(t) {
                function o(t, n, e, r, i, o, u, a) {
                    if (!isNaN(e) && !isNaN(r))if (t.leaf) {
                        var s = t.x, c = t.y;
                        if (null != s)if (xu(s - e) + xu(c - r) < .01)l(t, n, e, r, i, o, u, a); else {
                            var f = t.point;
                            t.x = t.y = t.point = null, l(t, f, s, c, i, o, u, a), l(t, n, e, r, i, o, u, a)
                        } else t.x = e, t.y = r, t.point = n
                    } else l(t, n, e, r, i, o, u, a)
                }

                function l(t, n, e, r, i, u, a, s) {
                    var l = .5 * (i + a), c = .5 * (u + s), f = e >= l, h = r >= c, g = h << 1 | f;
                    t.leaf = !1, t = t.nodes[g] || (t.nodes[g] = vr()), f ? i = l : a = l, h ? u = c : s = c, o(t, n, e, r, i, u, a, s)
                }

                var c, f, h, g, p, d, v, m, y, x = Lt(a), b = Lt(s);
                if (null != n)d = n, v = e, m = r, y = i; else if (m = y = -(d = v = 1 / 0), f = [], h = [], p = t.length, u)for (g = 0; p > g; ++g)c = t[g], c.x < d && (d = c.x), c.y < v && (v = c.y), c.x > m && (m = c.x), c.y > y && (y = c.y), f.push(c.x), h.push(c.y); else for (g = 0; p > g; ++g) {
                    var M = +x(c = t[g], g), w = +b(c, g);
                    d > M && (d = M), v > w && (v = w), M > m && (m = M), w > y && (y = w), f.push(M), h.push(w)
                }
                var _ = m - d, k = y - v;
                _ > k ? y = v + _ : m = d + k;
                var S = vr();
                if (S.add = function (t) {
                        o(S, t, +x(t, ++g), +b(t, g), d, v, m, y)
                    }, S.visit = function (t) {
                        mr(t, S, d, v, m, y)
                    }, S.find = function (t) {
                        return yr(S, t[0], t[1], d, v, m, y)
                    }, g = -1, null == n) {
                    for (; ++g < p;)o(S, t[g], f[g], h[g], d, v, m, y);
                    --g
                } else t.forEach(S.add);
                return f = h = t = c = null, S
            }

            var u, a = Re, s = qe;
            return (u = arguments.length) ? (a = pr, s = dr, 3 === u && (i = e, r = n, e = n = 0), o(t)) : (o.x = function (t) {
                return arguments.length ? (a = t, o) : a
            }, o.y = function (t) {
                return arguments.length ? (s = t, o) : s
            }, o.extent = function (t) {
                return arguments.length ? (null == t ? n = e = r = i = null : (n = +t[0][0], e = +t[0][1], r = +t[1][0], i = +t[1][1]), o) : null == n ? null : [[n, e], [r, i]]
            }, o.size = function (t) {
                return arguments.length ? (null == t ? n = e = r = i = null : (n = e = 0, r = +t[0], i = +t[1]), o) : null == n ? null : [r - n, i - e]
            }, o)
        }, au.interpolateRgb = xr, au.interpolateObject = br, au.interpolateNumber = Mr, au.interpolateString = wr;
        var fs = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, hs = new RegExp(fs.source, "g");
        au.interpolate = _r, au.interpolators = [function (t, n) {
            var e = typeof n;
            return ("string" === e ? ra.has(n.toLowerCase()) || /^(#|rgb\(|hsl\()/i.test(n) ? xr : wr : n instanceof ft ? xr : Array.isArray(n) ? kr : "object" === e && isNaN(n) ? br : Mr)(t, n)
        }], au.interpolateArray = kr;
        var gs = function () {
            return _
        }, ps = au.map({
            linear: gs, poly: Lr, quad: function () {
                return Ar
            }, cubic: function () {
                return Cr
            }, sin: function () {
                return Tr
            }, exp: function () {
                return Rr
            }, circle: function () {
                return qr
            }, elastic: Dr, back: Pr, bounce: function () {
                return Ur
            }
        }), ds = au.map({
            "in": _, out: Nr, "in-out": Er, "out-in": function (t) {
                return Er(Nr(t))
            }
        });
        au.ease = function (t) {
            var n = t.indexOf("-"), e = n >= 0 ? t.slice(0, n) : t, r = n >= 0 ? t.slice(n + 1) : "in";
            return e = ps.get(e) || gs, r = ds.get(r) || _, Sr(r(e.apply(null, su.call(arguments, 1))))
        }, au.interpolateHcl = jr, au.interpolateHsl = Or, au.interpolateLab = Hr, au.interpolateRound = Br, au.transform = function (t) {
            var n = cu.createElementNS(au.ns.prefix.svg, "g");
            return (au.transform = function (t) {
                if (null != t) {
                    n.setAttribute("transform", t);
                    var e = n.transform.baseVal.consolidate()
                }
                return new Fr(e ? e.matrix : vs)
            })(t)
        }, Fr.prototype.toString = function () {
            return "translate(" + this.translate + ")rotate(" + this.rotate + ")skewX(" + this.skew + ")scale(" + this.scale + ")"
        };
        var vs = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};
        au.interpolateTransform = Zr, au.layout = {}, au.layout.bundle = function () {
            return function (t) {
                for (var n = [], e = -1, r = t.length; ++e < r;)n.push($r(t[e]));
                return n
            }
        }, au.layout.chord = function () {
            function t() {
                var t, l, f, h, g, p = {}, d = [], v = au.range(o), m = [];
                for (e = [], r = [], t = 0, h = -1; ++h < o;) {
                    for (l = 0, g = -1; ++g < o;)l += i[h][g];
                    d.push(l), m.push(au.range(o)), t += l
                }
                for (u && v.sort(function (t, n) {
                    return u(d[t], d[n])
                }), a && m.forEach(function (t, n) {
                    t.sort(function (t, e) {
                        return a(i[n][t], i[n][e])
                    })
                }), t = (ju - c * o) / t, l = 0, h = -1; ++h < o;) {
                    for (f = l, g = -1; ++g < o;) {
                        var y = v[h], x = m[y][g], b = i[y][x], M = l, w = l += b * t;
                        p[y + "-" + x] = {index: y, subindex: x, startAngle: M, endAngle: w, value: b}
                    }
                    r[y] = {index: y, startAngle: f, endAngle: l, value: (l - f) / t}, l += c
                }
                for (h = -1; ++h < o;)for (g = h - 1; ++g < o;) {
                    var _ = p[h + "-" + g], k = p[g + "-" + h];
                    (_.value || k.value) && e.push(_.value < k.value ? {source: k, target: _} : {source: _, target: k})
                }
                s && n()
            }

            function n() {
                e.sort(function (t, n) {
                    return s((t.source.value + t.target.value) / 2, (n.source.value + n.target.value) / 2)
                })
            }

            var e, r, i, o, u, a, s, l = {}, c = 0;
            return l.matrix = function (t) {
                return arguments.length ? (o = (i = t) && i.length, e = r = null, l) : i
            }, l.padding = function (t) {
                return arguments.length ? (c = t, e = r = null, l) : c
            }, l.sortGroups = function (t) {
                return arguments.length ? (u = t, e = r = null, l) : u
            }, l.sortSubgroups = function (t) {
                return arguments.length ? (a = t, e = null, l) : a
            }, l.sortChords = function (t) {
                return arguments.length ? (s = t, e && n(), l) : s
            }, l.chords = function () {
                return e || t(), e
            }, l.groups = function () {
                return r || t(), r
            }, l
        }, au.layout.force = function () {
            function t(t) {
                return function (n, e, r, i) {
                    if (n.point !== t) {
                        var o = n.cx - t.x, u = n.cy - t.y, a = i - e, s = o * o + u * u;
                        if (s > a * a / v) {
                            if (p > s) {
                                var l = n.charge / s;
                                t.px -= o * l, t.py -= u * l
                            }
                            return !0
                        }
                        if (n.point && s && p > s) {
                            var l = n.pointCharge / s;
                            t.px -= o * l, t.py -= u * l
                        }
                    }
                    return !n.charge
                }
            }

            function n(t) {
                t.px = au.event.x, t.py = au.event.y, a.resume()
            }

            var e, r, i, o, u, a = {}, s = au.dispatch("start", "tick", "end"), l = [1, 1], c = .9, f = ms, h = ys, g = -30, p = xs, d = .1, v = .64, m = [], y = [];
            return a.tick = function () {
                if ((r *= .99) < .005)return s.end({type: "end", alpha: r = 0}), !0;
                var n, e, a, f, h, p, v, x, b, M = m.length, w = y.length;
                for (e = 0; w > e; ++e)a = y[e], f = a.source, h = a.target, x = h.x - f.x, b = h.y - f.y, (p = x * x + b * b) && (p = r * o[e] * ((p = Math.sqrt(p)) - i[e]) / p, x *= p, b *= p, h.x -= x * (v = f.weight / (h.weight + f.weight)), h.y -= b * v, f.x += x * (v = 1 - v), f.y += b * v);
                if ((v = r * d) && (x = l[0] / 2, b = l[1] / 2, e = -1, v))for (; ++e < M;)a = m[e], a.x += (x - a.x) * v, a.y += (b - a.y) * v;
                if (g)for (ei(n = au.geom.quadtree(m), r, u), e = -1; ++e < M;)(a = m[e]).fixed || n.visit(t(a));
                for (e = -1; ++e < M;)a = m[e], a.fixed ? (a.x = a.px, a.y = a.py) : (a.x -= (a.px - (a.px = a.x)) * c, a.y -= (a.py - (a.py = a.y)) * c);
                s.tick({type: "tick", alpha: r})
            }, a.nodes = function (t) {
                return arguments.length ? (m = t, a) : m
            }, a.links = function (t) {
                return arguments.length ? (y = t, a) : y
            }, a.size = function (t) {
                return arguments.length ? (l = t, a) : l
            }, a.linkDistance = function (t) {
                return arguments.length ? (f = "function" == typeof t ? t : +t, a) : f
            }, a.distance = a.linkDistance, a.linkStrength = function (t) {
                return arguments.length ? (h = "function" == typeof t ? t : +t, a) : h
            }, a.friction = function (t) {
                return arguments.length ? (c = +t, a) : c
            }, a.charge = function (t) {
                return arguments.length ? (g = "function" == typeof t ? t : +t, a) : g
            }, a.chargeDistance = function (t) {
                return arguments.length ? (p = t * t, a) : Math.sqrt(p)
            }, a.gravity = function (t) {
                return arguments.length ? (d = +t, a) : d
            }, a.theta = function (t) {
                return arguments.length ? (v = t * t, a) : Math.sqrt(v)
            }, a.alpha = function (t) {
                return arguments.length ? (t = +t, r ? r = t > 0 ? t : 0 : t > 0 && (s.start({
                    type: "start",
                    alpha: r = t
                }), au.timer(a.tick)), a) : r
            }, a.start = function () {
                function t(t, r) {
                    if (!e) {
                        for (e = new Array(s), a = 0; s > a; ++a)e[a] = [];
                        for (a = 0; c > a; ++a) {
                            var i = y[a];
                            e[i.source.index].push(i.target), e[i.target.index].push(i.source)
                        }
                    }
                    for (var o, u = e[n], a = -1, l = u.length; ++a < l;)if (!isNaN(o = u[a][t]))return o;
                    return Math.random() * r
                }

                var n, e, r, s = m.length, c = y.length, p = l[0], d = l[1];
                for (n = 0; s > n; ++n)(r = m[n]).index = n, r.weight = 0;
                for (n = 0; c > n; ++n)r = y[n], "number" == typeof r.source && (r.source = m[r.source]), "number" == typeof r.target && (r.target = m[r.target]), ++r.source.weight, ++r.target.weight;
                for (n = 0; s > n; ++n)r = m[n], isNaN(r.x) && (r.x = t("x", p)), isNaN(r.y) && (r.y = t("y", d)), isNaN(r.px) && (r.px = r.x), isNaN(r.py) && (r.py = r.y);
                if (i = [], "function" == typeof f)for (n = 0; c > n; ++n)i[n] = +f.call(this, y[n], n); else for (n = 0; c > n; ++n)i[n] = f;
                if (o = [], "function" == typeof h)for (n = 0; c > n; ++n)o[n] = +h.call(this, y[n], n); else for (n = 0; c > n; ++n)o[n] = h;
                if (u = [], "function" == typeof g)for (n = 0; s > n; ++n)u[n] = +g.call(this, m[n], n); else for (n = 0; s > n; ++n)u[n] = g;
                return a.resume()
            }, a.resume = function () {
                return a.alpha(.1)
            }, a.stop = function () {
                return a.alpha(0)
            }, a.drag = function () {
                return e || (e = au.behavior.drag().origin(_).on("dragstart.force", Gr).on("drag.force", n).on("dragend.force", Kr)), arguments.length ? void this.on("mouseover.force", ti).on("mouseout.force", ni).call(e) : e
            }, au.rebind(a, s, "on")
        };
        var ms = 20, ys = 1, xs = 1 / 0;
        au.layout.hierarchy = function () {
            function t(i) {
                var o, u = [i], a = [];
                for (i.depth = 0; null != (o = u.pop());)if (a.push(o), (l = e.call(t, o, o.depth)) && (s = l.length)) {
                    for (var s, l, c; --s >= 0;)u.push(c = l[s]), c.parent = o, c.depth = o.depth + 1;
                    r && (o.value = 0), o.children = l
                } else r && (o.value = +r.call(t, o, o.depth) || 0), delete o.children;
                return oi(i, function (t) {
                    var e, i;
                    n && (e = t.children) && e.sort(n), r && (i = t.parent) && (i.value += t.value)
                }), a
            }

            var n = si, e = ui, r = ai;
            return t.sort = function (e) {
                return arguments.length ? (n = e, t) : n
            }, t.children = function (n) {
                return arguments.length ? (e = n, t) : e
            }, t.value = function (n) {
                return arguments.length ? (r = n, t) : r
            }, t.revalue = function (n) {
                return r && (ii(n, function (t) {
                    t.children && (t.value = 0)
                }), oi(n, function (n) {
                    var e;
                    n.children || (n.value = +r.call(t, n, n.depth) || 0), (e = n.parent) && (e.value += n.value)
                })), n
            }, t
        }, au.layout.partition = function () {
            function t(n, e, r, i) {
                var o = n.children;
                if (n.x = e, n.y = n.depth * i, n.dx = r, n.dy = i, o && (u = o.length)) {
                    var u, a, s, l = -1;
                    for (r = n.value ? r / n.value : 0; ++l < u;)t(a = o[l], e, s = a.value * r, i), e += s
                }
            }

            function n(t) {
                var e = t.children, r = 0;
                if (e && (i = e.length))for (var i, o = -1; ++o < i;)r = Math.max(r, n(e[o]));
                return 1 + r
            }

            function e(e, o) {
                var u = r.call(this, e, o);
                return t(u[0], 0, i[0], i[1] / n(u[0])), u
            }

            var r = au.layout.hierarchy(), i = [1, 1];
            return e.size = function (t) {
                return arguments.length ? (i = t, e) : i
            }, ri(e, r)
        }, au.layout.pie = function () {
            function t(u) {
                var a, s = u.length, l = u.map(function (e, r) {
                    return +n.call(t, e, r)
                }), c = +("function" == typeof r ? r.apply(this, arguments) : r), f = ("function" == typeof i ? i.apply(this, arguments) : i) - c, h = Math.min(Math.abs(f) / s, +("function" == typeof o ? o.apply(this, arguments) : o)), g = h * (0 > f ? -1 : 1), p = (f - s * g) / au.sum(l), d = au.range(s), v = [];
                return null != e && d.sort(e === bs ? function (t, n) {
                    return l[n] - l[t]
                } : function (t, n) {
                    return e(u[t], u[n])
                }), d.forEach(function (t) {
                    v[t] = {data: u[t], value: a = l[t], startAngle: c, endAngle: c += a * p + g, padAngle: h}
                }), v
            }

            var n = Number, e = bs, r = 0, i = ju, o = 0;
            return t.value = function (e) {
                return arguments.length ? (n = e, t) : n
            }, t.sort = function (n) {
                return arguments.length ? (e = n, t) : e
            }, t.startAngle = function (n) {
                return arguments.length ? (r = n, t) : r
            }, t.endAngle = function (n) {
                return arguments.length ? (i = n, t) : i
            }, t.padAngle = function (n) {
                return arguments.length ? (o = n, t) : o
            }, t
        };
        var bs = {};
        au.layout.stack = function () {
            function t(a, s) {
                if (!(h = a.length))return a;
                var l = a.map(function (e, r) {
                    return n.call(t, e, r)
                }), c = l.map(function (n) {
                    return n.map(function (n, e) {
                        return [o.call(t, n, e), u.call(t, n, e)]
                    })
                }), f = e.call(t, c, s);
                l = au.permute(l, f), c = au.permute(c, f);
                var h, g, p, d, v = r.call(t, c, s), m = l[0].length;
                for (p = 0; m > p; ++p)for (i.call(t, l[0][p], d = v[p], c[0][p][1]), g = 1; h > g; ++g)i.call(t, l[g][p], d += c[g - 1][p][1], c[g][p][1]);
                return a
            }

            var n = _, e = gi, r = pi, i = hi, o = ci, u = fi;
            return t.values = function (e) {
                return arguments.length ? (n = e, t) : n
            }, t.order = function (n) {
                return arguments.length ? (e = "function" == typeof n ? n : Ms.get(n) || gi, t) : e
            }, t.offset = function (n) {
                return arguments.length ? (r = "function" == typeof n ? n : ws.get(n) || pi, t) : r
            }, t.x = function (n) {
                return arguments.length ? (o = n, t) : o
            }, t.y = function (n) {
                return arguments.length ? (u = n, t) : u
            }, t.out = function (n) {
                return arguments.length ? (i = n, t) : i
            }, t
        };
        var Ms = au.map({
            "inside-out": function (t) {
                var n, e, r = t.length, i = t.map(di), o = t.map(vi), u = au.range(r).sort(function (t, n) {
                    return i[t] - i[n]
                }), a = 0, s = 0, l = [], c = [];
                for (n = 0; r > n; ++n)e = u[n], s > a ? (a += o[e], l.push(e)) : (s += o[e], c.push(e));
                return c.reverse().concat(l)
            }, reverse: function (t) {
                return au.range(t.length).reverse()
            }, "default": gi
        }), ws = au.map({
            silhouette: function (t) {
                var n, e, r, i = t.length, o = t[0].length, u = [], a = 0, s = [];
                for (e = 0; o > e; ++e) {
                    for (n = 0, r = 0; i > n; n++)r += t[n][e][1];
                    r > a && (a = r), u.push(r)
                }
                for (e = 0; o > e; ++e)s[e] = (a - u[e]) / 2;
                return s
            }, wiggle: function (t) {
                var n, e, r, i, o, u, a, s, l, c = t.length, f = t[0], h = f.length, g = [];
                for (g[0] = s = l = 0, e = 1; h > e; ++e) {
                    for (n = 0, i = 0; c > n; ++n)i += t[n][e][1];
                    for (n = 0, o = 0, a = f[e][0] - f[e - 1][0]; c > n; ++n) {
                        for (r = 0, u = (t[n][e][1] - t[n][e - 1][1]) / (2 * a); n > r; ++r)u += (t[r][e][1] - t[r][e - 1][1]) / a;
                        o += u * t[n][e][1]
                    }
                    g[e] = s -= i ? o / i * a : 0, l > s && (l = s)
                }
                for (e = 0; h > e; ++e)g[e] -= l;
                return g
            }, expand: function (t) {
                var n, e, r, i = t.length, o = t[0].length, u = 1 / i, a = [];
                for (e = 0; o > e; ++e) {
                    for (n = 0, r = 0; i > n; n++)r += t[n][e][1];
                    if (r)for (n = 0; i > n; n++)t[n][e][1] /= r; else for (n = 0; i > n; n++)t[n][e][1] = u
                }
                for (e = 0; o > e; ++e)a[e] = 0;
                return a
            }, zero: pi
        });
        au.layout.histogram = function () {
            function t(t, o) {
                for (var u, a, s = [], l = t.map(e, this), c = r.call(this, l, o), f = i.call(this, c, l, o), o = -1, h = l.length, g = f.length - 1, p = n ? 1 : 1 / h; ++o < g;)u = s[o] = [], u.dx = f[o + 1] - (u.x = f[o]), u.y = 0;
                if (g > 0)for (o = -1; ++o < h;)a = l[o], a >= c[0] && a <= c[1] && (u = s[au.bisect(f, a, 1, g) - 1], u.y += p, u.push(t[o]));
                return s
            }

            var n = !0, e = Number, r = bi, i = yi;
            return t.value = function (n) {
                return arguments.length ? (e = n, t) : e
            }, t.range = function (n) {
                return arguments.length ? (r = Lt(n), t) : r
            }, t.bins = function (n) {
                return arguments.length ? (i = "number" == typeof n ? function (t) {
                    return xi(t, n)
                } : Lt(n), t) : i
            }, t.frequency = function (e) {
                return arguments.length ? (n = !!e, t) : n
            }, t
        }, au.layout.pack = function () {
            function t(t, o) {
                var u = e.call(this, t, o), a = u[0], s = i[0], l = i[1], c = null == n ? Math.sqrt : "function" == typeof n ? n : function () {
                    return n
                };
                if (a.x = a.y = 0, oi(a, function (t) {
                        t.r = +c(t.value)
                    }), oi(a, Si), r) {
                    var f = r * (n ? 1 : Math.max(2 * a.r / s, 2 * a.r / l)) / 2;
                    oi(a, function (t) {
                        t.r += f
                    }), oi(a, Si), oi(a, function (t) {
                        t.r -= f
                    })
                }
                return Ai(a, s / 2, l / 2, n ? 1 : 1 / Math.max(2 * a.r / s, 2 * a.r / l)), u
            }

            var n, e = au.layout.hierarchy().sort(Mi), r = 0, i = [1, 1];
            return t.size = function (n) {
                return arguments.length ? (i = n, t) : i
            }, t.radius = function (e) {
                return arguments.length ? (n = null == e || "function" == typeof e ? e : +e, t) : n
            }, t.padding = function (n) {
                return arguments.length ? (r = +n, t) : r
            }, ri(t, e)
        }, au.layout.tree = function () {
            function t(t, i) {
                var c = u.call(this, t, i), f = c[0], h = n(f);
                if (oi(h, e), h.parent.m = -h.z, ii(h, r), l)ii(f, o); else {
                    var g = f, p = f, d = f;
                    ii(f, function (t) {
                        t.x < g.x && (g = t), t.x > p.x && (p = t), t.depth > d.depth && (d = t)
                    });
                    var v = a(g, p) / 2 - g.x, m = s[0] / (p.x + a(p, g) / 2 + v), y = s[1] / (d.depth || 1);
                    ii(f, function (t) {
                        t.x = (t.x + v) * m, t.y = t.depth * y
                    })
                }
                return c
            }

            function n(t) {
                for (var n, e = {
                    A: null,
                    children: [t]
                }, r = [e]; null != (n = r.pop());)for (var i, o = n.children, u = 0, a = o.length; a > u; ++u)r.push((o[u] = i = {
                    _: o[u],
                    parent: n,
                    children: (i = o[u].children) && i.slice() || [],
                    A: null,
                    a: null,
                    z: 0,
                    m: 0,
                    c: 0,
                    s: 0,
                    t: null,
                    i: u
                }).a = i);
                return e.children[0]
            }

            function e(t) {
                var n = t.children, e = t.parent.children, r = t.i ? e[t.i - 1] : null;
                if (n.length) {
                    qi(t);
                    var o = (n[0].z + n[n.length - 1].z) / 2;
                    r ? (t.z = r.z + a(t._, r._), t.m = t.z - o) : t.z = o
                } else r && (t.z = r.z + a(t._, r._));
                t.parent.A = i(t, r, t.parent.A || e[0])
            }

            function r(t) {
                t._.x = t.z + t.parent.m, t.m += t.parent.m
            }

            function i(t, n, e) {
                if (n) {
                    for (var r, i = t, o = t, u = n, s = i.parent.children[0], l = i.m, c = o.m, f = u.m, h = s.m; u = Ti(u), i = Li(i), u && i;)s = Li(s), o = Ti(o), o.a = t, r = u.z + f - i.z - l + a(u._, i._), r > 0 && (Ri(Di(u, t, e), t, r), l += r, c += r), f += u.m, l += i.m, h += s.m, c += o.m;
                    u && !Ti(o) && (o.t = u, o.m += f - c), i && !Li(s) && (s.t = i, s.m += l - h, e = t)
                }
                return e
            }

            function o(t) {
                t.x *= s[0], t.y = t.depth * s[1]
            }

            var u = au.layout.hierarchy().sort(null).value(null), a = zi, s = [1, 1], l = null;
            return t.separation = function (n) {
                return arguments.length ? (a = n, t) : a
            }, t.size = function (n) {
                return arguments.length ? (l = null == (s = n) ? o : null, t) : l ? null : s
            }, t.nodeSize = function (n) {
                return arguments.length ? (l = null == (s = n) ? null : o, t) : l ? s : null
            }, ri(t, u)
        }, au.layout.cluster = function () {
            function t(t, o) {
                var u, a = n.call(this, t, o), s = a[0], l = 0;
                oi(s, function (t) {
                    var n = t.children;
                    n && n.length ? (t.x = Ui(n), t.y = Pi(n)) : (t.x = u ? l += e(t, u) : 0, t.y = 0, u = t)
                });
                var c = ji(s), f = Oi(s), h = c.x - e(c, f) / 2, g = f.x + e(f, c) / 2;
                return oi(s, i ? function (t) {
                    t.x = (t.x - s.x) * r[0], t.y = (s.y - t.y) * r[1]
                } : function (t) {
                    t.x = (t.x - h) / (g - h) * r[0], t.y = (1 - (s.y ? t.y / s.y : 1)) * r[1]
                }), a
            }

            var n = au.layout.hierarchy().sort(null).value(null), e = zi, r = [1, 1], i = !1;
            return t.separation = function (n) {
                return arguments.length ? (e = n, t) : e
            }, t.size = function (n) {
                return arguments.length ? (i = null == (r = n), t) : i ? null : r
            }, t.nodeSize = function (n) {
                return arguments.length ? (i = null != (r = n), t) : i ? r : null
            }, ri(t, n)
        }, au.layout.treemap = function () {
            function t(t, n) {
                for (var e, r, i = -1, o = t.length; ++i < o;)r = (e = t[i]).value * (0 > n ? 0 : n), e.area = isNaN(r) || 0 >= r ? 0 : r
            }

            function n(e) {
                var o = e.children;
                if (o && o.length) {
                    var u, a, s, l = f(e), c = [], h = o.slice(), p = 1 / 0, d = "slice" === g ? l.dx : "dice" === g ? l.dy : "slice-dice" === g ? 1 & e.depth ? l.dy : l.dx : Math.min(l.dx, l.dy);
                    for (t(h, l.dx * l.dy / e.value), c.area = 0; (s = h.length) > 0;)c.push(u = h[s - 1]), c.area += u.area, "squarify" !== g || (a = r(c, d)) <= p ? (h.pop(), p = a) : (c.area -= c.pop().area, i(c, d, l, !1), d = Math.min(l.dx, l.dy), c.length = c.area = 0, p = 1 / 0);
                    c.length && (i(c, d, l, !0), c.length = c.area = 0), o.forEach(n)
                }
            }

            function e(n) {
                var r = n.children;
                if (r && r.length) {
                    var o, u = f(n), a = r.slice(), s = [];
                    for (t(a, u.dx * u.dy / n.value), s.area = 0; o = a.pop();)s.push(o), s.area += o.area, null != o.z && (i(s, o.z ? u.dx : u.dy, u, !a.length), s.length = s.area = 0);
                    r.forEach(e)
                }
            }

            function r(t, n) {
                for (var e, r = t.area, i = 0, o = 1 / 0, u = -1, a = t.length; ++u < a;)(e = t[u].area) && (o > e && (o = e), e > i && (i = e));
                return r *= r, n *= n, r ? Math.max(n * i * p / r, r / (n * o * p)) : 1 / 0
            }

            function i(t, n, e, r) {
                var i, o = -1, u = t.length, a = e.x, l = e.y, c = n ? s(t.area / n) : 0;
                if (n == e.dx) {
                    for ((r || c > e.dy) && (c = e.dy); ++o < u;)i = t[o], i.x = a, i.y = l, i.dy = c, a += i.dx = Math.min(e.x + e.dx - a, c ? s(i.area / c) : 0);
                    i.z = !0, i.dx += e.x + e.dx - a, e.y += c, e.dy -= c
                } else {
                    for ((r || c > e.dx) && (c = e.dx); ++o < u;)i = t[o], i.x = a, i.y = l, i.dx = c, l += i.dy = Math.min(e.y + e.dy - l, c ? s(i.area / c) : 0);
                    i.z = !1, i.dy += e.y + e.dy - l, e.x += c, e.dx -= c
                }
            }

            function o(r) {
                var i = u || a(r), o = i[0];
                return o.x = 0, o.y = 0, o.dx = l[0], o.dy = l[1], u && a.revalue(o), t([o], o.dx * o.dy / o.value), (u ? e : n)(o), h && (u = i), i
            }

            var u, a = au.layout.hierarchy(), s = Math.round, l = [1, 1], c = null, f = Hi, h = !1, g = "squarify", p = .5 * (1 + Math.sqrt(5));
            return o.size = function (t) {
                return arguments.length ? (l = t, o) : l
            }, o.padding = function (t) {
                function n(n) {
                    var e = t.call(o, n, n.depth);
                    return null == e ? Hi(n) : Bi(n, "number" == typeof e ? [e, e, e, e] : e)
                }

                function e(n) {
                    return Bi(n, t)
                }

                if (!arguments.length)return c;
                var r;
                return f = null == (c = t) ? Hi : "function" == (r = typeof t) ? n : "number" === r ? (t = [t, t, t, t], e) : e, o
            }, o.round = function (t) {
                return arguments.length ? (s = t ? Math.round : Number, o) : s != Number
            }, o.sticky = function (t) {
                return arguments.length ? (h = t, u = null, o) : h
            }, o.ratio = function (t) {
                return arguments.length ? (p = t, o) : p
            }, o.mode = function (t) {
                return arguments.length ? (g = t + "", o) : g
            }, ri(o, a)
        }, au.random = {
            normal: function (t, n) {
                var e = arguments.length;
                return 2 > e && (n = 1), 1 > e && (t = 0), function () {
                    var e, r, i;
                    do e = 2 * Math.random() - 1, r = 2 * Math.random() - 1, i = e * e + r * r; while (!i || i > 1);
                    return t + n * e * Math.sqrt(-2 * Math.log(i) / i)
                }
            }, logNormal: function () {
                var t = au.random.normal.apply(au, arguments);
                return function () {
                    return Math.exp(t())
                }
            }, bates: function (t) {
                var n = au.random.irwinHall(t);
                return function () {
                    return n() / t
                }
            }, irwinHall: function (t) {
                return function () {
                    for (var n = 0, e = 0; t > e; e++)n += Math.random();
                    return n
                }
            }
        }, au.scale = {};
        var _s = {floor: _, ceil: _};
        au.scale.linear = function () {
            return Vi([0, 1], [0, 1], _r, !1)
        };
        var ks = {s: 1, g: 1, p: 1, r: 1, e: 1};
        au.scale.log = function () {
            return eo(au.scale.linear().domain([0, 1]), 10, !0, [1, 10])
        };
        var Ss = au.format(".0e"), Ns = {
            floor: function (t) {
                return -Math.ceil(-t)
            }, ceil: function (t) {
                return -Math.floor(-t)
            }
        };
        au.scale.pow = function () {
            return ro(au.scale.linear(), 1, [0, 1])
        }, au.scale.sqrt = function () {
            return au.scale.pow().exponent(.5)
        }, au.scale.ordinal = function () {
            return oo([], {t: "range", a: [[]]})
        }, au.scale.category10 = function () {
            return au.scale.ordinal().range(Es)
        }, au.scale.category20 = function () {
            return au.scale.ordinal().range(As)
        }, au.scale.category20b = function () {
            return au.scale.ordinal().range(Cs)
        }, au.scale.category20c = function () {
            return au.scale.ordinal().range(zs)
        };
        var Es = [2062260, 16744206, 2924588, 14034728, 9725885, 9197131, 14907330, 8355711, 12369186, 1556175].map(kt), As = [2062260, 11454440, 16744206, 16759672, 2924588, 10018698, 14034728, 16750742, 9725885, 12955861, 9197131, 12885140, 14907330, 16234194, 8355711, 13092807, 12369186, 14408589, 1556175, 10410725].map(kt), Cs = [3750777, 5395619, 7040719, 10264286, 6519097, 9216594, 11915115, 13556636, 9202993, 12426809, 15186514, 15190932, 8666169, 11356490, 14049643, 15177372, 8077683, 10834324, 13528509, 14589654].map(kt), zs = [3244733, 7057110, 10406625, 13032431, 15095053, 16616764, 16625259, 16634018, 3253076, 7652470, 10607003, 13101504, 7695281, 10394312, 12369372, 14342891, 6513507, 9868950, 12434877, 14277081].map(kt);
        au.scale.quantile = function () {
            return uo([], [])
        }, au.scale.quantize = function () {
            return ao(0, 1, [0, 1])
        }, au.scale.threshold = function () {
            return so([.5], [0, 1])
        }, au.scale.identity = function () {
            return lo([0, 1])
        }, au.svg = {}, au.svg.arc = function () {
            function t() {
                var t = Math.max(0, +e.apply(this, arguments)), l = Math.max(0, +r.apply(this, arguments)), c = u.apply(this, arguments) - Hu, f = a.apply(this, arguments) - Hu, h = Math.abs(f - c), g = c > f ? 0 : 1;
                if (t > l && (p = l, l = t, t = p), h >= Ou)return n(l, g) + (t ? n(t, 1 - g) : "") + "Z";
                var p, d, v, m, y, x, b, M, w, _, k, S, N = 0, E = 0, A = [];
                if ((m = (+s.apply(this, arguments) || 0) / 2) && (v = o === Ls ? Math.sqrt(t * t + l * l) : +o.apply(this, arguments), g || (E *= -1), l && (E = ut(v / l * Math.sin(m))), t && (N = ut(v / t * Math.sin(m)))), l) {
                    y = l * Math.cos(c + E), x = l * Math.sin(c + E), b = l * Math.cos(f - E), M = l * Math.sin(f - E);
                    var C = Math.abs(f - c - 2 * E) <= Uu ? 0 : 1;
                    if (E && mo(y, x, b, M) === g ^ C) {
                        var z = (c + f) / 2;
                        y = l * Math.cos(z), x = l * Math.sin(z), b = M = null
                    }
                } else y = x = 0;
                if (t) {
                    w = t * Math.cos(f - N), _ = t * Math.sin(f - N), k = t * Math.cos(c + N), S = t * Math.sin(c + N);
                    var L = Math.abs(c - f + 2 * N) <= Uu ? 0 : 1;
                    if (N && mo(w, _, k, S) === 1 - g ^ L) {
                        var T = (c + f) / 2;
                        w = t * Math.cos(T), _ = t * Math.sin(T), k = S = null
                    }
                } else w = _ = 0;
                if ((p = Math.min(Math.abs(l - t) / 2, +i.apply(this, arguments))) > .001) {
                    d = l > t ^ g ? 0 : 1;
                    var R = null == k ? [w, _] : null == b ? [y, x] : je([y, x], [k, S], [b, M], [w, _]), q = y - R[0], D = x - R[1], P = b - R[0], U = M - R[1], j = 1 / Math.sin(Math.acos((q * P + D * U) / (Math.sqrt(q * q + D * D) * Math.sqrt(P * P + U * U))) / 2), O = Math.sqrt(R[0] * R[0] + R[1] * R[1]);
                    if (null != b) {
                        var H = Math.min(p, (l - O) / (j + 1)), B = yo(null == k ? [w, _] : [k, S], [y, x], l, H, g), F = yo([b, M], [w, _], l, H, g);
                        p === H ? A.push("M", B[0], "A", H, ",", H, " 0 0,", d, " ", B[1], "A", l, ",", l, " 0 ", 1 - g ^ mo(B[1][0], B[1][1], F[1][0], F[1][1]), ",", g, " ", F[1], "A", H, ",", H, " 0 0,", d, " ", F[0]) : A.push("M", B[0], "A", H, ",", H, " 0 1,", d, " ", F[0])
                    } else A.push("M", y, ",", x);
                    if (null != k) {
                        var Y = Math.min(p, (t - O) / (j - 1)), X = yo([y, x], [k, S], t, -Y, g), I = yo([w, _], null == b ? [y, x] : [b, M], t, -Y, g);
                        p === Y ? A.push("L", I[0], "A", Y, ",", Y, " 0 0,", d, " ", I[1], "A", t, ",", t, " 0 ", g ^ mo(I[1][0], I[1][1], X[1][0], X[1][1]), ",", 1 - g, " ", X[1], "A", Y, ",", Y, " 0 0,", d, " ", X[0]) : A.push("L", I[0], "A", Y, ",", Y, " 0 0,", d, " ", X[0])
                    } else A.push("L", w, ",", _)
                } else A.push("M", y, ",", x), null != b && A.push("A", l, ",", l, " 0 ", C, ",", g, " ", b, ",", M), A.push("L", w, ",", _), null != k && A.push("A", t, ",", t, " 0 ", L, ",", 1 - g, " ", k, ",", S);
                return A.push("Z"), A.join("")
            }

            function n(t, n) {
                return "M0," + t + "A" + t + "," + t + " 0 1," + n + " 0," + -t + "A" + t + "," + t + " 0 1," + n + " 0," + t
            }

            var e = fo, r = ho, i = co, o = Ls, u = go, a = po, s = vo;
            return t.innerRadius = function (n) {
                return arguments.length ? (e = Lt(n), t) : e
            }, t.outerRadius = function (n) {
                return arguments.length ? (r = Lt(n), t) : r
            }, t.cornerRadius = function (n) {
                return arguments.length ? (i = Lt(n), t) : i
            }, t.padRadius = function (n) {
                return arguments.length ? (o = n == Ls ? Ls : Lt(n), t) : o
            }, t.startAngle = function (n) {
                return arguments.length ? (u = Lt(n), t) : u
            }, t.endAngle = function (n) {
                return arguments.length ? (a = Lt(n), t) : a
            }, t.padAngle = function (n) {
                return arguments.length ? (s = Lt(n), t) : s
            }, t.centroid = function () {
                var t = (+e.apply(this, arguments) + +r.apply(this, arguments)) / 2, n = (+u.apply(this, arguments) + +a.apply(this, arguments)) / 2 - Hu;
                return [Math.cos(n) * t, Math.sin(n) * t]
            }, t
        };
        var Ls = "auto";
        au.svg.line = function () {
            return xo(_)
        };
        var Ts = au.map({
            linear: bo,
            "linear-closed": Mo,
            step: wo,
            "step-before": _o,
            "step-after": ko,
            basis: zo,
            "basis-open": Lo,
            "basis-closed": To,
            bundle: Ro,
            cardinal: Eo,
            "cardinal-open": So,
            "cardinal-closed": No,
            monotone: Oo
        });
        Ts.forEach(function (t, n) {
            n.key = t, n.closed = /-closed$/.test(t)
        });
        var Rs = [0, 2 / 3, 1 / 3, 0], qs = [0, 1 / 3, 2 / 3, 0], Ds = [0, 1 / 6, 2 / 3, 1 / 6];
        au.svg.line.radial = function () {
            var t = xo(Ho);
            return t.radius = t.x, delete t.x, t.angle = t.y, delete t.y, t
        }, _o.reverse = ko, ko.reverse = _o, au.svg.area = function () {
            return Bo(_)
        }, au.svg.area.radial = function () {
            var t = Bo(Ho);
            return t.radius = t.x, delete t.x, t.innerRadius = t.x0, delete t.x0, t.outerRadius = t.x1, delete t.x1, t.angle = t.y, delete t.y, t.startAngle = t.y0, delete t.y0, t.endAngle = t.y1, delete t.y1, t
        }, au.svg.chord = function () {
            function t(t, a) {
                var s = n(this, o, t, a), l = n(this, u, t, a);
                return "M" + s.p0 + r(s.r, s.p1, s.a1 - s.a0) + (e(s, l) ? i(s.r, s.p1, s.r, s.p0) : i(s.r, s.p1, l.r, l.p0) + r(l.r, l.p1, l.a1 - l.a0) + i(l.r, l.p1, s.r, s.p0)) + "Z"
            }

            function n(t, n, e, r) {
                var i = n.call(t, e, r), o = a.call(t, i, r), u = s.call(t, i, r) - Hu, c = l.call(t, i, r) - Hu;
                return {
                    r: o,
                    a0: u,
                    a1: c,
                    p0: [o * Math.cos(u), o * Math.sin(u)],
                    p1: [o * Math.cos(c), o * Math.sin(c)]
                }
            }

            function e(t, n) {
                return t.a0 == n.a0 && t.a1 == n.a1
            }

            function r(t, n, e) {
                return "A" + t + "," + t + " 0 " + +(e > Uu) + ",1 " + n
            }

            function i(t, n, e, r) {
                return "Q 0,0 " + r
            }

            var o = _e, u = ke, a = Fo, s = go, l = po;
            return t.radius = function (n) {
                return arguments.length ? (a = Lt(n), t) : a
            }, t.source = function (n) {
                return arguments.length ? (o = Lt(n), t) : o
            }, t.target = function (n) {
                return arguments.length ? (u = Lt(n), t) : u
            }, t.startAngle = function (n) {
                return arguments.length ? (s = Lt(n), t) : s
            }, t.endAngle = function (n) {
                return arguments.length ? (l = Lt(n), t) : l
            }, t
        }, au.svg.diagonal = function () {
            function t(t, i) {
                var o = n.call(this, t, i), u = e.call(this, t, i), a = (o.y + u.y) / 2, s = [o, {
                    x: o.x,
                    y: a
                }, {x: u.x, y: a}, u];
                return s = s.map(r), "M" + s[0] + "C" + s[1] + " " + s[2] + " " + s[3]
            }

            var n = _e, e = ke, r = Yo;
            return t.source = function (e) {
                return arguments.length ? (n = Lt(e), t) : n
            }, t.target = function (n) {
                return arguments.length ? (e = Lt(n), t) : e
            }, t.projection = function (n) {
                return arguments.length ? (r = n, t) : r
            }, t
        }, au.svg.diagonal.radial = function () {
            var t = au.svg.diagonal(), n = Yo, e = t.projection;
            return t.projection = function (t) {
                return arguments.length ? e(Xo(n = t)) : n
            }, t
        }, au.svg.symbol = function () {
            function t(t, r) {
                return (Ps.get(n.call(this, t, r)) || Jo)(e.call(this, t, r))
            }

            var n = Zo, e = Io;
            return t.type = function (e) {
                return arguments.length ? (n = Lt(e), t) : n
            }, t.size = function (n) {
                return arguments.length ? (e = Lt(n), t) : e
            }, t
        };
        var Ps = au.map({
            circle: Jo, cross: function (t) {
                var n = Math.sqrt(t / 5) / 2;
                return "M" + -3 * n + "," + -n + "H" + -n + "V" + -3 * n + "H" + n + "V" + -n + "H" + 3 * n + "V" + n + "H" + n + "V" + 3 * n + "H" + -n + "V" + n + "H" + -3 * n + "Z"
            }, diamond: function (t) {
                var n = Math.sqrt(t / (2 * js)), e = n * js;
                return "M0," + -n + "L" + e + ",0 0," + n + " " + -e + ",0Z"
            }, square: function (t) {
                var n = Math.sqrt(t) / 2;
                return "M" + -n + "," + -n + "L" + n + "," + -n + " " + n + "," + n + " " + -n + "," + n + "Z"
            }, "triangle-down": function (t) {
                var n = Math.sqrt(t / Us), e = n * Us / 2;
                return "M0," + e + "L" + n + "," + -e + " " + -n + "," + -e + "Z"
            }, "triangle-up": function (t) {
                var n = Math.sqrt(t / Us), e = n * Us / 2;
                return "M0," + -e + "L" + n + "," + e + " " + -n + "," + e + "Z"
            }
        });
        au.svg.symbolTypes = Ps.keys();
        var Us = Math.sqrt(3), js = Math.tan(30 * Bu);
        Au.transition = function (t) {
            for (var n, e, r = Os || ++Ys, i = Go(t), o = [], u = Hs || {
                    time: Date.now(),
                    ease: zr,
                    delay: 0,
                    duration: 250
                }, a = -1, s = this.length; ++a < s;) {
                o.push(n = []);
                for (var l = this[a], c = -1, f = l.length; ++c < f;)(e = l[c]) && Ko(e, c, i, r, u), n.push(e)
            }
            return $o(o, i, r)
        }, Au.interrupt = function (t) {
            return this.each(null == t ? Bs : Vo(Go(t)))
        };
        var Os, Hs, Bs = Vo(Go()), Fs = [], Ys = 0;
        Fs.call = Au.call, Fs.empty = Au.empty, Fs.node = Au.node, Fs.size = Au.size, au.transition = function (t, n) {
            return t && t.transition ? Os ? t.transition(n) : t : au.selection().transition(t)
        }, au.transition.prototype = Fs, Fs.select = function (t) {
            var n, e, r, i = this.id, o = this.namespace, u = [];
            t = R(t);
            for (var a = -1, s = this.length; ++a < s;) {
                u.push(n = []);
                for (var l = this[a], c = -1, f = l.length; ++c < f;)(r = l[c]) && (e = t.call(r, r.__data__, c, a)) ? ("__data__"in r && (e.__data__ = r.__data__), Ko(e, c, o, i, r[o][i]), n.push(e)) : n.push(null)
            }
            return $o(u, o, i)
        }, Fs.selectAll = function (t) {
            var n, e, r, i, o, u = this.id, a = this.namespace, s = [];
            t = q(t);
            for (var l = -1, c = this.length; ++l < c;)for (var f = this[l], h = -1, g = f.length; ++h < g;)if (r = f[h]) {
                o = r[a][u], e = t.call(r, r.__data__, h, l), s.push(n = []);
                for (var p = -1, d = e.length; ++p < d;)(i = e[p]) && Ko(i, p, a, u, o), n.push(i)
            }
            return $o(s, a, u)
        }, Fs.filter = function (t) {
            var n, e, r, i = [];
            "function" != typeof t && (t = Z(t));
            for (var o = 0, u = this.length; u > o; o++) {
                i.push(n = []);
                for (var e = this[o], a = 0, s = e.length; s > a; a++)(r = e[a]) && t.call(r, r.__data__, a, o) && n.push(r)
            }
            return $o(i, this.namespace, this.id)
        }, Fs.tween = function (t, n) {
            var e = this.id, r = this.namespace;
            return arguments.length < 2 ? this.node()[r][e].tween.get(t) : V(this, null == n ? function (n) {
                n[r][e].tween.remove(t)
            } : function (i) {
                i[r][e].tween.set(t, n)
            })
        }, Fs.attr = function (t, n) {
            function e() {
                this.removeAttribute(a)
            }

            function r() {
                this.removeAttributeNS(a.space, a.local)
            }

            function i(t) {
                return null == t ? e : (t += "", function () {
                    var n, e = this.getAttribute(a);
                    return e !== t && (n = u(e, t), function (t) {
                            this.setAttribute(a, n(t))
                        })
                })
            }

            function o(t) {
                return null == t ? r : (t += "", function () {
                    var n, e = this.getAttributeNS(a.space, a.local);
                    return e !== t && (n = u(e, t), function (t) {
                            this.setAttributeNS(a.space, a.local, n(t))
                        })
                })
            }

            if (arguments.length < 2) {
                for (n in t)this.attr(n, t[n]);
                return this
            }
            var u = "transform" == t ? Zr : _r, a = au.ns.qualify(t);
            return Qo(this, "attr." + t, n, a.local ? o : i)
        }, Fs.attrTween = function (t, n) {
            function e(t, e) {
                var r = n.call(this, t, e, this.getAttribute(i));
                return r && function (t) {
                        this.setAttribute(i, r(t))
                    }
            }

            function r(t, e) {
                var r = n.call(this, t, e, this.getAttributeNS(i.space, i.local));
                return r && function (t) {
                        this.setAttributeNS(i.space, i.local, r(t))
                    }
            }

            var i = au.ns.qualify(t);
            return this.tween("attr." + t, i.local ? r : e)
        }, Fs.style = function (t, n, e) {
            function r() {
                this.style.removeProperty(t)
            }

            function i(n) {
                return null == n ? r : (n += "", function () {
                    var r, i = u(this).getComputedStyle(this, null).getPropertyValue(t);
                    return i !== n && (r = _r(i, n), function (n) {
                            this.style.setProperty(t, r(n), e)
                        })
                })
            }

            var o = arguments.length;
            if (3 > o) {
                if ("string" != typeof t) {
                    2 > o && (n = "");
                    for (e in t)this.style(e, t[e], n);
                    return this
                }
                e = ""
            }
            return Qo(this, "style." + t, n, i)
        }, Fs.styleTween = function (t, n, e) {
            function r(r, i) {
                var o = n.call(this, r, i, u(this).getComputedStyle(this, null).getPropertyValue(t));
                return o && function (n) {
                        this.style.setProperty(t, o(n), e)
                    }
            }

            return arguments.length < 3 && (e = ""), this.tween("style." + t, r)
        }, Fs.text = function (t) {
            return Qo(this, "text", t, Wo)
        }, Fs.remove = function () {
            var t = this.namespace;
            return this.each("end.transition", function () {
                var n;
                this[t].count < 2 && (n = this.parentNode) && n.removeChild(this)
            })
        }, Fs.ease = function (t) {
            var n = this.id, e = this.namespace;
            return arguments.length < 1 ? this.node()[e][n].ease : ("function" != typeof t && (t = au.ease.apply(au, arguments)), V(this, function (r) {
                r[e][n].ease = t
            }))
        }, Fs.delay = function (t) {
            var n = this.id, e = this.namespace;
            return arguments.length < 1 ? this.node()[e][n].delay : V(this, "function" == typeof t ? function (r, i, o) {
                r[e][n].delay = +t.call(r, r.__data__, i, o)
            } : (t = +t, function (r) {
                r[e][n].delay = t
            }))
        }, Fs.duration = function (t) {
            var n = this.id, e = this.namespace;
            return arguments.length < 1 ? this.node()[e][n].duration : V(this, "function" == typeof t ? function (r, i, o) {
                r[e][n].duration = Math.max(1, t.call(r, r.__data__, i, o))
            } : (t = Math.max(1, t), function (r) {
                r[e][n].duration = t
            }))
        }, Fs.each = function (t, n) {
            var e = this.id, r = this.namespace;
            if (arguments.length < 2) {
                var i = Hs, o = Os;
                try {
                    Os = e, V(this, function (n, i, o) {
                        Hs = n[r][e], t.call(n, n.__data__, i, o)
                    })
                } finally {
                    Hs = i, Os = o
                }
            } else V(this, function (i) {
                var o = i[r][e];
                (o.event || (o.event = au.dispatch("start", "end", "interrupt"))).on(t, n)
            });
            return this
        }, Fs.transition = function () {
            for (var t, n, e, r, i = this.id, o = ++Ys, u = this.namespace, a = [], s = 0, l = this.length; l > s; s++) {
                a.push(t = []);
                for (var n = this[s], c = 0, f = n.length; f > c; c++)(e = n[c]) && (r = e[u][i], Ko(e, c, u, o, {
                    time: r.time,
                    ease: r.ease,
                    delay: r.delay + r.duration,
                    duration: r.duration
                })), t.push(e)
            }
            return $o(a, u, o)
        }, au.svg.axis = function () {
            function t(t) {
                t.each(function () {
                    var t, l = au.select(this), c = this.__chart__ || e, f = this.__chart__ = e.copy(), h = null == s ? f.ticks ? f.ticks.apply(f, a) : f.domain() : s, g = null == n ? f.tickFormat ? f.tickFormat.apply(f, a) : _ : n, p = l.selectAll(".tick").data(h, f), d = p.enter().insert("g", ".domain").attr("class", "tick").style("opacity", Du), v = au.transition(p.exit()).style("opacity", Du).remove(), m = au.transition(p.order()).style("opacity", 1), y = Math.max(i, 0) + u, x = Yi(f), b = l.selectAll(".domain").data([0]), M = (b.enter().append("path").attr("class", "domain"), au.transition(b));
                    d.append("line"), d.append("text");
                    var w, k, S, N, E = d.select("line"), A = m.select("line"), C = p.select("text").text(g), z = d.select("text"), L = m.select("text"), T = "top" === r || "left" === r ? -1 : 1;
                    if ("bottom" === r || "top" === r ? (t = tu, w = "x", S = "y", k = "x2", N = "y2", C.attr("dy", 0 > T ? "0em" : ".71em").style("text-anchor", "middle"), M.attr("d", "M" + x[0] + "," + T * o + "V0H" + x[1] + "V" + T * o)) : (t = nu, w = "y", S = "x", k = "y2", N = "x2", C.attr("dy", ".32em").style("text-anchor", 0 > T ? "end" : "start"), M.attr("d", "M" + T * o + "," + x[0] + "H0V" + x[1] + "H" + T * o)), E.attr(N, T * i), z.attr(S, T * y), A.attr(k, 0).attr(N, T * i), L.attr(w, 0).attr(S, T * y), f.rangeBand) {
                        var R = f, q = R.rangeBand() / 2;
                        c = f = function (t) {
                            return R(t) + q
                        }
                    } else c.rangeBand ? c = f : v.call(t, f, c);
                    d.call(t, c, f), m.call(t, f, f)
                })
            }

            var n, e = au.scale.linear(), r = Xs, i = 6, o = 6, u = 3, a = [10], s = null;
            return t.scale = function (n) {
                return arguments.length ? (e = n, t) : e
            }, t.orient = function (n) {
                return arguments.length ? (r = n in Is ? n + "" : Xs, t) : r
            }, t.ticks = function () {
                return arguments.length ? (a = arguments, t) : a
            }, t.tickValues = function (n) {
                return arguments.length ? (s = n, t) : s
            }, t.tickFormat = function (e) {
                return arguments.length ? (n = e, t) : n
            }, t.tickSize = function (n) {
                var e = arguments.length;
                return e ? (i = +n, o = +arguments[e - 1], t) : i
            }, t.innerTickSize = function (n) {
                return arguments.length ? (i = +n, t) : i
            }, t.outerTickSize = function (n) {
                return arguments.length ? (o = +n, t) : o
            }, t.tickPadding = function (n) {
                return arguments.length ? (u = +n, t) : u
            }, t.tickSubdivide = function () {
                return arguments.length && t
            }, t
        };
        var Xs = "bottom", Is = {top: 1, right: 1, bottom: 1, left: 1};
        au.svg.brush = function () {
            function t(o) {
                o.each(function () {
                    var o = au.select(this).style("pointer-events", "all").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)").on("mousedown.brush", i).on("touchstart.brush", i), u = o.selectAll(".background").data([0]);
                    u.enter().append("rect").attr("class", "background").style("visibility", "hidden").style("cursor", "crosshair"), o.selectAll(".extent").data([0]).enter().append("rect").attr("class", "extent").style("cursor", "move");
                    var a = o.selectAll(".resize").data(d, _);
                    a.exit().remove(), a.enter().append("g").attr("class", function (t) {
                        return "resize " + t
                    }).style("cursor", function (t) {
                        return Zs[t]
                    }).append("rect").attr("x", function (t) {
                        return /[ew]$/.test(t) ? -3 : null
                    }).attr("y", function (t) {
                        return /^[ns]/.test(t) ? -3 : null
                    }).attr("width", 6).attr("height", 6).style("visibility", "hidden"), a.style("display", t.empty() ? "none" : null);
                    var s, f = au.transition(o), h = au.transition(u);
                    l && (s = Yi(l), h.attr("x", s[0]).attr("width", s[1] - s[0]), e(f)), c && (s = Yi(c), h.attr("y", s[0]).attr("height", s[1] - s[0]), r(f)), n(f)
                })
            }

            function n(t) {
                t.selectAll(".resize").attr("transform", function (t) {
                    return "translate(" + f[+/e$/.test(t)] + "," + h[+/^s/.test(t)] + ")"
                })
            }

            function e(t) {
                t.select(".extent").attr("x", f[0]), t.selectAll(".extent,.n>rect,.s>rect").attr("width", f[1] - f[0])
            }

            function r(t) {
                t.select(".extent").attr("y", h[0]), t.selectAll(".extent,.e>rect,.w>rect").attr("height", h[1] - h[0])
            }

            function i() {
                function i() {
                    32 == au.event.keyCode && (A || (x = null, L[0] -= f[1], L[1] -= h[1], A = 2), C())
                }

                function d() {
                    32 == au.event.keyCode && 2 == A && (L[0] += f[1], L[1] += h[1], A = 0, C())
                }

                function v() {
                    var t = au.mouse(M), i = !1;
                    b && (t[0] += b[0], t[1] += b[1]), A || (au.event.altKey ? (x || (x = [(f[0] + f[1]) / 2, (h[0] + h[1]) / 2]), L[0] = f[+(t[0] < x[0])], L[1] = h[+(t[1] < x[1])]) : x = null), N && m(t, l, 0) && (e(k), i = !0), E && m(t, c, 1) && (r(k), i = !0), i && (n(k), _({
                        type: "brush",
                        mode: A ? "move" : "resize"
                    }))
                }

                function m(t, n, e) {
                    var r, i, u = Yi(n), s = u[0], l = u[1], c = L[e], d = e ? h : f, v = d[1] - d[0];
                    return A && (s -= c, l -= v + c), r = (e ? p : g) ? Math.max(s, Math.min(l, t[e])) : t[e], A ? i = (r += c) + v : (x && (c = Math.max(s, Math.min(l, 2 * x[e] - r))), r > c ? (i = r, r = c) : i = c), d[0] != r || d[1] != i ? (e ? a = null : o = null, d[0] = r, d[1] = i, !0) : void 0
                }

                function y() {
                    v(), k.style("pointer-events", "all").selectAll(".resize").style("display", t.empty() ? "none" : null), au.select("body").style("cursor", null), T.on("mousemove.brush", null).on("mouseup.brush", null).on("touchmove.brush", null).on("touchend.brush", null).on("keydown.brush", null).on("keyup.brush", null), z(), _({type: "brushend"})
                }

                var x, b, M = this, w = au.select(au.event.target), _ = s.of(M, arguments), k = au.select(M), S = w.datum(), N = !/^(n|s)$/.test(S) && l, E = !/^(e|w)$/.test(S) && c, A = w.classed("extent"), z = tt(M), L = au.mouse(M), T = au.select(u(M)).on("keydown.brush", i).on("keyup.brush", d);
                if (au.event.changedTouches ? T.on("touchmove.brush", v).on("touchend.brush", y) : T.on("mousemove.brush", v).on("mouseup.brush", y), k.interrupt().selectAll("*").interrupt(), A)L[0] = f[0] - L[0], L[1] = h[0] - L[1]; else if (S) {
                    var R = +/w$/.test(S), q = +/^n/.test(S);
                    b = [f[1 - R] - L[0], h[1 - q] - L[1]], L[0] = f[R], L[1] = h[q]
                } else au.event.altKey && (x = L.slice());
                k.style("pointer-events", "none").selectAll(".resize").style("display", null), au.select("body").style("cursor", w.style("cursor")), _({type: "brushstart"}), v()
            }

            var o, a, s = L(t, "brushstart", "brush", "brushend"), l = null, c = null, f = [0, 0], h = [0, 0], g = !0, p = !0, d = Js[0];
            return t.event = function (t) {
                t.each(function () {
                    var t = s.of(this, arguments), n = {x: f, y: h, i: o, j: a}, e = this.__chart__ || n;
                    this.__chart__ = n, Os ? au.select(this).transition().each("start.brush", function () {
                        o = e.i, a = e.j, f = e.x, h = e.y, t({type: "brushstart"})
                    }).tween("brush:brush", function () {
                        var e = kr(f, n.x), r = kr(h, n.y);
                        return o = a = null, function (i) {
                            f = n.x = e(i), h = n.y = r(i), t({type: "brush", mode: "resize"})
                        }
                    }).each("end.brush", function () {
                        o = n.i, a = n.j, t({type: "brush", mode: "resize"}), t({type: "brushend"})
                    }) : (t({type: "brushstart"}), t({type: "brush", mode: "resize"}), t({type: "brushend"}))
                })
            }, t.x = function (n) {
                return arguments.length ? (l = n, d = Js[!l << 1 | !c], t) : l
            }, t.y = function (n) {
                return arguments.length ? (c = n, d = Js[!l << 1 | !c], t) : c
            }, t.clamp = function (n) {
                return arguments.length ? (l && c ? (g = !!n[0], p = !!n[1]) : l ? g = !!n : c && (p = !!n), t) : l && c ? [g, p] : l ? g : c ? p : null
            }, t.extent = function (n) {
                var e, r, i, u, s;
                return arguments.length ? (l && (e = n[0], r = n[1], c && (e = e[0], r = r[0]), o = [e, r], l.invert && (e = l(e), r = l(r)), e > r && (s = e, e = r, r = s), (e != f[0] || r != f[1]) && (f = [e, r])), c && (i = n[0], u = n[1], l && (i = i[1], u = u[1]), a = [i, u], c.invert && (i = c(i), u = c(u)), i > u && (s = i, i = u, u = s), (i != h[0] || u != h[1]) && (h = [i, u])), t) : (l && (o ? (e = o[0], r = o[1]) : (e = f[0], r = f[1], l.invert && (e = l.invert(e), r = l.invert(r)), e > r && (s = e, e = r, r = s))), c && (a ? (i = a[0], u = a[1]) : (i = h[0], u = h[1], c.invert && (i = c.invert(i), u = c.invert(u)), i > u && (s = i, i = u, u = s))), l && c ? [[e, i], [r, u]] : l ? [e, r] : c && [i, u])
            }, t.clear = function () {
                return t.empty() || (f = [0, 0], h = [0, 0], o = a = null), t
            }, t.empty = function () {
                return !!l && f[0] == f[1] || !!c && h[0] == h[1]
            }, au.rebind(t, s, "on")
        };
        var Zs = {
            n: "ns-resize",
            e: "ew-resize",
            s: "ns-resize",
            w: "ew-resize",
            nw: "nwse-resize",
            ne: "nesw-resize",
            se: "nwse-resize",
            sw: "nesw-resize"
        }, Js = [["n", "e", "s", "w", "nw", "ne", "se", "sw"], ["e", "w"], ["n", "s"], []], Vs = ga.format = xa.timeFormat, $s = Vs.utc, Qs = $s("%Y-%m-%dT%H:%M:%S.%LZ");
        Vs.iso = Date.prototype.toISOString && +new Date("2000-01-01T00:00:00.000Z") ? eu : Qs, eu.parse = function (t) {
            var n = new Date(t);
            return isNaN(n) ? null : n
        }, eu.toString = Qs.toString, ga.second = Xt(function (t) {
            return new pa(1e3 * Math.floor(t / 1e3))
        }, function (t, n) {
            t.setTime(t.getTime() + 1e3 * Math.floor(n))
        }, function (t) {
            return t.getSeconds()
        }), ga.seconds = ga.second.range, ga.seconds.utc = ga.second.utc.range, ga.minute = Xt(function (t) {
            return new pa(6e4 * Math.floor(t / 6e4))
        }, function (t, n) {
            t.setTime(t.getTime() + 6e4 * Math.floor(n))
        }, function (t) {
            return t.getMinutes()
        }), ga.minutes = ga.minute.range, ga.minutes.utc = ga.minute.utc.range, ga.hour = Xt(function (t) {
            var n = t.getTimezoneOffset() / 60;
            return new pa(36e5 * (Math.floor(t / 36e5 - n) + n))
        }, function (t, n) {
            t.setTime(t.getTime() + 36e5 * Math.floor(n))
        }, function (t) {
            return t.getHours()
        }), ga.hours = ga.hour.range, ga.hours.utc = ga.hour.utc.range, ga.month = Xt(function (t) {
            return t = ga.day(t), t.setDate(1), t
        }, function (t, n) {
            t.setMonth(t.getMonth() + n)
        }, function (t) {
            return t.getMonth()
        }), ga.months = ga.month.range, ga.months.utc = ga.month.utc.range;
        var Ws = [1e3, 5e3, 15e3, 3e4, 6e4, 3e5, 9e5, 18e5, 36e5, 108e5, 216e5, 432e5, 864e5, 1728e5, 6048e5, 2592e6, 7776e6, 31536e6], Gs = [[ga.second, 1], [ga.second, 5], [ga.second, 15], [ga.second, 30], [ga.minute, 1], [ga.minute, 5], [ga.minute, 15], [ga.minute, 30], [ga.hour, 1], [ga.hour, 3], [ga.hour, 6], [ga.hour, 12], [ga.day, 1], [ga.day, 2], [ga.week, 1], [ga.month, 1], [ga.month, 3], [ga.year, 1]], Ks = Vs.multi([[".%L", function (t) {
            return t.getMilliseconds()
        }], [":%S", function (t) {
            return t.getSeconds()
        }], ["%I:%M", function (t) {
            return t.getMinutes()
        }], ["%I %p", function (t) {
            return t.getHours()
        }], ["%a %d", function (t) {
            return t.getDay() && 1 != t.getDate()
        }], ["%b %d", function (t) {
            return 1 != t.getDate()
        }], ["%B", function (t) {
            return t.getMonth()
        }], ["%Y", qn]]), tl = {
            range: function (t, n, e) {
                return au.range(Math.ceil(t / e) * e, +n, e).map(iu)
            }, floor: _, ceil: _
        };
        Gs.year = ga.year, ga.scale = function () {
            return ru(au.scale.linear(), Gs, Ks)
        };
        var nl = Gs.map(function (t) {
            return [t[0].utc, t[1]]
        }), el = $s.multi([[".%L", function (t) {
            return t.getUTCMilliseconds()
        }], [":%S", function (t) {
            return t.getUTCSeconds()
        }], ["%I:%M", function (t) {
            return t.getUTCMinutes()
        }], ["%I %p", function (t) {
            return t.getUTCHours()
        }], ["%a %d", function (t) {
            return t.getUTCDay() && 1 != t.getUTCDate()
        }], ["%b %d", function (t) {
            return 1 != t.getUTCDate()
        }], ["%B", function (t) {
            return t.getUTCMonth()
        }], ["%Y", qn]]);
        nl.year = ga.year.utc, ga.scale.utc = function () {
            return ru(au.scale.linear(), nl, el)
        }, au.text = Tt(function (t) {
            return t.responseText
        }), au.json = function (t, n) {
            return Rt(t, "application/json", ou, n)
        }, au.html = function (t, n) {
            return Rt(t, "text/html", uu, n)
        }, au.xml = Tt(function (t) {
            return t.responseXML
        }), r = au, i = "function" == typeof r ? r.call(n, e, n, t) : r, !(void 0 !== i && (t.exports = i)), this.d3 = au
    }()
}, function (t, n, e) {
    function r(t, n) {
        for (var e = 0; e < t.length; e++) {
            var r = t[e], i = g[r.id];
            if (i) {
                i.refs++;
                for (var o = 0; o < i.parts.length; o++)i.parts[o](r.parts[o]);
                for (; o < r.parts.length; o++)i.parts.push(l(r.parts[o], n))
            } else {
                for (var u = [], o = 0; o < r.parts.length; o++)u.push(l(r.parts[o], n));
                g[r.id] = {id: r.id, refs: 1, parts: u}
            }
        }
    }

    function i(t) {
        for (var n = [], e = {}, r = 0; r < t.length; r++) {
            var i = t[r], o = i[0], u = i[1], a = i[2], s = i[3], l = {css: u, media: a, sourceMap: s};
            e[o] ? e[o].parts.push(l) : n.push(e[o] = {id: o, parts: [l]})
        }
        return n
    }

    function o(t, n) {
        var e = v(), r = x[x.length - 1];
        if ("top" === t.insertAt)r ? r.nextSibling ? e.insertBefore(n, r.nextSibling) : e.appendChild(n) : e.insertBefore(n, e.firstChild), x.push(n); else {
            if ("bottom" !== t.insertAt)throw new Error("Invalid value for parameter 'insertAt'. Must be 'top' or 'bottom'.");
            e.appendChild(n)
        }
    }

    function u(t) {
        t.parentNode.removeChild(t);
        var n = x.indexOf(t);
        n >= 0 && x.splice(n, 1)
    }

    function a(t) {
        var n = document.createElement("style");
        return n.type = "text/css", o(t, n), n
    }

    function s(t) {
        var n = document.createElement("link");
        return n.rel = "stylesheet", o(t, n), n
    }

    function l(t, n) {
        var e, r, i;
        if (n.singleton) {
            var o = y++;
            e = m || (m = a(n)), r = c.bind(null, e, o, !1), i = c.bind(null, e, o, !0)
        } else t.sourceMap && "function" == typeof URL && "function" == typeof URL.createObjectURL && "function" == typeof URL.revokeObjectURL && "function" == typeof Blob && "function" == typeof btoa ? (e = s(n), r = h.bind(null, e), i = function () {
            u(e), e.href && URL.revokeObjectURL(e.href)
        }) : (e = a(n), r = f.bind(null, e), i = function () {
            u(e)
        });
        return r(t), function (n) {
            if (n) {
                if (n.css === t.css && n.media === t.media && n.sourceMap === t.sourceMap)return;
                r(t = n)
            } else i()
        }
    }

    function c(t, n, e, r) {
        var i = e ? "" : r.css;
        if (t.styleSheet)t.styleSheet.cssText = b(n, i); else {
            var o = document.createTextNode(i), u = t.childNodes;
            u[n] && t.removeChild(u[n]), u.length ? t.insertBefore(o, u[n]) : t.appendChild(o)
        }
    }

    function f(t, n) {
        var e = n.css, r = n.media;
        n.sourceMap;
        if (r && t.setAttribute("media", r), t.styleSheet)t.styleSheet.cssText = e; else {
            for (; t.firstChild;)t.removeChild(t.firstChild);
            t.appendChild(document.createTextNode(e))
        }
    }

    function h(t, n) {
        var e = n.css, r = (n.media, n.sourceMap);
        r && (e += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(r)))) + " */");
        var i = new Blob([e], {type: "text/css"}), o = t.href;
        t.href = URL.createObjectURL(i), o && URL.revokeObjectURL(o)
    }

    var g = {}, p = function (t) {
        var n;
        return function () {
            return "undefined" == typeof n && (n = t.apply(this, arguments)), n
        }
    }, d = p(function () {
        return /msie [6-9]\b/.test(window.navigator.userAgent.toLowerCase())
    }), v = p(function () {
        return document.head || document.getElementsByTagName("head")[0]
    }), m = null, y = 0, x = [];
    t.exports = function (t, n) {
        n = n || {}, "undefined" == typeof n.singleton && (n.singleton = d()), "undefined" == typeof n.insertAt && (n.insertAt = "bottom");
        var e = i(t);
        return r(e, n), function (t) {
            for (var o = [], u = 0; u < e.length; u++) {
                var a = e[u], s = g[a.id];
                s.refs--, o.push(s)
            }
            if (t) {
                var l = i(t);
                r(l, n)
            }
            for (var u = 0; u < o.length; u++) {
                var s = o[u];
                if (0 === s.refs) {
                    for (var c = 0; c < s.parts.length; c++)s.parts[c]();
                    delete g[s.id]
                }
            }
        }
    };
    var b = function () {
        var t = [];
        return function (n, e) {
            return t[n] = e, t.filter(Boolean).join("\n")
        }
    }()
}, function (t, n) {
    t.exports = jQuery
}, function (t, n, e) {
    "use strict";
    function r(t, n) {
        if (!(t instanceof n))throw new TypeError("Cannot call a class as a function")
    }

    var i = function () {
        function t(t, n) {
            for (var e = 0; e < n.length; e++) {
                var r = n[e];
                r.enumerable = r.enumerable || !1, r.configurable = !0, "value"in r && (r.writable = !0), Object.defineProperty(t, r.key, r)
            }
        }

        return function (n, e, r) {
            return e && t(n.prototype, e), r && t(n, r), n
        }
    }(), o = e(4), u = e(2), a = e(20), s = function () {
        function t(n) {
            var i = this;
            r(this, t), this.element = n, this.hideEmpty = !0, this.hidden = !0;
            var s = o(e(18)(a)), l = o(n);
            l.append(s), l.find('input[name="hide-empty"]').change(function (t) {
                i.hideEmpty = t.target.checked, i.update()
            }), l.find("span[close]").click(function () {
                i.hide()
            }), this._dispatch = u.dispatch("open", "close"), this.table = u.select(this.element).classed(a.attributes, !0).select("[table]")
        }

        return i(t, [{
            key: "onOpen", value: function (t) {
                this._dispatch.on("open", t)
            }
        }, {
            key: "onClose", value: function (t) {
                this._dispatch.on("close", t)
            }
        }, {
            key: "update", value: function () {
                this.createTable(this.filterData(this.node.attributes), this.table)
            }
        }, {
            key: "createTable", value: function (t, n) {
                var e = this;
                if (0 === t.length)return void n.append("tr").append("td").text("<empty>");
                var r = n.selectAll(function () {
                    return n.node().childNodes
                }).data(t, function (t) {
                    return t.id
                }), i = r.enter().append("tr").selectAll(function () {
                    return r.node().childNodes
                }).data(function (t) {
                    return t && t.expand ? [t] : [t.name, t.value]
                }, function (t) {
                    return t && t.id ? t.id : t
                });
                i.enter().append("td").attr("colspan", function (t) {
                    return t && t.expand ? 2 : null
                }).each(function (t) {
                    var r = u.select(this);
                    return t && "object" == typeof t ? (n = r.text(t.name).attr("class", a.expandable).append("table").html('<colgroup>\n                      <col>\n                      <col style="width:100%">\n                    </colgroup>').append("tbody"), void e.createTable(e.filterData(t.children), n)) : void r.text(t)
                }), i.exit().remove(), r.exit().remove(), r.sort(function (t, n) {
                    return u.ascending(t.name, n.name)
                })
            }
        }, {
            key: "filterData", value: function (t) {
                return this.hideEmpty ? t.filter(function (t) {
                    return "" !== t.value && null !== t.value
                }) : t
            }
        }, {
            key: "show", value: function (t) {
                this.node = t, t ? (this.hidden && (o(this.element).addClass(a.visible), this._dispatch.open(), this.hidden = !1), this.update()) : this.hide()
            }
        }, {
            key: "hide", value: function () {
                this.hidden || (o(this.element).removeClass(a.visible), this._dispatch.close(), this.hidden = !0)
            }
        }]), t
    }();
    t.exports = s
}, function (t, n, e) {
    "use strict";
    function r() {
        this.parent = i("body"), this.visible = !1, this.hint = i("<div>").addClass(o.hint)
    }

    var i = e(4), o = e(21);
    !function (t) {
        t.show = function (t) {
            this.lastContent !== t && (this.hint.html(t.replace(/\n/g, "<br />")), this.lastContent = t), this.visible || (this.parent.append(this.hint), this.visible = !0)
        }, t.move = function (t, n) {
            ("undefined" == typeof n || "left" !== n && "right" !== n) && (n = "left");
            var e = t.pageY + 10, r = 0, o = this.hint.outerWidth(), u = this.hint.outerHeight(), a = i(window).width(), s = i(document).height();
            "left" === n ? (r = t.pageX + 10, r + o > a && (r -= r + o - a)) : r = this.parent.width() - t.pageX + 10, e + u > s && (e -= e + u - s), this.hint.css(n, r).css("top", e)
        }, t.hide = function () {
            this.hint && (this.hint.remove(), this.visible = !1)
        }, t.offsetX = function () {
            return this.parent.offset().left
        }, t.offsetY = function () {
            return this.parent.offset().top
        }
    }(r.prototype), t.exports = r
}, function (t, n, e) {
    "use strict";
    function r(t) {
        return i.merge(t.map(function (t) {
            return (t.children() || []).map(function (n) {
                return {source: t, target: n}
            })
        }))
    }

    var i = e(2), o = {nodeXSkip: 10, nodeYSkip: 5, marginX: 2, marginY: 2};
    t.exports.constituency = function (t) {
        function n(t) {
            var n = t.allNodes().sort(function (t, n) {
                return i.ascending(t.order, n.order)
            });
            return e = i.max(n, function (t) {
                return t.depth()
            }), n
        }

        var e;
        return t = o, t.nodeXSkip = 4, n.computeLayout = function (n) {
            for (var r, i, o, u = -1, a = n.length, s = [], l = 0, c = [], f = []; ++u < a;)o = n[u], i = o.isLeaf() ? e : o.depth(), c[i] || (c[i] = 0), l += o.width / 2, 0 === u ? s[0] = l : (c[i] >= l ? l = c[i] + t.nodeXSkip : l += t.nodeXSkip, s[u] = l, c[i] = l + o.width, o.isRoot() || 1 !== o.children().length || (l += 15)), (!f[i] || f[i] < o.height) && (f[i] = o.height);
            for (f.push(0), u = 0, r = f.length, i = 0; r > u; u++) {
                var h = f[u];
                f[u] = i, i += h
            }
            for (u = -1; ++u < a;)o = n[u], i = o.isLeaf() ? e : o.depth(), o.y = t.marginY, o.y += f[i] + (t.nodeYSkip + t.marginY) * i, o.x = t.marginX + u * t.marginX + s[u]
        }, n.nodes = n, n.links = r, n
    }, t.exports.tree = function (t) {
        function n(t) {
            return t.allNodes().sort(function (t, n) {
                return i.ascending(t.order, n.order)
            })
        }

        return t = o, n.computeLayout = function (n) {
            for (var e, r, i, o = -1, u = n.length, a = [], s = 0, l = [], c = []; ++o < u;)i = n[o], r = i.depth(), l[r] || (l[r] = 0), l[r] >= s ? s = l[r] + t.nodeXSkip : s += t.nodeXSkip, a[o] = s, l[r] = s + i.width, (!c[r] || c[r] < i.height) && (c[r] = i.height);
            for (c.push(0), o = 0, e = c.length, r = 0; e > o; o++) {
                var f = c[o];
                c[o] = r, r += f
            }
            for (o = -1; ++o < u;)i = n[o], r = i.depth(), i.y = t.marginY, i.y = c[r] + (t.nodeYSkip + t.marginY) * r, i.x = t.marginX + o * t.marginX + a[o]
        }, n.nodes = n, n.links = r, n
    }
}, function (t, n, e) {
    "use strict";
    function r(t, n) {
        if (!(t instanceof n))throw new TypeError("Cannot call a class as a function")
    }

    var i = function () {
        function t(t, n) {
            for (var e = 0; e < n.length; e++) {
                var r = n[e];
                r.enumerable = r.enumerable || !1, r.configurable = !0, "value"in r && (r.writable = !0), Object.defineProperty(t, r.key, r)
            }
        }

        return function (n, e, r) {
            return e && t(n.prototype, e), r && t(n, r), n
        }
    }(), o = e(4), u = e(2), a = e(22), s = function () {
        function t(n) {
            r(this, t), this.element = n
        }

        return i(t, [{
            key: "init", value: function (t) {
                var n = this;
                if (o(this.element).empty(), this.treeView = t, !(t.$doc.bundles.length <= 1)) {
                    u.select(this.element).classed(a.pagination, !0), this.prev = this._button().text("Previous").on("click", function () {
                        t.previousBundle(), n.update()
                    });
                    var e = this.pages = u.select(this.element).append("ul").attr("class", a.pages).selectAll("li").data(t.$doc.bundles);
                    e.enter().append("li").on("click", function (e, r) {
                        t.setBundle(r), n.update()
                    }).append("span").text(function (t, n) {
                        return n + 1
                    }), e.exit().remove(), this.next = this._button().text("Next").on("click", function () {
                        t.nextBundle(), n.update()
                    }), this.update()
                }
            }
        }, {
            key: "_button", value: function () {
                return u.select(this.element).append("button").attr({"class": a.button, type: "button"})
            }
        }, {
            key: "update", value: function () {
                var t = this;
                this.next.property("disabled", function () {
                    return !t.treeView.hasNextBundle()
                }), this.pages.classed(a.active, function (n, e) {
                    return e === t.treeView.bundle
                }), this.prev.property("disabled", function () {
                    return !t.treeView.hasPreviousBundle()
                })
            }
        }]), t
    }();
    t.exports = s
}, function (t, n) {
    "use strict";
    function e(t) {
        return c(t).style("fill", m.anode), t.call(g), t
    }

    function r(t) {
        return t.append("line").style("stroke-width", 2).style("stroke", m.edge)
    }

    function i(t) {
        return t.attr("x1", function (t) {
            return t.source.x + x + 1
        }).attr("y1", function (t) {
            return t.source.y + x + 1
        }).attr("x2", function (t) {
            return t.target.x + x + 1
        }).attr("y2", function (t) {
            return t.target.y + x + 1
        }), t
    }

    function o(t) {
        var n = this;
        return t.each(function (t) {
            var e = d3.select(this), r = t.attr("is_generated") ? f(e) : c(e);
            r.attr("fill", function (t) {
                return !t.isRoot() && n.isCoord(t) ? m.tnode_coord : m.tnode
            })
        }), t.call(g), t
    }

    function u(t) {
        var n = this;
        return t = t.append("line").each(function (t) {
            var e = t.source, r = t.target, i = d3.select(this), o = m.edge, u = 2, a = null;
            r.attr("is_member") ? !r.isRoot() && n.isCoord(e) ? (u = 1, o = m.coord) : o = m.error : !r.isRoot() && n.isCoord(e) ? o = m.coord_mod : n.isCoord(r) && (o = m.coord, u = 1);
            var s = null != r.attr("functor") ? r.attr("functor")[0]["#value"] : "";
            (s.match(/^(PAR|PARTL|VOCAT|RHEM|CM|FPHR|PREC)$/) || !r.isRoot() && e.isRoot()) && (u = 1, a = "1, 2", o = m.edge), i.style("stroke-width", u).style("stroke", o), a && i.style("stroke-dasharray", a)
        })
    }

    function a(t) {
        return t.each(function (t) {
            var n, e, r = t.isLeaf(), i = d3.select(this);
            r ? (n = c(i).attr("cx", 0).attr("cy", 0), i.call(p), i.select("text").style("text-anchor", "middle"), e = "-NONE-" === t.attr("tag") ? "trace" : t.attr("is_head") ? "terminal_head" : "terminal") : (n = h(i), e = t.attr("is_head") ? "nonterminal_head" : "nonterminal"), n.attr("fill", m[e])
        }), t
    }

    function s(t) {
        return t.append("path").attr("stroke-width", 1).attr("stroke", m.edge).attr("fill", "none").attr("stroke-dasharray", function (t) {
            return t.target.isLeaf() ? "4,3" : "none"
        })
    }

    function l(t) {
        return t.attr("d", function (t) {
            var n = t.source, e = t.target;
            n.isLeaf() ? x + 1 : n.width / 2, e.isLeaf() ? x + 1 : e.width / 2;
            return "M" + n.x + " " + n.y + "L" + e.x + " " + n.y + "L" + e.x + " " + e.y
        }), t
    }

    function c(t) {
        return t.append("circle").style("stroke", m.edge).style("stroke-width", 1).attr("r", x).attr("cx", x + 1).attr("cy", x + 1)
    }

    function f(t) {
        return t.append("rect").attr("width", b).attr("height", b).attr("x", 1).attr("y", 1).style("stroke", m.edge).style("stroke-width", 1)
    }

    function h(t) {
        return t.append("rect").style("stroke", m.edge).style("stroke-width", 1).each(function (t) {
            var n = d3.select(this), e = d3.select(this.parentNode), r = e.append("text").style("text-anchor", "middle").style("font-family", "Arial").style("font-size", "12px").style("line-height", "normal").attr("stroke", "none").attr("font-size", "12px").attr("font", '10px "Arial"').call(d), i = r.node().getBBox();
            r.attr("x", 0).attr("y", i.height / 2), n.attr("width", i.width + 4).attr("height", i.height + 1).attr("x", -i.width / 2 - 1).attr("y", -i.height / 2 + 2)
        })
    }

    function g(t) {
        return t.append("rect").attr("x", 0).attr("y", 9).style("fill-opacity", .9).attr("fill", "white").each(function (t) {
            var n = d3.select(this), e = d3.select(this.parentNode), r = e.append("text").attr("dx", 1).attr("dy", 22).style("text-anchor", "start").style("font-family", "Arial").style("font-size", "12px").style("line-height", "normal").call(d), i = r.node().getBBox();
            n.attr("width", i.width + 1).attr("height", i.height + 2)
        })
    }

    function p(t) {
        return t.append("rect").attr("x", 0).attr("y", 9).style("fill-opacity", .9).attr("fill", "white").each(function (t) {
            var n = d3.select(this), e = d3.select(this.parentNode), r = e.append("text").attr("dx", 1).attr("dy", 22).style("text-anchor", "middle").style("font-family", "Arial").style("font-size", "12px").style("line-height", "normal").call(d), i = r.node().getBBox();
            n.attr("width", i.width + 2).attr("height", i.height + 2).attr("x", -i.width / 2 + 1)
        })
    }

    function d(t) {
        t.each(function (t) {
            if (t.labels) {
                var n = d3.select(this), e = t.labels.slice(), r = t.data.wild_dump;
                if (r && r.labels)for (var i in r.labels)r.labels.hasOwnProperty(i) && r.labels[i] && e.push("#{orange}" + i);
                for (var o = 0, u = e.length; u > o; o++) {
                    var a, s = e[o] || "", l = s.match(/#\{[\w#]+\}/g), c = s.split(/#\{[\w#]+\}/);
                    !c[0] && c.length > 1 && c.shift();
                    for (var f = 0, h = c.length; h > f; f++) {
                        var g = null;
                        l && f < l.length && (g = l[f].slice(2, -1)), a = n.append("tspan"), o && 0 == f && a.attr("dy", 12 * 1.2), 0 == f && a.attr("x", 1), g && a.attr("fill", g), a.text(c[f])
                    }
                }
            }
        })
    }

    function v(t) {
        switch (this.tree = t, t.layer) {
            case"p":
                this.styleNode = a, this.styleConnection = s, this.connect = l;
                break;
            case"t":
                this.styleNode = o, this.styleConnection = u, this.connect = i;
                break;
            default:
                this.styleNode = e, this.styleConnection = r, this.connect = i
        }
    }

    var m = {
        edge: "#555555",
        coord: "#bbbbbb",
        error: "#ff0000",
        anode: "#ff6666",
        anode_coord: "#ff6666",
        nnode: "#ffff00",
        tnode: "#4488ff",
        tnode_coord: "#ccddff",
        terminal: "#ffff66",
        terminal_head: "#90ee90",
        nonterminal_head: "#90ee90",
        nonterminal: "#ffffe0",
        trace: "#aaaaaa",
        current: "#ff0000",
        coref_gram: "#c05633",
        coref_text: "#4c509f",
        compl: "#629f52",
        alignment: "#bebebe",
        coindex: "#ffa500",
        lex: "#006400",
        aux: "#ff8c00",
        parenthesis: "#809080",
        afun: "#00008b",
        member: "#0000ff",
        sentmod: "#006400",
        subfunctor: "#a02818",
        nodetype: "#00008b",
        sempos: "#8b008b",
        phrase: "#00008b",
        formeme: "#b000b0",
        tag: "#004048",
        tag_feat: "#7098A0",
        clause0: "#ff00ff",
        clause1: "#ffa500",
        clause2: "#0000ff",
        clause3: "#3cb371",
        clause4: "#ff0000",
        clause5: "#9932cc",
        clause6: "#00008b",
        clause7: "#006400",
        clause8: "#8b0000",
        clause9: "#008b8b"
    }, y = /^(ADVS|APPS|CONFR|CONJ|CONTRA|CSQ|DISJ|GRAD|OPER|REAS)$/, x = 3.5, b = 7;
    v.prototype.isCoord = function (t) {
        return "t" !== this.layer ? !1 : null !== (null !== t ? t.data.functor : void 0) && y.test(t.data.functor)
    }, t.exports = v
}, function (t, n, e) {
    "use strict";
    function r(t) {
        this.$top = i.select(t)
    }

    var i = e(2), o = e(7), u = e(6), a = e(9), s = e(23);
    !function (t) {
        function n(t, n, e) {
            t.selectAll("span").remove();
            var r = t.selectAll("span").data(e.desc);
            r.enter().append("span").attr("class", function (t) {
                return t.slice(1).map(function (t) {
                    return s[t] ? s[t] : t
                }).join(" ")
            }).each(function (t) {
                var e = i.select(this), r = t[1];
                "newline" === r ? e.append("br") : e.text(function (t) {
                    return t[0]
                }), "label" != r && "newline" != r && "space" != r && (e.classed(s.mouseHighlight, !0), e.on("click", function (t) {
                    var e = t.slice(1), r = e.length, o = -1;
                    if (0 != r) {
                        for (; ++o < r;)e[o] = "#" + e[o];
                        n.selectAll(e.join(", ")).each(function () {
                            var t = i.select(this), n = i.select(this.firstChild) || t, e = this.firstChild ? this.firstChild.getBBox() : this.getBBox(), r = e.width / 2, o = e.height / 2, u = Math.sqrt(r * r + o * o);
                            t.append("circle").attr("cx", e.x + r).attr("cy", e.y + o).attr("r", u).attr("fill", "none").attr("stroke", n.style("fill") || "orange").attr("stroke-width", 3).transition().duration(1e3).attr("r", 4 * u).remove()
                        })
                    }
                }))
            }), r.exit().remove()
        }

        t.init = function (t) {
            var n = this, e = n.$top;
            n.$doc = t, n.bundle = 0, n.dispatch = i.dispatch("nodeSelect"), n.selectedNode = null, n.desc = null, n.svg = e.append("div").attr("class", s.treeviewGfx).append("svg")
        }, t.description = function (t) {
            this.desc = i.select(t)
        }, t.selectNode = function (t, n) {
            var e = this, r = e.selectedNode;
            r !== n ? (e.deselectNode(!0), e.nodeSelection = i.select(n).append("rect").attr("width", t.width).attr("height", t.height).attr("x", 0).attr("y", 0).style("fill", "#c80000").style("fill-opacity", "0.1").style("stroke", "#c80000").style("stroke-width", "1.5px"), e.selectedNode = n, e.dispatch.nodeSelect(t, n, r)) : e.deselectNode()
        }, t.deselectNode = function (t) {
            var n = this;
            n.nodeSelection && (n.nodeSelection.remove(), t || n.dispatch.nodeSelect(null, null, n.selectedNode), n.selectedNode = n.nodeSelection = null)
        }, t.onNodeSelect = function (t) {
            this.dispatch.on("nodeSelect", t)
        }, t.nextBundle = function () {
            var t = this;
            t.hasNextBundle() && (t.bundle += 1, t.drawBundle())
        }, t.hasNextBundle = function () {
            return this.bundle + 1 < this.$doc.bundles.length
        }, t.previousBundle = function () {
            var t = this;
            t.hasPreviousBundle() && (t.bundle -= 1, t.drawBundle())
        }, t.setBundle = function (t) {
            this.bundle = t, this.drawBundle()
        }, t.hasPreviousBundle = function () {
            return this.bundle > 0
        }, t.drawBundle = function () {
            var t, e, r = this, l = r.$doc.bundles[r.bundle], c = r.desc, f = new u, h = r.svg;
            r.deselectNode(), c && n(c, r.svg, l);
            var g = h.selectAll("." + s.tree).data(l.allTrees(), function (t) {
                return t.language + "-" + t.layer
            });
            g.enter().append("g").attr("class", s.tree);
            var p, d = r;
            t = e = 0, g.each(function (n) {
                var r = i.select(this), u = new a(n), l = "p" === n.layer ? o.constituency() : o.tree(), h = l.nodes(n), g = l.links(h);
                !r.select("g." + s.link).empty() || r.append("g").attr("class", s.links), !r.select("g." + s.link).empty() || r.append("g").attr("class", s.nodes);
                var v = r.select("g." + s.links).selectAll("." + s.link).data(g, function (t) {
                    return t.source.uid + "|" + t.target.uid
                });
                u.styleConnection(v.enter()).attr("class", s.link).order();
                var m = r.select("g." + s.nodes).selectAll("." + s.node).data(h, function (t) {
                    return t.uid
                });
                u.styleNode(m.enter().append("g").attr("class", s.node).attr("id", function (t) {
                    return t.id
                })), m.each(function (t) {
                    var n = this.getBBox();
                    t.figure = this, t.width = n.width, t.height = n.height
                });
                var y;
                c && (y = function (t) {
                    c.selectAll("span." + t.id).classed(s.highlight, !1), t.hint && f.hide()
                }, m.on("mouseover", function (t) {
                    c.selectAll("span." + t.id).classed(s.highlight, !0), t.hint && f.show(t.hint)
                }).on("mousemove", function (t) {
                    t.hint && f.move(i.event)
                }).on("mouseout", y)), m.on("click", function (t) {
                    if (d.selectNode(t, this), y) {
                        var n = i.mouse(this);
                        (n[0] < 0 || n[0] > t.width || n[1] < 0 || n[1] > t.height) && y(t)
                    }
                }), l.computeLayout(h), u.connect(v), v.exit().remove(), m.attr("transform", function (t) {
                    return "translate(" + t.x + "," + t.y + ")"
                }), m.exit().remove();
                var x = this.getBBox(), b = 0;
                p ? (b = p.x + p.width + 10, t = b + x.width) : t = x.x + x.width, e < x.height && (e = x.height), x.x = b, r.attr("transform", "translate(" + x.x + ",10)"), p = x
            }), g.exit().remove(), h.attr("width", t + 14).attr("height", e + 12)
        }
    }(r.prototype), t.exports = function (t) {
        return new r(t)
    }
}, function (t, n, e) {
    "use strict";
    function r(t, n) {
        if (!(t instanceof n))throw new TypeError("Cannot call a class as a function")
    }

    var i, o, u, a, s, l = t.exports = {}, c = e(2);
    l.documents = {};
    var f = "hasOwnProperty";
    l.parseStyles = function (t) {
        var n = {};
        if (!t)return n;
        var e = t.match(/#\{[a-zA-Z0-9-:\.#]+\}/g);
        if (!e)return n;
        for (var r = 0; r < e.length; r++) {
            var i = e[r].slice(2, -1);
            i = i.split(":");
            var o = i[0];
            i = i[1], o = o.split("-");
            var u = o.length > 1 ? o.shift() : "Node";
            o = o.shift(), n[u] || (n[u] = {}), n[u][o] = i
        }
        return n
    }, i = function () {
        this.bundles = [], this.file = ""
    }, l.Document = i, l.document = function () {
        return new i
    }, i.fromJSON = function (t) {
        for (var n = new i, e = -1, r = t.length; ++e < r;) {
            var u = t[e], a = o.fromJSON(u);
            a.document = n, n.bundles.push(a)
        }
        return n
    }, o = function () {
        this.zones = {}, this.document = null
    }, l.Bundle = o, l.bundle = function () {
        return new o
    }, o.prototype = {
        allZones: function () {
            var t = [];
            for (var n in this.zones)t.push(this.zones[n]);
            return t
        }, allTrees: function () {
            var t = [], n = this.zones;
            for (var e in n)if (n[f](e)) {
                var r = n[e], i = r.trees;
                for (var o in i)i[f](o) && t.push(i[o])
            }
            return t
        }
    }, o.fromJSON = function (t) {
        var n = new o, e = t.zones;
        n.style = l.parseStyles(t.style), n.desc = t.desc;
        for (var r in e) {
            var i = e[r], a = u.fromJSON(i);
            a.bundle = n, a.label = r, n.zones[r] = a
        }
        return n
    }, u = function () {
        this.trees = {}, this.sentence = "", this.label = "", this.bundle = null
    }, l.Zone = u, l.zone = function () {
        return new u
    }, u.fromJSON = function (t) {
        var n = new u, e = t.trees;
        for (var r in e) {
            var i = e[r], o = n.trees[r] = a.fromJSON(i.nodes);
            o.layer = i.layer, o.language = i.language
        }
        return n.sentence = t.sentence, n
    }, a = function (t) {
        this.root = t, this.layer = "", this.language = ""
    }, l.Tree = a, l.tree = function (t) {
        return new a(t)
    }, a.fromJSON = function (t) {
        for (var n, e, r = {}, i = [], o = null, u = 0, l = t.length; l > u; u++)e = t[u], o = new s(e.id, e.data, e.style), o.labels = e.labels, o.hint = e.hint, o.order = u, r[e.id] = o, i.push(o), null === e.parent && (n = o);
        if (!n)throw"Tree has no root!";
        var c = new a(n);
        for (c.index = r, c.nodes = i, u = 0, l = t.length; l > u; u++)o = i[u], e = t[u], e.firstson && (o.firstson = r[e.firstson]), e.parent && (o.parent = r[e.parent]), e.rbrother && (o.rbrother = r[e.rbrother]);
        return c
    }, a.prototype = {
        allNodes: function () {
            return this.nodes
        }
    };
    var h = 0, g = function d(t, n) {
        var e = this, i = arguments.length <= 2 || void 0 === arguments[2] ? null : arguments[2];
        r(this, d), this.id = h++, this.name = t, this.parent = i, n && "object" == typeof n ? (this.expand = !0, this.children = c.entries(n).map(function (t) {
            return new d(t.key, t.value, e)
        })) : this.value = n
    }, p = 0;
    s = function (t, n, e) {
        this.id = t, this.data = n || {}, this.attributes = c.entries(this.data).map(function (t) {
            return new g(t.key, t.value)
        }), this.style = l.parseStyles(e), this.parent = null, this.lbrother = null, this.rbrother = null, this.firstson = null, this.order = p++, this.uid = "node_" + this.order
    }, l.Node = s, l.node = function (t, n) {
        return new s(t, n)
    }, s.prototype = {
        isLeaf: function () {
            return null == this.firstson
        }, isRoot: function () {
            return null == this.parent
        }, root: function () {
            for (var t = this; t && null != t.parent;)t = t.parent;
            return t
        }, attr: function (t) {
            return this.data[t]
        }, following: function (t) {
            if (this.firstson)return this.firstson;
            for (var n = this; n;) {
                if (n.uid == t.uid || !n.parent)return null;
                if (n.rbrother)return n.rbrother;
                n = n.parent
            }
            return null
        }, descendants: function () {
            for (var t = [], n = this.following(this); n;)t.push(n), n = n.following(this);
            return t
        }, leftmostDescendant: function () {
            for (var t = this; t.firstson;)t = t.firstson;
            return t
        }, rightmostDescendant: function () {
            for (var t = this; t.firstson;)for (t = t.firstson; t.rbrother;)t = t.rbrother;
            return t
        }, depth: function () {
            for (var t = -1, n = this; n;)n = n.parent, t++;
            return t
        }, children: function v() {
            for (var v = [], t = this.firstson; t;)v.push(t), t = t.rbrother;
            return v
        }
    }
}, function (t, n, e) {
    "use strict";
    function r() {
        for (var t = ["svg", "pagination", "sentence", "attributes"], n = e(24), r = i(e(19)(n)), o = {html: r}, u = t.length - 1; u >= 0; u--) {
            var a = t[u];
            o[a] = r.find("[" + a + "]").get(0)
        }
        return o
    }

    var i = e(4), o = e(11), u = e(10), a = e(8), s = e(5);
    t.exports = function (t) {
        var n = i(this), e = r();
        n.html(e.html);
        var l = new u(e.svg);
        l.init(o.Document.fromJSON(t));
        var c = new a(e.pagination);
        c.init(l);
        var f = new s(e.attributes);
        l.onNodeSelect(function (t) {
            f.show(t)
        }), f.onClose(function () {
            l.deselectNode(!0)
        }), l.description(e.sentence), l.drawBundle()
    }
}, function (t, n, e) {
    n = t.exports = e(1)(), n.push([t.id, "._wyzEJ{width:0;display:none;-webkit-box-flex:0;-webkit-flex:0 1 auto;-ms-flex:0 1 auto;flex:0 1 auto;font-size:11px;padding:5px 0 0;margin:5px 5px 0 0;border-top:2px solid #ddd;border-right:2px solid #ddd;border-radius:4px}._wyzEJ ._A_k8H table{width:100%;max-width:100%;border-spacing:0;border-collapse:collapse}._wyzEJ ._A_k8H table tbody>tr>td:first-child{font-weight:700}._wyzEJ ._A_k8H table tbody>tr>td:nth-child(2){font-weight:400}._wyzEJ ._A_k8H table tbody>tr>td{border:1px solid #ddd;border-right:none;padding:1px 3px}._wyzEJ ._A_k8H table tbody>tr>td>table{border:none;margin-left:5%;margin-bottom:-1px;width:95%;max-width:95%}._wyzEJ ._1fzUE{padding:1px 0 0 3px!important}._1HZnV{width:300px;min-width:300px;display:block}._3cNrh{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:normal;-webkit-flex-direction:row;-ms-flex-direction:row;flex-direction:row;-webkit-flex-wrap:nowrap;-ms-flex-wrap:nowrap;flex-wrap:nowrap;padding:0 5px}._1mzDu{-webkit-box-flex:1;-webkit-flex:1 1 auto;-ms-flex:1 1 auto;flex:1 1 auto;position:relative;color:#777}._1mzDu label{display:inline-block;min-height:20px;max-width:100%;padding-left:20px;margin-bottom:0;font-weight:400;cursor:pointer}._1mzDu input{position:absolute;margin:4px 0 0 -20px;padding:0;line-height:normal}._26lQ8 span{font-size:21px;font-weight:700;line-height:1;color:#000;text-shadow:0 1px 0 #fff;filter:alpha(opacity=20);opacity:.2;cursor:pointer}._26lQ8 span:hover{color:#000;text-decoration:none;cursor:pointer;filter:alpha(opacity=50);opacity:.5}", ""]), n.locals = {
        attributes: "_wyzEJ",
        table: "_A_k8H",
        expandable: "_1fzUE",
        visible: "_1HZnV",
        controls: "_3cNrh",
        hideEmptyCheckbox: "_1mzDu",
        closeButton: "_26lQ8"
    }
}, function (t, n, e) {
    n = t.exports = e(1)(), n.push([t.id, "._XDxEE{position:absolute;font-family:Helvetica Neue,Helvetica,Arial,'sans-serif';font-size:14px;line-height:20px;z-index:350;border:1px solid #000;background-color:#faf7aa;padding:4px;border-radius:4px;white-space:nowrap}", ""]), n.locals = {hint: "_XDxEE"}
}, function (t, n, e) {
    n = t.exports = e(1)(), n.push([t.id, "._3iZkq{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:normal;-webkit-flex-direction:row;-ms-flex-direction:row;flex-direction:row;margin:10px 0}._wg-LX{display:inline-block;padding-left:0;border-radius:4px;margin:0 5px}._wg-LX>li{display:inline}._wg-LX>li>span{position:relative;float:left;padding:6px 12px;line-height:20px;text-decoration:none;color:#337ab7;background-color:#fff;border:1px solid #ddd;margin-left:-1px;cursor:pointer}._wg-LX>li:first-child>span{margin-left:0}._wg-LX>li>span:focus,._wg-LX>li>span:hover{z-index:2;color:#23527c;background-color:#eee;border-color:#ddd}._wg-LX>._2fP21>span,._wg-LX>._2fP21>span:focus,._wg-LX>._2fP21>span:hover{z-index:3;color:#23527c;background-color:#eee;border-color:#ddd;cursor:default}._vRJTd{display:inline-block;padding:5px 14px;background-color:#fff;border:1px solid #ddd;color:#23527c;outline:none;cursor:pointer}._vRJTd:hover{color:#337ab7;background-color:#eee;border-color:#ddd}", ""]), n.locals = {
        pagination: "_3iZkq",
        pages: "_wg-LX",
        active: "_2fP21",
        button: "_vRJTd"
    }
}, function (t, n, e) {
    n = t.exports = e(1)(), n.push([t.id, "._afvzu{font:inherit}._2lieM{display:inline-block;padding:2px 4px;font-size:12px;border-radius:3px;font-weight:700;line-height:16px;color:#fff;text-shadow:0 -1px 0 rgba(0,0,0,.25);white-space:nowrap;vertical-align:top;background-color:#999}._1uJ05{background-color:#ff0}._3Wgg1:hover{background-color:#ffa;cursor:pointer}._3criC,._19NMQ{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}._19NMQ{cursor:pointer}._1fwq5,._2nS8a,._R_cI5{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}", ""]), n.locals = {
        treeviewGfx: "_afvzu",
        label: "_2lieM",
        highlight: "_1uJ05",
        mouseHighlight: "_3Wgg1",
        nodes: "_3criC",
        node: "_19NMQ",
        links: "_R_cI5",
        link: "_1fwq5",
        tree: "_2nS8a"
    }
}, function (t, n, e) {
    n = t.exports = e(1)(), n.push([t.id, "._k9DtN{font-family:Helvetica Neue,Helvetica,Arial,'sans-serif';font-size:14px;line-height:20px;color:#333;background-color:#fff}._3q5xU{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:normal;-webkit-flex-direction:row;-ms-flex-direction:row;flex-direction:row;-webkit-flex-wrap:nowrap;-ms-flex-wrap:nowrap;flex-wrap:nowrap;overflow:hidden}._2nZyh{overflow:auto;min-height:600px}", ""]), n.locals = {
        container: "_k9DtN",
        pane: "_3q5xU",
        svg: "_2nZyh"
    }
}, function (t, n) {
    t.exports = function (t) {
        var n = '<div class="' + t.controls + '"> <div class="' + t.hideEmptyCheckbox + '"> <label> <input type="checkbox" name="hide-empty" checked="checked" /> Hide empty attributes </label> </div> <div class="' + t.closeButton + '"> <span close>&times;</span> </div></div><div class="' + t.table + '"> <table> <colgroup> <col> <col style="width:100%"> </colgroup> <tbody table></tbody> </table></div>';
        return n
    }
}, function (t, n) {
    t.exports = function (t) {
        var n = '<div class="' + t.container + '"> <div pagination></div> <div sentence></div> <div class="' + t.pane + '"> <div attributes></div> <div svg class="' + t.svg + '"></div> </div></div>';
        return n
    }
}, function (t, n, e) {
    var r = e(13);
    "string" == typeof r && (r = [[t.id, r, ""]]);
    e(3)(r, {});
    r.locals && (t.exports = r.locals)
}, function (t, n, e) {
    var r = e(14);
    "string" == typeof r && (r = [[t.id, r, ""]]);
    e(3)(r, {});
    r.locals && (t.exports = r.locals)
}, function (t, n, e) {
    var r = e(15);
    "string" == typeof r && (r = [[t.id, r, ""]]);
    e(3)(r, {});
    r.locals && (t.exports = r.locals)
}, function (t, n, e) {
    var r = e(16);
    "string" == typeof r && (r = [[t.id, r, ""]]);
    e(3)(r, {});
    r.locals && (t.exports = r.locals)
}, function (t, n, e) {
    var r = e(17);
    "string" == typeof r && (r = [[t.id, r, ""]]);
    e(3)(r, {});
    r.locals && (t.exports = r.locals)
}]);
//# sourceMappingURL=js-treex-view.js.map