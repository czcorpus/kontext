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


export function init(dispatcher, mixins, layoutViews, collFormStore) {


    // -------------------- <AttrSelection /> --------------------------------------------

    const AttrSelection = React.createClass({

        _handleSelection : function (evt) {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CATTR',
                props: {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <select onChange={this._handleSelection} value={this.props.cattr}>
                    {this.props.attrList.map(item => {
                        return <option key={item.n} value={item.n}>{item.label}</option>
                    })}
                </select>
            );
        }
    });

    // -------------------- <WindowSpanInput /> --------------------------------------------

    const WindowSpanInput = React.createClass({

        mixins : mixins,

        _handleFromValChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CFROMW',
                props: {
                    value: evt.target.value
                }
            });
        },

        _handleToValChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CTOW',
                props: {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <div>
                    <input type="text" style={{width: '3em'}} value={this.props.cfromw}
                        onChange={this._handleFromValChange} />
                    {'\u00a0'}{this.translate('coll__to')}{'\u00a0'}
                    <input type="text" style={{width: '3em'}} value={this.props.ctow}
                        onChange={this._handleToValChange} />
                </div>
            );
        }
    });

    // -------------------- <MinCollFreqCorpInput /> --------------------------------------------

    const MinCollFreqCorpInput = React.createClass({

        mixins : mixins,

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CMINFREQ',
                props: {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return <input type="text" value={this.props.cminfreq} style={{width: '3em'}}
                        onChange={this._handleInputChange} />;
        }

    });

    // -------------------- <MinCollFreqSpanInput /> --------------------------------------------

    const MinCollFreqSpanInput = React.createClass({

        mixins : mixins,

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CMINBGR',
                props: {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return <input type="text" value={this.props.cminbgr} style={{width: '3em'}}
                            onChange={this._handleInputChange} />;
        }

    });


    // -------------------- <CollMetricsSelection /> --------------------------------------------

    const CollMetricsSelection = React.createClass({

        mixins : mixins,

        _handleCheckboxClick : function (evt) {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CBGRFNS',
                props: {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <table>
                    <tbody>
                        {this.props.availCbgrfns.map((item, k) => {
                            return (
                                <tr key={`v_${k}`}>
                                    <td>
                                        <label htmlFor={`cbgrfns_input_${k}`}>{item}</label>
                                    </td>
                                    <td>
                                        <input id={`cbgrfns_input_${k}`} type="checkbox" value={k}
                                            checked={this.props.cbgrfns.includes(k)}
                                            onChange={this._handleCheckboxClick} />
                                    </td>
                                </tr>
                            );
                        }).toList()}
                    </tbody>
                </table>
            );
        }
    });

    // -------------------- <CollSortBySelection /> --------------------------------------------

    const CollSortBySelection = React.createClass({

        mixins : mixins,

        _handleCheckboxClick : function (evt) {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CSORTFN',
                props: {
                    value: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <table>
                    <tbody>
                        {this.props.availCbgrfns.map((item, k) => {
                            return (
                                <tr key={`v_${k}`}>
                                    <td>
                                        <label htmlFor={`csortfn_input_${k}`}>{item}</label>
                                    </td>
                                    <td>
                                        <input id={`csortfn_input_${k}`} type="radio" value={k}
                                            checked={this.props.csortfn === k} onChange={this._handleCheckboxClick} />
                                    </td>
                                </tr>
                            )
                        }).toList()}
                    </tbody>
                </table>
            );
        }
    });


    // -------------------- <CollocationsForm /> --------------------------------------------

    const CollocationsForm = React.createClass({

        mixins : mixins,

        _getStoreState : function () {
            return {
                attrList: collFormStore.getAttrList(),
                cattr: collFormStore.getCattr(),
                cfromw: collFormStore.getCfromw(),
                ctow: collFormStore.getCtow(),
                cminfreq: collFormStore.getCminfreq(),
                cminbgr: collFormStore.getCminbgr(),
                cbgrfns: collFormStore.getCbgrfns(),
                availCbgrfns: collFormStore.getAvailCbgrfns(),
                csortfn: collFormStore.getCsortfn()
            };
        },

        getInitialState : function () {
            return this._getStoreState();
        },

        _storeChangeListener : function () {
            this.setState(this._getStoreState());
        },

        componentDidMount : function () {
            collFormStore.addChangeListener(this._storeChangeListener);
        },

        componentWillUnmount : function () {
            collFormStore.removeChangeListener(this._storeChangeListener);
        },

        _handleSubmitClick : function () {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SUBMIT',
                props: {}
            });
        },

        render : function () {
            return (
                <form className="collocations-form" action="collx">
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>{this.translate('coll__attribute_label')}:</th>
                                <td>
                                    <AttrSelection attrList={this.state.attrList} cattr={this.state.cattr} />
                                </td>
                            </tr>
                            <tr>
                                <th>{this.translate('coll__coll_window_span')}:</th>
                                <td>
                                    <WindowSpanInput cfromw={this.state.cfromw} ctow={this.state.ctow} />
                                </td>
                            </tr>
                            <tr>
                                <th>{this.translate('coll__min_coll_freq_in_corpus')}:</th>
                                <td>
                                    <MinCollFreqCorpInput cminfreq={this.state.cminfreq} />
                                </td>
                            </tr>
                            <tr>
                                <th>{this.translate('coll__min_coll_freq_in_span')}:</th>
                                <td>
                                    <MinCollFreqSpanInput cminbgr={this.state.cminbgr} />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan="2">
                                    <fieldset className="colloc-metrics">
                                        <legend>
                                            {this.translate('coll__show_measures_legend')}
                                        </legend>
                                        <CollMetricsSelection cbgrfns={this.state.cbgrfns}
                                                availCbgrfns={this.state.availCbgrfns} />
                                    </fieldset>
                                    <fieldset className="colloc-metrics">
                                        <legend>
                                            {this.translate('coll__sort_by_legend')}
                                        </legend>
                                        <CollSortBySelection csortfn={this.state.csortfn}
                                                availCbgrfns={this.state.availCbgrfns} />
                                    </fieldset>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="buttons">
                        <button type="button" className="default-button"
                                onClick={this._handleSubmitClick}>
                            {this.translate('coll__make_candidate_list')}
                        </button>
                    </div>
                </form>
            );
        }
    });

    return {
        CollForm: CollocationsForm
    };

}