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


export function init(dispatcher, he, layoutViews, saveAsFormModel) {


    // ------------------ <QueryNameInput /> -------------------------------

    const QueryNameInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_SAVE_AS_FORM_SET_NAME',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('query__save_as_query_name_label')}:{'\u00a0'}
                <input type="text" style={{width: '15em'}}
                        value={props.value} onChange={handleInputChange} />
            </label>
        );
    };

    // ------------------ <SubmitButton /> -------------------------------

    const SubmitButton = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_SAVE_AS_FORM_SUBMIT',
                props: {}
            });
        };

        if (props.isWaiting) {
            return (
                <span className="ajax-loader">
                    <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={he.translate('global__loading')} />
                </span>
            );

        } else {
            return (
                <button type="button" className="default-button"
                        onClick={handleSubmit}>
                    {he.translate('query__save_as_save')}
                </button>
            );
        }
    };


    // ------------------ <QuerySaveAsForm /> -------------------------------

    class QuerySaveAsForm extends React.Component {

        constructor(props) {
            super(props);
            this._handleCloseEvent = this._handleCloseEvent.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                name: saveAsFormModel.getName(),
                isWaiting: saveAsFormModel.getIsBusy()
            };
        }

        _handleCloseEvent() {
            dispatcher.dispatch({
                actionType: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                props: {}
            });
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            saveAsFormModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            saveAsFormModel.removeChangeListener(this._handleModelChange);
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseEvent}>
                    <layoutViews.CloseableFrame onCloseClick={this._handleCloseEvent}
                                label={he.translate('query__save_as_box_hd')}>
                        <form>
                            <p>
                                <QueryNameInput value={this.state.name} />
                            </p>
                            <p>
                                <SubmitButton isWaiting={this.state.isWaiting} />
                            </p>
                        </form>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    }

    return {
        QuerySaveAsForm: QuerySaveAsForm
    };

}