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

import { Color, pipe, List } from 'cnc-tskit';
import * as Kontext from '../../types/kontext.js';
import * as ViewOptions from '../../types/viewOptions.js';
import { DataSaveFormat } from '../../app/navigation/save.js';


export interface ConcToken {
    className:string;
    token:Token;
    posAttrs:Array<string>;
    displayPosAttrs:Array<string>;
    description?:Array<string>;
}


export interface KWICSection {

    tokenNumber:number;

    lineNumber:number;

    ref:Array<string>;

    left:Array<TextChunk>;

    kwic:Array<TextChunk>;

    right:Array<TextChunk>;

    /**
     * Higlighted positions for multi layered corpora
     */
    highlightMLPositions:Array<[number, number]>;
}


export function getKwicSectionToken(ks:KWICSection, idx:number):Token {
    return pipe(
        [...ks.left, ...ks.kwic, ...ks.right],
        List.find(x => x.token.idx === idx),
    ).token;
}

export interface Token {

    /**
     * Token raw value
     */
    s:string;

    /**
     * Token ID as defined by Manatee indexes.
     */
    id:number;

    /**
     * Represents indexing within a single line.
     * This means that the value goes across
     * TextChunk and even KWICSection instances
     */
    idx:number;

    /**
     * Specifies whether the token is highlighed or which color the highlight is
     */
    hColor:string;
    hIsBusy:boolean;

    /**
     * Specifies a possible connetion with a kwic_connect result
     * based on some attribute (attr) and its value (s)
     */
    kcConnection?:{
        attr:string;
        s:string;
    }
}

export enum PosAttrRole {
    USER = 0b01,
    INTERNAL = 0b10,
}

export interface TextChunk {
    className:string;
    token:Token;
    openLink?:{speechPath:string, linkId: string};
    closeLink?:{speechPath:string, linkId: string};
    continued?:boolean;
    showAudioPlayer:boolean;
    posAttrs:Array<string>; // array => multiple pos attrs per whole 'pseudo-position'
    displayPosAttrs:Array<string>;
    description?:Array<string>;
}


export function textChunkMatchesLinkId(tch:TextChunk, linkId:string) {
    return tch.openLink && tch.openLink.linkId === linkId ||
        tch.closeLink && tch.closeLink.linkId === linkId;
}



export interface Line {
    lineGroup:number|undefined;
    lineNumber:number;
    kwicLength:number;
    hasFocus:boolean;
    languages:Array<KWICSection>;
}


export interface HighlightWords {
    [attr:string]:string; // word form (typically: word) => [attr] (e.g. lemma)
}


/**
 * RefsColumn describes a meta-data information
 * item as shown when clicking on the left
 * concordance column.
 */
export interface RefsColumn {
    name:string;
    val:string;
}

/**
 * LineSelectionModes specify two distinct manual
 * concordance line categorization modes where
 * 'simple' adds just a checkbox to each line while
 * 'groups' allows attaching a number to each line.
 */
export type LineSelectionModes = 'simple'|'groups';

/**
 * LineSelValue defines a manual line selection
 * like this: [token ID, KWIC length, category ID]
 * where category ID is 1 in case of the 'simple'
 * selection mode.
 */
export type LineSelValue = [number, number, number];

/**
 * ConcLineSelection defines a list of manually
 * selected lines along with some additional info
 * (sel. mode, creation datetime).
 */
export interface ConcLineSelection {
    created:number;
    mode:LineSelectionModes;
    //             [tokenId, kwicLen, group num]
    selections:Array<LineSelValue>;
}

/**
 * LineSelections describes multiple ConcLineSelection instances
 * for different concordances. The 'queryHash' key is derived
 * from the 'q' URL argument.
 */
export type LineSelections = {[queryHash:string]:ConcLineSelection};

/**
 * AudioPlayerActions specifies status of the audio player.
 */
export type AudioPlayerActions = 'play'|'pause'|'stop';

/**
 * DetailExpandPositions defines which side of
 * a respective KWIC detail is expanded (left vs. right).
 */
export type DetailExpandPositions = 'left'|'right';

/**
 * LineGroupId defines a line selection category/group
 * ID (= a number user attached to it or 1 in case of the
 * 'simple' mode) along with some color coding used for
 * rendering.
 */
export interface LineGroupId {
    id:number;
    fgColor:string;
    bgColor:string;
}

/**
 * ServerTextChunk describes a concordance text
 * chunk as provided by the server-side.
 */
