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

import { Dict, List, pipe } from 'cnc-tskit';
import { HighlightWords, KWICSection, Line, PosAttrRole, ServerLineData, ServerTextChunk, TextChunk, Token } from './common';
import { ConclineSectionOps } from './line';
import { defaultBgHighlighted } from '../../views/theme/default';


/**
 *
 * @param item
 * @param tokenId
 * @param startWlIdx "start within-line idx"
 * @returns
 */
function importTextChunk(
    item:ServerTextChunk,
    mainAttrIdx:number,
    tokenId:number,
    linkId:string,
    startWlIdx:number,
    roles:Array<[string, number]>
):TextChunk {
    const posattrs = roles.length === 2 ?
        // for single additional attribute all posattr parts are in fact one attr
        [(item.posattrs || []).join('/')] :
        item.posattrs || [];

    // there can be tokens containing `/` like `km/h`
    // manatee also uses `/` as separator of attrs
    // in this case there will be more items in `item.possattrs` after splitting the attr string
    // we can not confidently assign values to its requested attributes
    const description = (posattrs.length !== roles.length - 1 && item.class !== 'strc') ?
        [
            'concview__unparseable_token',
            `${roles[0][0]}: ${item.str}`,
            `${roles.slice(1).map(v => v[0]).join('/')}: ${posattrs.join('/')}`,
        ] :
        undefined;

    const displayPosAttrs = List.filter(
        // tslint:disable-next-line:no-bitwise
        (_, i) => i+1 > roles.length-1 ? false : (roles[i+1][1] & PosAttrRole.USER) === PosAttrRole.USER,
        posattrs,
    );
    if (mainAttrIdx === -1) {
        return {
            className: item.class,
            token: {
                id: tokenId,
                s: item.str,
                hColor: null,
                hIsBusy: false,
                idx: startWlIdx
            },
            openLink: item.open_link ?
                {
                    speechPath: item.open_link.speech_path,
                    linkId,
                } :
                undefined,
            closeLink: item.close_link ?
                {
                    speechPath: item.close_link.speech_path,
                    linkId,
                } :
                undefined,
            continued: item.continued,
            showAudioPlayer: false,
            posAttrs: posattrs,
            displayPosAttrs,
            description,
        };

    } else {
        const text = item.class === 'strc' ?  item.str : displayPosAttrs[mainAttrIdx];
        displayPosAttrs.splice(mainAttrIdx, 1, item.str.trim());
        return {
            className: item.class,
            token: {
                id: tokenId,
                s: text,
                hColor: null,
                hIsBusy: false,
                idx: startWlIdx
            },
            openLink: item.open_link ?
                {
                    speechPath: item.open_link.speech_path,
                    linkId: `${tokenId}:op`
                } :
                undefined,
            closeLink: item.close_link ?
                {
                    speechPath: item.close_link.speech_path,
                    linkId: `${tokenId}:cl`
                } :
                undefined,
            continued: item.continued,
            showAudioPlayer: false,
            posAttrs: posattrs,
            displayPosAttrs,
            description,
        };
    }
}


function nextWithinLineIdx(tc:Array<TextChunk>, currWlIdx:number) {
    if (List.empty(tc) || !List.last(tc).token) {
        return currWlIdx + 1;
    }
    return List.last(tc).token.idx + 1;
}

function numOfTokensInChunk(chk:Array<ServerTextChunk>):number {
    return pipe(
        chk,
        List.filter(x => !x.class),
        List.size()
    );
}

/**
 *
 */
