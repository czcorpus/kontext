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

/// <reference path="../types/common.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../ts/declarations/popupbox.d.ts" />

import $ = require('jquery');
import documentModule = require('./document');
import corplist = require('plugins/corparch/init');
import popupBox = require('popupbox');

/**
 * Server-defined data (subcorpus/ajax_subcorp_info)
 */
interface SubcorpusExtendedInfo {
    corpname:string;
    cql:string;
    id:number;
    subcname:string;
    timestamp:number;
    user_id:number;
}

/**
 * Server-defined data (subcorpus/ajax_subcorp_info)
 */
interface SubcorpusInfo {
    corpusName:string;
    subCorpusName:string;
    corpusSize:string;
    subCorpusSize:string;
    created:string;
    extended_info:SubcorpusExtendedInfo
}

/**
 * This is an extended version of PluginApi as required by corparch plug-ins.
 * But in this case most of added methods are useless...
 */
class ExtendedApi extends documentModule.PluginApi implements Kontext.QueryPagePluginApi {

    pluginApi:Kontext.PluginApi;

    queryFieldsetToggleEvents:Array<(elm:HTMLElement)=>void>;

    queryFieldsetReadyEvents:Array<(elm:HTMLElement)=>void>;

    constructor(model:documentModule.PageModel) {
        super(model);
        this.queryFieldsetToggleEvents = [];
        this.queryFieldsetReadyEvents = [];
    }

    bindFieldsetToggleEvent(fn:(elm:HTMLElement)=>void) {
        this.queryFieldsetToggleEvents.push(fn);
    }

    bindFieldsetReadyEvent(fn:(elm:HTMLElement)=>void) {
        this.queryFieldsetReadyEvents.push(fn);
    }

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void) {}

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void) {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void) {}

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void) {}

    applyOnQueryFieldsetToggleEvents(elm:HTMLElement) {
        this.queryFieldsetReadyEvents.forEach((fn)=>fn(elm));
    }

    applyOnQueryFieldsetReadyEvents(elm:HTMLElement) {
        this.queryFieldsetReadyEvents.forEach((fn)=>fn(elm));
    }
}

/**
 *
 */
interface CorpusSelection {
    callback:(corpusId:string, corpusName:string)=>void;
}


class SubcorpActionsArgs {
    layoutModel:documentModule.PageModel;
    widget:any; // TODO
    tooltipBox:popupBox.TooltipBox;
    dataRow:HTMLElement;
    corpusId:string;
    subcorpusName:string;
    corpusSelectorWrapper:HTMLElement;
    corpusSelection:CorpusSelection;
}

/**
 *
 */
class SubcorpActions {

    private layoutModel:documentModule.PageModel;

    private widget:any; // TODO type

    private tooltipBox:popupBox.TooltipBox;

    private dataRow:HTMLElement;

    private corpusId:string;

    private subcorpusName:string;

    private corpusSelectorWrapper:HTMLElement;

    private corpusSelection:CorpusSelection;


    constructor(initArgs:SubcorpActionsArgs) {
        this.layoutModel = initArgs.layoutModel;
        this.widget = initArgs.widget;
        this.tooltipBox = initArgs.tooltipBox;
        this.dataRow = initArgs.dataRow;
        this.corpusId = initArgs.corpusId;
        this.subcorpusName = initArgs.subcorpusName;
        this.corpusSelectorWrapper = initArgs.corpusSelectorWrapper;
        this.corpusSelection = initArgs.corpusSelection;
    }

