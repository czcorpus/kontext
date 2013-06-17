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
define(['jquery', 'tpl/document', 'treecomponent'], function ($, mainPage, treeComponent) {
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
     * @param conf
     */
    lib.createFuncSwitchToInputMethod = function (conf) {
        return function (value) {
            if (value === 'raw') {
                $('#subc-spec-section').css({ display : '' });
                $('table.text-type-params').each(function (i, item) {
                    $(item).css({ display : null});
                });
                lib.createFuncShowWithinHint(conf)({ element : function () { return $('within-struct-selector'); } });

            } else if (value === 'gui') {
                $('#subc-spec-section').css({ display : 'none' });
                $('table.text-type-params').each(function (i, item) {
                    $(item).css({ display : null});
                });
                if ($('within-select-hint-row')) {
                    $('within-select-hint-row').remove();
                }
            }
        };
    };

    /**
     *
     * @param conf
     * @returns {Function}
     */
    lib.createFuncShowWithinHint = function (conf) {
        return function (event) {
            var findValueOption = function (value) {
                var i, options;

                options = event.element().select('option[value="' + value + '"]');
                for (i = 0; i < options.length; i += 1) {
                    if (options[i].readAttribute('value') === value) {
                        return options[i].readAttribute('title');
                    }
                }
                return '';
            };
            if ($('within-select-hint-row')) {
                $('within-select-hint-row').remove();
            }
            $('subc-spec-row').append('<tr id="within-select-hint-row" style="font-size: 90%; color: #444"><td></td><td>'
                + '<div style="width: 70%">' + conf.messages.available_attributes
                + ': <strong>' + findValueOption($(event.element()).val()) + '</strong></div></td>');
        };
    };

    /**
     *
     * @param conf
     */
    lib.misc = function (conf) {
        treeComponent.createTreeComponent($('form[action="subcorp"] select[name="corpname"]'), null, mainPage.updForm);

        $('subc-spec-row').css({ display : 'none' });

        $('input.method-select').each(function (i, item) {
            $(item).bind('click', function (event) {
                lib.createFuncSwitchToInputMethod(conf)($(event.target).val());
            });
        });

        $('#within-struct-selector').bind('change', lib.createFuncShowWithinHint(conf));
        lib.createFuncSwitchToInputMethod(conf)($('input[name="method"]:checked').val());
    };

    /**
     *
     */
    lib.bindClicks = function (conf) {
        // existing within conditions with the 'close link'
        $('#subc-spec-section .within-selection a.close-link').on('click', function (event) {
            $(event.target).closest('tr.within-selection').remove();
        });

        // functionality to add new within conditions
        $('#another-subc-condition-button').on('click', function () {
            var jqNewConditionItem = $('#subc-spec-section .within-selection:first').clone(); // always clone fixed item

            jqNewConditionItem.find('.struct-selector').prepend('<span>' + conf.messages.and + '</span>');
            jqNewConditionItem.find('td:last').append('<a class="close-link">'
                + '<img src="../files/img/close-icon.png" alt="' + conf.messages.close
                + '" title="' + conf.messages.close + '" /></a>');
            jqNewConditionItem.find('a.close-link').on('click', function (event) {
                $(event.target).closest('tr.within-selection').remove();
            });
            jqNewConditionItem.find('input[name="within_condition"]').val('');
            $('#subc-spec-section .within-selection:last').after(jqNewConditionItem);
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        mainPage.init(conf);
        lib.misc(conf);
        lib.bindClicks(conf);
    };


    return lib;
});