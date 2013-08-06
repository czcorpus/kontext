/*
 * Copyright (c) 2012 Czech National Corpus
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/*
 * PhantomJS based test runner
 */


phantom.onError = function(msg, trace) {
    var msgStack = ['PHANTOM ERROR: ' + msg];
    if (trace) {
        msgStack.push('TRACE:');
        trace.forEach(function (t) {
            msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function + ')' : ''));
        });
    }
    console.error(msgStack.join('\n'));
};

var runTest = function (fileName, url) {
    var page = require('webpage').create();
    page.onConsoleMessage = function (msg) {
        console.log(msg);
    };

    page.onCallback = function(data) {
        console.log('Closing PhantomJS...');
        phantom.exit(data.totalErrors);
    };

    page.onError = function(msg, trace) {
        var msgStack = ['ERROR: ' + msg];
        if (trace) {
            msgStack.push('TRACE:');
            trace.forEach(function(t) {
                msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
            });
        }
        console.error(msgStack.join('\n'));
    };

    page.open(url, function (status) {
        page.includeJs('../files/js/qunit.js', function () {
            page.evaluate(function (testFileName) {
                require(['../files/js/tests/' + testFileName, 'domReady!'], function (test, dr) {
                    test.run(window.callPhantom);
                });
            }, fileName);
        });
    });
};

var system = require('system');
runTest(system.args[1], system.args[2]);








