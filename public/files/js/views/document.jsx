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

define(['vendor/react', 'jquery'], function (React, $) {
    'use strict';

    var lib = {},
        ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;

    lib.init = function (dispatcher, mixins, storeProvider) {

        /**
         * A single struct/attr row
         */
        var ItemAndNumRow = React.createClass({
           render: function () {
               if (this.props.brackets) {
                   return (
                       <tr className="dynamic">
                           <th>&lt;{this.props.label}&gt;</th>
                           <td className="numeric">{this.props.value}</td>
                       </tr>
                   );

               } else {
                   return (
                       <tr className="dynamic">
                           <th>{this.props.label}</th>
                           <td className="numeric">{this.props.value}</td>
                       </tr>
                   );
               }
           }
        });

        /**
         * Attribute list table
         */
        var AttributeList = React.createClass({
            mixins: mixins,

            render: function () {
                var values;

                if (!this.props.rows.error) {
                    values = this.props.rows.map(function (row, i) {
                        return <ItemAndNumRow key={i} label={row.name} value={row.size} />
                    });

                } else {
                    values = <tr><td colSpan="2">{this.translate('failed to load')}</td></tr>;
                }

                return (
                    <table className="attrib-list">
                        <tbody>
                        <tr>
                            <th colSpan="2" className="attrib-heading">{this.translate('global__attributes') }</th>
                        </tr>
                        {values}
                        </tbody>
                    </table>
                );
            }
        });

        /**
         * Structure list table
         */
        var StructureList = React.createClass({
            mixins: mixins,
            render: function () {
                return (
                    <table className="struct-list">
                        <tbody>
                        <tr>
                            <th colSpan="2" className="attrib-heading">{this.translate('global__structures')}</th>
                        </tr>
                        {this.props.rows.map(function (row, i) {
                            return <ItemAndNumRow key={i} brackets={true} label={row.name} value={row.size} />
                        })}
                        </tbody>
                    </table>
                );
            }
        });

        /**
         * Corpus information box
         */
        var CorpusInfoBox = React.createClass({

            mixins: mixins,

            changeHandler: function (store, status) {
                if (status !== 'error') {
                    this.setState(storeProvider.corpusInfoStore.getData(this.props.corpusId));

                } else if (typeof this.props.parentErrorHandler === 'function') {
                    this.props.parentErrorHandler(store, status);
                }
            },

            getInitialState : function () {
                return {
                    corpname: null,
                    attrlist: [],
                    structlist: [],
                    size: null,
                    description: null,
                    url: null
                };
            },

            componentDidMount : function () {
                storeProvider.corpusInfoStore.addChangeListener(this.changeHandler);
                dispatcher.dispatch({
                    actionType: 'CORPUS_INFO_REQUIRED',
                    props: {
                        corpusId: this.props.corpusId
                    }
                });
            },

            componentDidUpdate : function () {
                // we must inform non-react environment (here popupbox.js) we are ready here
                if (typeof this.props.doneCallback === 'function') {
                    this.props.doneCallback();
                }
            },

            componentWillUnmount : function () {
                storeProvider.corpusInfoStore.removeChangeListener(this.changeHandler);
            },

            render: function () {
                var webLink;

                if (this.state.web_url) {
                    webLink = <a href={this.state.web_url}>{this.state.web_url}</a>;

                } else {
                    webLink = '-';
                }

                if (!this.state.corpname) {
                    return (
                        <div id="corpus-details-box">
                            <img src={this.createStaticUrl('img/ajax-loader.gif')}
                                alt={this.translate('global__loading')} title={this.translate('global__loading')} />
                        </div>
                    );

                } else {
                    return (
                        <div id="corpus-details-box">
                            <div className="top">
                                <h4 className="corpus-name">{this.state.corpname}</h4>

                                <p className="metadata">
                                    <strong>{this.translate('global__size')}: </strong>
                                    <span className="size">{this.state.size}</span> {this.translate('global__positions')}<br />

                                    <strong className="web_url">{this.translate('global__website')}: </strong>
                                    {webLink}
                                </p>
                            </div>
                            <p className="corpus-description">{this.state.description}</p>
                            <table className="structs-and-attrs" border="0">
                                <tr>
                                    <td>
                                        <AttributeList rows={this.state.attrlist} />
                                    </td>
                                    <td style={{paddingLeft: '4em'}}>
                                        <StructureList rows={this.state.structlist} />
                                    </td>
                                </tr>
                            </table>
                            <p className="note">{this.translate('global__remark_figures_denote_different_attributes')}</p>
                        </div>
                    );
                }
            }
        });

        // ------------------------------ general pop-up box -----------------------------

        /**
         * React version of KonText popupbox
         *
         * supported properties:
         * customStyle -- an optional inline CSS
         * onCloseClick -- custom action to be performed when user clicks 'close'
         * onReady -- a custom action to be performed once the component is mounted
         *            (signature: onReady(DOMNode) )
         */
        var PopupBox = React.createClass({

            getInitialState: function () {
                return {visible: false};
            },

            closeClickHandler: function () {
                if (typeof this.props.onCloseClick === 'function') {
                    this.props.onCloseClick.call(this);
                }
            },

            componentDidMount : function () {
                if (this.props.onReady) {
                    this.props.onReady(this.getDOMNode());
                }
            },

            render: function () {
                var classes = 'tooltip-box framed';

                if (this.props.customClass) {
                    classes += ' ' + this.props.customClass;
                }

                return (
                    <div className={classes} style={this.props.customStyle}>
                        <div className="header">
                            <a className="close-link" onClick={this.closeClickHandler}></a>
                        </div>
                        {this.props.children}
                    </div>
                );
            }
        });


        // ----------------------------- info/error/warning message box ----------------------

        var Message = React.createClass({
            _handleCloseClick : function (e) {
                e.preventDefault();
                dispatcher.dispatch({
                    actionType: 'MESSAGE_CLOSED',
                    sender: this,
                    props: {
                        messageId: this.props.messageId
                    }
                });
            },

            render : function () {
                var typeIconMap = {
                    info: '../files/img/info-icon.png',
                    warning: '../files/img/warning-icon.png',
                    error: '../files/img/error-icon.png'
                },
                classes = 'message ' + this.props.messageType;

                return (
                    <div className={classes}>
                        <div className="icon-box">
                            <img className="icon" alt="message"
                                 src={ typeIconMap[this.props.messageType] } />
                        </div>
                        <div className="message-text">
                            <span>{ this.props.messageText }</span>
                        </div>
                        <div className="button-box">
                            <a className="close-icon">
                                <img src="../files/img/close-icon.png"
                                    onClick={this._handleCloseClick } />
                            </a>
                        </div>
                    </div>
                );
            }
        });

        var Messages = React.createClass({

            getInitialState : function () {
                return {messages: []};
            },

            _changeListener : function (store) {
                this.setState({messages: store.getMessages()});
            },

            componentDidMount : function () {
                storeProvider.messageStore.addChangeListener(this._changeListener);
            },

            componentWillUnmount : function () {
                storeProvider.messageStore.removeChangeListener(this._changeListener);
            },

            render: function () {
                var messages = this.state.messages.map(function (item, i) {
                    return <Message key={i} messageType={item.messageType}
                                    messageText={item.messageText}
                                    messageId={item.messageId} />;
                });
                if (messages) {
                    return (
                        <div className="messages">
                            <ReactCSSTransitionGroup transitionName="msganim">
                            {messages}
                            </ReactCSSTransitionGroup>
                        </div>
                    );

                } else {
                    return null;
                }
            }
        });


        var QueryHints = React.createClass({

            mixins: mixins,

            _changeListener : function (store) {
                this.setState({hintText: store.getHint()});
            },

            getInitialState : function () {
                return {hintText: this.props.hintText};
            },

            componentDidMount : function () {
                storeProvider.queryHintStore.addChangeListener(this._changeListener);
            },

            componentWillUnmount : function () {
                storeProvider.queryHintStore.removeChangeListener(this._changeListener);
            },

            _clickHandler : function () {
                dispatcher.dispatch({
                    actionType: 'NEXT_QUERY_HINT',
                    props: {}
                });
            },

            render: function () {
                return (
                    <div>
                        <span className="hint">{this.state.hintText}</span>
                        <span className="next-hint">
                            (<a onClick={this._clickHandler}>{this.translate('global__next_tip')}</a>)
                        </span>
                    </div>
                );
            }
        });


        // ------------------------------------------------------------------------------------

        return {
            CorpusInfoBox: CorpusInfoBox,
            PopupBox: PopupBox,
            Messages: Messages,
            QueryHints: QueryHints
        };

    };

    return lib;
});