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

import * as React from 'react';
import {ActionDispatcher} from '../app/dispatcher';
import {Kontext} from '../types/common';
import { CorpusInfoModel, CorpusInfoType, AnyOverviewInfo, CorpusInfoResponse, SubcorpusInfo, CorpusInfo, CitationInfo } from '../models/common/layout';


export interface OverviewAreaProps {

}


interface OverviewAreaState {
    isLoading:boolean;
    data:AnyOverviewInfo;
}


export interface CorpusInfoBoxProps {
    data:CorpusInfo;
    isWaiting:boolean;
}


export interface OverviewViews {
    OverviewArea:React.ComponentClass<OverviewAreaProps>;
    CorpusInfoBox:React.SFC<CorpusInfoBoxProps>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers,
            corpusInfoModel:Kontext.ICorpusInfoModel):OverviewViews {

    const layoutViews = he.getLayoutViews();

    // ---------------------------- <ItemAndNumRow /> -----------------------------

    const ItemAndNumRow:React.SFC<{
        brackets:boolean;
        label:string;
        value:string;

    }> = (props) => {

        if (props.brackets) {
            return (
                <tr className="dynamic">
                    <th>&lt;{props.label}&gt;</th>
                    <td className="numeric">{props.value}</td>
                </tr>
            );

        } else {
            return (
                <tr className="dynamic">
                    <th>{props.label}</th>
                    <td className="numeric">{props.value}</td>
                </tr>
            );
        }
    };

    // ---------------------------- <AttributeList /> -----------------------------

    const AttributeList:React.SFC<{
        rows:Array<{name:string; size:string}>|{error:boolean};

    }> = (props) => {

        let values;

        if (Array.isArray(props.rows) && !props.rows['error']) {
            values = props.rows.map((row, i) =>
                    <ItemAndNumRow key={i} label={row.name} value={row.size} brackets={false} />);

        } else {
            values = <tr><td colSpan={2}>{he.translate('failed to load')}</td></tr>;
        }

        return (
            <table className="attrib-list">
                <tbody>
                <tr>
                    <th colSpan={2} className="attrib-heading">
                        {he.translate('global__attributes') }
                    </th>
                </tr>
                {values}
                </tbody>
            </table>
        );
    };

    // ---------------------------- <StructureList /> -----------------------------

    const StructureList:React.SFC<{
        rows:Array<{name:string; size:string}>;

    }> = (props) => {

        return (
            <table className="struct-list">
                <tbody>
                <tr>
                    <th colSpan={2} className="attrib-heading">{he.translate('global__structures')}</th>
                </tr>
                {props.rows.map((row, i) =>
                    <ItemAndNumRow key={i} brackets={true} label={row.name} value={row.size} />)}
                </tbody>
            </table>
        );
    };

    // ---------------------- <CorpusInfoBox /> ------------------------------------

    const CorpusInfoBox:React.SFC<CorpusInfoBoxProps> = (props) => {

        const renderWebLink = () => {
            if (props.data.web_url) {
                return <a href={props.data.web_url} target="_blank">{props.data.web_url}</a>;

            } else {
                return '-';
            }
        };

        if (props.isWaiting) {
            return (
                <div id="corpus-details-box">
                    <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader.gif')}
                        alt={he.translate('global__loading')} title={he.translate('global__loading')} />
                </div>
            );

        } else {
            return (
                <div id="corpus-details-box">
                    <div className="top">
                        <h2 className="corpus-name">{props.data.corpname}</h2>
                        <p className="corpus-description">{props.data.description}</p>
                        <p className="metadata">
                            <strong>{he.translate('global__size')}: </strong>
                            <span className="size">{props.data.size}</span> {he.translate('global__positions')}<br />

                            <strong className="web_url">{he.translate('global__website')}: </strong>
                            {renderWebLink()}
                        </p>
                    </div>

                    <h3>{he.translate('global__corpus_info_metadata_heading')}</h3>

                    <table className="structs-and-attrs">
                        <tbody>
                            <tr>
                                <td>
                                    <AttributeList rows={props.data.attrlist} />
                                </td>
                                <td style={{paddingLeft: '4em'}}>
                                    <StructureList rows={props.data.structlist} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="note">
                        {he.translate('global__remark_figures_denote_different_attributes')}
                    </p>
                    <CorpusReference data={props.data.citation_info} />
                </div>
            );
        }
    };

    // --------------------- <SubcorpusInfo /> -------------------------------------

    const SubcorpusInfo:React.SFC<{
        data:SubcorpusInfo;
    }> = (props) => {

        const getName = () => {
            if (props.data.subCorpusName !== props.data.origSubCorpusName) {
                return `${props.data.origSubCorpusName}(${props.data.subCorpusName})`;
            }
            return props.data.subCorpusName;
        };

        return (
            <div id="subcorpus-info-box">
                <h2 className="subcorpus-name">
                {props.data.corpusName}:<strong>{getName()}</strong></h2>
                <div className="item">
                    <strong>{he.translate('global__size_in_tokens')}:</strong>
                    {'\u00A0'}{props.data.subCorpusSize}
                </div>
                <div className="item">
                    <strong>{he.translate('global__subcorp_created_at')}:</strong>
                    {'\u00A0'}{props.data.created}
                </div>
                <div className="subc-query">
                    <h3>{he.translate('global__subc_query')}:</h3>
                    {
                        props.data.extended_info.cql ?
                        <textarea readOnly={true} value={props.data.extended_info.cql} style={{width: '100%'}} />
                        : <span>{he.translate('global__subc_def_not_avail')}</span>
                    }
                </div>
                {props.data.description ?
                    <div className="description">
                        <h3>{he.translate('global__description')}:</h3>
                        <div className="html" dangerouslySetInnerHTML={{__html: props.data.description}} />
                    </div> : null
                }
            </div>
        );
    };

    // ---------------------- <CorpusReference /> ------------------------------------

    const CorpusReference:React.SFC<{
        data:CitationInfo;

    }> = (props) => {

        if (props.data['article_ref'] || props.data['default_ref']
                || props.data['other_bibliography']) {
            return (
                <div>
                    <h3>{he.translate('global__how_to_cite_corpus')}</h3>
                    <h4>
                        {he.translate('global__corpus_as_resource_{corpus}', {corpus: props.data.corpname})}
                    </h4>
                    <div dangerouslySetInnerHTML={{__html: props.data.default_ref}} />
                    {props.data.article_ref ?
                        (<div>
                            <h4>{he.translate('global__references')}</h4>
                            <ul>
                            {props.data.article_ref.map((item, i) => {
                                return <li key={i} dangerouslySetInnerHTML={{__html: item }} />;
                            })}
                            </ul>
                        </div>) :
                        null}
                    {props.data.other_bibliography ?
                        (<div>
                            <h4>{he.translate('global__general_references')}</h4>
                            <div dangerouslySetInnerHTML={{__html: props.data.other_bibliography}} />
                        </div>) :
                        null}
                </div>
            );

        } else {
            return <div className="empty-citation-info">{he.translate('global__no_citation_info')}</div>
        }
    };

    // ----------------------------- <KeyboardShortcuts /> --------------------------

    const KeyboardShortcuts:React.SFC<{}> = (props) => {
        return (
            <div className="KeyboardShortcuts">
                <h2>{he.translate('global__keyboard_conc_view_section')}</h2>
                <table>
                    <tbody>
                        <tr>
                            <th><span className="key-button">s</span> - </th>
                            <td>{he.translate('global__key_shortcut_save')}</td>
                        </tr>
                        <tr>
                            <th><span className="key-button">i</span> - </th>
                            <td>{he.translate('global__key_shortcut_filter')}</td>
                        </tr>
                        <tr>
                            <th><span className="key-button">r</span> - </th>
                            <td>{he.translate('global__key_shortcut_sorting')}</td>
                        </tr>
                        <tr>
                            <th><span className="key-button">m</span> - </th>
                            <td>{he.translate('global__key_shortcut_sample')}</td>
                        </tr>
                        <tr>
                            <th><span className="key-button">o</span> - </th>
                            <td>{he.translate('global__key_shortcut_options')}</td>
                        </tr>
                        <tr>
                            <th><span className="key-button">f</span> - </th>
                            <td>{he.translate('global__key_shortcut_freq')}</td>
                        </tr>
                        <tr>
                            <th><span className="key-button">c</span> - </th>
                            <td>{he.translate('global__key_shortcut_colls')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    // ----------------------------- <OverviewArea /> --------------------------

    class OverviewArea extends React.Component<OverviewAreaProps, OverviewAreaState> {

        constructor(props) {
            super(props);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleCloseClick = this._handleCloseClick.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                data: corpusInfoModel.getCurrentInfoData(),
                isLoading: corpusInfoModel.isLoading()
            };
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                actionType: 'OVERVIEW_CLOSE',
                props: {}
            });
        }

        componentDidMount() {
            corpusInfoModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            corpusInfoModel.removeChangeListener(this._handleModelChange);
        }

        _renderInfo() {
            if (this.state.data) {
                switch (this.state.data.type) {
                    case CorpusInfoType.CORPUS:
                        return <CorpusInfoBox data={this.state.data} isWaiting={this.state.isLoading} />;
                    case CorpusInfoType.CITATION:
                        return <CorpusReference data={this.state.data} />;
                    case CorpusInfoType.SUBCORPUS:
                        return <SubcorpusInfo data={this.state.data} />;
                    case CorpusInfoType.KEY_SHORTCUTS:
                        return <KeyboardShortcuts />;
                }
            }
            return null;
        }

        render() {
            const ans = this._renderInfo();
            if (this.state.isLoading) {
                return (
                    <layoutViews.PopupBox customClass="centered"
                            onCloseClick={this._handleCloseClick}
                            takeFocus={true}>
                        <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader.gif')}
                                alt={he.translate('global__loading')} title={he.translate('global__loading')} />
                    </layoutViews.PopupBox>
                );

            } else if (ans) {
                return (
                    <layoutViews.PopupBox customClass="centered"
                            onCloseClick={this._handleCloseClick} takeFocus={true}>
                        {ans}
                    </layoutViews.PopupBox>
                );

            } else {
                return null;
            }
        }
    }


    return {
        OverviewArea: OverviewArea,
        CorpusInfoBox: CorpusInfoBox
    };
}