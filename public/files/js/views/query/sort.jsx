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


export function init(dispatcher, mixins, layoutViews, sortStore, multiLevelSortStore) {

    // -------------------------- <AttributeList /> ---------------------------------

    const AttributeList = React.createClass({

        _handleSelectChange : function (evt) {
            this.props.onAttrSelect(evt.target.value);
        },

        render : function () {
            return (
                <select value={this.props.currValue} onChange={this._handleSelectChange}>
                    {this.props.availAttrs.map((item, i) => <option key={`attr_${i}`} value={item.n}>{item.label}</option>)}
                </select>
            );
        }
    });

    // -------------------------- <SortKeySelector /> ---------------------------------

    const SortKeySelector = React.createClass({

        mixins : mixins,

        _handleSelect : function (value) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SKEY',
                props: {
                    sortId: this.props.sortId,
                    value: value
                }
            });
        },

        render : function () {
            return (
                <table className="radio-like-sel">
                    <tbody>
                        <tr>
                            <td className={this.props.currValue === 'lc' ? 'selected' : null}>
                                <a onClick={this._handleSelect.bind(this, 'lc')}>
                                    {'\u2026' + this.translate('query__sort_label_left_context') + '\u2026'}
                                </a>
                            </td>
                            <td className={this.props.currValue === 'kw' ? 'selected' : null}>
                                <a onClick={this._handleSelect.bind(this, 'kw')}>
                                    {this.translate('query__sort_label_node')}
                                </a>
                            </td>
                            <td className={this.props.currValue === 'rc' ? 'selected' : null}>
                                <a onClick={this._handleSelect.bind(this, 'rc')}>
                                    {'\u2026' + this.translate('query__sort_label_right_context') + '\u2026'}
                                </a>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // -------------------------- <SimpleSortForm /> ---------------------------------

    const SimpleSortForm = React.createClass({

        mixins : mixins,

        _handleAttrSelect : function (value) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SATTR',
                props: {
                    sortId: this.props.sortId,
                    value: value
                }
            });
        },

        _handleSicaseCheck : function (evt) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SICASE',
                props: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        },

        _handleSbwardCheck : function (evt) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SBWARD',
                props: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        },

        _handleSposChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SPOS',
                props: {
                    sortId: this.props.sortId,
                    value: evt.target.value
                }
            });
        },

        _fetchStateValues : function () {
            return {
                availAttrs: sortStore.getAllAvailAttrs(),
                sattr: sortStore.getSattrValues().get(this.props.sortId),
                skey: sortStore.getSkeyValues().get(this.props.sortId),
                spos: sortStore.getSposValues().get(this.props.sortId),
                sicase: sortStore.getSicaseValues().get(this.props.sortId),
                sbward: sortStore.getSbwardValues().get(this.props.sortId),
                backwardLabelHelpVisible: false
            };
        },

        getInitialState : function () {
            return this._fetchStateValues();
        },

        _handleStoreChange : function () {
            this.setState(this._fetchStateValues());
        },

        componentDidMount : function () {
            sortStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            sortStore.removeChangeListener(this._handleStoreChange);
        },

        _enableBackwardLabelHelp : function () {
            const state = this._fetchStateValues();
            state['backwardLabelHelpVisible'] = true;
            this.setState(state);
        },

        _backwardLabelHelpClose : function () {
            this.setState(this._fetchStateValues());
        },

        render : function () {
            return (
                <table className="form">
                    <tbody>
                        <tr>
                            <th>{this.translate('query__sort_th_attribute')}:</th>
                            <td>
                                <AttributeList availAttrs={this.state.availAttrs}
                                        onAttrSelect={this._handleAttrSelect}
                                        currValue={this.state.sattr} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {this.translate('query__sort_th_sort_key')}:
                            </th>
                            <td>
                                <SortKeySelector sortId={this.props.sortId} currValue={this.state.skey} />
                            </td>
                        </tr>
                        <tr>
                            <th>{this.translate('query__sort_th_num_of_tokens_to_sort')}:</th>
                            <td>
                                <input type="text" name="spos" style={{width: '2em'}}
                                    value={this.state.spos} onChange={this._handleSposChange} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <label htmlFor="sicase_checkbox">
                                {this.translate('query__sort_th_ignore_case')}:
                                </label>
                            </th>
                            <td>
                                <input id="sicase_checkbox" type="checkbox"
                                        onChange={this._handleSicaseCheck}
                                        checked={this.state.sicase === 'i'} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <label htmlFor="sbward_checkbox">
                                {this.translate('query__sort_th_backward')}
                                </label>
                                <a className="context-help" onClick={this._enableBackwardLabelHelp}>
                                    <img className="over-img" src={this.createStaticUrl('img/question-mark.svg')} />
                                </a>
                                <span>
                                    {this.state.backwardLabelHelpVisible ?
                                        <layoutViews.PopupBox onCloseClick={this._backwardLabelHelpClose}>
                                            {this.translate('global__sorting_backwards_explanation')}
                                        </layoutViews.PopupBox>
                                        : null}
                                </span>:
                            </th>
                            <td>
                                <input id="sbward_checkbox" type="checkbox" checked={this.state.sbward === 'r'}
                                        onChange={this._handleSbwardCheck} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // -------------------------- <MLCtxSelector /> ---------------------------------

    const MLCtxSelector = React.createClass({

        onChange : function () {
        },

        _setVal : function (idx) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_CTX',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    index: idx
                }
            });
        },

        render : function () {
            return (
                <table className="radio-like-sel">
                    <tbody>
                        <tr>
                            <td className={this.props.currentValue === 0 ? 'selected' : null}>
                                <a onClick={this._setVal.bind(this, 0)}>3L</a>
                            </td>
                            <td className={this.props.currentValue === 1 ? 'selected' : null}>
                                <a onClick={this._setVal.bind(this, 1)}>2L</a>
                            </td>
                            <td className={this.props.currentValue === 2 ? 'selected' : null}>
                                <a onClick={this._setVal.bind(this, 2)}>1L</a>
                            </td>
                            <td className={this.props.currentValue === 3 ? 'selected' : null}>
                                <a onClick={this._setVal.bind(this, 3)}>Node</a>
                            </td>
                            <td className={this.props.currentValue === 4 ? 'selected' : null}>
                                <a onClick={this._setVal.bind(this, 4)}>1R</a>
                            </td>
                            <td className={this.props.currentValue === 5 ? 'selected' : null}>
                                <a onClick={this._setVal.bind(this, 5)}>2R</a>
                            </td>
                            <td className={this.props.currentValue === 6 ? 'selected' : null}>
                                <a onClick={this._setVal.bind(this, 6)}>3R</a>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // -------------------------- <MLSingleLevelFields /> ---------------------------------

    const MLSingleLevelFields = React.createClass({

        mixins : mixins,

        _handleAttrSelect : function (value) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_SATTR',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: value
                }
            });
        },

        _handleSicaseCheck : function (evt) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_SICASE',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        },

        _handleSbwardCheck : function (evt) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_SBWARD',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        },

        _handleCtxAlignChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_CTX_ALIGN',
                props : {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.value
                }
            });
        },

        getInitialState : function () {
            return {
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: false
            }
        },

        _enableBackwardLabelHelp : function () {
            this.setState({
                backwardLabelHelpVisible: true,
                nodeStartAtHelpVisible: false
            });
        },

        _disableBackwardLabelHelp : function () {
            this.setState({
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: false
            });
        },

        _enableNodeStartAtHelp : function () {
            this.setState({
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: true
            });
        },

        _disableNodeStartAtHelp : function () {
            this.setState({
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: false
            });
        },

        render : function () {
            return (
                <table className="sort-level">
                    <tbody>
                        <tr>
                            <th colSpan="2" className="level">
                                {this.props.level + 1}.
                                {this.props.level > 1 || this.props.numLevels > 1 ?
                                    (<a className="close-icon" onClick={this.props.onRemoveLevel}>
                                        <img src={this.createStaticUrl('img/close-icon.svg')}
                                            alt={this.translate('query__sort_remove_this_level_btn')}
                                            title={this.translate('query__sort_remove_this_level_btn')} />
                                </a>) : null}
                            </th>
                        </tr>
                        <tr>
                            <th>
                                {this.translate('query__sort_th_attribute')}:
                            </th>
                            <td>
                                <AttributeList availAttrs={this.props.availAttrs}
                                        onAttrSelect={this._handleAttrSelect}
                                        currValue={this.props.mlxattr} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <label htmlFor="ml1icase_checkbox">
                                    {this.translate('query__sort_th_ignore_case')}:
                                </label>
                            </th>
                            <td>
                                <input id="ml1icase_checkbox" type="checkbox"
                                        onChange={this._handleSicaseCheck}
                                        checked={this.props.mlxicase === 'i'} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <label htmlFor="sbward_checkbox2">
                                    {this.translate('query__sort_th_backward')}
                                </label>
                                <a className="context-help" onClick={this._enableBackwardLabelHelp}>
                                    <img className="over-img" src={this.createStaticUrl('img/question-mark.svg')} />
                                </a>
                                <span>
                                    {this.state.backwardLabelHelpVisible ?
                                        <layoutViews.PopupBox onCloseClick={this._disableBackwardLabelHelp}>
                                            {this.translate('global__sorting_backwards_explanation')}
                                        </layoutViews.PopupBox>
                                        : null}
                                </span>:
                            </th>
                            <td>
                                <input id="sbward_checkbox2" type="checkbox"
                                        checked={this.props.mlxbward === 'r'}
                                        onChange={this._handleSbwardCheck} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {this.translate('query__sort_th_position')}:
                            </th>
                            <td>
                                <MLCtxSelector sortId={this.props.sortId} level={this.props.level}
                                        currentValue={this.props.ctxIndex}
                                 />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {this.translate('query__sort_th_node_start_at')}
                                <a className="context-help" onClick={this._enableNodeStartAtHelp}>
                                    <img className="over-img" src={this.createStaticUrl('img/question-mark.svg')} />
                                </a>
                                <span>
                                {this.state.nodeStartAtHelpVisible ?
                                        <layoutViews.PopupBox onCloseClick={this._disableNodeStartAtHelp}>
                                            {this.translate('global__this_applies_only_for_mk')}
                                        </layoutViews.PopupBox>
                                        : null}
                                </span>:
                            </th>
                            <td>
                                <select value={this.props.ctxAlign}
                                        onChange={this._handleCtxAlignChange}>
                                    <option value="left">{this.translate('query__sort_option_leftmost')}</option>
                                    <option value="right">{this.translate('query__sort_option_rightmost')}</option>
                                </select>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // -------------------------- <AddMLLevelButton /> ---------------------------------

    const TDAddLevelButton = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <td className="add-level">
                    <a onClick={this.props.onAddLevel}
                        title={this.translate('query__sort_plus_btn_add_level')}>+</a>
                </td>
            );
        }

    });

    // -------------------------- <MultiLevelSortForm /> ---------------------------------

    const MultiLevelSortForm = React.createClass({

        mixins : mixins,

        _handleAttrSelect : function (level, attrVal) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_SKEY',
                props: {
                    sortId: this.props.sortId,
                    attrVal: attrVal
                }
            });
        },

        _fetchStateValues : function () {
             return {
                availAttrs: multiLevelSortStore.getAllAvailAttrs(),
                levels: multiLevelSortStore.getLevelIndices(this.props.sortId),
                maxNumLevels: multiLevelSortStore.getMaxNumLevels(this.props.sortId),
                mlxattrValues: multiLevelSortStore.getMlxattrValues(this.props.sortId),
                mlxicaseValues: multiLevelSortStore.getMlxicaseValues(this.props.sortId),
                mlxbwardValues: multiLevelSortStore.getMlxbwardValues(this.props.sortId),
                ctxIndexValues: multiLevelSortStore.getCtxIndexValues(this.props.sortId),
                ctxAlignValues: multiLevelSortStore.getCtxAlignValues(this.props.sortId)
            };
        },

        getInitialState : function () {
            return this._fetchStateValues();
        },

        _handleStoreChange : function () {
            this.setState(this._fetchStateValues());
        },

        componentDidMount : function () {
            multiLevelSortStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            multiLevelSortStore.removeChangeListener(this._handleStoreChange);
        },

        _addLevel : function () {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_ADD_LEVEL',
                props: {
                    sortId: this.props.sortId
                }
            });
        },

        _removeLevel : function (levelIdx) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_REMOVE_LEVEL',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: levelIdx
                }
            });
        },

        render : function () {
            return (
                <table className="multi-level-blocks">
                    <tbody>
                        <tr>
                            {this.state.levels.map(level => {
                                return (
                                    <td key={`level_${level}`}>
                                        <MLSingleLevelFields availAttrs={this.state.availAttrs}
                                            level={level}
                                            numLevels={this.state.levels.size}
                                            sortId={this.props.sortId}
                                            onRemoveLevel={this._removeLevel.bind(this, level)}
                                            mlxattr={this.state.mlxattrValues.get(level)}
                                            mlxicase={this.state.mlxicaseValues.get(level)}
                                            mlxbward={this.state.mlxbwardValues.get(level)}
                                            ctxIndex={this.state.ctxIndexValues.get(level)}
                                            ctxAlign={this.state.ctxAlignValues.get(level)} />
                                    </td>
                                );
                            })}
                            {this.state.levels.size < this.state.maxNumLevels ?
                                <TDAddLevelButton onAddLevel={this._addLevel} /> : null}
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // -------------------------- <SortForm /> ---------------------------------

    const SortForm = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                sortType: this._getDefaultFormType()
            };
        },

        _handleSortTypeChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'SORT_SET_ACTIVE_STORE',
                props: {
                    sortId: this.props.sortId,
                    formAction: evt.target.value
                }
            }); // <-- synchronous stuff
            this.setState({
                sortType: evt.target.value
            });
        },

        _handleFormSubmit : function () {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch({
                    actionType: 'BRANCH_QUERY',
                    props: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    actionType: this.state.sortType === 'sortx' ? 'SORT_FORM_SUBMIT' : 'ML_SORT_FORM_SUBMIT',
                    props: {
                        sortId: this.props.sortId
                    }
                });
            }
        },

        _getDefaultFormType : function () {
            if (sortStore.isActiveActionValue(this.props.sortId)) {
                return 'sortx';

            } else if (multiLevelSortStore.isActiveActionValue(this.props.sortId)) {
                return 'mlsortx';

            } else {
                throw new Error('Cannot determine default sorting action'); // TODO should we be so strict here?
            }
        },

        _renderFields : function () {
            switch (this.state.sortType) {
                case 'sortx':
                    return <SimpleSortForm sortId={this.props.sortId} />;
                case 'mlsortx':
                    return <MultiLevelSortForm sortId={this.props.sortId} />;
                default:
                    throw new Error('Unknown sort form type: ' + this.state.sortType);
            }
        },

        render : function () {
            return (
                <div>
                    <form>
                        <fieldset>
                            <legend>
                                <select onChange={this._handleSortTypeChange} value={this.state.sortType}>
                                    <option value="sortx">{this.translate('query__sort_type_simple_hd')}</option>
                                    <option value="mlsortx">{this.translate('query__sort_type_multilevel_hd')}</option>
                                </select>
                            </legend>
                            {this._renderFields()}
                        </fieldset>
                        <p>
                            <button type="button" className="default-button"
                                    onClick={this._handleFormSubmit}>
                                {this.props.operationIdx !== undefined ?
                                    this.translate('global__proceed')
                                    : this.translate('query__sort_concordance_btn')}
                            </button>
                        </p>
                    </form>
                </div>
            );
        }
    });

    return {
        SortFormView: SortForm
    };
}