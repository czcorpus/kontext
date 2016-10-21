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

import React from 'vendor/react';
import ReactDOM from 'vendor/react-dom';
import $ from 'jquery';


const ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;


export function init(dispatcher, mixins, storeProvider) {

    // ------------------------------ <ModalOverlay /> -----------------------------

    let ModalOverlay = React.createClass({

        mixins : mixins,

        _keyPressHandler : function (evt) {
            if (evt.keyCode === 27 && typeof this.props.onCloseKey === 'function') {
                this.props.onCloseKey();
            }
        },

        componentDidMount : function () {
            this.addGlobalKeyEventHandler(this._keyPressHandler);
        },

        componentWillUnmount : function () {
            this.removeGlobalKeyEventHandler(this._keyPressHandler);
        },

        render : function () {
            const style = {};
            if (this.props.isScrollable) {
                style['overflow'] = 'auto';
            }
            return (
                <div id="modal-overlay" style={style}>
                    {this.props.children}
                </div>
            );
        }
    });


    // ------------------------------ <PopupBox /> -----------------------------

    /**
     * React version of KonText popupbox
     *
     * supported properties:
     * customStyle -- an optional inline CSS
     * onCloseClick -- custom action to be performed when user clicks 'close'
     * onReady -- a custom action to be performed once the component is mounted
     *            (signature: onReady(DOMNode) )
     */
    let PopupBox = React.createClass({

        mixins: mixins,

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
                this.props.onReady(ReactDOM.findDOMNode(this));
            }
        },

        _renderStatusIcon : function () {
            let m = {
                'info': 'img/info-icon.svg',
                'message': 'img/message-icon.png',
                'warning': 'img/warning-icon.svg',
                'error': 'img/error-icon.svg'
            };
            if (!this.props.status || !m[this.props.status]) {
                return null;

            } else {
                let path = this.createStaticUrl(m[this.props.status]);
                return <div><img className="info-icon" src={path} alt={this.props.status} /></div>;
            }
        },

        _createStyle : function () {
            let css = {};
            for (let p in this.props.customStyle) {
                if (this.props.customStyle.hasOwnProperty(p)) {
                    css[p] = this.props.customStyle[p];
                }
            }
            return css;
        },

        render: function () {
            let classes = 'tooltip-box';
            if (this.props.customClass) {
                classes += ' ' + this.props.customClass;
            }
            let css = this._createStyle();
            if (this.props.autoSize) {
                css['width'] = '31.9%';
            }

            return (
                <div className={classes} style={css}>
                    <div className="header">
                        <a className="close-link" onClick={this.closeClickHandler}></a>
                        {this._renderStatusIcon()}
                    </div>
                    {this.props.children}
                </div>
            );
        }
    });

    // ------------------------------ <InlineHelp /> -----------------------------

    let InlineHelp = React.createClass({

        mixins : mixins,

        _clickHandler : function () {
            this.setState({helpVisible: !this.state.helpVisible});
        },

        getInitialState : function () {
            return {helpVisible: false};
        },

        render : function () {
            return (
                <sup style={{display: 'inline-block'}}>
                    <a className="context-help" onClick={this._clickHandler}>
                        <img className="over-img" src={this.createStaticUrl('img/question-mark.svg')}
                                data-alt-img={this.createStaticUrl('img/question-mark_s.svg')} />
                    </a>
                    {this.state.helpVisible ?
                        <PopupBox onCloseClick={this._clickHandler}
                                customStyle={this.props.customStyle}>
                            {this.props.children}
                        </PopupBox>
                        : null}
                </sup>
            );
        }

    });


    // ----------------------------- info/error/warning message box ----------------------

    let Message = React.createClass({

        mixins: mixins,

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
                info: this.createStaticUrl('img/info-icon.svg'),
                warning: this.createStaticUrl('img/warning-icon.svg'),
                error: this.createStaticUrl('img/error-icon.svg'),
                mail: this.createStaticUrl('img/message-icon.png')
            },
            classes = 'message ' + this.props.messageType;

            return (
                <div className={classes}>
                    <div className="button-box">
                        <a className="close-icon">
                            <img src={this.createStaticUrl('img/close-icon.svg')}
                                onClick={this._handleCloseClick } />
                        </a>
                    </div>
                    <div className="icon-box">
                        <img className="icon" alt="message"
                                src={ typeIconMap[this.props.messageType] } />
                    </div>
                    <div className="message-text">
                        <span>{ this.props.messageText }</span>
                    </div>
                </div>
            );
        }
    });

    let Messages = React.createClass({

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
                        <ReactCSSTransitionGroup transitionName="msganim" transitionEnterTimeout={500} transitionLeaveTimeout={300}>
                        {messages}
                        </ReactCSSTransitionGroup>
                    </div>
                );

            } else {
                return null;
            }
        }
    });

    // -------------------------------------------------------------------

    let QueryHints = React.createClass({

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
        ModalOverlay: ModalOverlay,
        PopupBox: PopupBox,
        InlineHelp: InlineHelp,
        Messages: Messages,
        QueryHints: QueryHints
    };
}
