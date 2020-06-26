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
import { throwError, Observable, interval, Subscription } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { List, pipe, HTTP } from 'cnc-tskit';

import { Kontext, TextTypes, ViewOptions } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PluginInterfaces } from '../../types/plugins';
import { MultiDict } from '../../multidict';
import { PageModel } from '../../app/page';
import { KWICSection } from './line';
import { Line, TextChunk, IConcLinesProvider } from '../../types/concordance';
import { AudioPlayer, AudioPlayerStatus} from './media';
import { ConcSaveModel } from './save';
import { transformVmode } from '../options/structsAttrs';
import { Actions as ViewOptionsActions, ActionName as ViewOptionsActionName } from '../options/actions';
import { ServerLineData, ServerTextChunk, CorpColumn, ServerPagination, ConcSummary, ViewConfiguration, AudioPlayerActions } from './common';
import { Actions, ActionName } from './actions';



/**
 *
 */
function importLines(data:Array<ServerLineData>, mainAttrIdx:number):Array<Line> {
    let ans:Array<Line> = [];

    function importTextChunk(item:ServerTextChunk, id:string):TextChunk {
        if (mainAttrIdx === -1) {
            return {
                id: id,
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
                id: id,
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

        const ansItem:Line = new Line();
        ansItem.lineNumber = item.linenum;
        ansItem.lineGroup = item.linegroup;
        ansItem.kwicLength = item.kwiclen;
        ansItem.languages = line;
        ans.push(ansItem); // TODO
    });

    return ans;
}


export interface ConclineModelState {

    lines:Array<Line>;

    viewMode:string;

    attrAllpos:ViewOptions.PosAttrViewScope;

    attrViewMode:ViewOptions.PosAttrViewMode;

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

    syntaxBoxData:{tokenNumber:number; kwicLength:number}|null;

    supportsTokenConnect:boolean;

    catColors:Array<string>;

    emptyRefValPlaceholder:string;

    saveFormVisible:boolean;

    kwicDetailVisible:boolean;
}


/**
 *
 */
export class ConcLineModel extends StatefulModel<ConclineModelState> implements IConcLinesProvider {

    private readonly layoutModel:PageModel;

    private readonly saveModel:ConcSaveModel;

    private readonly syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin;

    private readonly audioPlayer:AudioPlayer;

    private readonly ttModel:TextTypes.ITextTypesModel;

    /**
     * Note: substitutes "isBusy". Also compare with unfinishedCalculation.
     */
    private busyTimer:Subscription;

    private readonly runBusyTimer:(currTimer:Subscription)=>Subscription;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl,
            saveModel:ConcSaveModel, syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin,
            ttModel:TextTypes.ITextTypesModel, lineViewProps:ViewConfiguration,
            initialData:Array<ServerLineData>) {
        const viewAttrs = layoutModel.getConcArgs().head('attrs').split(',');
        super(
            dispatcher,
            {
                viewMode: lineViewProps.ViewMode,
                attrAllpos: lineViewProps.AttrAllpos,
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
                providesAdHocIpm: ttModel.findHasSelectedItems(),
                concSummary: lineViewProps.concSummary,
                baseViewAttr: lineViewProps.baseViewAttr,
                lines: importLines(initialData, viewAttrs.indexOf(lineViewProps.baseViewAttr) - 1),
                viewAttrs: viewAttrs,
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
                syntaxBoxData: null,
                emptyRefValPlaceholder: '\u2014',
                catColors: [], // TODO !!!!
                saveFormVisible: false,
                kwicDetailVisible: false,
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
                            idx: idx
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
                this.changePage(action.payload.action, action.payload.pageNum).subscribe(
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

        this.addActionHandler<Actions.AsyncCalculationUpdated>(
            ActionName.AsyncCalculationUpdated,
            action => {
                const prevConcSize = this.state.concSummary.concSize;
                this.state.unfinishedCalculation = !action.payload.finished;
                this.state.concSummary.concSize = action.payload.concsize;
                this.state.concSummary.fullSize = action.payload.fullsize;
                this.state.concSummary.ipm = action.payload.relconcsize;
                this.state.concSummary.arf = action.payload.arf;
                this.state.pagination.lastPage = action.payload.availPages;
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
                this.state.unfinishedCalculation = false;
                this.state.concSummary.concSize = 0;
                this.state.concSummary.fullSize = 0;
                this.state.concSummary.ipm = 0;
                this.state.concSummary.arf = 0;
                this.state.pagination.lastPage = 0;
                this.state.lines = [];
                this.emitChange();
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
                        this.layoutModel.showMessage('error', this.layoutModel.translate('global__failed_to_calc_ipm'));
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
                this.state.busyWaitSecs = action.payload['idx'];
                this.emitChange();
            }
        );

        this.addActionHandler<ViewOptionsActions.SaveSettingsDone>(
            ViewOptionsActionName.SaveSettingsDone,
            action => {
                this.state.baseViewAttr = action.payload.baseViewAttr;
                this.emitChange();
            }
        );

        this.addActionHandler<ViewOptionsActions.GeneralSubmitDone>(
            ViewOptionsActionName.GeneralSubmitDone,
            action => {
                if (!action.error) {
                    this.state.showLineNumbers = action.payload.showLineNumbers;
                    this.state.currentPage = 1;
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
                this.emitChange(); // TODO do we need this? TEST
            }
        );

        this.addActionHandler(
            'MAIN_MENU_SHOW_SAVE_FORM',
            action => {
                this.changeState(state => {state.saveFormVisible = true});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.ResultCloseSaveForm>(
            ActionName.ResultCloseSaveForm,
            action => {
                this.changeState(state => {state.saveFormVisible = false});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.ResetDetail>(
            ActionName.ResetDetail,
            action => {
                this.changeState(state => {state.kwicDetailVisible = false});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.ShowKwicDetail>(
            ActionName.ShowKwicDetail,
            action => {
                this.changeState(state => {state.kwicDetailVisible = true});
                this.emitChange();
            }
        );
    }

    unregister():void {}

    private stopBusyTimer(subs:Subscription):null {
        if (subs !== null) {
            subs.unsubscribe();
        }
        return null;
    }

    private changeColVisibility(corpusId:string, status:boolean):void {
        const srchIdx = this.state.corporaColumns.findIndex(v => v.n === corpusId);
        if (srchIdx > -1) {
            const srch = this.state.corporaColumns[srchIdx];
            this.state.corporaColumns[srchIdx] = {
                n: srch.n,
                label: srch.label,
                visible: status
            };

        } else {
            throw new Error(`column for ${corpusId} not found`);
        }
    }

    private updateOnCorpViewOptsChange():void { // TODO !!
        this.state.attrAllpos = this.layoutModel.getConcArgs()['attr_allpos'];
        this.state.attrViewMode = this.layoutModel.getConcArgs()['attr_vmode'];

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

    getViewAttrs():Array<string> {
        return this.layoutModel.getConcArgs().head('attrs').split(',');
    }

    static getViewAttrsVmode(state:ConclineModelState):ViewOptions.AttrViewMode {
        return transformVmode(state.attrViewMode, state.attrAllpos);
    }

    getNumItemsInLockedGroups():number {
        return this.state.numItemsInLockedGroups;
    }

    private pushHistoryState(pageNum:number):void {
        const args = this.layoutModel.getConcArgs();
        args.set('fromp', pageNum);
        this.layoutModel.getHistory().pushState(
            'view', args, { pagination: true, pageNum: pageNum });
    }

    /**
     * Reload data on current concordance page.
     * The returned promise passes URL argument matching
     * currently displayed data page.
     */
    reloadPage(concId?:string):Observable<MultiDict> {
        return this.changePage('customPage', this.state.currentPage, concId);
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
    private changePage(action:string, pageNumber?:number, concId?:string):Observable<MultiDict> {
        const pageNum:number = Number(action === 'customPage' ? pageNumber : this.state.pagination[action]);
        if (!this.pageNumIsValid(pageNum) || !this.pageIsInRange(pageNum)) {
            return throwError(new Error(this.layoutModel.translate('concview__invalid_page_num_err')));
        }

        const args = this.layoutModel.getConcArgs();
        args.set('fromp', pageNum);
        args.set('format', 'json');
        if (concId) {
            args.set('q', concId);
        }

        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('view'),
            args

        ).pipe(
            tap((data) => {
                this.importData(data);
                this.state.currentPage = pageNum;
            }),
            map(_ => this.layoutModel.getConcArgs())
        );
    }

    private importData(data:Kontext.AjaxResponse):void { // TODO data type is too general
        try {
            this.state.lines = importLines(data['Lines'], this.getViewAttrs().indexOf(this.state.baseViewAttr) - 1);
            this.state.numItemsInLockedGroups = data['num_lines_in_groups'];
            this.state.pagination = data['pagination'];
            this.state.unfinishedCalculation = data['running_calc'];

        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    private changeViewMode():Observable<any> {
        let mode:string;
        if (this.state.corporaColumns.length > 1) {
            mode = {'align': 'kwic', 'kwic': 'align'}[this.state.viewMode];

        } else {
            mode = {'sen': 'kwic', 'kwic': 'sen'}[this.state.viewMode];
        }
        this.state.viewMode = mode;
        this.layoutModel.replaceConcArg('viewmode', [this.state.viewMode]);
        const args = this.layoutModel.getConcArgs();
        args.set('format', 'json');

        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
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
        const args:MultiDict = this.layoutModel.getConcArgs();
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
        this.state.playerAttachedChunk = activeChunkId;
        // let's get an active line - there can be only one even if we play multiple chunks
        const activeLine = this.findActiveLineIdx(activeChunkId);
        const fakeChangedLine = this.state.lines[activeLine];
        this.state.lines[activeLine] = fakeChangedLine;

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
            this.state.lines[playingLineIdx] = modLine;
            const playingChunk = this.findChunks(this.state.playerAttachedChunk)[0];
            if (playingChunk) {
                playingChunk.showAudioPlayer = false;
                this.state.playerAttachedChunk = null;

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
                this.emitChange();
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
            'POST',
            this.layoutModel.createActionUrl('ajax_get_within_max_hits'),
            args

        ).pipe(
            tap((data) => {
                this.state.adHocIpm = this.state.concSummary.fullSize / data.total * 1e6;
            }),
            map(_ => this.state.adHocIpm)
        );
    }

    getLines():Array<Line> {
        return this.state.lines;
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

    setLineFocus(lineIdx:number, focus:boolean) {
        this.state.lines = List.map(
            item => {
                if (item.hasFocus) {
                    const ans = item.clone();
                    ans.hasFocus = false;
                    return ans;

                } else {
                    return item;
                }
            },
            this.state.lines
        );

        if (focus === true) {
            const oldLine = this.state.lines[lineIdx];
            if (oldLine) {
                const idx = this.state.lines.indexOf(oldLine);
                const newVal = oldLine.clone();
                newVal.hasFocus = focus;
                this.state.lines[idx] = newVal;
            }
        }
    }

    getConcSummary():ConcSummary {
        return this.state.concSummary;
    }

    getAdHocIpm():number {
        return this.state.adHocIpm;
    }

    getFastAdHocIpm():boolean {
        return this.state.fastAdHocIpm;
    }

    getSubCorpName():string {
        return this.state.subCorpName;
    }

    getCurrentSubcorpusOrigName():string {
        return this.state.origSubcorpName;
    }

    getAudioPlayerStatus():AudioPlayerStatus {
        return this.audioPlayer.getStatus();
    }

    getUseSafeFont():boolean {
        return this.state.useSafeFont;
    }

    getSaveModel():ConcSaveModel {
        return this.saveModel;
    }

    getSyntaxViewModel():PluginInterfaces.SyntaxViewer.IPlugin {
        return this.syntaxViewModel;
    }

    getSupportsSyntaxView():boolean {
        return this.state.supportsSyntaxView;
    }

    getBaseCorpname():string {
        return this.state.baseCorpname;
    }

    getCorporaColumns():Array<CorpColumn> {
        return this.state.corporaColumns;
    }

    getViewMode():string {
        return this.state.viewMode;
    }

    getShowLineNumbers():boolean {
        return this.state.showLineNumbers;
    }

    getIsBusy():boolean {
        return this.busyTimer !== null;
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

    getNumWaitingSecs():number {
        return this.state.busyWaitSecs;
    }
}

