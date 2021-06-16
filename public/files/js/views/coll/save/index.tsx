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
import { BoundWithProps, IActionDispatcher } from 'kombo';

import { Kontext } from '../../../types/common';
import { SaveData } from '../../../app/navigation';
import { CollResultsSaveModel, CollResultsSaveModelState } from '../../../models/coll/save';
import { Actions, ActionName } from '../../../models/coll/actions';
import * as S from './style';


export interface SaveModuleArgs {
    dispatcher:IActionDispatcher;
    utils:Kontext.ComponentHelpers;
    collSaveModel:CollResultsSaveModel;
}


export interface SaveCollFormProps {
    saveLinesLimit:number;
    onClose:()=>void;
}

export interface SaveCollFormViews {
    SaveCollForm:React.ComponentClass<SaveCollFormProps>;
}


export function init({dispatcher, utils, collSaveModel}:SaveModuleArgs):SaveCollFormViews {

    const layoutViews = utils.getLayoutViews();

    // --------------- <TRSaveFormatSelect /> ------------------------

    const TRSaveFormatSelect:React.FC<{
        value:string;

    }> = (props) => {

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
                        <option value="csv">CSV</option>
                        <option value="xlsx">XLSX (Excel)</option>
                        <option value="xml">XML</option>
                        <option value="text">Text</option>
                    </select>
                </td>
            </tr>
        );
    };

    // --------------- <TRIncludeHeadingCheckbox /> ------------------------

    const TRIncludeHeadingCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

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
                <th>{utils.translate('coll__save_form_incl_heading')}:</th>
                <td>
                    <input type="checkbox" checked={props.value} onChange={handleChange} />
                </td>
            </tr>
        );
    }

    // --------------- <TRColHeadersCheckbox /> ------------------------

    const TRColHeadersCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch<Actions.SaveFormSetIncludeColHeaders>({
                name: ActionName.SaveFormSetIncludeColHeaders,
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <tr className="separator">
                <th>{utils.translate('coll__save_form_incl_col_hd')}:</th>
                <td>
                    <input type="checkbox" checked={props.value} onChange={handleChange} />
                </td>
            </tr>
        );
    }

    // --------------- <TRSelLineRangeInputs /> ------------------------

    const TRSelLineRangeInputs:React.FC<{
        fromValue:Kontext.FormValue<string>;
        toValue:Kontext.FormValue<string>;
        saveLinesLimit:number;

    }> = (props) => {

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
            <S.TRSelLineRangeInputs>
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
                                onChange={handleToInput} style={{width: '4em'}} placeholder="MAX" />
                    </layoutViews.ValidatedItem>
                    <p className="hint">
                        {utils.translate('coll__save_form_leave_to_load_to_end')}
                    </p>
                </td>
            </S.TRSelLineRangeInputs>
        )
    };

    // --------------- <SaveCollForm /> ------------------------

    const SaveCollForm:React.FC<SaveCollFormProps & CollResultsSaveModelState> = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch<Actions.SaveFormSubmit>({
                name: ActionName.SaveFormSubmit
            });
        };

        const renderFormatDependentOptions = () => {
            switch (props.saveformat) {
                case SaveData.Format.XML:
                    return <TRIncludeHeadingCheckbox value={props.includeHeading} />;
                case SaveData.Format.CSV:
                case SaveData.Format.XLSX:
                    return <TRColHeadersCheckbox value={props.includeColHeaders} />
                default:
                return <span />;
            }
        }

        const switchLineLimitHint = (v) => {
            /* TODO implement within model

            const state = this._fetchModelState();
            state.lineLimitHintVisible = v;
            this.setState(state);
            */
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.onClose}>
                <layoutViews.CloseableFrame onCloseClick={props.onClose} label={utils.translate('coll__save_form_label')}>
                    <S.SaveCollForm>
                        <table className="form">
                            <tbody>
                                <TRSaveFormatSelect value={props.saveformat} />
                                {renderFormatDependentOptions()}
                                <TRSelLineRangeInputs
                                        fromValue={props.fromLine}
                                        toValue={props.toLine}
                                        saveLinesLimit={props.saveLinesLimit} />
                            </tbody>
                        </table>
                        <button type="button" className="default-button"
                                onClick={handleSubmitClick}>
                            {utils.translate('coll__save_form_submit_btn')}
                        </button>
                    </S.SaveCollForm>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }

    return {
        SaveCollForm: BoundWithProps<SaveCollFormProps, CollResultsSaveModelState>(SaveCollForm, collSaveModel)
    };

}