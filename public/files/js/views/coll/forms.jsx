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


import * as React from 'vendor/react';


export function init(dispatcher, he, layoutViews, collFormStore) {

    // -------------------- <AttrSelection /> --------------------------------------------

    const AttrSelection = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CATTR',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <select onChange={handleSelection} value={props.cattr}>
                {props.attrList.map(item => {
                    return <option key={item.n} value={item.n}>{item.label}</option>
                })}
            </select>
        );
    };

    // -------------------- <WindowSpanInput /> --------------------------------------------

    const WindowSpanInput = (props) => {

        const handleFromValChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CFROMW',
                props: {
                    value: evt.target.value
                }
            });
        };

        const handleToValChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CTOW',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <div>
                <input type="text" style={{width: '3em'}} value={props.cfromw}
                    onChange={handleFromValChange} />
                {'\u00a0'}{he.translate('coll__to')}{'\u00a0'}
                <input type="text" style={{width: '3em'}} value={props.ctow}
                    onChange={handleToValChange} />
            </div>
        );
    };

    // -------------------- <MinCollFreqCorpInput /> --------------------------------------------

    const MinCollFreqCorpInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CMINFREQ',
                props: {
                    value: evt.target.value
                }
            });
        };

        return <input type="text" value={props.cminfreq} style={{width: '3em'}}
                    onChange={handleInputChange} />;

    };

    // -------------------- <MinCollFreqSpanInput /> --------------------------------------------

    const MinCollFreqSpanInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CMINBGR',
                props: {
                    value: evt.target.value
                }
            });
        };

        return <input type="text" value={props.cminbgr} style={{width: '3em'}}
                        onChange={handleInputChange} />;
    };


    // -------------------- <CollMetricsSelection /> --------------------------------------------

    const CollMetricsSelection = (props) => {

        const handleCheckboxClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CBGRFNS',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <table>
                <tbody>
                    {props.availCbgrfns.map((item, k) => {
                        return (
                            <tr key={`v_${k}`}>
                                <td>
                                    <label htmlFor={`cbgrfns_input_${k}`}>{item}</label>
                                </td>
                                <td>
                                    <input id={`cbgrfns_input_${k}`} type="checkbox" value={k}
                                        checked={props.cbgrfns.includes(k)}
                                        onChange={handleCheckboxClick} />
                                </td>
                            </tr>
                        );
                    }).toList()}
                </tbody>
            </table>
        );
    };

    // -------------------- <CollSortBySelection /> --------------------------------------------

    const CollSortBySelection = (props) => {

        const handleCheckboxClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SET_CSORTFN',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <table>
                <tbody>
                    {props.availCbgrfns.map((item, k) => {
                        return (
                            <tr key={`v_${k}`}>
                                <td>
                                    <label htmlFor={`csortfn_input_${k}`}>{item}</label>
                                </td>
                                <td>
                                    <input id={`csortfn_input_${k}`} type="radio" value={k}
                                        checked={props.csortfn === k} onChange={handleCheckboxClick} />
                                </td>
                            </tr>
                        )
                    }).toList()}
                </tbody>
            </table>
        );
    };


    // -------------------- <CollocationsForm /> --------------------------------------------

    class CollocationsForm extends React.Component {

        constructor(props) {
            super(props);
            this._storeChangeListener = this._storeChangeListener.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
            this.state = this._getStoreState();
        }

        _getStoreState() {
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
        }

        _storeChangeListener() {
            this.setState(this._getStoreState());
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                actionType: 'COLL_FORM_SUBMIT',
                props: {}
            });
        }

        componentDidMount() {
            collFormStore.addChangeListener(this._storeChangeListener);
        }

        componentWillUnmount() {
            collFormStore.removeChangeListener(this._storeChangeListener);
        }

        render() {
            return (
                <form className="collocations-form">
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>{he.translate('coll__attribute_label')}:</th>
                                <td>
                                    <AttrSelection attrList={this.state.attrList} cattr={this.state.cattr} />
                                </td>
                            </tr>
                            <tr>
                                <th>{he.translate('coll__coll_window_span')}:</th>
                                <td>
                                    <WindowSpanInput cfromw={this.state.cfromw} ctow={this.state.ctow} />
                                </td>
                            </tr>
                            <tr>
                                <th>{he.translate('coll__min_coll_freq_in_corpus')}:</th>
                                <td>
                                    <MinCollFreqCorpInput cminfreq={this.state.cminfreq} />
                                </td>
                            </tr>
                            <tr>
                                <th>{he.translate('coll__min_coll_freq_in_span')}:</th>
                                <td>
                                    <MinCollFreqSpanInput cminbgr={this.state.cminbgr} />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan="2">
                                    <fieldset className="colloc-metrics">
                                        <legend>
                                            {he.translate('coll__show_measures_legend')}
                                        </legend>
                                        <CollMetricsSelection cbgrfns={this.state.cbgrfns}
                                                availCbgrfns={this.state.availCbgrfns} />
                                    </fieldset>
                                    <fieldset className="colloc-metrics">
                                        <legend>
                                            {he.translate('coll__sort_by_legend')}
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
                            {he.translate('coll__make_candidate_list')}
                        </button>
                    </div>
                </form>
            );
        }
    }

    return {
        CollForm: CollocationsForm
    };

}