/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as React from 'react';
import { IActionDispatcher } from 'kombo';
import { List, Strings, pipe } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import { ConcordanceModel } from '../../../models/concordance/main';
import { ConcLinesStorage } from '../../../models/concordance/selectionStorage';
import { init as initMediaViews } from '../media';
import { Actions } from '../../../models/concordance/actions'
import { LineSelectionModes, TextChunk } from '../../../models/concordance/common';
import * as S from './style';
import { PlayerStatus } from '../../../models/concordance/media';


export interface LineExtrasViews {

    AudioLink:React.FC<{
        lineIdx:number;
        chunks:Array<TextChunk>;
        t:string; // TODO enum
        audioPlayerStatus:PlayerStatus;
    }>;

    TdLineSelection:React.FC<{
        lockedGroupId:number;
        groupId:number;
        groupColor:string;
        groupTextColor:string;
        mode:LineSelectionModes;
        tokenNumber:number;
        kwicLength:number;
        isEditLocked:boolean;
    }>;

    SyntaxTreeButton:React.FC<{
        sentenceTokens:Array<{corpus:string; tokenId:number; kwicLength:number}>;
    }>;

    RefInfo:React.FC<{
        corpusId:string;
        tokenNumber:number;
        lineIdx:number;
        data:Array<string>;
        refMaxWidth:number;
        emptyRefValPlaceholder:string;
        refsDetailClickHandler:(corpusId:string, tokNum:number, lineIdx:number)=>void;
    }>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, lineModel:ConcordanceModel) {

    const mediaViews = initMediaViews(dispatcher, he);
    const layoutViews = he.getLayoutViews();

    // ------------------------- <AudioLink /> ---------------------------

    const AudioLink:LineExtrasViews['AudioLink'] = (props) => {


        const getChar = () => {
            return {'L': '\u00A0[\u00A0', '+': '\u00A0+\u00A0', 'R': '\u00A0]\u00A0'}[props.t];
        };

        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.AudioPlayersStop>({
                name: Actions.AudioPlayersStop.name
            });
            dispatcher.dispatch<typeof Actions.PlayAudioSegment>({
                name: Actions.PlayAudioSegment.name,
                payload: {
                    linkIds: List.map(
                        x => x.openLink ? x.openLink.linkId : x.closeLink.linkId,
                        props.chunks
                    )
                }
            });
        };

        const canStartPlayback = () => {
            const chunks = (props.chunks || []);
            for (let i = 0; i < chunks.length; i += 1) {
                if (chunks[i].openLink && chunks[i].openLink.speechPath) {
                    return true;
                }
                if (chunks[i].closeLink && chunks[i].closeLink.speechPath) {
                    return true;
                }
            }
            return false;
        };

        if (props.chunks.length == 1
                && props.chunks[props.chunks.length - 1].showAudioPlayer) {
            return (
                <span>
                    <S.AudioLink onClick={handleClick}>{getChar()}</S.AudioLink>
                    <span style={{position: 'absolute',  marginTop: '2em'}}>
                        <mediaViews.AudioPlayer playerId={ConcordanceModel.AUDIO_PLAYER_ID} status={props.audioPlayerStatus}/>
                    </span>
                </span>
            );

        } else if (canStartPlayback()) {
            return <S.AudioLink onClick={handleClick} title={he.translate('concview__click_to_play_audio')}>
                {getChar()}
            </S.AudioLink>;

        } else {
            return <S.AudioLinkDisabled title={he.translate('concview__segment_has_no_playback_data')}>
                {getChar()}
            </S.AudioLinkDisabled>;
        }
    };


    // ------------------------- <LineSelCheckbox /> ---------------------------

    const LineSelCheckbox:React.FC<{
        tokenNumber:number;
        kwicLength:number;
        groupId:number|undefined;

    }> = (props) => {

        const checkboxChangeHandler = (event) => {
            dispatcher.dispatch<typeof Actions.SelectLine>({
                name: Actions.SelectLine.name,
                payload: {
                    value: event.currentTarget.checked ?
                        ConcLinesStorage.DEFAULT_GROUP_ID : undefined,
                    tokenNumber: props.tokenNumber,
                    kwicLength: props.kwicLength
                }
            });
        };

        return <input type="checkbox" checked={props.groupId !== undefined}
                        onChange={checkboxChangeHandler} />;
    };

    // ------------------------- <LineSelInput /> ---------------------------

    const LineSelInput:React.FC<{
        tokenNumber:number;
        kwicLength:number;
        groupId:number;

    }> = (props) => {

        const textChangeHandler = (event) => {
            const parsedValue = parseInt(event.currentTarget.value);
            dispatcher.dispatch<typeof Actions.SelectLine>({
                name: Actions.SelectLine.name,
                payload: {
                    value: event.currentTarget.value && !isNaN(parsedValue) ? parsedValue : undefined,
                    tokenNumber: props.tokenNumber,
                    kwicLength: props.kwicLength
                }
            });
        };
        return <input type="text" inputMode="numeric" style={{width: '1.4em'}}
                        value={props.groupId !== undefined ? props.groupId : ''} onChange={textChangeHandler} />;
    };

    // ------------------------- <TdLineSelection /> ---------------------------

    const TdLineSelection:LineExtrasViews['TdLineSelection'] = (props) => {

        const css = {
            color: props.groupTextColor,
            backgroundColor: props.groupColor
        }

        const renderInput = () => {
            if (props.isEditLocked) {
                if (props.lockedGroupId) {
                    const groupLabel = props.lockedGroupId >= 0 ? `#${props.lockedGroupId}` : '';
                    return <span className="group-id" style={css}>{groupLabel}</span>;

                } else {
                    return null;
                }

            } else if (props.mode === 'simple') {
                return <LineSelCheckbox {...props} />;

            } else if (props.mode === 'groups') {
                return <LineSelInput {...props} />;
            }
            return null;
        };

        return (
            <S.ManualSelectionTd>
                {renderInput()}
            </S.ManualSelectionTd>
        );
    };


    // ------------------------- <SyntaxTreeButton /> ---------------------

    const SyntaxTreeButton:LineExtrasViews['SyntaxTreeButton'] = (props) => {

        const handleSyntaxBoxClick = () => {
            dispatcher.dispatch<typeof Actions.ShowSyntaxView>({
                name: Actions.ShowSyntaxView.name,
                payload: {
                    sentenceTokens: props.sentenceTokens,
                    targetHTMLElementID: 'syntax-view-pane'
                }
            });
        };

        return (
            <a onClick={handleSyntaxBoxClick} title={he.translate('concview__click_to_see_the_tree')}>
                <img src={he.createStaticUrl('img/syntax-tree-icon.svg')} style={{width: '1em'}}
                        alt="syntax-tree-icon" />
            </a>
        );
    };

    const EmptyVal:React.FC<{}> = (props) => (
        <S.EmptyVal>N/A</S.EmptyVal>
    );

    // ------------------------- <RefInfo /> ---------------------

    function normalizeLabels(data:Array<string>, maxWidth: number) {
        return List.foldl<
            string,
            {
                total:number;
                i:number;
                text:Array<{t:string|undefined; m:string}>;
                shortenedAt:number;
            }>(
            (acc, x) => {
                const currLen = x ? x.length : 4; // placeholder takes space too
                if (acc.shortenedAt !== -1) {
                    return {
                        ...acc,
                        i: acc.i + 1,
                        total: acc.total + currLen,
                        text: List.concat(
                            [x ? {t: undefined, m: x} : {t: undefined, m: 'N/A'}],
                            acc.text
                        )
                    };
                }
                let chunk:string|undefined;
                if (acc.total + currLen > maxWidth && acc.shortenedAt === -1) {
                    if (maxWidth - acc.total > 0) {
                        acc.shortenedAt = acc.i;
                        chunk = Strings.shortenText(x, maxWidth - acc.total, '');

                    } else {
                        acc.shortenedAt = acc.i - 1;
                        chunk = undefined;
                    }

                } else {
                    chunk = x;
                }
                return {
                    ...acc,
                    total: acc.total + currLen,
                    i: acc.i + 1,
                    text: List.concat(
                        [x ? {t: chunk, m: x} : {t: undefined, m: 'N/A'}],
                        acc.text
                    )
                };
            },
            {total: 0, shortenedAt: -1, i: 0, text: []},
            data
        );
    }


    const RefInfo:LineExtrasViews['RefInfo']  = (props) => {
        const normLabels = normalizeLabels(props.data, props.refMaxWidth);
        const title = normLabels.shortenedAt < normLabels.i ?
            List.map(x => x.m, normLabels.text).join('\u00a0\u2726\u00a0') + `\n(${he.translate('concview__click_for_details')})` :
            he.translate('concview__click_for_details');
        return (
            <a title={title}
                    onClick={()=>props.refsDetailClickHandler(props.corpusId, props.tokenNumber, props.lineIdx)}>
                {pipe(
                    normLabels.text,
                    List.filter((_, i) => normLabels.shortenedAt !== -1 ? i <= normLabels.shortenedAt : true),
                    List.map(
                        (x, i) => x.t ?
                            <React.Fragment key={`item:${i}:${x.t}`}>
                                {i > 0 ? '\u00a0\u2726\u00a0' : ''}
                                <span className="item">{x.t}</span>
                            </React.Fragment> :
                            <React.Fragment key={`item:empty:${i}`}>
                                {i > 0 ? '\u00a0\u2726\u00a0' : ''}
                                <EmptyVal />
                            </React.Fragment>
                    )
                )}
                {normLabels.shortenedAt !== -1 ? '\u2026' : ''}
            </a>
        );
    };


    return {
        AudioLink,
        TdLineSelection,
        SyntaxTreeButton,
        RefInfo
    };

 }