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

    lib.init = function (conf) {
        mainPage.init(conf);
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
    };

    return lib;
});