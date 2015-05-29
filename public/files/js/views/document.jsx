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
                            <th colSpan="2" className="attrib-heading">{this.translate('Attributes') }</th>
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
                            <th colSpan="2" className="attrib-heading">{this.translate('Structures')}</th>
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
            
            changeHandler: function () {
                this.setState(storeProvider.corpusInfoStore.getData());
            },

            getInitialState : function () {
                return {attrlist: [], structlist: [], size: null, description: null, url: null};
            },

            componentDidMount : function () {
                storeProvider.corpusInfoStore.addChangeListener(this.changeHandler);
                dispatcher.dispatch({
                    actionType: 'CORPUS_INFO_REQUIRED',
                    props: {}
                });
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

                return (
                    <div id="corpus-details-box">
                        <div className="top">
                            <h4 className="corpus-name">{this.state.corpname}</h4>

                            <p className="metadata">
                                <strong>{this.translate('size')}: </strong>
                                <span className="size">{this.state.size}</span> {this.translate('positions')}<br />

                                <strong className="web_url">{this.translate('website')}: </strong>
                                {webLink}
                            </p>
                        </div>
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
                        <p className="note">{this.translate('Remark: figures listed denote a number of different attributes / structures (i.e. types) in the corpus.')}</p>
                        <p className="corpus-description">{this.state.description}</p>
                    </div>
                );
            }
        });

        return {
            CorpusInfoBox: CorpusInfoBox
        };

    };

    return lib;
});