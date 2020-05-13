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

import {Kontext, TextTypes, ViewOptions} from '../../types/common';
import {AjaxResponse} from '../../types/ajaxResponses';
import {PluginInterfaces} from '../../types/plugins';
import {MultiDict} from '../../util';
import {StatefulModel, UNSAFE_SynchronizedModel} from '../base';
import {PageModel} from '../../app/page';
import * as Immutable from 'immutable';
import {KWICSection} from './line';
import {Line, TextChunk, IConcLinesProvider} from '../../types/concordance';
import {AudioPlayer, AudioPlayerStatus} from './media';
import {ConcSaveModel} from './save';
import { transformVmode, ActionName as ViewOptionsActionName} from '../options/structsAttrs';
import { Action, IFullActionControl } from 'kombo';
import { throwError, Observable, interval, Subscription } from 'rxjs';
import { tap, map } from 'rxjs/operators';

export interface ServerTextChunk {
    class:string;
    str:string;
    open_link?:{speech_path:string};
    close_link?:{speech_path:string};
    continued?:boolean;
    tail_posattrs?:Array<string>;
}

export interface ServerPagination {
    firstPage:number;
    prevPage:number;
    nextPage:number;
    lastPage:number;
}

export interface SingleCorpServerLineData {
    Left:Array<ServerTextChunk>;
    Right:Array<ServerTextChunk>;
    Kwic:Array<ServerTextChunk>;
    rightsize:number;
    hitlen:string;
    linegroup:number;
    leftsize:number;
    ref:Array<string>;
    rightspace:string;
    linenum:number;
    leftspace:string;
    kwiclen:number;
    toknum:number;
}

export interface ServerLineData extends SingleCorpServerLineData {
    Align:Array<SingleCorpServerLineData>;
}

export interface ConcSummary {
    concSize: number;
    fullSize: number;
    sampledSize: number;
    ipm: number;
    arf: number;
    isShuffled: boolean;
}

export interface CorpColumn {
    n:string;
    label:string;
    visible:boolean;
}

export interface ViewConfiguration {

    /**
     * A positional attribute representing the original text.
     * In KonText this is locked to the 'word'.
     */
    basePosAttr:string;

    /**
     * A positional attribute used to create main text flow.
     * In most cases it is the same value as 'basePosAttr' but
     * for some corpora it can make sense to switch to a different
     * one (e.g. when dealing with different layers within spoken corpora)
     */
    baseViewAttr:string;

    activePosAttrs:Array<string>;

    anonymousUser:boolean;

    /**
     * Determine concordance view mode (kwic/sen/align)
     */
    ViewMode:string;

    /**
     * Where we should display additional positional attributes
     */
    AttrAllpos:ViewOptions.PosAttrViewScope;

    /**
     * How we should display additional positional attributes
     */
    AttrViewMode:ViewOptions.PosAttrViewMode;

    ShowLineNumbers:boolean;

    KWICCorps:Array<string>;

    CorporaColumns:Array<CorpColumn>;

    SortIdx:Array<{page:number; label:string}>;

    NumItemsInLockedGroups:number;

    baseCorpname:string;

    mainCorp:string;

    /**
     * For private subcorpus this is just what user entered
     * as a subc. name. In the current corpus is published, a
     * special code is used here instead and the original
     * name is moved to the 'origSubCorpName' attribute.
     */
    subCorpName:string;

    /**
     * The original name user entered for a subcorpus.
     * The value is non-empty only if a respective corpus
     * is published.
     */
    origSubCorpName:string;

    pagination:ServerPagination;

    currentPage:number;

    concSummary:ConcSummary;

    canSendEmail:boolean;

    useSafeFont:boolean;

    /**
     * If true then client regularly fetches status
     * of the calculation until it is finished.
     */
    Unfinished:boolean;

    /**
     * If true then we don't have to notify
     * user that the calculation will take quite a long time
     * as we are able to calc. the stuff quicker
     * (due to the liveattrs plugin).
     */
    FastAdHocIpm:boolean;

