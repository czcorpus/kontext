/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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
 * This module performs an initialization of QUnit and sets the global
 * variable 'testFinished' to allow headless testing environments (PhantomJS)
 * checking the test suite's status.
 *
 * @returns QUnit
 */
define(['QUnit', 'win'], function (QUnit, win) {
    'use strict';

    var textSeparator = '\n----------------------------------------';

    win.testFinished = false; // set global flag (this is watched by PhantomJS)

    QUnit.testDone(function(details) {
        var msg = textSeparator + '\nTEST: ';

        if (details.module) {
            msg += '[' + details.module + '] ';
        }
        if (details.name) {
            msg += details.name;
        }
        msg += '\nResult: ' + (details.total - details.failed) + '/' + details.total + '\nDuration: ' + details.duration + 'ms';
        console.log(msg);
    });

    QUnit.done(function(info) {
        var msg = textSeparator;

        msg +=  '\nTotal: ' + info.total + ' Failed: ' + info.failed + ' Passed: ' + info.passed
            + '\nDuration: ' + info.runtime + 'ms\n';
        console.log(msg);
        win.testFinished = true;  // set the global flag to 'finished'
    });

    return QUnit;
});