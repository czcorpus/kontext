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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import * as Immutable from 'vendor/immutable';
import {SimplePageStore, validateGzNumber, validateNumber} from '../../stores/base';
import {PageModel} from '../../app/main';
import {CollFormStore} from '../../stores/coll/collForm';
import * as RSVP from 'vendor/rsvp';
import {MultiDict} from '../../util';


export interface CollResultRow {
    pfilter:Array<[string, string]>;
    nfilter:Array<[string, string]>;
    freq:number;
    Stats:Array<{s:string}>;
    str:string;
}

export type CollResultData = Array<CollResultRow>;

export type CollResultHeading = Array<{s:string;n:string;}>;

export interface AjaxResponse extends Kontext.AjaxResponse {
    Head:CollResultHeading;
    Items:CollResultData;
    lastpage:number;
}


export class CollResultsSaveStore extends SimplePageStore {

    private layoutModel:PageModel;

    private mainStore:CollResultStore;

    private formIsActive:boolean;

    private saveformat:string;

    private includeColHeaders:boolean;

    private includeHeading:boolean;

    private fromLine:string;

    private toLine:string;

    private saveLinkFn:(string)=>void;

    private collArgsProviderFn:()=>MultiDict;

    private static QUICK_SAVE_LINE_LIMIT = 10000;

    private static GLOBAL_SAVE_LINE_LIMIT = 100000;

    constructor(dispatcher:Kontext.FluxDispatcher, layoutModel:PageModel,
            mainStore:CollResultStore, collArgsProviderFn:()=>MultiDict, saveLinkFn:(string)=>void) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.mainStore = mainStore;
        this.formIsActive = false;
        this.saveformat = 'csv';
        this.fromLine = '1';
        this.toLine = '';
        this.includeColHeaders = false;
        this.includeHeading = false;
        this.collArgsProviderFn = collArgsProviderFn;
        this.saveLinkFn = saveLinkFn;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'MAIN_MENU_SHOW_SAVE_FORM':
                    this.formIsActive = true;
                    this.toLine = '';
                    this.notifyChangeListeners();
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    this.saveformat = payload.props['saveformat'];
                    this.toLine = String(CollResultsSaveStore.QUICK_SAVE_LINE_LIMIT);
                    this.submit();
                    this.toLine = '';
                    this.notifyChangeListeners();
                break;
                case 'COLL_RESULT_CLOSE_SAVE_FORM':
                    this.formIsActive = false;
                    this.notifyChangeListeners();
                break;
                case 'COLL_SAVE_FORM_SET_FORMAT':
                    this.saveformat = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_SAVE_FORM_SET_FROM_LINE':
                    this.fromLine = payload.props['value'];
                    this.notifyChangeListeners();
                    this.throttleAction('validate-from-line', () => {
                        if (!validateGzNumber(this.toLine)) {
                            this.toLine = '';
                        }
                        if (!this.validateFromVal()) {
                            this.layoutModel.showMessage('error',
                                this.layoutModel.translate('coll__save_form_from_val_err_msg'));
                        }
                        this.notifyChangeListeners();
                    });
                break;
                case 'COLL_SAVE_FORM_SET_TO_LINE':
                    this.toLine = payload.props['value'];
                    this.notifyChangeListeners();
                    this.throttleAction('validate-to-line', () => {
                        if (!validateGzNumber(this.fromLine)) {
                            this.fromLine = '1';
                        }
                        if (!this.validateToVal()) {
                            this.layoutModel.showMessage('error',
                                this.layoutModel.translate('coll__save_form_to_val_err_msg_{value1}{value2}',
                                    {
                                        value1: this.layoutModel.formatNumber(parseInt(this.fromLine || '1', 10) + 1),
                                        value2: this.layoutModel.formatNumber(CollResultsSaveStore.GLOBAL_SAVE_LINE_LIMIT)
                                    }
                                )
                            );
                        }
                        this.notifyChangeListeners();
                    });
                break;
                case 'COLL_SAVE_FORM_SET_INCLUDE_COL_HEADERS':
                    this.includeColHeaders = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_SAVE_FORM_SET_INCLUDE_HEADING':
                    this.includeHeading = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_SAVE_FORM_SUBMIT':
                    if (this.validateFromVal() && this.validateToVal()) {
                        this.submit();

                    } else {
                        this.layoutModel.showMessage('error',
                            this.layoutModel.translate('global__the_form_contains_errors_msg'));
                    }
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private validateFromVal() {
        return validateNumber(this.fromLine) &&
                (this.toLine === '' || parseInt(this.fromLine, 10) < parseInt(this.toLine, 10)) &&
                parseInt(this.fromLine, 10) > 0;
    }

    private validateToVal() {
        return validateNumber(this.toLine) && parseInt(this.toLine, 10) <= CollResultsSaveStore.GLOBAL_SAVE_LINE_LIMIT
                && parseInt(this.toLine, 10) > parseInt(this.fromLine, 10);
    }

    private submit():void {
        const args = this.collArgsProviderFn();
        args.remove('format'); // cannot risk format=json and invalid http resp. headers
        args.set('saveformat', this.saveformat);
        args.set('colheaders', this.includeColHeaders ? '1' : '0');
        args.set('heading', this.includeHeading ? '1' : '0');
        args.set('from_line', this.fromLine);
        args.set('to_line', this.toLine);
        this.saveLinkFn(this.layoutModel.createActionUrl('savecoll', args.items()));
    }

    getFormIsActive():boolean {
        return this.formIsActive;
    }

