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

import { ExtractPayload, IFullActionControl, StatefulModel } from 'kombo';
import { throwError, Observable, interval, Subscription, forkJoin } from 'rxjs';
import { tap, map, concatMap } from 'rxjs/operators';
import { List, pipe, HTTP, tuple, Dict, Rx } from 'cnc-tskit';
import copy from 'copy-to-clipboard';
import * as ViewOptions from '../../types/viewOptions.js';
import { PageModel } from '../../app/page.js';
import { ConclineSectionOps } from './line.js';
import { AudioPlayer, PlayerStatus } from './media.js';
import { ConcSaveModel } from './save.js';
import { Actions as ViewOptionsActions } from '../options/actions.js';
import { CorpColumn, ViewConfiguration, AudioPlayerActions, AjaxConcResponse,
    ServerPagination, ServerLineData, LineGroupId, attachColorsToIds,
    mapIdToIdWithColors, Line, TextChunk, PaginationActions, ConcViewMode,
    HighlightWords, ConcQueryResponse, KWICSection} from './common.js';
import { Actions, ConcGroupChangePayload,
    PublishLineSelectionPayload } from './actions.js';
import { Actions as MainMenuActions } from '../mainMenu/actions.js';
import { Block } from '../freqs/common.js';
import { highlightConcLineTokens, importLines } from './transform.js';

/**
 * HighlightAttrMatch specifies a single global (per page)
 * tokens highlight operation based on a provided value and
 * attribute name.
 *
 * Please do not confuse this with tokens_linking hihglighting
 * which is based on token clicking and always targeted to
 * specifiec token IDs.
 */
export interface HighlightAttrMatch {

    /**
     * level specifies target lang./corp. column for highlighting:
     *  -  0: first corpus,
     *  -  1: second corpus,
     *  -  N: (N+1)th corpus
     *  - -1: all corpora
     */
    level:number;

    checked:boolean;

    loaded:boolean;

    value:string;

    /**
     * attr specifies a kwic_connect pos. attribute data is based on
     */
    attr:string;
}

/**
 *
 * @param current
 * @param incoming
 * @param incomingLoaded if false then the 'loaded' status is taken
 *  from 'current' else from 'incoming'
 * @returns
 */
export function mergeHighlightItems(
    current:Array<HighlightAttrMatch>,
    incoming:Array<HighlightAttrMatch>,
    incomingLoaded:boolean
):Array<HighlightAttrMatch> {

    return pipe(
        [...current, ...incoming],
        List.groupBy(
            x => `${x.attr}#${x.value}`
        ),
        List.map(
            ([, hi]) => ({
                ...List.last(hi),
                loaded: incomingLoaded ?
                    List.last(hi).loaded :
                    List.head(hi).loaded
            })
        )
    );
}


/**
 *
 */
export interface ConcordanceModelState {

    lines:Array<Line>;

    highlightWordsStore:{[posAttr:string]:HighlightWords};

    highlightedMatches:Array<HighlightAttrMatch>;

    /**
     * a concordance ID the highlight was loaded for (=> if conc is changed, we have to reload highlights too)
     */
    highlightedMatchConcId:string|undefined;

    viewMode:ConcViewMode;

    refMaxWidth:number;

    attrViewMode:ViewOptions.AttrViewMode;

    showLineNumbers:boolean;

    kwicCorps:Array<string>;

    corporaColumns:Array<CorpColumn>;

    baseCorpname:string;

    maincorp:string; // primary corpus in alignent mode (can be different from baseCorpname)

    subcId:string;

    subcName:string;

    playerAttachedLink:string|null;

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

    supportsTokensLinking:boolean;

    emptyRefValPlaceholder:string;

    saveFormVisible:boolean;

    kwicDetailVisible:boolean;

    refDetailVisible:boolean;

    lineSelOptionsVisible:boolean;

    lineGroupIds:Array<LineGroupId>;

    syntaxViewVisible:boolean;

    forceScroll:number|null;

    audioPlayerStatus:PlayerStatus;

    mergedAttrs:Array<[string, number]>;

    mergedCtxAttrs:Array<[string, number]>;

    alignCommonPosAttrs:Array<string>;

    alignAttrsMismatchModalVisible:boolean;

    tokenLinks:Array<{
        [tokenId:string]:{
            color:string;
            lineId:number;
            comment?:string
        }
    }>;

    textDirectionRTL:boolean;

    shareLinkProps:{url:string}|null;
}


/**
 *
 */
export class ConcordanceModel extends StatefulModel<ConcordanceModelState> {

    static AUDIO_PLAYER_ID:string = 'concPlayer';

    private readonly layoutModel:PageModel;

