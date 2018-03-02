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
import {Kontext} from '../../types/common';
import {FreqResultsSaveModel} from '../../models/freqs/save';
import {ActionDispatcher} from '../../app/dispatcher';


interface SaveFreqFormProps {
    onClose:()=>void;
}

interface SaveFreqFormState {
    saveformat:string;
    includeColHeaders:boolean;
    includeHeading:boolean;
    fromLine:string;
    toLine:string;
}

interface ExportedViews {
    SaveFreqForm:React.ComponentClass<SaveFreqFormProps>;
}


// ------------------------------------ factory -------------------------------------------

export function init(
        dispatcher:ActionDispatcher,
        utils:Kontext.ComponentHelpers,
        freqSaveModel:FreqResultsSaveModel):ExportedViews {


    const layoutViews = utils.getLayoutViews();

    // ---------------------------- <TRSaveFormatSelect /> ----------------------------

    interface TRSaveFormatSelectProps {
        value:string;
    }

    /**
     *
     */
    const TRSaveFormatSelect:React.SFC<TRSaveFormatSelectProps> = (props) => {

        const handleSelect = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_SAVE_FORM_SET_FORMAT',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>{utils.translate('coll__save_form_select_label')}:</th>
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

    // --------------------------------------------------------------------------------------
    // ---------------------------- <TRIncludeHeadingCheckbox /> ----------------------------

    interface TRIncludeHeadingCheckboxProps {
        value:boolean;
    }

    /**
     *
     */
    const TRIncludeHeadingCheckbox:React.SFC<TRIncludeHeadingCheckboxProps> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'FREQ_SAVE_FORM_SET_INCLUDE_HEADING',
                props: {
                    value: !props.value
                }
            });
        };

        return (
            <tr className="separator">
                <th>
                    <label htmlFor="tr-include-heading-checkbox">
                        {utils.translate('coll__save_form_incl_heading')}
                    </label>:
                </th>
                <td>
                    <input id="tr-include-heading-checkbox" type="checkbox" checked={props.value} onChange={handleChange} />
                </td>
            </tr>
        );
    }

    // --------------------------------------------------------------------------------------
    // ---------------------------- <TRColHeadersCheckbox /> --------------------------------

    interface TRColHeadersCheckboxProps {
        value:boolean;
    }

    /**
     *
     */
    const TRColHeadersCheckbox:React.SFC<TRColHeadersCheckboxProps> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'FREQ_SAVE_FORM_SET_INCLUDE_COL_HEADERS',
                props: {
                    value: !props.value
                }
            });
        };

        return (
            <tr className="separator">
                <th><label htmlFor="tr-col-headers-checkbox">{utils.translate('coll__save_form_incl_col_hd')}</label>:</th>
                <td>
                    <input id="tr-col-headers-checkbox" type="checkbox" checked={props.value} onChange={handleChange} />
                </td>
            </tr>
        );
    };

    // --------------------------------------------------------------------------------------
    // ---------------------------- <TRSelLineRangeInputs /> --------------------------------

    interface TRSelLineRangeInputsProps {
        fromValue:string;
        toValue:string;
    }

    const TRSelLineRangeInputs:React.SFC<TRSelLineRangeInputsProps> = (props) => {

        const handleFromInput = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_SAVE_FORM_SET_FROM_LINE',
                props: {
                    value: evt.target.value
                }
            });
        };

        const handleToInput = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_SAVE_FORM_SET_TO_LINE',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th style={{verticalAlign: 'top'}}>
                    {utils.translate('coll__save_form_lines_to_model')}:
                </th>
                <td>
                    {utils.translate('coll__save_form_line_from')}:{'\u00a0'}
                    <input type="text" name="from_line" value={props.fromValue}
                            onChange={handleFromInput}  style={{width: '4em'}} />
                    {'\u00a0'}
                    {utils.translate('coll__save_form_line_to')}:{'\u00a0'}
                    <input type="text" name="to_line" value={props.toValue}
                            onChange={handleToInput} style={{width: '4em'}} />

                    <div className="hint">
                        ({utils.translate('coll__save_form_leave_to_load_to_end')}
                    </div>
                </td>
            </tr>
        );
    };

    // --------------------------------------------------------------------------------------
    // ---------------------------- <SaveFreqForm /> ----------------------------------------

    /**
     *
     */
    class SaveFreqForm extends React.Component<SaveFreqFormProps, SaveFreqFormState> {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _fetchModelState() {
            return {
                saveformat: freqSaveModel.getSaveformat(),
                includeColHeaders: freqSaveModel.getIncludeColHeaders(),
                includeHeading: freqSaveModel.getIncludeHeading(),
                fromLine: freqSaveModel.getFromLine(),
                toLine: freqSaveModel.getToLine()
            };
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                actionType: 'FREQ_SAVE_FORM_SUBMIT',
                props: {}
            });
        }

        _handleModelChange() {
            if (freqSaveModel.getFormIsActive()) {
                this.setState(this._fetchModelState());
            }
        }

        componentDidMount() {
            freqSaveModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            freqSaveModel.removeChangeListener(this._handleModelChange);
        }

        _renderFormatDependentOptions() {
            switch (this.state.saveformat) {
                case 'xml':
                    return <TRIncludeHeadingCheckbox value={this.state.includeHeading} />;
                case 'csv':
                case 'xlsx':
                    return <TRColHeadersCheckbox value={this.state.includeColHeaders} />
                default:
                return <tr><td colSpan={2} /></tr>;
            }
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.onClose}>
                    <layoutViews.CloseableFrame onCloseClick={this.props.onClose} label={utils.translate('freq__save_form_label')}>
                        <form className="SaveFreqForm">
                            <table className="form">
                                <tbody>
                                    <TRSaveFormatSelect value={this.state.saveformat} />
                                    {this._renderFormatDependentOptions()}
                                    <TRSelLineRangeInputs fromValue={this.state.fromLine} toValue={this.state.toLine} />
                                </tbody>
                            </table>
                            <button type="button" className="default-button"
                                    onClick={this._handleSubmitClick}>
                                {utils.translate('coll__save_form_submit_btn')}
                            </button>
                        </form>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    }

    return {
        SaveFreqForm: SaveFreqForm
    };

}