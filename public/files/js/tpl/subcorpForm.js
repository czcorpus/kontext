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
define(['jquery', 'tpl/document', 'treecomponent', 'popupbox'], function ($, layoutModel, treeComponent, popupBox) {
    'use strict';

    var lib = {};

    /**
     *
     * @param item
     */
    lib.updForm = function (item) {
        var formAncestor,
            i,
            srch,
            ancestors = $(item.currentTarget).parents();

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
    lib.subcCreateVariantSwitch = function (value) {
        if (value === 'raw') {
            $('#subc-within-row').css({ display: 'table-row' });
            $('.text-type-params').find('input[type="checkbox"]').attr('disabled', '');
            $('.text-type-params').css('display', 'none');

        } else if (value === 'gui') {
            $('#subc-within-row').css({ display: 'none' });
            $('.text-type-params')
                .css('display', 'inherit')
                .find('input[type="checkbox"]').attr('disabled', null);
        }
    };

    /**
     *
     */
    lib.misc = function () {
        var updateForm = function () {
            // in case user only changes current corpus, the form is submitted using GET method
            // which causes server not to create any subcorpus yet
            $('form[action="subcorp"]').attr('method', 'GET').submit();
        };
        treeComponent.createTreeComponent($('form[action="subcorp"] select[name="corpname"]'),
            layoutModel.conf.messages, {clickableText: true}, updateForm);

        $('subc-within-row').css({ display : 'none' });

        $('input.method-select').each(function (i, item) {
            $(item).bind('click', function (event) {
                lib.subcCreateVariantSwitch($(event.target).val());
            });
        });

        // attributes hint
        popupBox.bind($('#struct-hint'), function (tooltipBox, finalize) {
            var v;

            v = $('#within-struct-selector').find('option[value="' + $('#within-struct-selector').val() + '"]').attr('title');
            $(tooltipBox.getRootElement()).append('<strong>' + layoutModel.conf.messages.available_attributes + '</strong>: ');
            $(tooltipBox.getRootElement()).append(v);
            finalize();
        }, {width : 'nice'});

        lib.subcCreateVariantSwitch($('input[name="method"]:checked').val());
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        lib.misc();
    };


    return lib;
});