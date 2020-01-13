/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import {Kontext} from '../../types/common';
import {SaveData} from '../../app/navigation';
import * as Immutable from 'immutable';
import {StatefulModel, validateGzNumber} from '../../models/base';
import {PageModel} from '../../app/page';
import {CollFormModel} from '../../models/coll/collForm';
import RSVP from 'rsvp';
import {MultiDict} from '../../util';
import { Action, IFullActionControl } from 'kombo';


export interface CollResultRow {
    pfilter:Array<[string, string]>;
    nfilter:Array<[string, string]>;
    freq:number;
    Stats:Array<{s:string}>;
    str:string;
}

export type CollResultData = Array<CollResultRow>;

export type CollResultHeadingCell = {s:string; n:string};

export type CollResultHeading = Array<CollResultHeadingCell>;

export interface AjaxResponse extends Kontext.AjaxResponse {
    Head:CollResultHeading;
    Items:CollResultData;
    lastpage:number;
}


export interface COllResultsSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    mainModel:CollResultModel;
    quickSaveRowLimit:number;
    saveCollMaxLines:number;
    collArgsProviderFn:()=>MultiDict;
    saveLinkFn:(file:string, url:string)=>void;
}


export class CollResultsSaveModel extends StatefulModel {

    private layoutModel:PageModel;

    private mainModel:CollResultModel;

    private formIsActive:boolean;

    private saveformat:SaveData.Format;

    private includeColHeaders:boolean;

    private includeHeading:boolean;

    private fromLine:Kontext.FormValue<string>;

    private toLine:Kontext.FormValue<string>;

    private saveLinkFn:(file:string, url:string)=>void;

    private collArgsProviderFn:()=>MultiDict;

    private quickSaveRowLimit:number;

    private saveCollMaxLines:number;

