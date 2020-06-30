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
import { tap, map, concatMap } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { MultiDict } from '../../multidict';
import { ConcLinesStorage } from './selectionStorage';
import { PageModel } from '../../app/page';
import { ConcordanceModel } from './main';
import { HTTP, List, Color, pipe, tuple } from 'cnc-tskit';
import { LineSelections, LineSelectionModes, LineSelValue } from './common';
import { Actions, ActionName } from './actions';
import { Line } from '../../types/concordance';


interface ReenableEditResponse extends Kontext.AjaxConcResponse {
    selection:Array<LineSelValue>;
}

interface SendSelToMailResponse extends Kontext.AjaxConcResponse {
    ok:boolean;
}


export interface LineSelectionModelState {

    /**
     * Selected lines information. Encoding is as follows:
     * [kwic_token_id, [line_number, ]]
     */
    data:LineSelections;

    queryId:string;

    mode:LineSelectionModes;

    currentGroupIds:Array<number>;

    maxGroupId:number;

    isBusy:boolean;

    emailDialogCredentials:Kontext.UserCredentials|null;

    numItemsInLockedGroups:number;

    lastCheckpointUrl:string;

    renameLabelDialogVisible:boolean;

    catColors:Array<[string, string]>; // bg, fg
}

function determineMode(state:LineSelectionModelState,
            concLineModel:ConcordanceModel):'simple'|'groups' {
    if (state.data[state.queryId].selections.length > 0) {
        return this.clStorage.getMode();

    } else if (concLineModel.getNumItemsInLockedGroups() > 0) {
        return 'groups';

    } else {
        return 'simple';
    }
}

export interface LineSelectionModelArgs {
    layoutModel:PageModel;
    dispatcher:IFullActionControl;
    concLineModel:ConcordanceModel;
    userInfoModel:Kontext.IUserInfoModel;
    clStorage:ConcLinesStorage<LineSelectionModelState>;
    onLeavePage:()=>void;
}

/**
 * This class handles state of selected concordance lines.
 * The selection can have one of two modes:
 * - binary (checked/unchecked)
 * - categorical (0,1,2,3,4)
 */
export class LineSelectionModel extends StatelessModel<LineSelectionModelState> {

    static FILTER_NEGATIVE = 'n';

    static FILTER_POSITIVE = 'p';

    private readonly layoutModel:PageModel;

    private readonly userInfoModel:Kontext.IUserInfoModel;

    private readonly clStorage:ConcLinesStorage<LineSelectionModelState>;

    private readonly onLeavePage:()=>void;

    static ensureCatColor(state:LineSelectionModelState, catIdx:number):[string, string] {
        const cat = state.catColors[catIdx];
        if (cat !== undefined) {
            return tuple(cat[0], cat[1]);
        }
        return tuple('#eeeeee', '#111111');
    }

    constructor({layoutModel, dispatcher, concLineModel, userInfoModel,
            clStorage, onLeavePage}:LineSelectionModelArgs) {
        super(
            dispatcher,
            {
                mode: 'simple',
                currentGroupIds: layoutModel.getConf<Array<number>>('LinesGroupsNumbers'),
                maxGroupId: layoutModel.getConf<number>('concLineMaxGroupNum'),
                isBusy: false,
                emailDialogCredentials: null,
                data: {},
                queryId: '',
                numItemsInLockedGroups: concLineModel.getNumItemsInLockedGroups(),
                lastCheckpointUrl: layoutModel.createActionUrl(
                    'view',
                    layoutModel.getConcArgs().items()
                ),
                renameLabelDialogVisible: false,
                catColors: [] // TODO
            }
        );
        this.layoutModel = layoutModel;
        this.userInfoModel = userInfoModel;
        this.clStorage = clStorage;
        this.onLeavePage = onLeavePage;

        this.addActionHandler<Actions.SelectLines>(
            ActionName.SelectLine,
            (state, action) => {
                const val = action.payload.value;
                if (this.validateGroupId(val)) {
                    this.selectLine(val, action.payload.tokenNumber, action.payload.kwicLength);

                } else {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate(
                                'linesel__error_group_name_please_use{max_group}',
                                {max_group: this.getInitialState().maxGroupId}
                            )
                    );
                }
            }
        );

