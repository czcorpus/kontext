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

import { StatefulModel, Action } from 'kombo';

import { ViewOptions } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';


export type AudioPlayerActions = 'play'|'pause'|'stop';


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
export class DummySyntaxViewModel extends StatefulModel<{}> implements PluginInterfaces.SyntaxViewer.IPlugin {

    render(target:HTMLElement, tokenNumber:number, kwicLength:number):void {}

    close():void {}

    onPageResize():void {}

    isWaiting():boolean {
        return false;
    }

    onAction(action:Action) {}

    unregister():void {}

    registerOnError(fn:(e:Error)=>void):void {}
}