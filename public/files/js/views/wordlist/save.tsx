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

import * as React from 'react';
import * as Kontext from '../../types/kontext';
import { IActionDispatcher, Bound } from 'kombo';
import { WordlistSaveModel, WordlistSaveModelState } from '../../models/wordlist/save';
import { CommonViews } from '../common';
import { Actions } from '../../models/wordlist/actions';
import { DataSaveFormat } from '../../app/navigation/save';


export interface WordlistSaveViews {
    WordlistSaveForm:React.ComponentClass<{}, WordlistSaveModelState>;
}


export interface WordlistSaveFormViewsArgs {
    dispatcher:IActionDispatcher;
    utils:Kontext.ComponentHelpers;
    commonViews:CommonViews;
    saveModel:WordlistSaveModel;
}


export function init({dispatcher, utils, commonViews, saveModel}:WordlistSaveFormViewsArgs):WordlistSaveViews {

    const layoutViews = utils.getLayoutViews();

    // --------------------------- <TRColHeadingSelector /> -------------------------------

    const TRColHeadingSelector:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch<typeof Actions.WordlistSaveSetIncludeColHeaders>({
                name: Actions.WordlistSaveSetIncludeColHeaders.name,
                payload: {
                    value: !props.value
                }
            });
        };

        return (
            <tr className="separator">
                <th>
                    <label htmlFor="wordlist-save-colhd-check">
                        {utils.translate('wordlist__include_col_headers')}
                    </label>:
                </th>
                <td>
                    <input id="wordlist-save-colhd-check" type="checkbox"
                        onChange={handleCheckboxChange} checked={props.value} />
                </td>
            </tr>
        )
    }


    // --------------------------- <TRHeadingSelector /> -------------------------------

    const TRHeadingSelector:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch<typeof Actions.WordlistSaveSetIncludeHeading>({
                name: Actions.WordlistSaveSetIncludeHeading.name,
                payload: {
                    value: !props.value
                }
            });
        }

        return (
            <tr className="separator">
                <th>
                    <label htmlFor="wordlist-save-heading-check">
                        {utils.translate('wordlist__include_heading')}
                    </label>:
                </th>
                <td>
                    <input id="wordlist-save-heading-check" onChange={handleCheckboxChange}
                            type="checkbox" checked={props.value} />
                </td>
            </tr>
        );
    };

    // ---------------------------<MaxLinesInput /> -----------------------------

    const TRGeneralHeadingSelector:React.FC<{
        saveFormat:string;
        includeColHeaders:boolean;
        includeHeading:boolean;

    }> = (props) => {
        if (props.saveFormat === 'csv' || props.saveFormat === 'xlsx') {
            return <TRColHeadingSelector value={props.includeColHeaders} />;

        } else {
            return <TRHeadingSelector value={props.includeHeading} />;
        }
    };

    // ---------------------------<TRToLineInput /> -----------------------------

    const TRToLineInput:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistSaveFormSetMaxLine>({
                name: Actions.WordlistSaveFormSetMaxLine.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>{utils.translate('wordlist__max_num_lines')}:</th>
                <td>
                    <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                        <input onChange={handleInputChange} type="text"
                                value={props.value.value} style={{width: '3em'}} />
                    </layoutViews.ValidatedItem>
                </td>
            </tr>
        );
    }

    // --------------------------- <TRSaveFormatSelector /> -------------------------------

    const TRSaveFormatSelector:React.FC<{
        value:string;

    }> = (props) => {

        const handleSaveFormatSelect = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch<typeof Actions.WordlistSaveFormSetFormat>({
                name: Actions.WordlistSaveFormSetFormat.name,
                payload: {
                    value: evt.target.value as DataSaveFormat
                }
            });
        };

        return (
            <tr>
                <th>
                    {utils.translate('wordlist__save_wl_as_header')}:
                </th>
                <td>
                    <commonViews.SaveFormatSelect value={props.value}
                            onChange={handleSaveFormatSelect} />
                </td>
            </tr>
        );
    }

    // --------------------------- <SaveWlForm /> -------------------------------

    const WordlistSaveForm:React.FC<WordlistSaveModelState> = (props) => {

        const handleCloseClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistSaveFormHide>({
                name: Actions.WordlistSaveFormHide.name
            });
        };

        const handleSubmitClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistSaveFormSubmit>({
                name: Actions.WordlistSaveFormSubmit.name
            });
        }

        return props.formIsActive ? (
            <layoutViews.ModalOverlay onCloseKey={handleCloseClick}>
                <layoutViews.CloseableFrame onCloseClick={handleCloseClick}
                        label={utils.translate('wordlist__save_form_heading')}>
                    <form>
                        <table className="form">
                            <tbody>
                                <TRSaveFormatSelector value={props.saveFormat} />
                                {props.saveFormat !== 'jsonl' ?
                                    <TRGeneralHeadingSelector includeHeading={props.includeHeading}
                                            includeColHeaders={props.includeColHeaders}
                                            saveFormat={props.saveFormat} /> :
                                    null
                                }
                                <TRToLineInput value={props.toLine} />
                                <tr><td></td><td style={{minWidth: '25em'}}></td></tr>
                            </tbody>
                        </table>
                        <div className="buttons">
                            <button type="button" className="default-button" onClick={handleSubmitClick}>
                                {utils.translate('wordlist__save_wl_header')}
                            </button>
                        </div>
                    </form>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        ) : null;
    };

    const BoundWordlistSaveForm = Bound(WordlistSaveForm, saveModel);

    return {
        WordlistSaveForm: BoundWordlistSaveForm
    };
}