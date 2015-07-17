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
define(['jquery', 'tpl/document', 'plugins/corplist/init', 'popupbox'], function ($, documentModule, corplist, popupBox) {
    'use strict';

    var lib = {};

    lib.layoutModel = null;

    lib.registerOnSubcorpChangeAction = function () {};
    lib.registerOnAddParallelCorpAction = function () {};
    lib.registerOnBeforeRemoveParallelCorpAction = function () {};
    lib.getConf = function (name) {
        return lib.layoutModel.getConf(name);
    };

    lib.translate = function (msg) {
        return lib.layoutModel.translate(msg);
    };

    lib.createActionUrl = function (path) {
        return lib.layoutModel.createActionUrl(path);
    };

    lib.createStaticUrl = function (path) {
        return lib.layoutModel.createStaticUrl(path);
    };

    lib.showMessage = function (type, message, callback) {
        return lib.layoutModel.showMessage(type, message, callback);
    };

    function hasDefinedSubcorpus(elm) {
        return $(elm).attr('data-condition') && $(elm).attr('data-struct_name');
    }

    function hasDeletedFlag(elm) {
        return $(elm).attr('data-deleted') === '1';
    }

    /**
     *
     * @param layoutModel
     * @param tooltipBox
     * @param dataRow
     * @param corpusId
     * @param subcorpusName
     * @param corpusSelector
     * @constructor
     */
    function SubcorpActions(layoutModel, tooltipBox, dataRow, corpusId, subcorpusName,
                            corpusSelectorWrapper) {
        this.layoutModel = layoutModel;
        this.tooltipBox = tooltipBox;
        this.dataRow = dataRow;
        this.corpusId = corpusId;
        this.subcorpusName = subcorpusName;
        this.corpusSelectorWrapper = corpusSelectorWrapper;
        this.corpusSelector = $(corpusSelectorWrapper).find('select').get(0);
    }

    /**
     * @param subcname
     * @param structName a structural name to be used to define a subcorpus (e.g. 'div', 'p', 'opus',...)
     * @param condition required values of respective structural attributes (e.g. 'name="foo" & year="1990"')
     * @return a promise
     */
    SubcorpActions.prototype.createSubcorpus = function (subcname, structName, condition) {
        var self = this,
            params = {
                corpname: this.corpusId,
                subcname: subcname,
                within_struct: structName,
                within_condition: decodeURIComponent(condition)
            };
        return $.ajax(self.layoutModel.conf['rootURL'] + 'subcorpus/ajax_create_subcorpus', {
            method: 'POST',
            data: params
        });
    };

    SubcorpActions.prototype.wipeSubcorpus = function () {
        var self = this,
            params = {
                corpname : self.corpusId,
                subcname : self.subcorpusName
            };

        return $.ajax(self.layoutModel.conf['rootURL'] + 'subcorpus/ajax_wipe_subcorpus', {
            method: 'POST',
            data: params
        });
    };

    /**
     *
     * @param wrappingElm
     * @param triggerElm
     * @param tooltipBox
     */
    SubcorpActions.prototype.createUndeleteForm = function (wrappingElm, triggerElm) {
        var fieldset1,
            fieldset1Submit,
            self = this;

        fieldset1 = $(window.document.createElement('fieldset'));
        fieldset1.addClass('subcorp-action-field');
        fieldset1.append('<legend>' + lib.layoutModel.translate('undelete') + '</legend>');
        fieldset1.append('<p>' + lib.layoutModel.translate('The subcorpus will be created again using the original query.') + '</p>');
        fieldset1Submit = $(window.document.createElement('button'));
        fieldset1Submit.text(lib.layoutModel.translate('undelete'));
        fieldset1.append(fieldset1Submit);
        wrappingElm.append(fieldset1);

        fieldset1Submit.on('click', function () {
            var prom = self.createSubcorpus($(triggerElm).data('subcname'),
                    $(triggerElm).data('struct_name'), $(triggerElm).data('condition'));

            prom.then(
                function (ans) {
                    if (!ans.error) {
                        window.location = self.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list'

                    } else {
                        self.layoutModel.showMessage('error', ans.error);
                    }
                },
                function (jqXHR, textStatus, errorThrown) {
                    self.layoutModel.showMessage('error', errorThrown);
                }
            );
        });
    };

    /**
     *
     * @param wrappingElm
     */
    SubcorpActions.prototype.createWipeForm = function (wrappingElm) {
        var jqFieldset = $(window.document.createElement('fieldset')),
            actionButton = $(window.document.createElement('button')),
            self = this;

        $(actionButton)
            .text(lib.layoutModel.translate('delete forever'))
            .on('click', function () {
                var prom;

                prom = self.wipeSubcorpus();
                prom.then(
                    function (data) {
                        if (data.messages) {
                            $.each(data.messages, function (i, item) {
                                self.layoutModel.showMessage(item[0], item[1]);
                            });
                        }
                        self.tooltipBox.close();
                        $(self.dataRow).remove();
                    },
                    function (err) {
                        console.err('err', err); // TODO
                    }
                );
            });


        jqFieldset.addClass('subcorp-action-field');
        jqFieldset.append('<legend>' + lib.layoutModel.translate('wipe') + '</legend>');
        jqFieldset.append('<p>' + lib.layoutModel.translate('All the remaining information regarding this subcorpus will be deleted. It will be impossible to restore the subcorpus.') + '</p>');
        jqFieldset.append(actionButton);
        wrappingElm.append(jqFieldset);
    };

    /**
     *
     * @param wrappingElm
     * @param triggerElm
     * @param tooltipBox
     */
    SubcorpActions.prototype.createReuseForm = function (wrappingElm, triggerElm) {
        var self = this,
            jqFieldset,
            subcnameInput = window.document.createElement('input'),
            structInput = window.document.createElement('input'),
            conditionInput = window.document.createElement('input'),
            submitArea = window.document.createElement('div'),
            submitButton = window.document.createElement('button'),
            withinBox = window.document.createElement('div');

        jqFieldset = $(window.document.createElement('fieldset'));
        jqFieldset.addClass('subcorp-action-field');
        jqFieldset.append('<legend>' + self.layoutModel.translate('re-use query') + '</legend>');

        jqFieldset.append('<span class="subcname-label">'
                + self.layoutModel.translate('New subcorpus name') + ':</span>');

        $(subcnameInput).addClass('subcname')
                .val(this.subcorpusName);
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

        $(submitButton).text(self.layoutModel.translate('create'))
            .on('click', function () {
                var prom = self.createSubcorpus($(subcnameInput).val(), $(structInput).val(),
                                                $(conditionInput).val());
                prom.then(
                    function (data) {
                        if (data.contains_errors) {
                            self.layoutModel.showMessage('error', data.error);

                        } else {
                            window.location = self.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list'
                        }
                    },
                    function (jqXHR, textStatus, errorThrown) {
                        self.layoutModel.showMessage('error', errorThrown);
                    }
                );
            });

        $(submitArea)
            .addClass('submit-area')
            .append(submitButton);
        jqFieldset.append(submitArea);


        $(this.corpusSelectorWrapper).show();
        jqFieldset.prepend(this.corpusSelectorWrapper);
        corplist.create(this.corpusSelector, lib, {
            editable: false,
            itemClickAction: function (corpusId) {
                self.corpusId = corpusId;
            }
        });
        wrappingElm.append(jqFieldset);
    };

    /**
     * Creates a pop-up box containing miscellaneous functions related to a general subcorpus record
     * (undelete, wipe, re-use query).
     */
    function subcInfo() {
        var corpusSelectorWrapper = $('#corpus-selection');

        $('table.data td .subc-actions').each(function () {
            var self = this;

            if (hasDeletedFlag(self) || hasDefinedSubcorpus(self)) {
                popupBox.bind(
                    $(self),
                    function (tooltipBox, finalize) {
                        var divElm = $(window.document.createElement('div')),
                            triggerElm = tooltipBox.getTriggerElm(),
                            component = new SubcorpActions(
                                lib.layoutModel,
                                tooltipBox,
                                $(triggerElm).closest('tr').get(0),
                                $(triggerElm).data('corpname'),
                                $(triggerElm).data('subcname'),
                                corpusSelectorWrapper
                            );

                        if (hasDeletedFlag(self)) {
                            component.createUndeleteForm(divElm, triggerElm);
                            component.createWipeForm(divElm);
                        }
                        if (hasDefinedSubcorpus(self)) {
                            component.createReuseForm(divElm, triggerElm);
                        }

                        tooltipBox.importElement(divElm);

                        // close all the other action boxes
                        $('.subc-actions').each(function () {
                            if (!$(this).is($(self))) {
                                popupBox.close(this);
                            }
                        });

                        finalize();
                    },
                    {
                        type: 'plain',
                        width: 'nice',
                        timeout: null,
                        closeIcon: true,
                        expandLeft: true,
                        onClose: function () {
                            $('#mainform').append(corpusSelectorWrapper);
                            corpusSelectorWrapper.hide();
                        }
                    }
                );

            } else {
                popupBox.bind($(self), lib.layoutModel.translate('No backup data available.'), {
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
                window.location = lib.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list?show_deleted=1';

            } else {
                window.location = lib.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list?show_deleted=0';
            }
        });
    }

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        subcInfo();
        initList();
    };


    return lib;
});