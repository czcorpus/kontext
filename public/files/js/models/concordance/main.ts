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

import { ViewOptions } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { MultiDict } from '../../multidict';
import { PageModel } from '../../app/page';
import { ConclineSectionOps } from './line';
import { AudioPlayer, PlayerStatus} from './media';
import { ConcSaveModel } from './save';
import { Actions as ViewOptionsActions } from '../options/actions';
import { CorpColumn, ViewConfiguration, AudioPlayerActions, AjaxConcResponse,
    ServerPagination, ServerLineData, ServerTextChunk, LineGroupId, attachColorsToIds,
    mapIdToIdWithColors, Line, TextChunk, KWICSection, PaginationActions} from './common';
import { Actions, ConcGroupChangePayload,
    PublishLineSelectionPayload } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';
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

    concSize:number;

    concId:string;

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

    audioPlayerStatus:PlayerStatus;
}


/**
 *
 */
export class ConcordanceModel extends StatefulModel<ConcordanceModelState> {

    static AUDIO_PLAYER_ID:string = 'concPlayer';

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
                concSize: lineViewProps.concSummary.concSize,
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
                forceScroll: null,
                audioPlayerStatus: null
            }
        );
        this.layoutModel = layoutModel;
        this.saveModel = saveModel;
        this.syntaxViewModel = syntaxViewModel;
        this.audioPlayer = new AudioPlayer(
            this.layoutModel.createStaticUrl('misc/soundmanager2/'),
            () => {
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            },
            () => {
                this.setStopStatus();
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            },
            () => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY
                });
                this.audioPlayer.stop();
                this.setStopStatus();
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
                this.layoutModel.showMessage('error',
                        this.layoutModel.translate('concview__failed_to_play_audio'));
            },
            () => {
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus(),
                    state.forceScroll = window.scrollY
                });
            }
        );
        this.runBusyTimer = (currTimer:Subscription):Subscription => {
            if (currTimer) {
                currTimer.unsubscribe();
            }
            return interval(1000).subscribe(
                (idx) => {
                    dispatcher.dispatch<typeof Actions.DataWaitTimeInc>({
                        name: Actions.DataWaitTimeInc.name,
                        payload: {
                            idx
                        }
                    });
                }
            );
        };
        this.busyTimer = lineViewProps.Unfinished ? this.runBusyTimer(this.busyTimer) : null;

        this.addActionHandler<typeof Actions.AddedNewOperation>(
            Actions.AddedNewOperation.name,
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
                        name: Actions.ReloadConc.name,
                        payload: {
                            concId: action.payload.data.conc_persistence_op_id
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.ChangeMainCorpus>(
            Actions.ChangeMainCorpus.name,
            action => {
                this.changeMainCorpus(action.payload.maincorp);
                    // we leave the page here
            }
        );

        this.addActionHandler<typeof Actions.PlayAudioSegment>(
            Actions.PlayAudioSegment.name,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY;
                });
                this.playAudio(action.payload.chunksIds);
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.AudioPlayerClickControl>(
            Actions.AudioPlayerClickControl.name,
            action => action.payload.playerId === ConcordanceModel.AUDIO_PLAYER_ID,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY
                });
                this.handlePlayerControls(action.payload.action);
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            }
        );

        this.addActionSubtypeHandler<typeof Actions.AudioPlayerSetPosition>(
            Actions.AudioPlayerSetPosition.name,
            action => action.payload.playerId === ConcordanceModel.AUDIO_PLAYER_ID,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY
                });
                this.audioPlayer.setPosition(action.payload.offset);
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            }
        );

        this.addActionHandler<typeof Actions.AudioPlayersStop>(
            Actions.AudioPlayersStop.name,
            action => {
                this.handlePlayerControls('stop');
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            }
        );

        this.addActionHandler<typeof Actions.ChangePage, typeof Actions.ReloadConc>(
            [
                Actions.ChangePage.name,
                Actions.ReloadConc.name
            ],
            action => {
                forkJoin([
                    this.suspend({}, (action, syncData) => {
                        return action.name === Actions.PublishStoredLineSelections.name ?
                            null : syncData;
                    }).pipe(
                        map(v => (v as typeof Actions.PublishStoredLineSelections).payload)
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
                                name: Actions.ChangePage.name,
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

        this.addActionHandler<typeof Actions.LineSelectionResetOnServer>(
            Actions.LineSelectionResetOnServer.name,
            action => {
                this.suspend({}, (action, syncData) => {
                    return action.name === Actions.LineSelectionResetOnServerDone.name ?
                        null : syncData;

                }).pipe(
                    concatMap(v => this.loadConcPage())

                ).subscribe(
                    ([concId,]) => {
                        this.pushHistoryState({
                            name: Actions.ReloadConc.name,
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

        this.addActionHandler<typeof Actions.LineSelectionResetOnServerDone>(
            Actions.LineSelectionResetOnServerDone.name,
            action => {
                this.changeState(state => {
                    state.lineSelOptionsVisible = false;
                });
            }
        );

        this.addActionHandler<typeof Actions.AsyncCalculationUpdated>(
            Actions.AsyncCalculationUpdated.name,
            action => {
                const prevConcSize = this.state.concSize;
                this.changeState(state => {
                    state.unfinishedCalculation = !action.payload.finished;
                    state.concSize = action.payload.concsize;
                    state.pagination.lastPage = action.payload.availPages;
                });
                if (this.state.concSize > 0) {
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

        this.addActionHandler<typeof Actions.AsyncCalculationFailed>(
            Actions.AsyncCalculationFailed.name,
            action => {
                this.busyTimer = this.stopBusyTimer(this.busyTimer);
                this.changeState(state => {
                    state.unfinishedCalculation = false;
                    state.pagination.lastPage = 0;
                    state.lines = [];
                });
            }
        );

        this.addActionHandler<typeof Actions.ChangeLangVisibility>(
            Actions.ChangeLangVisibility.name,
            action => {
                this.changeColVisibility(action.payload.corpusId, action.payload.value);
                this.emitChange();
            }
        );

        this.addActionHandler<typeof Actions.SwitchKwicSentMode>(
            Actions.SwitchKwicSentMode.name,
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

        this.addActionHandler<typeof Actions.DataWaitTimeInc>(
            Actions.DataWaitTimeInc.name,
            action => {
                this.changeState(state => {state.busyWaitSecs = action.payload.idx});
            }
        );

        this.addActionHandler<typeof ViewOptionsActions.SaveSettingsDone>(
            ViewOptionsActions.SaveSettingsDone.name,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.baseViewAttr = action.payload.baseViewAttr;
                        state.attrViewMode = action.payload.attrVmode;
                    });
                    this.loadConcPage().subscribe({
                        next: ([concId,]) => {
                            this.pushHistoryState({
                                name: Actions.ReloadConc.name,
                                payload: {
                                    concId
                                }
                            });
                            this.emitChange();
                        },
                        error: err => {
                            this.layoutModel.showMessage('error', err);
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof ViewOptionsActions.GeneralSubmitDone>(
            ViewOptionsActions.GeneralSubmitDone.name,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.showLineNumbers = action.payload.showLineNumbers;
                        state.currentPage = 1;
                    });
                    this.loadConcPage().subscribe(
                        ([concId,]) => {
                            this.pushHistoryState({
                                name: Actions.ReloadConc.name,
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

        this.addActionHandler<typeof Actions.SetLineSelectionMode>(
            Actions.SetLineSelectionMode.name,
            action => {
                this.changeState(state => {
                    state.forceScroll = null;
                });
            }
        );

        this.addActionHandler<typeof Actions.LineSelectionReset>(
            Actions.LineSelectionReset.name,
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

        this.addActionHandler<typeof Actions.UnlockLineSelectionDone>(
            Actions.UnlockLineSelectionDone.name,
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

        this.addActionHandler<typeof MainMenuActions.ShowSaveForm, typeof Actions.ResultCloseSaveForm>(
            [MainMenuActions.ShowSaveForm.name, Actions.ResultCloseSaveForm.name],
            action => {
                this.changeState(state => {
                    state.forceScroll = window.pageYOffset;
                    state.saveFormVisible = action.name === MainMenuActions.ShowSaveForm.name
                });
            }
        );

        this.addActionHandler<typeof Actions.ShowKwicDetail>(
            Actions.ShowKwicDetail.name,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = true;
                    state.refDetailVisible = false;
                    state.forceScroll = window.pageYOffset;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<typeof Actions.ShowTokenDetail>(
            Actions.ShowTokenDetail.name,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = true;
                    state.refDetailVisible = false;
                    state.forceScroll = window.pageYOffset;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<typeof Actions.ResetDetail>(
            Actions.ResetDetail.name,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = false;
                    state.forceScroll = window.pageYOffset;
                    this.resetLineFocus(state);
                });
            }
        );

        this.addActionHandler<typeof Actions.ShowRefDetail>(
            Actions.ShowRefDetail.name,
            action => {
                this.changeState(state => {
                    state.refDetailVisible = true;
                    state.kwicDetailVisible = false;
                    state.forceScroll = window.pageYOffset;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler<typeof Actions.RefResetDetail>(
            Actions.RefResetDetail.name,
            action => {
                this.changeState(state => {
                    state.refDetailVisible = false;
                    state.forceScroll = window.pageYOffset;
                    this.resetLineFocus(state);
                });
            }
        );

        this.addActionHandler<typeof Actions.SelectLine>(
            Actions.SelectLine.name,
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

        this.addActionHandler<typeof Actions.ApplyStoredLineSelectionsDone>(
            Actions.ApplyStoredLineSelectionsDone.name,
            action => {
                this.applyLineSelections(action.payload);
            }
        );

        this.addActionHandler<typeof Actions.ToggleLineSelOptions>(
            Actions.ToggleLineSelOptions.name,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.pageYOffset;
                    state.lineSelOptionsVisible = !state.lineSelOptionsVisible;
                });
            }
        );

        this.addActionHandler<typeof Actions.MarkLinesDone>(
            Actions.MarkLinesDone.name,
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

        this.addActionHandler<typeof Actions.RenameSelectionGroupDone>(
            Actions.RenameSelectionGroupDone.name,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.changeGroupNaming(state, action.payload);
                        state.lineSelOptionsVisible = false;
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.ShowSyntaxView>(
            Actions.ShowSyntaxView.name,
            action => {
                this.changeState(state => {
                    state.syntaxViewVisible = true;
                });
            }
        );

        this.addActionHandler<typeof Actions.CloseSyntaxView>(
            Actions.CloseSyntaxView.name,
            action => {
                this.changeState(state => {
                    state.syntaxViewVisible = false;
                });
            }
        );

        this.addActionHandler<typeof Actions.HideAnonymousUserWarning>(
            Actions.HideAnonymousUserWarning.name,
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

    private pushHistoryState(action:typeof Actions.ChangePage|typeof Actions.ReloadConc):void {
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
        state.concId = data.conc_persistence_op_id;
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

    private createAudioLink(endpoint:'audio'|'audio_waveform', textChunk:TextChunk):string {
        const tmp = textChunk.openLink || textChunk.closeLink;
        if (tmp) {
            return this.layoutModel.createActionUrl(
                endpoint,
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
            this.audioPlayer.start(
                pipe(
                    playChunks,
                    List.map(item => this.createAudioLink('audio', item)),
                    List.filter(item => !!item)
                ),
                pipe(
                    playChunks,
                    List.map(item => this.createAudioLink('audio_waveform', item)),
                    List.filter(item => !!item)
                )
            );
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

    getAudioPlayerStatus():PlayerStatus {
        return this.audioPlayer.getStatus();
    }

    getSaveModel():ConcSaveModel {
        return this.saveModel;
    }

    getSyntaxViewModel():PluginInterfaces.SyntaxViewer.IPlugin {
        return this.syntaxViewModel;
    }
}

