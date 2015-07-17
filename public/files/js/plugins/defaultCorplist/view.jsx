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

    lib.init = function (dispatcher, mixins, layoutViews, formStore, listStore, statusStore) {

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
                    <th>{this.translate('Name')}</th>
                    <th>{this.translate('Size (in positions)')}</th>
                    <th>{this.translate('Labels')}</th>
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
         * A single dataset row
         */
        var CorplistRow = React.createClass({

            mixins: mixins,

            errorHandler: function (store, statusType) {
                if (statusType === 'error' && this.state.detail) {
                    var state = this.state;
                    state.detail = false;
                    this.setState(state);
                }
            },

            componentDidMount: function () {
                // TODO this is not very effective - a single component should listen for corpinfo error
                statusStore.addChangeListener(this.errorHandler);
            },

            componentWillUnmount: function () {
                statusStore.removeChangeListener(this.errorHandler);
            },

            detailClickHandler: function (evt) {
                evt.preventDefault();
                var state = this.state;
                state.detail = true;
                this.setState(state);
            },

            getInitialState: function () {
                return {detail: false};
            },

            detailCloseHandler: function () {
                var state = this.state;
                state.detail = false;
                this.setState(state);
            },

            render: function () {
                var keywords = this.props.row.keywords.map(function (k, i) {
                    return <CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
                });

                var detailBox;

                if (this.state.detail) {
                    detailBox = <layoutViews.PopupBox
                        onCloseClick={this.detailCloseHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                        <layoutViews.CorpusInfoBox corpusId={this.props.row.id}   />
                    </layoutViews.PopupBox>;

                } else {
                    detailBox = null;
                }

                var link = this.createActionLink('first_form?corpname=' + this.props.row.id);

                return (
                    <tr>
                        <td className="corpname"><a
                            href={link}>{this.props.row.name}</a></td>
                        <td className="num">{this.props.row.raw_size}</td>
                        <td>
                            {keywords}
                        </td>
                        <td>
                            <FavStar corpusId={this.props.row.id}
                                     corpusName={this.props.row.name}
                                     isFav={this.props.row.user_item} />
                        </td>
                        <td>
                            {detailBox}
                            <p className="desc" style={{display: 'none'}}>
                            </p>
                            <a className="detail"
                               onClick={this.detailClickHandler}>{this.translate('details')}</a>
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
                      <td colSpan="4">
                          <a onClick={this._linkClickHandler}>{this.translate('load more')}</a>
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
                var rows = this.state.rows.map(function (row, i) {
                    return <CorplistRow key={i} row={row} />;
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

            render: function () {
                var link = this.createActionLink("corplist?keyword="+this.props.keyword);
                return (
                    <a className="keyword" href={link}
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
            handleClick: function (active) {
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
                            onClick={this.handleClick(true)}>{this.props.label}</a>
                    );

                } else {
                    return (
                        <span className="keyword current"
                              data-keyword-id={this.props.keyword}
                              onClick={this.handleClick(false)}
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
            handleClick: function (e) {
                e.preventDefault();
                dispatcher.dispatch({
                    actionType: 'KEYWORD_RESET_CLICKED',
                    props: {}
                });
            },
            render: function () {
                return <a className="keyword reset"
                          onClick={this.handleClick}>{this.translate('None')}</a>;
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
                        <span className="inline-label">({this.translate('hold_ctrl')})</span>
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

            render: function () {
                var hiddenInputs = this.props.currKeywords.map(function (v, i) {
                    return <input key={i} type="hidden" name="keyword" value={v} />;
                });

                return (
                    <fieldset>
                        <legend>{this.translate('Properties')}</legend>
                        {hiddenInputs}
                        <span>{this.translate('size from')}: </span>
                        <MinSizeInput minSize={this.props.filters.minSize[0]} />
                        <span className="inline-label">{this.translate('to')}: </span>
                        <MaxSizeInput maxSize={this.props.filters.maxSize[0]} />
                        <span className="inline-label">{'(' +
                        this.translate('You can use suffixes to specify a rough size - e.g. 100M, 1G, 1T') + ')'}</span>
                    </fieldset>
                );
            }
        });

        /**
         * Filter form root component
         */
        var FilterForm = React.createClass({
            render: function () {
                return (
                    <div>
                        <KeywordsField
                            keywords={this.props.keywords}
                            label={this.props.keywordsFieldLabel} />
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
