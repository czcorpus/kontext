/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext} from '../../types/common';
import {init as defaultViewInit} from '../defaultCorparch/corplistView';
import { CorplistItemUcnk } from './common';
import { CorplistTableModel, CorplistTableModelState } from './corplist';

export interface ViewModuleArgs {
    dispatcher:ActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorpusInfoBox;
    listModel:CorplistTableModel;
}

export interface CorplistTableProps {
    anonymousUser:boolean;
}

export interface FilterFormProps {

}

export interface Views {
    CorplistTable:React.ComponentClass<CorplistTableProps>;
    FilterForm:React.ComponentClass<FilterFormProps>;
}

export function init({dispatcher, he, CorpusInfoBox, listModel}:ViewModuleArgs):Views {

    const defaultComponents = defaultViewInit({
        dispatcher: dispatcher,
        he: he,
        CorpusInfoBox: CorpusInfoBox,
        listModel: listModel
    });
    const layoutViews = he.getLayoutViews();

    // --------------- <RequestForm /> ---------------------------------

    class RequestForm extends React.Component<{
        corpusId:string;
        corpusName:string;
        submitHandler:()=>void;

    },
    {
        customMessage:string;
    }> {

        constructor(props) {
            super(props);
            this._submitHandler = this._submitHandler.bind(this);
            this._textareaChangeHandler = this._textareaChangeHandler.bind(this);
            this.state = {customMessage: ''};
        }

        _submitHandler() {
            dispatcher.dispatch({
                actionType: 'CORPUS_ACCESS_REQ_SUBMITTED',
                props: {
                    corpusId: this.props.corpusId,
                    corpusName: this.props.corpusName,
                    customMessage: this.state.customMessage
                }
            });
            this.props.submitHandler();
        }

        _textareaChangeHandler(e) {
            this.setState({customMessage: e.target.value});
        }

        render() {
            return (
                <form>
                    <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/envelope.svg')}
                            src2={he.createStaticUrl('img/envelope.svg')}
                            htmlClass="message-icon" alt={he.translate('ucnkCorparch__message_icon')} />
                    <p>{he.translate('ucnkCorparch__please_give_me_access_{corpname}',
                        {corpname: this.props.corpusName})}</p>
                    <label className="hint">
                        {he.translate('ucnkCorparch__custom_message')}:
                    </label>
                    <div>
                        <textarea rows={3} cols={50}
                                onChange={this._textareaChangeHandler}
                                value={this.state.customMessage} />
                    </div>
                    <p>
                        <button className="default-button" type="button"
                                onClick={this._submitHandler}>{he.translate('ucnkCorparch__send')}</button>
                    </p>
                </form>
            );
        }
    }

    // --------------- <LockIcon /> ---------------------------------

    class LockIcon extends React.Component<{
        corpusId:string;
        corpusName:string;
        isUnlockable:boolean;
    },
    {
        isUnlockable:boolean;
        hasFocus:boolean;
        hasDialog:boolean;
    }> {

        constructor(props) {
            super(props);
            this._mouseOverHandler = this._mouseOverHandler.bind(this);
            this._mouseOutHandler = this._mouseOutHandler.bind(this);
            this._clickHandler = this._clickHandler.bind(this);
            this._closeDialog = this._closeDialog.bind(this);
            this.state = {
                isUnlockable: this.props.isUnlockable,
                hasFocus: false,
                hasDialog: false
            };
        }

        _mouseOverHandler() {
            this.setState({
                isUnlockable: this.state.isUnlockable,
                hasFocus: true,
                hasDialog: this.state.hasDialog
            });
        }

        _mouseOutHandler() {
            this.setState({
                isUnlockable: this.state.isUnlockable,
                hasFocus: false,
                hasDialog: this.state.hasDialog
            });
        }

        _clickHandler() {
            this.setState({
                isUnlockable: this.state.isUnlockable,
                hasFocus: this.state.hasFocus,
                hasDialog: true
            });
        }

        _closeDialog() {
            const newState = he.cloneState(this.state);
            newState.hasDialog = false;
            this.setState(newState);
        }

        _renderDialog() {
            if (this.state.hasDialog) {
                const onBoxReady = function (elm) {
                    let rect = elm.getBoundingClientRect();
                    let newX, newY;

                    newX = (document.documentElement.clientWidth - rect.width) / 2;
                    newY = document.documentElement.clientHeight / 2;
                    elm.style.left = newX;
                    elm.style.top = newY;
                };
                return (
                    <layoutViews.ModalOverlay onCloseKey={this._closeDialog}>
                        <layoutViews.CloseableFrame
                                label={he.translate('ucnkCorparch__access_req_form_heading')}
                                onCloseClick={this._closeDialog}
                                customClass="corpus-access-req" onReady={onBoxReady}>
                            <div>
                                <RequestForm submitHandler={this._closeDialog}
                                    corpusId={this.props.corpusId}
                                    corpusName={this.props.corpusName} />
                            </div>
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay>
                );

            } else {
                return null;
            }
        }

        render() {
            if (this.state.isUnlockable) {
                const img = this.state.hasFocus ? <img src={he.createStaticUrl('img/unlocked.svg')} /> :
                        <img src={he.createStaticUrl('img/locked.svg')} />;

                return (
                    <div>
                        <div className="lock-status"
                                title={he.translate('ucnkCorparch__click_to_ask_access')}
                                onMouseOver={this._mouseOverHandler}
                                onMouseOut={this._mouseOutHandler}
                                onClick={this._clickHandler}>
                            {img}
                        </div>
                        {this._renderDialog()}
                    </div>
                );

            } else {
                return false;
            }
        }
    }

    // --------------- <CorplistRow /> ---------------------------------

    /**
     * A single dataset row
     */
    const CorplistRow:React.SFC<{
        row:CorplistItemUcnk;
        enableUserActions:boolean;
        detailClickHandler:(corpusId:string)=>void;

    }> = (props) => {

        const handleDetailClick = (corpusId, evt) => {
            props.detailClickHandler(corpusId);
        };
        const keywords = props.row.keywords.map((k, i) => {
            return <defaultComponents.CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
        });
        const link = he.createActionLink('first_form', [['corpname', props.row.id]]);
        const size = props.row.size_info ? props.row.size_info : '-';

        let userAction = null;
        let corpLink;
        if (props.enableUserActions) {
            if (props.row.requestable) {
                corpLink = <span className="inaccessible">{props.row.name}</span>;
                userAction = <LockIcon isUnlockable={props.row.requestable}
                                    corpusId={props.row.id}
                                    corpusName={props.row.name} />;

            } else {
                corpLink = <a href={link}>{props.row.name}</a>;
                userAction = <defaultComponents.FavStar corpusId={props.row.id}
                                    corpusName={props.row.name}
                                    favId={props.row.fav_id} />;
            }

        } else {
            corpLink = <a href={link}>{props.row.name}</a>;
        }
        return (
            <tr>
                <td className="corpname">{corpLink}</td>
                <td className="num">{size}</td>
                <td>
                    {keywords}
                </td>
                <td>
                    {userAction}
                </td>
                <td>
                    <p className="desc" style={{display: 'none'}}></p>
                    <a className="detail"
                            onClick={handleDetailClick.bind(null, props.row.id)}>
                        {he.translate('defaultCorparch__corpus_details')}
                    </a>
                </td>
            </tr>
        );
    };

    // --------------- <CorplistTable /> ---------------------------------

    /**
     * dataset table
     */
    class CorplistTable extends React.Component<CorplistTableProps, CorplistTableModelState> {

        constructor(props) {
            super(props);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._detailClickHandler = this._detailClickHandler.bind(this);
            this._detailCloseHandler = this._detailCloseHandler.bind(this);
            this.state = listModel.getState();
        }

        _modelChangeHandler(state) {
            this.setState(state);
        }

        _detailClickHandler(corpusId) {
            dispatcher.dispatch({
                actionType: 'CORPARCH_CORPUS_INFO_REQUIRED',
                props: {
                    corpusId: corpusId
                }
            });
        }

        _detailCloseHandler() {
            const newState = he.cloneState(this.state);
            this.setState(newState);
            dispatcher.dispatch({
                actionType: 'CORPARCH_CORPUS_INFO_CLOSED',
                props: {}
            });
        }

        componentDidMount() {
            listModel.addChangeListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            listModel.removeChangeListener(this._modelChangeHandler);
        }

        _renderDetailBox() {
            if (this.state.detailData) {
                const bcr = document.body.getBoundingClientRect();
                return (
                    <layoutViews.PopupBox
                            onCloseClick={this._detailCloseHandler}
                            customStyle={{
                                position: 'absolute',
                                left: '50pt',
                                top: `${-1 * bcr.top + 150}px`
                            }}
                            takeFocus={true}>
                        <CorpusInfoBox data={this.state.detailData} isWaiting={this.state.isBusy} />
                    </layoutViews.PopupBox>
                );

            } else {
                return null;
            }
        }

        render() {
            const rows = this.state.rows.map((row, i) => {
                return <CorplistRow key={row.id} row={row}
                                    enableUserActions={!this.props.anonymousUser}
                                    detailClickHandler={this._detailClickHandler} />;
            });

            return (
                <div>
                    {this._renderDetailBox()}
                    <table className="data corplist">
                        <tbody>
                            <defaultComponents.CorplistHeader />
                            {rows}
                            {this.state.nextOffset ?
                                <ListExpansion offset={this.state.nextOffset} limit={this.state.limit} /> :
                                null
                            }
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    // --------------------- <ListExpansion /> ----------------------------

    /**
     * Provides a link allowing to load more items with current
     * query and filter settings.
     */
    const ListExpansion:React.SFC<{
        offset:number;
        limit:number;

    }> = (props) => {

        const linkClickHandler = () => {
            dispatcher.dispatch({
                actionType: 'EXPANSION_CLICKED',
                props: {
                    offset: props.offset
                }
            });
        };

        return (
            <tr className="load-more">
                <td colSpan={5}>
                    <a onClick={linkClickHandler}>{he.translate('ucnkCorparch__next_{num}', {num: props.limit})}</a>
                </td>
            </tr>
        );
    };

    return {
        CorplistTable: CorplistTable,
        FilterForm: defaultComponents.FilterForm
    };
}
