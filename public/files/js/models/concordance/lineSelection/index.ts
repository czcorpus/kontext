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

import * as Kontext from '../../../types/kontext';
import { ConcLinesStorage } from '../selectionStorage';
import { DownloadType, PageModel } from '../../../app/page';
import { Dict, HTTP, List, pipe } from 'cnc-tskit';
import { LineSelections, LineSelectionModes, LineSelValue, ConcLineSelection, AjaxConcResponse,
    LineGroupId, attachColorsToIds, mapIdToIdWithColors, AjaxLineGroupRenameResponse,
    LineGroupChartData
} from '../common';
import { Actions } from '../actions';
import { Actions as UserActions } from '../../user/actions';
import { Actions as GlobalActions } from '../../common/actions';
import { Actions as ConcActions } from '../../concordance/actions';
import { IPageLeaveVoter } from '../../common/pageLeave';
import * as copy from 'copy-to-clipboard';


interface ReenableEditResponse extends AjaxConcResponse {
    selection:Array<LineSelValue>;
}

interface SendSelToMailResponse extends AjaxConcResponse {
    ok:boolean;
}

interface LineGroupStats extends Kontext.AjaxResponse {
    groups:{[groupId:string]:number};
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

    groupsChartData:LineGroupChartData;

    exportFormats:Array<string>;

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

    isLeavingPage:boolean;
}

export interface LineSelectionModelArgs {
    layoutModel:PageModel;
    dispatcher:IFullActionControl;
    clStorage:ConcLinesStorage<LineSelectionModelState>;
    exportFormats:Array<string>;
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

