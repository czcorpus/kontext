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
import { IActionDispatcher, useModel } from 'kombo';
import { List } from 'cnc-tskit';

import { PositionValue, PositionOptions } from './common.js';
import * as Kontext from '../../../types/kontext.js';
import { Actions } from '../actions.js';
import { init as buttonsViewInit } from './buttons.js';
import * as PluginInterfaces from '../../../types/plugins/index.js';

import * as S from '../style.js';
import { PosTagModel } from './models.js';


type CheckboxHandler = (lineIdx:number, value:string, checked:boolean)=>void;


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    model:PosTagModel
) {

    const Buttons = buttonsViewInit(dispatcher, he);

    // ------------------------------ <ValueLine /> ----------------------------

    const ValueLine:React.FC<{
                data:{selected:boolean};
                lineIdx:number;
                sublineIdx:number;
                isLocked:boolean;
                isChecked:boolean;
                checkboxHandler:CheckboxHandler;
            }> = (props) => {

        const checkboxHandler = (evt) => {
            props.checkboxHandler(
                props.lineIdx,
                props.data['id'],
                evt.target.checked
            );
        };

        const label = props.data['title'] ?
                    props.data['title'] : he.translate('taghelper__unfulfilled');
        return (
            <li>
                <label className={props.isChecked ? 'active' : null}>
                    <input type="checkbox"
                            checked={props.isChecked}
                            onChange={checkboxHandler}
                            disabled={props.isLocked ? true : false } />
                    {label}
                </label>
        </li>
        );
    };

    // ------------------------------ <ValueList /> ----------------------------

    const ValueList:React.FC<{
                positionValues:Array<PositionValue>,
                lineIdx:number;
                isLocked:boolean;
                checkboxHandler:CheckboxHandler;
            }> = (props) => {

        const renderChildren = () => List.map(
            (item, i) => item.available ?
                    <ValueLine key={i} data={item} lineIdx={props.lineIdx} sublineIdx={i}
                                isLocked={props.isLocked} isChecked={item.selected}
                                checkboxHandler={props.checkboxHandler} /> :
                    null,
                props.positionValues
        );

        const hasOnlyUnfulfilledChild = () => {
            return props.positionValues.length === 1 && List.head(props.positionValues).id === '-';
        };

        const renderUnfulfilledCheckbox = () => {
            return (
                <S.ValueList>
                    <li>
                        <label>
                            <input type="checkbox" checked={true} disabled={true} />
                            {he.translate('taghelper__unfulfilled')}
                        </label>
                    </li>
                </S.ValueList>
            );
        };
        return (
            List.filter(item => item.available, props.positionValues).length > 0 ?
            (
                <S.ValueList>
                {
                    hasOnlyUnfulfilledChild() ?
                    renderUnfulfilledCheckbox() : renderChildren()
                }
                </S.ValueList>
            )
            : null
        );
    };

    // ------------------------------ <PositionLine /> ----------------------------

    const PositionLine:React.FC<{
                clickHandler:(lineIdx:number, isActive:boolean)=>void;
                lineIdx:number;
                position:PositionOptions;
                checkboxHandler:CheckboxHandler;
            }> = (props) => {

        const clickHandler = () => {
            props.clickHandler(props.lineIdx, props.position.isActive);
        };

        const getAvailableChildren = () => {
            return props.position['values'].filter(x=>x.available);
        };

        let linkClass = 'switch-link';
        if (props.position.isActive) {
            linkClass += ' active';

        } else if (props.position['locked']) {
            linkClass += ' used';
        }

        return (
            <S.PositionLine>
                <a className={linkClass} onClick={clickHandler}>
                    <span className="pos-num">{props.lineIdx + 1}.</span>
                    <span className="desc">{props.position['label']}</span>
                    <span className="status-text">[ {getAvailableChildren().length} ]</span>
                </a>
                <S.PositionValuesWrapper>
                    {props.position.isActive ?
                    <ValueList positionValues={getAvailableChildren()}
                                isLocked={props.position.isLocked}
                                lineIdx={props.lineIdx}
                                checkboxHandler={props.checkboxHandler} /> : null }
                </S.PositionValuesWrapper>
            </S.PositionLine>
        );
    };

    // ------------------------------ <PositionList /> ----------------------------

    const PositionList:React.FC<{
        tagsetId:string;
        sourceId:string;
        positions:Array<PositionOptions>;
        checkboxHandler:CheckboxHandler;
    }> = (props) => {

        const lineClickHandler = (idx) => () => {
            dispatcher.dispatch<typeof Actions.ToggleActivePosition>({
                name: Actions.ToggleActivePosition.name,
                payload: {
                    idx: idx,
                    tagsetId: props.tagsetId,
                    sourceId: props.sourceId
                }
            });
        };

        return (
            <S.AttrSelection>
                {props.positions.map(
                    (item, i) => <PositionLine key={`${i}:${item.label}`} position={item}
                                                lineIdx={i} clickHandler={lineClickHandler(i)}
                                                checkboxHandler={props.checkboxHandler} />)}
            </S.AttrSelection>
        );
    }

    // ------------------------------ <PosTagBuilder /> ----------------------------

    const PosTagBuilder:React.FC<PluginInterfaces.TagHelper.ViewProps> = (props) => {

        const state = useModel(model);
        const data = state.data[props.sourceId];

        const checkboxHandler = (lineIdx:number, value:string, checked:boolean) => {
            dispatcher.dispatch<typeof Actions.CheckboxChanged>({
                name: Actions.CheckboxChanged.name,
                payload: {
                    tagsetId: state.tagsetInfo.ident,
                    sourceId: props.sourceId,
                    position: lineIdx,
                    value: value,
                    checked: checked
                }
            });
        };

        return (
            <S.PosTagBuilder>
                <S.PostagDisplayBox type="text"
                        value={state.data[props.sourceId].generatedQuery} readOnly />
                <PositionList
                    positions={state.data[props.sourceId].positions}
                    sourceId={props.sourceId}
                    tagsetId={state.tagsetInfo.ident}
                    checkboxHandler={checkboxHandler} />
                <Buttons
                    range={[-1, -1]}
                    formType={props.formType}
                    sourceId={props.sourceId}
                    tagsetId={state.tagsetInfo.ident}
                    canUndo={data.canUndo}
                    rawPattern={data.rawPattern}
                    generatedQuery={data.generatedQuery}
                    isBusy={state.isBusy}
                />
            </S.PosTagBuilder>
        );
    }

    return PosTagBuilder;
}
