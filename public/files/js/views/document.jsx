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

        // ---------------------------------------------------------------

        var SubcorpusInfo = React.createClass({
            mixins: mixins,

            componentDidMount : function () {
                // we must inform non-react environment (here popupbox.js) we are ready here
                if (typeof this.props.doneCallback === 'function') {
                    this.props.doneCallback();
                }
            },

            render: function () {
                return (
                    <div>
                        <h2 className="subcorpus-name">{this.props.corpname}:<strong>{this.props.name}</strong></h2>
                        <div>
                            <strong>{this.translate('global__size_in_tokens')}:</strong>{'\u00A0'}{this.props.size}
                        </div>
                        <div className="subc-query">
                            <strong>{this.translate('global__subc_query')}:</strong>
                            {
                               this.props.cql ?
                               <textarea readOnly="true" value={this.props.cql} style={{width: '100%'}} />
                               : <span>{this.translate('global__subc_def_not_avail')}</span>
                            }
                        </div>
                    </div>
                );
            }
        });

        // ---------------------------------------------------------------

        var CorpusReference = React.createClass({

            mixins: mixins,

            componentDidMount : function () {
                // we must inform non-react environment (here popupbox.js) we are ready here
                if (typeof this.props.doneCallback === 'function') {
                    this.props.doneCallback();
                }
            },

            render: function () {
                if (this.props.citation_info['article_ref'] || this.props.citation_info['default_ref']
                        || this.props.citation_info['other_bibliography']) {
                    return (
                        <div>
                            <h3>{this.translate('global__how_to_cite_corpus')}</h3>
                            <h4>
                                {this.translate('global__corpus_as_resource_{corpus}', {corpus: this.props.corpname})}
                            </h4>
                            <div dangerouslySetInnerHTML={{__html: this.props.citation_info.default_ref}} />
                            {
                                this.props.citation_info.article_ref
                                ?   <div>
                                        <h4>{this.translate('global__references')}</h4>
                                        <ul>
                                        {this.props.citation_info.article_ref.map((item, i) => {
                                            return <li key={i} dangerouslySetInnerHTML={{__html: item }} />;
                                        })}
                                        </ul>
                                    </div>
                                : null
                            }
                            {
                                this.props.citation_info.other_bibliography
                                ? <div>
                                    <h4>{this.translate('global__general_references')}</h4>
                                    <div dangerouslySetInnerHTML={{__html: this.props.citation_info.other_bibliography}} />
                                    </div>
                                : null
                            }
                        </div>
                    );

                } else {
                    return <div>{this.translate('global__no_citation_info')}</div>
                }
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
                    url: null,
                    citation_info: null
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

            _renderWebLink() {
                if (this.state.web_url) {
                    return <a href={this.state.web_url} target="_blank">{this.state.web_url}</a>;

                } else {
                    return '-';
                }
            },

            render: function () {
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
                                <h2 className="corpus-name">{this.state.corpname}</h2>
                                <p className="corpus-description">{this.state.description}</p>
                                <p className="metadata">
                                    <strong>{this.translate('global__size')}: </strong>
                                    <span className="size">{this.state.size}</span> {this.translate('global__positions')}<br />

                                    <strong className="web_url">{this.translate('global__website')}: </strong>
                                    {this._renderWebLink()}
                                </p>
                            </div>

                            <h3>{this.translate('global__corpus_info_metadata_heading')}</h3>

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
                            <CorpusReference corpname={this.state.corpname} citation_info={this.state.citation_info} />
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
                        <div className="button-box">
                            <a className="close-icon">
                                <img src="../files/img/close-icon.png"
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

        // -------------------------------------------------------------------

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
            CorpusReference: CorpusReference,
            CorpusInfoBox: CorpusInfoBox,
            PopupBox: PopupBox,
            Messages: Messages,
            QueryHints: QueryHints,
            SubcorpusInfo: SubcorpusInfo
        };

    };

    return lib;
});