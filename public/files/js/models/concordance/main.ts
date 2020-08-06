/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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
import { throwError, Observable, interval, Subscription, forkJoin } from 'rxjs';
import { tap, map, concatMap } from 'rxjs/operators';
import { List, pipe, HTTP } from 'cnc-tskit';

import { ViewOptions } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PluginInterfaces } from '../../types/plugins';
import { MultiDict } from '../../multidict';
import { PageModel } from '../../app/page';
import { KWICSection } from './line';
import { Line, TextChunk, IConcLinesProvider } from '../../types/concordance';
import { AudioPlayer, AudioPlayerStatus} from './media';
import { ConcSaveModel } from './save';
import { Actions as ViewOptionsActions, ActionName as ViewOptionsActionName }
    from '../options/actions';
import { CorpColumn, ConcSummary, ViewConfiguration, AudioPlayerActions, AjaxConcResponse,
    ServerPagination, ServerLineData, ServerTextChunk, LineGroupId, attachColorsToIds,
    mapIdToIdWithColors, ConcServerArgs} from './common';
import { Actions, ActionName, ConcGroupChangePayload,
    PublishLineSelectionPayload } from './actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { SwitchMainCorpServerArgs } from '../query/common';
import { TextTypesModel } from '../textTypes/main';



/**
 *
 */
function importLines(data:Array<ServerLineData>, mainAttrIdx:number):Array<Line> {
    let ans:Array<Line> = [];

    function importTextChunk(item:ServerTextChunk, id:string):TextChunk {
        if (mainAttrIdx === -1) {
            return {
                id,
                className: item.class,
                text: item.str.trim().split(' '),
                openLink: item.open_link ? {speechPath: item.open_link.speech_path} : undefined,
                closeLink: item.close_link ? {speechPath: item.close_link.speech_path} : undefined,
                continued: item.continued,
                showAudioPlayer: false,
                tailPosAttrs: item.tail_posattrs || []
            };

        } else {
            const tailPosattrs = item.tail_posattrs || [];
            const text = item.class === 'strc' ?  item.str : tailPosattrs[mainAttrIdx];
            tailPosattrs.splice(mainAttrIdx, 1, item.str.trim());
            return {
                id,
                className: item.class,
                text: [text],
                openLink: item.open_link ? {speechPath: item.open_link.speech_path} : undefined,
                closeLink: item.close_link ? {speechPath: item.close_link.speech_path} : undefined,
                continued: item.continued,
                showAudioPlayer: false,
                tailPosAttrs: tailPosattrs
            };
        }
    }

    data.forEach((item:ServerLineData, i:number) => {
        let line:Array<KWICSection> = [];
        line.push(new KWICSection(
            item.toknum,
            item.linenum,
            item.ref,
            List.map((v, j) => importTextChunk(v, `C${i}:L${j}`), item.Left),
            List.map((v, j) => importTextChunk(v, `C${i}:K${j}`), item.Kwic),
            List.map((v, j) => importTextChunk(v, `C${i}:R${j}`), item.Right)
        ));

        line = line.concat((item.Align || []).map((item, k) => {
            return new KWICSection(
                item.toknum,
                item.linenum,
                item.ref,
                List.map((v, j) => importTextChunk(v, `C${i}:A${k}:L${j}`), item.Left),
                List.map((v, j) => importTextChunk(v, `C${i}:A${k}:K${j}`), item.Kwic),
                List.map((v, j) => importTextChunk(v, `C${i}:A${k}:R${j}`), item.Right)
            );
        }));
        ans.push({
            lineNumber: item.linenum,
            lineGroup: item.linegroup >= 0 ? item.linegroup : undefined,
            kwicLength: item.kwiclen,
            languages: line,
            hasFocus: false
        });
    });

    return ans;
}


export interface ConcordanceModelState {

    lines:Array<Line>;

    viewMode:string;

    attrViewMode:ViewOptions.AttrViewMode;

    showLineNumbers:boolean;

    kwicCorps:Array<string>;

    corporaColumns:Array<CorpColumn>;

    baseCorpname:string;

    maincorp:string; // primary corpus in alignent mode (can be different from baseCorpname)

    subCorpName:string;

    origSubcorpName:string;