    createSubcorpus(subcname, cql):RSVP.Promise<any> { // TODO type
        let params = {
            corpname: this.corpusId,
            subcname: subcname,
            cql: decodeURIComponent(cql)
        };

        return this.layoutModel.ajax(
            'POST',
            this.layoutModel.createActionUrl('subcorpus/ajax_create_subcorpus'),
            params,
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    wipeSubcorpus():RSVP.Promise<any> {
        let params = {
            corpname : this.corpusId,
            subcname : this.subcorpusName
        };
        return this.layoutModel.ajax(
            'POST',
            this.layoutModel.createActionUrl('subcorpus/ajax_wipe_subcorpus'),
            params,
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    createUndeleteForm(wrappingElm, triggerElm):void {
        let fieldset1;
        let fieldset1Submit;
        let self = this;

        fieldset1 = $(window.document.createElement('fieldset'));
        fieldset1.addClass('subcorp-action-field');
        fieldset1.append('<legend>' + this.layoutModel.translate('global__undelete') + '</legend>');
        fieldset1.append('<p>' + this.layoutModel.translate('global__subcorpus_will_be_restored_using_orig_query') + '</p>');
        fieldset1Submit = $(window.document.createElement('button'));
        fieldset1Submit
            .addClass('default-button')
            .text(this.layoutModel.translate('global__undelete'));
        fieldset1.append(fieldset1Submit);
        wrappingElm.append(fieldset1);
        fieldset1Submit.on('click', function () {
            let prom = self.createSubcorpus(
                    decodeURIComponent($(triggerElm).data('subcname')),
                    $(triggerElm).data('cql')
            );

            prom.then(
                (ans) => {
                    if (!ans.error) {
                        window.location.href = self.layoutModel.createActionUrl('subcorpus/subcorp_list')

                    } else {
                        self.layoutModel.showMessage('error', ans.error);
                    }
                },
                (err) => {
                    self.layoutModel.showMessage('error', err);
                }
            );
        });
    }

    createWipeForm(wrappingElm):void {
        let jqFieldset = $(window.document.createElement('fieldset'));
        let actionButton = $(window.document.createElement('button'));

        $(actionButton)
            .addClass('default-button')
            .text(this.layoutModel.translate('global__delete_forever_btn'))
            .on('click', () => {
                 this.wipeSubcorpus().then(
                    (data) => {
                        if (data.messages) {
                            (data.messages || []).forEach((item) => {
                                this.layoutModel.showMessage(item[0], item[1]);
                            });
                        }
                        this.tooltipBox.close();
                        $(this.dataRow).remove();
                    },
                    (err) => {
                        console.error('err', err); // TODO
                        this.layoutModel.showMessage('error', 'Failed to wipe corpus: ' + err);
                    }
                );
            });


        jqFieldset.addClass('subcorp-action-field');
        jqFieldset.append('<legend>' + this.layoutModel.translate('global__wipe') + '</legend>');
        jqFieldset.append('<p>' + this.layoutModel.translate('global__subcorpus_wipe_warning') + '</p>');
        jqFieldset.append(actionButton);
        wrappingElm.append(jqFieldset);
    }

    createReuseForm(wrappingElm, triggerElm, selection):void {
        let jqFieldset;
        let subcnameInput = $('#new-subcname').get(0);
        let cqlInput = window.document.createElement('textarea');
        let submitArea = window.document.createElement('div');
        let submitButton = window.document.createElement('button');
        let withinBox = window.document.createElement('div');

        jqFieldset = $(window.document.createElement('fieldset'));
        jqFieldset.addClass('subcorp-action-field');
        jqFieldset.append('<legend>' + this.layoutModel.translate('global__reuse_query') + '</legend>');

        $(cqlInput)
            .addClass('cql')
            .val(decodeURIComponent($(triggerElm).data('cql')));

        $(withinBox)
            .addClass('within-box')
            .append(cqlInput);

        jqFieldset.append(withinBox);

        // we have to overwrite item selection callback of shared
        // corpus selection widget
        this.corpusSelection.callback = (corpusId, corpusName) => {
            this.corpusId = corpusId;
        };
        // and also set widget's initial value to the one matching
        // the data line which triggered this box
        this.widget.setCurrentValue($(triggerElm).data('corpname'),
                                    $(triggerElm).data('human_corpname'));
        this.corpusId = $(triggerElm).data('corpname');

        $(submitButton)
            .addClass('default-button')
            .attr('type', 'button')
            .text(this.layoutModel.translate('global__create'))
                .on('click', (evt) => {
                    let prom = this.createSubcorpus($(subcnameInput).val(), $(cqlInput).val());
                    prom.then(
                        (data) => {
                            if (data.contains_errors) {
                                this.layoutModel.showMessage('error', data.error);

                            } else {
                                window.location.href = this.layoutModel.conf['rootURL'] + 'subcorpus/subcorp_list'
                            }
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
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
    }
}


/**
 * Page model
 */
class SubcorpListPage {

    private layoutModel:documentModule.PageModel;

    /**
     * corpusSelection stores a callback of currently
     * opened action link (i.e. only one at a time)
     */
    private corpusSelection:CorpusSelection;

    private corpusSelectionElm:HTMLElement;

    private corpusSelectionWidget:any; // TODO type

    private extendedApi:Kontext.QueryPagePluginApi;

    constructor(layoutModel:documentModule.PageModel, corpusSelectionElm:HTMLElement) {
        this.layoutModel = layoutModel;
        this.corpusSelectionElm = corpusSelectionElm;
        this.corpusSelection = {
            callback: (corpusId, corpusName) => {}
        };
        this.extendedApi = new ExtendedApi(this.layoutModel);
    }

    private hasDefinedSubcorpus(elm):string {
        return $(elm).attr('data-cql');
    }

    private hasDeletedFlag(elm):boolean {
        return $(elm).attr('data-deleted') === '1';
    }

    private bindSubcorpusActions(elm):void {
        let self = this;
        if (this.hasDeletedFlag(elm) || this.hasDefinedSubcorpus(elm)) {
            popupBox.bind(
                $(elm),
                function (tooltipBox, finalize) {
                    let divElm = $(window.document.createElement('div'));
                    let triggerElm = tooltipBox.getTriggerElm();
                    let componentArgs = {
                        layoutModel: self.layoutModel,
                        widget: self.corpusSelectionWidget,
                        tooltipBox: tooltipBox,
                        dataRow: $(triggerElm).closest('tr').get(0),
                        corpusId: decodeURIComponent($(triggerElm).data('corpname')),
                        subcorpusName: decodeURIComponent($(triggerElm).data('subcname')),
                        corpusSelectorWrapper: self.corpusSelectionElm,
                        corpusSelection: self.corpusSelection
                    };
                    let component = new SubcorpActions(componentArgs);
                    $(self.corpusSelectionElm).val($(triggerElm).data('corpname'));

                    if (self.hasDeletedFlag(elm)) {
                        component.createWipeForm(divElm);
                    }
                    if (self.hasDefinedSubcorpus(elm)) {
                        if (self.hasDeletedFlag(elm)) {
                            component.createUndeleteForm(divElm, triggerElm);
                        }
                        component.createReuseForm(divElm, triggerElm, this.corpusSelection);
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
                    /* expandLeft: true, */ // TODO
                    onClose: function () {
                        $('#mainform').append(self.corpusSelectionElm);
                        $(self.corpusSelectionElm).hide(); // TODO elm vs. widget???
                    }
                }
            );

        } else {
            popupBox.bind($(elm), self.layoutModel.translate('global__no_backup_data'), {
                // TODO
                /* expandLeft: true */
            });
        }
    }

    /**
     * Creates a pop-up box containing miscellaneous functions related to a general subcorpus record
     * (undelete, wipe, re-use query).
     */
    private subcInfo():void {
        let self = this;
        let subcnameInput = window.document.createElement('input');
        $(subcnameInput).addClass('subcname')
                .attr('id', 'new-subcname')
                .attr('name', 'subcname');

        $('#subcorp-selector-wrapper').before(subcnameInput);
        $('#subcorp-selector-wrapper').remove();

        $('table.data td .subc-actions').each(function () {
            self.bindSubcorpusActions(this);
        });
    }

    private updateSelectionButtons():void {
        if ($('#mainform').find('input[name="selected_subc"]:checked').length > 0) {
            $('#mainform').find('button.delete-selected').show();

        } else {
            $('#mainform').find('button.delete-selected').hide();
        }
    }

    /**
     * Functions related to the subcorpus list
     */
    private initList():void {
        $('section input.show-deleted').on('change', (e) => {
            if ($(e.currentTarget).is(':checked')) {
                window.location.href = this.layoutModel.createActionUrl('subcorpus/subcorp_list?show_deleted=1');

            } else {
                window.location.href = this.layoutModel.createActionUrl('subcorpus/subcorp_list?show_deleted=0');
            }
        });

        $('#mainform').find('input[name="selected_subc"]').on('change', () => {
            this.updateSelectionButtons();
        });
    }

    /**
     * Corpus selection widget is shared among all the subcorpus lines' action links.
     * It makes some related actions not very straightforward (like overwriting of
     * the item selection callback - see the 'selection' argument).
     */
    private createCorpusSelector(origSelectElm):any { // TODO type
        let self = this;
        return corplist.create(origSelectElm, self.extendedApi, {
            editable: false,
            submitMethod: 'GET',
            itemClickAction: function (corpusId, corpusName) {
                self.corpusSelection.callback(corpusId, corpusName);
                this.setCurrentValue(corpusId, corpusName); // = update widget's trigger button
                this.hide();
            },
            favoriteItemsFilter : function (item) {
                return item.type === 'corpus';
            },
            disableStarComponent: true
        });
    }

    private getSubcorpInfo(corpName, subcName):RSVP.Promise<any> { // TODO return type
        return this.layoutModel.ajax(
            'GET',
            this.layoutModel.createActionUrl('subcorpus/ajax_subcorp_info'),
            {corpname: corpName, subcname: subcName},
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private updateLiveRow(targetRow, subcInfo:SubcorpusInfo):void {
        $(targetRow).find('td.status').text(this.layoutModel.translate('global__subc_active'));
        $(targetRow).find('td.size').text(subcInfo['subCorpusSize']);
        $(targetRow).find('td.created').text(subcInfo['created']);

        let name = window.document.createElement('a');
        let oldCell = $(targetRow).find('td.name');
        $(name)
            .text(oldCell.text())
            .attr('title', this.layoutModel.translate('global__subc_search_in_subc'))
            .attr('href', this.layoutModel.createActionUrl('first_form?corpname=' +
                    subcInfo['corpusName'] + '&usesubcorp=' + subcInfo['subCorpusName']));
        oldCell.empty().append(name);

        let actions = window.document.createElement('a');
        let extendedInfo:SubcorpusExtendedInfo = subcInfo['extended_info'] || {corpname: null, cql: null, id: null, subcname: null, timestamp: null, user_id: null};
        $(actions)
            .text(this.layoutModel.translate('global__subc_actions'))
            .attr('data-deleted', '0')
            .attr('data-cql', encodeURIComponent(extendedInfo.cql))
            .attr('data-subcname', encodeURIComponent(extendedInfo.subcname))
            .attr('data-corpname', encodeURIComponent(extendedInfo.corpname));
        this.bindSubcorpusActions(actions);
        $(targetRow).find('td.actions').append(actions);

        let checkbox = window.document.createElement('input');
        $(checkbox)
            .addClass('selected-subc')
            .attr('type', 'checkbox')
            .attr('name', 'selected_subc')
            .attr('value', subcInfo['corpusName'] + ':' + subcInfo['subCorpusName'])
            .on('change', () => {
                this.updateSelectionButtons();
            });
        $(targetRow).find('td.selection').append(checkbox);
    }

    private initAsyncTaskChecking() {
        this.layoutModel.addOnAsyncTaskUpdate((itemList) => {
            let taskRowMap = {};
            $('#mainform').find('table.data tr.unfinished').each(function (i, item) {
                taskRowMap[$(item).attr('data-task-ident')] = item;
            });
            itemList.forEach((item) => {
                let targetRow = taskRowMap[item.ident];
                if (targetRow) {
                    let ans = this.getSubcorpInfo(item.args['corpname'], item.args['subcname']);
                    ans.then(
                        (data:SubcorpusInfo) => {
                            if (!data['contains_errors']) {
                                this.updateLiveRow(targetRow, data);

                            } else {
                                $(targetRow).remove();
                            }
                        },
                        (err) => {
                            $(targetRow).remove();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            });
        });
    }

    init():void {
        this.layoutModel.init();
        this.corpusSelectionWidget = this.createCorpusSelector($(this.corpusSelectionElm).find('select[name="corpname"]').get(0));
        this.subcInfo();
        this.initList();
        this.updateSelectionButtons();
        this.initAsyncTaskChecking();
    }
}

/**
 * A function used to initialize the model on a respective page.
 */
export function init(conf) {
    let pageModel = new SubcorpListPage(
        new documentModule.PageModel(conf),
        window.document.getElementById('corpus-selection')
    );
    pageModel.init();
}
