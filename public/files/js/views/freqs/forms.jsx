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


export function init(dispatcher, he, layoutViews, mlFreqFormStore, ttFreqFormStore, ctFreqStore) {

    // ---------------------- <StructAttrSelect /> --------------------------------------------

    const StructAttrSelect = (props) => {

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
                    {props.structAttrList.map((item, i) => {
                        return (
                            <tr key={`item_${i}`}>
                                <td>
                                    <label htmlFor={`ttsort_${i}`}>{item.label}</label>
                                </td>
                                <td>
                                    <input id={`ttsort_${i}`}
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
        );
    };

    // ---------------------- <StructAttrSelect /> --------------------------------------------

    const FreqLimitInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: `${props.actionPrefix}_SET_FLIMIT`,
                props: {
                    value: evt.target.value
                }
            });
        };

        return <input type="text" name="flimit" value={props.flimit}
                    style={{width: '3em'}} onChange={handleInputChange} />;
    };

    // ---------------------- <IncludeEmptyCheckbox /> --------------------------------------------

    const IncludeEmptyCheckbox = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch({
                actionType: 'FREQ_TT_SET_FTT_INCLUDE_EMPTY',
                props: {}
            });
        };

        return <input type="checkbox" checked={props.fttIncludeEmpty}
                    onChange={handleCheckboxChange} />;
    };

    // ---------------------- <TTFreqForm /> --------------------------------------------

    class TTFreqForm extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._getStoreState();
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
        }

        _getStoreState() {
            return {
                structAttrList: ttFreqFormStore.getStructAttrList(),
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

        render() {
            return (
                <table className="form">
                    <tbody>
                        <tr>
                            <th>
                                {he.translate('freq__freq_limit_label')}:
                            </th>
                            <td>
                                <FreqLimitInput flimit={this.state.flimit} actionPrefix="FREQ_TT" />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {he.translate('freq__incl_no_hits_cats_label')}:
                            </th>
                            <td>
                                <IncludeEmptyCheckbox fttIncludeEmpty={this.state.fttIncludeEmpty} />
                            </td>
                        </tr>
                        <tr>
                            <td colSpan="2">
                                <StructAttrSelect structAttrList={this.state.structAttrList}
                                        fttattr={this.state.fttattr} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }

    // -------------------- <CTFreqFormMinFreqInput /> --------------------------------------------

    const CTFreqFormMinFreqInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_MIN_ABS_FREQ',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('freq__ct_min_freq_label')}:{'\u00a0'}
                <input type="text" onChange={handleInputChange}
                        value={props.value} style={{width: '3em'}} />
            </label>
        );
    };

    // -------- <CTFreqPosSelect /> --------------------------------

    const CTFreqPosSelect = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_CTX',
                props: {
                    dim: props.dim,
                    value: parseInt(evt.target.value, 10)
                }
            });
        };

        return (
            <select value={props.value} onChange={handleChange}>
                {props.positionRangeLabels.map((item, i) => <option key={i} value={i}>{item}</option>)}
            </select>
        );
    };

    // -------- <CTFreqNodeStartSelect /> --------------------------------

    const CTFreqNodeStartSelect = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_ALIGN_TYPE',
                props: {
                    dim: props.dim,
                    value: evt.target.value
                }
            });
        };

        return (
            <select onChange={handleChange} value={props.value}>
                <option>{he.translate('freq__align_type_left')}</option>
                <option>{he.translate('freq__align_type_right')}</option>
            </select>
        );
    };

    // -------------------- <CTFreqForm /> --------------------------------------------

    class CTFreqForm extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchState();
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._handleAttrSelChange = this._handleAttrSelChange.bind(this);
        }


        _fetchState() {
            return {
                posAttrs: ctFreqStore.getPosAttrs(),
                structAttrs: ctFreqStore.getStructAttrs(),
                attr1: ctFreqStore.getAttr1(),
                attr1IsStruct: ctFreqStore.getAttr1IsStruct(),
                attr2: ctFreqStore.getAttr2(),
                attr2IsStruct: ctFreqStore.getAttr2IsStruct(),
                minAbsFreq: ctFreqStore.getMinAbsFreq(),
                setupError: ctFreqStore.getSetupError(),
                positionRangeLabels: ctFreqStore.getPositionRangeLabels(),
                alignType1: ctFreqStore.getAlignType(1),
                alignType2: ctFreqStore.getAlignType(2),
                ctxIndex1: ctFreqStore.getCtxIndex(1),
                ctxIndex2: ctFreqStore.getCtxIndex(2)
            };
        }

        getInitialState() {
            return this._fetchState();
        }

        componentDidMount() {
            ctFreqStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            ctFreqStore.removeChangeListener(this._storeChangeHandler);
        }

        _storeChangeHandler() {
            this.setState(this._fetchState());
        }

        _handleAttrSelChange(dimension, evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_FORM_SET_DIMENSION_ATTR',
                props: {
                    dimension: dimension,
                    value: evt.target.value
                }
            });
        }

        _rendersetupError() {
            if (this.state.setupError) {
                return (
                    <p className="setup-warning">
                        <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning')} />
                        {this.state.setupError}
                    </p>
                );

            } else {
                return null;
            }
        }

        _renderPosAttrOpts(dim, alignType) {
            return [
                <tr key="label">
                    <th>
                        {he.translate('freq__ml_th_position')}:
                    </th>
                    <td>
                        <CTFreqPosSelect
                                positionRangeLabels={this.state.positionRangeLabels}
                                dim={dim}
                                value={dim === 1 ? this.state.ctxIndex1 : this.state.ctxIndex2} />
                    </td>
                </tr>,
                <tr key="input">
                    <th>
                        {he.translate('freq__ml_th_node_start_at')}:
                    </th>
                    <td>
                        <CTFreqNodeStartSelect
                                dim={dim}
                                value={dim === 1 ? this.state.alignType1 : this.state.alignType2} />
                    </td>
                </tr>
            ];
        }

        render() {
            return (
                <div className="CTFreqForm">
                    <div>
                        {this._rendersetupError()}
                    </div>
                    <div className="toolbar">
                            <CTFreqFormMinFreqInput value={this.state.minAbsFreq} />
                    </div>
                    <table className="form">
                        <tbody className="dim1">
                            <tr>
                                <th className="main" rowSpan="3">
                                    <strong>1.</strong>
                                    ({he.translate('freq__ct_dim1')})
                                </th>
                                <th>
                                    {he.translate('freq__ml_th_attribute')}:
                                </th>
                                <td>
                                    <select onChange={this._handleAttrSelChange.bind(this, 1)}
                                            value={this.state.attr1}>
                                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                                            {this.state.posAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                                            {this.state.structAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                    </select>
                                </td>
                            </tr>
                            {!this.state.attr1IsStruct ? this._renderPosAttrOpts(1) : <tr><td colSpan="2" rowSpan="2" /></tr>}
                        </tbody>
                        <tbody className="dim2">
                            <tr>
                                <th className="main" rowSpan="3">
                                    <strong>2.</strong>
                                    ({he.translate('freq__ct_dim2')})
                                </th>
                                <th>
                                    {he.translate('freq__ml_th_attribute')}:
                                </th>
                                <td>
                                    <select onChange={this._handleAttrSelChange.bind(this, 2)}
                                            value={this.state.attr2}>
                                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                                            {this.state.posAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                                            {this.state.structAttrs.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                    </select>
                                </td>
                            </tr>
                            {!this.state.attr2IsStruct ? this._renderPosAttrOpts(2) : <tr><td colSpan="2" rowSpan="2" /></tr>}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    // -------------------- <MLAttrSelection /> --------------------------------------------

    const MLAttrSelection = (props) => {

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

    const MLIgnoreCaseCheckbox = (props) => {

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

    const MLPositionSelect = (props) => {

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

    const MLPosAlignmentSelect = (props) => {

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

    const MLMoveLevelControl = (props) => {

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

    const SingleLevelFieldTR = (props) => {

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

    class MLFreqForm extends React.Component {

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
                <table className="form">
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


    // ---------------------- <FrequencyForm /> ---------------------

    class FrequencyForm extends React.Component {

        constructor(props) {
            super(props);
            this.state = {formType: this.props.initialFreqFormVariant};
            this._handleFormSwitch = this._handleFormSwitch.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _handleFormSwitch(evt) {
            this.setState({
                formType: evt.target.value
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
                    return <CTFreqForm />;
                default:
                     return null;
            }
        }

        render() {
            return (
                <form className="freq-form">
                    <fieldset>
                        <legend>
                            <select onChange={this._handleFormSwitch} value={this.state.formType}>
                                <option value="ml">
                                    {he.translate('freq__sel_form_type_ml')}
                                </option>
                                <option value="tt">
                                    {he.translate('freq__sel_form_type_tt')}
                                </option>
                                <option value="ct">
                                    {he.translate('freq__sel_form_type_ct')}
                                </option>
                            </select>
                        </legend>
                        {this._renderContents()}
                    </fieldset>
                    <div className="buttons">
                        <button className="default-button" type="button" onClick={this._handleSubmitClick}>
                            {he.translate('freq__make_freq_list_btn')}
                        </button>
                    </div>
                </form>
            );
        }
    }


    return {
        FrequencyForm: FrequencyForm
    };
}

