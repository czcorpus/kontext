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

import React from 'vendor/react';


export function init(dispatcher, mixins, queryContextStore) {

    // ------------------------------- <AllAnyNoneSelector /> ---------------------

    const AllAnyNoneSelector = React.createClass({

        mixins : mixins,

        _changeHandler : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                props: {
                    name: this.props.inputName,
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <select name={this.props.inputName} value={this.props.value}
                        onChange={this._changeHandler}>
                    <option value="all">{this.translate('query__aan_selector_all')}</option>
                    <option value="any">{this.translate('query__aan_selector_any')}</option>
                    <option value="none">{this.translate('query__aan_selector_none')}</option>
                </select>
            );
        }
    });

    // ------------------------------- <TRWindowSelector /> ---------------------

    const TRWindowSelector = React.createClass({

        mixins : mixins,

        _changeHandler : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                props : {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <tr>
                    <th>{this.translate('query__window')}:</th>
                    <td>
                        <select name={`${this.props.namePrefix}_window_type`}
                                value={this.props.windowTypeSelector}
                                onChange={this._changeHandler}>
                            <option value="left">{this.translate('query__left')}</option>
                            <option value="right">{this.translate('query__right')}</option>
                            <option value="both">{this.translate('query__both')}</option>
                        </select>
                        {'\u00A0'}
                        <select name={`${this.props.namePrefix}_wsize`}
                                value={this.props.windowSizeSelector}
                                onChange={this._changeHandler}>
                            {this.props.options.map((item) => {
                                return <option key={item}>{item}</option>
                            })}
                        </select>
                        {'\u00A0'}
                        {this.translate('query__window_tokens')}.
                    </td>
                </tr>
            );
        }
    });

    // ------------------------------- <TRLemmaWindowSelector /> ---------------------

    const TRLemmaWindowSelector = React.createClass({
        render : function () {
            return <TRWindowSelector
                        options={this.props.options}
                        namePrefix="fc_lemword"
                        windowTypeSelector={this.props.fc_lemword_window_type}
                        windowSizeSelector={this.props.fc_lemword_wsize} />;
        }
    });

    // ------------------------------- <TRPosWindowSelector /> ---------------------

    const TRPosWindowSelector = React.createClass({
        render : function () {
            return <TRWindowSelector
                        options={this.props.options}
                        namePrefix="fc_pos"
                        windowTypeSelector={this.props.fc_pos_window_type}
                        windowSizeSelector={this.props.fc_pos_wsize} />;
        }
    });

    // ------------------------------- <LemmaFilter /> ---------------------

    const LemmaFilter = React.createClass({

        mixins : mixins,

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                props: {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <table className="form">
                    <tbody>
                        <TRLemmaWindowSelector options={this.props.lemmaWindowSizes}
                            fc_lemword_window_type={this.props.fc_lemword_window_type}
                            fc_lemword_wsize={this.props.fc_lemword_wsize} />
                        <tr>
                            <th>
                            {this.props.hasLemmaAttr
                                ? this.translate('query__lw_lemmas')
                                : this.translate('query__lw_word_forms')
                            }
                            </th>
                            <td>
                                <input type="text" className="fc_lemword" name="fc_lemword" value={this.props.fc_lemword}
                                        onChange={this._handleInputChange} />
                                {'\u00A0'}
                                <AllAnyNoneSelector inputName="fc_lemword_type" value={this.props.fc_lemword_type} />
                                {'\u00A0'}
                                {this.translate('query__of_these_items')}.
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // ------------------------------- <PoSFilter /> ---------------------

    const PoSFilter = React.createClass({
        mixins : mixins,

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                props: {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        },

        _handleMultiSelectChange : function (evt) {
            const values = Array.prototype
                .filter.call(evt.target.options, item => item.selected)
                .map(item => item.value);
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_CONTEXT_FORM_ITEM',
                props: {
                    name: evt.target.name,
                    value: values
                }
            });
        },

        render : function () {
            return (
                <div>
                    <h3>{this.translate('query__pos_filter')}</h3>
                    <table className="form">
                        <tbody>
                            <TRPosWindowSelector options={this.props.posWindowSizes}
                                fc_pos_window_type={this.props.fc_pos_window_type}
                                fc_pos_wsize={this.props.fc_pos_wsize} />
                            <tr>
                                <th>
                                    {this.translate('query__pos_filter')}:<br />
                                    <span className="note">({this.translate('query__use_ctrl_click_for')})</span>
                                </th>
                                <td>
                                    <select title={this.translate('query__select_one_or_more_pos_tags')}
                                            multiple="multiple"
                                            size="4"
                                            name="fc_pos" value={this.props.fc_pos}
                                            onChange={this._handleMultiSelectChange}>
                                        {this.props.wPoSList.map((item, i) => {
                                            return <option key={i} value={item.n}>{item.n}</option>;
                                        })}
                                    </select>
                                </td>
                                <td>
                                    <AllAnyNoneSelector inputName="fc_pos_type" value={this.props.fc_pos_type} />
                                    {'\u00A0'}
                                    {this.translate('query__of_these_items')}.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        }
    });

    // ------------------------------- <SpecifyContextForm /> ---------------------

    const SpecifyContextForm = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                data: queryContextStore.getData()
            }
        },

        _handleStoreChange : function () {
            this.setState({data: queryContextStore.getData()});
        },

        componentDidMount : function () {
            queryContextStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            queryContextStore.removeChangeListener(this._handleStoreChange);
        },

        render : function () {
            return (
                <div>
                    <h3>{this.props.hasLemmaAttr
                        ? this.translate('query__lemma_filter')
                        : this.translate('query__word_form_filter')}
                    </h3>
                    <LemmaFilter
                        hasLemmaAttr={this.props.hasLemmaAttr}
                        lemmaWindowSizes={this.props.lemmaWindowSizes}
                        fc_lemword_window_type={this.state.data.fc_lemword_window_type}
                        fc_lemword_window_type={this.state.data.fc_lemword_window_type}
                        fc_lemword_wsize={this.state.data.fc_lemword_wsize}
                        fc_lemword={this.state.data.fc_lemword}
                        fc_lemword_type={this.state.data.fc_lemword_type}
                         />
                    {this.props.wPoSList && this.props.wPoSList.size > 0
                        ? <PoSFilter
                                posWindowSizes={this.props.posWindowSizes}
                                wPoSList={this.props.wPoSList}
                                fc_pos_window_type={this.state.data.fc_pos_window_type}
                                fc_pos_wsize={this.state.data.fc_pos_wsize}
                                fc_pos={this.state.data.fc_pos}
                                fc_pos_type={this.state.data.fc_pos_type}
                                />
                        : null}
                </div>
            );
        }
    });


    return {
        SpecifyContextForm: SpecifyContextForm
    };
}