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
import {IActionDispatcher} from 'kombo';
import {Kontext, ViewOptions} from '../../types/common';
import { Subscription } from 'rxjs';


export interface GeneralOptionsProps {

}

export interface GeneralViews {
    GeneralOptions:React.ComponentClass<GeneralOptionsProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        generalOptionsModel:ViewOptions.IGeneralViewOptionsModel):GeneralViews {

    const layoutViews = he.getLayoutViews();

    // ------------- <TRConcPageSizeInput /> ---------------------

    const TRConcPageSizeInput:React.SFC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_PAGESIZE',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__conc_page_size')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input type="text" value={props.value.value}
                                onChange={handleInputChange} style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetConcordance /> ---------------------

    const TRKwicContextSize:React.SFC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_CONTEXTSIZE',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__conc_kwic_context')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input type="text" value={props.value.value}
                                onChange={handleInputChange} style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <TRShowLineNumbers /> ---------------------

    const TRShowLineNumbersCheckbox:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleInputChange = () => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_LINE_NUMS',
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="show-line-numbers-input">
                        {he.translate('options__conc_show_line_nums')}:
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

    const TRAlwaysShuffleCheckbox:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleInputChange = () => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE',
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="always-shuffle">
                        {he.translate('options__conc_shuffle_by_default')}:
                    </label>
                    <br />
                    <span className="note">
                        ({he.translate('options__conc_no_effect_on_current')})
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

    // ------------- <TRUseCQLEditor /> ---------------------

    const TRUseCQLEditor:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleCheckbox = () => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_USE_CQL_EDITOR',
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="use-cql-editor">
                        {he.translate('options__use_advanced_cql_editor')}:
                    </label>
                </th>
                <td>
                    <input id="use-cql-editor" type="checkbox" onChange={handleCheckbox} checked={props.value} />
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetConcordance /> ---------------------

    const FieldsetConcordance:React.SFC<{
        pageSize:Kontext.FormValue<string>;
        newCtxSize:Kontext.FormValue<string>;
        lineNumbers:boolean;
        shuffle:boolean;
        useCQLEditor:boolean;

    }> = (props) => {
        return (
            <fieldset className="FieldsetConcordance">
                <legend>
                    {he.translate('options__concordance_fieldset_heading')}
                </legend>
                <table className="results-range-and-paging">
                    <tbody>
                        <TRConcPageSizeInput value={props.pageSize} />
                        <TRKwicContextSize value={props.newCtxSize} />
                        <TRShowLineNumbersCheckbox value={props.lineNumbers} />
                        <TRAlwaysShuffleCheckbox value={props.shuffle} />
                        <TRUseCQLEditor value={props.useCQLEditor} />
                    </tbody>
                </table>
            </fieldset>
        );
    };

    // ------------- <TRWordlistNumPagesInput /> ---------------------

    const TRWordlistNumPagesInput:React.SFC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_WLPAGESIZE',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__wordlist_page_size')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input type="text" value={props.value.value} onChange={handleInputChange}
                                style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetWordlist /> ---------------------

    const FieldsetWordlist:React.SFC<{
        wlPageSize:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetWordlist">
                <legend>
                    {he.translate('options__worlist_fieldset_heading')}
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

    const TRFmaxitemsInput:React.SFC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_FMAXITEMS',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__freq_page_size')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input type="text" value={props.value.value} onChange={handleInputChange}
                            style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetFreqDistrib /> ---------------------

    const FieldsetFreqDistrib:React.SFC<{
        fmaxItems:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetFreqDistrib">
                <legend>
                    {he.translate('options__freq_fieldset_heading')}
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

    const TRCitemsPerPageInput:React.SFC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SET_CITEMSPERPAGE',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__coll_page_size')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input type="text" value={props.value.value} onChange={handleInputChange}
                                style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetColl /> ---------------------

    const FieldsetColl:React.SFC<{
        citemsPerPage:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetColl">
                <legend>
                    {he.translate('options__coll_fieldset_heading')}
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

    const SubmitButton:React.SFC<{
        modelIsBusy:boolean;

    }> = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch({
                name: 'GENERAL_VIEW_OPTIONS_SUBMIT',
                payload: {}
            });
        };

        if (props.modelIsBusy) {
            return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                        className="button-replace ajax-loader"
                        alt={he.translate('global__loading')} />;

        } else {
            return (
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('options__submit')}
                </button>
            );
        }
    }

    // --------------------- <GeneralOptions /> -------------------------

    class GeneralOptions extends React.Component<GeneralOptionsProps,
    {
        pageSize:Kontext.FormValue<string>;
        newCtxSize:Kontext.FormValue<string>;
        lineNumbers:boolean;
        shuffle:boolean;
        wlPageSize:Kontext.FormValue<string>;
        fmaxItems:Kontext.FormValue<string>;
        citemsPerPage:Kontext.FormValue<string>;
        modelIsBusy:boolean;
        useCQLEditor:boolean;
        userIsAnonymous:boolean;
    }> {

        private modelSubscription:Subscription;

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
                modelIsBusy: generalOptionsModel.getIsBusy(),
                useCQLEditor: generalOptionsModel.getUseCQLEditor(),
                userIsAnonymous: generalOptionsModel.getUserIsAnonymous()
            };
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            this.modelSubscription = generalOptionsModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div className="GeneralOptions">
                    <p>
                        {he.translate('options__this_applies_for_all_the_corpora')}
                    </p>
                    <form>
                        <FieldsetConcordance pageSize={this.state.pageSize}
                                newCtxSize={this.state.newCtxSize}
                                lineNumbers={this.state.lineNumbers}
                                shuffle={this.state.shuffle}
                                useCQLEditor={this.state.useCQLEditor} />
                        <FieldsetWordlist wlPageSize={this.state.wlPageSize}  />
                        <FieldsetFreqDistrib fmaxItems={this.state.fmaxItems} />
                        <FieldsetColl citemsPerPage={this.state.citemsPerPage} />
                        {this.state.userIsAnonymous ?
                            <p className="warn">
                                <layoutViews.StatusIcon status="warning" htmlClass="icon" inline={true} />
                                {he.translate('global__anon_user_opts_save_warn')}
                            </p> :
                            null
                        }
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