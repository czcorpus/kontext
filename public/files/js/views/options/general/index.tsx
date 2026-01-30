/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { IActionDispatcher, StatelessModel, useModel } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { GeneralViewOptionsModelState } from '../../../models/options/general.js';
import { Actions } from '../../../models/options/actions.js';

import * as S from './style.js';
import { FreqResultViews } from '../../../models/freqs/common.js';


export interface GeneralViews {
    GeneralOptions:React.FC;
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

    // ------------- <TRFixAuxiliaryCulumnsCheckbox /> --------------

    const TRFixAuxiliaryCulumnsCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleInputChange = () => {
            dispatcher.dispatch<typeof Actions.GeneralSetFixAuxColumns>({
                name: Actions.GeneralSetFixAuxColumns.name,
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="fix-aux-columns-input">
                        {he.translate('options__conc_fix_auxiliary_columns')}:
                    </label>
                </th>
                <td align="center">
                    <layoutViews.ToggleSwitch
                        id="fix-aux-columns-input"
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

    // ------------- <TrRefMaxWidth /> ---------------------------

    const TrRefMaxWidth:React.FC<{
        value:Kontext.FormValue<string>;
    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetMaxRefsWidth>({
                name: Actions.GeneralSetMaxRefsWidth.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="refs-max-width">
                        {he.translate('options__refs_max_width')}:
                    </label>
                </th>
                <td align="center">
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input className="tst-refs-max-width"  type="text" value={props.value.value} min={0}
                                onChange={handleInputChange} style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        )
    }

    // ------------- <FieldsetConcordance /> ---------------------

    const FieldsetConcordance:React.FC<{
        pageSize:Kontext.FormValue<string>;
        newCtxSize:Kontext.FormValue<string>;
        refMaxWidth:Kontext.FormValue<string>;
        lineNumbers:boolean;
        fixAuxColumns:boolean;
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
                        <TRFixAuxiliaryCulumnsCheckbox value={props.fixAuxColumns} />
                        <TrRefMaxWidth value={props.refMaxWidth} />
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

    // ------------- <TRFpageSizeInput /> ---------------------

    const TRFpageSizeInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetFpageSize>({
                name: Actions.GeneralSetFpageSize.name,
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
        fpagesize:Kontext.FormValue<string>;
        fdefaultView:FreqResultViews;

    }> = (props) => {
        return (
            <fieldset className="FieldsetFreqDistrib">
                <legend>
                    {he.translate('options__freq_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <TRFpageSizeInput value={props.fpagesize} />
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

    // ------------- <SubcListPageSizeInput /> ---------------------

    const SubcListPageSizeInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetSubcListPageSize>({
                name: Actions.GeneralSetSubcListPageSize.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__subclist_page_size')}:
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

    // ------------- <FieldsetSubcList /> ---------------------

    const FieldsetSubcList:React.FC<{
        subcPageSize:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetSubcList">
                <legend>
                    {he.translate('options__subclist_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <SubcListPageSizeInput value={props.subcPageSize} />
                    </tbody>
                </S.ResultRangeAndPagingTable>
            </fieldset>
        );
    };

    // ------------- <KWordsPageSizeInput /> ---------------------

    const KWordsPageSizeInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.GeneralSetKwPageSize>({
                name: Actions.GeneralSetKwPageSize.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('options__kwords_page_size')}:
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

    // ------------- <FieldsetKWords /> ---------------------

    const FieldsetKWords:React.FC<{
        kwPageSize:Kontext.FormValue<string>;

    }> = (props) => {
        return (
            <fieldset className="FieldsetKWords">
                <legend>
                    {he.translate('options__kwords_fieldset_heading')}
                </legend>
                <S.ResultRangeAndPagingTable>
                    <tbody>
                        <KWordsPageSizeInput value={props.kwPageSize} />
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

    const GeneralOptions:React.FC = () => {

        const state = useModel(generalOptionsModel);

        return (
            <S.GeneralOptions>
                <p>
                    {he.translate('options__this_applies_for_all_the_corpora')}
                </p>
                <form>
                    {state.loaded ?
                        <>
                            <FieldsetConcordance pageSize={state.pageSize}
                                newCtxSize={state.newCtxSize}
                                lineNumbers={state.lineNumbers}
                                fixAuxColumns={state.fixedAuxColumns}
                                refMaxWidth={state.refMaxWidth}
                                useRichQueryEditor={state.useRichQueryEditor} />
                            <FieldsetWordlist wlPageSize={state.wlpagesize}  />
                            <FieldsetFreqDistrib fpagesize={state.fpagesize}
                                fdefaultView={state.fdefaultView} />
                            <FieldsetColl citemsPerPage={state.citemsperpage} />
                            <FieldsetPquery resultsPerPage={state.pqueryitemsperpage} />
                            <FieldsetKWords kwPageSize={state.kwpagesize} />
                            <FieldsetSubcList subcPageSize={state.subcpagesize} />
                        </> :
                        <p className='data-loader'>
                            <img src={he.createStaticUrl('img/ajax-loader.gif')}
                                className="ajax-loader"
                                alt={he.translate('global__loading')}
                                title={he.translate('global__loading')} />
                        </p>
                    }
                    {state.userIsAnonymous ?
                        <p className="warn">
                            <layoutViews.StatusIcon status="warning" htmlClass="icon" inline={true} />
                            {he.translate('global__anon_user_opts_save_warn')}
                        </p> :
                        null
                    }
                    <div className="buttons">
                        <SubmitButton modelIsBusy={state.isBusy} />
                    </div>
                </form>
            </S.GeneralOptions>
        );
    }

    return {
        GeneralOptions
    }
}