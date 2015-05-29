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

    lib.init = function (dispatcher, mixins, formStore, listStore) {

        // -------------------------- dataset components -----------------------

        var CorplistHeader = React.createClass({
            mixins: mixins,
            render: function () {
                return (<tr>
                    <th>{this.translate('Name')}</th>
                    <th>{this.translate('Size (in positions)')}</th>
                    <th>{this.translate('Labels')}</th>
                    <th>{this.translate('In favorites')}</th>
                    <th>{this.translate('Actions')}</th>
                </tr>);
            }
        });

        var CorplistRow = React.createClass({
            mixins: mixins,
            render: function () {
                var keywords = this.props.row.keywords.map(function (k, i) {
                    return <CorpKeywordLink key={i} keyword={k[0]} label={k[1]} />;
                });
                return (
                    <tr>
                        <td className="corpname"><a
                            href="first_form?corpname=$row.name">{this.props.row.name}</a></td>
                        <td className="num">{this.props.size}</td>
                        <td>
                            {keywords}
                        </td>
                        <td>
                            <input className="set-favorite" type="checkbox" value={this.props.row.id} />
                        </td>
                        <td>
                            <p className="desc" style={{display: 'none'}}>
                                <strong>${this.props.row.name}:</strong><br />
                                {this.props.row.desc}
                            </p>
                            <a className="detail">{this.translate('description')}</a> |
                            <a href="first_form?corpname=$row.id">{this.translate('use now')}</a>
                        </td>
                    </tr>
                );
            }
        });


        var CorplistTable = React.createClass({

            changeHandler: function () {
                this.setState(listStore.getData());
            },

            getInitialState: function () {
                return this.props;
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

                return (
                    <table className="data corplist" border="0">
                        <tbody>
                            <CorplistHeader />
                            {rows}
                        </tbody>
                    </table>
                );
            }
        });

        var CorpKeywordLink = React.createClass({
            render: function () {
                return (
                    <a className="keyword" href={"corplist?keyword="+this.props.keyword}
                       data-keyword-id={this.props.keyword}>{this.props.label}</a>
                );
            }
        });

        // -------------------------- form components -----------------------

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
                            ctrlKey: e.ctrlKey
                        }
                    });
                };
            },
            render: function () {
                if (!this.state.active) {
                    return (
                        <a className="keyword" href={"corplist?keyword="+this.props.keyword}
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
                return <a className="keyword reset" href="corplist"
                    onClick={this.handleClick}>{this.translate('None')}</a>;
            }
        });

        var KeywordsField = React.createClass({
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
                    </fieldset>
                );
            }
        });

        var FilterInputFieldset = React.createClass({
            mixins: mixins,
            render: function () {
                var hiddenInputs = this.props.currKeywords.map(function (v, i) {
                    return <input key={i} type="hidden" name="keyword" value={v} />;
                });
                return (
                    <fieldset>
                        <legend>{this.props.label}</legend>
                        {hiddenInputs}
                        {this.translate('size from')}:
                        <input className="min-max" type="text" name="min_size" value={this.minSize} />
                        {this.translate('to')}: <input className="min-max" type="text" name="max_size" value={this.maxSize} />
                        <button type="submit" className="default-button">{this.translate('Apply filter')}</button>
                    </fieldset>
                );
            }
        });

        var FilterForm = React.createClass({
            render: function () {
                return (
                    <div>
                        <KeywordsField
                            keywords={this.props.keywords}
                            label={this.props.keywordsFieldLabel} />
                        <FilterInputFieldset
                            currKeywords={this.props.currKeywords} />
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