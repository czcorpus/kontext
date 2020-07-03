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

import { Kontext } from '../../types/common';
import { ConcordanceModel } from '../../models/concordance/main';
import { TextChunk } from '../../types/concordance';
import { ConcLinesStorage } from '../../models/concordance/selectionStorage';
import { init as initMediaViews } from './media';
import { Actions, ActionName } from '../../models/concordance/actions'
import { LineSelectionModes } from '../../models/concordance/common';


export interface LineExtrasViews {

    AudioLink:React.SFC<{
        lineIdx:number;
        chunks:Array<TextChunk>;
        t:string; // TODO enum
    }>;

    TdLineSelection:React.SFC<{
        lockedGroupId:number;
        groupId:number;
        groupColor:string;
        groupTextColor:string;
        mode:LineSelectionModes;
        tokenNumber:number;
        kwicLength:number;
        isEditLocked:boolean;
    }>;

    SyntaxTreeButton:React.SFC<{
        tokenNumber:number;
        kwicLength:number;
    }>;

    RefInfo:React.SFC<{
        corpusId:string;
        tokenNumber:number;
        lineIdx:number;
        data:Array<string>;
        emptyRefValPlaceholder:string;
        refsDetailClickHandler:(corpusId:string, tokNum:number, lineIdx:number)=>void;
    }>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, lineModel:ConcordanceModel) {

    const mediaViews = initMediaViews(dispatcher, he, lineModel);
    const layoutViews = he.getLayoutViews();

    // ------------------------- <AudioLink /> ---------------------------

    const AudioLink:LineExtrasViews['AudioLink'] = (props) => {


        const getChar = () => {
            return {'L': '\u00A0[\u00A0', '+': '\u00A0+\u00A0', 'R': '\u00A0]\u00A0'}[props.t];
        };

        const handleClick = () => {
            dispatcher.dispatch<Actions.PlayAudioSegment>({
                name: ActionName.PlayAudioSegment,
                payload: {
                    chunksIds: props.chunks.map(v => v.id),
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
                    <a className="speech-link" onClick={handleClick}>{getChar()}</a>
                    <mediaViews.AudioPlayer />
                </span>
            );

        } else if (canStartPlayback()) {
            return <a className="speech-link" onClick={handleClick}
                        title={he.translate('concview__click_to_play_audio')}>{getChar()}</a>;

        } else {
            return <span className="speech-link disabled"
                        title={he.translate('concview__segment_has_no_playback_data')}>{getChar()}</span>;
        }
    };


    // ------------------------- <LineSelCheckbox /> ---------------------------

    const LineSelCheckbox:React.SFC<{
        tokenNumber:number;
        kwicLength:number;
        groupId:number|undefined;

    }> = (props) => {

        const checkboxChangeHandler = (event) => {
            dispatcher.dispatch<Actions.SelectLines>({
                name: ActionName.SelectLine,
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

    const LineSelInput:React.SFC<{
        tokenNumber:number;
        kwicLength:number;
        groupId:number;

    }> = (props) => {

        const textChangeHandler = (event) => {
            dispatcher.dispatch<Actions.SelectLines>({
                name: ActionName.SelectLine,
                payload: {
                    value: event.currentTarget.value ? parseInt(event.currentTarget.value) : undefined,
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

        const renderInput = () => {
            if (props.isEditLocked) {
                if (props.lockedGroupId) {
                    const groupLabel = props.lockedGroupId >= 0 ? `#${props.lockedGroupId}` : '';
                    return <span className="group-id">{groupLabel}</span>;

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
        const css = {
            color: props.groupTextColor,
            backgroundColor: props.groupColor
        }

        return (
            <td className="manual-selection" style={css}>
                {renderInput()}
            </td>
        );
    };


    // ------------------------- <SyntaxTreeButton /> ---------------------

    const SyntaxTreeButton:LineExtrasViews['SyntaxTreeButton'] = (props) => {

        const handleSyntaxBoxClick = () => {

            dispatcher.dispatch({
                name: 'SHOW_SYNTAX_VIEW',
                payload: {
                    tokenNumber: props.tokenNumber,
                    kwicLength: props.kwicLength
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

    // ------------------------- <RefInfo /> ---------------------


    const RefInfo:LineExtrasViews['RefInfo']  = (props) => {
        return (
            <a title={he.translate('concview__click_for_details')}
                    onClick={()=>props.refsDetailClickHandler(props.corpusId, props.tokenNumber, props.lineIdx)}>
                {props.data.map((x, i) => x !== '' ?
                    <layoutViews.Shortener key={`${i}:${x.substr(0, 5)}`} text={x} limit={50} className="item" /> :
                    props.emptyRefValPlaceholder)
                }
            </a>
        );
    };


    return {
        AudioLink: AudioLink,
        TdLineSelection: TdLineSelection,
        SyntaxTreeButton: SyntaxTreeButton,
        RefInfo: RefInfo
    };

 }