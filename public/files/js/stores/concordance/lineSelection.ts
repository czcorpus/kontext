/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import {SimplePageStore, MultiDict} from '../../util';
import conclines = require('../../conclines');
import tplDocument = require('../../tpl/document');
import {ConcLineStore} from './lines';
import RSVP = require('vendor/rsvp');


export interface RedirectingResponse {
    next_url: string;
    id: string;
    error?:any;
}

/**
 * This Flux store class handles state of selected concordance lines.
 * The selection can have one of two modes:
 * - binary (checked/unchecked)
 * - categorical (0,1,2,3,4)
 */
export class LineSelectionStore extends SimplePageStore {

    static FILTER_NEGATIVE = 'n';

    static FILTER_POSITIVE = 'p';

    private layoutModel:tplDocument.PageModel;

    private mode:string;

    private clStorage:conclines.ConcLinesStorage;

    private actionFinishHandlers:Array<()=>void>;

    private concLineStore:ConcLineStore;

    private currentGroupIds:Array<number>;

    constructor(layoutModel:tplDocument.PageModel, dispatcher:Dispatcher.Dispatcher<any>,
            concLineStore:ConcLineStore, clStorage:conclines.ConcLinesStorage, mode:string) {
        super(dispatcher);
        let self = this;
        this.layoutModel = layoutModel;
        this.concLineStore = concLineStore;
        this.clStorage = clStorage;
        this.mode = this.clStorage.getMode();
        this.actionFinishHandlers = [];
        this.currentGroupIds = this.layoutModel.getConf<Array<number>>('LinesGroupsNumbers');

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'LINE_SELECTION_SELECT_LINE':
                    self.selectLine(payload.props['value'], payload.props['tokenNumber'],
                            payload.props['kwicLength']);
                    self.notifyChangeListeners();
                    break;
                case 'LINE_SELECTION_STATUS_REQUEST':
                    self.notifyChangeListeners('$STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_RESET':
                    self.clearSelection();
                    self.concLineStore.notifyChangeListeners();
                    self.notifyChangeListeners('$STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_RESET_ON_SERVER':
                    self.resetServerLineGroups().then(
                        (args:MultiDict) => {
                            self.concLineStore.notifyChangeListeners();
                            self.notifyChangeListeners('$STATUS_UPDATED');
                            self.layoutModel.historyReplaceState('view', args);
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    )
                    break;
                case 'LINE_SELECTION_REMOVE_LINES':
                    self.removeLines(LineSelectionStore.FILTER_NEGATIVE);
                    self.notifyChangeListeners('$STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_REMOVE_OTHER_LINES':
                    self.removeLines(LineSelectionStore.FILTER_POSITIVE);
                    self.notifyChangeListeners('$STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_MARK_LINES':
                    self.markLines().then(
                        (args:MultiDict) => {
                            self.concLineStore.notifyChangeListeners();
                            self.notifyChangeListeners('$STATUS_UPDATED');
                            self.layoutModel.historyReplaceState('view', args);
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                    break;
                case 'LINE_SELECTION_REMOVE_NON_GROUP_LINES':
                    self.removeNonGroupLines(); // this redirects ...
                    break;
                case 'LINE_SELECTION_REENABLE_EDIT':
                    self.reenableEdit().then(
                        (args:MultiDict) => {
                            self.concLineStore.notifyChangeListeners();
                            self.notifyChangeListeners('$STATUS_UPDATED');
                            self.layoutModel.historyReplaceState('view', args);
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    )
                    break;
                case 'LINE_SELECTION_GROUP_RENAME':
                    self.renameLineGroup(payload.props['srcGroupNum'], payload.props['dstGroupNum']).then(
                        (args:MultiDict) => {
                            self.concLineStore.notifyChangeListeners();
                            self.notifyChangeListeners('$STATUS_UPDATED');
                            self.layoutModel.historyReplaceState('view', args);
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    )
                    break;
                case 'LINE_SELECTION_SEND_URL_TO_EMAIL':
                    let prom:RSVP.Promise<any> = self.sendSelectionUrlToEmail(payload.props['email']);
                    prom.then(
                        function (data) {
                            self.notifyChangeListeners('LINE_SELECTION_URL_SENT_TO_EMAIL');
                        },
                        function (err) {
                            self.notifyChangeListeners('LINE_SELECTION_URL_SENT_TO_EMAIL');
                        }
                    )
                    break;
                case 'LINE_SELECTION_SORT_LINES':
                    self.sortLines(); // this redirects ...
                    break;
                case 'CONCORDANCE_SET_LINE_SELECTION_MODE':
                    if (self.setMode(payload.props['mode'])) {
                        self.notifyChangeListeners('$STATUS_UPDATED');
                    }
                    break;
            }
        });
    }

    private selectLine(value:number, tokenNumber:number, kwiclen:number) {
        if (this.mode === 'simple') {
            if (value === 1) {
                this.clStorage.addLine(String(tokenNumber), kwiclen, null);

            } else {
                this.clStorage.removeLine(String(tokenNumber));
            }
            this.clStorage.serialize();

        } else if (this.mode === 'groups') {
            if (value !== -1) {
                this.clStorage.addLine(String(tokenNumber), kwiclen, value);

            } else {
                this.clStorage.removeLine(String(tokenNumber));
            }
            this.clStorage.serialize();
        }
    }

    private clearSelection():void {
        this.clStorage.clear();
    }

    private renameLineGroup(srcGroupNum:number, dstGroupNum:number):RSVP.Promise<MultiDict> {
        if (!srcGroupNum) {
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                reject(this.layoutModel.translate('linesel__group_missing'));
            });

        } else if (this.currentGroupIds.indexOf(srcGroupNum) < 0) {
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                reject(this.layoutModel.translate('linesel__group_does_not_exist_{group}',
                    {group: srcGroupNum}));
            });

        } else {
            return this.layoutModel.ajax<any>(
                'POST',
                this.layoutModel.createActionUrl('ajax_rename_line_group?' +
                        this.layoutModel.encodeURLParameters(this.layoutModel.getConcArgs())),
                {
                    'from_num': srcGroupNum,
                    'to_num': dstGroupNum
                },
                {
                    contentType : 'application/x-www-form-urlencoded'
                }
            ).then<MultiDict>(
                (data) => {
                    if (!data['contains_errors']) {
                        this.currentGroupIds = data['lines_groups_numbers'];
                        this.layoutModel.setConcArg('q', '~' + data['id']);
                        return this.concLineStore.reloadPage();

                    } else {
                        throw new Error(data['error']);
                    }
                }
            );
        }
    }

    private sendSelectionUrlToEmail(email:string):RSVP.Promise<any> {
        let self = this;
        let prom:RSVP.Promise<any> = this.layoutModel.ajax<any>(
            'POST',
            this.layoutModel.createActionUrl('ajax_send_group_selection_link_to_mail'),
            {
                'email': email,
                'url': window.location.href
            },
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );

        return prom.then(
            (data) => {
                if (data['ok']) {
                    self.layoutModel.showMessage('info',
                        self.layoutModel.translate('linesel__mail_has_been_sent'));
                    return true;

                } else {
                    self.layoutModel.showMessage('error',
                        self.layoutModel.translate('linesel__failed_to_send_the_mail'));
                    return false;
                }
            }
        );
    }

    private finishAjaxActionWithRedirect<T>(prom:RSVP.Promise<T>):void {
        /*
         * please note that we do not have to update layout model
         * query code or any other state parameter here because client
         * is redirected to the 'next_url' once the action is done
         */
        prom.then(
            (data:any) => { // TODO type
                this.performActionFinishHandlers();
                if (!data.error) {
                    this.clStorage.clear();
                    $(window).off('beforeunload.alert_unsaved'); // TODO
                    window.location.href = data.next_url; // we're leaving Flux world here so it's ok

                } else {
                    this.layoutModel.showMessage('error', data.error);
                }
            },
            (err) => {
                this.performActionFinishHandlers();
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    public resetServerLineGroups():RSVP.Promise<MultiDict> {
        return this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_unset_lines_groups?' +  this.layoutModel.getConf('stateParams')),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        ).then<MultiDict>(
            (data) => {
                this.clStorage.clear();
                this.layoutModel.setConcArg('q', '~' + data['id']);
                return this.concLineStore.reloadPage();
            }
        )
    }

    private markLines():RSVP.Promise<MultiDict> {
        return this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_apply_lines_groups?' +
                    this.layoutModel.getConf('stateParams')),
            {
                rows : JSON.stringify(this.clStorage.getAll())
            },
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        ).then<MultiDict>(
            (data) => {
                this.layoutModel.setConcArg('q', '~' + data['id']);
                this.currentGroupIds = data['lines_groups_numbers'];
                return this.concLineStore.reloadPage();
            }
        );
    }

    private removeNonGroupLines():void {
        let prom:RSVP.Promise<RedirectingResponse> = this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_remove_non_group_lines?'
                + this.layoutModel.encodeURLParameters(this.layoutModel.getConcArgs())),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxActionWithRedirect(prom);
    }

    private reenableEdit():RSVP.Promise<MultiDict> {
        return this.layoutModel.ajax(
            'POST',
            this.layoutModel.createActionUrl('ajax_reedit_line_selection?')
                    + this.layoutModel.encodeURLParameters(this.layoutModel.getConcArgs()),
            {},
            {contentType : 'application/x-www-form-urlencoded'}

        ).then<MultiDict>(
            (data:{id:string; selection:number[][]; next_url:string}) => {
                this.importData(data.selection);
                this.layoutModel.setConcArg('q', '~' + data.id);
                return this.concLineStore.reloadPage();
            }
        );
    }

    private removeLines(filter:string):void {
        let prom:RSVP.Promise<RedirectingResponse> = this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_remove_selected_lines?pnfilter='
                + filter + '&' + this.layoutModel.encodeURLParameters(this.layoutModel.getConcArgs())),
            {
                rows : JSON.stringify(this.getAll())
            },
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxActionWithRedirect(prom);
    }

