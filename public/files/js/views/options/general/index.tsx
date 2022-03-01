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
import { IActionDispatcher, Bound, StatelessModel } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { GeneralViewOptionsModelState } from '../../../models/options/general';
import { Actions } from '../../../models/options/actions';

import * as S from './style';
import { FreqResultViews } from '../../../models/freqs/common';


export interface GeneralViews {
    GeneralOptions:React.ComponentClass<{}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        generalOptionsModel:StatelessModel<GeneralViewOptionsModelState>):GeneralViews {

    const layoutViews = he.getLayoutViews();

    // ------------- <TRConcPageSizeInput /> ---------------------

    const TRConcPageSizeInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetPageSize>({
                name: Actions.GeneralSetPageSize.name,
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
                        <input className="tst-conc-page-size" type="text" value={props.value.value} min={0}
                                onChange={handleInputChange} style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetConcordance /> ---------------------

    const TRKwicContextSize:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetContextSize>({
                name: Actions.GeneralSetContextSize.name,
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
                        <input className="tst-conc-kwic-size"  type="text" value={props.value.value} min={0}
                                onChange={handleInputChange} style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <TRShowLineNumbers /> ---------------------

    const TRShowLineNumbersCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleInputChange = () => {
            dispatcher.dispatch<typeof Actions.GeneralSetLineNums>({
                name: Actions.GeneralSetLineNums.name,
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
                <td align="center">
                    <layoutViews.ToggleSwitch
                        id="show-line-numbers-input"
                        onChange={handleInputChange}
                        checked={props.value}/>
                </td>
            </tr>
        );
    };

    // ------------- <TRAlwaysShuffleCheckbox /> ---------------------

    const TRAlwaysShuffleCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleInputChange = () => {
            dispatcher.dispatch<typeof Actions.GeneralSetShuffle>({
                name: Actions.GeneralSetShuffle.name,
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
                <td align="center">
                    <input type="hidden" name="shuffle" value="0" />
                    <layoutViews.ToggleSwitch
                        id="always-shuffle"
                        onChange={handleInputChange}
                        checked={props.value}/>
                </td>
            </tr>
        );
    };

    // ------------- <TRUseRichQueryEditor /> ---------------------

    const TRUseRichQueryEditor:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleCheckbox = () => {
            dispatcher.dispatch<typeof Actions.GeneralSetUseRichQueryEditor>({
                name: Actions.GeneralSetUseRichQueryEditor.name,
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="use-rich-editor">
                        {he.translate('options__use_rich_query_editor')}:
                    </label>
                </th>
                <td align="center">
                    <layoutViews.ToggleSwitch
                        id="use-rich-editor"
                        onChange={handleCheckbox}
                        checked={props.value}/>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetConcordance /> ---------------------

    const FieldsetConcordance:React.FC<{
        pageSize:Kontext.FormValue<string>;
        newCtxSize:Kontext.FormValue<string>;
        lineNumbers:boolean;
        shuffle:boolean;
        useRichQueryEditor:boolean;

    }> = (props) => {
        return (
            <fieldset className="FieldsetConcordance">
                <legend>
                    {he.translate('options__concordance_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <TRConcPageSizeInput value={props.pageSize} />
                        <TRKwicContextSize value={props.newCtxSize} />
                        <TRShowLineNumbersCheckbox value={props.lineNumbers} />
                        <TRAlwaysShuffleCheckbox value={props.shuffle} />
                        <TRUseRichQueryEditor value={props.useRichQueryEditor} />
                    </tbody>
                </S.ResultRangeAndPagingTable>
            </fieldset>
        );
    };

    // ------------- <TRWordlistNumPagesInput /> ---------------------

    const TRWordlistNumPagesInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetWlPageSize>({
                name: Actions.GeneralSetWlPageSize.name,
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
                                style={{width: '2em'}} min={0} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetWordlist /> ---------------------

    const FieldsetWordlist:React.FC<{
        wlPageSize:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetWordlist">
                <legend>
                    {he.translate('options__worlist_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <TRWordlistNumPagesInput value={props.wlPageSize} />
                    </tbody>
                </S.ResultRangeAndPagingTable>
            </fieldset>
        );
    };

    // ------------- <TRFmaxitemsInput /> ---------------------

    const TRFmaxitemsInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetFmaxItems>({
                name: Actions.GeneralSetFmaxItems.name,
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
                            style={{width: '2em'}} min={0} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // ------------- <TRDefaultView /> ---------------------

    const TRDefaultView:React.FC<{
        value:FreqResultViews;

    }> = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetFDefaultView>({
                name: Actions.GeneralSetFDefaultView.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__freq_default_view')}:
                </th>
                <td>
                    <select value={props.value} onChange={handleSelectChange} >
                        <option value='charts'>{he.translate('options__freq_default_view_charts')}</option>
                        <option value='tables'>{he.translate('options__freq_default_view_tables')}</option>
                    </select>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetFreqDistrib /> ---------------------

    const FieldsetFreqDistrib:React.FC<{
        fmaxItems:Kontext.FormValue<string>;
        fdefaultView:FreqResultViews;

    }> = (props) => {
        return (
            <fieldset className="FieldsetFreqDistrib">
                <legend>
                    {he.translate('options__freq_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <TRFmaxitemsInput value={props.fmaxItems} />
                        <TRDefaultView value={props.fdefaultView} />
                    </tbody>
                </S.ResultRangeAndPagingTable>
            </fieldset>
        );
    };

    // ------------- <TRCitemsPerPageInput /> ---------------------

    const TRCitemsPerPageInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetCitemsPerPage>({
                name: Actions.GeneralSetCitemsPerPage.name,
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
                                style={{width: '2em'}} min={0} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetColl /> ---------------------

    const FieldsetColl:React.FC<{
        citemsPerPage:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetColl">
                <legend>
                    {he.translate('options__coll_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <TRCitemsPerPageInput value={props.citemsPerPage} />
                    </tbody>
                </S.ResultRangeAndPagingTable>
            </fieldset>
        );
    };

    // ------------- <TRPQueryitemsPerPageInput /> ---------------------

    const TRPQueryitemsPerPageInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetPQueryitemsPerPage>({
                name: Actions.GeneralSetPQueryitemsPerPage.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__pquery_page_size')}:
                </th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input type="text" value={props.value.value} onChange={handleInputChange}
                                style={{width: '2em'}} min={0} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetPquery /> ---------------------

    const FieldsetPquery:React.FC<{
        resultsPerPage:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetPquery">
                <legend>
                    {he.translate('options__pquery_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <TRPQueryitemsPerPageInput value={props.resultsPerPage} />
                    </tbody>
                </S.ResultRangeAndPagingTable>
            </fieldset>
        );
    };

    // --------------------- <SubmitButton /> -------------------------

    const SubmitButton:React.FC<{
        modelIsBusy:boolean;

    }> = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch<typeof Actions.GeneralSubmit>({
                name: Actions.GeneralSubmit.name
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

    class GeneralOptions extends React.PureComponent<GeneralViewOptionsModelState> {

        render() {
            return (
                <S.GeneralOptions>
                    <p>
                        {he.translate('options__this_applies_for_all_the_corpora')}
                    </p>
                    <form>
                        {this.props.loaded ?
                            <>
                                <FieldsetConcordance pageSize={this.props.pageSize}
                                    newCtxSize={this.props.newCtxSize}
                                    lineNumbers={this.props.lineNumbers}
                                    shuffle={this.props.shuffle}
                                    useRichQueryEditor={this.props.useRichQueryEditor} />
                                <FieldsetWordlist wlPageSize={this.props.wlpagesize}  />
                                <FieldsetFreqDistrib fmaxItems={this.props.fmaxitems}
                                    fdefaultView={this.props.fdefaultView} />
                                <FieldsetColl citemsPerPage={this.props.citemsperpage} />
                                <FieldsetPquery resultsPerPage={this.props.pqueryitemsperpage} />
                            </> :
                            <p className='data-loader'>
                                <img src={he.createStaticUrl('img/ajax-loader.gif')}
                                    className="ajax-loader"
                                    alt={he.translate('global__loading')}
                                    title={he.translate('global__loading')} />
                            </p>
                        }
                        {this.props.userIsAnonymous ?
                            <p className="warn">
                                <layoutViews.StatusIcon status="warning" htmlClass="icon" inline={true} />
                                {he.translate('global__anon_user_opts_save_warn')}
                            </p> :
                            null
                        }
                        <div className="buttons">
                            <SubmitButton modelIsBusy={this.props.isBusy} />
                        </div>
                    </form>
                </S.GeneralOptions>
            );
        }
    }

    const BoundGeneralOptions = Bound(GeneralOptions, generalOptionsModel);

    return {
        GeneralOptions: BoundGeneralOptions
    }
}