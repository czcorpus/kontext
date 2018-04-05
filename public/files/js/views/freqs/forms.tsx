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
import * as Immutable from 'immutable';

import {Kontext} from '../../types/common';
import {MLFreqFormModel, TTFreqFormModel} from '../../models/freqs/freqForms';
import {Freq2DFormModel, FreqFilterQuantities, AlignTypes, Dimensions} from '../../models/freqs/ctFreqForm';
import {init as ctFreqFormFactory} from './ctFreqForm';
import {ActionDispatcher} from '../../app/dispatcher';

// -------------------------- exported component ----------

interface FrequencyFormProps {
    initialFreqFormVariant:string;
}

interface FrequencyFormState {
    formType:string;
}

export interface FormsViews {
    FrequencyForm:React.ComponentClass<FrequencyFormProps>;
}


export function init(
        dispatcher:ActionDispatcher,
        he:Kontext.ComponentHelpers,
        mlFreqFormModel:MLFreqFormModel,
        ttFreqFormModel:TTFreqFormModel,
        cTFreqFormModel:Freq2DFormModel):FormsViews {

    const layoutViews = he.getLayoutViews();
    const ctFreqForm = ctFreqFormFactory(dispatcher, he, cTFreqFormModel);

    // ---------------------- <StructAttrSelect /> --------------------------------------------

    interface StructAttrSelectProps {
        structAttrListSplitTypes:Immutable.List<Immutable.List<Kontext.AttrItem>>;
        fttattr:Immutable.Set<string>;
    }

    const StructAttrSelect:React.SFC<StructAttrSelectProps> = (props) => {

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
                <thead>
                    <tr>
                        <th colSpan={props.structAttrListSplitTypes.size}>
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

    const FreqLimitInput:React.SFC<{
        actionPrefix:string;
        flimit:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: `${props.actionPrefix}_SET_FLIMIT`,
                props: {
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

    const IncludeEmptyCheckbox:React.SFC<IncludeEmptyCheckboxProps> = (props) => {

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

    class TTFreqForm extends React.Component<TTFreqFormProps, {
        flimit:Kontext.FormValue<string>;
        structAttrListSplitTypes:Immutable.List<Immutable.List<Kontext.AttrItem>>;
        fttattr:Immutable.Set<string>;
        fttIncludeEmpty:boolean;

    }> {

        constructor(props:TTFreqFormProps) {
            super(props);
            this.state = this._getModelState();
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
        }

        _getModelState() {
            return {
                structAttrListSplitTypes: ttFreqFormModel.getStructAttrListSplitTypes(),
                fttattr: ttFreqFormModel.getFttattr(),
                fttIncludeEmpty: ttFreqFormModel.getFttIncludeEmpty(),
                flimit: ttFreqFormModel.getFlimit()
            };
        }

        _modelChangeHandler() {
            this.setState(this._getModelState());
        }

        componentDidMount() {
            ttFreqFormModel.addChangeListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            ttFreqFormModel.removeChangeListener(this._modelChangeHandler);
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
                                <td colSpan={2}>
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

    const MLAttrSelection:React.SFC<MLAttrSelectionProps> = (props) => {

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
        mlxicaseValue:boolean;
    }

    const MLIgnoreCaseCheckbox:React.SFC<MLIgnoreCaseCheckboxProps> = (props) => {

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

    const MLPositionSelect:React.SFC<MLPositionSelectProps> = (props) => {

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

    const MLPosAlignmentSelect:React.SFC<MLPosAlignmentSelectProps> = (props) => {

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

    const MLMoveLevelControl:React.SFC<MLMoveLevelControlProps> = (props) => {

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
        mlxicaseValue:boolean;
        positionRangeLabels:Array<string>;
        mlxctxIndex:number;
        alignType:AlignTypes;
        numLevels:number;
        isRemovable:boolean;
    }

    const SingleLevelFieldTR:React.SFC<SingleLevelFieldTRProps> = (props) => {

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
        flimit:Kontext.FormValue<string>;
        levels:Immutable.List<number>;
        mlxattrValues:Immutable.List<string>;
        mlxicaseValues:Immutable.List<boolean>;
        positionRangeLabels:Array<string>;
        mlxctxIndices:Immutable.List<number>;
        alignTypes:Immutable.List<AlignTypes>;
        maxNumLevels:number;
    }

    class MLFreqForm extends React.Component<MLFreqFormProps, MLFreqFormState> {

        constructor(props) {
            super(props);
            this.state = this._getModelState();
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._handleAddLevelClick = this._handleAddLevelClick.bind(this);
        }

        _getModelState() {
            return {
                attrList: mlFreqFormModel.getAttrList(),
                flimit: mlFreqFormModel.getFlimit(),
                levels: mlFreqFormModel.getLevels(),
                mlxattrValues: mlFreqFormModel.getMlxattrValues(),
                mlxicaseValues: mlFreqFormModel.getMlxicaseValues(),
                positionRangeLabels: mlFreqFormModel.getPositionRangeLabels(),
                mlxctxIndices: mlFreqFormModel.getMlxctxIndices(),
                alignTypes: mlFreqFormModel.getAlignTypes(),
                maxNumLevels: mlFreqFormModel.getMaxNumLevels()
            };
        }

        _modelChangeHandler() {
            this.setState(this._getModelState());
        }

        _handleAddLevelClick() {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_ADD_LEVEL',
                props: {}
            });
        }

        componentDidMount() {
            mlFreqFormModel.addChangeListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            mlFreqFormModel.removeChangeListener(this._modelChangeHandler);
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
                                                <td colSpan={6} />
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

    const FreqFormSelector:React.SFC<FreqFormSelectorProps> = (props) => {

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