    private readonly saveModel:ConcSaveModel;

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
        lineViewProps:ViewConfiguration,
        initialData:Array<ServerLineData>,
    ) {
        const viewAttrs = layoutModel.getConcArgs().attrs;
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
                subcId: lineViewProps.subcId,
                subcName: lineViewProps.subcName,
                unfinishedCalculation: lineViewProps.Unfinished,
                concSize: lineViewProps.concSummary.concSize,
                concId: layoutModel.getConf<string>('concPersistenceOpId'),
                baseViewAttr: lineViewProps.baseViewAttr,
                lines: importLines(initialData, viewAttrs.indexOf(lineViewProps.baseViewAttr) - 1, lineViewProps.mergedAttrs, lineViewProps.mergedCtxAttrs),
                highlightWordsStore: {},
                highlightedMatches: [],
                highlightedMatchConcId: null,
                viewAttrs,
                refMaxWidth: lineViewProps.RefMaxWidth,
                numItemsInLockedGroups: lineViewProps.NumItemsInLockedGroups,
                pagination: lineViewProps.pagination, // TODO possible mutable mess
                currentPage: lineViewProps.currentPage || 1,
                useSafeFont: lineViewProps.useSafeFont,
                busyWaitSecs: 0,
                supportsSyntaxView: lineViewProps.supportsSyntaxView,
                playerAttachedLink: null,
                showAnonymousUserWarn: lineViewProps.anonymousUser,
                supportsTokenConnect: lineViewProps.supportsTokenConnect,
                supportsTokensLinking: lineViewProps.supportsTokensLinking,
                emptyRefValPlaceholder: 'N/A',
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
                audioPlayerStatus: null,
                mergedAttrs: lineViewProps.mergedAttrs,
                mergedCtxAttrs: lineViewProps.mergedAttrs,
                alignCommonPosAttrs: lineViewProps.alignCommonPosAttrs,
                alignAttrsMismatchModalVisible: !pipe(
                    lineViewProps.mergedAttrs,
                    List.filter(
                        ([item, _]) => List.findIndex(
                            item2 => item === item2, lineViewProps.alignCommonPosAttrs) === -1
                    ),
                    List.empty()
                ),
                tokenLinks: List.map(_ => ({}), lineViewProps.CorporaColumns),
                textDirectionRTL: layoutModel.getConf<boolean>('TextDirectionRTL'),
                shareLinkProps:null
            }
        );
        this.layoutModel = layoutModel;
        this.saveModel = saveModel;
        this.audioPlayer = new AudioPlayer(
            () => {
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus();
                    state.forceScroll = window.pageYOffset;
                });
            },
            () => {
                this.setStopStatus();
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus();
                });
            },
            (err) => {
                this.changeState(state => {
                    state.forceScroll = window.pageYOffset;
                });
                this.setStopStatus();
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus();
                });
                this.layoutModel.showMessage('error',
                        this.layoutModel.translate('concview__failed_to_play_audio'));
            },
            () => {
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus();
                    state.forceScroll = window.pageYOffset;
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

        this.addActionHandler(
            Actions.AddedNewOperation,
            action => {
                if (action.error) {
                    this.changeState(state => {
                        state.unfinishedCalculation = false;
                        state.playerAttachedLink = null;
                    });

                } else {
                    document.title = action.payload.data.page_title;
                    this.layoutModel.updateConcPersistenceId(action.payload.data.conc_persistence_op_id);
                    this.changeState(state => {
                        this.importData(state, action.payload.data);
                        if (action.payload.changeMaincorp) {
                            state.maincorp = action.payload.changeMaincorp;
                        }
                        state.unfinishedCalculation = false;
                        state.playerAttachedLink = null;
                        this.reapplyTokenLinkHighlights(state);
                    });
                    this.pushHistoryState({
                        name: Actions.ReloadConc.name,
                        payload: {
                            concId: action.payload.data.conc_persistence_op_id,
                            arf: action.payload.data.result_arf,
                            concSize: action.payload.data.concsize,
                            corpusIpm: action.payload.data.result_relative_freq,
                            fullSize: action.payload.data.fullsize,
                            queryChainSize: List.size(action.payload.data.query_overview)
                        }
                    });
                    Dict.forEach(
                        (_, kcAttr) => {
                            this.reloadAlignedHighlights(kcAttr, true);
                        },
                        this.state.highlightWordsStore
                    );
                }
            }
        );

        this.addActionHandler(
            Actions.ChangeMainCorpus,
            action => {
                this.changeMainCorpus(action.payload.maincorp);
                    // we leave the page here
            }
        );

        this.addActionHandler(
            Actions.PlayAudioSegment,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY;
                });
                this.playAudio(action.payload.linkIds);
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.AudioPlayerClickControl,
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

        this.addActionSubtypeHandler(
            Actions.AudioPlayerSetPosition,
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

        this.addActionHandler(
            Actions.AudioPlayersStop,
            action => {
                this.handlePlayerControls('stop');
                this.changeState(state => {
                    state.audioPlayerStatus = this.getAudioPlayerStatus()
                });
            }
        );

        this.addMultiActionHandler(
            [
                Actions.ChangePage,
                Actions.ReloadConc
            ],
            action => {
                if (Actions.isReloadConc(action) && action.payload.viewMode) {
                    this.changeState(state => {state.viewMode = action.payload.viewMode});
                }
                forkJoin([
                    this.waitForAction({}, (action, syncData) => {
                        return Actions.isPublishStoredLineSelections(action) ?
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
                        if (Actions.isReloadConc(action)) {
                            Dict.forEach(
                                (_, kcAttr) => {
                                    this.reloadAlignedHighlights(
                                        kcAttr,
                                        this.state.highlightedMatchConcId !== action.payload.concId
                                    );
                                },
                                this.state.highlightWordsStore
                            );

                            this.layoutModel.updateConcArgs({q: [action.payload.concId]});

                        } else {
                            Dict.forEach(
                                (_, kcAttr) => {
                                    this.reloadAlignedHighlights(kcAttr, false);
                                },
                                this.state.highlightWordsStore
                            );
                        }
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

        this.addActionHandler(
            Actions.LineSelectionResetOnServer,
            action => {
                this.waitForAction({}, (action, syncData) => {
                    return action.name === Actions.LineSelectionResetOnServerDone.name ?
                        null : syncData;

                }).pipe(
                    concatMap(v => this.loadConcPage())

                ).subscribe({
                    next: ([resp, ]) => {
                        this.pushHistoryState({
                            name: Actions.ReloadConc.name,
                            payload: {
                                concId: resp.conc_persistence_op_id,
                                arf: resp.result_arf,
                                concSize: resp.concsize,
                                fullSize: resp.fullsize,
                                corpusIpm: resp.result_relative_freq,
                                queryChainSize: List.size(resp.query_overview)
                            }
                        });
                        this.emitChange();
                    },
                    error: (err) => {
                        this.layoutModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addMultiActionHandler(
            [Actions.LineSelectionResetOnServerDone, Actions.SwitchFirstSelectPage],
            action => {
                this.changeState(state => {
                    state.lineSelOptionsVisible = false;
                });
            }
        );

        this.addActionHandler(
            Actions.AsyncCalculationUpdated,
            action => {
                const prevConcSize = this.state.concSize;
                this.changeState(state => {
                    state.unfinishedCalculation = !action.payload.finished;
                    state.concSize = action.payload.concsize;
                    state.pagination.lastPage = action.payload.availPages;
                });
                if (this.state.concSize > 0) {
                    if (prevConcSize === 0) {
                        this.changePage('customPage', 1).subscribe({
                            next: () => {
                                this.busyTimer = this.stopBusyTimer(this.busyTimer);
                                this.emitChange();
                            },
                            error: (err) => {
                                this.busyTimer = this.stopBusyTimer(this.busyTimer);
                                this.emitChange();
                                this.layoutModel.showMessage('error', err);
                            }
                        });

                    } else {
                        this.busyTimer = this.stopBusyTimer(this.busyTimer);
                    }
                    if (action.payload.finished) {
                        Dict.forEach(
                            (_, kcAttr) => {
                                this.reloadAlignedHighlights(kcAttr, true);
                            },
                            this.state.highlightWordsStore
                        );
                    }
                }
                this.emitChange();
            }
        );

        this.addActionHandler(
            Actions.AsyncCalculationFailed,
            action => {
                this.busyTimer = this.stopBusyTimer(this.busyTimer);
                this.changeState(state => {
                    state.unfinishedCalculation = false;
                    state.pagination.lastPage = 0;
                    state.lines = [];
                });
            }
        );

        this.addActionHandler(
            Actions.ChangeLangVisibility,
            action => {
                this.changeColVisibility(action.payload.corpusId, action.payload.value);
                this.emitChange();
            }
        );

        this.addActionHandler(
            Actions.SwitchKwicSentMode,
            action => {
                this.waitForAction({}, (action, syncData) => {
                    return Actions.isPublishStoredLineSelections(action) ?
                        null : syncData;
                }).pipe(
                    map(v => (v as typeof Actions.PublishStoredLineSelections).payload),
                    concatMap(
                        v => Rx.zippedWith(v, this.changeViewMode(v))
                    ),
                    tap(
                        ([_, selections]) => {
                            this.applyLineSelections(selections);
                        }
                    )
                ).subscribe({
                    next: () => {
                        this.emitChange();
                    },
                    error: (err) => {
                        console.error(err);
                        this.layoutModel.showMessage('error', err);
                        this.emitChange();
                    },
                    complete: () => {
                        Dict.forEach(
                            (_, kcAttr) => {
                                this.reloadAlignedHighlights(kcAttr, true);
                            },
                            this.state.highlightWordsStore
                        );
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.DataWaitTimeInc,
            action => {
                this.changeState(state => {state.busyWaitSecs = action.payload.idx});
            }
        );

        this.addActionHandler(
            ViewOptionsActions.SaveSettingsDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.baseViewAttr = action.payload.baseViewAttr;
                        state.attrViewMode = action.payload.attrVmode;
                    });
                    this.loadConcPage().subscribe({
                        next: ([resp,]) => {
                            this.pushHistoryState({
                                name: Actions.ReloadConc.name,
                                payload: {
                                    concId: resp.conc_persistence_op_id,
                                    arf: resp.result_arf,
                                    corpusIpm: resp.result_relative_freq,
                                    concSize: resp.concsize,
                                    fullSize: resp.fullsize,
                                    queryChainSize: List.size(resp.query_overview)
                                }
                            });
                            this.changeState(
                                state => {
                                    this.reevaluateAlignAttrsMismatch(state);
                                }
                            )
                        },
                        error: err => {
                            this.layoutModel.showMessage('error', err);
                        }
                    });
                }
            }
        );

        this.addActionHandler(
            ViewOptionsActions.GeneralSubmitDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.showLineNumbers = action.payload.showLineNumbers;
                        state.currentPage = 1;
                        state.refMaxWidth = action.payload.refMaxWidth;
                    });
                    this.loadConcPage().subscribe({
                        next: ([resp,]) => {
                            this.pushHistoryState({
                                name: Actions.ReloadConc.name,
                                payload: {
                                    concId: resp.conc_persistence_op_id,
                                    arf: resp.result_arf,
                                    corpusIpm: resp.result_relative_freq,
                                    concSize: resp.concsize,
                                    fullSize: resp.fullsize,
                                    queryChainSize: List.size(resp.query_overview),
                                }
                            });
                            this.emitChange();
                        },
                        error: (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    });
                    Dict.forEach(
                        (_, kcAttr) => {
                            this.reloadAlignedHighlights(kcAttr, true);
                        },
                        this.state.highlightWordsStore
                    );

                }
            }
        );

        this.addActionHandler(
            Actions.SetLineSelectionMode,
            action => {
                this.changeState(state => {
                    state.forceScroll = null;
                });
            }
        );

        this.addActionHandler(
            Actions.LineSelectionReset,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY;
                    state.lines = List.map(
                        v => ({...v, lineGroup: undefined}),
                        state.lines
                    );
                    state.lineSelOptionsVisible = false;
                });
            }
        );

        this.addActionHandler(
            Actions.UnlockLineSelectionDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.forceScroll = window.scrollY;
                        state.numItemsInLockedGroups = 0;
                        state.lineGroupIds = [];
                        state.lineSelOptionsVisible = false;
                    });
                }
            }
        );

        this.addMultiActionHandler(
            [
                MainMenuActions.ShowSaveForm,
                Actions.ResultCloseSaveForm
            ],
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY;
                    state.saveFormVisible = action.name === MainMenuActions.ShowSaveForm.name
                });
            }
        );

        this.addActionHandler(
            Actions.ShowKwicDetail,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = true;
                    state.refDetailVisible = false;
                    state.forceScroll = window.scrollY;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler(
            Actions.ShowTokenDetail,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = true;
                    state.refDetailVisible = false;
                    state.forceScroll = window.scrollY;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler(
            Actions.ResetDetail,
            action => {
                this.changeState(state => {
                    state.kwicDetailVisible = false;
                    state.forceScroll = window.scrollY;
                    this.resetLineFocus(state);
                });
            }
        );

        this.addActionHandler(
            Actions.ShowRefDetail,
            action => {
                this.changeState(state => {
                    state.refDetailVisible = true;
                    state.kwicDetailVisible = false;
                    state.forceScroll = window.scrollY;
                    this.setLineFocus(state, action.payload.lineIdx, true);
                });
            }
        );

        this.addActionHandler(
            Actions.RefResetDetail,
            action => {
                this.changeState(state => {
                    state.refDetailVisible = false;
                    state.forceScroll = window.scrollY;
                    this.resetLineFocus(state);
                });
            }
        );

        this.addActionHandler(
            Actions.SelectLine,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY;
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

        this.addActionHandler(
            Actions.ApplyStoredLineSelectionsDone,
            action => {
                this.applyLineSelections(action.payload);
            }
        );

        this.addActionHandler(
            Actions.ToggleLineSelOptions,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY;
                    state.lineSelOptionsVisible = !state.lineSelOptionsVisible;
                });
            }
        );

        this.addActionHandler(
            Actions.MarkLinesDone,
            action => {
                if (!action.error) {
                    this.loadConcPage(action.payload.data.conc_persistence_op_id).subscribe(
                        data => {
                            this.changeState(state => {
                                state.lineSelOptionsVisible = true;
                                state.lineGroupIds = action.payload.groupIds;
                            });
                        },
                        err => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            }
        );


        this.addActionHandler(
            Actions.RenameSelectionGroupDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.changeGroupNaming(state, action.payload);
                        state.lineSelOptionsVisible = false;
                    });
                }
            }
        );

        this.addActionHandler(
            Actions.ShowSyntaxView,
            action => {
                this.changeState(state => {
                    state.syntaxViewVisible = true;
                });
            }
        );

        this.addActionHandler(
            Actions.CloseSyntaxView,
            action => {
                this.changeState(state => {
                    state.syntaxViewVisible = false;
                });
            }
        );

        this.addActionHandler(
            Actions.HideAnonymousUserWarning,
            action => {
                this.changeState(state => {
                    state.showAnonymousUserWarn = false;
                });
            }
        );

        this.addActionHandler(
            Actions.HighlightAttrMatch,
            action => {
                this.changeState(state => {
                    state.forceScroll = window.scrollY;
                    state.highlightedMatches = mergeHighlightItems(
                        state.highlightedMatches,
                        action.payload.items,
                        false
                    );
                    if (!Dict.hasKey(action.payload.matchPosAttr, state.highlightWordsStore)) {
                        state.highlightWordsStore[action.payload.matchPosAttr] = {};
                    }
                });
                this.reloadAlignedHighlights(action.payload.matchPosAttr, false);
            }
        );

        this.addActionHandler(
            Actions.HighlightTokens,
            action => {
                this.changeState(state => {
                    state.forceScroll = action.payload.scrollY;
                    List.forEach(
                        h => {
                            const corpusIdx = List.findIndex(
                                v => v.n === h.corpusId,
                                this.state.corporaColumns
                            );
                            if (corpusIdx > -1) {
                                state.tokenLinks[corpusIdx][`${h.tokenId}`] = {
                                    color: h.color,
                                    lineId: h.lineId,
                                    comment: h.comment,
                                };
                                this.highlightTokenLink(
                                    state,
                                    corpusIdx,
                                    h.tokenId,
                                    h.color,
                                    h.isBusy
                                );
                            }
                        },
                        action.payload.highlights
                    );
                });
            },
        );

        this.addActionHandler(
            Actions.DehighlightTokens,
            action => {
                this.changeState(state => {
                    List.forEach(
                        h => {
                            const corpusIdx = List.findIndex(
                                v => v.n === h.corpusId,
                                this.state.corporaColumns
                            );
                            if (corpusIdx > -1) {
                                this.highlightTokenLink(
                                    state,
                                    corpusIdx,
                                    h.tokenId,
                                    null,
                                    false
                                );
                                delete state.tokenLinks[corpusIdx][`${h.tokenId}`];
                            }
                        },
                        action.payload.dehighlights
                    );
                });
            },
        );

        this.addActionHandler(
            MainMenuActions.MakeConcLinkPersistent,
            action => {
                this.layoutModel.ajax$(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        '/permanent_link',
                        {
                            conc_id: this.state.concId,
                            corpname: this.state.baseCorpname
                        }
                    ),
                    {}

                ).subscribe({
                    error: err => {
                        this.layoutModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ShareConcordanceLink,
            action => {
                this.changeState(
                    state => {
                        if (state.shareLinkProps === null) {
                            state.shareLinkProps = {
                                url: this.layoutModel.createActionUrl(
                                    '/view',
                                    {q: '~' + state.concId}
                                )
                            }

                        } else {
                            state.shareLinkProps = null;
                        }
                    }
                );
                this.layoutModel.ajax$(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        '/permanent_link',
                        {
                            conc_id: this.state.concId,
                            corpname: this.state.baseCorpname
                        }
                    ),
                    {}

                ).subscribe({
                    error: err => {
                        this.layoutModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.CopyConcordanceLink,
            action => {
                copy(this.layoutModel.createActionUrl(
                    '/view',
                    {q: `~${this.state.concId}`}
                ));
                this.layoutModel.showMessage(
                    'info',
                    this.layoutModel.translate('global__link_copied_to_clipboard')
                );
            }
        );

        this.addMultiActionHandler(
            [
                Actions.CloseAlignAttrsMismatchModal,
                ViewOptionsActions.UnsetAttributesAndSave
            ],
            action => {
                this.changeState(
                    state => {
                        state.alignAttrsMismatchModalVisible = false;
                    }
                );
            }
        );
    }

    private highlightTokenLink(
        state:ConcordanceModelState,
        corpusIdx:number,
        tokenId:number,
        color:string,
        isBusy:boolean,
    ) {
        pipe(
            state.lines,
            // find lines containing tokens with tokenId
            List.forEach(
                line => {
                    const lftSrch = List.find(
                        x => x.token.id === tokenId,
                        line.languages[corpusIdx].left
                    );
                    if (lftSrch) {
                        lftSrch.token.hColor = color;
                        lftSrch.token.hIsBusy = isBusy;
                    }
                    const kwicSrch = List.find(
                        x => x.token.id === tokenId,
                        line.languages[corpusIdx].kwic
                    );
                    if (kwicSrch) {
                        kwicSrch.token.hColor = color;
                        kwicSrch.token.hIsBusy = isBusy;
                    }
                    const rgtSrch = List.find(
                        x => x.token.id === tokenId,
                        line.languages[corpusIdx].right
                    );
                    if (rgtSrch) {
                        rgtSrch.token.hColor = color;
                        rgtSrch.token.hIsBusy = isBusy;
                    }
                }
            )
        );
    }

    private reevaluateAlignAttrsMismatch(state:ConcordanceModelState) {
        state.alignAttrsMismatchModalVisible = !pipe(
            state.mergedAttrs,
            List.filter(
                ([item, _]) => List.findIndex(
                    item2 => item === item2, state.alignCommonPosAttrs) === -1
            ),
            List.empty()
        );
    }

    private reapplyTokenLinkHighlights(state:ConcordanceModelState) {
        List.forEach(
            (v, i) => {
                Dict.forEach(
                    (v2, k) => {
                        this.highlightTokenLink(
                            state, i, parseInt(k), v2.color, false);
                    },
                    v
                );
            },
            this.state.tokenLinks
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
            state.forceScroll = window.scrollY;
            state.lines = List.map(
                line => {
                    const srch = List.find(
                        ([tokenNum,,]) => line.languages[0].tokenNumber === tokenNum,
                        data.selections
                    );
                    return {
                        ...line,
                        lineGroup: srch ? srch[2] : line.lineGroup
                    };
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

    private applyTokenHighlighting(
            languages:Array<KWICSection>,
            highlightItems:Array<HighlightAttrMatch>,
            words:HighlightWords,
            kcAttr:string
    ):Array<KWICSection> {
        return pipe(
            languages,
            List.map(
                (lang, i) => {
                    const colHlItems = List.filter(x => x.level === i, highlightItems);
                    const colWordDb = Dict.filter(
                        (v, _) => List.findIndex(
                            x => x.value === v && x.checked, colHlItems) > -1,
                        words
                    );
                    return List.size(colHlItems) > 0 ?
                        highlightConcLineTokens(lang, colWordDb, kcAttr) :
                        lang;
                }
            )
        );
    }

    getViewAttrs():Array<string> {
        return this.layoutModel.getConcArgs().attrs;
    }

    getNumItemsInLockedGroups():number {
        return this.state.numItemsInLockedGroups;
    }

    private pushHistoryState(action:typeof Actions.ChangePage|typeof Actions.ReloadConc):void {
        const args = this.layoutModel.getConcArgs();
        if (Actions.isChangePage(action)) {
            args.fromp = action.payload.pageNum;
        }
        args.q = ['~' + this.state.concId];
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
    private loadConcPage(concId?:string):Observable<[AjaxConcResponse, number]> {
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
        action:PaginationActions,
        pageNumber?:number,
        concId?:string
    ):Observable<[AjaxConcResponse, number]> {

        const pageNum:number = action === 'customPage' ?
            pageNumber : this.state.pagination[action];
        if (!this.pageNumIsValid(pageNum) || !this.pageIsInRange(pageNum)) {
            return throwError(() => new Error(this.layoutModel.translate(
                'concview__invalid_page_num_err')));
        }

        const args = {
            ...this.layoutModel.getConcArgs(),
            fromp: pageNum,
            viewmode: this.state.viewMode,
            format: 'json'
        };

        if (concId) {
            args.q = [concId];
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
                        this.reapplyTokenLinkHighlights(state);
                    });
                }
            ),
            map(resp => tuple(resp, pageNum))
        );
    }

    /**
     *
     * @param kcAttr an attribute (typically: word or lemma) we want the hightlight base on
     * @param forceReload
     * @returns
     */
    private reloadAlignedHighlights(kcAttr:string, forceReload:boolean) {
        if (List.size(this.state.corporaColumns) === 1 || List.size(this.state.highlightedMatches) === 0) {
            this.dispatchSideEffect(
                Actions.HighlightAttrMatchDone,
                {
                    matchPosAttr: kcAttr,
                    items: []
                }
            );
            return;
        }
        const toLoad = pipe(
            this.state.highlightedMatches,
            List.filter(x => !x.loaded),
            List.map(x => ({...x, loaded: true}))  // we already prepere here for later merge
        );

        if (!forceReload && List.size(toLoad) === 0) {
            this.changeState(
                state => {
                    state.lines = List.map(
                        line => ({
                            ...line,
                            languages: this.applyTokenHighlighting(
                                line.languages,
                                List.filter(x => x.attr === kcAttr, state.highlightedMatches),
                                state.highlightWordsStore[kcAttr],
                                kcAttr
                            )
                        }),
                        state.lines
                    );
                }
            );
            this.dispatchSideEffect(
                Actions.HighlightAttrMatchDone,
                {
                    matchPosAttr: kcAttr,
                    items: this.state.highlightedMatches
                }
            );
            return;
        }
        const corpname = this.state.corporaColumns[1].n;
        const values = pipe(
            toLoad,
            List.map(x => x.value),
            x => x.join('|')
        );
        this.layoutModel.ajax$<ConcQueryResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('/query_submit', {format: 'json'}),
            {
                type: 'concQueryArgs',
                queries: [
                    {
                        qtype: 'advanced',
                        corpname,
                        query: `[${kcAttr}="${values}"]`
                    }
                ],
                no_query_history: true
            },
            {
                contentType: 'application/json'
            }

        ).pipe(
            concatMap(
                (resp) => this.layoutModel.ajax$<{Blocks:Array<Block>}>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl(
                        '/freqml',
                        {
                            freq_type: 'tokens',
                            fpage: 1,
                            flimit: 1,
                            q: '~' + resp.conc_persistence_op_id,
                            cutoff: resp.conc_args.cutoff,
                            ml1attr: kcAttr,
                            ml1icase: '0',
                            ml1ctx: '0<0',
                            ml2attr: 'word',
                            ml2icase: '0',
                            ml2ctx: '0<0',
                            freqlevel: 2,
                            format: 'json'
                        }
                    ),
                    {}
                )
            ),
            map(
                data => pipe(
                    data.Blocks,
                    List.head(),
                    x => x.Items,
                    List.map(
                        x => tuple(x.Word[1].n, x.Word[0].n) // [attr] + word
                    ),
                    Dict.fromEntries()
                )
            )
        ).subscribe({
            next: data => {
                this.changeState(
                    state => {
                        state.highlightWordsStore[kcAttr] = Dict.mergeDict(
                            (_, v2) => v2,
                            data,
                            state.highlightWordsStore[kcAttr]
                        );
                        state.highlightedMatchConcId = state.concId;
                        state.lines = List.map(
                            line => ({
                                ...line,
                                languages: this.applyTokenHighlighting(
                                    line.languages,
                                    List.filter(x => x.attr === kcAttr, state.highlightedMatches),
                                    state.highlightWordsStore[kcAttr],
                                    kcAttr
                                )
                            }),
                            state.lines
                        );
                        state.highlightedMatches = mergeHighlightItems(
                            state.highlightedMatches,
                            toLoad,
                            true
                        );
                    }
                );
                this.dispatchSideEffect(
                    Actions.HighlightAttrMatchDone,
                    {
                        matchPosAttr: kcAttr,
                        items: this.state.highlightedMatches
                    }
                );
            },
            error: error => {
                this.layoutModel.showMessage('error', error);
                this.dispatchSideEffect(
                    Actions.HighlightAttrMatchDone,
                    error
                );
            }
        });
    }

    private importData(state:ConcordanceModelState, data:AjaxConcResponse):void {
        state.lines = importLines(
            data.Lines,
            this.getViewAttrs().indexOf(state.baseViewAttr) - 1,
            data.merged_attrs,
            data.merged_ctxattrs,
        );
        state.kwicCorps = data.KWICCorps;
        state.numItemsInLockedGroups = data.num_lines_in_groups;
        state.pagination = data.pagination;
        state.unfinishedCalculation = !data.finished;
        state.lineGroupIds = [];
        state.concId = data.conc_persistence_op_id;
        state.mergedAttrs = data.merged_attrs;
        state.mergedCtxAttrs = data.merged_ctxattrs;
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

    private getFlippedViewModeValue():ConcViewMode {
         return this.state.corporaColumns.length > 1 ?
            {'align': 'kwic', 'kwic': 'align'}[this.state.viewMode] :
            {'sen': 'kwic', 'kwic': 'sen'}[this.state.viewMode];
    }

    private changeViewMode(
        lineSelPayload:ExtractPayload<typeof Actions.PublishStoredLineSelections>
    ):Observable<ConcViewMode> {
        const viewMode = this.getFlippedViewModeValue()
        this.changeState(state => {state.viewMode = viewMode});
        this.layoutModel.updateConcArgs({viewmode: this.state.viewMode});
        const args = this.layoutModel.getConcArgs();
        args.q = ['~' + this.state.concId];
        args.format = 'json';

        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('view'),
            args

        ).pipe(
            tap(
                resp => {
                    this.changeState(state => {
                        this.importData(state, resp);
                        this.reapplyTokenLinkHighlights(state);
                        state.lineGroupIds = attachColorsToIds(
                            resp.lines_groups_numbers,
                            v => v,
                            mapIdToIdWithColors
                        );
                    });
                    this.pushHistoryState({
                        name: Actions.ReloadConc.name,
                        payload: {
                            concId: resp.conc_persistence_op_id,
                            arf: resp.result_arf,
                            corpusIpm: resp.result_relative_freq,
                            concSize: resp.concsize,
                            fullSize: resp.fullsize,
                            queryChainSize: List.size(resp.query_overview),
                            viewMode
                        }
                    });
                }
            ),
            map(
                _ => viewMode
            )
        );
    }

    private createAudioLink(endpoint:'audio'|'audio_waveform', textChunk:TextChunk):string {
        const tmp = textChunk.openLink || textChunk.closeLink;
        if (tmp) {
            return this.layoutModel.createActionUrl(
                endpoint,
                {
                    corpname: this.state.baseCorpname,
                    chunk: tmp.speechPath
                }
            );

        } else {
            return null;
        }
    }

    private changeMainCorpus(corpusId:string) {
        const args = this.layoutModel.getConcArgs();
        if (this.state.kwicCorps.indexOf(corpusId) > -1) {
            args.maincorp = undefined;
            args.viewmode = 'align';
            args.q = ['~' + this.state.concId];
            this.layoutModel.setLocationPost(
                this.layoutModel.createActionUrl('switch_main_corp', args),
                {
                    maincorp: corpusId
                }
            );

        } else {
            throw new Error('Cannot set corpus as main - no KWIC');
        }
    }

    private findActiveLineIdx(state:ConcordanceModelState):number {
        for (let i = 0; i < state.lines.length; i += 1) {
            for (let j = 0; j < state.lines[i].languages.length; j += 1) {
                if (ConclineSectionOps.findChunk(state.lines[i].languages[j], state.playerAttachedLink)) {
                    return i;
                }
            }
        }
        return -1;
    }

    private findChunks(state:ConcordanceModelState, ...linkIds:Array<string>):Array<TextChunk> {
        for (let i = 0; i < state.lines.length; i += 1) {
            for (let j = 0; j < state.lines[i].languages.length; j += 1) {
                const chunks = pipe(
                    linkIds,
                    List.map(c => ConclineSectionOps.findChunk(state.lines[i].languages[j], c)),
                    List.filter(v => v !== undefined)
                );
                if (!List.empty(chunks)) {
                    return chunks;
                }
            }
        }
        return [];
    }

    private playAudio(linkIds:Array<string>):void {
        this.setStopStatus(); // stop anything playing right now
        const activeChunkId = List.last(linkIds);
        this.changeState(state => {
            state.playerAttachedLink = activeChunkId;
            // let's get an active line - there can be only one even if we play multiple chunks
            const activeLine = this.findActiveLineIdx(state);
            const fakeChangedLine = state.lines[activeLine];
            state.lines[activeLine] = fakeChangedLine
            const playChunks = this.findChunks(state, ...linkIds);
            if (!List.empty(playChunks)) {
                List.last(playChunks).showAudioPlayer = true

            } else {
                throw new Error('No chunks to play');
            }
        });
        const playChunks = this.findChunks(this.state, ...linkIds);
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
        this.audioPlayer.stop();
        if (this.state.playerAttachedLink) {
            this.changeState(
                state => {
                    const playingLineIdx = this.findActiveLineIdx(state);
                    const modLine = this.state.lines[playingLineIdx]; // TODO clone?
                    state.lines[playingLineIdx] = modLine;
                    const playingChunk = this.findChunks(state, this.state.playerAttachedLink)[0];
                    if (playingChunk) {
                        playingChunk.showAudioPlayer = false;

                    } else {
                        throw new Error(`Failed to find playing chunk "${this.state.playerAttachedLink}"`);
                    }
                    state.playerAttachedLink = null;
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
}

