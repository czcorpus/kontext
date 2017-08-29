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


export function init(dispatcher, he, sortStore, multiLevelSortStore) {

    const layoutViews = he.getLayoutViews();


    // -------------------------- <AttributeList /> ---------------------------------

    const AttributeList = (props) => {

        const handleSelectChange = (evt) => {
            props.onAttrSelect(evt.target.value);
        };

        return (
            <select value={props.currValue} onChange={handleSelectChange}>
                {props.availAttrs.map((item, i) => <option key={`attr_${i}`} value={item.n}>{item.label}</option>)}
            </select>
        );
    };

    // -------------------------- <SortKeySelector /> ---------------------------------

    const SortKeySelector = (props) => {

        const handleSelectFn = (value) => {
            return () => {
                dispatcher.dispatch({
                    actionType: 'SORT_FORM_SET_SKEY',
                    props: {
                        sortId: props.sortId,
                        value: value
                    }
                });
            };
        };

        return (
            <table className="radio-like-sel">
                <tbody>
                    <tr>
                        <td className={props.currValue === 'lc' ? 'selected' : null}>
                            <a onClick={handleSelectFn('lc')}>
                                {'\u2026' + he.translate('query__sort_label_left_context') + '\u2026'}
                            </a>
                        </td>
                        <td className={props.currValue === 'kw' ? 'selected' : null}>
                            <a onClick={handleSelectFn('kw')}>
                                {he.translate('query__sort_label_node')}
                            </a>
                        </td>
                        <td className={props.currValue === 'rc' ? 'selected' : null}>
                            <a onClick={handleSelectFn('rc')}>
                                {'\u2026' + he.translate('query__sort_label_right_context') + '\u2026'}
                            </a>
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    // -------------------------- <SimpleSortForm /> ---------------------------------

    class SimpleSortForm extends React.Component {

        constructor(props) {
            super(props);
            this._handleAttrSelect = this._handleAttrSelect.bind(this);
            this._handleSicaseCheck = this._handleSicaseCheck.bind(this);
            this._handleSbwardCheck = this._handleSbwardCheck.bind(this);
            this._handleSposChange = this._handleSposChange.bind(this);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._enableBackwardLabelHelp = this._enableBackwardLabelHelp.bind(this);
            this._backwardLabelHelpClose = this._backwardLabelHelpClose.bind(this);
            this.state = this._fetchStateValues();
        }

        _handleAttrSelect(value) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SATTR',
                props: {
                    sortId: this.props.sortId,
                    value: value
                }
            });
        }

        _handleSicaseCheck(evt) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SICASE',
                props: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        }

        _handleSbwardCheck(evt) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SBWARD',
                props: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        }

        _handleSposChange(evt) {
            dispatcher.dispatch({
                actionType: 'SORT_FORM_SET_SPOS',
                props: {
                    sortId: this.props.sortId,
                    value: evt.target.value
                }
            });
        }

        _fetchStateValues() {
            return {
                availAttrs: sortStore.getAllAvailAttrs(),
                sattr: sortStore.getSattrValues().get(this.props.sortId),
                skey: sortStore.getSkeyValues().get(this.props.sortId),
                spos: sortStore.getSposValues().get(this.props.sortId),
                sicase: sortStore.getSicaseValues().get(this.props.sortId),
                sbward: sortStore.getSbwardValues().get(this.props.sortId),
                backwardLabelHelpVisible: false
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStateValues());
        }

        componentDidMount() {
            sortStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            sortStore.removeChangeListener(this._handleStoreChange);
        }

        _enableBackwardLabelHelp() {
            const state = this._fetchStateValues();
            state['backwardLabelHelpVisible'] = true;
            this.setState(state);
        }

        _backwardLabelHelpClose() {
            this.setState(this._fetchStateValues());
        }

        render() {
            return (
                <table className="form">
                    <tbody>
                        <tr>
                            <th>{he.translate('query__sort_th_attribute')}:</th>
                            <td>
                                <AttributeList availAttrs={this.state.availAttrs}
                                        onAttrSelect={this._handleAttrSelect}
                                        currValue={this.state.sattr} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {he.translate('query__sort_th_sort_key')}:
                            </th>
                            <td>
                                <SortKeySelector sortId={this.props.sortId} currValue={this.state.skey} />
                            </td>
                        </tr>
                        <tr>
                            <th>{he.translate('query__sort_th_num_of_tokens_to_sort')}:</th>
                            <td>
                                <input type="text" name="spos" style={{width: '2em'}}
                                    value={this.state.spos} onChange={this._handleSposChange} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <label htmlFor="sicase_checkbox">
                                {he.translate('query__sort_th_ignore_case')}:
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
                                {he.translate('query__sort_th_backward')}
                                </label>
                                <a className="context-help" onClick={this._enableBackwardLabelHelp}>
                                    <img className="over-img" src={he.createStaticUrl('img/question-mark.svg')} />
                                </a>
                                <span>
                                    {this.state.backwardLabelHelpVisible ?
                                        <layoutViews.PopupBox onCloseClick={this._backwardLabelHelpClose}>
                                            {he.translate('global__sorting_backwards_explanation')}
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
    }

    // -------------------------- <MLCtxSelector /> ---------------------------------

    const MLCtxSelector = (props) => {

        const setValFn = (idx) => {
            return () => {
                dispatcher.dispatch({
                    actionType: 'ML_SORT_FORM_SET_CTX',
                    props: {
                        sortId: props.sortId,
                        levelIdx: props.level,
                        index: idx
                    }
                });
            };
        };

        return (
            <table className="radio-like-sel">
                <tbody>
                    <tr>
                        <td className={props.currentValue === 0 ? 'selected' : null}>
                            <a onClick={setValFn(0)}>3L</a>
                        </td>
                        <td className={props.currentValue === 1 ? 'selected' : null}>
                            <a onClick={setValFn(1)}>2L</a>
                        </td>
                        <td className={props.currentValue === 2 ? 'selected' : null}>
                            <a onClick={setValFn(2)}>1L</a>
                        </td>
                        <td className={props.currentValue === 3 ? 'selected' : null}>
                            <a onClick={setValFn(3)}>Node</a>
                        </td>
                        <td className={props.currentValue === 4 ? 'selected' : null}>
                            <a onClick={setValFn(4)}>1R</a>
                        </td>
                        <td className={props.currentValue === 5 ? 'selected' : null}>
                            <a onClick={setValFn(5)}>2R</a>
                        </td>
                        <td className={props.currentValue === 6 ? 'selected' : null}>
                            <a onClick={setValFn(6)}>3R</a>
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    // -------------------------- <MLSingleLevelFields /> ---------------------------------

    class MLSingleLevelFields extends React.Component {

        constructor(props) {
            super(props);
            this._handleAttrSelect = this._handleAttrSelect.bind(this);
            this._handleSicaseCheck = this._handleSicaseCheck.bind(this);
            this._handleSbwardCheck = this._handleSbwardCheck.bind(this);
            this._handleCtxAlignChange = this._handleCtxAlignChange.bind(this);
            this._enableBackwardLabelHelp = this._enableBackwardLabelHelp.bind(this);
            this._disableBackwardLabelHelp = this._disableBackwardLabelHelp.bind(this);
            this._enableNodeStartAtHelp = this._enableNodeStartAtHelp.bind(this);
            this._disableNodeStartAtHelp = this._disableNodeStartAtHelp.bind(this);
            this.state = {
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: false
            };
        }

        _handleAttrSelect(value) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_SATTR',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: value
                }
            });
        }

        _handleSicaseCheck(evt) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_SICASE',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        }

        _handleSbwardCheck(evt) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_SBWARD',
                props: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        }

        _handleCtxAlignChange(evt) {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_SET_CTX_ALIGN',
                props : {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.value
                }
            });
        }

        _enableBackwardLabelHelp() {
            this.setState({
                backwardLabelHelpVisible: true,
                nodeStartAtHelpVisible: false
            });
        }

        _disableBackwardLabelHelp() {
            this.setState({
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: false
            });
        }

        _enableNodeStartAtHelp() {
            this.setState({
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: true
            });
        }

        _disableNodeStartAtHelp() {
            this.setState({
                backwardLabelHelpVisible: false,
                nodeStartAtHelpVisible: false
            });
        }

        render() {
            return (
                <table className="sort-level">
                    <tbody>
                        <tr>
                            <th colSpan="2" className="level">
                                {this.props.level + 1}.
                                {this.props.level > 1 || this.props.numLevels > 1 ?
                                    (<a className="close-icon" onClick={this.props.onRemoveLevel}>
                                        <img src={he.createStaticUrl('img/close-icon.svg')}
                                            alt={he.translate('query__sort_remove_this_level_btn')}
                                            title={he.translate('query__sort_remove_this_level_btn')} />
                                </a>) : null}
                            </th>
                        </tr>
                        <tr>
                            <th>
                                {he.translate('query__sort_th_attribute')}:
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
                                    {he.translate('query__sort_th_ignore_case')}:
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
                                    {he.translate('query__sort_th_backward')}
                                </label>
                                <a className="context-help" onClick={this._enableBackwardLabelHelp}>
                                    <img className="over-img" src={he.createStaticUrl('img/question-mark.svg')} />
                                </a>
                                <span>
                                    {this.state.backwardLabelHelpVisible ?
                                        <layoutViews.PopupBox onCloseClick={this._disableBackwardLabelHelp}>
                                            {he.translate('global__sorting_backwards_explanation')}
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
                                {he.translate('query__sort_th_position')}:
                            </th>
                            <td>
                                <MLCtxSelector sortId={this.props.sortId} level={this.props.level}
                                        currentValue={this.props.ctxIndex}
                                 />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {he.translate('query__sort_th_node_start_at')}
                                <a className="context-help" onClick={this._enableNodeStartAtHelp}>
                                    <img className="over-img" src={he.createStaticUrl('img/question-mark.svg')} />
                                </a>
                                <span>
                                {this.state.nodeStartAtHelpVisible ?
                                        <layoutViews.PopupBox onCloseClick={this._disableNodeStartAtHelp}>
                                            {he.translate('global__this_applies_only_for_mk')}
                                        </layoutViews.PopupBox>
                                        : null}
                                </span>:
                            </th>
                            <td>
                                <select value={this.props.ctxAlign}
                                        onChange={this._handleCtxAlignChange}>
                                    <option value="left">{he.translate('query__sort_option_leftmost')}</option>
                                    <option value="right">{he.translate('query__sort_option_rightmost')}</option>
                                </select>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }

    // -------------------------- <AddMLLevelButton /> ---------------------------------

    const TDAddLevelButton = (props) => {

        return (
            <td className="add-level">
                <a onClick={props.onAddLevel}
                    title={he.translate('query__sort_plus_btn_add_level')}>+</a>
            </td>
        );
    };

    // -------------------------- <MultiLevelSortForm /> ---------------------------------

    class MultiLevelSortForm extends React.Component {

        constructor(props) {
            super(props);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._addLevel = this._addLevel.bind(this);
            this.state = this._fetchStateValues();
        }

        _fetchStateValues() {
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
        }

        _handleStoreChange() {
            this.setState(this._fetchStateValues());
        }

        componentDidMount() {
            multiLevelSortStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            multiLevelSortStore.removeChangeListener(this._handleStoreChange);
        }

        _addLevel() {
            dispatcher.dispatch({
                actionType: 'ML_SORT_FORM_ADD_LEVEL',
                props: {
                    sortId: this.props.sortId
                }
            });
        }

        _removeLevelFn(levelIdx) {
            return () => {
                dispatcher.dispatch({
                    actionType: 'ML_SORT_FORM_REMOVE_LEVEL',
                    props: {
                        sortId: this.props.sortId,
                        levelIdx: levelIdx
                    }
                });
            };
        }

        render() {
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
                                            onRemoveLevel={this._removeLevelFn(level)}
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
    }

    // -------------------------- <SortForm /> ---------------------------------

    class SortForm extends React.Component {

        constructor(props) {
            super(props);
            this._handleSortTypeChange = this._handleSortTypeChange.bind(this);
            this._handleFormSubmit = this._handleFormSubmit.bind(this);
            this.state = {
                sortType: this._getDefaultFormType()
            };
        }

        _handleSortTypeChange(evt) {
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
        }

        _handleFormSubmit() {
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
        }

        _getDefaultFormType() {
            if (sortStore.isActiveActionValue(this.props.sortId)) {
                return 'sortx';

            } else if (multiLevelSortStore.isActiveActionValue(this.props.sortId)) {
                return 'mlsortx';

            } else {
                throw new Error('Cannot determine default sorting action'); // TODO should we be so strict here?
            }
        }

        _renderFields() {
            switch (this.state.sortType) {
                case 'sortx':
                    return <SimpleSortForm sortId={this.props.sortId} />;
                case 'mlsortx':
                    return <MultiLevelSortForm sortId={this.props.sortId} />;
                default:
                    throw new Error('Unknown sort form type: ' + this.state.sortType);
            }
        }

        render() {
            return (
                <div>
                    <form>
                        <fieldset>
                            <legend>
                                <select onChange={this._handleSortTypeChange} value={this.state.sortType}>
                                    <option value="sortx">{he.translate('query__sort_type_simple_hd')}</option>
                                    <option value="mlsortx">{he.translate('query__sort_type_multilevel_hd')}</option>
                                </select>
                            </legend>
                            {this._renderFields()}
                        </fieldset>
                        <p>
                            <button type="button" className="default-button"
                                    onClick={this._handleFormSubmit}>
                                {this.props.operationIdx !== undefined ?
                                    he.translate('global__proceed')
                                    : he.translate('query__sort_concordance_btn')}
                            </button>
                        </p>
                    </form>
                </div>
            );
        }
    }

    return {
        SortFormView: SortForm
    };
}