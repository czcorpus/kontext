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
import { List, pipe, HTTP, tuple } from 'cnc-tskit';

import { TextTypes, ViewOptions } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PluginInterfaces } from '../../types/plugins';
import { MultiDict } from '../../multidict';
import { PageModel } from '../../app/page';
import { ConclineSectionOps } from './line';
import { AudioPlayer, AudioPlayerStatus} from './media';
import { ConcSaveModel } from './save';
import { Actions as ViewOptionsActions, ActionName as ViewOptionsActionName }
    from '../options/actions';
import { CorpColumn, ConcSummary, ViewConfiguration, AudioPlayerActions, AjaxConcResponse,
    ServerPagination, ServerLineData, ServerTextChunk, LineGroupId, attachColorsToIds,
    mapIdToIdWithColors, Line, TextChunk, IConcLinesProvider, KWICSection, PaginationActions} from './common';
import { Actions, ActionName, ConcGroupChangePayload,
    PublishLineSelectionPayload } from './actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { SwitchMainCorpServerArgs } from '../query/common';

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
        line.push(ConclineSectionOps.newKWICSection(
            item.toknum,
            item.linenum,
            item.ref,
            List.map((v, j) => importTextChunk(v, `C${i}:L${j}`), item.Left),
            List.map((v, j) => importTextChunk(v, `C${i}:K${j}`), item.Kwic),
            List.map((v, j) => importTextChunk(v, `C${i}:R${j}`), item.Right)
        ));

        line = line.concat((item.Align || []).map((item, k) => {
            return ConclineSectionOps.newKWICSection(
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

    concId:string;

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

    forceScroll:number|null;
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

    /**
     * Note: substitutes "isBusy". Also compare with unfinishedCalculation.
     */
    private busyTimer:Subscription;

    private readonly runBusyTimer:(currTimer:Subscription)=>Subscription;

    constructor(
        layoutModel:PageModel,
        dispatcher:IFullActionControl,
        saveModel:ConcSaveModel,
        syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin,
        lineViewProps:ViewConfiguration,
        initialData:Array<ServerLineData>,
        providesAdHocIpm:boolean
    ) {
        const viewAttrs = layoutModel.exportConcArgs().head('attrs').split(',');
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
                providesAdHocIpm,
                concSummary: lineViewProps.concSummary,
                concId: layoutModel.getConf<string>('concPersistenceOpId'),
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
                syntaxViewVisible: false,
                forceScroll: null
            }
        );
        this.layoutModel = layoutModel;
        this.saveModel = saveModel;
        this.syntaxViewModel = syntaxViewModel;
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
        this.busyTimer = lineViewProps.Unfinished ? this.runBusyTimer(this.busyTimer) : null;

        this.addActionHandler<Actions.AddedNewOperation>(
            ActionName.AddedNewOperation,
            action => {
                if (action.error) {
                    this.changeState(state => {
                        state.unfinishedCalculation = false;
                    });

                } else {
                    this.layoutModel.updateConcPersistenceId(action.payload.data.conc_persistence_op_id);
                    this.changeState(state => {
                        this.importData(state, action.payload.data);
                        if (action.payload.changeMaincorp) {
                            state.maincorp = action.payload.changeMaincorp;
                        }
                        state.unfinishedCalculation = false;
                    });
                    this.pushHistoryState({
                        name: ActionName.ReloadConc,
                        payload: {
                            concId: action.payload.data.conc_persistence_op_id
                        }
                    });
                }
            }
        );

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
            }
        );

        this.addActionHandler<Actions.AudioPlayerClickControl>(
            ActionName.AudioPlayerClickControl,
            action => {
                this.handlePlayerControls(action.payload.action);
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.ChangePage, Actions.ReloadConc>(
            [
                ActionName.ChangePage,
                ActionName.ReloadConc
            ],
            action => {
                forkJoin([
                    this.suspend({}, (action, syncData) => {
                        return action.name === ActionName.PublishStoredLineSelections ?
                            null : syncData;
                    }).pipe(
                        map(v => (v as Actions.PublishStoredLineSelections).payload)
                    ),
                    Actions.isReloadConc(action) ?
                        this.loadConcPage(action.payload.concId) :
                        this.changePage(action.payload.action, action.payload.pageNum)

                ]).pipe(
                    tap(([wakePayload,]) => {
                        this.applyLineSelections(wakePayload);
                    })

                ).subscribe({
                    next: ([,[,pageNum]]) => {
                        if (!action.payload.isPopState) {
                            this.pushHistoryState({
                                name: ActionName.ChangePage,
                                payload: {
                                    action: 'customPage',
                                    pageNum
                                }
                            });
                        }
                        this.emitChange();
                    },
                    error: (err) => {
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler<Actions.LineSelectionResetOnServer>(
            ActionName.LineSelectionResetOnServer,
            action => {
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.LineSelectionResetOnServerDone ?
                        null : syncData;

                }).pipe(
                    concatMap(v => this.loadConcPage())

                ).subscribe(
                    ([concId,]) => {
                        this.pushHistoryState({
                            name: ActionName.ReloadConc,
                            payload: {
                                concId
                            }
                        });
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
                            () => {
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
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.CalculateIpmForAdHocSubcReady ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        (action) => this.calculateAdHocIpm(
                            (action as Actions.CalculateIpmForAdHocSubcReady).payload.ttSelection)
                    )

                ).subscribe(
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
                    this.loadConcPage().subscribe(
                        ([concId,]) => {
                            this.pushHistoryState({
                                name: ActionName.ReloadConc,
                                payload: {
                                    concId
                                }
                            });
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
                    this.loadConcPage().subscribe(
                        ([concId,]) => {
                            this.pushHistoryState({
                                name: ActionName.ReloadConc,
                                payload: {
                                    concId
                                }
                            });
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            }
        );

        this.addActionHandler<Actions.SetLineSelectionMode>(
            ActionName.SetLineSelectionMode,
            action => {
                this.changeState(state => {
                    state.forceScroll = null;
                });
            }
        );

        this.addActionHandler<Actions.LineSelectionReset>(
            ActionName.LineSelectionReset,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.pageYOffset;
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
                        state.forceScroll = window.pageYOffset;
                        state.numItemsInLockedGroups = 0;
                        state.lineGroupIds = [];
                        state.lineSelOptionsVisible = false;
                    });
                }
            }
        );

        this.addActionHandler<MainMenuActions.ShowSaveForm, Actions.ResultCloseSaveForm>(
            [MainMenuActionName.ShowSaveForm, ActionName.ResultCloseSaveForm],
            action => {
                this.changeState(state => {
                    state.forceScroll = window.pageYOffset;
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
                    state.forceScroll = window.pageYOffset;
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
                    state.forceScroll = window.pageYOffset;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<Actions.ResetDetail>(
            ActionName.ResetDetail,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = false;
                    state.forceScroll = window.pageYOffset;
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
                    state.forceScroll = window.pageYOffset;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<Actions.RefResetDetail>(
            ActionName.RefResetDetail,
            action => {
                this.changeState(state => {
                    state.refDetailVisible = false;
                    state.forceScroll = window.pageYOffset;
                    this.resetLineFocus(state);
                });
            }
        );

        this.addActionHandler<Actions.SelectLines>(
            ActionName.SelectLine,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.pageYOffset;
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
                    state.forceScroll = window.pageYOffset;
                    state.lineSelOptionsVisible = !state.lineSelOptionsVisible;
                });
            }
        );

        this.addActionHandler<Actions.MarkLinesDone>(
            ActionName.MarkLinesDone,
            action => {
                if (!action.error) {
                    this.loadConcPage(action.payload.data.conc_persistence_op_id).subscribe(
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
            state.forceScroll = window.pageYOffset;
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
        return this.layoutModel.exportConcArgs().head('attrs').split(',');
    }

    getNumItemsInLockedGroups():number {
        return this.state.numItemsInLockedGroups;
    }

    private pushHistoryState(action:Actions.ChangePage|Actions.ReloadConc):void {
        const args = this.layoutModel.exportConcArgs();
        if (Actions.isChangePage(action)) {
            args.set('fromp', action.payload.pageNum);
        }
        args.set('q', '~' + this.state.concId);
        const onPopStateAction = {
            name: action.name,
            payload: {...action.payload, isPopState: true}
        };
        this.layoutModel.getHistory().pushState('view', args, {onPopStateAction});
    }

    /**
     * Reload data on current concordance page.
     * The returned promise passes URL argument matching
     * currently displayed data page.
     *
     * @param concId if non-empty then a specific concordance is loaded
     * @return a 2-tuple [actual conc. ID, page num]
     */
    private loadConcPage(concId?:string):Observable<[string, number]> {
        return this.changePage('customPage', 1, concId ? `~${concId}` : undefined);
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
     *
     * @return a 2-tuple [concordance ID, actual page number]
     */
    private changePage(
        action:PaginationActions, pageNumber?:number, concId?:string
    ):Observable<[string, number]> {
        const pageNum:number = action === 'customPage' ?
            pageNumber : this.state.pagination[action];
        if (!this.pageNumIsValid(pageNum) || !this.pageIsInRange(pageNum)) {
            return throwError(new Error(this.layoutModel.translate(
                'concview__invalid_page_num_err')));
        }

        const args = this.layoutModel.getConcArgs();
        args.fromp = pageNum;
        args.format = 'json';
        if (concId) {
            args.q = concId;
        }

        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('view'),
            args

        ).pipe(
            tap(
                update => {
                    this.changeState(state => {
                        this.importData(state, update);
                        state.currentPage = pageNum;
                        state.lineGroupIds = attachColorsToIds(
                            update.lines_groups_numbers,
                            v => v,
                            mapIdToIdWithColors
                        );
                    });
                }
            ),
            map(resp => tuple(resp.conc_persistence_op_id, pageNum))
        );
    }

    private importData(state:ConcordanceModelState, data:AjaxConcResponse):void {
        state.lines = importLines(
            data.Lines,
            this.getViewAttrs().indexOf(state.baseViewAttr) - 1
        );
        state.kwicCorps = data.KWICCorps;
        state.numItemsInLockedGroups = data.num_lines_in_groups;
        state.pagination = data.pagination;
        state.unfinishedCalculation = !!data.running_calc;
        state.lineGroupIds = [];
        state.adHocIpm = -1;
        state.concId = data.conc_persistence_op_id;
        state.concSummary = {
            concSize: data.concsize,
            fullSize: data.fullsize,
            sampledSize: data.sampled_size,
            ipm: data.result_relative_freq,
            arf: data.result_arf,
            isShuffled: data.result_shuffled
        };
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
        const args = this.layoutModel.exportConcArgs();
        args.set('q', '~' + this.state.concId);
        args.set('format', 'json');

        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('view'),
            args

        ).pipe(
            tap(
                data => {
                    this.changeState(state => {
                        this.importData(state, data);
                    });
                }
            )
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
        const args = this.layoutModel.exportConcArgs() as MultiDict<SwitchMainCorpServerArgs>;
        if (this.state.kwicCorps.indexOf(corpusId) > -1) {
            args.set('maincorp', corpusId);
            args.set('viewmode', 'align');
            args.set('q', '~' + this.state.concId);
            this.layoutModel.setLocationPost(
                this.layoutModel.createActionUrl('switch_main_corp', args.items()), []);

        } else {
            throw new Error('Cannot set corpus as main - no KWIC');
        }
    }

    private findActiveLineIdx(state:ConcordanceModelState):number {
        for (let i = 0; i < state.lines.length; i += 1) {
            for (let j = 0; j < state.lines[i].languages.length; j += 1) {
                if (ConclineSectionOps.findChunk(state.lines[i].languages[j], state.playerAttachedChunk)) {
                    return i;
                }
            }
        }
        return -1;
    }

    private findChunks(state:ConcordanceModelState, ...chunkIds:Array<string>):Array<TextChunk> {
        for (let i = 0; i < state.lines.length; i += 1) {
            for (let j = 0; j < state.lines[i].languages.length; j += 1) {
                const ans = pipe(
                    chunkIds,
                    List.map(c => ConclineSectionOps.findChunk(state.lines[i].languages[j], c)),
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
        const activeChunkId = List.last(chunksIds);
        this.changeState(state => {
            state.playerAttachedChunk = activeChunkId;
            // let's get an active line - there can be only one even if we play multiple chunks
            const activeLine = this.findActiveLineIdx(state);
            const fakeChangedLine = state.lines[activeLine];
            state.lines[activeLine] = fakeChangedLine
            const playChunks = this.findChunks(state, ...chunksIds);
            if (!List.empty(playChunks)) {
                List.last(playChunks).showAudioPlayer = true

            } else {
                throw new Error('No chunks to play');
            }
        });
        const playChunks = this.findChunks(this.state, ...chunksIds);
        if (!List.empty(playChunks)) {
            this.audioPlayer.start(pipe(
                playChunks,
                List.map(item => this.createAudioLink(item)),
                List.filter(item => !!item)
            ));
        }
    }

    private setStopStatus():void {
        if (this.state.playerAttachedChunk) {
            this.audioPlayer.stop();
            this.changeState(
                state => {
                    const playingLineIdx = this.findActiveLineIdx(state);
            const modLine = this.state.lines[playingLineIdx]; // TODO clone?
                    state.lines[playingLineIdx] = modLine;
                    const playingChunk = this.findChunks(state, this.state.playerAttachedChunk)[0];
                    if (playingChunk) {
                        playingChunk.showAudioPlayer = false;
                        this.changeState(state => {state.playerAttachedChunk = null});

                    } else {
                        throw new Error(`Failed to find playing chunk "${this.state.playerAttachedChunk}"`);
                    }
                }
            );
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

    private calculateAdHocIpm(ttSelection:TextTypes.ExportedSelection):Observable<number> {
        return this.layoutModel.ajax$<AjaxResponse.WithinMaxHits>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'get_adhoc_subcorp_size'
            ),
            {
                corpname: this.state.baseCorpname,
                usesubcorp: this.state.subCorpName,
                ...this.layoutModel.getConcArgs(),
                type:'adHocIpmArgs',
                text_types: ttSelection
            },
            {
                contentType: 'application/json'
            }

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

