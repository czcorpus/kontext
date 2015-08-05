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

    var lib = {};

    lib.init = function (dispatcher, mixins, layoutViews, formStore, listStore) {

        // -------------------------- dataset components -----------------------

        var CorplistHeader = React.createClass({
            mixins: mixins,
            componentDidMount: function () {
                var self = this;
                listStore.addChangeListener(function () {
                    self.setState({htmlClasses: []});
                });
                formStore.addChangeListener(function () {
                    self.setState({htmlClasses: ["dataset-loading"]});
                });
            },
            getInitialState: function () {
                return {htmlClasses: []};
            },
            render: function () {
                return (<tr className={this.state.htmlClasses.join(' ')}>
                    <th>{this.translate('defaultCorparch__corpus_name')}</th>
                    <th>{this.translate('defaultCorparch__size_in_positions')}</th>
                    <th>{this.translate('defaultCorparch__corpus_labels')}</th>
                    <th></th>
                    <th></th>
                    <th></th>
                </tr>);
            }
        });


        var FavStar = React.createClass({

            mixins: mixins,

            _handleClick : function () {
                var newState = !this.state.isFav;

                dispatcher.dispatch({
                    actionType: 'LIST_STAR_CLICKED',
                    props: {
                        corpusId: this.props.corpusId,
                        corpusName: this.props.corpusName,
                        isFav: newState,
                        type: 'corpus'
                    }
                });
            },

            _changeListener : function (store) {
                var isFav = store.isFav(this.props.corpusId);
                if (isFav !== this.state.isFav) {
                    this.setState({isFav: isFav});
                }
            },

            getInitialState : function () {
                return {isFav: this.props.isFav};
            },

            componentDidMount : function () {
                listStore.addChangeListener(this._changeListener);
            },

            componentWillUnmount : function () {
                listStore.removeChangeListener(this._changeListener);
            },

            render: function () {
                var imgUrl;

                if (this.state.isFav) {
                    imgUrl = this.createStaticUrl('img/starred_24x24.png');

                } else {
                    imgUrl = this.createStaticUrl('img/starred_24x24_grey.png');
                }
                return <img className="starred" src={imgUrl} onClick={this._handleClick} />;
            }
        });

        /**
         *
         */
        var RequestForm = React.createClass({
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

            _clickExpandTextareaHandler : function () {
                this.setState(React.addons.update(this.state,
                    {textareaVisible: {$set: !this.state.textareaVisible}}));
            },

            _textareaChangeHandler : function (e) {
                this.setState({customMessage: e.target.value});
            },

            getInitialState : function () {
                return {customMessage: '-', textareaVisible: false};
            },

            render : function () {
                var toggleImgPath;
                var textarea;

                if (this.state.textareaVisible) {
                    textarea = <textarea rows="3" cols="50"
                                    onChange={this._textareaChangeHandler}
                                    value={this.state.customMessage} />;
                    toggleImgPath = this.createStaticUrl('img/collapse.png');

                } else {
                    textarea = <p>{this.state.customMessage}</p>;
                    toggleImgPath = this.createStaticUrl('img/expand.png');
                }

                return (
                    <form>
                        <p>{this.translate(
                            this.sprintf('\u201CPlease give me an access to the %s corpus\u201D', this.props.corpusName))}</p>
                        <label className="toggle-textarea" onClick={this._clickExpandTextareaHandler}
                            title={this.translate('click to expand/close the field')}>
                            {this.translate('Custom message (optional)')}
                            <img src={toggleImgPath} />
                        </label>
                        <div>
                            {textarea}
                        </div>
                        <div>
                            <button className="submit" type="button" onClick={this._submitHandler}>{this.translate('Send')}</button>
                        </div>
                    </form>
                );
            }

        });

        /**
         *
         */
        var LockIcon = React.createClass({
            mixins: mixins,

            getInitialState : function () {
                return {isLocked: this.props.isLocked, hasFocus: false, hasDialog: false};
            },

            _mouseOverHandler : function () {
                this.setState({isLocked: this.state.isLocked, hasFocus: true, hasDialog: this.state.hasDialog});
            },

            _mouseOutHandler : function () {
                this.setState({isLocked: this.state.isLocked, hasFocus: false, hasDialog: this.state.hasDialog});
            },

            _clickHandler : function () {
                this.setState({isLocked: this.state.isLocked, hasFocus: this.state.hasFocus, hasDialog: true});
            },

            _closeDialog : function () {
                this.setState(React.addons.update(this.state, {hasDialog: {$set: false}}));
            },

            render : function () {
                var img,
                    dialog,
                    onBoxReady;

                if (this.state.isLocked) {
                    if (this.state.hasFocus) {
                        img = <img src={this.createStaticUrl('img/24px-Unlocked.png')} />;

                    } else {
                        img = <img src={this.createStaticUrl('img/24px-Locked.png')} />;
                    }

                    if (this.state.hasDialog) {
                        onBoxReady = function (elm) {
                            var rect = elm.getBoundingClientRect();
                            var newX, newY;

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
                                 title={this.translate('click to ask for access')}
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
        var CorplistRow = React.createClass({

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
                var keywords = this.props.row.keywords.map(function (k, i) {
                    return <CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
                });

                var detailBox;

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

                var link = this.createActionLink('first_form?corpname=' + this.props.row.id);
                var size = this.props.row.raw_size ? this.props.row.raw_size : '-';
                var favStar = null;
                var lockIcon = null;

                if (this.props.enableUserActions) {
                    favStar = <FavStar corpusId={this.props.row.id}
                                       corpusName={this.props.row.name}
                                       isFav={this.props.row.user_item} />;
                    lockIcon = <LockIcon isLocked={!this.props.row.user_access}
                                         corpusId={this.props.row.id}
                                         corpusName={this.props.row.name} />;
                }

                return (
                    <tr>
                        <td className="corpname"><a
                            href={link}>{this.props.row.name}</a></td>
                        <td className="num">{size}</td>
                        <td>
                            {keywords}
                        </td>
                        <td>
                            {favStar}
                        </td>
                        <td>
                            {lockIcon}
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
         * Provides a link allowing to load more items with current
         * query and filter settings.
         */
        var ListExpansion = React.createClass({
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
                          <td colSpan="6">
                              <a onClick={this._linkClickHandler}>{this.translate('global__load_more')}</a>
                          </td>
                      </tr>
                );
            }
        });

        /**
         * dataset table
         */
        var CorplistTable = React.createClass({

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
                var self = this;
                var rows = this.state.rows.map(function (row, i) {
                    return <CorplistRow key={row.id} row={row}
                                        enableUserActions={!self.props.anonymousUser} />;
                });
                var expansion = null;
                if (this.state.nextOffset) {
                    expansion = <ListExpansion offset={this.state.nextOffset} />;
                }

                return (
                    <div>
                        <table className="data corplist" border="0">
                            <tbody>
                                <CorplistHeader />
                                {rows}
                                {expansion}
                            </tbody>
                        </table>
                    </div>
                );
            }
        });

        /**
         * a single keyword link shown within a dataset table row
         */
        var CorpKeywordLink = React.createClass({

            mixins: mixins,

            _handleClick : function (e) {
                var self = this;

                e.preventDefault();
                dispatcher.dispatch({
                    actionType: 'KEYWORD_CLICKED',
                    props: {
                        keyword: self.props.keyword,
                        status: true,
                        ctrlKey: e.ctrlKey || e.metaKey
                    }
                });
            },

            render: function () {
                return (
                    <a className="keyword" onClick={this._handleClick}
                       data-keyword-id={this.props.keyword}>{this.props.label}</a>
                );
            }
        });

        // ------------------------------------------------------------------
        // -------------------------- form components -----------------------
        // ------------------------------------------------------------------

        /**
         * A keyword link from the filter form
         */
        var KeywordLink = React.createClass({
            mixins: mixins,
            changeHandler: function () {
                this.setState({active: formStore.getKeywordState(this.props.keyword)});
            },
            getInitialState: function () {
                return {active: Boolean(this.props.isActive)};
            },
            componentDidMount: function () {
                formStore.addChangeListener(this.changeHandler);
            },
            componentWillUnmount: function () {
                formStore.removeChangeListener(this.changeHandler);
            },
            _handleClick: function (active) {
                var self = this;

                return function (e) {
                    e.preventDefault();
                    dispatcher.dispatch({
                        actionType: 'KEYWORD_CLICKED',
                        props: {
                            keyword: self.props.keyword,
                            status: active,
                            ctrlKey: e.ctrlKey || e.metaKey
                        }
                    });
                };
            },
            render: function () {
                var link;

                if (!this.state.active) {
                    link = this.createActionLink("corplist?keyword="+this.props.keyword);
                    return (
                        <a className="keyword" href={link}
                           data-keyword-id={this.props.keyword}
                            onClick={this._handleClick(true)}>{this.props.label}</a>
                    );

                } else {
                    return (
                        <span className="keyword current"
                              data-keyword-id={this.props.keyword}
                              onClick={this._handleClick(false)}
                            >{this.props.label}</span>
                    );
                }
            }
        });

        /**
         * A keyword-like link to reset currently set keywords
         */
        var ResetLink = React.createClass({
            mixins: mixins,
            _handleClick: function (e) {
                e.preventDefault();
                dispatcher.dispatch({
                    actionType: 'KEYWORD_RESET_CLICKED',
                    props: {}
                });
            },
            render: function () {
                return <a className="keyword reset"
                          onClick={this._handleClick}>{this.translate('global__none')}</a>;
            }
        });

        /**
         * A form fieldset containing all the available keywords
         */
        var KeywordsField = React.createClass({
            mixins: mixins,
            getInitialState: function () {
                return {};
            },
            render: function () {
                var links = this.props.keywords.map(function (keyword, i) {
                    return <KeywordLink key={i} keyword={keyword[0]} label={keyword[1]}
                                        isActive={keyword[2]} />;
                });

                return (
                    <fieldset className="keywords">
                        <legend>{this.props.label}</legend>
                        <ResetLink />
                        {links}
                        <span className="inline-label">({this.translate('defaultCorparch__hold_ctrl_for_multiple')})</span>
                    </fieldset>
                );
            }
        });

        /**
         * An input to specify minimum corpus size
         */
        var MinSizeInput = React.createClass({
            changeHandler: function (e) {
                dispatcher.dispatch({
                    actionType: 'FILTER_CHANGED',
                    props: {minSize: e.target.value}
                });
            },
            render: function () {
                return <input className="min-max" type="text"
                              defaultValue={this.props.minSize}
                              onChange={this.changeHandler} />;
            }
        });

        /**
         * An input to specify maximum corpus size
         */
        var MaxSizeInput = React.createClass({
            changeHandler: function (e) {
                dispatcher.dispatch({
                    actionType: 'FILTER_CHANGED',
                    props: {maxSize: e.target.value}
                });
            },
            render : function () {
                return <input className="min-max" type="text"
                              defaultValue={this.props.maxSize}
                              onChange={this.changeHandler} />;
            }
        });

        /**
         * A fieldset containing non-keyword filter inputs.
         */
        var FilterInputFieldset = React.createClass({
            mixins: mixins,

            getInitialState : function () {
                return {expanded: false};
            },

            _handleLegendClick : function () {
                this.setState(React.addons.update(this.state, {expanded: {$set: !this.state.expanded}}));
            },

            render: function () {
                var hiddenInputs = this.props.currKeywords.map(function (v, i) {
                    return <input key={i} type="hidden" name="keyword" value={v} />;
                });
                var fields;
                var fieldsetClasses;

                if (this.state.expanded) {
                    fieldsetClasses = 'advanced-filter';
                    fields = (
                        <div>
                        <span>{this.translate('defaultCorparch__size_from')}: </span>
                        <MinSizeInput minSize={this.props.filters.minSize[0]} />
                        <span className="inline-label">{this.translate('to')}: </span>
                        <MaxSizeInput maxSize={this.props.filters.maxSize[0]} />
                        <span className="inline-label">{'(' +
                        this.translate('defaultCorparch__you_can_use_suffixes_size') + ')'}</span>
                        </div>
                    );

                } else {
                    fieldsetClasses = 'advanced-filter closed';
                    fields = null;
                }

                return (
                    <fieldset className={fieldsetClasses}>
                        <legend onClick={this._handleLegendClick}>{this.translate('global__advanced_filter')}</legend>
                        {hiddenInputs}
                        {fields}
                    </fieldset>
                );
            }
        });

        /**
         * Filter form root component
         */
        var FilterForm = React.createClass({
            mixins: mixins,
            render: function () {
                return (
                    <div>
                        <KeywordsField
                            keywords={this.props.keywords}
                            label={this.translate('defaultCorparch__keywords_field_label')} />
                        <FilterInputFieldset
                            currKeywords={this.props.currKeywords}
                            filters={this.props.filters} />
                    </div>
                )
            }
        });

        return {
            CorplistTable: CorplistTable,
            FilterForm: FilterForm
        };
    };

    return lib;
});
