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
import {IActionDispatcher} from 'kombo';
import {Kontext} from '../types/common';
import { CorpusInfoType, AnyOverviewInfo, SubcorpusInfo, CorpusInfo, CitationInfo } from '../models/common/layout';
import { Subscription } from 'rxjs';


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


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            corpusInfoModel:Kontext.ICorpusInfoModel):OverviewViews {

    const layoutViews = he.getLayoutViews();

    // ---------------------------- <ItemAndNumRow /> -----------------------------

    const ItemAndNumRow:React.SFC<{
        brackets:boolean;
        label:string;
        value:number;

    }> = (props) => {

        if (props.brackets) {
            return (
                <tr className="dynamic">
                    <th>&lt;{props.label}&gt;</th>
                    <td className="numeric">{he.formatNumber(props.value, 0)}</td>
                </tr>
            );

        } else {
            return (
                <tr className="dynamic">
                    <th>{props.label}</th>
                    <td className="numeric">{he.formatNumber(props.value, 0)}</td>
                </tr>
            );
        }
    };

    // ---------------------------- <AttributeList /> -----------------------------

    const AttributeList:React.SFC<{
        rows:Array<{name:string; size:number}>|{error:boolean};

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
        rows:Array<{name:string; size:number}>;

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
                    <h2 className="corpus-name">{props.data.corpname}</h2>
                    <dl>
                        <dt>{he.translate('global__description')}:</dt>
                        <dd>{props.data.description}</dd>
                        <dt>{he.translate('global__size')}:</dt>
                        <dd>{he.formatNumber(props.data.size, 0)} {he.translate('global__positions')}
                        </dd>
                        <dt>{he.translate('global__website')}:</dt>
                        <dd>{renderWebLink()}</dd>
                        <dt>{he.translate('global__keywords')}:</dt>
                        <dd>{
                            Object.entries(props.data.keywords).length === 0 ? "-" :
                            Object.entries(props.data.keywords).map(([k, v]) => <span className="keyword">{v}</span>)
                        }</dd>
                        <dt>{he.translate('global__corpus_info_metadata_heading')}:</dt>
                        <dd>
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
                            <strong>{he.translate('global__corp_info_attrs_remark_label')}: </strong>
                            {he.translate('global__corp_info_attrs_remark_text')}
                            </p>
                        </dd>
                        <dt>{he.translate('global__citation_info')}:</dt>
                        <dd className="references">
                            <CorpusReference data={props.data.citation_info} />
                        </dd>
                    </dl>
                </div>
            );
        }
    };

    // --------------------- <SubcorpusInfo /> -------------------------------------

    const SubcorpusInfo:React.SFC<{
        data:SubcorpusInfo;
    }> = (props) => {

        const getAccess = () => {
            if (props.data.subCorpusName !== props.data.origSubCorpusName) {
                return <>
                    {he.translate('global__published_subcorp')}
                    {'\u00a0'}
                    <span className="note">({he.translate('global__published_subcorp_id')}{':\u00a0'}
                    {props.data.subCorpusName})</span>
                </>;
            }
            return he.translate('global__subc_info_access_private');
        };

        return (
            <div className="SubcorpusInfo">
                <h2 className="subcorpus-name">
                    {props.data.corpusName}{'\u00a0/\u00a0'}<strong>{props.data.origSubCorpusName}</strong>
                </h2>

                <dl>
                    <dt>{he.translate('global__size_in_tokens')}:</dt>
                    <dd>{props.data.subCorpusSize}</dd>
                    <dt>{he.translate('global__subcorp_created_at')}:</dt>
                    <dd>{he.formatDate(new Date(props.data.created * 1000))}</dd>
                    {props.data.extended_info.cql ?
                        <>
                            <dt>{he.translate('global__subc_query')}:</dt>
                            <dd>
                                <textarea readOnly={true} value={props.data.extended_info.cql} style={{width: '100%'}} />
                            </dd>
                        </> :
                        null
                    }
                    <dt>{he.translate('global__subc_info_access_hd')}:</dt>
                    <dd>{getAccess()}</dd>
                    {props.data.description ?
                        <>
                            <dt>{he.translate('global__description')}:</dt>
                            <dd className="description">
                                <div className="html" dangerouslySetInnerHTML={{__html: props.data.description}} />
                            </dd>
                        </> :
                        null
                    }
                </dl>
            </div>
        );
    };

    // ---------------------- <CorpusReference /> ------------------------------------

    const CorpusReference:React.SFC<{
        data:CitationInfo;

    }> = (props) => {
        if (props.data['article_ref'].length > 0 || props.data['default_ref']
                || props.data['other_bibliography']) {
            return (
                <>
                    <h4>
                        {he.translate('global__corpus_as_resource_{corpus}', {corpus: props.data.corpname})}:
                    </h4>
                    <div className="html" dangerouslySetInnerHTML={{__html: props.data.default_ref}} />
                    {props.data.article_ref.length > 0 ?
                        (<>
                            <h4>{he.translate('global__references')}:</h4>
                            {props.data.article_ref.map((item, i) => {
                                return <div key={i} className="html" dangerouslySetInnerHTML={{__html: item }} />;
                            })}
                        </>) :
                        null}
                    {props.data.other_bibliography ?
                        (<>
                            <h4>{he.translate('global__general_references')}:</h4>
                            <div className="html" dangerouslySetInnerHTML={{__html: props.data.other_bibliography}} />
                        </>) :
                        null}
                </>
            );

        } else {
            return <div className="empty-citation-info">{he.translate('global__no_citation_info')}</div>
        }
    };

    // ----------------------------- <KeyboardShortcuts /> --------------------------

    const KeyboardShortcuts:React.SFC<{}> = (props) => {
        return (
            <div className="KeyboardShortcuts">
                <h1>{he.translate('global__keyboard_shortcuts')}</h1>
                <h2>{he.translate('global__keyboard_conc_view_section')}</h2>
                <table>
                    <tbody>
                        <tr>
                            <th>
                                <span className="key-button">{'\u21E7'}</span>
                                <span className="key-button">k</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_shortuts')}</td>
                        </tr>
                        <tr className="separ">
                            <td colSpan={2}><hr /></td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">f</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_filter')}</td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">s</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_sorting')}</td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">m</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_sample')}</td>
                        </tr>
                        <tr className="separ">
                        <td colSpan={2}><hr /></td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">{'\u21E7'}</span>
                                <span className="key-button">f</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_freq')}</td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">{'\u21E7'}</span>
                                <span className="key-button">c</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_colls')}</td>
                        </tr>
                        <tr className="separ">
                            <td colSpan={2}><hr /></td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">v</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_vmode')}</td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">e</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_toggle_extended_info')}</td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">{'\u21E7'}</span>
                                <span className="key-button">s</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_save')}</td>
                        </tr>
                        <tr className="separ">
                            <td colSpan={2}><hr /></td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">o</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_options')}</td>
                        </tr>
                        <tr>
                            <th>
                                <span className="key-button">{'\u21E7'}</span>
                                <span className="key-button">o</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_global_options')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    // ----------------------------- <OverviewArea /> --------------------------

    class OverviewArea extends React.Component<OverviewAreaProps, OverviewAreaState> {

        private modelSubscription:Subscription;

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
                name: 'OVERVIEW_CLOSE',
                payload: {}
            });
        }

        componentDidMount() {
            this.modelSubscription = corpusInfoModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
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