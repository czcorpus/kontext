/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import {Kontext} from '../../../types/common';
import {SaveData} from '../../../app/navigation';
import {PqueryResultsSaveModel, PqueryResultsSaveModelState} from '../../../models/pquery/save';
import {IActionDispatcher, BoundWithProps} from 'kombo';
import {ActionName, Actions} from '../../../models/pquery/actions';


interface SavePqueryFormProps {
    onClose:()=>void;
}

interface ExportedViews {
    SavePqueryForm:React.ComponentClass<SavePqueryFormProps>;
}


// ------------------------------------ factory -------------------------------------------

export function init(
        dispatcher:IActionDispatcher,
        utils:Kontext.ComponentHelpers,
        pquerySaveModel:PqueryResultsSaveModel):ExportedViews {


    const layoutViews = utils.getLayoutViews();

    // ---------------------------- <TRSaveFormatSelect /> ----------------------------

    interface TRSaveFormatSelectProps {
        value:string;
    }

    /**
     *
     */
    const TRSaveFormatSelect:React.FC<TRSaveFormatSelectProps> = (props) => {

        const handleSelect = (evt) => {
            dispatcher.dispatch<Actions.SaveFormSetFormat>({
                name: ActionName.SaveFormSetFormat,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>{utils.translate('coll__save_form_select_label')}:</th>
                <td>
                    <select value={props.value} onChange={handleSelect}>
                        <option value={SaveData.Format.CSV}>CSV</option>
                        <option value={SaveData.Format.XLSX}>XLSX (Excel)</option>
                        <option value={SaveData.Format.XML}>XML</option>
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
    const TRIncludeHeadingCheckbox:React.FC<TRIncludeHeadingCheckboxProps> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch<Actions.SaveFormSetIncludeHeading>({
                name: ActionName.SaveFormSetIncludeHeading,
                payload: {
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
    const TRColHeadersCheckbox:React.FC<TRColHeadersCheckboxProps> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch<Actions.SaveFormSetIncludeColHeading>({
                name: ActionName.SaveFormSetIncludeColHeading,
                payload: {
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
        fromValue:Kontext.FormValue<string>;
        toValue:Kontext.FormValue<string>;
    }

    const TRSelLineRangeInputs:React.SFC<TRSelLineRangeInputsProps> = (props) => {

        const handleFromInput = (evt) => {
            dispatcher.dispatch<Actions.SaveFormSetFromLine>({
                name: ActionName.SaveFormSetFromLine,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleToInput = (evt) => {
            dispatcher.dispatch<Actions.SaveFormSetToLine>({
                name: ActionName.SaveFormSetToLine,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th style={{verticalAlign: 'top'}}>
                    {utils.translate('coll__save_form_lines_to_store')}:
                </th>
                <td>
                    {utils.translate('coll__save_form_line_from')}:{'\u00a0'}
                    <layoutViews.ValidatedItem invalid={props.fromValue.isInvalid}>
                        <input type="text" name="from_line" value={props.fromValue.value}
                                onChange={handleFromInput}  style={{width: '4em'}} />
                    </layoutViews.ValidatedItem>
                    {'\u00a0'}
                    {utils.translate('coll__save_form_line_to')}:{'\u00a0'}
                    <layoutViews.ValidatedItem invalid={props.toValue.isInvalid}>
                        <input type="text" name="to_line" value={props.toValue.value}
                                onChange={handleToInput} style={{width: '4em'}}
                                placeholder="MAX" />
                    </layoutViews.ValidatedItem>

                    <p className="hint">
                        ({utils.translate('coll__save_form_leave_to_load_to_end')})
                    </p>
                </td>
            </tr>
        );
    };

    // --------------------------------------------------------------------------------------
    // ---------------------------- <SavePqueryForm /> ----------------------------------------

    /**
     *
     */
    class SavePqueryForm extends React.Component<SavePqueryFormProps & PqueryResultsSaveModelState> {

        constructor(props) {
            super(props);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _handleSubmitClick() {
            dispatcher.dispatch<Actions.SaveFormSubmit>({
                name: ActionName.SaveFormSubmit,
                payload: {}
            });
        }

        _renderFormatDependentOptions() {
            switch (this.props.saveformat) {
                case SaveData.Format.XML:
                    return <TRIncludeHeadingCheckbox value={this.props.includeHeading} />;
                case SaveData.Format.CSV:
                case SaveData.Format.XLSX:
                    return <TRColHeadersCheckbox value={this.props.includeColHeaders} />
                default:
                return <tr><td colSpan={2} /></tr>;
            }
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.onClose}>
                    <layoutViews.CloseableFrame onCloseClick={this.props.onClose} label={utils.translate('pquery__save_form_label')}>
                        <form className="SavePqueryForm">
                            <table className="form">
                                <tbody>
                                    <TRSaveFormatSelect value={this.props.saveformat} />
                                    {this._renderFormatDependentOptions()}
                                    <TRSelLineRangeInputs
                                            fromValue={this.props.fromLine}
                                            toValue={this.props.toLine} />
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
        SavePqueryForm: BoundWithProps<SavePqueryFormProps, PqueryResultsSaveModelState>(SavePqueryForm, pquerySaveModel)
    };

}