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
import {Kontext, KeyCodes} from '../../types/common';
import{QuerySaveAsFormModel, QuerySaveAsFormModelState} from '../../models/query/save';
import { Subscription } from 'rxjs';


export interface QuerySaveAsFormProps {
}


export interface SaveViews {
    QuerySaveAsForm:React.ComponentClass<QuerySaveAsFormProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            saveAsFormModel:QuerySaveAsFormModel):SaveViews {

    const layoutViews = he.getLayoutViews();


    // ------------------ <QueryNameInput /> -------------------------------

    const QueryNameInput:React.SFC<{
        value:string;
        onKeyDown:(evt:React.KeyboardEvent<{}>)=>void;

    }> = (props) => {

        const handleInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch({
                name: 'QUERY_SAVE_AS_FORM_SET_NAME',
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('query__save_as_query_name_label')}:{'\u00a0'}
                <input type="text" style={{width: '15em'}}
                        value={props.value} onChange={handleInputChange}
                        onKeyDown={props.onKeyDown}
                        ref={item => item ? item.focus() : null} />
            </label>
        );
    };

    // ------------------ <SubmitButton /> -------------------------------

    const SubmitButton:React.SFC<{
        isWaiting:boolean;
        onClick:(evt:React.MouseEvent<{}>)=>void;
        onKeyDown:(evt:React.KeyboardEvent<{}>)=>void;

    }> = (props) => {



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
                        onClick={props.onClick}
                        onKeyDown={props.onKeyDown}>
                    {he.translate('query__save_as_save')}
                </button>
            );
        }
    };


    // ------------------ <QuerySaveAsForm /> -------------------------------

    class QuerySaveAsForm extends React.Component<QuerySaveAsFormProps, QuerySaveAsFormModelState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._handleCloseEvent = this._handleCloseEvent.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleKeyDown = this._handleKeyDown.bind(this);
            this.state = saveAsFormModel.getState();
        }

        private _handleCloseEvent() {
            dispatcher.dispatch({
                name: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                payload: {}
            });
        }

        private _handleKeyDown(evt:React.KeyboardEvent<{}>):void {
            if (evt.keyCode === KeyCodes.ENTER) {
                this.submit();
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        private submit() {
            dispatcher.dispatch({
                name: 'QUERY_SAVE_AS_FORM_SUBMIT',
                payload: {}
            });
        }

        private _handleModelChange(state) {
            this.setState(state);
        }

        componentDidMount() {
            this.modelSubscription = saveAsFormModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseEvent}>
                    <layoutViews.CloseableFrame onCloseClick={this._handleCloseEvent}
                                customClass="QuerySaveAsForm"
                                label={he.translate('query__save_as_box_hd')}>
                        <form>
                            <p className="hint">
                                <layoutViews.StatusIcon status="info" inline={true} htmlClass="icon" />
                                {this.state.concExplicitPersistenceUI ?
                                    he.translate('query__save_as_box_hint_explicit') :
                                    he.translate('query__save_as_box_hint')
                                }
                            </p>
                            <p>
                                <QueryNameInput value={this.state.name} onKeyDown={this._handleKeyDown} />
                            </p>
                            <p>
                                <SubmitButton isWaiting={this.state.isBusy} onKeyDown={this._handleKeyDown}
                                        onClick={(evt)=>this.submit()} />
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