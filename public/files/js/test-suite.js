/*
 * Copyright (c) 2012 Institute of the Czech National Corpus
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


/**
 * Simple test runner based on QUnit library (we currently assume that
 * QUnit is available globally and not as a require.js compatible module).
 */
define([], function () {

    var suite = {};

    suite.log = [];

    suite.totalErrors = 0;

    suite.tests = [];

    /**
     * Adds a function containing one or more tests
     * @param testFunc {function}
     */
    suite.add = function (testFunc) {
        suite.tests.push(testFunc);
    };

    /**
     * Initializes testing suite, binds QUnit's callbacks etc.
     * After all the tests are finished optional doneCallback is called
     * (this is used to notify PhantomJS).
     *
     * @param doneCallback
     */
    suite.init = function (doneCallback) {

        QUnit.log = function(details) {
            if (details.result === false) {
                suite.totalErrors += 1;
                suite.log.push('FAILED - expected [' + details.expected + '], found [' + details.actual + ']');
                if (details.message) {
                    suite.log.push('    ' + details.message);
                }
            }
        };

        QUnit.begin(function () {
            console.log('Starting tests');
        });

        QUnit.done(function (details) {
            console.log('\n------------------------------------------------------------------');
            console.log('Finished ' + details.total + ' tests in ' + details.runtime / 1000 + '  seconds.\nPassed: ' + details.passed + ', failed: ' + details.failed);
            console.log('------------------------------------------------------------------');
            if (typeof doneCallback === 'function') {
                doneCallback({ totalErrors : suite.totalErrors });
            }
        });

        QUnit.testDone(function (details) {
            console.log('\n>> ' + details.name + ': ' + details.passed + '/' + details.total + ' passed <<');
            if (suite.log.length > 0) {
                console.log(suite.log.join('\n'));
                suite.log = [];
            }
        });
    };

    /**
     * Runs added tests. When finished, optional
     * doneCallback is called (this is used to notify PhantomJS).
     *
     * @param doneCallback
     */
    suite.run = function (doneCallback) {
        suite.init(doneCallback);
        suite.tests.forEach(function (item) {
            item();
        });
    };

    /**
     * Util objects contains miscellaneous helper functions.
     *
     * @type {Object}
     */
    suite.util = {};

    /**
     * Strips whitespace characters from the beginning and end of a string.
     *
     * @param s {String}
     * @return {*}
     */
    suite.util.stripString = function (s) {
        return s.replace(/^\s*(.+?)\s*$/, '$1');
    };

    return suite;
});