    playerAttachedChunk:string;

    pagination:ServerPagination;

    currentPage:number;

    numItemsInLockedGroups:number;

    /**
     * Note: do not confuse with isBusy.
     * The 'unfinishedCalculation' says: we have some data
     * (typically 1st page) but the process of calculating
     * data is still running in background.
     */
    unfinishedCalculation:boolean;

    concSummary:ConcSummary;

    adHocIpm:number;

    fastAdHocIpm:boolean;

    providesAdHocIpm:boolean;

    useSafeFont:boolean;

    supportsSyntaxView:boolean;

    busyWaitSecs:number;

    baseViewAttr:string;

    viewAttrs:Array<string>;

    showAnonymousUserWarn:boolean;

    supportsTokenConnect:boolean;

    emptyRefValPlaceholder:string;

    saveFormVisible:boolean;

    kwicDetailVisible:boolean;

    refDetailVisible:boolean;

    lineSelOptionsVisible:boolean;

    lineGroupIds:Array<LineGroupId>;

    syntaxViewVisible:boolean;
}


/**
 *
 */
export class ConcordanceModel extends StatefulModel<ConcordanceModelState>
    implements IConcLinesProvider {

    private readonly layoutModel:PageModel;

    private readonly saveModel:ConcSaveModel;

    private readonly syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin;

    private readonly audioPlayer:AudioPlayer;

    private readonly ttModel:TextTypesModel;

    /**
     * Note: substitutes "isBusy". Also compare with unfinishedCalculation.
     */
    private busyTimer:Subscription;

    private readonly runBusyTimer:(currTimer:Subscription)=>Subscription;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl,
            saveModel:ConcSaveModel, syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin,
            ttModel:TextTypesModel, lineViewProps:ViewConfiguration,
            initialData:Array<ServerLineData>) {
        const viewAttrs = layoutModel.getConcArgs().head('attrs').split(',');
        super(
            dispatcher,
            {
                viewMode: lineViewProps.ViewMode,
                attrViewMode: lineViewProps.AttrViewMode,
                showLineNumbers: lineViewProps.ShowLineNumbers,
                kwicCorps: lineViewProps.KWICCorps,
                corporaColumns: lineViewProps.CorporaColumns,
                baseCorpname: lineViewProps.baseCorpname,
                maincorp: lineViewProps.mainCorp,
                subCorpName: lineViewProps.subCorpName,
                origSubcorpName: lineViewProps.origSubCorpName,
                unfinishedCalculation: lineViewProps.Unfinished,
                fastAdHocIpm: lineViewProps.FastAdHocIpm,
                providesAdHocIpm: ttModel.hasSelectedItems(),
                concSummary: lineViewProps.concSummary,
                baseViewAttr: lineViewProps.baseViewAttr,
                lines: importLines(initialData, viewAttrs.indexOf(lineViewProps.baseViewAttr) - 1),
                viewAttrs,
                numItemsInLockedGroups: lineViewProps.NumItemsInLockedGroups,
                pagination: lineViewProps.pagination, // TODO possible mutable mess
                currentPage: lineViewProps.currentPage || 1,
                useSafeFont: lineViewProps.useSafeFont,
                busyWaitSecs: 0,
                supportsSyntaxView: lineViewProps.supportsSyntaxView,
                adHocIpm: -1,
                playerAttachedChunk: '',
                showAnonymousUserWarn: lineViewProps.anonymousUser,
                supportsTokenConnect: lineViewProps.supportsTokenConnect,
                emptyRefValPlaceholder: '\u2014',
                lineGroupIds: attachColorsToIds(
                    layoutModel.getConf<Array<number>>('LinesGroupsNumbers'),
                    v => v,
                    mapIdToIdWithColors
                ),
                saveFormVisible: false,
                kwicDetailVisible: false,
                refDetailVisible: false,
                lineSelOptionsVisible: false,
                syntaxViewVisible: false
            }
        );
        this.layoutModel = layoutModel;
        this.saveModel = saveModel;
        this.ttModel = ttModel;
        this.syntaxViewModel = syntaxViewModel;
        this.busyTimer = lineViewProps.Unfinished ? this.runBusyTimer(this.busyTimer) : null;
        this.audioPlayer = new AudioPlayer(
            this.layoutModel.createStaticUrl('misc/soundmanager2/'),
            () => {
                this.emitChange();
            },
            () => {
                this.setStopStatus();
                this.emitChange();
            },
            () => {
                this.audioPlayer.stop();
                this.setStopStatus();
                this.emitChange();
                this.layoutModel.showMessage('error',
                        this.layoutModel.translate('concview__failed_to_play_audio'));
            }
        );
        this.runBusyTimer = (currTimer:Subscription):Subscription => {
            if (currTimer) {
                currTimer.unsubscribe();
            }
            return interval(1000).subscribe(
                (idx) => {
                    dispatcher.dispatch<Actions.DataWaitTimeInc>({
                        name: ActionName.DataWaitTimeInc,
                        payload: {
                            idx
                        }
                    });
                }
            );
        };

        this.addActionHandler<Actions.ChangeMainCorpus>(
            ActionName.ChangeMainCorpus,
            action => {
                this.changeMainCorpus(action.payload.maincorp);
                    // we leave the page here
            }
        );

        this.addActionHandler<Actions.PlayAudioSegment>(
            ActionName.PlayAudioSegment,
            action => {
                this.playAudio(action.payload.chunksIds);
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.AudioPlayerClickControl>(
            ActionName.AudioPlayerClickControl,
            action => {
                this.handlePlayerControls(action.payload.action);
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.ChangePage>(
            [
                ActionName.ChangePage,
                ActionName.RevisitPage
            ],
            action => {
                forkJoin(
                    this.suspend({}, (action, syncData) => {
                        return action.name === ActionName.PublishStoredLineSelections ?
                            null : syncData;
                    }).pipe(
                        map(v => (v as Actions.PublishStoredLineSelections).payload)
                    ),
                    this.changePage(action.payload.action, action.payload.pageNum)

                ).pipe(
                    tap(([wakePayload, change]) => {
                        this.applyLineSelections(wakePayload);
                    })

                ).subscribe(
                    (data) => {
                        if (action.name === ActionName.ChangePage) {
                            this.pushHistoryState(this.state.currentPage);
                        }
                        this.emitChange();
                    },
                    (err) => {
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.LineSelectionResetOnServer>(
            ActionName.LineSelectionResetOnServer,
            action => {
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.LineSelectionResetOnServerDone ?
                        null : syncData;

                }).pipe(
                    concatMap(v => this.reloadPage())

                ).subscribe(
                    (data) => {
                        this.pushHistoryState(this.state.currentPage);
                        this.emitChange();
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.LineSelectionResetOnServerDone>(
            ActionName.LineSelectionResetOnServerDone,
            action => {
                this.changeState(state => {
                    state.lineSelOptionsVisible = false;
                });
            }
        );

        this.addActionHandler<Actions.AsyncCalculationUpdated>(
            ActionName.AsyncCalculationUpdated,
            action => {
                const prevConcSize = this.state.concSummary.concSize;
                this.changeState(state => {
                    state.unfinishedCalculation = !action.payload.finished;
                    state.concSummary.concSize = action.payload.concsize;
                    state.concSummary.fullSize = action.payload.fullsize;
                    state.concSummary.ipm = action.payload.relconcsize;
                    state.concSummary.arf = action.payload.arf;
                    state.pagination.lastPage = action.payload.availPages;
                });
                if (this.state.concSummary.concSize > 0) {
                    if (prevConcSize === 0) {
                        this.changePage('customPage', 1).subscribe(
                            (data) => {
                                this.busyTimer = this.stopBusyTimer(this.busyTimer);
                                this.emitChange();
                            },
                            (err) => {
                                this.busyTimer = this.stopBusyTimer(this.busyTimer);
                                this.emitChange();
                                this.layoutModel.showMessage('error', err);
                            }
                        );

                    } else {
                        this.busyTimer = this.stopBusyTimer(this.busyTimer);
                    }
                }
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.AsyncCalculationFailed>(
            ActionName.AsyncCalculationFailed,
            action => {
                this.busyTimer = this.stopBusyTimer(this.busyTimer);
                this.changeState(state => {
                    state.unfinishedCalculation = false;
                    state.concSummary.concSize = 0;
                    state.concSummary.fullSize = 0;
                    state.concSummary.ipm = 0;
                    state.concSummary.arf = 0;
                    state.pagination.lastPage = 0;
                    state.lines = [];
                });
            }
        );

        this.addActionHandler<Actions.CalculateIpmForAdHocSubc>(
            ActionName.CalculateIpmForAdHocSubc,
            action => {
                this.busyTimer = this.runBusyTimer(this.busyTimer);
                this.emitChange();
                this.calculateAdHocIpm().subscribe(
                    (data) => {
                        this.busyTimer = this.stopBusyTimer(this.busyTimer);
                        this.emitChange();
                    },
                    (err) => {
                        this.busyTimer = this.stopBusyTimer(this.busyTimer);
                        this.emitChange();
                        console.error(err);
                        this.layoutModel.showMessage(
                            'error',
                            this.layoutModel.translate('global__failed_to_calc_ipm')
                        );
                    }
                );
            }
        );

        this.addActionHandler<Actions.ChangeLangVisibility>(
            ActionName.ChangeLangVisibility,
            action => {
                this.changeColVisibility(action.payload.corpusId, action.payload.value);
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.SwitchKwicSentMode>(
            ActionName.SwitchKwicSentMode,
            action => {
                this.changeViewMode().subscribe(
                    () => {
                        this.emitChange();
                    },
                    (err) => {
                        console.error(err);
                        this.layoutModel.showMessage('error', err);
                        this.emitChange();
                    }
                );
            }
        );

        this.addActionHandler<Actions.DataWaitTimeInc>(
            ActionName.DataWaitTimeInc,
            action => {
                this.changeState(state => {state.busyWaitSecs = action.payload.idx});
            }
        );

        this.addActionHandler<ViewOptionsActions.SaveSettingsDone>(
            ViewOptionsActionName.SaveSettingsDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.baseViewAttr = action.payload.baseViewAttr;
                        state.attrViewMode = action.payload.attrVmode;
                    });
                    this.reloadPage().subscribe(
                        (data) => {
                            this.pushHistoryState(this.state.currentPage);
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            }
        );

        this.addActionHandler<ViewOptionsActions.GeneralSubmitDone>(
            ViewOptionsActionName.GeneralSubmitDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.showLineNumbers = action.payload.showLineNumbers;
                        state.currentPage = 1;
                    });
                    this.reloadPage().subscribe(
                        (data) => {
                            this.pushHistoryState(this.state.currentPage);
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            }
        );

        this.addActionHandler<Actions.LineSelectionReset>(
            ActionName.LineSelectionReset,
            action => {
                this.changeState(state => {
                    state.lines = List.map(
                        v => ({...v, lineGroup: undefined}),
                        state.lines
                    );
                    state.lineSelOptionsVisible = false;
                });
            }
        );

        this.addActionHandler<Actions.UnlockLineSelectionDone>(
            ActionName.UnlockLineSelectionDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.numItemsInLockedGroups = 0;
                        state.lineGroupIds = [];
                        state.lineSelOptionsVisible = false;
                    });
                }
            }
        );

        this.addActionHandler<MainMenuActions.ShowSaveForm|Actions.ResultCloseSaveForm>(
            [MainMenuActionName.ShowSaveForm, ActionName.ResultCloseSaveForm],
            action => {
                this.changeState(state => {
                    state.saveFormVisible = action.name === MainMenuActionName.ShowSaveForm
                });
            }
        );

        this.addActionHandler<Actions.ShowKwicDetail>(
            ActionName.ShowKwicDetail,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = true;
                    state.refDetailVisible = false;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<Actions.ShowTokenDetail>(
            ActionName.ShowTokenDetail,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = true;
                    state.refDetailVisible = false;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<Actions.ResetDetail>(
            ActionName.ResetDetail,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = false;
                    this.resetLineFocus(state);
                });
            }
        );

        this.addActionHandler<Actions.ShowRefDetail>(
            ActionName.ShowRefDetail,
            action => {
                this.changeState(state => {
                    state.refDetailVisible = true;
                    state.kwicDetailVisible = false;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<Actions.RefResetDetail>(
            ActionName.RefResetDetail,
            action => {
                this.changeState(state => {
                    state.refDetailVisible = false;
                    this.resetLineFocus(state);
                });
            }
        );

        this.addActionHandler<Actions.SelectLines>(
            ActionName.SelectLine,
            action => {
                this.changeState(state => {
                    state.lines = List.map(
                        line => ({
                            ...line,
                            lineGroup: action.payload.tokenNumber ===
                                    line.languages[0].tokenNumber ?
                                        action.payload.value : line.lineGroup}),
                        state.lines
                    );
                });
            }
        );

        this.addActionHandler<Actions.ApplyStoredLineSelectionsDone>(
            ActionName.ApplyStoredLineSelectionsDone,
            action => {
                this.applyLineSelections(action.payload);
            }
        );

        this.addActionHandler<Actions.ToggleLineSelOptions>(
            ActionName.ToggleLineSelOptions,
            action => {
                this.changeState(state => {
                    state.lineSelOptionsVisible = !state.lineSelOptionsVisible;
                });
            }
        );

        this.addActionHandler<Actions.MarkLinesDone>(
            ActionName.MarkLinesDone,
            action => {
                if (!action.error) {
                    this.reloadPage(action.payload.data.conc_persistence_op_id).subscribe(
                        (data) => {
                            this.changeState(state => {
                                state.lineSelOptionsVisible = false;
                                state.lineGroupIds = action.payload.groupIds;
                            });
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            }
        );

        this.addActionHandler<Actions.RenameSelectionGroupDone>(
            ActionName.RenameSelectionGroupDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.changeGroupNaming(state, action.payload);
                        state.lineSelOptionsVisible = false;
                    });
                }
            }
        );

        this.addActionHandler<Actions.ShowSyntaxView>(
            ActionName.ShowSyntaxView,
            action => {
                this.changeState(state => {
                    state.syntaxViewVisible = true;
                });
            }
        );

        this.addActionHandler<Actions.CloseSyntaxView>(
            ActionName.CloseSyntaxView,
            action => {
                this.changeState(state => {
                    state.syntaxViewVisible = false;
                });
            }
        );

        this.addActionHandler<Actions.HideAnonymousUserWarning>(
            ActionName.HideAnonymousUserWarning,
            action => {
                this.changeState(state => {
                    state.showAnonymousUserWarn = false;
                });
            }
        );
    }

    private stopBusyTimer(subs:Subscription):null {
        if (subs !== null) {
            subs.unsubscribe();
        }
        return null;
    }

    private applyLineSelections(data:PublishLineSelectionPayload):void {
        this.changeState(state => {
            state.lines = List.map(
                line => {
                    const srch = List.find(
                        ([tokenNum,,]) => line.languages[0].tokenNumber === tokenNum,
                        data.selections
                    );
                    const lineGroup = srch ? srch[2] : line.lineGroup;
                    return {...line, lineGroup};
                },
                state.lines
            );
        });
    }

    private changeColVisibility(corpusId:string, status:boolean):void {
        const srchIdx = this.state.corporaColumns.findIndex(v => v.n === corpusId);
        if (srchIdx > -1) {
            const srch = this.state.corporaColumns[srchIdx];
            this.changeState(state => {
                state.corporaColumns[srchIdx] = {
                    n: srch.n,
                    label: srch.label,
                    visible: status
                };
            });

        } else {
            throw new Error(`column for ${corpusId} not found`);
        }
    }

    getViewAttrs():Array<string> {
        return this.layoutModel.getConcArgs().head('attrs').split(',');
    }

    getNumItemsInLockedGroups():number {
        return this.state.numItemsInLockedGroups;
    }

    private pushHistoryState(pageNum:number):void {
        const args = this.layoutModel.getConcArgs();
        args.set('fromp', pageNum);
        this.layoutModel.getHistory().pushState(
            'view', args, { pagination: true, pageNum });
    }

    /**
     * Reload data on current concordance page.
     * The returned promise passes URL argument matching
     * currently displayed data page.
     */
    private reloadPage(concId?:string):Observable<MultiDict<ConcServerArgs>> {
        return this.changePage(
            'customPage', this.state.currentPage, concId ? `~${concId}` : undefined);
    }

    private pageIsInRange(num:number):boolean {
        return this.state.pagination.firstPage <= num && num <= this.state.pagination.lastPage;
    }

    private pageNumIsValid(num:number):boolean {
        return !isNaN(num) && Math.round(num) === num;
    }

    /**
     * Changes current data page - either by moving <--, <-, ->, --> or
     * by entering a specific page number.
     * The returned promise passes URL argument matching
     * currently displayed data page.
     */
    private changePage(
        action:string, pageNumber?:number, concId?:string
    ):Observable<MultiDict<ConcServerArgs>> {
        const pageNum:number = action === 'customPage' ?
            pageNumber : this.state.pagination[action];
        if (!this.pageNumIsValid(pageNum) || !this.pageIsInRange(pageNum)) {
            return throwError(new Error(this.layoutModel.translate(
                'concview__invalid_page_num_err')));
        }

        const args = this.layoutModel.getConcArgs();
        args.set('fromp', pageNum);
        args.set('format', 'json');
        if (concId) {
            args.set('q', concId);
        }

        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('view'),
            args

        ).pipe(
            tap(update => {
                this.importData(update);
                this.changeState(state => {
                    state.currentPage = pageNum
                });
            }),
            map(_ => this.layoutModel.getConcArgs())
        );
    }

    private importData(data:AjaxConcResponse):void {
        this.changeState(state => {
            state.lines = importLines(
                data.Lines,
                this.getViewAttrs().indexOf(this.state.baseViewAttr) - 1
            );
            state.numItemsInLockedGroups = data.num_lines_in_groups;
            state.pagination = data.pagination;
            state.unfinishedCalculation = !!data.running_calc;
            state.lineGroupIds = [];
        });
    }

    private changeGroupNaming(state:ConcordanceModelState, data:ConcGroupChangePayload):void {
        state.lines = List.map(
            line => ({
                ...line,
                lineGroup: line.lineGroup === data.prevId ?
                    data.newId : line.lineGroup}),
            state.lines
        );
        state.numItemsInLockedGroups = data.numLinesInGroups;
        state.lineGroupIds = data.lineGroupIds;
    }

    private changeViewMode():Observable<any> {
        let mode:string;
        if (this.state.corporaColumns.length > 1) {
            mode = {'align': 'kwic', 'kwic': 'align'}[this.state.viewMode];

        } else {
            mode = {'sen': 'kwic', 'kwic': 'sen'}[this.state.viewMode];
        }
        this.changeState(state => {state.viewMode = mode});
        this.layoutModel.replaceConcArg('viewmode', [this.state.viewMode]);
        const args = this.layoutModel.getConcArgs();
        args.set('format', 'json');

        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('view'),
            args

        ).pipe(
            tap((data) => {
                this.importData(data);
            })
        );
    }

    private createAudioLink(textChunk:TextChunk):string {
        const tmp = textChunk.openLink || textChunk.closeLink;
        if (tmp) {
            return this.layoutModel.createActionUrl(
                'audio',
                [['corpname', this.state.baseCorpname], ['chunk', tmp.speechPath]]
            );

        } else {
            return null;
        }
    }

    private changeMainCorpus(corpusId:string) {
        const args = this.layoutModel.getConcArgs() as MultiDict<SwitchMainCorpServerArgs>;
        if (this.state.kwicCorps.indexOf(corpusId) > -1) {
            args.set('maincorp', corpusId);
            args.set('viewmode', 'align');
            this.layoutModel.setLocationPost(
                this.layoutModel.createActionUrl('switch_main_corp', args.items()), []);

        } else {
            throw new Error('Cannot set corpus as main - no KWIC');
        }
    }

    private findActiveLineIdx(chunkId:string):number {
        for (let i = 0; i < this.state.lines.length; i += 1) {
            for (let j = 0; j < this.state.lines[i].languages.length; j += 1) {
                if (this.state.lines[i].languages[j].findChunk(chunkId)) {
                    return i;
                }
            }
        }
        return -1;
    }

    private findChunks(...chunkIds:Array<string>):Array<TextChunk> {
        for (let i = 0; i < this.state.lines.length; i += 1) {
            for (let j = 0; j < this.state.lines[i].languages.length; j += 1) {
                const ans = pipe(
                    chunkIds,
                    List.map(c => this.state.lines[i].languages[j].findChunk(c)),
                    List.filter(v => v !== undefined)
                );
                if (ans.length > 0) {
                    return ans;
                }
            }
        }
        return [];
    }

    private playAudio(chunksIds:Array<string>):void {
        this.setStopStatus(); // stop anything playing right now
        const activeChunkId = chunksIds[chunksIds.length - 1];
        this.changeState(state => {state.playerAttachedChunk = activeChunkId});
        // let's get an active line - there can be only one even if we play multiple chunks
        const activeLine = this.findActiveLineIdx(activeChunkId);
        const fakeChangedLine = this.state.lines[activeLine];
        this.changeState(state => {state.lines[activeLine] = fakeChangedLine});

        const playChunks = this.findChunks(...chunksIds);
        if (playChunks.length > 0) {
            playChunks[playChunks.length - 1].showAudioPlayer = true
            this.audioPlayer.start(pipe(
                playChunks,
                List.map(item => this.createAudioLink(item)),
                List.filter(item => !!item)
            ));

        } else {
            throw new Error('No chunks to play');
        }
    }

    private setStopStatus():void {
        if (this.state.playerAttachedChunk) {
            this.audioPlayer.stop();
            const playingLineIdx = this.findActiveLineIdx(this.state.playerAttachedChunk);
            const modLine = this.state.lines[playingLineIdx]; // TODO clone?
            this.changeState(state => {state.lines[playingLineIdx] = modLine});
            const playingChunk = this.findChunks(this.state.playerAttachedChunk)[0];
            if (playingChunk) {
                playingChunk.showAudioPlayer = false;
                this.changeState(state => {state.playerAttachedChunk = null});

            } else {
                throw new Error(`Failed to find playing chunk "${this.state.playerAttachedChunk}"`);
            }
        }
    }

    private handlePlayerControls(action:AudioPlayerActions) {
        switch (action) {
            case 'play':
                this.audioPlayer.play();
            break;
            case 'pause':
                this.audioPlayer.pause();
            break;
            case 'stop':
                this.audioPlayer.stop();
                this.setStopStatus();
            break;
        }
    }

    private calculateAdHocIpm():Observable<number> {
        const selections = this.ttModel.exportSelections(false);
        const args = new MultiDict();
        args.set('corpname', this.state.baseCorpname);
        for (let p in selections) {
            args.replace(`sca_${p}`, selections[p]);
        }
        return this.layoutModel.ajax$<AjaxResponse.WithinMaxHits>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('ajax_get_within_max_hits'),
            args

        ).pipe(
            tap((data) => {
                this.changeState(state => {
                    state.adHocIpm = this.state.concSummary.fullSize / data.total * 1e6});
            }),
            map(_ => this.state.adHocIpm)
        );
    }

    isUnfinishedCalculation():boolean {
        return this.state.unfinishedCalculation;
    }

    getPagination():ServerPagination {
        return this.state.pagination;
    }

    getCurrentPage():number {
        return this.state.currentPage;
    }

    private resetLineFocus(state:ConcordanceModelState):void {
        state.lines = List.map(
            item => {
                if (item.hasFocus) {
                    return {...item, hasFocus: false};
                }
                return item;
            },
            state.lines
        );
    }

    private setLineFocus(state:ConcordanceModelState, lineIdx:number, focus:boolean):void {
        this.resetLineFocus(state);
        state.lines[lineIdx].hasFocus = focus;
    }

    getConcSummary():ConcSummary {
        return this.state.concSummary;
    }

    getAudioPlayerStatus():AudioPlayerStatus {
        return this.audioPlayer.getStatus();
    }

    getSaveModel():ConcSaveModel {
        return this.saveModel;
    }

    getSyntaxViewModel():PluginInterfaces.SyntaxViewer.IPlugin {
        return this.syntaxViewModel;
    }

    // TODO pick a good heuristics here
    getRecommOverviewMinFreq():number {
        if (this.state.concSummary.concSize > 10000) {
            return 100;

        } else if (this.state.concSummary.concSize > 1000) {
            return 10;
        }
        return 1;
    }
}

