/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


export function init(dispatcher, helpers, layoutViews, generalOptionsModel) {

    // ------------- <TRConcPageSizeInput /> ---------------------

    const TRConcPageSizeInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_PAGESIZE',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {helpers.translate('options__conc_page_size')}:
                </th>
                <td>
                    <input type="text" value={props.value}
                            onChange={handleInputChange} style={{width: '2em'}} />
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetConcordance /> ---------------------

    const TRKwicContextSize = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_CONTEXTSIZE',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {helpers.translate('options__conc_kwic_context')}:
                </th>
                <td>
                    <input type="text" value={props.value}
                            onChange={handleInputChange} style={{width: '2em'}} />
                </td>
            </tr>
        );
    };

    // ------------- <TRShowLineNumbers /> ---------------------

    const TRShowLineNumbersCheckbox = (props) => {

        const handleInputChange = () => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_LINE_NUMS',
                props: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="show-line-numbers-input">
                        {helpers.translate('options__conc_show_line_nums')}:
                    </label>
                </th>
                <td>
                    <input id="show-line-numbers-input" type="checkbox"
                        onChange={handleInputChange} checked={props.value} />
                </td>
            </tr>
        );
    };

    // ------------- <TRAlwaysShuffleCheckbox /> ---------------------

    const TRAlwaysShuffleCheckbox = (props) => {

        const handleInputChange = () => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE',
                props: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="always-shuffle">
                        {helpers.translate('options__conc_shuffle_by_default')}:
                    </label>
                    <br />
                    <span className="note">
                        ({helpers.translate('options__conc_no_effect_on_current')})
                    </span>
                </th>
                <td>
                    <input type="hidden" name="shuffle" value="0" />
                    <input id="always-shuffle" type="checkbox"
                            onChange={handleInputChange} checked={props.value} />
                </td>
            </tr>
        );
    };

    // ------------ <TRShowTextTypesOverview /> ----------------------------

    const TRShowTextTypesOverview = (props) => {

        const handleCheckbox = () => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_SHOW_TT_OVERVIEW',
                props: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="show-tt-overview">
                        {helpers.translate('options__conc_show_tt_overview')}:
                    </label>
                </th>
                <td>
                    <input id="show-tt-overview" type="checkbox" onChange={handleCheckbox} checked={props.value} />
                </td>
            </tr>
        );
    };

    // ------------- <TRUseCQLEditor /> ---------------------

    const TRUseCQLEditor = (props) => {

        const handleCheckbox = () => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_USE_CQL_EDITOR',
                props: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="use-cql-editor">
                        {helpers.translate('options__use_advanced_cql_editor')}:
                    </label>
                </th>
                <td>
                    <input id="use-cql-editor" type="checkbox" onChange={handleCheckbox} checked={props.value} />
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetConcordance /> ---------------------

    const FieldsetConcordance = (props) => {
        return (
            <fieldset className="FieldsetConcordance">
                <legend>
                    {helpers.translate('options__concordance_fieldset_heading')}
                </legend>
                <table className="results-range-and-paging">
                    <tbody>
                        <TRConcPageSizeInput value={props.pageSize} />
                        <TRKwicContextSize value={props.newCtxSize} />
                        <TRShowLineNumbersCheckbox value={props.lineNumbers} />
                        <TRAlwaysShuffleCheckbox value={props.shuffle} />
                        <TRShowTextTypesOverview value={props.showTTOverview} />
                        <TRUseCQLEditor value={props.useCQLEditor} />
                    </tbody>
                </table>
            </fieldset>
        );
    };

    // ------------- <TRWordlistNumPagesInput /> ---------------------

    const TRWordlistNumPagesInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_WLPAGESIZE',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {helpers.translate('options__wordlist_page_size')}:
                </th>
                <td>
                    <input type="text" value={props.value} onChange={handleInputChange}
                            style={{width: '2em'}} />
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetWordlist /> ---------------------

    const FieldsetWordlist = (props) => {
        return (
            <fieldset className="FieldsetWordlist">
                <legend>
                    {helpers.translate('options__worlist_fieldset_heading')}
                </legend>
                <table className="results-range-and-paging">
                    <tbody>
                        <TRWordlistNumPagesInput value={props.wlPageSize} />
                    </tbody>
                </table>
            </fieldset>
        );
    };

    // ------------- <TRFmaxitemsInput /> ---------------------

    const TRFmaxitemsInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_FMAXITEMS',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {helpers.translate('options__freq_page_size')}:
                </th>
                <td>
                    <input type="text" value={props.value} onChange={handleInputChange}
                            style={{width: '2em'}} />
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetFreqDistrib /> ---------------------

    const FieldsetFreqDistrib = (props) => {
        return (
            <fieldset className="FieldsetFreqDistrib">
                <legend>
                    {helpers.translate('options__freq_fieldset_heading')}
                </legend>
                <table className="results-range-and-paging">
                    <tbody>
                        <TRFmaxitemsInput value={props.fmaxItems} />
                    </tbody>
                </table>
            </fieldset>
        );
    };

    // ------------- <TRCitemsPerPageInput /> ---------------------

    const TRCitemsPerPageInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SET_CITEMSPERPAGE',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {helpers.translate('options__coll_page_size')}:
                </th>
                <td>
                    <input type="text" value={props.value} onChange={handleInputChange}
                            style={{width: '2em'}} />
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetColl /> ---------------------

    const FieldsetColl = (props) => {
        return (
            <fieldset className="FieldsetColl">
                <legend>
                    {helpers.translate('options__coll_fieldset_heading')}
                </legend>
                <table className="results-range-and-paging">
                    <tbody>
                        <TRCitemsPerPageInput value={props.citemsPerPage} />
                    </tbody>
                </table>
            </fieldset>
        );
    };

    // --------------------- <SubmitButton /> -------------------------

    const SubmitButton = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch({
                actionType: 'GENERAL_VIEW_OPTIONS_SUBMIT',
                props: {}
            });
        };

        if (props.modelIsBusy) {
            return <img src={helpers.createStaticUrl('img/ajax-loader-bar.gif')}
                        className="button-replace ajax-loader"
                        alt={helpers.translate('global__loading')} />;

        } else {
            return (
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {helpers.translate('options__submit')}
                </button>
            );
        }
    }

    // --------------------- <GeneralOptions /> -------------------------

    class GeneralOptions extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _fetchModelState() {
            return {
                pageSize: generalOptionsModel.getPageSize(),
                newCtxSize: generalOptionsModel.getNewCtxSize(),
                lineNumbers: generalOptionsModel.getLineNumbers(),
                shuffle: generalOptionsModel.getShuffle(),
                wlPageSize: generalOptionsModel.getWlPageSize(),
                fmaxItems: generalOptionsModel.getFmaxItems(),
                citemsPerPage: generalOptionsModel.getCitemsPerPage(),
                showTTOverview: generalOptionsModel.getShowTTOverview(),
                modelIsBusy: generalOptionsModel.getIsBusy(),
                useCQLEditor: generalOptionsModel.getUseCQLEditor()
            };
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            generalOptionsModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            generalOptionsModel.removeChangeListener(this._handleModelChange);
        }

        render() {
            return (
                <div className="GeneralOptions">
                    <p>
                        {helpers.translate('options__this_applies_for_all_the_corpora')}
                    </p>
                    <form>
                        <FieldsetConcordance pageSize={this.state.pageSize}
                                newCtxSize={this.state.newCtxSize}
                                lineNumbers={this.state.lineNumbers}
                                shuffle={this.state.shuffle}
                                showTTOverview={this.state.showTTOverview}
                                useCQLEditor={this.state.useCQLEditor} />
                        <FieldsetWordlist wlPageSize={this.state.wlPageSize}  />
                        <FieldsetFreqDistrib fmaxItems={this.state.fmaxItems} />
                        <FieldsetColl citemsPerPage={this.state.citemsPerPage} />
                        <div className="buttons">
                            <SubmitButton modelIsBusy={this.state.modelIsBusy} />
                        </div>
                    </form>
                </div>
            );
        }
    }

    return {
        GeneralOptions: GeneralOptions
    }
}