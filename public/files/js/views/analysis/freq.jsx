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


import React from 'vendor/react';


export function init(dispatcher, mixins, layoutViews, mlFreqFormStore, ttFreqFormStore) {

    // ---------------------- <StructAttrSelect /> --------------------------------------------

    const StructAttrSelect = React.createClass({

        _handleCheckboxChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_TT_SET_FTTATTR',
                props : {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <table className="struct-attr-list">
                    <tbody>
                        {this.props.structAttrList.map((item, i) => {
                            return (
                                <tr key={`item_${i}`}>
                                    <td>
                                        <label htmlFor={`ttsort_${i}`}>{item.label}</label>
                                    </td>
                                    <td>
                                        <input id={`ttsort_${i}`}
                                            type="checkbox"
                                            value={item.n}
                                            checked={this.props.fttattr.contains(item.n)}
                                            onChange={this._handleCheckboxChange}  />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
        }
    });

    // ---------------------- <StructAttrSelect /> --------------------------------------------

    const FreqLimitInput = React.createClass({

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: `${this.props.actionPrefix}_SET_FLIMIT`,
                props: {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return <input type="text" name="flimit" value={this.props.flimit}
                        style={{width: '3em'}} onChange={this._handleInputChange} />;
        }
    });

    // ---------------------- <IncludeEmptyCheckbox /> --------------------------------------------

    const IncludeEmptyCheckbox = React.createClass({

        _handleCheckboxChange : function () {
            dispatcher.dispatch({
                actionType: 'FREQ_TT_SET_FTT_INCLUDE_EMPTY',
                props: {}
            });
        },

        render : function () {
            return <input type="checkbox" checked={this.props.fttIncludeEmpty}
                        onChange={this._handleCheckboxChange} />;
        }
    });

    // ---------------------- <TTFreqForm /> --------------------------------------------

    const TTFreqForm = React.createClass({

        mixins : mixins,

        _getStoreState : function () {
            return {
                structAttrList: ttFreqFormStore.getStructAttrList(),
                fttattr: ttFreqFormStore.getFttattr(),
                fttIncludeEmpty: ttFreqFormStore.getFttIncludeEmpty(),
                flimit: ttFreqFormStore.getFlimit()
            };
        },

        getInitialState : function () {
            return this._getStoreState();
        },

        _storeChangeHandler : function () {
            this.setState(this._getStoreState());
        },

        componentDidMount : function () {
            ttFreqFormStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            ttFreqFormStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <table className="form">
                    <tbody>
                        <tr>
                            <th>
                                {this.translate('freq__freq_limit_label')}:
                            </th>
                            <td>
                                <FreqLimitInput flimit={this.state.flimit} actionPrefix="FREQ_TT" />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {this.translate('freq__incl_no_hits_cats_label')}:
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
    });


    // -------------------- <CTFreqForm /> --------------------------------------------

    const CTFreqForm = React.createClass({

        mixins: mixins,

        render : function () {
            return (
                <table className="form">
                    <tbody>
                        <tr>
                            <th>
                                1. dimension
                            </th>
                            <td>
                                <label>
                                    Attribute
                                    <select>
                                        <option>
                                        </option>
                                    </select>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th>
                                2. dimension
                            </th>
                            <td>
                                <select>
                                    <option>
                                    </option>
                                </select>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // -------------------- <MLAttrSelection /> --------------------------------------------

    const MLAttrSelection = React.createClass({

        _handleSelection : function (evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_MLXATTR',
                props: {
                    levelIdx: this.props.levelIdx,
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <select onChange={this._handleSelection} value={this.props.mlxAttrValue}>
                    {this.props.attrList.map(item => {
                        return <option key={item.n} value={item.n}>{item.label}</option>
                    })}
                </select>
            );
        }
    });


    // ---------------------- <MLIgnoreCaseCheckbox /> ---------------------

    const MLIgnoreCaseCheckbox = React.createClass({

        _handleChange : function () {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_MLXICASE',
                props: {
                    levelIdx: this.props.levelIdx
                }
            });
        },

        render : function () {
            return <input type="checkbox" onChange={this._handleChange} checked={this.props.mlxicaseValue} />;
        }
    });


    // ---------------------- <MLPositionSelect /> ---------------------

    const MLPositionSelect = React.createClass({

        _handleSelection : function (evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_MLXCTX_INDEX',
                props: {
                    levelIdx: this.props.levelIdx,
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <select onChange={this._handleSelection} value={this.props.mlxctxIndex}>
                    {this.props.positionRangeLabels.map((item, i) => {
                        return <option key={`opt_${i}`} value={i}>{item}</option>;
                    })}
                </select>
            );
        }
    });


    // ---------------------- <MLPosAlignmentSelect /> ---------------------

    const MLPosAlignmentSelect = React.createClass({

        mixins : mixins,

        _handleSelection : function (evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_SET_ALIGN_TYPE',
                props: {
                    levelIdx: this.props.levelIdx,
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <select className="kwic-alignment" value={this.props.alignType}
                        onChange={this._handleSelection}>
                    <option value="left">{this.translate('freq__align_type_left')}</option>
                    <option value="right">{this.translate('freq__align_type_right')}</option>
                </select>
            );
        }
    });

    // ---------------------- <MLMoveLevelControl /> ---------------------

    const MLMoveLevelControl = React.createClass({

        mixins : mixins,

        _handleClick : function (direction) {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_CHANGE_LEVEL',
                props: {
                    levelIdx: this.props.levelIdx,
                    direction: direction
                }
            });
        },

        render : function () {
            const iconStyle = {cursor: 'pointer'};
            return (
                <div>
                    {this.props.levelIdx < this.props.numLevels - 1 ?
                        <img src={this.createStaticUrl('img/sort_desc.svg')} style={iconStyle}
                                onClick={this._handleClick.bind(this, 'down')}
                                alt={this.translate('freq__move_level_up')} />
                        : null}
                    {this.props.levelIdx > 0 ?
                        <img src={this.createStaticUrl('img/sort_asc.svg')} style={iconStyle}
                                onClick={this._handleClick.bind(this, 'up')}
                                alt={this.translate('freq__move_level_down')} />
                        : null}
                </div>
            );
        }

    });

    // ---------------------- <SingleLevelField /> ---------------------

    const SingleLevelFieldTR = React.createClass({

        mixins : mixins,

        _handleRemoveLevelClick : function () {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_REMOVE_LEVEL',
                props: {
                    levelIdx: this.props.levelIdx
                }
            });
        },

        render : function () {
            return (
                <tr className="level-line">
                    <td className="level">{this.props.levelIdx + 1}.</td>
                    <td>
                        <MLAttrSelection
                                attrList={this.props.attrList}
                                levelIdx={this.props.levelIdx}
                                mlxAttrValue={this.props.mlxAttrValue} />
                    </td>
                    <td>
                        <MLIgnoreCaseCheckbox
                                levelIdx={this.props.levelIdx}
                                mlxicaseValue={this.props.mlxicaseValue} />
                    </td>
                    <td>
                        <MLPositionSelect positionRangeLabels={this.props.positionRangeLabels}
                                levelIdx={this.props.levelIdx}
                                mlxctxIndex={this.props.mlxctxIndex} />
                    </td>
                    <td>
                        <MLPosAlignmentSelect
                                levelIdx={this.props.levelIdx}
                                alignType={this.props.alignType} />
                    </td>
                    <td>
                        <MLMoveLevelControl levelIdx={this.props.levelIdx} numLevels={this.props.numLevels} />
                    </td>
                    <td>
                        {this.props.isRemovable ?
                            (<a onClick={this._handleRemoveLevelClick}>
                                <img src={this.createStaticUrl('img/close-icon.svg')}
                                        alt={this.translate('freq__remove_level_btn')}
                                        style={{width: '1em'}} />
                            </a>)
                        : null}
                    </td>
                </tr>
            );
        }

    });


    // ---------------------- <MLFreqForm /> ---------------------

    const MLFreqForm = React.createClass({

        mixins : mixins,

        _getStoreState : function () {
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
        },

        getInitialState : function () {
            return this._getStoreState();
        },

        _storeChangeHandler : function () {
            this.setState(this._getStoreState());
        },

        _handleAddLevelClick : function () {
            dispatcher.dispatch({
                actionType: 'FREQ_ML_ADD_LEVEL',
                props: {}
            });
        },

        componentDidMount : function () {
            mlFreqFormStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            mlFreqFormStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <table className="form">
                    <tbody>
                        <tr>
                            <th>
                                {this.translate('freq__freq_limit_label')}:
                            </th>
                            <td>
                                <FreqLimitInput flimit={this.state.flimit} actionPrefix="FREQ_ML" />
                            </td>
                        </tr>
                        <tr>
                            <td colSpan="2">
                                <table className="multilevel-freq-params">
                                    <tbody>
                                        <tr>
                                            <th>
                                                {this.translate('freq__ml_th_level')}
                                            </th>
                                            <th>
                                                {this.translate('freq__ml_th_attribute')}
                                            </th>
                                            <th>
                                                {this.translate('freq__ml_th_icase')}
                                            </th>
                                            <th>
                                                {this.translate('freq__ml_th_position')}
                                            </th>
                                            <th>
                                                {this.translate('freq__ml_th_node_start_at')}
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
                                                    <a id="add-freq-level-button" title={this.translate('freq__add_level_btn')}
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

    });


    // ---------------------- <FrequencyForm /> ---------------------

    const FrequencyForm = React.createClass({

        mixins : mixins,

        _handleFormSwitch : function (evt) {
            this.setState({
                formType: evt.target.value
            });
        },

        _handleSubmitClick : function () {
            if (this.state.formType === 'ml') {
                dispatcher.dispatch({
                    actionType: 'FREQ_ML_SUBMIT',
                    props: {}
                });

            } else if (this.state.formType === 'tt') {
                dispatcher.dispatch({
                    actionType: 'FREQ_TT_SUBMIT',
                    props: {}
                });
            }
        },

        getInitialState : function () {
            return {
                formType: this.props.initialFreqFormVariant
            };
        },

        _renderContents : function () {
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
        },

        render : function () {
            return (
                <form className="freq-form">
                    <fieldset>
                        <legend>
                            <select onChange={this._handleFormSwitch} value={this.state.formType}>
                                <option value="ml">
                                    {this.translate('freq__sel_form_type_ml')}
                                </option>
                                <option value="tt">
                                    {this.translate('freq__sel_form_type_tt')}
                                </option>
                                <option value="ct">
                                    {this.translate('freq__sel_form_type_ct')}
                                </option>
                            </select>
                        </legend>
                        {this._renderContents()}
                    </fieldset>
                    <div className="buttons">
                        <button className="default-button" type="button" onClick={this._handleSubmitClick}>
                            {this.translate('freq__make_freq_list_btn')}
                        </button>
                    </div>
                </form>
            );
        }

    });


    return {
        FrequencyForm: FrequencyForm
    };
}

