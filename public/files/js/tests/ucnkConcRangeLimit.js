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
 * Please note that this is a functional test which requires an appropriate corpus installed
 * and a compatible page opened.
 *
 */
define(['../tpl/view', 'testBootstrap', 'jquery'], function (page, QUnit, $) {
    'use strict';

    var lib = {};

    lib.init = function (conf) {
        page.init(conf);
        QUnit.start();
    };

    /*
     * This test requires some manipulation of page.viewDetailDoneCallback which sets
     * itself as a callback in its code when binding several 'click' events. In addition, to be able
     * to check tested component state, we have to wrap the original callback into a assertion code.
     * It means that without additional hacking the assertion code would potentially call itself, which is bad.
     * To avoid this, once we test an assertion, the page.viewDetailDoneCallback must be either
     * returned to its original state or wrapped into another assertion.
     */
    QUnit.asyncTest('A concordance detail shows up and can be expanded only once on each side', function () {
        var kwic = $('#conclines tr td.kw b').first(),
            origDetailDoneCallback = page.viewDetailDoneCallback,
            detailExpandTestCallback1,
            detailExpandTextCallback2;

        QUnit.expect(3);

        detailExpandTextCallback2 = function (boxInst) {
            origDetailDoneCallback(boxInst);

            QUnit.equal($('div#detail-frame a.expand-link').length, 0);
            page.viewDetailDoneCallback = origDetailDoneCallback; // return the callback to its original state
            QUnit.start();
            $('div#detail-frame a.close-link').click();
        };

        detailExpandTestCallback1 = function (boxInst) {
            origDetailDoneCallback(boxInst);
            QUnit.equal($('div#detail-frame a.expand-link').length, 1);
            page.viewDetailDoneCallback = detailExpandTextCallback2;  // update the callback to process another test
            $('div#detail-frame a.expand-link').first().click(); // first() <= there is only one expand link avaliable
        };

        page.viewDetailDoneCallback = function (boxInst) {
            origDetailDoneCallback(boxInst);
            QUnit.equal($('div#detail-frame').css('display'), 'block');
            page.viewDetailDoneCallback = detailExpandTestCallback1; // update the callback to process another test
            $('div#detail-frame a.expand-link').first().click();
        };

        kwic.click();
    });

    return lib;
});