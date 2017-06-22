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


const ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;


export function init(dispatcher, mixins, storeProvider) {

    // ------------------------------ <ModalOverlay /> -----------------------------

    const ModalOverlay = React.createClass({

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
     * takeFocus (boolean) -- if true then the "close" button will take the focus
     *                        allowing instant closing by ESC or handling keys
     *                        by a custom handler (see the next prop)
     * keyPressHandler -- an optional function called in case of a 'onKeyDown' event
     */
    const PopupBox = React.createClass({

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

        _handleKeyPress : function (evt) {
            if (evt.keyCode === 27) {
                 this.closeClickHandler();
            }
            if (typeof this.props.keyPressHandler === 'function') {
                this.props.keyPressHandler(evt);
            }
            evt.preventDefault();
            evt.stopPropagation();
        },

        _renderCloseButton : function () {
             if (this.props.takeFocus) {
                return <button className="close-link"
                            onClick={this.closeClickHandler}
                            onKeyDown={this._handleKeyPress}
                            ref={item => item ? item.focus() : null} />;

             } else {
                 return <button className="close-link"
                            onClick={this.closeClickHandler}
                            onKeyDown={this._handleKeyPress} />;
             }
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
                        {this._renderCloseButton()}
                        {this._renderStatusIcon()}
                    </div>
                    {this.props.children}
                </div>
            );
        }
    });

    // ------------------------------ <CloseableFrame /> -----------------------------

    const CloseableFrame = React.createClass({

        mixins : mixins,

        _closeClickHandler : function () {
            if (typeof this.props.onCloseClick === 'function') {
                this.props.onCloseClick.call(this);
            }
        },

        getInitialState : function () {
            return {
                isMouseover : false
            };
        },

        _handleCloseMouseover : function () {
            this.setState({isMouseover: true});
        },

        _handleCloseMouseout : function () {
            this.setState({isMouseover: false});
        },

        render : function () {
            const style = {
                width: '1.5em',
                height: '1.5em',
                float: 'right',
                cursor: 'pointer',
                fontSize: '1em'
            };
            const htmlClass = 'closeable-frame' + (this.props.customClass ? ` ${this.props.customClass}` : '');
            return (
                <section className={htmlClass} style={this.props.scrollable ? {overflowY: 'auto'} : {}}>
                    <div className="heading">
                        <div className="control">
                            <img className="close-icon"
                                    src={this.state.isMouseover ? this.createStaticUrl('img/close-icon_s.svg')
                                        : this.createStaticUrl('img/close-icon.svg')}
                                    onClick={this._closeClickHandler}
                                    alt={this.translate('global__close_the_window')}
                                    title={this.translate('global__close_the_window')}
                                    onMouseOver={this._handleCloseMouseover}
                                    onMouseOut={this._handleCloseMouseout}  />
                        </div>
                        <h2>
                            {this.props.label}
                        </h2>
                    </div>
                    {this.props.children}
                </section>
            );
        }

    });

    // ------------------------------ <InlineHelp /> -----------------------------

    const InlineHelp = React.createClass({

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


    // ------------------------------ <Message /> -----------------------------
    // (info/error/warning message box)

    const Message = React.createClass({

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

    // ------------------------------ <Messages /> -----------------------------

    const Messages = React.createClass({

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

    // ------------------------ <CorpnameInfoTrigger /> --------------------------------

    /**
     * Props:
     * - humanCorpname
     * - usesubcorp
     */
    const CorpnameInfoTrigger = React.createClass({

        mixins : mixins,

        _handleCorpnameClick : function () {
            dispatcher.dispatch({
                actionType: 'OVERVIEW_CORPUS_INFO_REQUIRED',
                props: {
                    corpusId: this.props.corpname
                }
            });
        },

        _handleSubcnameClick : function () {
            dispatcher.dispatch({
                actionType: 'OVERVIEW_SHOW_SUBCORPUS_INFO',
                props: {
                    corpusId: this.props.corpname,
                    subcorpusId: this.props.usesubcorp
                }
            });
        },

        _renderSubcorp : function () {
            if (this.props.usesubcorp) {
                return (
                    <span>
                        <strong>:</strong>
                        <a className="subcorpus" title={this.translate('global__subcorpus')}
                                    onClick={this._handleSubcnameClick}>
                            {this.props.usesubcorp}
                        </a>
                    </span>
                );

            } else {
                return null;
            }
        },

        render : function () {
            return (
                <li id="active-corpus">
                    <strong>{this.translate('global__corpus')}:{'\u00a0'}</strong>
                    <a className="corpus-desc" title="click for details"
                                onClick={this._handleCorpnameClick}>
                        {this.props.humanCorpname}
                    </a>
                    {this._renderSubcorp()}
                </li>
            );
        }
    });

    // ------------------------ <EmptyQueryOverviewBar /> --------------------------------

    const EmptyQueryOverviewBar = React.createClass({

        render : function () {
            return (
                <ul id="query-overview-bar">
                    <CorpnameInfoTrigger
                            corpname={this.props.corpname}
                            humanCorpname={this.props.humanCorpname}
                            usesubcorp={this.props.usesubcorp} />
                </ul>
            );
        }

    });


    // ------------------------------------------------------------------------------------

    return {
        ModalOverlay: ModalOverlay,
        PopupBox: PopupBox,
        CloseableFrame: CloseableFrame,
        InlineHelp: InlineHelp,
        Messages: Messages,
        CorpnameInfoTrigger: CorpnameInfoTrigger,
        EmptyQueryOverviewBar: EmptyQueryOverviewBar
    };
}
