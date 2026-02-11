/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import * as React from 'react';
import { IActionDispatcher } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { Actions as QueryActions, QueryFormType } from '../../../models/query/actions.js';
import { Actions } from '../actions.js';


export interface TagButtonsProps {
    range:[number, number];
    formType:QueryFormType;
    sourceId:string;
    tagsetId:string;
    onInsert?:()=>void;
    canUndo:boolean;
    rawPattern:string;
    generatedQuery:string;
    isBusy:boolean;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
):React.FC<TagButtonsProps> {

    const layoutViews = he.getLayoutViews();

    // ------------------------------ <InsertButton /> ----------------------------

    const InsertButton:React.FC<{onClick:(evt:React.MouseEvent<{}>)=>void}> = (props) => {
        return (
            <button className="InsertButton default-button" type="button"
                    value="insert" onClick={props.onClick}>
                {he.translate('taghelper__insert_btn')}
            </button>
        );
    }

    // ------------------------------ <UndoButton /> ----------------------------

    const UndoButton:React.FC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> =
    (props) => {
        if (props.enabled) {
            return (
                <button type="button" className="default-button" value="undo"
                        onClick={props.onClick}>
                    {he.translate('taghelper__undo')}
                </button>
            );

        } else {
            return (
                <button type="button" className="util-button disabled">
                    {he.translate('taghelper__undo')}
                </button>
            );
        }
    };

    // ------------------------------ <ResetButton /> ----------------------------

    const ResetButton:React.FC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> =
    (props) => {
        if (props.enabled) {
            return (
                <button type="button" className="default-button"
                        value="reset" onClick={props.onClick}>
                    {he.translate('taghelper__reset')}
                </button>
            );

        } else {
            return (
                <button type="button" className="util-button disabled">
                    {he.translate('taghelper__reset')}
                </button>
            );
        }
    };



    // ------------------------------ <TagButtons /> ----------------------------

    const TagButtons:React.FC<TagButtonsProps> = (props) => {

        const buttonClick = (evt:any) => {
            if (evt.target.value === 'reset') {
                dispatcher.dispatch<typeof Actions.Reset>({
                    name: Actions.Reset.name,
                    payload: {
                        tagsetId: props.tagsetId,
                        sourceId: props.sourceId
                    }
                });

            } else if (evt.target.value === 'undo') {
                dispatcher.dispatch<typeof Actions.Undo>({
                    name: Actions.Undo.name,
                    payload: {
                        tagsetId: props.tagsetId,
                        sourceId: props.sourceId
                    }
                });

            } else if (evt.target.value === 'insert') {
                const query = !Array.isArray(props.range) || props.range[0] === props.range[1] ?
                        `[${props.generatedQuery}]` :
                        `"${props.rawPattern}"` ;

                dispatcher.dispatch<typeof QueryActions.QueryInputSetQuery>({
                    name: QueryActions.QueryInputSetQuery.name,
                    payload: {
                        formType: props.formType,
                        sourceId: props.sourceId,
                        query,
                        insertRange: [props.range[0], props.range[1]],
                        rawAnchorIdx: null,
                        rawFocusIdx: null
                    }
                });
                dispatcher.dispatch<typeof Actions.Reset>({
                    name: Actions.Reset.name,
                    payload: {
                        tagsetId: props.tagsetId,
                        sourceId: props.sourceId
                    }
                });
                if (typeof props.onInsert === 'function') {
                    props.onInsert();
                }
            }
        };

        return (
            <div className="buttons">
                {props.isBusy ?
                    <layoutViews.AjaxLoaderBarImage /> :
                    <>
                        <InsertButton onClick={buttonClick} />
                        <span className="separ"></span>
                        <UndoButton onClick={buttonClick} enabled={props.canUndo} />
                        <ResetButton onClick={buttonClick} enabled={props.canUndo} />
                    </>
                }
            </div>
        );
    };


    return TagButtons;
}