export function importLines(
    data:Array<ServerLineData>,
    mainAttrIdx:number,
    merged_attrs:Array<[string, number]>,
    merged_ctxattrs:Array<[string, number]>
):Array<Line> {

    return List.reduce<ServerLineData, Array<Line>>(
        (acc, item:ServerLineData, lineIdx:number) => {
            let line:Array<KWICSection> = [];
            let wlIdx = 0;
            const {leftText} = List.reduce<
                ServerTextChunk,
                {idx:number; leftText: Array<TextChunk>}

            >(
                ({idx, leftText}, v, chunkIdx) => {
                    const tokIdx = v.class || chunkIdx === 0 ? idx : idx + 1;
                    return {
                        idx: tokIdx,
                        leftText:  [
                            ...leftText,
                            importTextChunk(
                                v,
                                mainAttrIdx,
                                item.toknum + tokIdx - numOfTokensInChunk(item.Left),
                                `link:${lineIdx}:${chunkIdx}`,
                                wlIdx,
                                merged_ctxattrs,
                            )
                        ]
                    };
                },
                {idx: 0, leftText: []},
                item.Left,

            );
            wlIdx = nextWithinLineIdx(leftText, wlIdx);
            const {kwicText} = List.reduce<
                ServerTextChunk,
                {idx:number; kwicText: Array<TextChunk>}
            >(
                ({idx, kwicText}, v, chunkIdx) => {
                    const tokIdx = v.class || chunkIdx === 0 ? idx : idx + 1;
                    return {
                        idx: tokIdx,
                        kwicText: [
                            ...kwicText,
                            importTextChunk(
                                v,
                                mainAttrIdx,
                                item.toknum + chunkIdx,
                                `link:${lineIdx}:${chunkIdx}`,
                                wlIdx,
                                merged_attrs
                            )
                        ]
                    }
                },
                {idx: 0, kwicText: []},
                item.Kwic
            );
            wlIdx = nextWithinLineIdx(kwicText, wlIdx);
            const {rightText} = List.reduce<
                ServerTextChunk,
                {idx:number; rightText:Array<TextChunk>}
            >(
                ({idx, rightText}, v, chunkIdx) => {
                    const tokIdx = v.class || chunkIdx === 0 ? idx : idx + 1;
                    return {
                        idx: tokIdx,
                        rightText: [
                            ...rightText,
                            importTextChunk(
                                v,
                                mainAttrIdx,
                                item.toknum + item.kwiclen + chunkIdx,
                                `link:${lineIdx}:${chunkIdx}`,
                                wlIdx,
                                merged_ctxattrs
                            )
                        ]
                    }
                },
                {idx: 0, rightText: []},
                item.Right
            );
            const main_line = ConclineSectionOps.newKWICSection(
                item.toknum,
                item.linenum,
                item.kwiclen,
                item.ref,
                leftText,
                kwicText,
                rightText,
                item.ml_positions,
                undefined,
            );
            line.push(main_line);

            line = pipe(
                item.Align || [],
                List.map(
                    (align_item, k) => {
                        let wlIdx = 0;
                        const {leftText} = List.reduce<
                            ServerTextChunk,
                            {idx:number; leftText: Array<TextChunk>}
                        >(
                            ({idx, leftText}, v, chunkIdx) => {
                                const tokIdx = v.class || chunkIdx === 0 ? idx : idx + 1;
                                return {
                                    idx: tokIdx,
                                    leftText: [
                                        ...leftText,
                                        importTextChunk(
                                            v,
                                            mainAttrIdx,
                                            align_item.toknum + chunkIdx - numOfTokensInChunk(align_item.Left),
                                            `link:${lineIdx}:${k}:${chunkIdx}`,
                                            wlIdx,
                                            merged_ctxattrs
                                        )
                                    ]
                                }
                            },
                            {idx: 0, leftText: []},
                            align_item.Left
                        );
                        wlIdx = nextWithinLineIdx(leftText, wlIdx);
                        const {kwicText} = List.reduce<
                            ServerTextChunk,
                            {idx:number; kwicText: Array<TextChunk>}
                        >(
                            ({idx, kwicText}, v, chunkIdx) => {
                                const tokIdx = v.class || chunkIdx === 0 ? idx : idx + 1;
                                return {
                                    idx: tokIdx,
                                    kwicText: [
                                        ...kwicText,
                                        importTextChunk(
                                            v,
                                            mainAttrIdx,
                                            align_item.toknum + chunkIdx,
                                            `link:${lineIdx}:${k}:${chunkIdx}`,
                                            wlIdx,
                                            merged_attrs
                                        )
                                    ]
                                }
                            },
                            {idx: 0, kwicText: []},
                            align_item.Kwic
                        );
                        wlIdx = nextWithinLineIdx(kwicText, wlIdx);
                        const {rightText} = List.reduce<
                            ServerTextChunk,
                            {idx:number; rightText: Array<TextChunk>}
                        >(
                            ({idx, rightText}, v, chunkIdx) => {
                                const tokIdx = v.class || chunkIdx === 0 ? idx : idx + 1;
                                return {
                                    idx: tokIdx,
                                    rightText: [
                                        ...rightText,
                                        importTextChunk(
                                            v,
                                            mainAttrIdx,
                                            align_item.toknum + align_item.kwiclen + chunkIdx,
                                            `link:${lineIdx}:${k}:${chunkIdx}`,
                                            wlIdx,
                                            merged_ctxattrs
                                        )
                                    ]
                                }
                            },
                            {idx: 0, rightText: []},
                            align_item.Right
                        );
                        return ConclineSectionOps.newKWICSection(
                            align_item.toknum,
                            align_item.linenum,
                            align_item.kwiclen,
                            align_item.ref,
                            leftText,
                            kwicText,
                            rightText,
                            align_item.ml_positions,
                            item.ml_positions,
                        )
                    }
                ),
                List.concatr(line)
            );
            return [
                ...acc,
                {
                    lineNumber: item.linenum,
                    lineGroup: item.linegroup >= 0 ? item.linegroup : undefined,
                    kwicLength: item.kwiclen,
                    languages: line,
                    hasFocus: false
                }
            ];
        },
        [],
        data
    );
}


function highlightWordInTokens(tokens:Array<Token>, mword:string, attr:string) {
    const word = mword.split(' ');
    let currSrch:Array<Token> = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].s === word[List.size(currSrch)]) {
            currSrch.push(tokens[i]);
        }
        if (List.size(word) === List.size(currSrch)) {
            List.forEach(
                item => {
                    item.hColor = defaultBgHighlighted;
                    item.kcConnection = {attr, s: mword};
                },
                currSrch
            );
            currSrch = [];
        }
    }
    if (List.size(word) === List.size(currSrch)) {
        List.forEach(
            item => {
                item.hColor = defaultBgHighlighted;
                item.kcConnection = {attr, s: mword};
            },
            currSrch
        );
    }
}

/**
 * Highlight a single line of a concordance.
 *
 */
export function highlightConcLineTokens(
    concLine:KWICSection,
    words:HighlightWords,
    kcAttr:string

):KWICSection {
    const tokens = pipe(
        [...concLine.left, ...concLine.kwic, ...concLine.right],
        List.map(x => x.token),
        List.map(token => {
            token.hColor = token.kcConnection ? null : token.hColor;
            return token;
        })
    );
    Dict.forEach(
        (_, word) => {
            highlightWordInTokens(tokens, word, kcAttr);
        },
        words
    )
    return concLine;
}
