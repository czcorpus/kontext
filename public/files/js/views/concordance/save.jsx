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

import * as React from 'vendor/react';

export function init(dispatcher, mixins, layoutViews, concSaveStore) {

    /**
     *
     * @param {*} props
     */
    const TRFormatSelect = (props) => {

        const handleSelect = (evt) => {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SAVE_FORM_SET_FORMAT',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {mixins.translate('concview__save_conc_as_label')}:
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

    /**
     *
     * @param {*} props
     */
    const TRIncludeHeadingCheckbox = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SAVE_FORM_SET_HEADING',
                props: {value: !props.value}
            });
        }

        return (
            <tr>
                <th>
                    <label htmlFor="document-heading-checkbox">
                        {mixins.translate('concview__save_form_incl_heading')}
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

    /**
     *
     * @param {*} props
     */
    const TRIncludeLineNumbersCheckbox = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SAVE_FORM_SET_INCL_LINE_NUMBERS',
                props: {value: !props.value}
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="line-numbering-checkbox">
                    {mixins.translate('concview__save_form_incl_line_nums')}
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

    /**
     *
     * @param {*} props
     */
    const TRAlignKwicCheckbox = (props) => {

        const handleChange = () => {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SAVE_FORM_SET_ALIGN_KWIC',
                props: {value: !props.value}
            });
        };

        return (
            <tr>
                <th>
                    <label htmlFor="align-kwic-checkbox">
                        {mixins.translate('concview__save_form_align_kwic')}
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

    /**
     *
     * @param {*} props
     */
    const TRLineRangeInput = (props) => {

        const handleFromInput = (evt) => {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SAVE_FORM_SET_FROM_LINE',
                props: {
                    value: evt.target.value
                }
            });
        };

        const handleToInput = (evt) => {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SAVE_FORM_SET_TO_LINE',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>
                    {mixins.translate('concview__save_form_lines_to_store')}
                    {'\u00a0'}:
                </th>
                <td>
                    {mixins.translate('concview__save_form_line_from')}:{'\u00a0'}
                    <input type="text" value={props.fromLine}
                        onChange={handleFromInput} style={{width: '4em'}} />
                    {'\u00a0'}
                    {mixins.translate('concview__save_form_line_to')}:{'\u00a0'}
                    <input type="text" value={props.toLine}
                        onChange={handleToInput} style={{width: '4em'}} />
                </td>
            </tr>
        );
    };

    /**
     *
     */
    class ConcSaveForm extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _fetchStoreState() {
            return {
                fromLine: concSaveStore.getFromLine(),
                toLine: concSaveStore.getToLine(),
                saveFormat: concSaveStore.getSaveFormat(),
                alignKwic: concSaveStore.getAlignKwic(),
                includeLineNumbers: concSaveStore.getIncludeLineNumbers(),
                includeHeading: concSaveStore.getIncludeHeading()
            };
        }

        _handleStoreChange() {
            if (concSaveStore.getFormIsActive()) {
                this.setState(this._fetchStoreState());
            }
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_RESULT_CLOSE_SAVE_FORM',
                props: {}
            });
        }

        componentDidMount() {
            concSaveStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            concSaveStore.removeChangeListener(this._handleStoreChange);
        }

        _renderFormatDependentOptions() {
            switch (this.state.saveFormat) {
            case 'text':
                return [
                        <TRAlignKwicCheckbox key="opt-ak" value={this.state.alignKwic} />,
                        <TRIncludeHeadingCheckbox key="opt-ih" value={this.state.includeHeading} />
                ];
            case 'xml':
                return [<TRIncludeHeadingCheckbox key="opt-ih" value={this.state.includeHeading} />];
            default:
                return [];
            }
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                actionType: 'COLL_SAVE_FORM_SUBMIT',
                props: {}
            });
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                    <layoutViews.CloseableFrame onCloseClick={this._handleCloseClick}
                                label={mixins.translate('concview__save_conc_head')} scrollable={true}>
                        <form action="saveconc">
                            <table className="form">
                                <tbody>
                                    <TRFormatSelect value={this.state.saveFormat} />
                                    <TRIncludeLineNumbersCheckbox value={this.state.includeLineNumbers} />
                                    {this._renderFormatDependentOptions().map(item => item)}
                                    <TRLineRangeInput fromLine={this.state.fromLine} toLine={this.state.toLine} />
                                </tbody>
                            </table>
                            <div className="buttons">
                                <button type="button" className="default-button"
                                        onClick={this._handleSubmitClick}>
                                    {mixins.translate('concview__save_btn')}
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