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

define(['vendor/react', 'jquery', '../defaultCorparch/view'], function (React, $, defaultView) {
    'use strict';

    let lib = {};

    lib.init = function (dispatcher, mixins, layoutViews, formStore, listStore) {

        let defaultComponents = defaultView.init(dispatcher, mixins, layoutViews, formStore, listStore);

        /**
         *
         */
        let RequestForm = React.createClass({
            mixins: mixins,

            _submitHandler : function () {
                dispatcher.dispatch({
                    actionType: 'CORPUS_ACCESS_REQ_SUBMITTED',
                    props: {
                        corpusId: this.props.corpusId,
                        corpusName: this.props.corpusName,
                        customMessage: this.state.customMessage
                    }
                });
                this.props.submitHandler();
            },

            _textareaChangeHandler : function (e) {
                this.setState({customMessage: e.target.value});
            },

            getInitialState : function () {
                return {customMessage: ''};
            },

            render : function () {
                return (
                    <form>
                        <img className="message-icon" src={this.createStaticUrl('img/message-icon.png')}
                             alt={this.translate('ucnkCorparch__message_icon')} />
                        <p>{this.translate('ucnkCorparch__please_give_me_access_{corpname}',
                            {corpname: this.props.corpusName})}</p>
                        <label className="hint">
                            {this.translate('ucnkCorparch__custom_message')}:
                        </label>
                        <div>
                            <textarea rows="3" cols="50"
                                    onChange={this._textareaChangeHandler}
                                    value={this.state.customMessage} />
                        </div>
                        <div>
                            <button className="submit" type="button"
                                    onClick={this._submitHandler}>{this.translate('ucnkCorparch__send')}</button>
                        </div>
                    </form>
                );
            }

        });

        /**
         *
         */
        let LockIcon = React.createClass({
            mixins: mixins,

            getInitialState : function () {
                return {isUnlockable: this.props.isUnlockable, hasFocus: false, hasDialog: false};
            },

            _mouseOverHandler : function () {
                this.setState({isUnlockable: this.state.isUnlockable, hasFocus: true, hasDialog: this.state.hasDialog});
            },

            _mouseOutHandler : function () {
                this.setState({isUnlockable: this.state.isUnlockable, hasFocus: false, hasDialog: this.state.hasDialog});
            },

            _clickHandler : function () {
                this.setState({isUnlockable: this.state.isUnlockable, hasFocus: this.state.hasFocus, hasDialog: true});
            },

            _closeDialog : function () {
                this.setState(React.addons.update(this.state, {hasDialog: {$set: false}}));
            },

            render : function () {
                let img,
                    dialog,
                    onBoxReady;

                if (this.state.isUnlockable) {
                    if (this.state.hasFocus) {
                        img = <img src={this.createStaticUrl('img/24px-Unlocked.png')} />;

                    } else {
                        img = <img src={this.createStaticUrl('img/24px-Locked.png')} />;
                    }

                    if (this.state.hasDialog) {
                        onBoxReady = function (elm) {
                            let rect = elm.getBoundingClientRect();
                            let newX, newY;

                            newX = (document.documentElement.clientWidth - rect.width) / 2;
                            newY = document.documentElement.clientHeight / 2;
                            $(elm).css('left', newX).css('top', newY);
                        };
                        dialog = (
                            <layoutViews.PopupBox onCloseClick={this._closeDialog}
                                customClass="corpus-access-req" onReady={onBoxReady} >
                                <div>
                                    <RequestForm submitHandler={this._closeDialog}
                                        corpusId={this.props.corpusId}
                                        corpusName={this.props.corpusName} />
                                </div>
                            </layoutViews.PopupBox>
                        );

                    } else {
                        dialog = null;
                    }

                    return (
                        <div>
                            <div className="lock-status"
                                 title={this.translate('ucnkCorparch__click_to_ask_access')}
                                 onMouseOver={this._mouseOverHandler}
                                 onMouseOut={this._mouseOutHandler}
                                 onClick={this._clickHandler}>
                                {img}
                            </div>
                            {dialog}
                        </div>
                    );

                } else {
                    return false;
                }
            }
        });

        /**
         * A single dataset row
         */
        let CorplistRow = React.createClass({

            mixins: mixins,

            _corpDetailErrorHandler: function () {
                this.setState(React.addons.update(this.state, {detail: {$set: false}}));
            },

            _detailClickHandler: function (evt) {
                evt.preventDefault();
                this.setState(React.addons.update(this.state, {detail: {$set: true}}));
            },

            getInitialState: function () {
                return {detail: false};
            },

            _detailCloseHandler: function () {
                this.setState(React.addons.update(this.state, {detail: {$set: false}}));
            },

            render: function () {
                let keywords = this.props.row.keywords.map(function (k, i) {
                    return <defaultComponents.CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
                });

                let detailBox;

                if (this.state.detail) {
                    detailBox = <layoutViews.PopupBox
                        onCloseClick={this._detailCloseHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                        <layoutViews.CorpusInfoBox corpusId={this.props.row.id}
                            parentErrorHandler={this._corpDetailErrorHandler} />
                    </layoutViews.PopupBox>;

                } else {
                    detailBox = null;
                }

                let link = this.createActionLink('first_form?corpname=' + this.props.row.id);
                let size = this.props.row.raw_size ? this.props.row.raw_size : '-';
                let userAction = null;
                let corpLink;

                if (this.props.enableUserActions) {
                    if (this.props.row.requestable) {
                        corpLink = <span className="inaccessible">{this.props.row.name}</span>;
                        userAction = <LockIcon isUnlockable={this.props.row.requestable}
                                         corpusId={this.props.row.id}
                                         corpusName={this.props.row.name} />;

                    } else {
                        corpLink = <a href={link}>{this.props.row.name}</a>;
                        userAction = <defaultComponents.FavStar corpusId={this.props.row.id}
                                           corpusName={this.props.row.name}
                                           isFav={this.props.row.user_item} />;
                    }

                } else {
                    corpLink = <a href={link}>{this.props.row.name}</a>;
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
                            {detailBox}
                            <p className="desc" style={{display: 'none'}}>
                            </p>
                            <a className="detail"
                               onClick={this._detailClickHandler}>{this.translate('defaultCorparch__corpus_details')}</a>
                        </td>
                    </tr>
                );
            }
        });

        /**
         * dataset table
         */
        let CorplistTable = React.createClass({

            changeHandler: function () {
                this.setState(listStore.getData());
            },

            getInitialState: function () {
                return {
                    filters: this.props.filters,
                    keywords: this.props.keywords,
                    rows: this.props.rows,
                    query: this.props.query,
                    nextOffset: this.props.nextOffset
                };
            },

            componentDidMount: function () {
                listStore.addChangeListener(this.changeHandler);
            },

            componentWillUnmount: function () {
                listStore.removeChangeListener(this.changeHandler);
            },

            render: function () {
                let self = this;
                let rows = this.state.rows.map(function (row, i) {
                    return <CorplistRow key={row.id} row={row}
                                        enableUserActions={!self.props.anonymousUser} />;
                });
                let expansion = null;
                if (this.state.nextOffset) {
                    expansion = <ListExpansion offset={this.state.nextOffset} />;
                }

                return (
                    <div>
                        <table className="data corplist" border="0">
                            <tbody>
                                <defaultComponents.CorplistHeader />
                                {rows}
                                {expansion}
                            </tbody>
                        </table>
                    </div>
                );
            }
        });

        /**
         * Provides a link allowing to load more items with current
         * query and filter settings.
         */
        let ListExpansion = React.createClass({
            mixins : mixins,
            _linkClickHandler : function () {
                dispatcher.dispatch({
                    actionType: 'EXPANSION_CLICKED',
                    props: {
                        offset: this.props.offset
                    }
                });
            },
            render : function () {
                return (
                      <tr className="load-more">
                          <td colSpan="5">
                              <a onClick={this._linkClickHandler}>{this.translate('ucnkCorparch__load_all')}</a>
                          </td>
                      </tr>
                );
            }
        });

        return {
            CorplistTable: CorplistTable,
            FilterForm: defaultComponents.FilterForm
        };
    };

    return lib;
});
