/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 * Copyright (c) 2003-2009  Pavel Rychly
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
 * This module contains functionality related directly to the first_form.tmpl template
 *
 */
define(['jquery', 'treecomponent', 'bonito', 'tpl/document', 'hideelem'], function ($,
        treeComponent, bonito, mainPage, hideElem) {
    'use strict';

    var lib = {};

    /**
     * @param conf
     */
    lib.misc = function (conf) {

        // let's override the focus
        conf.focus = function () {
            var target = null;
            $('#mainform tr input[type="text"]').each(function () {
                if ($(this).css('display') !== 'none') {
                    target = $(this);
                    return false;
                }
            });
            return target;
        };

        treeComponent.createTreeComponent($('form[action="first"] select[name="corpname"]'), null, mainPage.updForm);

        // initial query selector setting (just like when user changes it manually)
        hideElem.cmdSwitchQuery($('#queryselector').get(0), conf.queryTypesHints, mainPage.userSettings);
    };

    /**
     * @param {object} conf
     */
    lib.bindClicks = function (conf) {
        $('ul.submenu a.toggle-submenu-item').each(function () {
            $(this).on('click', function () {
                bonito.toggleViewStore($(this).data('id-to-set'), null, mainPage.userSettings);
            });
        });

        $('#switch_err_stand').on('click', function () {
            if ($(this).text() === conf.labelStdQuery) {
                $('#qnode').show();
                $('#cup_err_menu').hide();
                $(this).text(conf.labelErrorQuery);
                mainPage.userSettings.set("errstdq", "std");

            } else {
                $('#qnode').hide();
                $('#cup_err_menu').show();
                $(this).text(conf.labelStdQuery);
                mainPage.userSettings.set("errstdq", "err");
            }
        });
    };

    /**
     *
     */
    lib.bindParallelCorporaCheckBoxes = function () {
        $('#add-searched-lang-widget button[type="button"]').on('click', function (event) {
            var v = $('#add-searched-lang-widget select').val(),
                jqHiddenStatus = $('#qnode_' + v + ' input[name="sel_aligned"]');
            $('#qnode_' + v).show();
            jqHiddenStatus.val(jqHiddenStatus.data('corpus'));
            $('#qnode_' + v + ' a.close-button').on('click', function () {
                $('#qnode_' + v).hide();
                jqHiddenStatus.val('');
            });
            if (mainPage.isInternetExplorerUpTo(8)) {
                // refresh content in IE < 9
                $('#content').css('overflow', 'visible').css('overflow', 'auto');
            }
        });
        $('input[name="sel_aligned"]').each(function() {
            if ($(this).val()) {
                $('select[name=pcq_pos_neg_' + $(this).data('corpus') + '],#qtable_' + $(this).data('corpus')).show();
            }
        });
    };

    /**
     *
     * @param {object} conf
     */
    lib.showCupMenu = function (conf) {
        if (mainPage.userSettings.get('errstdq') == 'std') {
            $('#cup_err_menu').hide();
            $('#switch_err_stand').text(conf.messages.labelErrorQuery);

        } else {
            $('#qnode').hide();
        }
    };

    /**
     *
     * @param {object} conf
     */
    lib.init = function (conf) {
        mainPage.init(conf);
        lib.misc(conf);
        lib.bindClicks(conf);
    };


    return lib;
});