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


export function init(dispatcher, mixins, layoutViews, CorpusInfoBox, formStore, listStore) {

    // ---------------------------------------------------------------------
    // -------------------------- dataset components -----------------------
    // ---------------------------------------------------------------------

    // -------------------------------- <CorplistHeader /> -----------------


    let CorplistHeader = React.createClass({

        mixins: mixins,

        render: function () {
            return (
                <tr>
                    <th>{this.translate('defaultCorparch__corpus_name')}</th>
                    <th>{this.translate('defaultCorparch__size_in_positions')}</th>
                    <th>{this.translate('defaultCorparch__corpus_labels')}</th>
                    <th></th>
                    <th></th>
                </tr>
            );
        }
    });

    // -------------------------------- <FavStar /> -----------------

    let FavStar = React.createClass({

        mixins: mixins,

        _handleClick : function () {
            let newState = !this.state.isFav;

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
            let isFav = store.isFav(this.props.corpusId);
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
            let imgUrl;

            if (this.state.isFav) {
                imgUrl = this.createStaticUrl('img/starred.svg');

            } else {
                imgUrl = this.createStaticUrl('img/starred_grey.svg');
            }
            return <img className="starred" src={imgUrl} onClick={this._handleClick} />;
        }
    });

    // -------------------------------- <CorplistRow /> -----------------

    /**
     * A single dataset row
     */
    let CorplistRow = React.createClass({

        mixins: mixins,

        _renderFavStar : function () {
            if (this.props.enableUserActions) {
                return <FavStar corpusId={this.props.row.id}
                                    corpusName={this.props.row.name}
                                    isFav={this.props.row.user_item} />;

            } else {
                return null;
            }
        },

        _handleDetailClick : function (corpusId, evt) {
            this.props.detailClickHandler(corpusId);
        },

        render: function () {
            const keywords = this.props.row.keywords.map(function (k, i) {
                return <CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
            });
            const link = this.createActionLink('first_form?corpname=' + this.props.row.id);
            const size = this.props.row.raw_size ? this.props.row.raw_size : '-';

            return (
                <tr>
                    <td className="corpname"><a
                        href={link}>{this.props.row.name}</a></td>
                    <td className="num">{size}</td>
                    <td>
                        {keywords}
                    </td>
                    <td>
                        {this._renderFavStar()}
                    </td>
                    <td>
                        <p className="desc" style={{display: 'none'}}></p>
                        <a className="detail" onClick={this._handleDetailClick.bind(this, this.props.row.id)}>
                            {this.translate('defaultCorparch__corpus_details')}
                        </a>
                    </td>
                </tr>
            );
        }
    });

    // -------------------------------- <ListExpansion /> -----------------

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
                        <a onClick={this._linkClickHandler}>{this.translate('global__load_more')}</a>
                    </td>
                </tr>
            );
        }
    });

    // -------------------------------- <CorplistTable /> -----------------

    const CorplistTable = React.createClass({

        changeHandler: function () {
            const data = listStore.getData();
            const detail = listStore.getDetail();
            this.setState({
                rows: data.rows,
                nextOffset: data.nextOffset,
                detailVisible: !!detail,
                detail: detail
            });
        },

        getInitialState: function () {
            return {
                rows: this.props.rows,
                nextOffset: this.props.nextOffset,
                detailVisible: false,
                detail: null
            };
        },

        componentDidMount: function () {
            listStore.addChangeListener(this.changeHandler);
        },

        componentWillUnmount: function () {
            listStore.removeChangeListener(this.changeHandler);
        },

        _detailClickHandler: function (corpusId) {
            this.setState(React.addons.update(this.state, {detailVisible: {$set: true}}));
            dispatcher.dispatch({
                actionType: 'CORPARCH_CORPUS_INFO_REQUIRED',
                props: {
                    corpusId: corpusId
                }
            });
        },

        _detailCloseHandler: function () {
            this.setState(React.addons.update(this.state, {detailVisible: {$set: false}}));
            dispatcher.dispatch({
                actionType: 'CORPARCH_CORPUS_INFO_CLOSED',
                props: {}
            });
        },

        _renderDetailBox: function () {
            if (this.state.detailVisible) {
                return (
                    <layoutViews.PopupBox
                        onCloseClick={this._detailCloseHandler}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                        <CorpusInfoBox data={this.state.detail} />
                    </layoutViews.PopupBox>
                );

            } else {
                return null;
            }
        },

        render: function () {
            let rows = this.state.rows.map((row, i) => {
                return <CorplistRow key={row.id} row={row}
                                    enableUserActions={!this.props.anonymousUser}
                                    detailClickHandler={this._detailClickHandler} />;
            });
            let expansion = null;
            if (this.state.nextOffset) {
                expansion = <ListExpansion offset={this.state.nextOffset} />;
            }

            return (
                <div>
                    {this._renderDetailBox()}
                    <table className="data corplist">
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

    // -------------------------------- <CorpKeywordLink /> -----------------

    /**
     * a single keyword link shown within a dataset table row
     */
    let CorpKeywordLink = React.createClass({

        mixins: mixins,

        _handleClick : function (e) {
            let self = this;

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
                        data-keyword-id={this.props.keyword}>
                    <span className="overlay">{this.props.label}</span>
                </a>
            );
        }
    });

    // ------------------------------------------------------------------
    // -------------------------- form components -----------------------
    // ------------------------------------------------------------------

    // -------------------------------- <KeywordLink /> -----------------

    /**
     * A keyword link from the filter form
     */
    let KeywordLink = React.createClass({

        mixins: mixins,

        _changeHandler: function (store, action) {
            this.setState({active: formStore.getKeywordState(this.props.keyword)});
        },

        getInitialState: function () {
            return {active: Boolean(this.props.isActive)};
        },

        componentDidMount: function () {
            formStore.addChangeListener(this._changeHandler);
        },

        componentWillUnmount: function () {
            formStore.removeChangeListener(this._changeHandler);
        },

        _handleClick: function (active) {
            return (e) => {
                e.preventDefault();
                this.props.initWaitingFn();
                dispatcher.dispatch({
                    actionType: 'KEYWORD_CLICKED',
                    props: {
                        keyword: this.props.keyword,
                        status: active,
                        ctrlKey: e.ctrlKey || e.metaKey
                    }
                });
            };
        },

        render: function () {
            let link;
            let style = this.props.overlayColor ? {backgroundColor: this.props.overlayColor} : null;


            if (!this.state.active) {
                link = this.createActionLink("corplist?keyword="+this.props.keyword);
                return (
                    <a className="keyword" href={link}
                            data-keyword-id={this.props.keyword}
                            onClick={this._handleClick(true)}>
                        <span className="overlay" style={style} >{this.props.label}</span>
                    </a>
                );

            } else {
                return (
                    <span className="keyword current"
                                data-keyword-id={this.props.keyword}
                                onClick={this._handleClick(false)}>
                        <span className="overlay" style={style}>{this.props.label}</span>
                    </span>
                );
            }
        }
    });

    // -------------------------------- <ResetLink /> -----------------

    /**
     * A keyword-like link to reset currently set keywords
     */
    let ResetLink = React.createClass({

        mixins: mixins,

        _handleClick: function (e) {
            e.preventDefault();
            this.props.initWaitingFn();
            dispatcher.dispatch({
                actionType: 'KEYWORD_RESET_CLICKED',
                props: {}
            });
        },

        render: function () {
            return <a className="keyword reset"
                        onClick={this._handleClick}><span className="overlay">{this.translate('defaultCorparch__no_keyword')}</span></a>;
        }
    });

    // -------------------------------- <KeywordsField /> -----------------

    /**
     * A form fieldset containing all the available keywords
     */
    let KeywordsField = React.createClass({

        mixins: mixins,

        getInitialState: function () {
            return {};
        },

        render: function () {
            let links = this.props.keywords.map((keyword, i) => {
                return <KeywordLink key={i} keyword={keyword[0]} label={keyword[1]}
                                    isActive={keyword[2]} overlayColor={keyword[3]}
                                    initWaitingFn={this.props.initWaitingFn} />;
            });

            return (
                <fieldset className="keywords">
                    <legend>{this.props.label}</legend>
                    <ResetLink initWaitingFn={this.props.initWaitingFn} />
                    {links}
                    <div className="inline-label hint">({this.translate('defaultCorparch__hold_ctrl_for_multiple')})</div>
                </fieldset>
            );
        }
    });

    // -------------------------------- <MinSizeInput /> -----------------

    /**
     * An input to specify minimum corpus size
     */
    let MinSizeInput = React.createClass({

        changeHandler: function (e) {
            this.props.initWaitingFn();
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

    // -------------------------------- <MaxSizeInput /> -----------------

    /**
     * An input to specify maximum corpus size
     */
    let MaxSizeInput = React.createClass({

        _changeHandler: function (e) {
            this.props.initWaitingFn();
            dispatcher.dispatch({
                actionType: 'FILTER_CHANGED',
                props: {maxSize: e.target.value}
            });
        },

        render : function () {
            return <input className="min-max" type="text"
                            defaultValue={this.props.maxSize}
                            onChange={this._changeHandler} />;
        }
    });

    // -------------------------------- <NameSearchInput /> -----------------

    let NameSearchInput = React.createClass({

        _timer : null,

        _changeHandler : function (e) {
            if (this._timer) {
                clearTimeout(this._timer);
            }
            this._timer = setTimeout(((value) => () => {
                this.props.initWaitingFn();
                dispatcher.dispatch({
                    actionType: 'FILTER_CHANGED',
                    props: {corpusName: value}
                });
                clearTimeout(this._timer);
            })(e.target.value), 300);
        },

        render : function () {
            return <input type="text" defaultValue={this.props.initialValue} onChange={this._changeHandler} />;
        }
    });

    // -------------------------------- <FilterInputFieldset /> -----------------

    /**
     * A fieldset containing non-keyword filter inputs.
     */
    let FilterInputFieldset = React.createClass({
        mixins: mixins,

        getInitialState : function () {
            return {expanded: this.props.filters.name[0] ? true : false};
        },

        _handleLegendClick : function () {
            this.setState(React.addons.update(this.state, {expanded: {$set: !this.state.expanded}}));
        },

        render: function () {
            let fields;
            let fieldsetClasses;

            if (this.state.expanded) {
                fieldsetClasses = 'advanced-filter';
                fields = (
                    <div>
                        <span>{this.translate('defaultCorparch__size_from')}: </span>
                        <MinSizeInput minSize={this.props.filters.minSize[0]} initWaitingFn={this.props.initWaitingFn} />
                        <span className="inline-label">{this.translate('defaultCorparch__size_to')}: </span>
                        <MaxSizeInput maxSize={this.props.filters.maxSize[0]} initWaitingFn={this.props.initWaitingFn} />
                        <span className="inline-label">{'(' +
                        this.translate('defaultCorparch__you_can_use_suffixes_size') + ')'}</span>
                        <p>
                            <span>
                            {this.translate('defaultCorparch__corpus_name_input_label')}: </span>
                            <NameSearchInput initialValue={this.props.filters.name[0]} initWaitingFn={this.props.initWaitingFn} />
                        </p>
                    </div>
                );

            } else {
                fieldsetClasses = 'advanced-filter closed';
                fields = null;
            }

            return (
                <fieldset className={fieldsetClasses}>
                    <legend onClick={this._handleLegendClick}>{this.translate('defaultCorparch__advanced_filters')}</legend>
                    {fields}
                </fieldset>
            );
        }
    });

    // -------------------------------- <FilterForm /> -----------------

    /**
     * Filter form root component
     */
    let FilterForm = React.createClass({

        mixins: mixins,

        _storeChangeHandler : function () {
            this.setState({isWaiting: false});
        },

        componentDidMount : function () {
            listStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            listStore.removeChangeListener(this._storeChangeHandler);
        },

        getInitialState : function () {
            return {isWaiting: false};
        },

        _initWaiting : function () {
            this.setState({isWaiting: true});
        },

        _renderLoader : function () {
            if (this.state.isWaiting) {
                return <img className="ajax-loader" src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={this.translate('global__loading')} title={this.translate('global__loading')} />;

            } else {
                return null;
            }
        },

        render: function () {
            return (
                <section className="inner">
                    <div>
                        <h3>{this.translate('defaultCorparch__filters')}</h3>
                        {this._renderLoader()}
                    </div>
                    <KeywordsField
                        keywords={this.props.keywords}
                        label={this.translate('defaultCorparch__keywords_field_label')}
                        initWaitingFn={this._initWaiting} />
                    <FilterInputFieldset
                        filters={this.props.filters}
                        initWaitingFn={this._initWaiting} />
                </section>
            )
        }
    });

    return {
        CorplistTable: CorplistTable,
        CorplistHeader: CorplistHeader,
        FilterForm: FilterForm,
        FavStar: FavStar,
        CorpKeywordLink: CorpKeywordLink
    };
}