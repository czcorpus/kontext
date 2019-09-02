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
import {IActionDispatcher} from 'kombo';
import {Kontext} from '../../types/common';
import {ConcSortModel, MultiLevelConcSortModel} from '../../models/query/sort';
import { Subscription } from 'rxjs';

export interface SortModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    sortModel:ConcSortModel;
    multiLevelConcSortModel:MultiLevelConcSortModel;
}


export interface SortFormProps {
    formType:Kontext.ConcFormTypes.SORT;
    operationIdx?:number;
    sortId:string;
}


interface SortFormState {
    sortType:string;
}


export interface SortViews {
    SortForm:React.ComponentClass<SortFormProps>;
}


export function init({dispatcher, he, sortModel, multiLevelConcSortModel}:SortModuleArgs):SortViews {

    const layoutViews = he.getLayoutViews();


    // -------------------------- <AttributeList /> ---------------------------------

    const AttributeList:React.SFC<{
        onAttrSelect:(val:string)=>void;
        currValue:string;
        availAttrs:Immutable.List<Kontext.AttrItem>;

    }> = (props) => {

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

    const SortKeySelector:React.SFC<{
        sortId:string;
        currValue:string;

    }> = (props) => {

        const handleSelectFn = (value) => {
            return () => {
                dispatcher.dispatch({
                    name: 'SORT_FORM_SET_SKEY',
                    payload: {
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

    class SimpleSortForm extends React.Component<{
        sortId:string;
    },
    {
        availAttrs:Immutable.List<Kontext.AttrItem>;
        sattr:string;
        skey:string;
        spos:string;
        sicase:string;
        sbward:string;

    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._handleAttrSelect = this._handleAttrSelect.bind(this);
            this._handleSicaseCheck = this._handleSicaseCheck.bind(this);
            this._handleSbwardCheck = this._handleSbwardCheck.bind(this);
            this._handleSposChange = this._handleSposChange.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this.state = this._fetchStateValues();
        }

        _handleAttrSelect(value) {
            dispatcher.dispatch({
                name: 'SORT_FORM_SET_SATTR',
                payload: {
                    sortId: this.props.sortId,
                    value: value
                }
            });
        }

        _handleSicaseCheck(evt) {
            dispatcher.dispatch({
                name: 'SORT_FORM_SET_SICASE',
                payload: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        }

        _handleSbwardCheck(evt) {
            dispatcher.dispatch({
                name: 'SORT_FORM_SET_SBWARD',
                payload: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        }

        _handleSposChange(evt) {
            dispatcher.dispatch({
                name: 'SORT_FORM_SET_SPOS',
                payload: {
                    sortId: this.props.sortId,
                    value: evt.target.value
                }
            });
        }

        _fetchStateValues() {
            return {
                availAttrs: sortModel.getAllAvailAttrs(),
                sattr: sortModel.getSattrValues().get(this.props.sortId),
                skey: sortModel.getSkeyValues().get(this.props.sortId),
                spos: sortModel.getSposValues().get(this.props.sortId),
                sicase: sortModel.getSicaseValues().get(this.props.sortId),
                sbward: sortModel.getSbwardValues().get(this.props.sortId)
            };
        }

        _handleModelChange() {
            this.setState(this._fetchStateValues());
        }

        componentDidMount() {
            this.modelSubscription = sortModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
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
                                <layoutViews.InlineHelp>
                                    {he.translate('global__sorting_backwards_explanation')}
                                </layoutViews.InlineHelp>:
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

    const MLCtxSelector:React.SFC<{
        sortId:string;
        level:number;
        currentValue:number;

    }> = (props) => {

        const setValFn = (idx) => {
            return () => {
                dispatcher.dispatch({
                    name: 'ML_SORT_FORM_SET_CTX',
                    payload: {
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
                            <a onClick={setValFn(3)}>
                                {he.translate('query__sort_label_node')}
                            </a>
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

    class MLSingleLevelFields extends React.PureComponent<{
        sortId:string;
        level:number;
        numLevels:number;
        mlxattr:string;
        availAttrs:Immutable.List<Kontext.AttrItem>;
        mlxicase:string;
        mlxbward:string;
        ctxIndex:number;
        ctxAlign:string;
        onRemoveLevel:()=>void;

    }> {

        constructor(props) {
            super(props);
            this._handleAttrSelect = this._handleAttrSelect.bind(this);
            this._handleSicaseCheck = this._handleSicaseCheck.bind(this);
            this._handleSbwardCheck = this._handleSbwardCheck.bind(this);
            this._handleCtxAlignChange = this._handleCtxAlignChange.bind(this);
        }

        _handleAttrSelect(value) {
            dispatcher.dispatch({
                name: 'ML_SORT_FORM_SET_SATTR',
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: value
                }
            });
        }

        _handleSicaseCheck(evt) {
            dispatcher.dispatch({
                name: 'ML_SORT_FORM_SET_SICASE',
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        }

        _handleSbwardCheck(evt) {
            dispatcher.dispatch({
                name: 'ML_SORT_FORM_SET_SBWARD',
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        }

        _handleCtxAlignChange(evt) {
            dispatcher.dispatch({
                name: 'ML_SORT_FORM_SET_CTX_ALIGN',
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.value
                }
            });
        }

        render() {
            return (
                <table className="MLSingleLevelFields">
                    <tbody>
                        <tr>
                            <th colSpan={2} className="level">
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
                                <layoutViews.InlineHelp>
                                    {he.translate('global__sorting_backwards_explanation')}
                                </layoutViews.InlineHelp>
                                :
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
                                <layoutViews.InlineHelp>
                                    {he.translate('global__this_applies_only_for_mk')}
                                </layoutViews.InlineHelp>:
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

    // -------------------------- <MultiLevelSortForm /> ---------------------------------

    class MultiLevelSortForm extends React.Component<{
        sortId:string;
    },
    {
        availAttrs:Immutable.List<Kontext.AttrItem>;
        levels:Immutable.List<number>;
        maxNumLevels:number;
        mlxattrValues:Immutable.List<string>;
        mlxicaseValues:Immutable.List<string>;
        mlxbwardValues:Immutable.List<string>;
        ctxIndexValues:Immutable.List<number>;
        ctxAlignValues:Immutable.List<string>;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._addLevel = this._addLevel.bind(this);
            this.state = this._fetchStateValues();
        }

        _fetchStateValues() {
             return {
                availAttrs: multiLevelConcSortModel.getAllAvailAttrs(),
                levels: multiLevelConcSortModel.getLevelIndices(this.props.sortId),
                maxNumLevels: multiLevelConcSortModel.getMaxNumLevels(this.props.sortId),
                mlxattrValues: multiLevelConcSortModel.getMlxattrValues(this.props.sortId),
                mlxicaseValues: multiLevelConcSortModel.getMlxicaseValues(this.props.sortId),
                mlxbwardValues: multiLevelConcSortModel.getMlxbwardValues(this.props.sortId),
                ctxIndexValues: multiLevelConcSortModel.getCtxIndexValues(this.props.sortId),
                ctxAlignValues: multiLevelConcSortModel.getCtxAlignValues(this.props.sortId)
            };
        }

        _handleModelChange() {
            this.setState(this._fetchStateValues());
        }

        componentDidMount() {
            this.modelSubscription = multiLevelConcSortModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _addLevel() {
            dispatcher.dispatch({
                name: 'ML_SORT_FORM_ADD_LEVEL',
                payload: {
                    sortId: this.props.sortId
                }
            });
        }

        _removeLevelFn(levelIdx) {
            return () => {
                dispatcher.dispatch({
                    name: 'ML_SORT_FORM_REMOVE_LEVEL',
                    payload: {
                        sortId: this.props.sortId,
                        levelIdx: levelIdx
                    }
                });
            };
        }

        render() {
            return (
                <ul className="MultiLevelSortForm">
                    {this.state.levels.map(level => {
                        return (
                            <li key={`level_${level}`}>
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
                            </li>
                        );
                    })}
                    {this.state.levels.size < this.state.maxNumLevels ?
                        <li>
                            <layoutViews.PlusButton
                                onClick={this._addLevel}
                                mouseOverHint={he.translate('query__sort_plus_btn_add_level')} />
                        </li> :
                        null
                    }
                </ul>
            );
        }
    }

    // -------------------------- <SortFormSelector /> -------------------------

    const SortFormSelector:React.SFC<{
        formType:string;
        onChange:(val:string)=>void;

    }> = (props) => {

        const items = Immutable.List([
            {id: 'sortx', label: he.translate('query__sort_type_simple_hd')},
            {id: 'mlsortx', label: he.translate('query__sort_type_multilevel_hd')},
        ])
        return <layoutViews.TabMenu
            className="SortFormSelector"
            callback={props.onChange}
            items={items} />;
    };

    // -------------------------- <SortForm /> ---------------------------------

    class SortForm extends React.Component<SortFormProps, SortFormState> {

        constructor(props) {
            super(props);
            this._handleSortTypeChange = this._handleSortTypeChange.bind(this);
            this._handleFormSubmit = this._handleFormSubmit.bind(this);
            this.state = {
                sortType: this._getDefaultFormType()
            };
        }

        _handleSortTypeChange(formType) {
            dispatcher.dispatch({
                name: 'SORT_SET_ACTIVE_STORE',
                payload: {
                    sortId: this.props.sortId,
                    formAction: formType
                }
            }); // <-- synchronous stuff
            this.setState({
                sortType: formType
            });
        }

        _handleFormSubmit() {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch({
                    name: 'BRANCH_QUERY',
                    payload: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    name: this.state.sortType === 'sortx' ? 'SORT_FORM_SUBMIT' : 'ML_SORT_FORM_SUBMIT',
                    payload: {
                        sortId: this.props.sortId
                    }
                });
            }
        }

        _getDefaultFormType() {
            if (sortModel.isActiveActionValue(this.props.sortId)) {
                return 'sortx';

            } else if (multiLevelConcSortModel.isActiveActionValue(this.props.sortId)) {
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
                        <SortFormSelector formType={this.state.sortType} onChange={this._handleSortTypeChange} />
                        <hr />
                        {this._renderFields()}
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
        SortForm: SortForm
    };
}