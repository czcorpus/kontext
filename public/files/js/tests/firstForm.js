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
 * Functional tests for the 'firstForm' page
 */
define(['../tpl/firstForm', 'testBootstrap', 'jquery'], function (page, QUnit, $) {
    'use strict';

    var lib = {};

    lib.init = function (conf) {
        lib.conf = conf;
        QUnit.start();
    };

    QUnit.testStart(function () {
        lib.pagePromises = page.init(lib.conf);
    });

    // TODO - this is installation dependent
    QUnit.test('A proper corpus is selected', function () {
        QUnit.equal(lib.conf.corpname, 'omezeni/syn2010'); // !!!
    });

    QUnit.test('There is a #mainform present', function () {
        var jqMainForm = $('#content section form#mainform');

        QUnit.equal(jqMainForm.length, 1);
    });

    QUnit.test('There is a corpus tree widget present but not visible', function () {
        var jqWidget = $('#mainform .tree-component');

        QUnit.equal(jqWidget.length, 1);
        QUnit.equal(jqWidget.is(':visible'), false);
    });

    QUnit.asyncTest('Corpus tree widget pops-up on a respective button click', function () {
        QUnit.expect(1);
        page.corplistComponent.options.onSwitchVisibility = function (status) {
            QUnit.equal(status, "show");
            QUnit.start();
        };
        $(page.corplistComponent.button).trigger('click');
    });

    QUnit.asyncTest('Corpus info box pops-up', function () {
        QUnit.expect(1);

        lib.pagePromises.doAfter('bindCorpusDescAction', function () {
            QUnit.equal($('.tooltip-box .corpus-name').length, 1);
            QUnit.start();

        }, function () {
            QUnit.ok(false);
            QUnit.start();
        });
        $('#corpus-desc-link').trigger('click');
    });

    QUnit.asyncTest('Main input form extension switches work', function () {
        var switches = $('.form-extension-switch');

        QUnit.expect(5);

        QUnit.equal(switches.length, 2);

        lib.pagePromises.doAfter('updateToggleableFieldsets', function () {
            switches.each(function () {
                var parentFieldset = $(this).closest('fieldset');

                QUnit.ok(parentFieldset.hasClass('inactive'));
                $(this).trigger('click');
                QUnit.ok(!parentFieldset.hasClass('inactive'));
            });
        });
        QUnit.start();

    });

    return lib;
});