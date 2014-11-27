/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
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
 * This module contains functionality related directly to the subcorp_list.tmpl template
 */
define(['jquery', 'tpl/document', 'treecomponent', 'popupbox'], function ($, layoutModel, treeComponent, popupBox) {
    'use strict';

    var lib = {};


    /**
     *
     */
    lib.misc = function () {
        var preSubmit = function (event) {
            $('#mainform').attr('method', 'GET');
            layoutModel.formChangeCorpus(event);
        };
        treeComponent.createTreeComponent($('form#mainform select[name="corpname"]'), layoutModel.conf.messages,
            {clickableText: true}, preSubmit);
    };

    /**
     *
     */
    lib.subcInfo = function () {
        $('table.data td .subc-query').each(function () {
            var self = this;

            popupBox.bind(
                $(self),
                function (tooltipBox, finalize) {
                    var elm = $(window.document.createElement('span'));
                    elm.text(decodeURIComponent($(self).closest('td').data('query')));
                    tooltipBox.importElement(elm);

                    // close all the other bib-info boxes
                    $('.subc-query').each(function () {
                        if (!$(this).is($(self))) {
                            popupBox.close(this);
                        }
                    });

                    finalize();
                },
                {
                    type : 'plain'
                }
            );
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        lib.misc();
        lib.subcInfo();
    };


    return lib;
});