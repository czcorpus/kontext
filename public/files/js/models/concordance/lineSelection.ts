/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import {MultiDict} from '../../util';
import {StatefulModel} from '../base';
import {ConcLinesStorage} from '../../conclines';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {ConcLineModel} from './lines';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';


interface ReenableEditResponse extends Kontext.AjaxConcResponse {
    selection:Array<[number, number, number]>;
}

interface SendSelToMailResponse extends Kontext.AjaxConcResponse {
    ok:boolean;
}

/**
 * This class handles state of selected concordance lines.
 * The selection can have one of two modes:
 * - binary (checked/unchecked)
 * - categorical (0,1,2,3,4)
 */
export class LineSelectionModel extends StatefulModel {

    static FILTER_NEGATIVE = 'n';

    static FILTER_POSITIVE = 'p';

    private layoutModel:PageModel;

    private mode:string;

    private clStorage:ConcLinesStorage;

    private actionFinishHandlers:Array<()=>void>;

    private concLineModel:ConcLineModel;

    private currentGroupIds:Array<number>;

    private maxGroupId:number;

    private _isBusy:boolean;

    private userInfoModel:Kontext.IUserInfoModel;

    private onLeavePage:()=>void;

    private emailDialogCredentials:Kontext.UserCredentials;

    constructor(layoutModel:PageModel, dispatcher:ActionDispatcher,
            concLineModel:ConcLineModel, userInfoModel:Kontext.IUserInfoModel, clStorage:ConcLinesStorage, onLeavePage:()=>void) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.concLineModel = concLineModel;
        this.userInfoModel = userInfoModel;
        this.clStorage = clStorage;
        this.onLeavePage = onLeavePage;
        if (clStorage.size() > 0) {
            this.mode = this.clStorage.getMode();

        } else if (concLineModel.getNumItemsInLockedGroups() > 0) {
            this.mode = 'groups';

        } else {
            this.mode = 'simple';
        }
        this.actionFinishHandlers = [];
        this.currentGroupIds = this.layoutModel.getConf<Array<number>>('LinesGroupsNumbers');
        this.maxGroupId = this.layoutModel.getConf<number>('concLineMaxGroupNum');
        this._isBusy = false;
        this.emailDialogCredentials = null;

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'LINE_SELECTION_SELECT_LINE':
                    let val = payload.props['value'];
                    if (this.validateGroupId(val)) {
                        this.selectLine(val, payload.props['tokenNumber'], payload.props['kwicLength']);
                        this.notifyChangeListeners();

                    } else {
                        this.layoutModel.showMessage('error',
                                this.layoutModel.translate('linesel__error_group_name_please_use{max_group}',
                                        {max_group: this.maxGroupId})
                        );
                    }
                    break;
                case 'LINE_SELECTION_STATUS_REQUEST':
                    this.notifyChangeListeners();
                    break;
                case 'LINE_SELECTION_RESET':
                    this.clearSelection();
                    this.concLineModel.notifyChangeListeners();
                    this.notifyChangeListeners();
                    break;
                case 'LINE_SELECTION_RESET_ON_SERVER':
                    this._isBusy = true;
                    this.notifyChangeListeners();
                    this.resetServerLineGroups().then(
                        (args:MultiDict) => {
                            this._isBusy = false;
                            this.concLineModel.notifyChangeListeners();
                            this.notifyChangeListeners();
                            this.layoutModel.getHistory().replaceState('view', args);
                        },
                        (err) => {
                            this._isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    )
                    break;
                case 'LINE_SELECTION_REMOVE_LINES':
                    this.removeLines(LineSelectionModel.FILTER_NEGATIVE);
                    this.notifyChangeListeners();
                    break;
                case 'LINE_SELECTION_REMOVE_OTHER_LINES':
                    this.removeLines(LineSelectionModel.FILTER_POSITIVE);
                    this.notifyChangeListeners();
                    break;
                case 'LINE_SELECTION_MARK_LINES':
                    this._isBusy = true;
                    this.notifyChangeListeners();
                    this.markLines().then(
                        (args:MultiDict) => {
                            this._isBusy = false;
                            this.notifyChangeListeners();
                            this.concLineModel.notifyChangeListeners();
                            this.layoutModel.getHistory().replaceState('view', args);
                        },
                        (err) => {
                            this._isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                    break;
                case 'LINE_SELECTION_REMOVE_NON_GROUP_LINES':
                    this.removeNonGroupLines(); // this redirects ...
                    break;
                case 'LINE_SELECTION_REENABLE_EDIT':
                    this._isBusy = true;
                    this.notifyChangeListeners();
                    this.reenableEdit().then(
                        (args:MultiDict) => {
                            this._isBusy = false;
                            this.concLineModel.notifyChangeListeners();
                            this.notifyChangeListeners();
                            this.layoutModel.getHistory().replaceState('view', args);
                        },
                        (err) => {
                            this._isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    )
                    break;
                case 'LINE_SELECTION_GROUP_RENAME':
                    this._isBusy = true;
                    this.notifyChangeListeners();
                    this.renameLineGroup(payload.props['srcGroupNum'], payload.props['dstGroupNum']).then(
                        (args:MultiDict) => {
                            this._isBusy = false;
                            this.concLineModel.notifyChangeListeners();
                            this.notifyChangeListeners();
                            this.layoutModel.getHistory().replaceState('view', args);
                        },
                        (err) => {
                            this._isBusy = false;
                            this.layoutModel.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    )
                    break;
                case 'LINE_SELECTION_SEND_URL_TO_EMAIL':
                    this._isBusy = true;
                    this.notifyChangeListeners();
                    this.sendSelectionUrlToEmail(payload.props['email']).then(
                        (data) => {
                            this._isBusy = false;
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this._isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    )
                    break;
                case 'LINE_SELECTION_SORT_LINES':
                    this.sortLines(); // this redirects ...
                    break;
                case 'CONCORDANCE_SET_LINE_SELECTION_MODE':
                    if (this.setMode(payload.props['mode'])) {
                        this.notifyChangeListeners();
                    }
                    break;
                case 'LINE_SELECTION_LOAD_USER_CREDENTIALS':
                    this.userInfoModel.loadUserInfo(false).then(
                        () => {
                            this.emailDialogCredentials = this.userInfoModel.getCredentials();
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'LINE_SELECTION_CLEAR_USER_CREDENTIALS':
                    this.emailDialogCredentials = null;
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private validateGroupId(value:string|number):boolean {
        const v = typeof value === 'string' ? parseInt(value) : value;
        if (isNaN(v)) {
            return false;
        }
        if (this.mode === 'groups') {
            return v >= 1 && v <= this.maxGroupId || v === -1;
        }
        return v === 1 || v === null;
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

    private updateGlobalArgs(data:Kontext.AjaxConcResponse):void {
        this.layoutModel.setConf<number>('NumLinesInGroups', data.num_lines_in_groups);
        this.layoutModel.setConf<Array<number>>('LinesGroupsNumbers', data.lines_groups_numbers);
        this.layoutModel.replaceConcArg('q', data.Q);
    }

    private clearSelection():void {
        this.clStorage.clear();
    }

    private renameLineGroup(srcGroupNum:number, dstGroupNum:number):RSVP.Promise<MultiDict> {
        if (!this.validateGroupId(srcGroupNum) || !this.validateGroupId(dstGroupNum)) {
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                reject(this.layoutModel.translate('linesel__error_group_name_please_use{max_group}',
                        {max_group: this.maxGroupId}));
            });

        } else if (!srcGroupNum) {
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                reject(this.layoutModel.translate('linesel__group_missing'));
            });

        } else if (this.currentGroupIds.indexOf(srcGroupNum) < 0) {
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                reject(this.layoutModel.translate('linesel__group_does_not_exist_{group}',
                    {group: srcGroupNum}));
            });

        } else {
            return this.layoutModel.ajax<Kontext.AjaxConcResponse>(
                'POST',
                this.layoutModel.createActionUrl(
                    'ajax_rename_line_group',
                    this.layoutModel.getConcArgs().items()
                ),
                {
                    'from_num': srcGroupNum,
                    'to_num': dstGroupNum
                },
                {
                    contentType : 'application/x-www-form-urlencoded'
                }
            ).then<MultiDict>(
                (data) => {
                    this.currentGroupIds = data['lines_groups_numbers'];
                    this.updateGlobalArgs(data);
                    return this.concLineModel.reloadPage();
                }
            );
        }
    }

    private sendSelectionUrlToEmail(email:string):RSVP.Promise<boolean> {
        const prom = this.layoutModel.ajax<SendSelToMailResponse>(
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
                if (data.ok) {
                    this.layoutModel.showMessage('info',
                        this.layoutModel.translate('linesel__mail_has_been_sent'));
                    return true;

                } else {
                    this.layoutModel.showMessage('error',
                        this.layoutModel.translate('linesel__failed_to_send_the_mail'));
                    return false;
                }
            }
        );
    }

    private finishAjaxActionWithRedirect(prom:RSVP.Promise<Kontext.AjaxConcResponse>):void {
        /*
         * please note that we do not have to update layout model
         * query code or any other state parameter here because client
         * is redirected to a new URL once the action is done
         */
        prom.then(
            (data:Kontext.AjaxConcResponse) => { // TODO type
                this.performActionFinishHandlers();
                this.clStorage.clear();
                const args = this.layoutModel.getConcArgs();
                args.replace('q', data.Q);
                const nextUrl = this.layoutModel.createActionUrl('view', args.items());
                this.onLeavePage();
                window.location.href = nextUrl; // we're leaving Flux world here so it's ok
            }
        ).catch(
            (err) => {
                this.performActionFinishHandlers();
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    public resetServerLineGroups():RSVP.Promise<MultiDict> {
        return this.layoutModel.ajax<Kontext.AjaxConcResponse>(
            'POST',
            this.layoutModel.createActionUrl(
                    'ajax_unset_lines_groups',
                    this.layoutModel.getConcArgs().items()
            ),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        ).then<MultiDict>(
            (data) => {
                this.clStorage.clear();
                this.updateGlobalArgs(data);
                return this.concLineModel.reloadPage();
            }
        )
    }

    private markLines():RSVP.Promise<MultiDict> {
        return this.layoutModel.ajax<Kontext.AjaxConcResponse>(
            'POST',
            this.layoutModel.createActionUrl(
                'ajax_apply_lines_groups',
                this.layoutModel.getConcArgs().items()
            ),
            {
                rows : JSON.stringify(this.clStorage.getAll())
            }
        ).then<MultiDict>(
            (data) => {
                this.updateGlobalArgs(data);
                this.currentGroupIds = data['lines_groups_numbers'];
                return this.concLineModel.reloadPage();
            }
        );
    }

    private removeNonGroupLines():void {
        const prom:RSVP.Promise<Kontext.AjaxConcResponse> = this.layoutModel.ajax<Kontext.AjaxConcResponse>(
            'POST',
            this.layoutModel.createActionUrl(
                'ajax_remove_non_group_lines',
                this.layoutModel.getConcArgs().items()
            ),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxActionWithRedirect(prom);
    }

    private queryChecksum(q:string):number {
        let cc = 0;
        for(let i = 0; i < q.length; i += 1) {
            cc = (cc << 5) - cc + q.charCodeAt(i);
            cc &= cc;
        }
        return cc;
    }

    private reenableEdit():RSVP.Promise<MultiDict> {
        return this.layoutModel.ajax<ReenableEditResponse>(
            'POST',
            this.layoutModel.createActionUrl(
                'ajax_reedit_line_selection',
                this.layoutModel.getConcArgs().items()
            ),
            {},
            {contentType : 'application/x-www-form-urlencoded'}

        ).then<MultiDict>(
            (data) => {
                this.registerQuery(data.Q);
                this.importData(data.selection);
                this.updateGlobalArgs(data);
                return this.concLineModel.reloadPage();
            }
        );
    }

    private removeLines(filter:string):void {
        const args = this.layoutModel.getConcArgs();
        args.set('pnfilter', filter);
        const prom:RSVP.Promise<Kontext.AjaxConcResponse> = this.layoutModel.ajax<Kontext.AjaxConcResponse>(
            'POST',
            this.layoutModel.createActionUrl(
                'ajax_remove_selected_lines',
                args.items()
            ),
            {
                rows : JSON.stringify(this.getAll())
            },
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxActionWithRedirect(prom);
    }

    /**
     * Pair the store with a concrete query. This ensures
     * that visiting a different query view will reset
     * the selection.
     */
    registerQuery(query:Array<string>):void {
        this.clStorage.init(this.queryChecksum(query.join('')));
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
        return this.layoutModel.createActionUrl('view', this.layoutModel.getConcArgs().items());
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
        let prom:RSVP.Promise<Kontext.AjaxConcResponse> = this.layoutModel.ajax<Kontext.AjaxConcResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_sort_group_lines',
                    this.layoutModel.getConcArgs().items()),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxActionWithRedirect(prom);
    }

    private importData(data:Array<[number, number, number]>):void {
        data.forEach((item) => {
            this.addLine(String(item[0]), item[1], item[2]);
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

    getLine(id:string):[number, number] {
        return this.clStorage.getLine(id);
    }

    getAll():Array<[number, number]> {
        return this.clStorage.getAll();
    }

    asMap():Immutable.Map<string, [number, number]> {
        return this.clStorage.asMap();
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

    isBusy():boolean {
        return this._isBusy;
    }

    getEmailDialogCredentials():Kontext.UserCredentials {
        return this.emailDialogCredentials;
    }

}