    constructor({
            dispatcher, layoutModel, mainModel, quickSaveRowLimit,
            saveCollMaxLines, collArgsProviderFn, saveLinkFn}:COllResultsSaveModelArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.mainModel = mainModel;
        this.formIsActive = false;
        this.saveformat = SaveData.Format.CSV;
        this.fromLine = {value: '1', isInvalid: false, isRequired: true};
        this.toLine = {value: '', isInvalid: false, isRequired: true};
        this.includeColHeaders = false;
        this.includeHeading = false;
        this.collArgsProviderFn = collArgsProviderFn;
        this.saveLinkFn = saveLinkFn;
        this.quickSaveRowLimit = quickSaveRowLimit;
        this.saveCollMaxLines = saveCollMaxLines;

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'MAIN_MENU_SHOW_SAVE_FORM':
                    this.formIsActive = true;
                    this.toLine.value = '';
                    this.emitChange();
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    if (window.confirm(this.layoutModel.translate(
                        'global__quicksave_limit_warning_{format}{lines}',
                        {format: action.payload['saveformat'], lines: this.quickSaveRowLimit}
                    ))) {
                        this.saveformat = action.payload['saveformat'];
                        this.toLine.value = `${this.quickSaveRowLimit}`;
                        this.submit();
                        this.toLine.value = '';
                        this.emitChange();
                    }
                break;
                case 'COLL_RESULT_CLOSE_SAVE_FORM':
                    this.formIsActive = false;
                    this.emitChange();
                break;
                case 'COLL_SAVE_FORM_SET_FORMAT':
                    this.saveformat = action.payload['value'];
                    this.emitChange();
                break;
                case 'COLL_SAVE_FORM_SET_FROM_LINE':
                    this.fromLine.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'COLL_SAVE_FORM_SET_TO_LINE':
                    this.toLine.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'COLL_SAVE_FORM_SET_INCLUDE_COL_HEADERS':
                    this.includeColHeaders = action.payload['value'];
                    this.emitChange();
                break;
                case 'COLL_SAVE_FORM_SET_INCLUDE_HEADING':
                    this.includeHeading = action.payload['value'];
                    this.emitChange();
                break;
                case 'COLL_SAVE_FORM_SUBMIT':
                    const err = this.validateForm();
                    if (err) {
                        this.layoutModel.showMessage('error', err);

                    } else {
                        this.submit();
                        this.formIsActive = false;
                    }
                    this.emitChange();
                break;
            }
        });
    }

    private validateForm():Error|null {
        this.fromLine.isInvalid = false;
        this.toLine.isInvalid = false;
        if (!this.validateNumberFormat(this.fromLine.value, false)) {
            this.fromLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (!this.validateNumberFormat(this.toLine.value, true)) {
            this.toLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (parseInt(this.fromLine.value) < 1 || (this.toLine.value !== '' &&
                parseInt(this.fromLine.value) > parseInt(this.toLine.value))) {
            this.fromLine.isInvalid = true;
            return new Error(this.layoutModel.translate('freq__save_form_from_value_err_msg'));
        }
    }

    private validateNumberFormat(v:string, allowEmpty:boolean):boolean {
        if (!isNaN(parseInt(v, 10)) || allowEmpty && v === '') {
            return true;
        }
        return false;
    }

    private validateFromToVals():Error {
        const v1 = parseInt(this.fromLine.value, 10);
        const v2 = parseInt(this.toLine.value, 10);

        if (v1 >= 1 && (v1 < v2 || this.toLine.value === '')) {
            return null;
        }
        return Error(this.layoutModel.translate('coll__save_form_from_val_err_msg'));
    }

    private submit():void {
        const args = this.collArgsProviderFn();
        args.remove('format'); // cannot risk format=json and invalid http resp. headers
        args.set('saveformat', this.saveformat);
        args.set('colheaders', this.includeColHeaders ? '1' : '0');
        args.set('heading', this.includeHeading ? '1' : '0');
        args.set('from_line', this.fromLine.value);
        args.set('to_line', this.toLine.value);
        this.saveLinkFn(
            `collocation.${SaveData.formatToExt(this.saveformat)}`,
            this.layoutModel.createActionUrl('savecoll', args.items())
        );
    }

    getFormIsActive():boolean {
        return this.formIsActive;
    }

    // we override here the behavior to expose only the main model
    emitChange():void {
        this.mainModel.emitChange();
        super.emitChange();
    }

    getSaveformat():SaveData.Format {
        return this.saveformat;
    }

    getIncludeColHeaders():boolean {
        return this.includeColHeaders;
    }

    getIncludeHeading():boolean {
        return this.includeHeading;
    }

    getFromLine():Kontext.FormValue<string> {
        return this.fromLine;
    }

    getToLine():Kontext.FormValue<string> {
        return this.toLine;
    }

    getMaxSaveLines():number {
        return this.saveCollMaxLines;
    }
}

type WatchdogUpdateCallback = (status:number, err:Error)=>void;

/**
 *
 */
class CalcWatchdog {

    private layoutModel:PageModel;

    private resultModel:CollResultModel;

    private numNoChange:number;

    private lastStatus:number;

    private checkIntervalId:number;

    private onUpdate:WatchdogUpdateCallback;

    /**
     * Specifies after how many checks should client
     * give-up on watching the status.
     */
    static MAX_NUM_NO_CHANGE = 240;

    static CHECK_INTERVAL_SEC = 2;

    constructor(layoutModel:PageModel, resultModel:CollResultModel, onUpdate:WatchdogUpdateCallback) {
        this.layoutModel = layoutModel;
        this.resultModel = resultModel;
        this.onUpdate = onUpdate;
    }

    private checkStatus():void {
        const args = new MultiDict([
            ['corpname', this.layoutModel.getCorpusIdent().id],
            ['usesubcorp', this.layoutModel.getCorpusIdent().usesubcorp],
            ['attrname', this.layoutModel.getConf<string>('attrname')]
        ]);
        this.layoutModel.getConf<Array<string>>('workerTasks').forEach(taskId => {
            args.add('worker_tasks', taskId);
        });
        this.layoutModel.ajax(
            'GET',
            this.layoutModel.createActionUrl('wordlist_process'),
            args

        ).then(
            (data:Kontext.AjaxResponse) => {
                if (data['status'] === 100) {
                        this.stopWatching(); // just for sure

                } else if (this.numNoChange >= CalcWatchdog.MAX_NUM_NO_CHANGE) {
                    this.onUpdate(null, new Error(this.layoutModel.translate('global__bg_calculation_failed')));

                } else if (data['status'] === this.lastStatus) {
                    this.numNoChange += 1;
                }
                this.lastStatus = data['status'];
                this.onUpdate(this.lastStatus, null);
            },
            (err) => {
                this.onUpdate(null, new Error(this.layoutModel.translate('global__bg_calculation_failed')));
            }
        );
    }

    startWatching():void {
        this.numNoChange = 0;
        this.checkIntervalId = window.setInterval(this.checkStatus.bind(this),
                CalcWatchdog.CHECK_INTERVAL_SEC * 1000);
    }

    stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }
}