export interface ServerTextChunk {
    class:string;
    str:string;
    open_link?:{speech_path:string};
    close_link?:{speech_path:string};
    continued?:boolean;
    posattrs?:Array<string>;
}

export interface MLPositionsData {
    left:Array<number>;
    kwic:Array<number>;
    right:Array<number>;
}

/**
 * SingleCorpServerLineData defines a single
 * concordance line for a single (or unaligned)
 * corpus.
 */
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
    ml_positions:MLPositionsData;
}

/**
 * ServerLineData is a general concordance line with
 * support for aligned corpora.
 */
export interface ServerLineData extends SingleCorpServerLineData {
    Align:Array<SingleCorpServerLineData>;
}

/**
 * ServerPagination keeps all the data needed to
 * paginate through concordance lines. The attributes
 * are in the form understood by the server-side.
 */
export interface ServerPagination {
    firstPage:number;
    prevPage:number;
    nextPage:number;
    lastPage:number;
}

export type PaginationActions = 'prevPage'|'nextPage'|'customPage'|'firstPage'|'lastPage';

export type ConcViewMode = 'kwic'|'sen'|'align';

/**
 * ConcServerArgs defines a set of arguments needed
 * to address a specific concordance (including required
 * structs & attrs to display and pagination).
 *
 * Array-like values are encoded as comma-separated strings.
 */
export interface ConcServerArgs {
    maincorp:string;
    viewmode:ConcViewMode;
    format:Kontext.ResponseFormat;
    pagesize:number;
    attrs:Array<string>;
    attr_vmode:ViewOptions.AttrViewMode;
    base_viewattr:string;
    ctxattrs:Array<string>;
    structs:Array<string>;
    refs:Array<string>;
    ref_max_width:number;
    fromp:number;
    q:Array<string>;
    cutoff:number;
}

/**
 * ConcQuickFilterServerArgs specifies "quick filter"
 * concordance page (this is typically used when going
 * from a collocation/frequency page to a concrete concordance).
 */
export interface ConcQuickFilterServerArgs extends ConcServerArgs {
    q2:Array<string>;
}

/**
 * ConcSaveServerArgs defines arguments needed to
 * save a concordance to a file.
 */
export interface ConcSaveServerArgs extends ConcServerArgs {
    saveformat:DataSaveFormat;
    from_line:string;
    to_line:string;
    heading:'0'|'1';
    numbering:'0'|'1';
    align_kwic:'0'|'1';
}

export interface WideCtxArgs {
    attrs:Array<string>;
    structs:Array<string>;
    refs:Array<string>;
    hitlen:number;
}

/**
 * IConcArgsHandler defines an object which is able to
 * provide and update concordance page parameters.
 */
export interface IConcArgsHandler {

    getConcArgs():ConcServerArgs;

    /**
     * Upgrade any of concordance arguments. Please note
     * that in case of the 'q' argument, it is better
     * to use updateConcPersistenceId which ensures all
     * the occurences of the value are updated consistently.
     *
     * It accepts either a conc ID (= a hash) or a list of
     * q values where it expects also the ~hash value.
     */
    updateConcPersistenceId(value:string|Array<string>):void;

    /**
     * Change the current conc persistence ID in both
     * conc. args and concPersistenceId config. variable.
     */
    updateConcPersistenceId(value:string):void;
}

/**
 * ConcQueryResponse defines a server response to the initial
 * query request.
 */
export interface ConcQueryResponse extends Kontext.AjaxResponse {
    Q:Array<string>;
    conc_persistence_op_id:string;
    num_lines_in_groups:number;
    lines_groups_numbers:Array<number>;
    conc_args:ConcServerArgs;
    query_overview:Array<Kontext.QueryOperation>;
    finished:boolean;
    size:number;
}

/**
 * AjaxConcResponse defines a server response when
 * providing a concordance.
 */
export interface AjaxConcResponse extends ConcQueryResponse {
    Lines:Array<ServerLineData>;
    KWICCorps:Array<string>;
    conc_use_safe_font:number; // TODO should be boolean
    conc_persistence_op_id:string;
    conc_forms_args:{[opId:string]:unknown};
    concsize:number;
    fullsize:number;
    finished:boolean;
    fast_adhoc_ipm:boolean;
    pagination:ServerPagination;
    user_owns_conc:boolean;
    result_relative_freq:number;
    result_shuffled:boolean;
    result_arf:number;
    sampled_size:number;
    merged_attrs:Array<[string, number]>;
    merged_ctxattrs:Array<[string, number]>;
    page_title:string;
}