    addActionFinishHandler(fn:()=>void):void {
        this.actionFinishHandlers.push(fn);
    }

    removeActionFinishHandler(fn:()=>void):void {
        for (let i = 0; i < this.actionFinishHandlers.length; i += 1) {
            if (this.actionFinishHandlers[i] === fn) {
                this.actionFinishHandlers.splice(i, 1);
                break;
            }
        }
    }

    removeAllActionFinishHandlers():void {
        this.actionFinishHandlers = [];
    }

    private performActionFinishHandlers():void {
        this.actionFinishHandlers.forEach((fn:()=>void)=> fn());
    }

    getMode():string {
        return this.mode;
    }

    getLastCheckpointUrl() {
        return this.layoutModel.createActionUrl('view') + '?' +
                this.layoutModel.encodeURLParameters(this.layoutModel.getConcArgs());
    }

    /**
     * @return true if mode has been changed, false otherwise
     */
    setMode(mode:string):boolean {
        if (this.mode !== mode) {
            this.clStorage.setMode(mode);
            this.clStorage.serialize();
            this.mode = mode;
            return true;

        } else {
            return false;
        }
    }

    sortLines():void {
        let prom:RSVP.Promise<RedirectingResponse> = this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_sort_group_lines?' +
                    this.layoutModel.encodeURLParameters(this.layoutModel.getConcArgs())),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxActionWithRedirect(prom);
    }

    private importData(data:Array<Array<number>>):void {
        let self = this;
        this.clear();
        data.forEach((item) => {
            self.addLine(String(item[0]), item[1], item[2]);
        });
        this.mode = this.clStorage.getMode();
        this.clStorage.serialize();
    }

    addLine(id:string, kwiclen:number, category:number):void {
        this.clStorage.addLine(id, kwiclen, category);
        this.clStorage.serialize();
    }

    removeLine(id):void {
        this.clStorage.removeLine(id);
        this.clStorage.serialize();
    }

    containsLine(id:string):boolean {
        return this.clStorage.containsLine(id);
    }

    getLine(id:string):Array<number> {
        return this.clStorage.getLine(id);
    }

    getAll():any {
        return this.clStorage.getAll();
    }

    clear():void {
        return this.clStorage.clear();
    }

    /**
     * Return number of selected/group-attached lines
     */
    size():number {
        return this.clStorage.size();
    }

    supportsSessionStorage():boolean {
        return this.clStorage.supportsSessionStorage();
    }

    serialize():void {
        this.clStorage.serialize();
    }

}