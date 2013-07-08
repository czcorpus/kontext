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


define(['tpl/document', 'popupbox', 'jquery', 'bonito'], function (mainPage, popupbox, $, bonito) {

    'use strict';

    var lib = {};

    lib.messages = {};

    lib.recalcLevelParams = function () {
        $('#multilevel-freq-params tr.level-line').each(function (i, elm) {
            var currLevel = i + 1;

            if (currLevel === 1) {
                return;
            }
            $(this).find('td:first').text(currLevel + '.');
            $(this).find('td:nth-child(2) select').attr('name', 'ml' + currLevel + 'attr');
            $(this).find('td:nth-child(3) input').attr('name', 'ml' + currLevel + 'icase');
            $(this).find('td:nth-child(4) select').attr('name', 'ml' + currLevel + 'ctx');
            $(this).find('td:nth-child(5) select').attr('id', 'kwic-alignment-' + currLevel);
            $(this).find('td input[name="freqlevel"]').val(currLevel);
        });
    };

    lib.addLevel = function () {
        var numLevels = $('#multilevel-freq-params tr.level-line').length,
            newLine = $('#multilevel-freq-first-level').clone(),
            newLevelNum = numLevels + 1;

        $('#multilevel-freq-params tr.last-line').before(newLine);
        newLine.attr('id', null);
        newLine.find('td:first').text(newLevelNum + '.');
        newLine.find('td:nth-child(2) select').attr('name', 'ml' + newLevelNum + 'attr');
        newLine.find('td:nth-child(3) input').attr('name', 'ml' + newLevelNum + 'icase');
        newLine.find('td:nth-child(4) select').attr('name', 'ml' + newLevelNum + 'ctx');
        newLine.find('td:nth-child(5) select').attr('id', 'kwic-alignment-' + newLevelNum);
        newLine.find('td input[name="freqlevel"]').val(newLevelNum);
        newLine.find('td:last').empty().append('<a class="remove-level" title="' + lib.messages.remove_item + '">' +
            '<img src="../files/img/close-icon.png" alt="' + lib.messages.remove_item + '" /></a>');
        newLine.find('td:last a.remove-level').on('click', function (event) {
            lib.removeLevel($(event.target).closest('tr'));
        });
    };

    lib.removeLevel = function (lineElm) {
        lineElm.remove();
        lib.recalcLevelParams();
    };

    lib.init = function (conf) {
        mainPage.init(conf);
        lib.messages = conf.messages;
        bonito.multiLevelKwicFormUtil.init();
        $('a.kwic-alignment-help').each(function () {
            $(this).bind('click', function (event) {
                popupbox.createPopupBox(event, 'kwic-alignment-help-box', $('#toolbar-info'), conf.messages.msg, {
                    'top' : 'attached-bottom',
                    'width' : 'auto',
                    'height' : 'auto'
                });
                event.stopPropagation();
            });
        });
        lib.bindEvents();
    };

    lib.bindEvents = function () {
        $('#add-freq-level-button').on('click', function () {
            lib.addLevel();
        });
    };

    return lib;
});