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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { tap, map } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { ConcLinesStorage } from './selectionStorage';
import { PageModel } from '../../app/page';
import { HTTP, List } from 'cnc-tskit';
import { LineSelections, LineSelectionModes, LineSelValue, ConcLineSelection, AjaxConcResponse,
    LineGroupId, attachColorsToIds, mapIdToIdWithColors, AjaxLineGroupRenameResponse, ConcServerArgs
} from './common';
import { Actions } from './actions';
import { Actions as UserActions } from '../user/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { MultiDict } from '../../multidict';
import { IPageLeaveVoter } from '../common/pageLeave';


interface ReenableEditResponse extends AjaxConcResponse {
    selection:Array<LineSelValue>;
}

interface SendSelToMailResponse extends AjaxConcResponse {
    ok:boolean;
}


export interface LineSelectionModelState {

    corpusId:string;

    /**
     * Selected lines information. Encoding is as follows:
     * query_hash => [kwic_token_id, kwic_length, cat_num]
     * where query_hash is an internal hash of provided query
     * (i.e. in case KonText provides 'q' argument as has already
     * it is hashed here again)
     */
    data:LineSelections;

    /**
     * An internal hash of actual query. It hashes
     * whatever is provided in the 'q' argument
     * (which can be a list of Manatee operations but
     * also a query ID).
     */
    queryHash:string;

    isLocked:boolean;

    currentGroupIds:Array<LineGroupId>;

    maxGroupId:number;

    isBusy:boolean;

    emailDialogCredentials:Kontext.UserCredentials|null;

    lastCheckpointUrl:string;

    renameLabelDialogVisible:boolean;
}

export interface LineSelectionModelArgs {
    layoutModel:PageModel;
    dispatcher:IFullActionControl;
    clStorage:ConcLinesStorage<LineSelectionModelState>;
}

/**
 * This class handles state of selected concordance lines.
 * The selection can have one of two modes:
 * - binary (checked/unchecked)
 * - categorical (0,1,2,3,4)
 */
