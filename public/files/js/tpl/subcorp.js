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
 * This module contains functionality related directly to the subcorp_form.tmpl template
 */
define(['jquery', 'tpl/document'], function ($, documentModule) {
    'use strict';

    var lib = {};

    lib.layoutModel = null;


    /**
     * 
     */
    lib.showSubcorpInfo = function () {
        $.ajax({
            url: 'ajax_subcorp_info',
            data: $('#subcorpform').serialize(),
            type: 'GET',
            dataType : 'json',
            success: function (data) {
                $('#subcorpinfo .subc-name').text(data.subCorpusName);
                $('#subcorpinfo .subc-size').text(data.subCorpusSize);
                $('#subcorpinfo .corp-size').text(data.corpusSize);
            }
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        $('#subcname').focus();
        $('#subcname').on('change', lib.showSubcorpInfo);
    };

    return lib;
});