    // we override here the behavior to expose only the main store
    notifyChangeListeners():void {
        this.mainStore.notifyChangeListeners();
        super.notifyChangeListeners();
    }

    getSaveformat():string {
        return this.saveformat;
    }

    getIncludeColHeaders():boolean {
        return this.includeColHeaders;
    }

    getIncludeHeading():boolean {
        return this.includeHeading;
    }

    getFromLine():string {
        return this.fromLine;
    }

    getToLine():string {
        return this.toLine;
    }

    getMaxSaveLines():number {
        return CollResultsSaveStore.GLOBAL_SAVE_LINE_LIMIT;
    }
}

type WatchdogUpdateCallback = (status:number, err:Error)=>void;

/**
 *
 */
class CalcWatchdog {

    private layoutModel:PageModel;

    private resultStore:CollResultStore;

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

    constructor(layoutModel:PageModel, resultStore:CollResultStore, onUpdate:WatchdogUpdateCallback) {
        this.layoutModel = layoutModel;
        this.resultStore = resultStore;
        this.onUpdate = onUpdate;
    }

    private checkStatus():void {
        const args = new MultiDict([
            ['corpname', this.layoutModel.getConf<string>('corpname')],
            ['usesubcorp', this.layoutModel.getConf<string>('subcorpname')],
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
        this.checkIntervalId = setInterval(this.checkStatus.bind(this),
                CalcWatchdog.CHECK_INTERVAL_SEC * 1000);
    }

    stopWatching():void {
        clearTimeout(this.checkIntervalId);
    }
}


/**
 *
 */
export class CollResultStore extends SimplePageStore {

    private layoutModel:PageModel;

    private data:Immutable.List<CollResultRow>;

    private heading:Immutable.List<{s:string;n:string}>;

    private currPage:number;

    private formStore:CollFormStore;

    private currPageInput:string; // this is transformed into a real page change once user hits enter/button

    private isWaiting:boolean;

    private pageSize:number;

    private hasNextPage:boolean;

    private sortFn:string;

    private saveStore:CollResultsSaveStore;

    private saveLinesLimit:number;

    private calcStatus:number; // in per-cent (i.e. 0...100)

    private calcWatchdog:CalcWatchdog;

    constructor(dispatcher:Kontext.FluxDispatcher, layoutModel:PageModel,
            formStore:CollFormStore, initialData:CollResultData, resultHeading:CollResultHeading,
            pageSize:number, saveLinkFn:((string)=>void), saveLinesLimit:number,
            unfinished:boolean) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.formStore = formStore;
        this.data = Immutable.List<CollResultRow>(initialData);
        this.heading = Immutable.List<{s:string;n:string}>(resultHeading).slice(1).toList();
        this.currPageInput = '1';
        this.currPage = 1;
        this.isWaiting = false;
        this.pageSize = pageSize;
        this.hasNextPage = true; // we do not know in advance in case of collocations
        this.sortFn = resultHeading.length > 1 && resultHeading[1].s ? resultHeading[1].s : 'f'; // [0] = token column
        this.saveStore = new CollResultsSaveStore(
            dispatcher,
            layoutModel,
            this,
            ()=>this.getSubmitArgs(),
            saveLinkFn
        );
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
            this.notifyChangeListeners();
        });
        if (this.calcStatus < 100) {
            this.calcWatchdog.startWatching();
        }

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'COLL_RESULT_SET_PAGE_INPUT_VAL':
                    this.currPageInput = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'COLL_RESULT_GET_NEXT_PAGE':
                    this.isWaiting = true;
                    this.notifyChangeListeners();
                    this.currPage += 1;
                    this.currPageInput = String(this.currPage);
                    this.processDataReload();
                break;
                case 'COLL_RESULT_GET_PREV_PAGE':
                    this.isWaiting = true;
                    this.notifyChangeListeners();
                    this.currPage -= 1;
                    this.currPageInput = String(this.currPage);
                    this.processDataReload();
                break;
                case 'COLL_RESULT_CONFIRM_PAGE_VALUE':
                    this.isWaiting = true;
                    this.notifyChangeListeners();
                    this.currPage = parseInt(this.currPageInput, 10);
                    if (validateGzNumber(this.currPageInput)) {
                        this.processDataReload();

                    } else {
                        this.layoutModel.showMessage('error', this.layoutModel.translate('concview__invalid_page_num_err'));
                    }
                break;
                case 'COLL_RESULT_SORT_BY_COLUMN':
                    this.isWaiting = true;
                    this.notifyChangeListeners();
                    this.sortFn = payload.props['sortFn'];
                    this.processDataReload();
                break;
                case 'COLL_RESULT_APPLY_QUICK_FILTER':
                    this.applyQuickFilter(payload.props['args']);
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
                this.notifyChangeListeners();
            },
            (err) => {
                this.isWaiting = false;
                this.layoutModel.showMessage('error', err);
                this.notifyChangeListeners();
            }
        );
    }

    private getSubmitArgs():MultiDict {
        const args = this.formStore.getSubmitArgs();
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
                    this.heading = Immutable.List<{s:string;n:string}>(data.Head).slice(1).toList();
                    this.data = Immutable.List<CollResultRow>(data.Items);
                }
                return true;
            }
        );
    }

    getData():Immutable.List<CollResultRow> {
        return this.data;
    }

    getHeading():Immutable.List<{s:string;n:string}> {
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
        return this.formStore.getCattr();
    }

    getSaveStore():CollResultsSaveStore {
        return this.saveStore;
    }

    getSaveLinesLimit():number {
        return this.saveLinesLimit;
    }

    getCalcStatus():number {
        return this.calcStatus;
    }
}