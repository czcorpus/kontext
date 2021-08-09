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

import * as React from 'react';
import { List } from 'cnc-tskit';
import { IActionDispatcher, BoundWithProps } from 'kombo';

import * as Kontext from '../../types/kontext';
import {
    TTFreqFormModel, TTFreqFormModelState, MLFreqFormModel,
    MLFreqFormModelState } from '../../models/freqs/freqForms';
import { Actions } from '../../models/freqs/actions';
import { AlignTypes } from '../../models/freqs/twoDimension/common';

import * as S from './style';

// -------------------------- exported component ----------

export interface FreqFormsViews {
    TTFreqForm:React.ComponentClass;
    MLFreqForm:React.ComponentClass;
}


export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers,
        ttFreqFormModel:TTFreqFormModel,
        mlFreqFormModel:MLFreqFormModel):FreqFormsViews {

    const layoutViews = he.getLayoutViews();

    // ---------------------- <StructAttrSelect /> --------------------------------------------

    interface StructAttrSelectProps {
        structAttrListSplitTypes:Array<Array<Kontext.AttrItem>>;
        fttattr:Array<string>;
    }

    const StructAttrSelect:React.FC<StructAttrSelectProps> = (props) => {

        const handleCheckboxChange = (evt) => {
            dispatcher.dispatch<typeof Actions.TTSetFttAttr>({
                name: Actions.TTSetFttAttr.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <table className="struct-attr-list">
                <thead>
                    <tr>
                        <th colSpan={props.structAttrListSplitTypes.length}>
                            {he.translate('query__structattrs')}:
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        {props.structAttrListSplitTypes.map((chunk, i) => {
                            return (
                                <td key={`block${i}`} style={{verticalAlign: 'top'}}>
                                    <table>
                                        <tbody>
                                            {chunk.map((item, j) => {
                                                return (
                                                    <tr key={`item_${j}`}>
                                                        <td>
                                                            <label htmlFor={`ttsort_${i}_${j}`}>{item.label}</label>
                                                        </td>
                                                        <td>
                                                            <input id={`ttsort_${i}_${j}`}
                                                                type="checkbox"
                                                                value={item.n}
                                                                checked={props.fttattr.includes(item.n)}
                                                                onChange={handleCheckboxChange}  />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>
        );
    };

    // ---------------------- <FreqLimitInput /> --------------------------------------------

    const FreqLimitInput:React.FC<{
        actionName:typeof Actions.MLSetFLimit.name|typeof Actions.TTSetFLimit.name;
        flimit:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.MLSetFLimit|typeof Actions.TTSetFLimit>({
                name: props.actionName,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <layoutViews.ValidatedItem invalid={props.flimit.isInvalid}>
                <input id="freq-limit-input" type="text" name="flimit"
                        value={props.flimit.value}
                        style={{width: '3em'}} onChange={handleInputChange} />
            </layoutViews.ValidatedItem>
        );
    };

    // ---------------------- <IncludeEmptyCheckbox /> --------------------------------------------

    interface IncludeEmptyCheckboxProps {
        fttIncludeEmpty:boolean;
    }

    const IncludeEmptyCheckbox:React.FC<IncludeEmptyCheckboxProps> = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch<typeof Actions.TTSetIncludeEmpty>({
                name: Actions.TTSetIncludeEmpty.name,
                payload: {}
            });
        };

        return <input id="include-empty-checkbox" type="checkbox" checked={props.fttIncludeEmpty}
                    onChange={handleCheckboxChange} />;
    };

    // ---------------------- <TTFreqForm /> --------------------------------------------

    interface TTFreqFormProps {
    }

    class TTFreqForm extends React.Component<TTFreqFormProps & TTFreqFormModelState> {

        getStructAttrListSplitTypes(state:TTFreqFormModelState):Array<Array<Kontext.AttrItem>> {
            const structOf = (a:Kontext.AttrItem) => a.n.split('.')[0];
            return List.reduce((reduc, curr) => {
                const lastElement = reduc.length === 0 ? null : List.last(reduc);
                if (lastElement === null || structOf(curr) !== structOf(List.last(lastElement))) {
                    if (lastElement) {
                        lastElement.sort((v1, v2) => v1.n.localeCompare(v2.n));
                        reduc.push([{n: curr.n, label: curr.label}]);
                        return reduc;

                    } else {
                        reduc.push([{n: curr.n, label: curr.label}]);
                        return reduc;
                    }

                } else {
                    lastElement.push({n: curr.n, label: curr.label});
                    return reduc;
                }
            }, [], state.structAttrList);
        }

        render():React.ReactElement<{}> {
            return (
                <div>
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>
                                    <label htmlFor="freq-limit-input">
                                        {he.translate('freq__freq_limit_label')}:
                                    </label>
                                </th>
                                <td>
                                    <FreqLimitInput flimit={this.props.flimit} actionName={Actions.TTSetFLimit.name} />
                                </td>
                            </tr>
                            <tr>
                                <th>
                                    <label htmlFor="include-empty-checkbox">
                                        {he.translate('freq__incl_no_hits_cats_label')}:
                                    </label>
                                </th>
                                <td>
                                    <IncludeEmptyCheckbox fttIncludeEmpty={this.props.fttIncludeEmpty} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <table className="form">
                        <tbody>
                            <tr>
                                <td colSpan={2}>
                                    <StructAttrSelect structAttrListSplitTypes={this.getStructAttrListSplitTypes(this.props)}
                                            fttattr={this.props.fttattr} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    // -------------------- <MLAttrSelection /> --------------------------------------------

    interface MLAttrSelectionProps {
        levelIdx:number;
        mlxAttrValue:string;
        attrList:Array<Kontext.AttrItem>;
    }

    const MLAttrSelection:React.FC<MLAttrSelectionProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch<typeof Actions.MLSetMlxAttr>({
                name: Actions.MLSetMlxAttr.name,
                payload: {
                    levelIdx: props.levelIdx,
                    value: evt.target.value
                }
            });
        };

        return (
            <select onChange={handleSelection} value={props.mlxAttrValue}>
                {props.attrList.map(item => {
                    return <option key={item.n} value={item.n}>{item.label}</option>
                })}
            </select>
        );
    };


    // ---------------------- <MLIgnoreCaseCheckbox /> ---------------------

    interface MLIgnoreCaseCheckboxProps {
        levelIdx:number;
        mlxicaseValue:boolean;
    }

    const MLIgnoreCaseCheckbox:React.FC<MLIgnoreCaseCheckboxProps> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch<typeof Actions.MLSetMlxiCase>({
                name: Actions.MLSetMlxiCase.name,
                payload: {
                    levelIdx: props.levelIdx
                }
            });
        };

        return <input type="checkbox" onChange={handleChange} checked={props.mlxicaseValue} />;
    };


    // ---------------------- <MLPositionSelect /> ---------------------

    interface MLPositionSelectProps {
        levelIdx:number;
        mlxctxIndex:number;
        positionRangeLabels:Array<string>;
    }

    const MLPositionSelect:React.FC<MLPositionSelectProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch<typeof Actions.MLSetMlxctxIndex>({
                name: Actions.MLSetMlxctxIndex.name,
                payload: {
                    levelIdx: props.levelIdx,
                    value: evt.target.value
                }
            });
        };

        return (
            <select onChange={handleSelection} value={props.mlxctxIndex}>
                {props.positionRangeLabels.map((item, i) => {
                    return <option key={`opt_${i}`} value={i}>{item}</option>;
                })}
            </select>
        );
    };


    // ---------------------- <MLPosAlignmentSelect /> ---------------------

    interface MLPosAlignmentSelectProps {
        levelIdx:number;
        alignType:AlignTypes;
    }

    const MLPosAlignmentSelect:React.FC<MLPosAlignmentSelectProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch<typeof Actions.MLSetAlignType>({
                name: Actions.MLSetAlignType.name,
                payload: {
                    levelIdx: props.levelIdx,
                    value: evt.target.value
                }
            });
        };

        return (
            <select className="kwic-alignment" value={props.alignType}
                    onChange={handleSelection}>
                <option value="left">{he.translate('freq__align_type_left')}</option>
                <option value="right">{he.translate('freq__align_type_right')}</option>
            </select>
        );
    };

    // ---------------------- <MLMoveLevelControl /> ---------------------

    interface MLMoveLevelControlProps {
        levelIdx:number;
        numLevels:number;
    }

    const MLMoveLevelControl:React.FC<MLMoveLevelControlProps> = (props) => {

        const handleClick = (direction) => {
            dispatcher.dispatch<typeof Actions.MLChangeLevel>({
                name: Actions.MLChangeLevel.name,
                payload: {
                    levelIdx: props.levelIdx,
                    direction: direction
                }
            });
        };

        const iconStyle = {cursor: 'pointer'};
        return (
            <S.MLMoveLevelControl>
                {props.levelIdx > 0 ?
                    <a onClick={handleClick.bind(null, 'up')}>
                        <layoutViews.ImgWithMouseover
                                src={he.createStaticUrl('img/sort_asc.svg')}
                                style={iconStyle}
                                alt={he.translate('freq__move_level_down')} />
                    </a> :
                    <img src={he.createStaticUrl('img/sort_asc_grey.svg')} />
                }
                {props.levelIdx < props.numLevels - 1 ?
                    <a onClick={handleClick.bind(null, 'down')}>
                        <layoutViews.ImgWithMouseover
                                src={he.createStaticUrl('img/sort_desc.svg')}
                                style={iconStyle}
                                alt={he.translate('freq__move_level_up')} />
                    </a> :
                    <img src={he.createStaticUrl('img/sort_desc_grey.svg')}  />
                }
            </S.MLMoveLevelControl>
        );
    };

    // ---------------------- <SingleLevelField /> ---------------------

    interface SingleLevelFieldTRProps {
        levelIdx:number;
        attrList:Array<Kontext.AttrItem>;
        mlxAttrValue:string;
        mlxicaseValue:boolean;
        positionRangeLabels:Array<string>;
        mlxctxIndex:number;
        alignType:AlignTypes;
        numLevels:number;
        isRemovable:boolean;
    }

    const SingleLevelFieldTR:React.FC<SingleLevelFieldTRProps> = (props) => {

        const handleRemoveLevelClick = () => {
            dispatcher.dispatch<typeof Actions.MLRemoveLevel>({
                name: Actions.MLRemoveLevel.name,
                payload: {
                    levelIdx: props.levelIdx
                }
            });
        };

        return (
            <tr className="level-line">
                <td className="level">{props.levelIdx + 1}.</td>
                <td>
                    <MLAttrSelection
                            attrList={props.attrList}
                            levelIdx={props.levelIdx}
                            mlxAttrValue={props.mlxAttrValue} />
                </td>
                <td>
                    <MLIgnoreCaseCheckbox
                            levelIdx={props.levelIdx}
                            mlxicaseValue={props.mlxicaseValue} />
                </td>
                <td>
                    <MLPositionSelect positionRangeLabels={props.positionRangeLabels}
                            levelIdx={props.levelIdx}
                            mlxctxIndex={props.mlxctxIndex} />
                </td>
                <td>
                    <MLPosAlignmentSelect
                            levelIdx={props.levelIdx}
                            alignType={props.alignType} />
                </td>
                <td>
                    <MLMoveLevelControl levelIdx={props.levelIdx} numLevels={props.numLevels} />
                </td>
                <td>
                    {props.isRemovable ?
                        (<a onClick={handleRemoveLevelClick}>
                            <img src={he.createStaticUrl('img/close-icon.svg')}
                                    alt={he.translate('freq__remove_level_btn')}
                                    style={{width: '1em'}} />
                        </a>)
                    : null}
                </td>
            </tr>
        );
    };


    // ---------------------- <MLFreqForm /> ---------------------

    class MLFreqForm extends React.Component<MLFreqFormModelState> {

        constructor(props) {
            super(props);
            this._handleAddLevelClick = this._handleAddLevelClick.bind(this);
        }

        _handleAddLevelClick() {
            dispatcher.dispatch<typeof Actions.MLAddLevel>({
                name: Actions.MLAddLevel.name,
                payload: {}
            });
        }

        render() {
            const levels = List.map((_, i) => i, this.props.mlxattr);
            return (
                <S.MLFreqForm>
                    <tbody>
                        <tr>
                            <td>
                                <label style={{fontWeight: 'bold'}}>
                                    {he.translate('freq__freq_limit_label')}:{'\u00a0'}
                                    <FreqLimitInput flimit={this.props.flimit} actionName={Actions.MLSetFLimit.name} />
                                </label>
                            </td>
                            <td />
                        </tr>
                        <tr>
                            <td colSpan={2}>
                                <table className="multilevel-freq-params">
                                    <tbody>
                                        <tr>
                                            <th>
                                                {he.translate('freq__ml_th_level')}
                                            </th>
                                            <th>
                                                {he.translate('freq__ml_th_attribute')}
                                            </th>
                                            <th>
                                                {he.translate('freq__ml_th_icase')}
                                            </th>
                                            <th>
                                                {he.translate('freq__ml_th_position')}
                                            </th>
                                            <th>
                                                {he.translate('freq__ml_th_node_start_at')}
                                            </th>
                                            <th />
                                            <th />
                                        </tr>
                                        {levels.map(item => {
                                            return <SingleLevelFieldTR
                                                        key={`level_${item}`}
                                                        isRemovable={item > 0 || levels.length > 1}
                                                        numLevels={levels.length}
                                                        levelIdx={item}
                                                        attrList={this.props.attrList}
                                                        mlxAttrValue={this.props.mlxattr[item]}
                                                        mlxicaseValue={this.props.mlxicase[item]}
                                                        positionRangeLabels={mlFreqFormModel.getPositionRangeLabels()}
                                                        mlxctxIndex={this.props.mlxctxIndices[item]}
                                                        alignType={this.props.alignType[item]} />;
                                        })}
                                        {levels.length < this.props.maxNumLevels ?
                                            (<tr>
                                                <td>
                                                    <layoutViews.PlusButton mouseOverHint={he.translate('freq__add_level_btn')}
                                                        onClick={this._handleAddLevelClick} />
                                                </td>
                                                <td colSpan={6} />
                                            </tr>)
                                        : null}
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </S.MLFreqForm>
            );
        }
    }

    return {
        TTFreqForm: BoundWithProps(TTFreqForm, ttFreqFormModel),
        MLFreqForm: BoundWithProps(MLFreqForm, mlFreqFormModel)
    };
}