export interface CollResulModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    formModel:CollFormModel;
    initialData:CollResultData;
    resultHeading:CollResultHeading;
    pageSize:number;
    saveLinkFn:((file:string, url:string)=>void);
    saveLinesLimit:number;
    unfinished:boolean;
    quickSaveRowLimit:number;
    saveCollMaxLines:number;
}

/**
 *
 */
export class CollResultModel extends StatefulModel {

    private layoutModel:PageModel;

    private data:Immutable.List<CollResultRow>;

    private heading:Immutable.List<CollResultHeadingCell>;

    private currPage:number;

    private formModel:CollFormModel;

    private currPageInput:string; // this is transformed into a real page change once user hits enter/button

    private isWaiting:boolean;

    private pageSize:number;

    private hasNextPage:boolean;

    private sortFn:string;

    private saveModel:CollResultsSaveModel;

    private saveLinesLimit:number;

    private calcStatus:number; // in per-cent (i.e. 0...100)

    private calcWatchdog:CalcWatchdog;

    private quickSaveRowLimit:number;

    constructor({
            dispatcher, layoutModel, formModel, initialData, resultHeading,
            pageSize, saveLinkFn, saveLinesLimit, unfinished, quickSaveRowLimit,
            saveCollMaxLines}:CollResulModelArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.formModel = formModel;
        this.data = Immutable.List<CollResultRow>(initialData);
        this.heading = Immutable.List<CollResultHeadingCell>(resultHeading).slice(1).toList();
        this.currPageInput = '1';
        this.currPage = 1;
        this.isWaiting = false;
        this.pageSize = pageSize;
        this.hasNextPage = true; // we do not know in advance in case of collocations
        this.sortFn = this.formModel.getState().csortfn;
        this.saveModel = new CollResultsSaveModel({
            dispatcher: dispatcher,
            layoutModel: layoutModel,
            mainModel: this,
            collArgsProviderFn: ()=>this.getSubmitArgs(),
            saveLinkFn: saveLinkFn,
            quickSaveRowLimit: quickSaveRowLimit,
            saveCollMaxLines: saveCollMaxLines
        });
        this.saveLinesLimit = saveLinesLimit;
        this.calcStatus = unfinished ? 0 : 100;
        this.calcWatchdog = new CalcWatchdog(layoutModel, this, (status, err) => {
            if (err === null) {
                this.calcStatus = status;
                if (this.calcStatus >= 100) {
                    this.calcWatchdog.stopWatching();
                    this.processDataReload();
                }

            } else {
                this.layoutModel.showMessage('error', err);
                this.calcWatchdog.stopWatching();
            }
            this.emitChange();
        });
        if (this.calcStatus < 100) {
            this.calcWatchdog.startWatching();
        }

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'COLL_RESULT_SET_PAGE_INPUT_VAL':
                    this.currPageInput = action.payload['value'];
                    this.emitChange();
                break;
                case 'COLL_RESULT_GET_NEXT_PAGE':
                    this.isWaiting = true;
                    this.emitChange();
                    this.currPage += 1;
                    this.currPageInput = String(this.currPage);
                    this.processDataReload();
                break;
                case 'COLL_RESULT_GET_PREV_PAGE':
                    this.isWaiting = true;
                    this.emitChange();
                    this.currPage -= 1;
                    this.currPageInput = String(this.currPage);
                    this.processDataReload();
                break;
                case 'COLL_RESULT_CONFIRM_PAGE_VALUE':
                    this.isWaiting = true;
                    this.emitChange();
                    this.currPage = parseInt(this.currPageInput, 10);
                    if (validateGzNumber(this.currPageInput)) {
                        this.processDataReload();

                    } else {
                        this.layoutModel.showMessage('error', this.layoutModel.translate('concview__invalid_page_num_err'));
                    }
                break;
                case 'COLL_RESULT_SORT_BY_COLUMN':
                    this.isWaiting = true;
                    this.emitChange();
                    this.sortFn = action.payload['sortFn'];
                    this.processDataReload();
                break;
                case 'COLL_RESULT_APPLY_QUICK_FILTER':
                    this.applyQuickFilter(action.payload['args']);
                    // a new page is loaded here
                break;
            }
        });
    }

    private applyQuickFilter(args:Immutable.List<[string, string]>) {
        const submitArgs = this.layoutModel.getConcArgs();
        submitArgs.remove('q2');
        args.forEach(item => submitArgs.add(item[0], item[1]));
        window.location.href = this.layoutModel.createActionUrl('quick_filter', submitArgs.items());
    }

    private processDataReload():void {
        this.loadData().then(
            (_) => {
                this.isWaiting = false;
                this.emitChange();
            },
            (err) => {
                this.isWaiting = false;
                this.layoutModel.showMessage('error', err);
                this.emitChange();
            }
        );
    }

    private getSubmitArgs():MultiDict {
        const args = this.formModel.getSubmitArgs(this.formModel.getState());
        args.set('format', 'json');
        args.set('collpage', this.currPage);
        args.set('csortfn', this.sortFn);
        return args;
    }

    private loadData():RSVP.Promise<boolean> {
        const args = this.getSubmitArgs();
        return this.layoutModel.ajax<AjaxResponse>(
            'GET',
            this.layoutModel.createActionUrl('collx'),
            args

        ).then(
            (data) => {
                if (data.Items.length === 0) {
                    this.hasNextPage = false;
                    this.currPage -= 1;
                    this.currPageInput = String(this.currPage);
                    this.layoutModel.showMessage('info', this.layoutModel.translate('global__no_more_pages'));

                } else if (data.Items.length < this.pageSize) {
                    this.hasNextPage = false;
                    this.data = Immutable.List<CollResultRow>(data.Items);

                } else {
                    this.heading = Immutable.List<CollResultHeadingCell>(data.Head).slice(1).toList();
                    this.data = Immutable.List<CollResultRow>(data.Items);
                }
                return true;
            }
        );
    }

    getData():Immutable.List<CollResultRow> {
        return this.data;
    }

    getHeading():Immutable.List<CollResultHeadingCell> {
        return this.heading;
    }

    getCurrPageInput():string {
        return this.currPageInput;
    }

    getCurrPage():number {
        return this.currPage;
    }

    getHasNextPage():boolean {
        return this.hasNextPage;
    }

    getIsWaiting():boolean {
        return this.isWaiting;
    }

    getLineOffset():number {
        return (this.currPage - 1) * this.pageSize;
    }

    getSortFn():string {
        return this.sortFn;
    }

    getCattr():string {
        return this.formModel.getState().cattr;
    }

    getSaveModel():CollResultsSaveModel {
        return this.saveModel;
    }

    getSaveLinesLimit():number {
        return this.saveLinesLimit;
    }

    getCalcStatus():number {
        return this.calcStatus;
    }
}