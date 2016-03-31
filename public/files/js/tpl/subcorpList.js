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
define(['jquery', 'tpl/document', 'plugins/corparch/init', 'popupbox'], function ($, documentModule, corplist, popupBox) {
    'use strict';

    var lib = {};

    lib.layoutModel = null;

    lib.registerOnSubcorpChangeAction = function () {};
    lib.registerOnAddParallelCorpAction = function () {};
    lib.registerOnBeforeRemoveParallelCorpAction = function () {};
    lib.getConf = function (name) {
        return lib.layoutModel.getConf(name);
    };

    lib.translate = function (msg, values) {
        return lib.layoutModel.translate(msg, values);
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
        return $(elm).attr('data-cql');
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
    function SubcorpActions(layoutModel, widget, tooltipBox, dataRow, corpusId, subcorpusName,
                            corpusSelectorWrapper) {
        this.layoutModel = layoutModel;
        this.widget = widget;
        this.tooltipBox = tooltipBox;
        this.dataRow = dataRow;
        this.corpusId = corpusId;
        this.subcorpusName = subcorpusName;
        this.corpusSelectorWrapper = corpusSelectorWrapper;
    }

    /**
     * @param subcname
     * @param cql
     * @return a promise
     */
    SubcorpActions.prototype.createSubcorpus = function (subcname, cql) {
        var self = this,
            params = {
                corpname: this.corpusId,
                subcname: subcname,
                cql: decodeURIComponent(cql)
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
        fieldset1.append('<legend>' + lib.layoutModel.translate('global__undelete') + '</legend>');
        fieldset1.append('<p>' + lib.layoutModel.translate('global__subcorpus_will_be_restored_using_orig_query') + '</p>');
        fieldset1Submit = $(window.document.createElement('button'));
        fieldset1Submit
            .addClass('default-button')
            .text(lib.layoutModel.translate('global__undelete'));
        fieldset1.append(fieldset1Submit);
        wrappingElm.append(fieldset1);

        fieldset1Submit.on('click', function () {
            var prom = self.createSubcorpus(
                    decodeURIComponent($(triggerElm).data('subcname')),
                    $(triggerElm).data('cql'));

            prom.then(
                function (ans) {
                    if (!ans.error) {
                        window.location.href = self.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list'

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
            .addClass('default-button')
            .text(lib.layoutModel.translate('global__delete_forever_btn'))
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
        jqFieldset.append('<legend>' + lib.layoutModel.translate('global__wipe') + '</legend>');
        jqFieldset.append('<p>' + lib.layoutModel.translate('global__subcorpus_wipe_warning') + '</p>');
        jqFieldset.append(actionButton);
        wrappingElm.append(jqFieldset);
    };

    /**
     *
     * @param wrappingElm
     * @param triggerElm
     * @param tooltipBox
     */
    SubcorpActions.prototype.createReuseForm = function (wrappingElm, triggerElm, selection) {
        var self = this,
            jqFieldset,
            subcnameInput = $('#new-subcname').get(0),
            cqlInput = window.document.createElement('textarea'),
            submitArea = window.document.createElement('div'),
            submitButton = window.document.createElement('button'),
            withinBox = window.document.createElement('div');

        jqFieldset = $(window.document.createElement('fieldset'));
        jqFieldset.addClass('subcorp-action-field');
        jqFieldset.append('<legend>' + self.layoutModel.translate('global__reuse_query') + '</legend>');

        $(cqlInput)
            .addClass('cql')
            .val(decodeURIComponent($(triggerElm).data('cql')));

        $(withinBox)
            .addClass('within-box')
            .append(cqlInput);

        jqFieldset.append(withinBox);

        // we have to overwrite item selection callback of shared
        // corpus selection widget
        selection.callback = function (corpusId, corpusName) {
            self.corpusId = corpusId;
        };
        // and also set widget's initial value to the one matching
        // the data line which triggered this box
        this.widget.setCurrentValue($(triggerElm).data('corpname'),
                                    $(triggerElm).data('human_corpname'));
        this.corpusId = $(triggerElm).data('corpname');

        $(submitButton)
            .addClass('default-button')
            .attr('type', 'button')
            .text(self.layoutModel.translate('global__create'))
                .on('click', function (evt) {
                    var prom = self.createSubcorpus($(subcnameInput).val(), $(cqlInput).val());
                    prom.then(
                        function (data) {
                            if (data.contains_errors) {
                                self.layoutModel.showMessage('error', data.error);

                            } else {
                                window.location.href = self.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list'
                            }
                        },
                        function (jqXHR, textStatus, errorThrown) {
                            self.layoutModel.showMessage('error', errorThrown);
                        }
                    );
                    evt.preventDefault();
                });

        $(submitArea)
            .addClass('submit-area')
            .append(submitButton);
        jqFieldset.append(submitArea);


        $(this.corpusSelectorWrapper).show();
        jqFieldset.prepend(this.corpusSelectorWrapper);
        wrappingElm.append(jqFieldset);
    };

    function bindSubcorpusActions(elm, widget, corpusSelectorWrapper) {
        if (hasDeletedFlag(elm) || hasDefinedSubcorpus(elm)) {
            popupBox.bind(
                $(elm),
                function (tooltipBox, finalize) {
                    var divElm = $(window.document.createElement('div')),
                        triggerElm = tooltipBox.getTriggerElm(),
                        component = new SubcorpActions(
                            lib.layoutModel,
                            widget,
                            tooltipBox,
                            $(triggerElm).closest('tr').get(0),
                            $(triggerElm).data('corpname'),
                            decodeURIComponent($(triggerElm).data('subcname')),
                            corpusSelectorWrapper
                        );
                        $(component.corpusSelector).val($(triggerElm).data('corpname'));

                    if (hasDeletedFlag(elm)) {
                        component.createUndeleteForm(divElm, triggerElm);
                        component.createWipeForm(divElm);
                    }
                    if (hasDefinedSubcorpus(elm)) {
                        component.createReuseForm(divElm, triggerElm, selection);
                    }

                    tooltipBox.importElement(divElm);

                    // close all the other action boxes
                    $('.subc-actions').each(function () {
                        if (!$(this).is($(elm))) {
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
            popupBox.bind($(elm), lib.layoutModel.translate('global__no_backup_data'), {
                expandLeft: true
            });
        }
    }

    /**
     * Creates a pop-up box containing miscellaneous functions related to a general subcorpus record
     * (undelete, wipe, re-use query).
     */
    function subcInfo(widget, selection) {
        var corpusSelectorWrapper = $('#corpus-selection');
        var subcnameInput = window.document.createElement('input');
        $(subcnameInput).addClass('subcname')
                .attr('id', 'new-subcname')
                .attr('name', 'subcname');

        $('#subcorp-selector-wrapper').before(subcnameInput);
        $('#subcorp-selector-wrapper').remove();

        $('table.data td .subc-actions').each(function () {
            bindSubcorpusActions(this, widget, corpusSelectorWrapper);
        });
    }

    function updateSelectionButtons() {
        if ($('#mainform').find('input[name="selected_subc"]:checked').length > 0) {
            $('#mainform').find('button.delete-selected').show();

        } else {
            $('#mainform').find('button.delete-selected').hide();
        }
    }

    /**
     * Functions related to the subcorpus list
     */
    function initList() {
        $('section input.show-deleted').on('change', function (e) {
            if ($(e.currentTarget).is(':checked')) {
                window.location.href = lib.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list?show_deleted=1';

            } else {
                window.location.href = lib.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list?show_deleted=0';
            }
        });

        $('#mainform').find('input[name="selected_subc"]').on('change', function () {
            updateSelectionButtons();
        });
    }

    /*
     * Corpus selection widget is shared among all the subcorpus lines' action links.
     * It makes some related actions not very straightforward (like overwriting of
     * the item selection callback - see the 'selection' argument).
     */
    function createCorpusSelector(origSelectElm, selection) {
        return corplist.create(origSelectElm, lib, {
            editable: false,
            submitMethod: 'GET',
            itemClickAction: function (corpusId, corpusName) {
                selection.callback(corpusId, corpusName);
                this.setCurrentValue(corpusId, corpusName); // = update widget's trigger button
                this.hide();
            },
            favoriteItemsFilter : function (item) {
                return item.type === 'corpus';
            },
            disableStarComponent: true
        });
    }

    function getSubcorpInfo(layoutModel, corpName, subcName) {
        return layoutModel.ajax(
            'GET',
            layoutModel.createActionUrl('subcorpus/ajax_subcorp_info'),
            {corpname: corpName, subcname: subcName},
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    function updateLiveRow(layoutModel, targetRow, subcInfo, widget) {
        $(targetRow).find('td.status').text(layoutModel.translate('global__subc_active'));
        $(targetRow).find('td.size').text(subcInfo['subCorpusSize']);
        $(targetRow).find('td.created').text(subcInfo['created']);

        var name = window.document.createElement('a');
        var oldCell = $(targetRow).find('td.name');
        $(name)
            .text(oldCell.text())
            .attr('title', layoutModel.translate('global__subc_search_in_subc'))
            .attr('href', layoutModel.createActionUrl('first_form?corpname=' +
                    subcInfo['corpusName'] + '&usesubcorp=' + subcInfo['subCorpusName']));
        oldCell.empty().append(name);

        var actions = window.document.createElement('a');
        $(actions).text(layoutModel.translate('global__subc_actions'));
        bindSubcorpusActions(actions, widget, $('#corpus-selection'));
        $(targetRow).find('td.actions').append(actions);

        var checkbox = window.document.createElement('input');
        $(checkbox)
            .addClass('selected-subc')
            .attr('type', 'checkbox')
            .attr('name', 'selected_subc')
            .attr('value', subcInfo['corpusName'] + ':' + subcInfo['subCorpusName'])
            .on('change', function  () {
                updateSelectionButtons();
            });
        $(targetRow).find('td.selection').append(checkbox);

    }

    function initAsyncTaskChecking(widget, layoutModel) {
        layoutModel.addOnAsyncTaskUpdate(function (itemList) {
            var taskRowMap = {};
            $('#mainform').find('table.data tr.unfinished').each(function (i, item) {
                taskRowMap[$(item).attr('data-task-ident')] = item;
            });
            itemList.forEach(function (item) {
                var targetRow = taskRowMap[item.ident];
                if (targetRow) {
                    var ans = getSubcorpInfo(layoutModel, item.args['corpname'], item.args['subcname']);
                    ans.then(
                        function (data) {
                            if (!data['contains_errors']) {
                                updateLiveRow(layoutModel, targetRow, data, widget);

                            } else {
                                $(targetRow).remove();
                            }
                        },
                        function (err) {
                            $(targetRow).remove();
                            layoutModel.showMessage('error', err);
                        }
                    );
                }
            });
        });
    }

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        // corpusSelection stores a callback of currently opened action link
        // (i.e. only one at a time)
        lib.corpusSelection = {
            callback: function (corpusId, corpusName) {}
        }
        var widget = createCorpusSelector($('#corpus-selection').find('select[name="corpname"]').get(0),
                             lib.corpusSelection);
        subcInfo(widget, lib.corpusSelection);
        initList();
        updateSelectionButtons();
        initAsyncTaskChecking(widget, lib.layoutModel);
    };


    return lib;
});