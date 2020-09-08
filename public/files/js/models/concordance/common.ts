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
import { ViewOptions, Kontext } from '../../types/common';
import { SaveData } from '../../app/navigation';
import { ConcQueryArgs } from '../query/common';

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
    tail_posattrs?:Array<string>;
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

/**
 * ConcServerArgs defines a set of arguments needed
 * to address a specific concordance (including required
 * structs & attrs to display and pagination).
 */
export interface ConcServerArgs {
    corpname:string;
    maincorp?:string;
    viewmode:'kwic'|'sen'|'align';
    format:Kontext.ResponseFormat;
    pagesize:number;
    attrs:string;
    attr_vmode:ViewOptions.AttrViewMode;
    base_viewattr:string;
    ctxattrs:string; // comma-separated values
    structs:string; // comma-separated values
    refs:string; //comma-separated values
    q:string;
    fromp?:number;
}

/**
 * ConcQuickFilterServerArgs specifies "quick filter"
 * concordance page (this is typically used when going
 * from a collocation/frequency page to a concrete concordance).
 */
export interface ConcQuickFilterServerArgs extends ConcServerArgs {
    q2:string;
}

/**
 * ConcSaveServerArgs defines arguments needed to
 * save a concordance to a file.
 */
export interface ConcSaveServerArgs extends ConcServerArgs {
    saveformat:SaveData.Format;
    from_line:string;
    to_line:string;
    heading:'0'|'1';
    numbering:'0'|'1';
    align_kwic:'0'|'1';
}

/**
 * IConcArgsHandler defines an object which is able to
 * provide and update concordance page parameters.
 */
export interface IConcArgsHandler {
    exportConcArgs():Kontext.IMultiDict<ConcServerArgs>;
    getConcArgs():ConcServerArgs;
    replaceConcArg(name:string, values:Array<string>):void;
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
}

/**
 * AjaxConcResponse defines a server response when
 * providing a concordance.
 */
export interface AjaxConcResponse extends ConcQueryResponse {
    Lines:Array<ServerLineData>;
    conc_use_safe_font:number; // TODO should be boolean
    concsize:number;
    finished:boolean;
    fast_adhoc_ipm:boolean;
    pagination:ServerPagination;
    running_calc:number; // TODO should be boolean
    user_owns_conc:boolean;
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
 * A callback used to draw line selection rations once a related
 * React wrapper is ready. This connects React world with d3 oldschool
 * chart drawing.
 */
export type DrawLineSelectionChart = (rootElm:HTMLElement, corpusId:string, size:[number, number]) => void;

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
    ViewMode:'kwic'|'sen'|'align';

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

    /**
     * A structure used to show whole document. It is optional (null is ok).
     */
    StructCtx:string;

    WideCtxGlobals:Array<[string,string]>;

    supportsSyntaxView:boolean;

    supportsTokenConnect:boolean;

    anonymousUserConcLoginPrompt:boolean;

    onLineSelChartFrameReady:DrawLineSelectionChart;
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
