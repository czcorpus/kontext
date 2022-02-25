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
import { IActionDispatcher, BoundWithProps } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { ConcSortModel, ConcSortModelState } from '../../../models/query/sort/single';
import { Actions } from '../../../models/query/actions';
import { List } from 'cnc-tskit';
import { MultiLevelConcSortModel, MultiLevelConcSortModelState } from '../../../models/query/sort/multi';
import * as S from './style';


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

interface SimpleSortFormProps {
    sortId:string;
}

interface MultiLevelSortFormProps {
    sortId:string;
}

interface SortForms {
    SimpleSortForm:React.ComponentClass<SimpleSortFormProps>;
    MultiLevelSortForm:React.ComponentClass<MultiLevelSortFormProps>;
}

function initSortForms({dispatcher, he, sortModel, multiLevelConcSortModel}:SortModuleArgs):SortForms {

    const layoutViews = he.getLayoutViews();

    // -------------------------- <AttributeList /> ---------------------------------

    const AttributeList:React.FC<{
        onAttrSelect:(val:string)=>void;
        currValue:string;
        availAttrs:Array<Kontext.AttrItem>;

    }> = (props) => {

        const handleSelectChange = (evt) => {
            props.onAttrSelect(evt.target.value);
        };

        return (
            <select value={props.currValue} onChange={handleSelectChange}>
                {List.map((item, i) => <option key={`attr_${i}`} value={item.n}>{item.label}</option>, props.availAttrs)}
            </select>
        );
    };

    // -------------------------- <SortKeySelector /> ---------------------------------

    const SortKeySelector:React.FC<{
        sortId:string;
        currValue:string;

    }> = (props) => {

        const handleSelectFn = (value) => {
            return () => {
                dispatcher.dispatch<typeof Actions.SortFormSetSkey>({
                    name: Actions.SortFormSetSkey.name,
                    payload: {
                        sortId: props.sortId,
                        value: value
                    }
                });
            };
        };

        return (
            <S.SortKeySelector>
                <div className={props.currValue === 'lc' ? 'selected' : null}>
                    <a onClick={handleSelectFn('lc')}>
                        {'\u2026' + he.translate('query__sort_label_left_context') + '\u2026'}
                    </a>
                </div>
                <div className={props.currValue === 'kw' ? 'kw selected' : 'kw'}>
                    <a onClick={handleSelectFn('kw')}>
                        {he.translate('query__sort_label_node')}
                    </a>
                </div>
                <div className={props.currValue === 'rc' ? 'selected' : null}>
                    <a onClick={handleSelectFn('rc')}>
                        {'\u2026' + he.translate('query__sort_label_right_context') + '\u2026'}
                    </a>
                </div>
            </S.SortKeySelector>
        );
    };

    // -------------------------- <SimpleSortForm /> ---------------------------------

    class SimpleSortForm extends React.Component<SimpleSortFormProps & ConcSortModelState> {

        constructor(props) {
            super(props);
            this._handleAttrSelect = this._handleAttrSelect.bind(this);
            this._handleSicaseCheck = this._handleSicaseCheck.bind(this);
            this._handleSbwardCheck = this._handleSbwardCheck.bind(this);
            this._handleSposChange = this._handleSposChange.bind(this);
        }

        _handleAttrSelect(value) {
            dispatcher.dispatch<typeof Actions.SortFormSetSattr>({
                name: Actions.SortFormSetSattr.name,
                payload: {
                    sortId: this.props.sortId,
                    value: value
                }
            });
        }

        _handleSicaseCheck(evt) {
            dispatcher.dispatch<typeof Actions.SortFormSetSicase>({
                name: Actions.SortFormSetSicase.name,
                payload: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        }

        _handleSbwardCheck(evt) {
            dispatcher.dispatch<typeof Actions.SortFormSetSbward>({
                name: Actions.SortFormSetSbward.name,
                payload: {
                    sortId: this.props.sortId,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        }

        _handleSposChange(evt) {
            dispatcher.dispatch<typeof Actions.SortFormSetSpos>({
                name: Actions.SortFormSetSpos.name,
                payload: {
                    sortId: this.props.sortId,
                    value: evt.target.value
                }
            });
        }

        render() {
            return (
                <table className="form">
                    <tbody>
                        <tr>
                            <th>{he.translate('query__sort_th_attribute')}:</th>
                            <td>
                                <AttributeList availAttrs={
                                        /**
                                         * Return both positional and structural attributes
                                         * as a single list (positional first).
                                         */
                                        List.concat(List.sortedAlphaBy(v => v.label, this.props.availStructAttrList), this.props.availAttrList)}
                                        onAttrSelect={this._handleAttrSelect}
                                        currValue={this.props.sattrValues[this.props.sortId]} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {he.translate('query__sort_th_sort_key')}:
                            </th>
                            <td>
                                <SortKeySelector sortId={this.props.sortId} currValue={this.props.skeyValues[this.props.sortId]} />
                            </td>
                        </tr>
                        <tr>
                            <th>{he.translate('query__sort_th_num_of_tokens_to_sort')}:</th>
                            <td>
                                <input type="text" name="spos" style={{width: '2em'}}
                                    value={this.props.sposValues[this.props.sortId]} onChange={this._handleSposChange} />
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
                                        checked={this.props.sicaseValues[this.props.sortId] === 'i'} />
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
                                <input id="sbward_checkbox" type="checkbox" checked={this.props.sbwardValues[this.props.sortId] === 'r'}
                                        onChange={this._handleSbwardCheck} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }

    // -------------------------- <MLCtxSelector /> ---------------------------------

    const MLCtxSelector:React.FC<{
        sortId:string;
        level:number;
        currentValue:number;

    }> = (props) => {

        const setValFn = (idx) => {
            return () => {
                dispatcher.dispatch<typeof Actions.MLSortFormSetCtx>({
                    name: Actions.MLSortFormSetCtx.name,
                    payload: {
                        sortId: props.sortId,
                        levelIdx: props.level,
                        index: idx
                    }
                });
            };
        };

        return (
            <S.SortKeySelector>
                <div className={props.currentValue === 0 ? 'selected' : null}>
                    <a onClick={setValFn(0)}>3L</a>
                </div>
                <div className={props.currentValue === 1 ? 'selected' : null}>
                    <a onClick={setValFn(1)}>2L</a>
                </div>
                <div className={props.currentValue === 2 ? 'selected' : null}>
                    <a onClick={setValFn(2)}>1L</a>
                </div>
                <div className={props.currentValue === 3 ? 'kw selected' : 'kw'}>
                    <a onClick={setValFn(3)}>
                        {he.translate('query__sort_label_node')}
                    </a>
                </div>
                <div className={props.currentValue === 4 ? 'selected' : null}>
                    <a onClick={setValFn(4)}>1R</a>
                </div>
                <div className={props.currentValue === 5 ? 'selected' : null}>
                    <a onClick={setValFn(5)}>2R</a>
                </div>
                <div className={props.currentValue === 6 ? 'selected' : null}>
                    <a onClick={setValFn(6)}>3R</a>
                </div>
            </S.SortKeySelector>
        );
    };

    // -------------------------- <MLSingleLevelFields /> ---------------------------------

    class MLSingleLevelFields extends React.PureComponent<{
        sortId:string;
        level:number;
        numLevels:number;
        mlxattr:string;
        availAttrs:Array<Kontext.AttrItem>;
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
            dispatcher.dispatch<typeof Actions.MLSortFormSetSattr>({
                name: Actions.MLSortFormSetSattr.name,
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: value
                }
            });
        }

        _handleSicaseCheck(evt) {
            dispatcher.dispatch<typeof Actions.MLSortFormSetSicase>({
                name: Actions.MLSortFormSetSicase.name,
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'i' : ''
                }
            });
        }

        _handleSbwardCheck(evt) {
            dispatcher.dispatch<typeof Actions.MLSortFormSetSbward>({
                name: Actions.MLSortFormSetSbward.name,
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.checked ? 'r' : ''
                }
            });
        }

        _handleCtxAlignChange(evt) {
            dispatcher.dispatch<typeof Actions.MLSortFormSetCtxAlign>({
                name: Actions.MLSortFormSetCtxAlign.name,
                payload: {
                    sortId: this.props.sortId,
                    levelIdx: this.props.level,
                    value: evt.target.value
                }
            });
        }

        render() {
            return (
                <S.MLSingleLevelFields>
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
                                <label htmlFor={`ml1icase_checkbox_${this.props.level}`}>
                                    {he.translate('query__sort_th_ignore_case')}:
                                </label>
                            </th>
                            <td>
                                <input id={`ml1icase_checkbox_${this.props.level}`} type="checkbox"
                                        onChange={this._handleSicaseCheck}
                                        checked={this.props.mlxicase === 'i'} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <label htmlFor={`sbward_checkbox2_${this.props.level}`}>
                                    {he.translate('query__sort_th_backward')}
                                </label>
                                <layoutViews.InlineHelp>
                                    {he.translate('global__sorting_backwards_explanation')}
                                </layoutViews.InlineHelp>
                                :
                            </th>
                            <td>
                                <input id={`sbward_checkbox2_${this.props.level}`} type="checkbox"
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
                </S.MLSingleLevelFields>
            );
        }
    }

    // -------------------------- <MultiLevelSortForm /> ---------------------------------

    class MultiLevelSortForm extends React.Component<MultiLevelSortFormProps & MultiLevelConcSortModelState> {

        constructor(props) {
            super(props);
            this._addLevel = this._addLevel.bind(this);
        }

        getMaxNumLevels():number {
            return Math.min(
                this.props.mlxattrValues[this.props.sortId].length,
                this.props.mlxicaseValues[this.props.sortId].length,
                this.props.mlxbwardValues[this.props.sortId].length,
                this.props.ctxIndexValues[this.props.sortId].length,
                this.props.ctxAlignValues[this.props.sortId].length
            );
        }

        getLevelIndices():Array<number> {
            const sortLevel = this.props.sortlevelValues[this.props.sortId];
            return this.props.mlxattrValues[this.props.sortId].slice(0, sortLevel).map((_, i) => i);
        }

        _addLevel() {
            dispatcher.dispatch<typeof Actions.MLSortFormAddLevel>({
                name: Actions.MLSortFormAddLevel.name,
                payload: {
                    sortId: this.props.sortId
                }
            });
        }

        _removeLevelFn(levelIdx) {
            return () => {
                dispatcher.dispatch<typeof Actions.MLSortFormRemoveLevel>({
                    name: Actions.MLSortFormRemoveLevel.name,
                    payload: {
                        sortId: this.props.sortId,
                        levelIdx: levelIdx
                    }
                });
            };
        }

        render() {
            const levels = this.getLevelIndices();
            return (
                <S.MultiLevelSortForm>
                    {List.map(level => {
                        return (
                            <li key={`level_${level}`}>
                                <MLSingleLevelFields
                                    /**
                                     * Return both positional and structural attributes
                                     * as a single list (positional first).
                                     */
                                    availAttrs={List.concat(List.sortedAlphaBy(v => v.label, this.props.availStructAttrList), this.props.availAttrList)}
                                    level={level}
                                    numLevels={levels.length}
                                    sortId={this.props.sortId}
                                    onRemoveLevel={this._removeLevelFn(level)}
                                    mlxattr={this.props.mlxattrValues[this.props.sortId][level]}
                                    mlxicase={this.props.mlxicaseValues[this.props.sortId][level]}
                                    mlxbward={this.props.mlxbwardValues[this.props.sortId][level]}
                                    ctxIndex={this.props.ctxIndexValues[this.props.sortId][level]}
                                    ctxAlign={this.props.ctxAlignValues[this.props.sortId][level]} />
                            </li>
                        );
                    }, levels)}
                    {levels.length < this.getMaxNumLevels() ?
                        <li>
                            <layoutViews.PlusButton
                                onClick={this._addLevel}
                                mouseOverHint={he.translate('query__sort_plus_btn_add_level')} />
                        </li> :
                        null
                    }
                </S.MultiLevelSortForm>
            );
        }
    }

    return {
        SimpleSortForm: BoundWithProps<SimpleSortFormProps, ConcSortModelState>(SimpleSortForm, sortModel),
        MultiLevelSortForm: BoundWithProps<MultiLevelSortFormProps, MultiLevelConcSortModelState>(MultiLevelSortForm, multiLevelConcSortModel)
    };
}


export function init({dispatcher, he, sortModel, multiLevelConcSortModel}:SortModuleArgs):SortViews {

    const layoutViews = he.getLayoutViews();
    const sortForms = initSortForms({dispatcher, he, sortModel, multiLevelConcSortModel});

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
            dispatcher.dispatch<typeof Actions.SortSetActiveModel>({
                name: Actions.SortSetActiveModel.name,
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
                dispatcher.dispatch<typeof Actions.BranchQuery>({
                    name: Actions.BranchQuery.name,
                    payload: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch<typeof Actions.SortFormSubmit|typeof Actions.MLSortFormSubmit>({
                    name: this.state.sortType === 'sortx' ? Actions.SortFormSubmit.name : Actions.MLSortFormSubmit.name,
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

        render() {
            const items = [
                {id: 'sortx', label: he.translate('query__sort_type_simple_hd')},
                {id: 'mlsortx', label: he.translate('query__sort_type_multilevel_hd')},
            ]

            return (
                <div>
                    <form>
                        <layoutViews.TabView
                            className="SortFormSelector"
                            defaultId={this.state.sortType}
                            callback={this._handleSortTypeChange}
                            items={items} >

                            <sortForms.SimpleSortForm sortId={this.props.sortId} />
                            <sortForms.MultiLevelSortForm sortId={this.props.sortId} />
                        </layoutViews.TabView>
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
        SortForm
    };
}