    /**
     * If true then a concordance toolbar providing
     * some useful options is shown.
     */
    ShowConcToolbar:boolean;

    /**
     * A structural attribute identifying a speaker (e.g. 'sp.num').
     * If null then the corpus is not considered to be spoken.
     */
    SpeakerIdAttr:[string, string];

    /**
     * A structural attribute specifying whether there is
     * an overlap between speeches.
     */
    SpeechOverlapAttr:[string, string];

    /**
     * A value denoting 'true' in case of SpeechOverlapAttr
     */
    SpeechOverlapVal:string;

    /**
     * A list of structural attributes containing
     * speech metadata. Used in speech detail mode.
     */
    SpeechAttrs:Array<string>;

    /**
     * A structural attribute referring to an audio chunk
     * representing a speech segment.
     */
    SpeechSegment:[string, string];

    SpeakerColors:Array<string>;

    /**
     * A structure used to show whole document. It is optional (null is ok).
     */
    StructCtx:string;

    WideCtxGlobals:Array<[string,string]>;

    catColors:Array<string>;

    supportsSyntaxView:boolean;

    anonymousUserConcLoginPrompt:boolean;

    onSyntaxPaneReady:(tokenId:number, kwicLength:number)=>void;

    onSyntaxPaneClose:()=>void;

    onReady:()=>void;

    onChartFrameReady?:(usePrevData:boolean)=>void;
}

/**
 *
 */
function importLines(data:Array<ServerLineData>, attrViewMode:ViewOptions.AttrViewMode, mainAttrIdx:number):Immutable.List<Line> {
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
            const text = tailPosattrs[mainAttrIdx];
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
            Immutable.List<TextChunk>(item.Left.map((v, j) => importTextChunk(v, `C${i}:L${j}`))),
            Immutable.List<TextChunk>(item.Kwic.map((v, j) => importTextChunk(v, `C${i}:K${j}`))),
            Immutable.List<TextChunk>(item.Right.map((v, j) => importTextChunk(v, `C${i}:R${j}`)))
        ));

        line = line.concat((item.Align || []).map((item, k) => {
            return new KWICSection(
                item.toknum,
                item.linenum,
                item.ref,
                Immutable.List<TextChunk>(item.Left.map((v, j) => importTextChunk(v, `C${i}:A${k}:L${j}`))),
                Immutable.List<TextChunk>(item.Kwic.map((v, j) => importTextChunk(v, `C${i}:A${k}:K${j}`))),
                Immutable.List<TextChunk>(item.Right.map((v, j) => importTextChunk(v, `C${i}:A${k}:R${j}`)))
            );
        }));

        const ansItem:Line = new Line();
        ansItem.lineNumber = item.linenum;
        ansItem.lineGroup = item.linegroup;
        ansItem.kwicLength = item.kwiclen;
        ansItem.languages = Immutable.List(line);
        ans.push(ansItem); // TODO
    });

    return Immutable.List(ans);
}


/**
 *
 */
export class DummySyntaxViewModel extends StatefulModel implements PluginInterfaces.SyntaxViewer.IPlugin {

    render(target:HTMLElement, tokenNumber:number, kwicLength:number):void {}

    close():void {}

    onPageResize():void {}

    isWaiting():boolean {
        return false;
    }

    registerOnError(fn:(e:Error)=>void):void {}
}


/**
 *
 */
export class ConcLineModel extends UNSAFE_SynchronizedModel implements IConcLinesProvider {

    private layoutModel:PageModel;

    private lines:Immutable.List<Line>;

    private viewMode:string;

    private attrAllpos:ViewOptions.PosAttrViewScope;

    private attrViewMode:ViewOptions.PosAttrViewMode;

    private showLineNumbers:boolean;

    private kwicCorps:Immutable.List<string>;

    private corporaColumns:Immutable.List<CorpColumn>;

    private baseCorpname:string;

    private subCorpName:string;

    private origSubcorpName:string;

    private audioPlayer:AudioPlayer;

