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

import { Kontext } from '../../types/common';
import { GeneralViewOptionsModelState } from '../../models/options/general';
import { Actions, ActionName } from '../../models/options/actions';

import * as S from './style';


export interface GeneralViews {
    GeneralOptions:React.ComponentClass<{}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        generalOptionsModel:StatelessModel<GeneralViewOptionsModelState>):GeneralViews {

    const layoutViews = he.getLayoutViews();

    // ------------- <TRConcPageSizeInput /> ---------------------

    const TRConcPageSizeInput:React.FC<{
        value:Kontext.FormValue<number>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.GeneralSetPageSize>({
                name: ActionName.GeneralSetPageSize,
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
                        <input type="number" value={props.value.value} min={0}
                                onChange={handleInputChange} style={{width: '2em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetConcordance /> ---------------------

    const TRKwicContextSize:React.FC<{
        value:Kontext.FormValue<number>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.GeneralSetContextSize>({
                name: ActionName.GeneralSetContextSize,
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
                        <input type="number" value={props.value.value} min={0}
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
            dispatcher.dispatch<Actions.GeneralSetLineNums>({
                name: ActionName.GeneralSetLineNums,
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
            dispatcher.dispatch<Actions.GeneralSetShuffle>({
                name: ActionName.GeneralSetShuffle,
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
            dispatcher.dispatch<Actions.GeneralSetUseRichQueryEditor>({
                name: ActionName.GeneralSetUseRichQueryEditor,
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
        pageSize:Kontext.FormValue<number>;
        newCtxSize:Kontext.FormValue<number>;
        lineNumbers:boolean;
        shuffle:boolean;
        useRichQueryEditor:boolean;

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
                        <TRUseRichQueryEditor value={props.useRichQueryEditor} />
                    </tbody>
                </table>
            </fieldset>
        );
    };

    // ------------- <TRWordlistNumPagesInput /> ---------------------

    const TRWordlistNumPagesInput:React.FC<{
        value:Kontext.FormValue<number>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.GeneralSetWlPageSize>({
                name: ActionName.GeneralSetWlPageSize,
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
                        <input type="number" value={props.value.value} onChange={handleInputChange}
                                style={{width: '2em'}} min={0} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------- <FieldsetWordlist /> ---------------------

    const FieldsetWordlist:React.FC<{
        wlPageSize:Kontext.FormValue<number>;

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

    const TRFmaxitemsInput:React.FC<{
        value:Kontext.FormValue<number>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.GeneralSetFmaxItems>({
                name: ActionName.GeneralSetFmaxItems,
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
                        <input type="number" value={props.value.value} onChange={handleInputChange}
                            style={{width: '2em'}} min={0} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetFreqDistrib /> ---------------------

    const FieldsetFreqDistrib:React.FC<{
        fmaxItems:Kontext.FormValue<number>;

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

    const TRCitemsPerPageInput:React.FC<{
        value:Kontext.FormValue<number>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.GeneralSetCitemsPerPage>({
                name: ActionName.GeneralSetCitemsPerPage,
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
                        <input type="number" value={props.value.value} onChange={handleInputChange}
                                style={{width: '2em'}} min={0} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // ------------- <FieldsetColl /> ---------------------

    const FieldsetColl:React.FC<{
        citemsPerPage:Kontext.FormValue<number>;

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

    const SubmitButton:React.FC<{
        modelIsBusy:boolean;

    }> = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch<Actions.GeneralSubmit>({
                name: ActionName.GeneralSubmit
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
                                <FieldsetFreqDistrib fmaxItems={this.props.fmaxitems} />
                                <FieldsetColl citemsPerPage={this.props.citemsperpage} />
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