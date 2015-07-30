/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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
 * This module contains functionality related directly to the viewopts template
 */
define(['win', 'jquery', 'tpl/document'], function (win, $, documentModule) {
    'use strict';

    var lib = {};
    lib.layoutModel = null;
    lib.changed = false;

    function blockUnsaved() {
        $('#mainform input[type!="hidden"][type!="submit"]').on('change', function () {
            lib.changed = true;
        });

        $(win).on('beforeunload', function (event) {
            if (lib.changed) {
                event.returnValue = lib.layoutModel.translate('global__there_are_unsaved_changes');
                return event.returnValue;
            }
            return undefined;
        });

        $('#mainform input[type="submit"]').on('click', function () {
            lib.changed = false;
        });
    }

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        blockUnsaved();
    };


    return lib;
});