    private playerAttachedChunk:string;

    private pagination:ServerPagination;

    private currentPage:number;

    private numItemsInLockedGroups:number;

    /**
     * Note: do not confuse with isBusy.
     * The 'unfinishedCalculation' says: we have some data
     * (typically 1st page) but the process of calculating
     * data is still running in background.
     */
    private unfinishedCalculation:boolean;

    private concSummary:ConcSummary;

    private adHocIpm:number;

    private fastAdHocIpm:boolean;

    private useSafeFont:boolean;

    private saveModel:ConcSaveModel;

    private syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin;

    private supportsSyntaxView:boolean;

    private ttModel:TextTypes.ITextTypesModel;

    /**
     * Note: substitutes "isBusy". Also compare with unfinishedCalculation.
     */
    private busyTimer:Subscription;

    private busyWaitSecs:number;

    private baseViewAttr:string;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl,
            saveModel:ConcSaveModel, syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin,
            ttModel:TextTypes.ITextTypesModel, lineViewProps:ViewConfiguration,
            initialData:Array<ServerLineData>) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.saveModel = saveModel;
        this.syntaxViewModel = syntaxViewModel;
        this.ttModel = ttModel;
        this.viewMode = lineViewProps.ViewMode;
        this.attrAllpos = lineViewProps.AttrAllpos;
        this.attrViewMode = lineViewProps.AttrViewMode;
        this.showLineNumbers = lineViewProps.ShowLineNumbers;
        this.kwicCorps = Immutable.List(lineViewProps.KWICCorps);
        this.corporaColumns = Immutable.List(lineViewProps.CorporaColumns);
        this.baseCorpname = lineViewProps.baseCorpname;
        this.subCorpName = lineViewProps.subCorpName;
        this.origSubcorpName = lineViewProps.origSubCorpName;
        this.unfinishedCalculation = lineViewProps.Unfinished;
        this.fastAdHocIpm = lineViewProps.FastAdHocIpm;
        this.concSummary = lineViewProps.concSummary;
        this.baseViewAttr = lineViewProps.baseViewAttr;
        this.lines = importLines(initialData, transformVmode(this.attrViewMode, this.attrAllpos), this.getViewAttrs().indexOf(this.baseViewAttr) - 1);
        this.numItemsInLockedGroups = lineViewProps.NumItemsInLockedGroups;
        this.pagination = lineViewProps.pagination; // TODO possible mutable mess
        this.currentPage = lineViewProps.currentPage || 1;
        this.useSafeFont = lineViewProps.useSafeFont;
        this.busyTimer = lineViewProps.Unfinished ? this.runBusyTimer(this.busyTimer) : null;
        this.busyWaitSecs = 0;
        this.supportsSyntaxView = lineViewProps.supportsSyntaxView;
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

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'CONCORDANCE_CHANGE_MAIN_CORPUS':
                    this.changeMainCorpus(action.payload['maincorp']);
                break;
                case 'CONCORDANCE_PLAY_AUDIO_SEGMENT':
                    this.playAudio(action.payload['chunksIds']);
                    this.emitChange();
                break;
                case 'AUDIO_PLAYER_CLICK_CONTROL':
                    this.handlePlayerControls(action.payload['action']);
                    this.emitChange();
                break;
                case 'CONCORDANCE_CHANGE_PAGE':
                case 'CONCORDANCE_REVISIT_PAGE':
                    this.changePage(action.payload['action'], action.payload['pageNum']).subscribe(
                        (data) => {
                            if (action.name === 'CONCORDANCE_CHANGE_PAGE') {
                                this.pushHistoryState(this.currentPage);
                            }
                            this.emitChange();
                        },
                        (err) => {
                            this.emitChange();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_ASYNC_CALCULATION_UPDATED':
                    const prevConcSize = this.concSummary.concSize;
                    this.unfinishedCalculation = !action.payload['finished'];
                    this.concSummary.concSize = action.payload['concsize'];
                    this.concSummary.fullSize = action.payload['fullsize'];
                    this.concSummary.ipm = action.payload['relconcsize'];
                    this.concSummary.arf = action.payload['arf'];
                    this.pagination.lastPage = action.payload['availPages'];
                    this.synchronize(
                        action.name,
                        {
                            isUnfinished: this.isUnfinishedCalculation()
                        }
                    );
                    if (this.concSummary.concSize > 0) {
                        if (prevConcSize === 0) {
                            this.changePage('customPage', 1).subscribe(
                                (data) => {
                                    if (action.name === 'CONCORDANCE_CHANGE_PAGE') {
                                        this.pushHistoryState(this.currentPage);
                                    }
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
                break;
                case 'CONCORDANCE_ASYNC_CALCULATION_FAILED':
                    this.busyTimer = this.stopBusyTimer(this.busyTimer);
                    this.unfinishedCalculation = false;
                    this.concSummary.concSize = 0;
                    this.concSummary.fullSize = 0;
                    this.concSummary.ipm = 0;
                    this.concSummary.arf = 0;
                    this.pagination.lastPage = 0;
                    this.lines = this.lines.clear();
                    this.emitChange();
                break;
                case 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC':
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
                break;
                case 'CONCORDANCE_CHANGE_LANG_VISIBILITY':
                    this.changeColVisibility(action.payload['corpusId'], action.payload['value']);
                    this.emitChange();
                break;
                case 'CONCORDANCE_SWITCH_KWIC_SENT_MODE':
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
                break;
                case 'CONCORDANCE_DATA_WAIT_TIME_INC':
                    this.busyWaitSecs = action.payload['idx'];
                    this.emitChange();
                break;
                case ViewOptionsActionName.SaveSettingsDone:
                    this.baseViewAttr = action.payload['baseViewAttr'];
                    this.updateOnCorpViewOptsChange();
                break;
            }
        });
    }

    private runBusyTimer(currTimer:Subscription):Subscription {
        if (currTimer) {
            currTimer.unsubscribe();
        }
        return interval(1000).subscribe(
            (idx) => {
                this.dispatcher.dispatch({
                    name: 'CONCORDANCE_DATA_WAIT_TIME_INC',
                    payload: {
                        idx: idx
                    }
                });
            }
        )
    }

    private stopBusyTimer(subs:Subscription):null {
        if (subs !== null) {
            subs.unsubscribe();
        }
        return null;
    }

    private changeColVisibility(corpusId:string, status:boolean):void {
        const srchIdx = this.corporaColumns.findIndex(v => v.n === corpusId);
        if (srchIdx > -1) {
            const srch = this.corporaColumns.get(srchIdx);
            this.corporaColumns = this.corporaColumns.set(srchIdx, {
                n: srch.n,
                label: srch.label,
                visible: status
            });

        } else {
            throw new Error(`column for ${corpusId} not found`);
        }
    }

    private updateOnCorpViewOptsChange():void {
        this.attrAllpos = this.layoutModel.getConcArgs()['attr_allpos'];
        this.attrViewMode = this.layoutModel.getConcArgs()['attr_vmode'];

        this.reloadPage().subscribe(
            (data) => {
                this.pushHistoryState(this.currentPage);
                this.emitChange();
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    updateOnGlobalViewOptsChange(model:ViewOptions.IGeneralViewOptionsModel):void {
        this.showLineNumbers = model.getLineNumbers();
        this.currentPage = 1;
        this.reloadPage().subscribe(
            (data) => {
                this.pushHistoryState(this.currentPage);
                this.emitChange();
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    getViewAttrs():Array<string> {
        return (this.layoutModel.getConcArgs()['attrs'] || []).split(',');
    }

    getViewAttrsVmode():ViewOptions.AttrViewMode {
        return transformVmode(this.attrViewMode, this.attrAllpos);
    }

    getNumItemsInLockedGroups():number {
        return this.numItemsInLockedGroups;
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
        return this.changePage('customPage', this.currentPage, concId);
    }

    private pageIsInRange(num:number):boolean {
        return this.pagination.firstPage <= num && num <= this.pagination.lastPage;
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
        const args = this.layoutModel.getConcArgs();
        const pageNum:number = Number(action === 'customPage' ? pageNumber : this.pagination[action]);
        if (!this.pageNumIsValid(pageNum) || !this.pageIsInRange(pageNum)) {
            return throwError(new Error(this.layoutModel.translate('concview__invalid_page_num_err')));
        }

        args.set('fromp', pageNum);
        args.set('format', 'json');
        if (concId) {
            args.set('q', concId);
        }

        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
            'GET',
            this.layoutModel.createActionUrl('view'),
            args

        ).pipe(
            tap((data) => {
                this.importData(data);
                this.currentPage = pageNum;
            }),
            map(_ => this.layoutModel.getConcArgs())
        );
    }

    private importData(data:Kontext.AjaxResponse):void {
        try {
            this.lines = importLines(data['Lines'], this.getViewAttrsVmode(), this.getViewAttrs().indexOf(this.baseViewAttr) - 1);
            this.numItemsInLockedGroups = data['num_lines_in_groups'];
            this.pagination = data['pagination'];
            this.unfinishedCalculation = data['running_calc'];

        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    private changeViewMode():Observable<any> {
        let mode:string;
        if (this.corporaColumns.size > 1) {
            mode = {'align': 'kwic', 'kwic': 'align'}[this.viewMode];

        } else {
            mode = {'sen': 'kwic', 'kwic': 'sen'}[this.viewMode];
        }
        this.viewMode = mode;
        this.layoutModel.replaceConcArg('viewmode', [this.viewMode]);
        const args = this.layoutModel.getConcArgs();
        args.set('format', 'json');

        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
            'GET',
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
                [['corpname', this.baseCorpname], ['chunk', tmp.speechPath]]
            );

        } else {
            return null;
        }
    }

    private changeMainCorpus(corpusId:string) {
        const args:MultiDict = this.layoutModel.getConcArgs();

        if (this.hasKwic(corpusId)) {
            args.set('maincorp', corpusId);
            args.set('viewmode', 'align');
            this.layoutModel.setLocationPost(
                this.layoutModel.createActionUrl('switch_main_corp', args.items()), []);

        } else {
            throw new Error('Cannot set corpus as main - no KWIC');
        }
    }

    private findActiveLineIdx(chunkId:string):number {
        for (let i = 0; i < this.lines.size; i += 1) {
            for (let j = 0; j < this.lines.get(i).languages.size; j += 1) {
                if (this.lines.get(i).languages.get(j).findChunk(chunkId)) {
                    return i;
                }
            }
        }
        return -1;
    }

    private findChunks(...chunkIds:Array<string>):Array<TextChunk> {
        for (let i = 0; i < this.lines.size; i += 1) {
            for (let j = 0; j < this.lines.get(i).languages.size; j += 1) {
                const ans = chunkIds.map(c => this.lines.get(i).languages.get(j).findChunk(c)).filter(v => v !== undefined);
                if (ans.length > 0) {
                    return ans;
                }
            }
        }
        return [];
    }

    private playAudio(chunksIds:Array<string>) {
        this.setStopStatus(); // stop anything playing right now
        const activeChunkId = chunksIds[chunksIds.length - 1];
        this.playerAttachedChunk = activeChunkId;
        // let's get active line - there can be only one even if we play multiple chunks
        const activeLine = this.findActiveLineIdx(activeChunkId);
        const fakeChangedLine = this.lines.get(activeLine).clone();
        this.lines = this.lines.set(activeLine, fakeChangedLine);

        const playChunks = this.findChunks(...chunksIds);
        if (playChunks.length > 0) {
            playChunks[playChunks.length - 1].showAudioPlayer = true
            this.audioPlayer.start(playChunks.map(item => this.createAudioLink(item)).filter(item => !!item));

        } else {
            throw new Error('No chunks to play');
        }
    }

    private setStopStatus():void {
        if (this.playerAttachedChunk) {
            this.audioPlayer.stop();
            const playingLineIdx = this.findActiveLineIdx(this.playerAttachedChunk);
            const modLine = this.lines.get(playingLineIdx).clone();
            this.lines = this.lines.set(playingLineIdx, modLine);
            const playingChunk = this.findChunks(this.playerAttachedChunk)[0];
            if (playingChunk) {
                playingChunk.showAudioPlayer = false;
                this.playerAttachedChunk = null;

            } else {
                throw new Error(`Failed to find playing chunk "${this.playerAttachedChunk}"`);
            }
        }
    }

    private handlePlayerControls(action) {
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
        args.set('corpname', this.baseCorpname);
        for (let p in selections) {
            args.replace(`sca_${p}`, selections[p]);
        }
        return this.layoutModel.ajax$<AjaxResponse.WithinMaxHits>(
            'POST',
            this.layoutModel.createActionUrl('ajax_get_within_max_hits'),
            args

        ).pipe(
            tap((data) => {
                this.adHocIpm = this.concSummary.fullSize / data.total * 1e6;
            }),
            map(_ => this.adHocIpm)
        );
    }

    hasKwic(corpusId:string):boolean {
        return this.kwicCorps.indexOf(corpusId) > -1;
    }

    getLines():Immutable.List<Line> {
        return this.lines;
    }

    getPagination():ServerPagination {
        return this.pagination;
    }

    getCurrentPage():number {
        return this.currentPage;
    }

    setLineFocus(lineIdx:number, focus:boolean) {
        this.lines = this.lines.map(item => {
            if (item.hasFocus) {
                const ans = item.clone();
                ans.hasFocus = false;
                return ans;

            } else {
                return item;
            }
        }).toList();

        if (focus === true) {
            const oldLine = this.lines.get(lineIdx);
            if (oldLine) {
                const idx = this.lines.indexOf(oldLine);
                const newVal = oldLine.clone();
                newVal.hasFocus = focus;
                this.lines = this.lines.set(idx, newVal);
            }
        }
    }

    isUnfinishedCalculation():boolean {
        return this.unfinishedCalculation;
    }

    getConcSummary():ConcSummary {
        return this.concSummary;
    }

    getProvidesAdHocIpm():boolean {
        return this.ttModel.hasSelectedItems();
    }

    getAdHocIpm():number {
        return this.adHocIpm;
    }

    getFastAdHocIpm():boolean {
        return this.fastAdHocIpm;
    }

    getSubCorpName():string {
        return this.subCorpName;
    }

    getCurrentSubcorpusOrigName():string {
        return this.origSubcorpName;
    }

    getAudioPlayerStatus():AudioPlayerStatus {
        return this.audioPlayer.getStatus();
    }

    getUseSafeFont():boolean {
        return this.useSafeFont;
    }

    getSaveModel():ConcSaveModel {
        return this.saveModel;
    }

    getSyntaxViewModel():PluginInterfaces.SyntaxViewer.IPlugin {
        return this.syntaxViewModel;
    }

    getSupportsSyntaxView():boolean {
        return this.supportsSyntaxView;
    }

    getBaseCorpname():string {
        return this.baseCorpname;
    }

    getEmptyRefValPlaceholder():string {
        return '\u2014';
    }

    getCorporaColumns():Immutable.List<CorpColumn> {
        return this.corporaColumns;
    }

    getViewMode():string {
        return this.viewMode;
    }

    getShowLineNumbers():boolean {
        return this.showLineNumbers;
    }

    getIsBusy():boolean {
        return this.busyTimer !== null;
    }

    // TODO pick a good heuristics here
    getRecommOverviewMinFreq():number {
        if (this.concSummary.concSize > 10000) {
            return 100;

        } else if (this.concSummary.concSize > 1000) {
            return 10;
        }
        return 1;
    }

    getNumWaitingSecs():number {
        return this.busyWaitSecs;
    }
}