        this.addActionHandler<Actions.LineSelectionStatusRequest>(
            ActionName.LineSelectionStatusRequest,
            (state, action) => {
                // TODO is there any change here ???
            }
        );

        this.addActionHandler<Actions.LineSelectionReset>(
            ActionName.LineSelectionReset,
            (state, action) => {
                this.clearSelection();
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
                                query: data.Q
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
                this.registerQuery(action.payload.selection.map(v => v));
                this.importData(data.selection);
            }
        )

        this.addActionHandler<Actions.RenameSelectionGroup>(
            ActionName.RenameSelectionGroup,
            action => {
                this.state.isBusy = true;
                this.emitChange();
                this.renameLineGroup(
                    action.payload.srcGroupNum,
                    action.payload.dstGroupNum

                ).subscribe(
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


    private getCatColors(dataItem:Line) {
        const tmp = this.state.data[List.head(dataItem.languages).tokenNumber];
        const cat = tmp ? tmp[1] : dataItem.lineGroup;
        if (cat >= 1) {
            const [bgColor,] = this.state.catColors[cat % this.state.catColors.length];
            const fgColor = pipe(
                bgColor,
                Color.importColor(0.1),
                Color.textColorFromBg(),
                Color.color2str()
            );
            return [pipe(bgColor, Color.importColor(0.9), Color.color2str()), fgColor];
        }
        return [null, null];
    }


    private validateGroupId(value:number|undefined):boolean {
        if (value === undefined) {
            return true;
        }
        if (this.state.mode === 'groups') {
            return value >= 1 && value <= this.state.maxGroupId;
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

    private updateGlobalArgs(data:Kontext.AjaxConcResponse):void {
        this.layoutModel.setConf<number>('NumLinesInGroups', data.num_lines_in_groups);
        this.layoutModel.setConf<Array<number>>('LinesGroupsNumbers', data.lines_groups_numbers);
        this.layoutModel.replaceConcArg('q', data.Q);
    }

    private clearSelection(state:LineSelectionModelState):void {
        this.clStorage.clear(state);
    }

    private renameLineGroup(state:LineSelectionModelState, srcGroupNum:number,
            dstGroupNum:number):Observable<MultiDict> {
        if (!this.validateGroupId(srcGroupNum) || !this.validateGroupId(dstGroupNum)) {
            return throwError(new Error(this.layoutModel.translate(
                    'linesel__error_group_name_please_use{max_group}',
                    {max_group: state.maxGroupId})));

        } else if (!srcGroupNum) {
            return throwError(new Error(this.layoutModel.translate('linesel__group_missing')));

        } else if (state.currentGroupIds.indexOf(srcGroupNum) < 0) {
            return throwError(new Error(this.layoutModel.translate(
                    'linesel__group_does_not_exist_{group}',
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
                    state.currentGroupIds = data.lines_groups_numbers;
                    this.updateGlobalArgs(data);
                }),
                concatMap(_ => this.concLineModel.reloadPage())
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
            HTTP.Method.POST,
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

    private markLines(state:LineSelectionModelState):Observable<MultiDict> {
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
                state.currentGroupIds = data.lines_groups_numbers;
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
                this.layoutModel.getHistory().replaceState('view', args);
                this.updateGlobalArgs(data);
            })
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
        // TODO return this.clStorage.init(this.state, query);
    }

    getMode(state:LineSelectionModelState):LineSelectionModes {
        return state.mode;
    }

    /**
     * @return true if mode has been changed, false otherwise
     */
    setMode(state:LineSelectionModelState, mode:LineSelectionModes):boolean {
        if (state.mode !== mode) {
            this.clStorage.setMode(state, mode);
            state.mode = mode;
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

    private importData(state:LineSelectionModelState, data:Array<[number, number, number]>):void {
        data.forEach(([tokenId, kwicLen, cat]) => {
            this.addLine(state, tokenId, kwicLen, cat);
        });
        state.mode = this.clStorage.getMode(state);
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