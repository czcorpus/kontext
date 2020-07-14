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

import { IFullActionControl, StatelessModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { tap, map } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { ConcLinesStorage } from './selectionStorage';
import { PageModel } from '../../app/page';
import { HTTP, List } from 'cnc-tskit';
import { LineSelections, LineSelectionModes, LineSelValue, ConcLineSelection, AjaxConcResponse,
    LineGroupId, attachColorsToIds, mapIdToIdWithColors, AjaxLineGroupRenameResponse, ConcServerArgs
} from './common';
import { Actions, ActionName } from './actions';
import { Actions as UserInfoActions, ActionName as UserInfoActionName } from '../user/actions';
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
export class LineSelectionModel extends StatelessModel<LineSelectionModelState> implements IPageLeaveVoter<LineSelectionModelState> {

    static FILTER_NEGATIVE = 'n';

    static FILTER_POSITIVE = 'p';

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
    static registerQuery(state:LineSelectionModelState, clStorage:ConcLinesStorage<LineSelectionModelState>, query:Array<string>):void {
        clStorage.init(state, query);
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
        const query = layoutModel.getConf<Array<string>>('compiledQuery');
        const initState:LineSelectionModelState = {
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
                layoutModel.getConcArgs().items()
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

        this.addActionHandler<Actions.SelectLines>(
            ActionName.SelectLine,
            (state, action) => {
                const val = action.payload.value;
                if (this.validateGroupId(state, val)) {
                    this.selectLine(state, val, action.payload.tokenNumber, action.payload.kwicLength);

                } else {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate(
                                'linesel__error_group_name_please_use{max_group}',
                                {max_group: this.getState().maxGroupId}
                            )
                    );
                }
            }
        );

        this.addActionHandler<Actions.LineSelectionReset>(
            ActionName.LineSelectionReset,
            (state, action) => {
                this.clearSelection(state);
            }
        );

        this.addActionHandler<Actions.LineSelectionResetOnServerDone>(
            ActionName.LineSelectionResetOnServerDone,
            (state, action) => {
                if (!action.error) {
                    state.isBusy = false;
                }
            }
        );

        this.addActionHandler<Actions.LineSelectionResetOnServer>(
            ActionName.LineSelectionResetOnServer,
            (state, action) => {
                state.isBusy = true;
                state.currentGroupIds = [];
                this.clStorage.clear(state);
            },
            (state, action, dispatch) => {
                this.resetServerLineGroups(state).subscribe(
                    (args) => {
                        dispatch({
                            name: ActionName.LineSelectionResetOnServerDone
                        });
                    },
                    (err) => {
                        dispatch({
                            name: ActionName.LineSelectionResetOnServerDone,
                            error: err
                        });
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.RemoveSelectedLines>(
            ActionName.RemoveSelectedLines,
            null,
            (state, action, dispatch) => {
                this.removeLines(state, LineSelectionModel.FILTER_NEGATIVE); // we leave the page here
            }
        );

        this.addActionHandler<Actions.RemoveNonSelectedLines>(
            ActionName.RemoveNonSelectedLines,
            null,
            (state, action, dispatch) => {
                this.removeLines(state, LineSelectionModel.FILTER_POSITIVE); // we leave the page here
            }
        );

        this.addActionHandler<Actions.MarkLinesDone>(
            ActionName.MarkLinesDone,
            (state, action) => {
                state.isBusy = false;
                state.currentGroupIds = action.payload.groupIds;
                state.isLocked = true;
            }
        );

        this.addActionHandler<Actions.MarkLines>(
            ActionName.MarkLines,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.saveGroupsToServerConc(state).subscribe(
                    (response) => {
                        dispatch<Actions.MarkLinesDone>({
                            name: ActionName.MarkLinesDone,
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
                    (err) => {
                        dispatch<Actions.MarkLinesDone>({
                            name: ActionName.MarkLinesDone,
                            error: err
                        });
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.RemoveLinesNotInGroups>(
            ActionName.RemoveLinesNotInGroups,
            null,
            (state, action, dispatch) => {
                this.removeNonGroupLines(); // we leave the page here ...
            }
        );

        this.addActionHandler<Actions.UnlockLineSelection>(
            ActionName.UnlockLineSelection,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.reenableEdit().subscribe(
                    (data:ReenableEditResponse) => {
                        dispatch<Actions.UnlockLineSelectionDone>({
                            name: ActionName.UnlockLineSelectionDone,
                            payload: {
                                selection: data.selection,
                                query: data.Q,
                                mode: 'groups'
                            }
                        });

                    },
                    (err) => {
                        dispatch<Actions.UnlockLineSelectionDone>({
                            name: ActionName.UnlockLineSelectionDone,
                            error: err
                        });
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.UnlockLineSelectionDone>(
            ActionName.UnlockLineSelectionDone,
            (state, action) => {
                state.isBusy = false;
                state.isLocked = false;
                LineSelectionModel.registerQuery(state, this.clStorage, action.payload.query);
                this.importData(state, action.payload.selection, action.payload.mode);
            }
        );

        this.addActionHandler<Actions.RenameSelectionGroupDone>(
            ActionName.RenameSelectionGroupDone,
            (state, action) => {
                state.isBusy = false;
                state.currentGroupIds = action.payload.lineGroupIds;
            }
        );

        this.addActionHandler<Actions.RenameSelectionGroup>(
            ActionName.RenameSelectionGroup,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.renameLineGroup(
                    state,
                    action.payload.srcGroupNum,
                    action.payload.dstGroupNum

                ).subscribe(
                    (resp) => {
                        dispatch<Actions.RenameSelectionGroupDone>({
                            name: ActionName.RenameSelectionGroupDone,
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
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        dispatch<Actions.RenameSelectionGroupDone>({
                            name: ActionName.RenameSelectionGroupDone,
                            error: err
                        });
                    }
                );
            }
        );


        this.addActionHandler<Actions.ChangePage>(
            ActionName.ChangePage,
            null,
            (state, action, dispatch) => {
                dispatch<Actions.PublishStoredLineSelections>({
                    name: ActionName.PublishStoredLineSelections,
                    payload: {
                        selections: state.data[state.queryHash] ?
                            state.data[state.queryHash].selections : [],
                        mode: state.data[state.queryHash] ?
                            state.data[state.queryHash].mode : 'simple'
                    }
                })
            }
        );

        this.addActionHandler<Actions.SendLineSelectionToEmailDone>(
            ActionName.SendLineSelectionToEmailDone,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler<Actions.SendLineSelectionToEmail>(
            ActionName.SendLineSelectionToEmail,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.sendSelectionUrlToEmail(action.payload.email).subscribe(
                    (data) => {
                        dispatch<Actions.SendLineSelectionToEmailDone>({
                            name: ActionName.SendLineSelectionToEmailDone
                        });
                    },
                    (err) => {
                        dispatch<Actions.SendLineSelectionToEmailDone>({
                            name: ActionName.SendLineSelectionToEmailDone,
                            error: err
                        });
                        this.layoutModel.showMessage('error', err);
                    }
                )
            }
        );

        this.addActionHandler<Actions.SortLineSelection>(
            ActionName.SortLineSelection,
            null,
            (state, action, dispatch) => {
                this.sortLines(); // we leave the page here ...
            }
        );

        this.addActionHandler<Actions.SetLineSelectionMode>(
            ActionName.SetLineSelectionMode,
            (state, action) => {
                this.setMode(state, action.payload.mode);
            }
        );

        this.addActionHandler<UserInfoActions.UserInfoLoaded>(
            UserInfoActionName.UserInfoLoaded,
            (state, action) => {
                state.isBusy = false;
                state.emailDialogCredentials = action.payload.data;
            }
        );

        this.addActionHandler<UserInfoActions.UserInfoRequested>(
            UserInfoActionName.UserInfoRequested,
            (state, action) => {
                state.isBusy = true;
            }
        );

        this.addActionHandler<Actions.ClearUserCredentials>(
            ActionName.ClearUserCredentials,
            (state, action) => {
                state.emailDialogCredentials = null;
            }
        );

        this.addActionHandler<Actions.SaveLineSelection>(
            ActionName.SaveLineSelection,
            null,
            (state, action, dispatcher) => {
                this.clStorage.serialize(state.data);
            }
        );

        this.addActionHandler<Actions.ApplyStoredLineSelections>(
            ActionName.ApplyStoredLineSelections,
            null,
            (state, action, dispatch) => {
                dispatch<Actions.ApplyStoredLineSelectionsDone>({
                    name: ActionName.ApplyStoredLineSelectionsDone,
                    payload: {
                        selections: state.data[state.queryHash] ?
                            state.data[state.queryHash].selections : [],
                        mode: state.data[state.queryHash] ?
                            state.data[state.queryHash].mode : 'simple'
                    }
                })
            }
        );

        this.addActionHandler<Actions.ToggleLineGroupRenameForm>(
            ActionName.ToggleLineGroupRenameForm,
            (state, action) => {
                state.renameLabelDialogVisible = !state.renameLabelDialogVisible;
            }
        );

        this.addActionHandler<GlobalActions.AskPageLeave>(
            GlobalActionName.AskPageLeave,
            null,
            (state, action, dispatch) => {
                dispatch<GlobalActions.VotePageLeave>({
                    name: GlobalActionName.VotePageLeave,
                    payload: {
                        modelRegKey: this.getRegistrationId(),
                        reasonNotLeave: LineSelectionModel.numSelectedItems(state) > 0 ?
                            this.layoutModel.translate('linesel__current_sel_not_saved_confirm') : null
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'LineSelectionModel';
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
        this.layoutModel.replaceConcArg('q', data.Q);
    }

    private clearSelection(state:LineSelectionModelState):void {
        this.clStorage.clear(state, state.queryHash);
    }

    private renameLineGroup(state:LineSelectionModelState, srcGroupNum:number,
            dstGroupNum:number):Observable<AjaxLineGroupRenameResponse> {
        if (!this.validateGroupId(state, srcGroupNum) || !this.validateGroupId(state, dstGroupNum)) {
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
                    this.layoutModel.getConcArgs().items()
                ),
                {
                    'from_num': srcGroupNum,
                    'to_num': dstGroupNum
                }
            ).pipe(
                tap(data => {
                    this.updateGlobalArgs(data);
                    this.layoutModel.getHistory().replaceState('view', this.layoutModel.getConcArgs());
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
                const args = this.layoutModel.getConcArgs();
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
                    this.layoutModel.getConcArgs().items()
            ),
            {},

        ).pipe(
            tap((data) => {
                this.updateGlobalArgs(data);
                this.layoutModel.getHistory().replaceState('view', this.layoutModel.getConcArgs());
            })
        );
    }

    private saveGroupsToServerConc(state:LineSelectionModelState):Observable<AjaxConcResponse> {
        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_apply_lines_groups',
                this.layoutModel.getConcArgs().items()
            ),
            {
                rows : JSON.stringify(this.clStorage.exportAll(state))
            }
        ).pipe(
            tap(data => {
                this.updateGlobalArgs(data);
                this.layoutModel.getHistory().replaceState('view', this.layoutModel.getConcArgs());
            })
        );
    }

    private removeNonGroupLines():void {
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_remove_non_group_lines',
                this.layoutModel.getConcArgs().items()
            ),
            {}
        ));
    }

    private reenableEdit():Observable<ReenableEditResponse> {
        return this.layoutModel.ajax$<ReenableEditResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_reedit_line_selection',
                this.layoutModel.getConcArgs().items()
            ),
            {}

        ).pipe(
            tap((data) => {
                this.layoutModel.getHistory().replaceState('view', this.layoutModel.getConcArgs());
                this.updateGlobalArgs(data);
            })
        );
    }

    private removeLines(state:LineSelectionModelState, filter:string):void {
        const args = this.layoutModel.getConcArgs() as MultiDict<ConcServerArgs & {pnfilter:string}>;
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
                    this.layoutModel.getConcArgs().items()),
            {}
        ));
    }

    private importData(state:LineSelectionModelState, data:Array<[number, number, number]>, mode:LineSelectionModes):void {
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