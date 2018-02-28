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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';
import * as Immutable from 'immutable';

import {Kontext} from '../../types/common';
import {MLFreqFormStore, TTFreqFormStore} from '../../stores/freqs/freqForms';
import {CTFreqFormStore, FreqFilterQuantities, AlignTypes, Dimensions} from '../../stores/freqs/ctFreqForm';
import {init as ctFreqFormFactory} from './ctFreqForm';
import {ActionDispatcher} from '../../app/dispatcher';

// -------------------------- exported component ----------

interface FrequencyFormProps {
    initialFreqFormVariant:string;
}

interface FrequencyFormState {
    formType:string;
}

export interface FreqFormViews {
    FrequencyForm:React.ComponentClass<FrequencyFormProps, FrequencyFormState>;
}


export function init(
        dispatcher:ActionDispatcher,
        he:Kontext.ComponentHelpers,
        mlFreqFormStore:MLFreqFormStore,
        ttFreqFormStore:TTFreqFormStore,
        cTFreqFormStore:CTFreqFormStore):FreqFormViews {

    const layoutViews = he.getLayoutViews();
    const ctFreqForm = ctFreqFormFactory(dispatcher, he, cTFreqFormStore);

    // ---------------------- <StructAttrSelect /> --------------------------------------------

    interface StructAttrSelectProps {
        structAttrListSplitTypes:Immutable.List<Immutable.List<Kontext.AttrItem>>;
        fttattr:Immutable.Set<string>;
    }

    const StructAttrSelect:React.FuncComponent<StructAttrSelectProps> = (props) => {

        const handleCheckboxChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_TT_SET_FTTATTR',
                props : {
                    value: evt.target.value
                }
            });
        };

        return (
            <table className="struct-attr-list">
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
                                                                checked={props.fttattr.contains(item.n)}
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

    interface FreqLimitInputProps {
        actionPrefix:string;
        flimit:string;
    }

    const FreqLimitInput:React.FuncComponent<FreqLimitInputProps> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: `${props.actionPrefix}_SET_FLIMIT`,
                props: {
                    value: evt.target.value
                }
            });
        };

        return <input id="freq-limit-input" type="text" name="flimit" value={props.flimit}
                    style={{width: '3em'}} onChange={handleInputChange} />;
    };

    // ---------------------- <IncludeEmptyCheckbox /> --------------------------------------------

    interface IncludeEmptyCheckboxProps {
        fttIncludeEmpty:boolean;
    }

    const IncludeEmptyCheckbox:React.FuncComponent<IncludeEmptyCheckboxProps> = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch({
                actionType: 'FREQ_TT_SET_FTT_INCLUDE_EMPTY',
                props: {}
            });
        };

        return <input id="include-empty-checkbox" type="checkbox" checked={props.fttIncludeEmpty}
                    onChange={handleCheckboxChange} />;
    };

    // ---------------------- <TTFreqForm /> --------------------------------------------

    interface TTFreqFormProps {
    }

    interface TTFreqFormState {
        flimit:string;
        structAttrListSplitTypes:Immutable.List<Immutable.List<Kontext.AttrItem>>;
        fttattr:Immutable.Set<String>;
        fttIncludeEmpty:boolean;
    }

    class TTFreqForm extends React.Component<TTFreqFormProps, TTFreqFormState> {

        constructor(props:TTFreqFormProps) {
            super(props);
            this.state = this._getStoreState();
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
        }

        _getStoreState():TTFreqFormState {
            return {
                structAttrListSplitTypes: ttFreqFormStore.getStructAttrListSplitTypes(),
                fttattr: ttFreqFormStore.getFttattr(),
                fttIncludeEmpty: ttFreqFormStore.getFttIncludeEmpty(),
                flimit: ttFreqFormStore.getFlimit()
            };
        }

        _storeChangeHandler() {
            this.setState(this._getStoreState());
        }

        componentDidMount() {
            ttFreqFormStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            ttFreqFormStore.removeChangeListener(this._storeChangeHandler);
        }

        render():React.ReactElement {
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
                                    <FreqLimitInput flimit={this.state.flimit} actionPrefix="FREQ_TT" />
                                </td>
                            </tr>
                            <tr>
                                <th>
                                    <label htmlFor="include-empty-checkbox">
                                        {he.translate('freq__incl_no_hits_cats_label')}:
                                    </label>
                                </th>
                                <td>
                                    <IncludeEmptyCheckbox fttIncludeEmpty={this.state.fttIncludeEmpty} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <table className="form">
                        <tbody>
                            <tr>
                                <td colSpan="2">
                                    <StructAttrSelect structAttrListSplitTypes={this.state.structAttrListSplitTypes}
                                            fttattr={this.state.fttattr} />
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
        attrList:Immutable.List<Kontext.AttrItem>;
    }

    const MLAttrSelection:React.FuncComponent<MLAttrSelectionProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_MLXATTR',
                props: {
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
        mlxicaseValue:string;
    }

    const MLIgnoreCaseCheckbox:React.FuncComponent<MLIgnoreCaseCheckboxProps> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_MLXICASE',
                props: {
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

    const MLPositionSelect:React.FuncComponent<MLPositionSelectProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_MLXCTX_INDEX',
                props: {
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

    const MLPosAlignmentSelect:React.FuncComponent<MLPosAlignmentSelectProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_ALIGN_TYPE',
                props: {
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

    const MLMoveLevelControl:React.FuncComponent<MLMoveLevelControlProps> = (props) => {

        const handleClick = (direction) => {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_CHANGE_LEVEL',
                props: {
                    levelIdx: props.levelIdx,
                    direction: direction
                }
            });
        };

        const iconStyle = {cursor: 'pointer'};
        return (
            <div>
                {props.levelIdx < props.numLevels - 1 ?
                    <img src={he.createStaticUrl('img/sort_desc.svg')} style={iconStyle}
                            onClick={handleClick.bind(null, 'down')}
                            alt={he.translate('freq__move_level_up')} />
                    : null}
                {props.levelIdx > 0 ?
                    <img src={he.createStaticUrl('img/sort_asc.svg')} style={iconStyle}
                            onClick={handleClick.bind(null, 'up')}
                            alt={he.translate('freq__move_level_down')} />
                    : null}
            </div>
        );
    };

    // ---------------------- <SingleLevelField /> ---------------------

    interface SingleLevelFieldTRProps {
        levelIdx:number;
        attrList:Immutable.List<Kontext.AttrItem>;
        mlxAttrValue:string;
        mlxicaseValue:string;
        positionRangeLabels:Array<string>;
        mlxctxIndex:number;
        alignType:string; // TODO use enum, use general align definition (not just CT)
        numLevels:number;
        isRemovable:boolean;
    }

    const SingleLevelFieldTR:React.FuncComponent<SingleLevelFieldTRProps> = (props) => {

        const handleRemoveLevelClick = () => {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_REMOVE_LEVEL',
                props: {
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

    interface MLFreqFormProps {

    }

    interface MLFreqFormState {
        attrList:Immutable.List<Kontext.AttrItem>;
        flimit:string;
        levels:Immutable.List<number>;
        mlxattrValues:Immutable.List<string>;
        mlxicaseValues:Immutable.List<boolean>;
        positionRangeLabels:Array<string>;
        mlxctxIndices:Immutable.List<number>;
        alignTypes:Immutable.List<string>;
        maxNumLevels:number;
    }

    class MLFreqForm extends React.Component<MLFreqFormProps, MLFreqFormState> {

        constructor(props) {
            super(props);
            this.state = this._getStoreState();
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._handleAddLevelClick = this._handleAddLevelClick.bind(this);
        }

        _getStoreState() {
            return {
                attrList: mlFreqFormStore.getAttrList(),
                flimit: mlFreqFormStore.getFlimit(),
                levels: mlFreqFormStore.getLevels(),
                mlxattrValues: mlFreqFormStore.getMlxattrValues(),
                mlxicaseValues: mlFreqFormStore.getMlxicaseValues(),
                positionRangeLabels: mlFreqFormStore.getPositionRangeLabels(),
                mlxctxIndices: mlFreqFormStore.getMlxctxIndices(),
                alignTypes: mlFreqFormStore.getAlignTypes(),
                maxNumLevels: mlFreqFormStore.getMaxNumLevels()
            };
        }

        _storeChangeHandler() {
            this.setState(this._getStoreState());
        }

        _handleAddLevelClick() {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_ADD_LEVEL',
                props: {}
            });
        }

        componentDidMount() {
            mlFreqFormStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            mlFreqFormStore.removeChangeListener(this._storeChangeHandler);
        }

        render() {
            return (
                <table className="MLFreqForm">
                    <tbody>
                        <tr>
                            <td>
                                <label style={{fontWeight: 'bold'}}>
                                    {he.translate('freq__freq_limit_label')}:{'\u00a0'}
                                    <FreqLimitInput flimit={this.state.flimit} actionPrefix="FREQ_ML" />
                                </label>
                            </td>
                            <td />
                        </tr>
                        <tr>
                            <td colSpan="2">
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
                                        {this.state.levels.map(item => {
                                            return <SingleLevelFieldTR
                                                        key={`level_${item}`}
                                                        isRemovable={item > 0 || this.state.levels.size > 1}
                                                        numLevels={this.state.levels.size}
                                                        levelIdx={item}
                                                        attrList={this.state.attrList}
                                                        mlxAttrValue={this.state.mlxattrValues.get(item)}
                                                        mlxicaseValue={this.state.mlxicaseValues.get(item)}
                                                        positionRangeLabels={this.state.positionRangeLabels}
                                                        mlxctxIndex={this.state.mlxctxIndices.get(item)}
                                                        alignType={this.state.alignTypes.get(item)} />;
                                        })}
                                        {this.state.levels.size < this.state.maxNumLevels ?
                                            (<tr>
                                                <td>
                                                    <a id="add-freq-level-button" title={he.translate('freq__add_level_btn')}
                                                        onClick={this._handleAddLevelClick}>+</a>
                                                </td>
                                                <td colSpan="6" />
                                            </tr>)
                                        : null}
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }


    // ---------------------- <FreqFormSelector /> ---------------------

    interface FreqFormSelectorProps {
        onChange:(ident:string)=>void;
        formType:string;
    }

    const FreqFormSelector:React.FuncComponent<FreqFormSelectorProps> = (props) => {

        const onItemClick = (ident) => {
            return () => {
                props.onChange(ident);
            }
        };

        return (
            <ul className="FreqFormSelector">
                <li>
                    <a className={props.formType === "ml" ? 'util-button active' : 'util-button'} onClick={onItemClick('ml')}>
                        {he.translate('freq__sel_form_type_ml')}
                    </a>
                </li>
                <li>
                    <a className={props.formType === "tt" ? 'util-button active' : 'util-button'} onClick={onItemClick('tt')}>
                        {he.translate('freq__sel_form_type_tt')}
                    </a>
                </li>
                <li>
                    <a className={props.formType === "ct" ? 'util-button active' : 'util-button'} onClick={onItemClick('ct')}>
                        {he.translate('freq__sel_form_type_ct')}
                    </a>
                </li>
            </ul>
        );
    };


    // ---------------------- <FrequencyForm /> ---------------------

    class FrequencyForm extends React.Component<FrequencyFormProps, FrequencyFormState> {

        constructor(props) {
            super(props);
            this.state = {formType: this.props.initialFreqFormVariant};
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
            this._handleFormSwitch = this._handleFormSwitch.bind(this);
        }

        _handleFormSwitch(value) {
            this.setState({
                formType: value
            });
        }

        _handleSubmitClick() {
            const actions = {
                ml: 'FREQ_ML_SUBMIT',
                tt: 'FREQ_TT_SUBMIT',
                ct: 'FREQ_CT_SUBMIT'
            };
            dispatcher.dispatch({
                actionType: actions[this.state.formType],
                props: {}
            });
        }

        _renderContents() {
            switch (this.state.formType) {
                case 'ml':
                    return <MLFreqForm />;
                case 'tt':
                    return <TTFreqForm />;
                case 'ct':
                    return <ctFreqForm.CTFreqForm />;
                default:
                     return null;
            }
        }

        render() {
            return (
                <div className="FrequencyForm">
                    <FreqFormSelector formType={this.state.formType} onChange={this._handleFormSwitch} />
                    <hr />
                    <form className="freq-form">
                        {this._renderContents()}
                        <div className="buttons">
                            <button className="default-button" type="button" onClick={this._handleSubmitClick}>
                                {he.translate('freq__make_freq_list_btn')}
                            </button>
                        </div>
                    </form>
                </div>
            );
        }
    }


    return {
        FrequencyForm: FrequencyForm
    };
}

