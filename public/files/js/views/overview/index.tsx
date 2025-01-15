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
import {BoundWithProps, IActionDispatcher} from 'kombo';
import * as Kontext from '../../types/kontext.js';
import { CorpusInfoType, CorpusInfo, CitationInfo, CorpusInfoModelState }
    from '../../models/common/corpusInfo.js';
import { init as subcOverviewInit } from '../subcorp/overview.js';
import { Actions } from '../../models/common/actions.js';
import * as S from './style.js';
import * as S2 from '../style.js';
import { List } from 'cnc-tskit';
import { CorpusInfoModel } from '../../models/common/corpusInfo.js';



export interface OverviewAreaProps {
    isLocalUiLang:boolean;
}


export interface CorpusInfoBoxProps {
    data:CorpusInfo;
    isWaiting:boolean;
    isLocalUiLang:boolean;
}


export interface OverviewViews {
    OverviewArea:React.ComponentClass<OverviewAreaProps>;
    CorpusInfoBox:React.FC<CorpusInfoBoxProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            corpusInfoModel:CorpusInfoModel):OverviewViews {

    const layoutViews = he.getLayoutViews();
    const SubcOverview = subcOverviewInit(he);

    // ---------------------------- <ItemAndNumRow /> -----------------------------

    const ItemAndNumRow:React.FC<{
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

    const AttributeList:React.FC<{
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

    const StructureList:React.FC<{
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

    // ----------------------  <CorpusInfoOverview /> ---------------

    const CorpusInfoOverview:React.FC<CorpusInfoBoxProps> = (props) => {

        const renderWebLink = () => {
            if (props.data.webUrl) {
                return <a href={props.data.webUrl} target="_blank" className="external">{props.data.webUrl}</a>;

            } else {
                return '-';
            }
        };

        const renderKeywords = () => {
            if (props.data.keywords.length > 0) {
                return props.data.keywords.map(kw =>
                    <span key={kw.name} className="keyword" style={{backgroundColor: kw.color}}>{kw.name}</span>
                );
            } else {
                return '-';
            }
        };

        const renderDescription = () => (
            props.data.description ? props.data.description : '-'
        );

        return (
            <dl>
            <dt>{he.translate('global__description')}:</dt>
            <dd>{renderDescription()}</dd>
            <dt>{he.translate('global__size')}:</dt>
            <dd>{he.formatNumber(props.data.size, 0)} {he.translate('global__positions')}
            </dd>
            <dt>{he.translate('global__website')}:</dt>
            <dd>{renderWebLink()}</dd>
            <dt>{he.translate('global__keywords')}:</dt>
            <dd>{renderKeywords()}</dd>
            </dl>
        )
    }

    // --------------------- <CorpusStructureAndMetadata /> ----------------

    const CorpusStructureAndMetadata:React.FC<CorpusInfoBoxProps> = (props) => (
        <div>
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

            <table className="tagset-list">
                <thead>
                    <tr>
                        <th colSpan={3} className="attrib-heading">
                            {he.translate('global__tagsets')}
                        </th>
                    </tr>
                    <tr className="col-headings">
                        <th>{he.translate('global__name')}</th>
                        <th>{he.translate('global__attribute')}</th>
                        <th>{he.translate('global__get_more_info')}</th>
                    </tr>
                </thead>
                <tbody>
                    {List.map(v => {
                        const url = props.isLocalUiLang ? v.docUrlLocal : v.docUrlEn;
                        return (
                            <tr key={`tagset:${v.ident}`}>
                                <td className="name">{v.ident}</td>
                                <td>"{v.featAttr}"</td>
                                <td>
                                    {url ? <a target="_blank" className="external" href={url}>{url}</a> : null}
                                </td>
                            </tr>
                        )
                    }, props.data.tagsets)}
                </tbody>
            </table>
        </div>
    );

    // ---------------------- <CitationInfo /> ---------------------------------------

    const CitationInfo:React.FC<CitationInfo> = (props) => (
        <div>
            <CorpusReference data={props} />
        </div>
    );

    // ---------------------- <CorpusInfoBox /> ------------------------------------

    const CorpusInfoBox:React.FC<CorpusInfoBoxProps> = (props) => {

        const items:Array<{id:'overview'|'structure'|'references'; label:string}> = [
            {id: 'overview', label: he.translate('global__corpus_info_overview')},
            {id: 'structure', label: he.translate('global__corpus_info_struct_and_metadata')},
            {id: 'references', label: he.translate('global__citation_info')}
        ];


        if (props.isWaiting) {
            return (
                <S.CorpusInfoBox>
                    <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader.gif')}
                        alt={he.translate('global__loading')} title={he.translate('global__loading')} />
                </S.CorpusInfoBox>
            );

        } else {
            return (
                <S.CorpusInfoBox>
                    <h2 className="corpus-name">{props.data.corpname}</h2>
                    <layoutViews.TabView
                            defaultId="overview"
                            callback={()=>undefined}
                            items={items}>
                        <CorpusInfoOverview {...props} />
                        <CorpusStructureAndMetadata {...props} />
                        <CitationInfo {...props.data.citationInfo} />
                    </layoutViews.TabView>
                </S.CorpusInfoBox>
            );
        }
    };

    // ---------------------- <CorpusReference /> ------------------------------------

    const CorpusReference:React.FC<{
        data:CitationInfo;

    }> = (props) => {
        if (props.data['article_ref'].length > 0 || props.data['default_ref']
                || props.data['other_bibliography']) {
            return (
                <S.CitationInfo>
                    <h4>
                        {he.translate('global__corpus_as_resource_{corpus}', {corpus: props.data.corpname})}
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
                </S.CitationInfo>
            );

        } else {
            return <S.CitationInfo className="empty-citation-info">{he.translate('global__no_citation_info')}</S.CitationInfo>
        }
    };

    // ----------------------------- <KeyboardShortcuts /> --------------------------

    const KeyboardShortcuts:React.FC<{}> = (props) => {
        return (
            <S2.KeyboardShortcuts>
                <h1>{he.translate('global__keyboard_shortcuts')}</h1>
                <h2>{he.translate('global__keyboard_conc_view_section')}</h2>
                <table>
                    <tbody>
                        <tr>
                            <th>
                                <span className="key-button">{'\u21E7'}</span>
                                <span className="key-button">h</span>
                                -
                            </th>
                            <td>{he.translate('global__key_shortcut_history')}</td>
                        </tr>
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
            </S2.KeyboardShortcuts>
        );
    };

    // ----------------------------- <OverviewArea /> --------------------------

    const OverviewArea:React.FC<CorpusInfoModelState & OverviewAreaProps> = (props) => {


        const handleCloseClick = () => {
            dispatcher.dispatch<typeof Actions.OverviewClose>({
                name: Actions.OverviewClose.name
            });
        }

        const renderInfo = () => {
            switch (props.currentInfoType) {
                case CorpusInfoType.CORPUS:
                    return <CorpusInfoBox
                            data={{...props.corpusData, type: CorpusInfoType.CORPUS}}
                            isWaiting={props.isWaiting} isLocalUiLang={props.isLocalUiLang} />;
                case CorpusInfoType.CITATION:
                    return <CorpusReference data={props.corpusData.citationInfo} />;
                case CorpusInfoType.SUBCORPUS:
                    return <SubcOverview data={props.subcorpusData} standalone={true} />;
                case CorpusInfoType.KEY_SHORTCUTS:
                    return <KeyboardShortcuts />;
                default:
                    return null;
            }
        }

        const renderInfoArea = () => {
            return props.currentInfoType ?
                <layoutViews.PopupBox customClass="centered"
                        onCloseClick={handleCloseClick} takeFocus={true}>
                    {renderInfo()}
                </layoutViews.PopupBox> :
                null;
        }

        return props.isWaiting ?
                <layoutViews.PopupBox customClass="centered"
                        onCloseClick={handleCloseClick}
                        takeFocus={true}>
                    <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader.gif')}
                            alt={he.translate('global__loading')} title={he.translate('global__loading')} />
                </layoutViews.PopupBox> :
                renderInfoArea();
    };


    return {
        OverviewArea: BoundWithProps<OverviewAreaProps, CorpusInfoModelState>(OverviewArea, corpusInfoModel),
        CorpusInfoBox
    };
}