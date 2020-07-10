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
import {MLFreqFormModel, TTFreqFormModel, MLFreqFormModelState} from '../../models/freqs/freqForms';
import {Freq2DFormModel, AlignTypes} from '../../models/freqs/ctFreqForm';
import {init as ctFreqFormFactory} from './ctFreqForm';
import {IActionDispatcher, BoundWithProps} from 'kombo';
import { Subscription } from 'rxjs';

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
        dispatcher:IActionDispatcher,
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
                name: 'FREQ_TT_SET_FTTATTR',
                payload: {
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
                name: `${props.actionPrefix}_SET_FLIMIT`,
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

    const IncludeEmptyCheckbox:React.SFC<IncludeEmptyCheckboxProps> = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch({
                name: 'FREQ_TT_SET_FTT_INCLUDE_EMPTY',
                payload: {}
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

        private modelSubscription:Subscription;

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
            this.modelSubscription = ttFreqFormModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
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
                name: 'FREQ_ML_SET_MLXATTR',
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

    const MLIgnoreCaseCheckbox:React.SFC<MLIgnoreCaseCheckboxProps> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                name: 'FREQ_ML_SET_MLXICASE',
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

    const MLPositionSelect:React.SFC<MLPositionSelectProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_ML_SET_MLXCTX_INDEX',
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

    const MLPosAlignmentSelect:React.SFC<MLPosAlignmentSelectProps> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_ML_SET_ALIGN_TYPE',
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

    const MLMoveLevelControl:React.SFC<MLMoveLevelControlProps> = (props) => {

        const handleClick = (direction) => {
            dispatcher.dispatch({
                name: 'FREQ_ML_CHANGE_LEVEL',
                payload: {
                    levelIdx: props.levelIdx,
                    direction: direction
                }
            });
        };

        const iconStyle = {cursor: 'pointer'};
        return (
            <div className="MLMoveLevelControl">
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
                name: 'FREQ_ML_REMOVE_LEVEL',
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

    interface MLFreqFormProps {

    }

    class MLFreqForm extends React.Component<MLFreqFormProps & MLFreqFormModelState> {

        constructor(props) {
            super(props);
            this._handleAddLevelClick = this._handleAddLevelClick.bind(this);
        }

        _handleAddLevelClick() {
            dispatcher.dispatch({
                name: 'FREQ_ML_ADD_LEVEL',
                payload: {}
            });
        }

        render() {
            const levels = this.props.mlxattr.map((_, i) => i).toList();
            return (
                <table className="MLFreqForm">
                    <tbody>
                        <tr>
                            <td>
                                <label style={{fontWeight: 'bold'}}>
                                    {he.translate('freq__freq_limit_label')}:{'\u00a0'}
                                    <FreqLimitInput flimit={this.props.flimit} actionPrefix="FREQ_ML" />
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
                                                        isRemovable={item > 0 || levels.size > 1}
                                                        numLevels={levels.size}
                                                        levelIdx={item}
                                                        attrList={this.props.attrList}
                                                        mlxAttrValue={this.props.mlxattr.get(item)}
                                                        mlxicaseValue={this.props.mlxicase.get(item)}
                                                        positionRangeLabels={mlFreqFormModel.getPositionRangeLabels()}
                                                        mlxctxIndex={this.props.mlxctxIndices.get(item)}
                                                        alignType={this.props.alignType.get(item)} />;
                                        })}
                                        {levels.size < this.props.maxNumLevels ?
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
                </table>
            );
        }
    }

    const BoundMLFreqForm = BoundWithProps(MLFreqForm, mlFreqFormModel);

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
                name: actions[this.state.formType],
                payload: {}
            });
        }

        render() {
            const items = Immutable.List([
                {id: 'ml', label: he.translate('freq__sel_form_type_ml')},
                {id: 'tt', label: he.translate('freq__sel_form_type_tt')},
                {id: 'ct', label: he.translate('freq__sel_form_type_ct')},
            ])

            return (
                <div className="FrequencyForm">
                    <form className="freq-form">
                        <layoutViews.TabView
                            className="FreqFormSelector"
                            defaultId={this.state.formType}
                            callback={this._handleFormSwitch}
                            items={items.toArray()} >

                            <MLFreqForm />
                            <TTFreqForm />
                            <ctFreqForm.CTFreqForm />
                        </layoutViews.TabView>

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

