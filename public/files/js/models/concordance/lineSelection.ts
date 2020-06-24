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

import { Action, IFullActionControl, StatefulModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { tap, map, concatMap } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { MultiDict } from '../../multidict';
import { ConcLinesStorage } from './selectionStorage';
import { PageModel } from '../../app/page';
import { ConcLineModel } from './lines';
import { HTTP, Dict } from 'cnc-tskit';
import { LineSelections, LineSelectionModes } from './common';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { Actions, ActionName } from './actions';


interface ReenableEditResponse extends Kontext.AjaxConcResponse {
    selection:Array<[number, number, number]>;
}

interface SendSelToMailResponse extends Kontext.AjaxConcResponse {
    ok:boolean;
}

export type LineSelValue = [number, number];


export interface LineSelectionModelState {

    /**
     * Selected lines information. Encoding is as follows:
     * [kwic_token_id, [line_number, ]]
     */
    data:LineSelections;

    mode:LineSelectionModes;

    currentGroupIds:Array<number>;

    maxGroupId:number;

    isBusy:boolean;

    emailDialogCredentials:Kontext.UserCredentials|null;

    numItemsInLockedGroups:number;

    lastCheckpointUrl:string;

    renameLabelDialogVisible:boolean;
}

function determineMode(clStorage:ConcLinesStorage, concLineModel:ConcLineModel):'simple'|'groups' {
    if (clStorage.size() > 0) {
        return this.clStorage.getMode();

    } else if (concLineModel.getNumItemsInLockedGroups() > 0) {
        return 'groups';

    } else {
        return 'simple';
    }
}

/**
 * This class handles state of selected concordance lines.
 * The selection can have one of two modes:
 * - binary (checked/unchecked)
 * - categorical (0,1,2,3,4)
 */
export class LineSelectionModel extends StatefulModel<LineSelectionModelState> {

    static FILTER_NEGATIVE = 'n';

    static FILTER_POSITIVE = 'p';

    private readonly layoutModel:PageModel;

    private readonly userInfoModel:Kontext.IUserInfoModel;

    private readonly concLineModel:ConcLineModel;

    private readonly clStorage:ConcLinesStorage;

    private readonly onLeavePage:()=>void;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl,
            concLineModel:ConcLineModel, userInfoModel:Kontext.IUserInfoModel, clStorage:ConcLinesStorage, onLeavePage:()=>void) {
        super(
            dispatcher,
            {
                mode: determineMode(clStorage, concLineModel),
                currentGroupIds: layoutModel.getConf<Array<number>>('LinesGroupsNumbers'),
                maxGroupId: layoutModel.getConf<number>('concLineMaxGroupNum'),
                isBusy: false,
                emailDialogCredentials: null,
                data: {},
                numItemsInLockedGroups: concLineModel.getNumItemsInLockedGroups(),
                lastCheckpointUrl: layoutModel.createActionUrl('view', layoutModel.getConcArgs().items()),
                renameLabelDialogVisible: false
            }
        );
        this.layoutModel = layoutModel;
        this.concLineModel = concLineModel;
        this.userInfoModel = userInfoModel;
        this.clStorage = clStorage;
        this.onLeavePage = onLeavePage;

        this.addActionHandler<Actions.SelectLine>(
            ActionName.SelectLine,
            action => {
                const val = action.payload.value;
                if (this.validateGroupId(val)) {
                    this.selectLine(val, action.payload.tokenNumber, action.payload.kwicLength);
                    this.emitChange();

                } else {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate('linesel__error_group_name_please_use{max_group}',
                                    {max_group: this.state.maxGroupId})
                    );
                }
            }
        );

        this.addActionHandler<Actions.LineSelectionStatusRequest>(
            ActionName.LineSelectionStatusRequest,
            action => {
                this.emitChange(); // TODO is there any change here ???
            }
        );

        this.addActionHandler<Actions.LineSelectionReset>(
            ActionName.LineSelectionReset,
            action => {
                this.clearSelection();
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.LineSelectionResetOnServer>(
            ActionName.LineSelectionResetOnServer,
            action => {
                this.state.isBusy = true;
                this.emitChange();
                this.resetServerLineGroups().subscribe(
                    (args:MultiDict) => {
                        this.state.isBusy = false;
                        this.concLineModel.emitChange();
                        this.emitChange();
                        this.layoutModel.getHistory().replaceState('view', args);
                    },
                    (err) => {
                        this.state.isBusy = false;
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                )
            }
        );

        this.addActionHandler<Actions.RemoveSelectedLines>(
            ActionName.RemoveSelectedLines,
            action => {
                this.removeLines(LineSelectionModel.FILTER_NEGATIVE);
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.RemoveNonSelectedLines>(
            ActionName.RemoveNonSelectedLines,
            action => {
                this.removeLines(LineSelectionModel.FILTER_POSITIVE);
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.MarkLines>(
            ActionName.MarkLines,
            action => {
                this.state.isBusy = true;
                this.emitChange();
                this.markLines().subscribe(
                    (args:MultiDict) => {
                        this.state.isBusy = false;
                        this.emitChange();
                        this.concLineModel.emitChange();
                        this.layoutModel.getHistory().replaceState('view', args);
                    },
                    (err) => {
                        this.state.isBusy = false;
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.RemoveLinesNotInGroups>(
            ActionName.RemoveLinesNotInGroups,
            action => {
                this.removeNonGroupLines(); // we leave the page here ...
            }
        );

        this.addActionHandler<Actions.UnlockLineSelection>(
            ActionName.UnlockLineSelection,
            action => {
                this.state.isBusy = true;
                this.emitChange();
                this.reenableEdit().subscribe(
                    (args:MultiDict) => {
                        this.state.isBusy = false;
                        this.concLineModel.emitChange();
                        this.emitChange();
                        this.layoutModel.getHistory().replaceState('view', args);
                    },
                    (err) => {
                        this.state.isBusy = false;
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.RenameSelectionGroup>(
            ActionName.RenameSelectionGroup,
            action => {
                this.state.isBusy = true;
                this.emitChange();
                this.renameLineGroup(action.payload.srcGroupNum, action.payload.dstGroupNum).subscribe(
                    (args:MultiDict) => {
                        this.state.isBusy = false;
                        this.concLineModel.emitChange();
                        this.emitChange();
                        this.layoutModel.getHistory().replaceState('view', args);
                    },
                    (err) => {
                        this.state.isBusy = false;
                        this.layoutModel.showMessage('error', err);
                        this.emitChange();
                    }
                );
            }
        );

        this.addActionHandler<Actions.SendLineSelectionToEmail>(
            ActionName.SendLineSelectionToEmail,
            action => {
                this.state.isBusy = true;
                this.emitChange();
                this.sendSelectionUrlToEmail(action.payload.email).subscribe(
                    (data) => {
                        this.state.isBusy = false;
                        this.emitChange();
                    },
                    (err) => {
                        this.state.isBusy = false;
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                )
            }
        );

        this.addActionHandler<Actions.SortLineSelection>(
            ActionName.SortLineSelection,
            action => {
                this.sortLines(); // we leave the page here ...
            }
        );

        this.addActionHandler<Actions.SetLineSelectionMode>(
            ActionName.SetLineSelectionMode,
            action => {
                if (this.setMode(action.payload.mode)) {
                    this.emitChange();
                }
            }
        );

        this.addActionHandler<Actions.SetLineSelectionMode>(
            ActionName.SetLineSelectionMode,
            action => {
                if (this.setMode(action.payload.mode)) {
                    this.emitChange();
                }
            }
        );

        this.addActionHandler<Actions.LoadUserCredentials>(
            ActionName.LoadUserCredentials,
            action => {
                this.userInfoModel.loadUserInfo(false).subscribe(
                    () => {
                        this.state.emailDialogCredentials = this.userInfoModel.getCredentials();
                        this.emitChange();
                    },
                    (err) => {
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.ClearUserCredentials>(
            ActionName.ClearUserCredentials,
            action => {
                this.state.emailDialogCredentials = null;
                this.emitChange();
            }
        );
    }

    hasSelectedLines():boolean {
        return this.clStorage.size() > 0;
    }

    unregister():void {}


    private validateGroupId(value:string|number):boolean {
        const v = typeof value === 'string' ? parseInt(value) : value;
        if (isNaN(v)) {
            return false;
        }
        if (this.state.mode === 'groups') {
            return v >= 1 && v <= this.state.maxGroupId || v === -1;
        }
        return v === 1 || v === null;
    }

    private selectLine(value:number, tokenNumber:number, kwiclen:number) {
        if (this.state.mode === 'simple') {
            if (value === 1) {
                this.clStorage.addLine(tokenNumber + '', kwiclen, null);

            } else {
                this.clStorage.removeLine(tokenNumber + '');
            }
            this.clStorage.serialize();

        } else if (this.state.mode === 'groups') {
            if (value !== -1) {
                this.clStorage.addLine(tokenNumber + '', kwiclen, value);

            } else {
                this.clStorage.removeLine(tokenNumber + '');
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

    private renameLineGroup(srcGroupNum:number, dstGroupNum:number):Observable<MultiDict> {
        if (!this.validateGroupId(srcGroupNum) || !this.validateGroupId(dstGroupNum)) {
            return throwError(new Error(this.layoutModel.translate('linesel__error_group_name_please_use{max_group}',
                        {max_group: this.state.maxGroupId})));

        } else if (!srcGroupNum) {
            return throwError(new Error(this.layoutModel.translate('linesel__group_missing')));

        } else if (this.state.currentGroupIds.indexOf(srcGroupNum) < 0) {
            return throwError(new Error(this.layoutModel.translate('linesel__group_does_not_exist_{group}',
                    {group: srcGroupNum})));

        } else {
            return this.layoutModel.ajax$<Kontext.AjaxConcResponse>(
                HTTP.Method.POST,
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
            ).pipe(
                tap((data) => {
                    this.state.currentGroupIds = data.lines_groups_numbers;
                    this.updateGlobalArgs(data);
                }),
                concatMap(_ => this.concLineModel.reloadPage())
            );
        }
    }

    private sendSelectionUrlToEmail(email:string):Observable<boolean> {
        return this.layoutModel.ajax$<SendSelToMailResponse>(
            'POST',
            this.layoutModel.createActionUrl(
                'ajax_send_group_selection_link_to_mail',
                [
                    ['corpname', this.layoutModel.getCorpusIdent().id],
                    ['email', email],
                    ['url', window.location.href]
                ]
            ),
            {}

        ).pipe(
            tap((data) => {
                if (data.ok) {
                    this.layoutModel.showMessage('info',
                        this.layoutModel.translate('linesel__mail_has_been_sent'));

                } else {
                    this.layoutModel.showMessage('error',
                        this.layoutModel.translate('linesel__failed_to_send_the_mail'));
                }
            }),
            map((data) => data.ok)
        );
    }

    private finishAjaxActionWithRedirect(src:Observable<Kontext.AjaxConcResponse>):void {
        /*
         * please note that we do not have to update layout model
         * query code or any other state parameter here because client
         * is redirected to a new URL once the action is done
         */
        src.subscribe(
            (data:Kontext.AjaxConcResponse) => { // TODO type
                this.clStorage.clear();
                const args = this.layoutModel.getConcArgs();
                args.replace('q', data.Q);
                const nextUrl = this.layoutModel.createActionUrl('view', args.items());
                this.onLeavePage();
                window.location.href = nextUrl; // we're leaving Flux world here so it's ok
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    public resetServerLineGroups():Observable<MultiDict> {
        return this.layoutModel.ajax$<Kontext.AjaxConcResponse>(
            'POST',
            this.layoutModel.createActionUrl(
                    'ajax_unset_lines_groups',
                    this.layoutModel.getConcArgs().items()
            ),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }

        ).pipe(
            tap((data) => {
                this.clStorage.clear();
                this.updateGlobalArgs(data);
            }),
            concatMap(_ => this.concLineModel.reloadPage())
        );
    }

    private markLines():Observable<MultiDict> {
        return this.layoutModel.ajax$<Kontext.AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_apply_lines_groups',
                this.layoutModel.getConcArgs().items()
            ),
            {
                rows : JSON.stringify(this.clStorage.exportAll())
            }
        ).pipe(
            tap((data) => {
                this.updateGlobalArgs(data);
                this.state.currentGroupIds = data.lines_groups_numbers;
            }),
            concatMap(_ => this.concLineModel.reloadPage())
        );
    }

    private removeNonGroupLines():void {
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<Kontext.AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_remove_non_group_lines',
                this.layoutModel.getConcArgs().items()
            ),
            {}
        ));
    }

    private reenableEdit():Observable<MultiDict> {
        return this.layoutModel.ajax$<ReenableEditResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_reedit_line_selection',
                this.layoutModel.getConcArgs().items()
            ),
            {}

        ).pipe(
            tap((data) => {
                this.registerQuery(data.Q);
                this.importData(data.selection);
                this.updateGlobalArgs(data);
            }),
            concatMap(_ => this.concLineModel.reloadPage())
        );
    }

    private removeLines(filter:string):void {
        const args = this.layoutModel.getConcArgs();
        args.set('pnfilter', filter);
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<Kontext.AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_remove_selected_lines',
                args.items()
            ),
            {
                rows : JSON.stringify(this.clStorage.exportAll())
            }
        ));
    }

    /**
     * Pair the store with a concrete query. This ensures
     * that visiting a different query view will reset
     * the selection.
     */
    registerQuery(query:Array<string>):void {
        this.clStorage.init(this.state, query);
    }

    getMode():LineSelectionModes {
        return this.state.mode;
    }

    /**
     * @return true if mode has been changed, false otherwise
     */
    setMode(mode:LineSelectionModes):boolean {
        if (this.state.mode !== mode) {
            this.clStorage.setMode(mode);
            this.clStorage.serialize();
            this.state.mode = mode;
            return true;

        } else {
            return false;
        }
    }

    sortLines():void {
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<Kontext.AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('ajax_sort_group_lines',
                    this.layoutModel.getConcArgs().items()),
            {}
        ));
    }

    private importData(data:Array<[number, number, number]>):void {
        data.forEach((item) => {
            this.addLine(String(item[0]), item[1], item[2]);
        });
        this.state.mode = this.clStorage.getMode();
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

    getLine(id:number):LineSelValue {
        return this.clStorage.getLine(String(id));
    }

    clear():void {
        return this.clStorage.clear();
    }

    supportsSessionStorage():boolean {
        return this.clStorage.supportsSessionStorage();
    }

    serialize():void {
        this.clStorage.serialize();
    }

}