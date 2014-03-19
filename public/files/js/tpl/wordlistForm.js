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
 * This module contains functionality related directly to the filter_form.tmpl template
 *
 */
define(['win', 'jquery', 'tpl/document', 'treecomponent', 'popupbox'], function (win, $, layoutModel, treeComponent,
    popupbox) {
    'use strict';

    var lib = {},
        selectOutputType,
        updForm;


    /**
     *
     * @param item
     */
    updForm = function (item) {
        var formAncestor,
            i,
            srch,
            ancestors = $(item.target).parents();

        for (i = 0; i < ancestors.length; i += 1) {
            if (ancestors[i].nodeName === 'FORM') {
                formAncestor = ancestors[i];
                break;
            }
        }
        if (formAncestor !== undefined) {
            srch = $(formAncestor).find('*[name="reload"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '1');
            }
            srch = $(formAncestor).find('*[name="usesubcorp"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '');
            }
            formAncestor.submit();
        }
    };

    /**
     *
     */
    selectOutputType = function () {
        var wltypes = ['wltype_simple', 'wltype_keywords', 'wltype_multilevel'],
            kwinputs = ['ref_corpname', 'ref_usesubcorp', 'simple_n'],
            mlinputs = ['wlstruct_attr1', 'wlstruct_attr2', 'wlstruct_attr3'],
            i,
            type;

        for (i = 0; i < wltypes.length; i += 1) {
            if (win.document.getElementById(wltypes[i]).checked === true) {
                type = wltypes[i].split('_')[1];
            }
        }
        if (type === 'simple') {
            win.document.getElementById("wordlist_form").action = "wordlist";
            for (i = 0; i < kwinputs.length; i += 1) {
                win.document.getElementById(kwinputs[i]).disabled = true;
            }
            for (i = 0; i < mlinputs.length; i += 1) {
                win.document.getElementById(mlinputs[i]).disabled = true;
            }

        } else if (type === 'keywords') {
            win.document.getElementById("wordlist_form").action = "wordlist";
            for (i = 0; i < kwinputs.length; i += 1) {
                win.document.getElementById(kwinputs[i]).disabled = false;
            }
            for (i = 0; i < mlinputs.length; i += 1) {
                win.document.getElementById(mlinputs[i]).disabled = true;
            }

        } else if (type === 'multilevel') {
            win.document.getElementById("wordlist_form").action = "struct_wordlist";
            for (i = 0; i < kwinputs.length; i += 1) {
                win.document.getElementById(kwinputs[i]).disabled = true;
            }
            for (i = 0; i < mlinputs.length; i += 1) {
                win.document.getElementById(mlinputs[i]).disabled = false;
            }
        }
    };

    /**
     *
     */
    lib.misc = function () {
        selectOutputType(layoutModel.conf.wltype);
    };

    /**
     *
     */
    lib.bindStaticElements = function () {
        popupbox.bind($('#show-help-format-link'), layoutModel.conf.messages.whiteLists, {
            width: '300px'
        });
        $('#select-output-type-simple').on('click', function () {
            selectOutputType('simple');
        });
        $('#select-output-type-keywords').on('click', function () {
            selectOutputType('keywords');
        });
        $('#select-output-type-multilevel').on('click', function () {
            selectOutputType('multilevel');
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        lib.bindStaticElements();
        treeComponent.createTreeComponent($('form[id="wordlist_form"] select[name="corpname"]'),
            layoutModel.conf.messages, {clickableText: true}, updForm);
    };

    return lib;
});