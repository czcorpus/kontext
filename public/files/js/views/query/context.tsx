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

/**
 * This module contains views for the "Specify context" fieldset
 * within the main query form.
 */

import * as React from 'react';
import * as Immutable from 'immutable';
import {IActionDispatcher} from 'kombo';
import {Kontext} from '../../types/common';
import { QueryContextModel } from '../../models/query/context';
import { Subscription } from 'rxjs';


export interface SpecifyContextFormProps {
    hasLemmaAttr:boolean;
    lemmaWindowSizes:Immutable.List<number>;
    wPoSList:Immutable.List<{v:string; n:string}>;
    posWindowSizes:Immutable.List<number>;
}


export interface ContextViews {
    SpecifyContextForm:React.ComponentClass<SpecifyContextFormProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            queryContextModel:QueryContextModel):ContextViews {

    // ------------------------------- <AllAnyNoneSelector /> ---------------------

    const AllAnyNoneSelector:React.SFC<{
        inputName:string;
        value:string;

    }> = (props) => {

        const changeHandler = (evt) => {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                payload: {
                    name: props.inputName,
                    value: evt.target.value
                }
            });
        };

        return (
            <select name={props.inputName} value={props.value}
                    onChange={changeHandler}>
                <option value="all">{he.translate('query__aan_selector_all')}</option>
                <option value="any">{he.translate('query__aan_selector_any')}</option>
                <option value="none">{he.translate('query__aan_selector_none')}</option>
            </select>
        );
    };

    // ------------------------------- <TRWindowSelector /> ---------------------

    const TRWindowSelector:React.SFC<{
        namePrefix:string;
        windowTypeSelector:string;
        windowSizeSelector:string;
        options:Immutable.List<number>;

    }> = (props) => {

        const changeHandler = (evt) => {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                props : {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>{he.translate('query__window')}:</th>
                <td>
                    <select name={`${props.namePrefix}_window_type`}
                            value={props.windowTypeSelector}
                            onChange={changeHandler}>
                        <option value="left">{he.translate('query__left')}</option>
                        <option value="both">{he.translate('query__both')}</option>
                        <option value="right">{he.translate('query__right')}</option>
                    </select>
                    {'\u00A0'}
                    <select name={`${props.namePrefix}_wsize`}
                            value={props.windowSizeSelector}
                            onChange={changeHandler}>
                        {props.options.map((item) => {
                            return <option key={item}>{item}</option>
                        })}
                    </select>
                    {'\u00A0'}
                    {he.translate('query__window_tokens')}.
                </td>
            </tr>
        );
    };

    // ------------------------------- <TRLemmaWindowSelector /> ---------------------

    const TRLemmaWindowSelector:React.SFC<{
        options:Immutable.List<number>;
        fc_lemword_window_type:string;
        fc_lemword_wsize:string;

    }> = (props) => {

        return <TRWindowSelector
                    options={props.options}
                    namePrefix="fc_lemword"
                    windowTypeSelector={props.fc_lemword_window_type}
                    windowSizeSelector={props.fc_lemword_wsize} />;
    };

    // ------------------------------- <TRPosWindowSelector /> ---------------------

    const TRPosWindowSelector:React.SFC<{
        options:Immutable.List<number>;
        fc_pos_window_type:string;
        fc_pos_wsize:string;

    }> = (props) => {

            return <TRWindowSelector
                        options={props.options}
                        namePrefix="fc_pos"
                        windowTypeSelector={props.fc_pos_window_type}
                        windowSizeSelector={props.fc_pos_wsize} />;
    };

    // ------------------------------- <LemmaFilter /> ---------------------

    const LemmaFilter:React.SFC<{
        hasLemmaAttr:boolean;
        fc_lemword_wsize:string;
        fc_lemword_type:string;
        fc_lemword:string;
        fc_lemword_window_type:string;
        lemmaWindowSizes:Immutable.List<number>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                payload: {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        };

        return (
            <table className="form">
                <tbody>
                    <TRLemmaWindowSelector options={props.lemmaWindowSizes}
                        fc_lemword_window_type={props.fc_lemword_window_type}
                        fc_lemword_wsize={props.fc_lemword_wsize} />
                    <tr>
                        <th>
                        {props.hasLemmaAttr
                            ? he.translate('query__lw_lemmas')
                            : he.translate('query__lw_word_forms')
                        }
                        </th>
                        <td>
                            <input type="text" className="fc_lemword" name="fc_lemword" value={props.fc_lemword}
                                    onChange={handleInputChange} />
                            {'\u00A0'}
                            <AllAnyNoneSelector inputName="fc_lemword_type" value={props.fc_lemword_type} />
                            {'\u00A0'}
                            {he.translate('query__of_these_items')}.
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    // ------------------------------- <PoSFilter /> ---------------------

    const PoSFilter:React.SFC<{
        posWindowSizes:Immutable.List<number>;
        fc_pos_window_type:string;
        fc_pos_wsize:string;
        fc_pos:string;
        wPoSList:Immutable.List<{v:string; n:string}>;
        fc_pos_type:string;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                payload: {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        };

        const handleMultiSelectChange = (evt) => {
            const values = Array.prototype
                .filter.call(evt.target.options, item => item.selected)
                .map(item => item.value);
            dispatcher.dispatch({
                name: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                payload: {
                    name: evt.target.name,
                    value: values
                }
            });
        };

        return (
            <div className="pos-filter">
                <h3>{he.translate('query__pos_filter')}</h3>
                <table className="form">
                    <tbody>
                        <TRPosWindowSelector options={props.posWindowSizes}
                            fc_pos_window_type={props.fc_pos_window_type}
                            fc_pos_wsize={props.fc_pos_wsize} />
                        <tr>
                            <th>
                                {he.translate('query__pos_filter')}:<br />
                                <span className="note">({he.translate('query__use_ctrl_click_for')})</span>
                            </th>
                            <td>
                                <select title={he.translate('query__select_one_or_more_pos_tags')}
                                        multiple={true}
                                        size={4}
                                        name="fc_pos" value={props.fc_pos}
                                        onChange={handleMultiSelectChange}>
                                    {props.wPoSList.map((item, i) => {
                                        return <option key={i} value={item.n}>{item.n}</option>;
                                    })}
                                </select>
                            </td>
                            <td>
                                <AllAnyNoneSelector inputName="fc_pos_type" value={props.fc_pos_type} />
                                {'\u00A0'}
                                {he.translate('query__of_these_items')}.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    // ------------------------------- <SpecifyContextForm /> ---------------------

    class SpecifyContextForm extends React.Component<SpecifyContextFormProps, {data: Immutable.Map<string, any>}> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._handleModelChange = this._handleModelChange.bind(this);
            this.state = {
                data: queryContextModel.getData()
            };
        }

        _handleModelChange() {
            this.setState({data: queryContextModel.getData()});
        }

        componentDidMount() {
            this.modelSubscription = queryContextModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div>
                    <h3>{this.props.hasLemmaAttr
                        ? he.translate('query__lemma_filter')
                        : he.translate('query__word_form_filter')}
                    </h3>
                    <LemmaFilter
                        hasLemmaAttr={this.props.hasLemmaAttr}
                        lemmaWindowSizes={this.props.lemmaWindowSizes}
                        fc_lemword_window_type={this.state.data.get('fc_lemword_window_type')}
                        fc_lemword_wsize={this.state.data.get('fc_lemword_wsize')}
                        fc_lemword={this.state.data.get('fc_lemword')}
                        fc_lemword_type={this.state.data.get('fc_lemword_type')}
                         />
                    {this.props.wPoSList && this.props.wPoSList.size > 0
                        ? <PoSFilter
                                posWindowSizes={this.props.posWindowSizes}
                                wPoSList={this.props.wPoSList}
                                fc_pos_window_type={this.state.data.get('fc_pos_window_type')}
                                fc_pos_wsize={this.state.data.get('fc_pos_wsize')}
                                fc_pos={this.state.data.get('fc_pos')}
                                fc_pos_type={this.state.data.get('fc_pos_type')}
                                />
                        : null}
                </div>
            );
        }
    }

    return {
        SpecifyContextForm: SpecifyContextForm
    };
}