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


export function init(dispatcher, mixins) {

    // ------------------------------- <AllAnyNoneSelector /> ---------------------

    let AllAnyNoneSelector = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <select name={this.props.inputName}>
                    <option value="all">{this.translate('query__aan_selector_all')}</option>
                    <option value="any">{this.translate('query__aan_selector_any')}</option>
                    <option value="none">{this.translate('query__aan_selector_none')}</option>
                </select>
            );
        }
    });

    // ------------------------------- <TRWindowSelector /> ---------------------

    let TRWindowSelector = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <tr>
                    <th align="left">{this.translate('query__window')}:</th>
                    <td>
                        <select name="fc_lemword_window_type">
                            <option value="left">{this.translate('query__left')}</option>
                            <option value="right">{this.translate('query__right')}</option>
                            <option value="both">{this.translate('query__both')}</option>
                        </select>
                        {'\u00A0'}
                        <select name="fc_lemword_wsize" default={this.props.defaultOption}>
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

    // ------------------------------- <LemmaFilter /> ---------------------

    let LemmaFilter = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <table className="form">
                    <tbody>
                        <TRWindowSelector options={this.props.lemmaWindowSizes} />
                        <tr>
                            <th align="left">
                            {this.props.hasLemmaAttr
                                ? this.translate('query__lw_lemmas')
                                : this.tranlsate('query__lw_word_forms')
                            }
                            </th>
                            <td>
                                <input type="text" className="fc_lemword" name="fc_lemword" />
                                {'\u00A0'}
                                <AllAnyNoneSelector inputName="fc_lemword_type" />
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

    let PoSFilter = React.createClass({
        mixins : mixins,

        render : function () {
            return (
                <table className="form">
                    <tbody>
                        <TRWindowSelector options={this.props.posWindowSizes} />
                        <tr>
                            <th valign="top" align="left">
                                {this.translate('query__pos_filter')}:<br />
                                <span className="note">({this.translate('query__use_ctrl_click_for')})</span>
                            </th>
                            <td>
                                <select title={this.translate('query__select_one_or_more_pos_tags')} multiple="multiple" size="4" name="fc_pos">
                                    {this.props.wPoSList.map((item, i) => {
                                        return <option key={i} value={item.v}>{item.n}</option>;
                                    })}
                                </select>
                            </td>
                            <td valign="top">
                                <AllAnyNoneSelector inputName="fc_pos_type" />
                                {'\u00A0'}
                                {this.translate('query__of_these_items')}.
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    });

    // ------------------------------- <SpecifyKontextForm /> ---------------------

    let SpecifyKontextForm = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <div className="foo">
                    <h3>{this.props.hasLemmaAttr
                        ? this.translate('query__lemma_filter')
                        : this.translate('query__word_form_filter')}
                    </h3>
                    <LemmaFilter hasLemmaAttr={this.props.hasLemmaAttr}
                        lemmaWindowSizes={this.props.lemmaWindowSizes} />

                    <h3>{this.translate('query__pos_filter')}</h3>
                    <PoSFilter posWindowSizes={this.props.posWindowSizes}
                                wPoSList={this.props.wPoSList}/>
                </div>
            );
        }
    });


    return {
        SpecifyKontextForm: SpecifyKontextForm
    };
}