    constructor({layoutModel, dispatcher, clStorage, exportFormats}:LineSelectionModelArgs) {
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
            isLeavingPage: false,
            emailDialogCredentials: null,
            data: {},
            groupsChartData: null,
            exportFormats,
            queryHash: '',
            lastCheckpointUrl: layoutModel.createActionUrl(
                'view',
                layoutModel.getConcArgs()
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

        this.addActionHandler(
            Actions.SelectLine,
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

        this.addActionHandler(
            Actions.LineSelectionReset.name,
            action => {
                this.changeState(state => {
                    this.clearSelection(state);
                });
            }
        );

        this.addActionHandler(
            Actions.LineSelectionResetOnServerDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.isBusy = false;
                    });
                }
            }
        );

        this.addActionHandler(
            Actions.LineSelectionResetOnServer,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.currentGroupIds = [];
                    state.isLocked = false;
                    this.clStorage.clear(state, state.queryHash);
                });
                this.resetServerLineGroups(this.state).subscribe({
                    next: args => {
                        this.dispatchSideEffect(
                            Actions.LineSelectionResetOnServerDone
                        );
                    },
                    error: error => {
                        this.dispatchSideEffect(
                            Actions.LineSelectionResetOnServerDone,
                            error
                        );
                        this.layoutModel.showMessage('error', error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.RemoveSelectedLines,
            action => {
                this.changeState(
                    state => {
                        state.isLeavingPage = true;
                    }
                );
                // we leave the page here
                this.removeLines(this.state, 'n');
            }
        );

        this.addActionHandler(
            Actions.RemoveNonSelectedLines,
            action => {
                this.changeState(
                    state => {
                        state.isLeavingPage = true;
                    }
                );
                 // we leave the page here
                this.removeLines(this.state, 'p');
            }
        );

        this.addActionHandler(
            Actions.MarkLinesDone,
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

        this.addActionHandler(
            Actions.MarkLines,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    this.saveGroupsToServerConc(state).subscribe({
                        next: response => {
                            this.dispatchSideEffect(
                                Actions.MarkLinesDone,
                                {
                                    data: response,
                                    groupIds: attachColorsToIds(
                                        response.lines_groups_numbers,
                                        v => v,
                                        mapIdToIdWithColors
                                    )
                                }
                            );
                        },
                        error: error => {
                            this.dispatchSideEffect(
                                Actions.MarkLinesDone,
                                error
                            );
                            this.layoutModel.showMessage('error', error);
                        }
                    });
                });
            }
        );

        this.addActionHandler(
            Actions.RemoveLinesNotInGroups,
            action => {
                this.changeState(
                    state => {
                        state.isLeavingPage = true;
                    }
                );
                this.removeNonGroupLines(); // we leave the page here ...
            }
        );

        this.addActionHandler(
            Actions.UnlockLineSelection,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.reenableEdit().subscribe({
                    next: (data:ReenableEditResponse) => {
                        this.dispatchSideEffect(
                            Actions.UnlockLineSelectionDone,
                            {
                                selection: data.selection,
                                queryId: data.conc_persistence_op_id,
                                mode: 'groups'
                            }
                        );

                    },
                    error: error => {
                        this.dispatchSideEffect(
                            Actions.UnlockLineSelectionDone,
                            error
                        );
                        this.layoutModel.showMessage('error', error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.UnlockLineSelectionDone,
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

        this.addActionHandler(
            Actions.RenameSelectionGroupDone,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    if (!action.error) {
                        state.currentGroupIds = action.payload.lineGroupIds;
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.RenameSelectionGroup,
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
                        this.dispatchSideEffect(
                            Actions.RenameSelectionGroupDone,
                            {
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
                        );

                    },
                    error: error => {
                        this.layoutModel.showMessage('error', error);
                        this.dispatchSideEffect(
                            Actions.RenameSelectionGroupDone,
                            error
                        );
                    }
                });
            }
        );


        this.addActionHandler(
            [Actions.ChangePage, Actions.ReloadConc, ConcActions.SwitchKwicSentMode],
            action => {
                this.dispatchSideEffect(
                    Actions.PublishStoredLineSelections,
                    {
                        selections: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].selections : [],
                        mode: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].mode : 'simple'
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.SendLineSelectionToEmailDone,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                });
            }
        );

        this.addActionHandler(
            Actions.SendLineSelectionToEmail,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.sendSelectionUrlToEmail(action.payload.email).subscribe({
                    next: data => {
                        this.dispatchSideEffect(
                            Actions.SendLineSelectionToEmailDone
                        );
                    },
                    error: error => {
                        this.dispatchSideEffect(
                            Actions.SendLineSelectionToEmailDone,
                            error
                        );
                        this.layoutModel.showMessage('error', error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.SortLineSelection,
            action => {
                this.sortLines(); // we leave the page here ...
            }
        );

        this.addActionHandler(
            Actions.SetLineSelectionMode,
            action => {
                this.changeState(state => {
                    this.setMode(state, action.payload.mode);
                });
            }
        );

        this.addActionHandler(
            UserActions.UserInfoLoaded,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                    state.emailDialogCredentials = action.payload.data;
                });
            }
        );

        this.addActionHandler(
            UserActions.UserInfoRequested,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
            }
        );

        this.addActionHandler(
            Actions.ClearUserCredentials,
            action => {
                this.changeState(state => {
                    state.emailDialogCredentials = null;
                });
            }
        );

        this.addActionHandler(
            Actions.SaveLineSelection,
            action => {
                this.clStorage.serialize(this.state.data);
            }
        );

        this.addActionHandler(
            Actions.ApplyStoredLineSelections,
            action => {
                this.dispatchSideEffect(
                    Actions.ApplyStoredLineSelectionsDone,
                    {
                        selections: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].selections : [],
                        mode: this.state.data[this.state.queryHash] ?
                                this.state.data[this.state.queryHash].mode : 'simple'
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.ToggleLineGroupRenameForm,
            action => {
                this.changeState(state => {
                    state.renameLabelDialogVisible = !state.renameLabelDialogVisible;
                });
            }
        );

        this.addActionHandler(
            GlobalActions.ConcArgsUpdated,
            action => {
                this.changeState(state => {
                    state.lastCheckpointUrl = layoutModel.createActionUrl(
                        'view',
                        layoutModel.getConcArgs()
                    );
                });
            }
        );

        this.addActionHandler(
            Actions.DownloadSelectionOverview,
            action => {
                this.layoutModel.bgDownload({
                    format: 'xlsx',
                    datasetType: DownloadType.LINE_SELECTION,
                    url: this.layoutModel.createActionUrl('export_line_groups_chart'),
                    contentType: 'application/json',
                    args: {
                        title: this.layoutModel.translate('linesel__saved_line_groups_heading'),
                        data: this.state.groupsChartData,
                        corpname: this.state.corpusId,
                        cformat: action.payload.format,
                    }
                }).subscribe();
            }
        );

        this.addActionHandler(
            Actions.GetGroupStats,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = true;
                    }
                );
                this.getGroupsStats();
            }
        );

        this.addActionHandler(
            Actions.GetGroupStatsDone,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = false;
                        if (action.error) {
                            this.layoutModel.showMessage('error', action.error);

                        } else {
                            state.groupsChartData = action.payload.data;
                        }
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.SwitchFirstSelectPage,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.layoutModel.ajax$<{first_page:number}>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl(
                        'ajax_get_first_line_select_page',
                        this.layoutModel.getConcArgs(),
                    ),
                    {},

                ).subscribe({
                    next: resp => {
                        this.dispatchSideEffect(
                            Actions.SwitchFirstSelectPageDone
                        );
                        this.dispatchSideEffect(
                            Actions.ChangePage,
                            {
                                action: 'customPage',
                                pageNum: resp.first_page,
                            }
                        );
                    },
                    error: error => {
                        this.dispatchSideEffect(
                            Actions.SwitchFirstSelectPageDone,
                            error
                        );
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.SwitchFirstSelectPageDone,
            action => {
                this.changeState(state => {
                    state.isBusy = false;
                });
            }
        );

        this.addActionHandler(
            Actions.CopyLineSelectionLinkToClipboard,
            action => {
                copy(this.state.lastCheckpointUrl);
                this.layoutModel.showMessage(
                    'info', this.layoutModel.translate('global__link_copied_to_clipboard'));
            }
        )
    }

    getRegistrationId():string {
        return 'LineSelectionModel';
    }

    reasonNotLeave():string|null {
        return (LineSelectionModel.numSelectedItems(this.getState()) > 0 && !this.state.isLeavingPage) ?
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
                    this.layoutModel.getConcArgs()
                ),
                {
                    'from_num': srcGroupNum,
                    'to_num': dstGroupNum
                }
            ).pipe(
                tap(data => {
                    this.updateGlobalArgs(data);
                    this.layoutModel.getHistory().replaceState(
                        'view', this.layoutModel.getConcArgs());
                })
            );
        }
    }

    private sendSelectionUrlToEmail(email:string):Observable<boolean> {
        return this.layoutModel.ajax$<SendSelToMailResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_send_group_selection_link_to_mail',
                {
                    corpname: this.layoutModel.getCorpusIdent().id,
                    email,
                    url: window.location.href
                }
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
        src.subscribe({
            next: (data:AjaxConcResponse) => {
                const args = this.layoutModel.getConcArgs();
                args.q = [...data.Q];
                const nextUrl = this.layoutModel.createActionUrl('view', args);
                window.location.href = nextUrl;
            },
            error: error => {
                this.layoutModel.showMessage('error', error);
            }
        });
    }

    private resetServerLineGroups(state:LineSelectionModelState):Observable<AjaxConcResponse> {
        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                    'ajax_unset_lines_groups',
                    this.layoutModel.getConcArgs()
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
                this.layoutModel.getConcArgs()
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
                this.layoutModel.getConcArgs()
            ),
            {}
        ));
    }

    private reenableEdit():Observable<ReenableEditResponse> {
        return this.layoutModel.ajax$<ReenableEditResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_reedit_line_selection',
                this.layoutModel.getConcArgs()
            ),
            {}

        ).pipe(
            tap((data) => {
                this.layoutModel.getHistory().replaceState('view', this.layoutModel.getConcArgs());
                this.updateGlobalArgs(data);
            })
        );
    }

    private removeLines(state:LineSelectionModelState, filter:'n'|'p'):void {
        const args = {
            ...this.layoutModel.getConcArgs(),
            pnfilter: filter
        };
        this.finishAjaxActionWithRedirect(this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'ajax_remove_selected_lines',
                args
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
                    this.layoutModel.getConcArgs()),
            {}
        ));
    }

    private getGroupsStats():void {
        this.layoutModel.ajax$<LineGroupStats>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl(
                'ajax_get_line_groups_stats',
                this.layoutModel.getConcArgs()
            ),
            {}

        ).subscribe({
            next: resp => {
                const data:LineGroupChartData = attachColorsToIds(
                    pipe(
                        resp.groups,
                        Dict.toEntries(),
                        List.map(([ident, num]) => ({
                            groupId: parseInt(ident, 10),
                            group: `#${ident}`,
                            count: num,
                            fgColor: '#abcdef',
                            bgColor: '#111111'
                        })),
                        List.sortBy(v => v.groupId)
                    ),
                    item => item.groupId,
                    (item, fgColor, bgColor) => ({
                        ...item,
                        fgColor,
                        bgColor
                    })
                );
                this.dispatchSideEffect(
                    Actions.GetGroupStatsDone,
                    {data}
                );
            },
            error: error => {
                this.dispatchSideEffect(
                    Actions.GetGroupStatsDone,
                    error
                );
            }
        });
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