export class LineSelectionModel extends StatefulModel<LineSelectionModelState>
        implements IPageLeaveVoter<LineSelectionModelState> {

    private readonly layoutModel:PageModel;

    private readonly clStorage:ConcLinesStorage<LineSelectionModelState>;

    static numSelectedItems(state:LineSelectionModelState):number {
        return state.data[state.queryHash] ? state.data[state.queryHash].selections.length : 0;
    }

    /**
     * Pair the store with a concrete query. This ensures
     * that visiting a different query view will reset
     * the selection.
     */
    static registerQuery(
        state:LineSelectionModelState,
        clStorage:ConcLinesStorage<LineSelectionModelState>,
        queryId:string
    ):void {
        clStorage.init(state, queryId);
    }

    static actualSelection(state:LineSelectionModelState):ConcLineSelection {
        const ans = state.data[state.queryHash];
        return ans ?
            ans :
            {
                created: new Date().getTime() / 1000,
                selections: [],
                mode: 'simple'
            };
    }

    constructor({layoutModel, dispatcher, clStorage}:LineSelectionModelArgs) {
        const query = layoutModel.getConf<string>('concPersistenceOpId');
        const initState:LineSelectionModelState = {
            corpusId: layoutModel.getCorpusIdent().id,
            currentGroupIds: attachColorsToIds(
                layoutModel.getConf<Array<number>>('LinesGroupsNumbers'),
                v => v,
                mapIdToIdWithColors
            ),
            maxGroupId: layoutModel.getConf<number>('concLineMaxGroupNum'),
            isLocked: layoutModel.getConf<number>('NumLinesInGroups') > 0,
            isBusy: false,
            emailDialogCredentials: null,
            data: {},
            queryHash: '',
            lastCheckpointUrl: layoutModel.createActionUrl(
                'view',
                layoutModel.exportConcArgs().items()
            ),
            renameLabelDialogVisible: false
        };
        LineSelectionModel.registerQuery(initState, clStorage, query);
        super(
            dispatcher,
            initState
        );
        this.layoutModel = layoutModel;
        this.clStorage = clStorage;

        this.addActionHandler<typeof Actions.SelectLine>(
            Actions.SelectLine.name,
            action => {
                const val = action.payload.value;
                this.changeState(state => {
                    if (this.validateGroupId(state, val)) {
                        this.selectLine(
                            state,
                            val,
                            action.payload.tokenNumber,
                            action.payload.kwicLength
                        );

                    } else {
                        this.layoutModel.showMessage('error',
                                this.layoutModel.translate(
                                    'linesel__error_group_name_please_use{max_group}',
                                    {max_group: this.getState().maxGroupId}
                                )
                        );
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.LineSelectionReset>(
            Actions.LineSelectionReset.name,
            action => {
                this.changeState(state => {
                    this.clearSelection(state);
                });
            }
        );

        this.addActionHandler<typeof Actions.LineSelectionResetOnServerDone>(
            Actions.LineSelectionResetOnServerDone.name,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.isBusy = false;
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.LineSelectionResetOnServer>(
            Actions.LineSelectionResetOnServer.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.currentGroupIds = [];
                    state.isLocked = false;
                    this.clStorage.clear(state, state.queryHash);
                });
                this.resetServerLineGroups(this.state).subscribe({
                    next: args => {
                        this.dispatchSideEffect<typeof Actions.LineSelectionResetOnServerDone>({
                            name: Actions.LineSelectionResetOnServerDone.name
                        });
                    },
                    error: err => {
                        this.dispatchSideEffect<typeof Actions.LineSelectionResetOnServerDone>({
                            name: Actions.LineSelectionResetOnServerDone.name,
                            error: err
                        });
                        this.layoutModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.RemoveSelectedLines>(
            Actions.RemoveSelectedLines.name,
            action => {
                // we leave the page here
                this.removeLines(this.state, 'n');
            }
        );

        this.addActionHandler<typeof Actions.RemoveNonSelectedLines>(
            Actions.RemoveNonSelectedLines.name,
            action => {
                 // we leave the page here
                this.removeLines(this.state, 'p');
            }
        );

        this.addActionHandler<typeof Actions.MarkLinesDone>(
            Actions.MarkLinesDone.name,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    if (!action.error) {
                        state.currentGroupIds = action.payload.groupIds;
                        state.isLocked = true;
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.MarkLines>(
            Actions.MarkLines.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    this.saveGroupsToServerConc(state).subscribe({
                        next: response => {
                            this.dispatchSideEffect<typeof Actions.MarkLinesDone>({
                                name: Actions.MarkLinesDone.name,
                                payload: {
                                    data: response,
                                    groupIds: attachColorsToIds(
                                        response.lines_groups_numbers,
                                        v => v,
                                        mapIdToIdWithColors
                                    )
                                }
                            });
                        },
                        error: err => {
                            this.dispatchSideEffect<typeof Actions.MarkLinesDone>({
                                name: Actions.MarkLinesDone.name,
                                error: err
                            });
                            this.layoutModel.showMessage('error', err);
                        }
                    });
                });
            }
        );

        this.addActionHandler<typeof Actions.RemoveLinesNotInGroups>(
            Actions.RemoveLinesNotInGroups.name,
            action => {
                this.removeNonGroupLines(); // we leave the page here ...
            }
        );

        this.addActionHandler<typeof Actions.UnlockLineSelection>(
            Actions.UnlockLineSelection.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.reenableEdit().subscribe({
                    next: (data:ReenableEditResponse) => {
                        this.dispatchSideEffect<typeof Actions.UnlockLineSelectionDone>({
                            name: Actions.UnlockLineSelectionDone.name,
                            payload: {
                                selection: data.selection,
                                queryId: data.conc_persistence_op_id,
                                mode: 'groups'
                            }
                        });

                    },
                    error: err => {
                        this.dispatchSideEffect<typeof Actions.UnlockLineSelectionDone>({
                            name: Actions.UnlockLineSelectionDone.name,
                            error: err
                        });
                        this.layoutModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.UnlockLineSelectionDone>(
            Actions.UnlockLineSelectionDone.name,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    state.isLocked = false;
                    LineSelectionModel.registerQuery(
                        state, this.clStorage, action.payload.queryId);
                    this.importData(state, action.payload.selection, action.payload.mode);
                });
            }
        );

        this.addActionHandler<typeof Actions.RenameSelectionGroupDone>(
            Actions.RenameSelectionGroupDone.name,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    if (!action.error) {
                        state.currentGroupIds = action.payload.lineGroupIds;
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.RenameSelectionGroup>(
            Actions.RenameSelectionGroup.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.renameLineGroup(
                    this.state,
                    action.payload.srcGroupNum,
                    action.payload.dstGroupNum

                ).subscribe({
                    next: resp => {
                        this.dispatchSideEffect<typeof Actions.RenameSelectionGroupDone>({
                            name: Actions.RenameSelectionGroupDone.name,
                            payload: {
                                concId: resp.conc_persistence_op_id,
                                numLinesInGroups: resp.num_lines_in_groups,
                                lineGroupIds: attachColorsToIds(
                                    resp.lines_groups_numbers,
                                    v => v,
                                    mapIdToIdWithColors
                                ),
                                prevId: action.payload.srcGroupNum,
                                newId: action.payload.dstGroupNum
                            }
                        });

                    },
                    error: err => {
                        this.layoutModel.showMessage('error', err);
                        this.dispatchSideEffect<typeof Actions.RenameSelectionGroupDone>({
                            name: Actions.RenameSelectionGroupDone.name,
                            error: err
                        });
                    }
                });
            }
        );


        this.addActionHandler<typeof Actions.ChangePage, typeof Actions.ReloadConc>(
            [Actions.ChangePage.name, Actions.ReloadConc.name],
            action => {
                this.dispatchSideEffect<typeof Actions.PublishStoredLineSelections>({
                    name: Actions.PublishStoredLineSelections.name,
                    payload: {
                        selections: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].selections : [],
                        mode: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].mode : 'simple'
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.SendLineSelectionToEmailDone>(
            Actions.SendLineSelectionToEmailDone.name,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                });
            }
        );

        this.addActionHandler<typeof Actions.SendLineSelectionToEmail>(
            Actions.SendLineSelectionToEmail.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.sendSelectionUrlToEmail(action.payload.email).subscribe({
                    next: data => {
                        this.dispatchSideEffect<typeof Actions.SendLineSelectionToEmailDone>({
                            name: Actions.SendLineSelectionToEmailDone.name
                        });
                    },
                    error: err => {
                        this.dispatchSideEffect<typeof Actions.SendLineSelectionToEmailDone>({
                            name: Actions.SendLineSelectionToEmailDone.name,
                            error: err
                        });
                        this.layoutModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.SortLineSelection>(
            Actions.SortLineSelection.name,
            action => {
                this.sortLines(); // we leave the page here ...
            }
        );

        this.addActionHandler<typeof Actions.SetLineSelectionMode>(
            Actions.SetLineSelectionMode.name,
            action => {
                this.changeState(state => {
                    this.setMode(state, action.payload.mode);
                });
            }
        );

        this.addActionHandler<typeof UserActions.UserInfoLoaded>(
            UserActions.UserInfoLoaded.name,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    state.emailDialogCredentials = action.payload.data;
                });
            }
        );

        this.addActionHandler<typeof UserActions.UserInfoRequested>(
            UserActions.UserInfoRequested.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
            }
        );

        this.addActionHandler<typeof Actions.ClearUserCredentials>(
            Actions.ClearUserCredentials.name,
            action => {
                this.changeState(state => {
                    state.emailDialogCredentials = null;
                });
            }
        );

        this.addActionHandler<typeof Actions.SaveLineSelection>(
            Actions.SaveLineSelection.name,
            action => {
                this.clStorage.serialize(this.state.data);
            }
        );

        this.addActionHandler<typeof Actions.ApplyStoredLineSelections>(
            Actions.ApplyStoredLineSelections.name,
            action => {
                this.dispatchSideEffect<typeof Actions.ApplyStoredLineSelectionsDone>({
                    name: Actions.ApplyStoredLineSelectionsDone.name,
                    payload: {
                        selections: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].selections : [],
                        mode: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].mode : 'simple'
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.ToggleLineGroupRenameForm>(
            Actions.ToggleLineGroupRenameForm.name,
            action => {
                this.changeState(state => {
                    state.renameLabelDialogVisible = !state.renameLabelDialogVisible;
                });
            }
        );

        this.addActionHandler<GlobalActions.ConcArgsUpdated>(
            GlobalActionName.ConcArgsUpdated,
            action => {
                this.changeState(state => {
                    state.lastCheckpointUrl = layoutModel.createActionUrl(
                        'view',
                        layoutModel.exportConcArgs().items()
                    );
                });
            }
        );
    }

    getRegistrationId():string {
        return 'LineSelectionModel';
    }

    reasonNotLeave():string|null {
        return LineSelectionModel.numSelectedItems(this.getState()) > 0 ?
            this.layoutModel.translate('linesel__current_sel_not_saved_confirm') : null;
    }

    private validateGroupId(state:LineSelectionModelState, value:number|undefined):boolean {
        if (value === undefined) {
            return true;
        }
        if (this.clStorage.actualData(state).mode === 'groups') {
            return value >= 1 && value <= state.maxGroupId;
        }
        return value === ConcLinesStorage.DEFAULT_GROUP_ID;
    }

    private selectLine(state:LineSelectionModelState, value:number, tokenNumber:number,
            kwiclen:number) {
        if (value === undefined) {
            this.clStorage.removeLine(state, tokenNumber);

        } else {
            this.clStorage.addLine(state, tokenNumber, kwiclen, value);
        }
    }

    private updateGlobalArgs(data:AjaxLineGroupRenameResponse):void {
        this.layoutModel.setConf<number>('NumLinesInGroups', data.num_lines_in_groups);
        this.layoutModel.setConf<Array<number>>('LinesGroupsNumbers', data.lines_groups_numbers);
        this.layoutModel.updateConcPersistenceId(data.Q);
    }

    private clearSelection(state:LineSelectionModelState):void {
        this.clStorage.clear(state, state.queryHash);
    }

    private renameLineGroup(state:LineSelectionModelState, srcGroupNum:number,
            dstGroupNum:number):Observable<AjaxLineGroupRenameResponse> {
        if (!this.validateGroupId(state, srcGroupNum) ||
                !this.validateGroupId(state, dstGroupNum)) {
            return throwError(new Error(this.layoutModel.translate(
                    'linesel__error_group_name_please_use{max_group}',
                    {max_group: state.maxGroupId})));

        } else if (!srcGroupNum) {
            return throwError(new Error(this.layoutModel.translate('linesel__group_missing')));

        } else if (!List.some(v => v.id === srcGroupNum, state.currentGroupIds)) {
            return throwError(new Error(this.layoutModel.translate(
                    'linesel__group_does_not_exist_{group}',
                    {group: srcGroupNum})));

        } else {
            return this.layoutModel.ajax$<AjaxConcResponse>(
                HTTP.Method.POST,
                this.layoutModel.createActionUrl(
                    'ajax_rename_line_group',
                    this.layoutModel.exportConcArgs().items()
                ),
                {
                    'from_num': srcGroupNum,
                    'to_num': dstGroupNum
                }
            ).pipe(
                tap(data => {
                    this.updateGlobalArgs(data);
                    this.layoutModel.getHistory().replaceState(
                        'view', this.layoutModel.exportConcArgs());
                })
            );
        }
    }

    private sendSelectionUrlToEmail(email:string):Observable<boolean> {
        return this.layoutModel.ajax$<SendSelToMailResponse>(
            HTTP.Method.POST,
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

    private finishAjaxActionWithRedirect(src:Observable<AjaxConcResponse>):void {
        /*
         * please note that we do not have to update layout model
         * query code or any other state parameter here because client
         * is redirected to a new URL once the action is done
         */
        src.subscribe(
            (data:AjaxConcResponse) => {
                const args = this.layoutModel.exportConcArgs();
                args.replace('q', data.Q);
                const nextUrl = this.layoutModel.createActionUrl('view', args.items());
                window.location.href = nextUrl;
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    private resetServerLineGroups(state:LineSelectionModelState):Observable<AjaxConcResponse> {
        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                    'ajax_unset_lines_groups',
                    this.layoutModel.exportConcArgs().items()
            ),
            {},

        ).pipe(
            tap((data) => {
                this.updateGlobalArgs(data);
                this.layoutModel.getHistory().replaceState('view', this.layoutModel.exportConcArgs());
            })
        );
    }

    private saveGroupsToServerConc(state:LineSelectionModelState):Observable<AjaxConcResponse> {
        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_apply_lines_groups',
                this.layoutModel.exportConcArgs().items()
            ),
            {
                rows : JSON.stringify(this.clStorage.exportAll(state))
            }
        ).pipe(
            tap(data => {
                this.updateGlobalArgs(data);
                this.layoutModel.getHistory().replaceState('view', this.layoutModel.exportConcArgs());
            })
        );
    }

    private removeNonGroupLines():void {
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_remove_non_group_lines',
                this.layoutModel.exportConcArgs().items()
            ),
            {}
        ));
    }

    private reenableEdit():Observable<ReenableEditResponse> {
        return this.layoutModel.ajax$<ReenableEditResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_reedit_line_selection',
                this.layoutModel.exportConcArgs().items()
            ),
            {}

        ).pipe(
            tap((data) => {
                this.layoutModel.getHistory().replaceState('view', this.layoutModel.exportConcArgs());
                this.updateGlobalArgs(data);
            })
        );
    }

    private removeLines(state:LineSelectionModelState, filter:'n'|'p'):void {
        const args = this.layoutModel.exportConcArgs() as MultiDict<
                ConcServerArgs & {pnfilter:string}>;
        args.set('pnfilter', filter);
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_remove_selected_lines',
                args.items()
            ),
            {
                rows : JSON.stringify(this.clStorage.exportAll(state))
            }
        ));
    }

    /**
     * @return true if mode has been changed, false otherwise
     */
    private setMode(state:LineSelectionModelState, mode:LineSelectionModes):boolean {
        if (this.clStorage.actualData(state).mode !== mode) {
            this.clStorage.setMode(state, mode);
            this.clStorage.actualData(state).mode = mode;
            return true;

        } else {
            return false;
        }
    }

    private sortLines():void {
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('ajax_sort_group_lines',
                    this.layoutModel.exportConcArgs().items()),
            {}
        ));
    }

    private importData(
        state:LineSelectionModelState,
        data:Array<[number, number, number]>,
        mode:LineSelectionModes
    ):void {
        data.forEach(([tokenId, kwicLen, cat]) => {
            this.addLine(state, tokenId, kwicLen, cat);
        });
        this.clStorage.actualData(state).mode = mode;
    }

    addLine(state:LineSelectionModelState, id:number, kwiclen:number, category:number):void {
        this.clStorage.addLine(state, id, kwiclen, category);
    }

    removeLine(state:LineSelectionModelState, id:number):void {
        this.clStorage.removeLine(state, id);
    }

    containsLine(state:LineSelectionModelState, id:number):boolean {
        return this.clStorage.containsLine(state, id);
    }

    getLine(state:LineSelectionModelState, id:number):LineSelValue {
        return this.clStorage.getLine(state, id);
    }

    clear(state:LineSelectionModelState):void {
        return this.clStorage.clear(state);
    }

    supportsSessionStorage():boolean {
        return this.clStorage.supportsSessionStorage();
    }

}