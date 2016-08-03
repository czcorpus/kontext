/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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


export function init(dispatcher, mixins, corpusInfoStore, PopupBoxComponent) {

    // ---------------------------- <ItemAndNumRow /> -----------------------------

    const ItemAndNumRow = React.createClass({
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

    // ---------------------------- <ItemAndNumRow /> -----------------------------

    const AttributeList = React.createClass({
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
    let StructureList = React.createClass({
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

    // ---------------------- <CorpusInfoBox /> ------------------------------------

    let CorpusInfoBox = React.createClass({

        mixins: mixins,

        _renderWebLink() {
            if (this.props.data.web_url) {
                return <a href={this.props.data.web_url} target="_blank">{this.props.data.web_url}</a>;

            } else {
                return '-';
            }
        },

        render: function () {
            if (!this.props.data || !this.props.data.corpname) {
                return (
                    <div id="corpus-details-box">
                        <img className="ajax-loader" src={this.createStaticUrl('img/ajax-loader.gif')}
                            alt={this.translate('global__loading')} title={this.translate('global__loading')} />
                    </div>
                );

            } else {
                return (
                    <div id="corpus-details-box">
                        <div className="top">
                            <h2 className="corpus-name">{this.props.data.corpname}</h2>
                            <p className="corpus-description">{this.props.data.description}</p>
                            <p className="metadata">
                                <strong>{this.translate('global__size')}: </strong>
                                <span className="size">{this.props.data.size}</span> {this.translate('global__positions')}<br />

                                <strong className="web_url">{this.translate('global__website')}: </strong>
                                {this._renderWebLink()}
                            </p>
                        </div>

                        <h3>{this.translate('global__corpus_info_metadata_heading')}</h3>

                        <table className="structs-and-attrs">
                            <tbody>
                                <tr>
                                    <td>
                                        <AttributeList rows={this.props.data.attrlist} />
                                    </td>
                                    <td style={{paddingLeft: '4em'}}>
                                        <StructureList rows={this.props.data.structlist} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="note">{this.translate('global__remark_figures_denote_different_attributes')}</p>
                        <CorpusReference corpname={this.props.data.corpname}
                                data={this.props.data.citation_info} />
                    </div>
                );
            }
        }
    });

    // --------------------- <SubcorpusInfo /> -------------------------------------

    let SubcorpusInfo = React.createClass({

        mixins: mixins,

        render: function () {
            return (
                <div id="subcorpus-info-box">
                    <h2 className="subcorpus-name">
                    {this.props.data.corpusName}:<strong>{this.props.data.subCorpusName}</strong></h2>
                    <div className="item">
                        <strong>{this.translate('global__size_in_tokens')}:</strong>
                        {'\u00A0'}{this.props.data.subCorpusSize}
                    </div>
                    <div className="item">
                        <strong>{this.translate('global__subcorp_created_at')}:</strong>
                        {'\u00A0'}{this.props.data.created}
                    </div>
                    <div className="subc-query">
                        <h3>{this.translate('global__subc_query')}:</h3>
                        {
                            this.props.data.extended_info.cql ?
                            <textarea readOnly="true" value={this.props.data.extended_info.cql} style={{width: '100%'}} />
                            : <span>{this.translate('global__subc_def_not_avail')}</span>
                        }
                    </div>
                </div>
            );
        }
    });

    // ---------------------- <CorpusReference /> ------------------------------------

    let CorpusReference = React.createClass({

        mixins: mixins,

        render: function () {
            if (this.props.data['article_ref'] || this.props.data['default_ref']
                    || this.props.data['other_bibliography']) {
                return (
                    <div>
                        <h3>{this.translate('global__how_to_cite_corpus')}</h3>
                        <h4>
                            {this.translate('global__corpus_as_resource_{corpus}', {corpus: this.props.corpname})}
                        </h4>
                        <div dangerouslySetInnerHTML={{__html: this.props.data.default_ref}} />
                        {
                            this.props.data.article_ref
                            ?   <div>
                                    <h4>{this.translate('global__references')}</h4>
                                    <ul>
                                    {this.props.data.article_ref.map((item, i) => {
                                        return <li key={i} dangerouslySetInnerHTML={{__html: item }} />;
                                    })}
                                    </ul>
                                </div>
                            : null
                        }
                        {
                            this.props.data.other_bibliography
                            ? <div>
                                <h4>{this.translate('global__general_references')}</h4>
                                <div dangerouslySetInnerHTML={{__html: this.props.data.other_bibliography}} />
                                </div>
                            : null
                        }
                    </div>
                );

            } else {
                return <div className="empty-citation-info">{this.translate('global__no_citation_info')}</div>
            }
        }
    });

     // ----------------------------- <QueryOverivew /> --------------------------

    const QueryOverivew = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <div>
                    <h3>Query overview</h3>
                    <table>
                        <tbody>
                            <tr>
                                <th>Operation</th>
                                <th>Parameters</th>
                                <th>Num. of hits</th>
                                <th></th>
                            </tr>
                            {this.props.data.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.op}</td>
                                    <td>{item.arg}</td>
                                    <td>{item.size}</td>
                                    <td>
                                        <a href={this.createActionLink('view?' + item.tourl)}>
                                            {this.translate('global__view_result')}
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
    });

    // ----------------------------- <OverviewArea /> --------------------------

    const OverviewArea = React.createClass({

        mixins : mixins,

        _handleStoreChange : function () {
            this.setState({
                infoType: corpusInfoStore.getCurrentInfoType(),
                data: corpusInfoStore.getCurrentInfoData(),
                isLoading: corpusInfoStore.isLoading()
            });
        },

        componentDidMount : function () {
            corpusInfoStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            corpusInfoStore.removeChangeListener(this._handleStoreChange);
        },

        getInitialState : function () {
            return {
                infoType: corpusInfoStore.getCurrentInfoType(),
                data: corpusInfoStore.getCurrentInfoData(),
                isLoading: corpusInfoStore.isLoading()
            };
        },

        _handleCloseClick : function () {
            dispatcher.dispatch({
                actionType: 'OVERVIEW_CLOSE',
                props: {}
            });
        },

        _renderInfo : function () {
            switch (this.state.infoType) {
                case 'corpus-info':
                    return <CorpusInfoBox data={this.state.data} />;
                case 'citation-info':
                    return <CorpusReference data={this.state.data} />;
                case 'subcorpus-info':
                    return <SubcorpusInfo data={this.state.data} />;
                case 'query-info':
                    return <QueryOverivew data={this.state.data} />;
                default:
                    return null;
            }
        },

        _gethtmlClasses : function () {
            const ans = ['centered'];
            if (this.state.infoType === 'query-info') {
                ans.push('query-overview');
            }
            return ans.join(' ');
        },

        render : function () {
            const ans = this._renderInfo();
            if (this.state.isLoading) {
                return (
                    <PopupBoxComponent customClass={this._gethtmlClasses()}
                            onCloseClick={this._handleCloseClick}>
                        <img className="ajax-loader" src={this.createStaticUrl('img/ajax-loader.gif')}
                                alt={this.translate('global__loading')} title={this.translate('global__loading')} />
                    </PopupBoxComponent>
                );

            } else if (ans) {
                return (
                    <PopupBoxComponent customClass={this._gethtmlClasses()}
                            onCloseClick={this._handleCloseClick}>
                        {ans}
                    </PopupBoxComponent>
                );

            } else {
                return null;
            }
        }
    });


    return {
        OverviewArea: OverviewArea,
        CorpusInfoBox: CorpusInfoBox
    };
}