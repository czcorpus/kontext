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
define(['jquery', 'tpl/document', 'corplist', 'popupbox'], function ($, layoutModel, corplist, popupBox) {
    'use strict';

    var lib = {};

    /**
     *
     * @param corpusId a corpus the subcorpus will be created from
     * @param subcName a name of the new subcorpus
     * @param structName a structural name to be used to define a subcorpus (e.g. 'div', 'p', 'opus',...)
     * @param condition required values of respective structural attributes (e.g. 'name="foo" & year="1990"')
     * @return a promise
     */
    function createSubcorpus(corpusId, subcName, structName, condition) {
        var params = {
            corpname: corpusId,
            subcname: subcName,
            within_struct: structName,
            within_condition: condition
        };

        return $.ajax(layoutModel.conf['rootURL'] + 'ajax_create_subcorpus', {
            method: 'POST',
            data: params
        });
    }

    function hasDefinedSubcorpus(elm) {
        return $(elm).attr('data-condition') && $(elm).attr('data-struct_name');
    }

    function hasDeletedFlag(elm) {
        return $(elm).attr('data-deleted') === '1';
    }

    /**
     *
     * @param wrappingElm
     * @param triggerElm
     * @param tooltipBox
     */
    function createUndeleteForm(wrappingElm, triggerElm, tooltipBox) {
        var fieldset1,
            fieldset1Submit;

        fieldset1 = $(window.document.createElement('fieldset'));
        fieldset1.addClass('subcorp-action-field');
        fieldset1.append('<legend>' + layoutModel.translate('undelete') + '</legend>');
        fieldset1.append('<p>' + layoutModel.translate('The subcorpus will be created again using the original query.') + '</p>');
        fieldset1Submit = $(window.document.createElement('button'));
        fieldset1Submit.text(layoutModel.translate('undelete'));
        fieldset1.append(fieldset1Submit);
        wrappingElm.append(fieldset1);

        fieldset1Submit.on('click', function () {
            var prom = createSubcorpus($(triggerElm).data('corpname'),
                $(triggerElm).data('subcname'),
                $(triggerElm).data('struct_name'),
                $(triggerElm).data('condition'));

            prom.then(
                function () {
                    window.location = layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list'
                },
                function (jqXHR, textStatus, errorThrown) {
                    layoutModel.message('error', errorThrown);
                }
            );
        });
    }

    /**
     *
     * @param wrappingElm
     */
    function createWipeForm(wrappingElm) {
        var jqFieldset = $(window.document.createElement('fieldset')),
            actionButton = $(window.document.createElement('button'));

        $(actionButton).text(layoutModel.translate('delete forever'));

        jqFieldset.addClass('subcorp-action-field');
        jqFieldset.append('<legend>' + layoutModel.translate('wipe') + '</legend>');
        jqFieldset.append('<p>' + layoutModel.translate('All the remaining information regarding this subcorpus will be deleted. It will be impossible to restore the subcorpus.') + '</p>');
        jqFieldset.append(actionButton);
        wrappingElm.append(jqFieldset);
    }

    /**
     *
     * @param wrappingElm
     * @param triggerElm
     * @param tooltipBox
     */
    function createReuseForm(wrappingElm, triggerElm, tooltipBox) {
        var jqFieldset,
            corpusSelector,
            subcnameInput = window.document.createElement('input'),
            structInput = window.document.createElement('input'),
            conditionInput = window.document.createElement('input'),
            submitArea = window.document.createElement('div'),
            submitButton = window.document.createElement('button'),
            withinBox = window.document.createElement('div');

        jqFieldset = $(window.document.createElement('fieldset'));
        jqFieldset.addClass('subcorp-action-field');
        jqFieldset.append('<legend>' + layoutModel.translate('re-use query') + '</legend>');

        jqFieldset.append('<span class="subcname-label">' + layoutModel.translate('New subcorpus name') + ':</span>');

        $(subcnameInput).addClass('subcname');
        jqFieldset.append(subcnameInput);
        jqFieldset.append('<br />');

        $(structInput)
            .addClass('struct')
            .val($(triggerElm).data('struct_name'));

        $(conditionInput)
            .addClass('condition')
            .val(decodeURIComponent($(triggerElm).data('condition')));

        $(withinBox)
            .addClass('within-box')
            .append('within <span class="big">&lt;</span>&nbsp;')
            .append(structInput)
            .append(conditionInput)
            .append('<span class="big">/&gt;</span>');

        jqFieldset.append(withinBox);

        $(submitButton).text(layoutModel.translate('create'))
            .on('click', function () {
                var triggerElm = tooltipBox.getTriggerElm(),
                    prom;

                prom = createSubcorpus(corpusSelector.val(), $(subcnameInput).val(),
                    $(triggerElm).data('struct_name'), $(triggerElm).data('condition'));
                prom.then(
                    function (data) {
                        if (data.contains_errors) {
                            layoutModel.showMessage('error', data.error);

                        } else {
                            window.location = layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list'
                        }
                    },
                    function (jqXHR, textStatus, errorThrown) {
                        layoutModel.showMessage('error', errorThrown);
                    }
                );
            });

        $(submitArea)
            .addClass('submit-area')
            .append(submitButton);


        corpusSelector = $(window.document.createElement('select'));
        $.ajax(layoutModel.conf['rootURL'] + 'ajax_get_favorite_corpora')
            .then(function (data) {
                    $.each(data, function (i, item) {
                        corpusSelector.append('<option value="' + item.id + '">' + item.name + '</option>');
                    });
                    jqFieldset
                        .prepend('<br />')
                        .prepend(corpusSelector)
                        .prepend(layoutModel.translate('Corpus name') + ':&nbsp;')
                        .prepend('<p>' + layoutModel.translate(
                            'The original query will be applied on a selected corpus. ' + 'Please note that the corpus must contain all the structures and attributes from the query.') + '</p>');

                    corplist.create(
                        corpusSelector,
                        layoutModel.pluginApi(), {
                            itemClickAction: function (id) {
                                this.hide(); // this == Search widget
                            },
                            onHide: function (widget) {
                                tooltipBox.suppressKeys(false);
                            },
                            onShow: function (widget) {
                                tooltipBox.suppressKeys(true);
                                var escKeyHandler = function (event) {
                                    if (event.keyCode === 27) {
                                        widget.hide();
                                        $(window.document).off('keyup', escKeyHandler);
                                        event.stopPropagation();
                                        event.preventDefault();
                                    }
                                };
                                $(window.document).on('keyup', escKeyHandler);
                            }
                        }
                    );
                    jqFieldset.append(submitArea);

                },
                function () {
                    layoutModel.showMessage('error', layoutModel.translate('Failed to load corpora'));
                });

        wrappingElm.append(jqFieldset);
    }

    /**
     * Creates a pop-up box containing miscellaneous functions related to a general subcorpus record
     * (undelete, wipe, re-use query).
     */
    function subcInfo() {
        $('table.data td .subc-actions').each(function () {
            var self = this;

            if (hasDeletedFlag(self) || hasDefinedSubcorpus(self)) {

                popupBox.bind(
                    $(self),
                    function (tooltipBox, finalize) {
                        var divElm = $(window.document.createElement('div')),
                            triggerElm = tooltipBox.getTriggerElm();

                        if (hasDeletedFlag(self)) {
                            createUndeleteForm(divElm, triggerElm, tooltipBox);
                            createWipeForm(divElm);
                        }
                        if (hasDefinedSubcorpus(self)) {
                            createReuseForm(divElm, triggerElm, tooltipBox);
                        }

                        tooltipBox.importElement(divElm);

                        // close all the other action boxes
                        $('.subc-actions').each(function () {
                            if (!$(this).is($(self))) {
                                popupBox.close(this);
                            }
                        });

                        finalize();
                    }, {
                        type: 'plain',
                        width: 'nice',
                        timeout: null,
                        closeIcon: true,
                        expandLeft: true
                    }
                );

            } else {
                popupBox.bind($(self), layoutModel.translate('No backup data available.'), {
                    expandLeft: true
                });
            }
        });
    }

    /**
     * Functions related to the subcorpus list
     */
    function initList() {
        $('section input.show-deleted').on('change', function (e) {
            if ($(e.currentTarget).is(':checked')) {
                window.location = layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list?show_deleted=1';

            } else {
                window.location = layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list?show_deleted=0';
            }
        });
    }

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        subcInfo();
        initList();
    };


    return lib;
});