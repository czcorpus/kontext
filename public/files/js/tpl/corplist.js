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
 * This module contains functionality related directly to the first_form.tmpl template
 *
 */
define(['win', 'jquery', 'tpl/document', 'popupbox', 'plugins/corplist'], function (win, $, documentModule,
                                                                                    popupBox, corplist) {
    'use strict';

    var lib = {};

    lib.layoutModel = null;

    lib.init = function (conf, keywords, keywordLabels) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        $('table.corplist tr').each(function (i, row) {
            var trigger = $(row).find('a.detail');

            popupBox.bind(
                trigger,
                function (tooltipBox, finalize) {
                    tooltipBox.importElement($(trigger).siblings('.desc').get(0));
                    finalize();
                },
                {
                    type : 'plain'
                }
            );

            $(row).find('input.set-favorite').on('click', function (event) {
                var data = {},
                    jqClickedElm = $(event.currentTarget);

                data[jqClickedElm.attr('value')] = jqClickedElm.is(':checked');


                lib.layoutModel.ajax('set_favorite_corp',
                    {
                        method : 'POST',
                        data : {'data': JSON.stringify(data)},
                        success : function (data) {
                            console.log('data', data); // TODO

                        },
                        error : function () {
                            console.error(arguments); // TODO
                        }
                    }
                );

            });
        });


        corplist.createFilter(lib.layoutModel.pluginApi(), $('form.filter').get(0));
    };

    return lib;
});