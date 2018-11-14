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
import {Kontext} from '../../types/common';
import {SaveData} from '../../app/navigation';
import {ActionDispatcher} from '../../app/dispatcher';
import { WordlistSaveModel } from '../../models/wordlist/save';
import {CommonViews} from '../common';


export interface WordlistSaveViews {
    WordlistSaveForm:React.ComponentClass<{}>;
}


export interface WordlistSaveFormViewsArgs {
    dispatcher:ActionDispatcher;
    utils:Kontext.ComponentHelpers;
    commonViews:CommonViews;
    saveModel:WordlistSaveModel;
}

export interface WordlistSaveFormProps {

}

export interface WordlistSaveFormState {
    saveFormat:string;
    toLine:Kontext.FormValue<string>;
    includeHeading:boolean;
    includeColHeaders:boolean;
}


export function init({dispatcher, utils, commonViews, saveModel}:WordlistSaveFormViewsArgs):WordlistSaveViews {

    const layoutViews = utils.getLayoutViews();

    // --------------------------- <TRColHeadingSelector /> -------------------------------

    const TRColHeadingSelector:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_SAVE_SET_INCLUDE_COL_HEADERS',
                props: {
                    value: !props.value
                }
            });
        }

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

    const TRHeadingSelector:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleCheckboxChange = () => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_SAVE_SET_INCLUDE_HEADING',
                props: {
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

    const TRGeneralHeadingSelector:React.SFC<{
        saveFormat:string;
        includeColHeaders:boolean;
        includeHeading:boolean;

    }> = (props) => {
        if (props.saveFormat === SaveData.Format.CSV || props.saveFormat === SaveData.Format.XLSX) {
            return <TRColHeadingSelector value={props.includeColHeaders} />;

        } else {
            return <TRHeadingSelector value={props.includeHeading} />;
        }
    };

    // ---------------------------<MaxLinesInput /> -----------------------------

    const TRToLineInput:React.SFC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_SAVE_FORM_SET_TO_LINE',
                props: {
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

    const TRSaveFormatSelector:React.SFC<{
        value:string;

    }> = (props) => {

        const handleSaveFormatSelect = (evt:React.ChangeEvent<{}>) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_SAVE_FORM_SET_FORMAT',
                props: {
                    value: evt.target['value'] // TODO
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

    class WordlistSaveForm extends React.Component<WordlistSaveFormProps, WordlistSaveFormState> {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this.__handleModelChange = this.__handleModelChange.bind(this);
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _fetchModelState() {
            return {
                saveFormat: saveModel.getSaveFormat(),
                toLine: saveModel.getToLine(),
                includeHeading: saveModel.getIncludeHeading(),
                includeColHeaders: saveModel.getIncludeColHeaders()
            };
        }

        __handleModelChange() {
            this.setState(this._fetchModelState());
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                actionType: 'WORDLIST_SAVE_FORM_HIDE',
                props: {}
            });
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                actionType: 'WORDLIST_SAVE_FORM_SUBMIT',
                props: {}
            });
        }

        componentDidMount() {
            saveModel.addChangeListener(this.__handleModelChange);
        }

        componentWillUnmount() {
            saveModel.removeChangeListener(this.__handleModelChange);
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                    <layoutViews.CloseableFrame onCloseClick={this._handleCloseClick}
                            label={utils.translate('wordlist__save_form_heading')}>
                        <form>
                            <table className="form">
                                <tbody>
                                    <TRSaveFormatSelector value={this.state.saveFormat} />
                                    <TRGeneralHeadingSelector includeHeading={this.state.includeHeading}
                                            includeColHeaders={this.state.includeColHeaders}
                                            saveFormat={this.state.saveFormat} />
                                    <TRToLineInput value={this.state.toLine} />
                                </tbody>
                            </table>
                            <div className="buttons">
                                <button type="button" className="default-button" onClick={this._handleSubmitClick}>
                                    {utils.translate('wordlist__save_wl_header')}
                                </button>
                            </div>
                        </form>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    }

    return {
        WordlistSaveForm: WordlistSaveForm
    };
}