/**
 * AjaxLineGroupRenameResponse is a response from the server
 * in case user changes a manual group/category ID (e.g.
 * "change all lines with category  '3' to '4'")
 */
export interface AjaxLineGroupRenameResponse extends Kontext.AjaxResponse {
    Q:Array<string>;
    conc_persistence_op_id:string;
    lines_groups_numbers:Array<number>;
    num_lines_in_groups:number;
    user_owns_conc:boolean;
}

/**
 * ConcSummary defines a (mostly) numeric
 * overview of a concordance (size, ipm,...)
 */
export interface ConcSummary {
    concSize: number;
    fullSize: number;
    sampledSize: number;
    ipm: number;
    arf: number;
    isShuffled: boolean;
}

/**
 * CorpColumn defines a single language/alignment of a concordance
 * (i.e. all the parts of lines belonging to a concrete language - typically)
 */
export interface CorpColumn {
    n:string;
    label:string;
    visible:boolean;
}

/**
 * ViewConfiguration specifies props for the root React component
 * providing concordances.
 */
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
     * Determine concordance view mode
     */
    ViewMode:ConcViewMode;

    /**
     * Width of the refs (= metadata) column section in num. of characters
     */
    RefMaxWidth:number;

    /**
     * How we should display positional attributes
     */
    AttrViewMode:ViewOptions.AttrViewMode;

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
     * name is moved to the 'subcName' attribute.
     */
    subcId:string;

    /**
     * The original name user entered for a subcorpus.
     * The value is non-empty only if a respective corpus
     * is published.
     */
    subcName:string;

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

    /**
     * A structure used to show whole document. It is optional (null is ok).
     */
    StructCtx:string;

    WideCtxGlobals:WideCtxArgs;

    supportsSyntaxView:boolean;

    supportsTokenConnect:boolean;

    supportsTokensLinking:boolean;

    anonymousUserConcLoginPrompt:boolean;

    mergedAttrs:Array<[string, number]>;

    mergedCtxAttrs:Array<[string, number]>;

    alignCommonPosAttrs:Array<string>;

}



function getDynamicColor(idx:number, size:number, baseColor:Color.RGBA):Color.RGBA {
    const [hue, sat, lig] = Color.rgb2Hsl(baseColor)

    const newHue = hue + idx/size;
    return pipe(
        [newHue > 1 ? newHue - 1 : newHue, sat, lig],
        Color.hsl2Rgb()
    );
}


export function attachColorsToIds<T, U>(ids:Array<T>, idMapper:(item:T)=>number, outMapper:(item:T, fgColor:string, bgColor:string)=>U):Array<U> {
    return pipe(
        ids,
        List.sortedBy(idMapper),
        List.map((v, i) => {
            const bgColor = getDynamicColor(i, ids.length, Color.importColor(1, '#009EE0'));
            return outMapper(
                v,
                pipe(
                    bgColor,
                    Color.textColorFromBg(),
                    Color.color2str()
                ),
                Color.color2str(bgColor)
            );
        })
    );
}


export function mapIdToIdWithColors(id:number, fgColor:string, bgColor:string):LineGroupId {
    return {id, fgColor, bgColor};
}


export interface WideCtx extends Kontext.AjaxResponse {
    content:Array<{class:string; str:string}>;
    expand_left_args:{
        pos:number;
        hitlen:number;
        detail_left_ctx:number;
        detail_right_ctx:number
    };
    expand_right_args:{
        pos:number;
        hitlen:number;
        detail_left_ctx:number;
        detail_right_ctx:number
    };
    righttoleft:'0'|'1';
    pos:number;
    maxdetail:number;
    features?:any;
}


export interface FullRef extends Kontext.AjaxResponse {
    Refs:Array<{name:string; val:string}>;
}

export interface LineGroupChartItem {
    groupId:number;
    group:string;
    count:number;
    fgColor:string;
    bgColor:string;
}

export type LineGroupChartData = Array<LineGroupChartItem>;

export interface HighlightRequest {
    corpusId:string;
    lineId:number;
    tokenId:number;
    tokenLength:number;
    tokenRanges:{[corpusId:string]:[number, number]};
    scrollY:number;
}

export interface TokenLink {
    corpusId:string;
    tokenId:number;
    color:string;
    altColors:Array<string>;
    comment?:string;
}

export interface HighlightInfo {
    corpusId:string;
    lineId:number;
    tokenId:number;
    clickedTokenId:number;
    color:string;
    altColors:Array<string>;
    isBusy:boolean;
    comment?:string;
}