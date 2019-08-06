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
import {Kontext} from '../../types/common';
import {SaveData} from '../../app/navigation';
import { ConcSaveModel } from '../../models/concordance/save';
import { Subscription } from 'rxjs';


export interface ConcSaveFormProps {
}


interface ConcSaveFormState {
    fromLine:Kontext.FormValue<string>;
    toLine:Kontext.FormValue<string>;
    saveFormat:string; // TODO enum
    alignKwic:boolean;
    includeLineNumbers:boolean;
    includeHeading:boolean;
}


export interface SaveViews {
    ConcSaveForm:React.ComponentClass<ConcSaveFormProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, concSaveModel:ConcSaveModel) {

    const layoutViews = he.getLayoutViews();

    // ------------------ <TRFormatSelect /> --------------------

    const TRFormatSelect:React.SFC<{
        value:string;

    }> = (props) => {

        const handleSelect = (evt) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SAVE_FORM_SET_FORMAT',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('concview__save_conc_as_label')}:
                </th>
                <td>
                    <select value={props.value} onChange={handleSelect}>
                        <option value="csv">CSV</option>
                        <option value="xlsx">XLSX (Excel)</option>
                        <option value="xml">XML</option>
                        <option value="text">Text</option>
                    </select>
                </td>
            </tr>
        );
    };

    // ---------- <TRIncludeHeadingCheckbox /> ----------

    const TRIncludeHeadingCheckbox:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SAVE_FORM_SET_HEADING',
                payload: {value: !props.value}
            });
        }

        return (
            <tr>
                <th>
                    <label htmlFor="document-heading-checkbox">
                        {he.translate('concview__save_form_incl_heading')}
                        :{'\u00a0'}
                    </label>
                </th>
                <td>
                    <input id="document-heading-checkbox" type="checkbox"
                        onChange={handleChange} checked={props.value} />
                </td>
            </tr>
        );
    };

    // ------------------- <TRIncludeLineNumbersCheckbox /> -------

    const TRIncludeLineNumbersCheckbox:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SAVE_FORM_SET_INCL_LINE_NUMBERS',
                payload: {value: !props.value}
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="line-numbering-checkbox">
                    {he.translate('concview__save_form_incl_line_nums')}
                    :{'\u00a0'}
                    </label>
                </th>
                <td>
                    <input id="line-numbering-checkbox" type="checkbox"
                        checked={props.value} onChange={handleChange} />
                </td>
            </tr>
        );
    };

    // ------------------- <TRAlignKwicCheckbox /> -------

    const TRAlignKwicCheckbox:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SAVE_FORM_SET_ALIGN_KWIC',
                payload: {value: !props.value}
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="align-kwic-checkbox">
                        {he.translate('concview__save_form_align_kwic')}
                        :{'\u00a0'}
                    </label>
                </th>
                <td>
                    <input id="align-kwic-checkbox" type="checkbox"
                        onChange={handleChange} checked={props.value} />
                </td>
            </tr>
        );
    };

    // ------------------- <TRLineRangeInput /> -------

    const TRLineRangeInput:React.SFC<{
        fromLine:Kontext.FormValue<string>;
        toLine:Kontext.FormValue<string>;

    }> = (props) => {

        const handleFromInput = (evt) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SAVE_FORM_SET_FROM_LINE',
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleToInput = (evt) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SAVE_FORM_SET_TO_LINE',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {he.translate('concview__save_form_lines_to_store')}
                    {'\u00a0'}:
                </th>
                <td>
                    {he.translate('concview__save_form_line_from')}:{'\u00a0'}
                    <layoutViews.ValidatedItem invalid={props.fromLine.isInvalid}>
                        <input type="text" value={props.fromLine.value}
                            onChange={handleFromInput} style={{width: '4em'}} />
                    </layoutViews.ValidatedItem>
                    {'\u00a0'}
                    {he.translate('concview__save_form_line_to')}:{'\u00a0'}
                    <layoutViews.ValidatedItem invalid={props.toLine.isInvalid}>
                        <input type="text" value={props.toLine.value}
                            onChange={handleToInput} style={{width: '4em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    };

    // ------------------- <ConcSaveForm /> -------


    class ConcSaveForm extends React.Component<ConcSaveFormProps, ConcSaveFormState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _fetchModelState() {
            return {
                fromLine: concSaveModel.getFromLine(),
                toLine: concSaveModel.getToLine(),
                saveFormat: concSaveModel.getSaveFormat(),
                alignKwic: concSaveModel.getAlignKwic(),
                includeLineNumbers: concSaveModel.getIncludeLineNumbers(),
                includeHeading: concSaveModel.getIncludeHeading()
            };
        }

        _handleModelChange() {
            if (concSaveModel.getFormIsActive()) {
                this.setState(this._fetchModelState());
            }
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                name: 'CONCORDANCE_RESULT_CLOSE_SAVE_FORM',
                payload: {}
            });
        }

        componentDidMount() {
            this.modelSubscription = concSaveModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _renderFormatDependentOptions() {
            switch (this.state.saveFormat) {
            case SaveData.Format.TEXT:
                return <>
                        <TRAlignKwicCheckbox key="opt-ak" value={this.state.alignKwic} />
                        <TRIncludeHeadingCheckbox key="opt-ih" value={this.state.includeHeading} />
                </>;
            case SaveData.Format.XML:
            case SaveData.Format.XLSX:
            case SaveData.Format.CSV:
                return <TRIncludeHeadingCheckbox key="opt-ih" value={this.state.includeHeading} />;
            default:
                return null;
            }
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                name: 'COLL_SAVE_FORM_SUBMIT',
                payload: {}
            });
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                    <layoutViews.CloseableFrame onCloseClick={this._handleCloseClick}
                                label={he.translate('concview__save_conc_head')} scrollable={true}>
                        <form action="saveconc">
                            <table className="form">
                                <tbody>
                                    <TRFormatSelect value={this.state.saveFormat} />
                                    <TRIncludeLineNumbersCheckbox value={this.state.includeLineNumbers} />
                                    {this._renderFormatDependentOptions()}
                                    <TRLineRangeInput fromLine={this.state.fromLine}
                                            toLine={this.state.toLine} />
                                </tbody>
                            </table>
                            <div className="buttons">
                                <button type="button" className="default-button"
                                        onClick={this._handleSubmitClick}>
                                    {he.translate('concview__save_btn')}
                                </button>
                            </div>
                        </form>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    }

    return {
        ConcSaveForm: ConcSaveForm
    };

}