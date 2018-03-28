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
import * as Immutable from 'immutable';
import {Kontext} from '../../types/common';
import {init as inputInit} from './input';
import {InputModuleViews} from './input';
import {ActionDispatcher} from '../../app/dispatcher';
import {QueryModel, QueryHintModel, WidgetsMap} from '../../models/query/main';
import {WithinBuilderModel} from '../../models/query/withinBuilder';
import {VirtualKeyboardModel} from '../../models/query/virtualKeyboard';
import {CQLEditorModel} from '../../models/query/cqleditor/model';
import {PluginInterfaces} from '../../types/plugins';


export interface AlignedModuleArgs {
    dispatcher:ActionDispatcher;
    he:Kontext.ComponentHelpers;
    inputViews:InputModuleViews;
    queryModel:QueryModel;
    queryHintModel:QueryHintModel;
    withinBuilderModel:WithinBuilderModel;
    virtualKeyboardModel:VirtualKeyboardModel;
    cqlEditorModel:CQLEditorModel;
}

export interface AlignedCorporaProps {
    availableCorpora:Immutable.List<{n:string; label:string}>;
    alignedCorpora:Immutable.List<string>;
    queryTypes:Immutable.Map<string, string>;
    supportedWidgets:WidgetsMap;
    wPoSList:Immutable.List<{n:string; v:string}>;
    lposValues:Immutable.Map<string, string>;
    matchCaseValues:Immutable.Map<string, boolean>;
    forcedAttr:string;
    defaultAttrValues:Immutable.Map<string, string>;
    attrList:Immutable.List<Kontext.AttrItem>;
    tagsetDocUrls:Immutable.Map<string, string>;
    pcqPosNegValues:Immutable.Map<string, string>;
    inputLanguages:Immutable.Map<string, string>;
    queryStorageView:PluginInterfaces.QueryStorageWidgetView;
    hasLemmaAttr:Immutable.Map<string, boolean>;
    useCQLEditor:boolean;
    tagHelperView:PluginInterfaces.TagHelperView;
    onEnterKey:()=>void;
}

export interface AlignedViews {
    AlignedCorpora:React.SFC<AlignedCorporaProps>;
}

export function init({dispatcher, he, inputViews, queryModel, queryHintModel,
        withinBuilderModel, virtualKeyboardModel, cqlEditorModel}:AlignedModuleArgs):AlignedViews {

    // ------------------ <AlignedCorpBlock /> -----------------------------

    const AlignedCorpBlock:React.SFC<{
        corpname:string;
        label:string;
        pcqPosNegValue:string;
        queryType:string;
        widgets:Immutable.List<string>;
        hasLemmaAttr:boolean;
        wPoSList:Immutable.List<{n:string; v:string}>;
        lposValue:string;
        matchCaseValue:boolean;
        forcedAttr:string;
        defaultAttr:string;
        attrList:Immutable.List<Kontext.AttrItem>;
        tagsetDocUrl:string;
        inputLanguage:string;
        queryStorageView:PluginInterfaces.QueryStorageWidgetView;
        useCQLEditor:boolean;
        tagHelperView:PluginInterfaces.TagHelperView;
        onEnterKey:()=>void;

    }> = (props) => {

        const handleCloseClick = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS',
                props: {
                    corpname: props.corpname
                }
            });
        };

        const handleMakeMainClick = () => {
            dispatcher.dispatch({
                actionType: 'QUERY_MAKE_CORPUS_PRIMARY',
                 props: {
                    corpname: props.corpname
                }
            });
        };

        return (
            <div className="AlignedCorpBlock">
                <div className="heading">
                    <a className="make-primary" title={he.translate('query__make_corpus_primary')}
                            onClick={handleMakeMainClick}>
                        <img src={he.createStaticUrl('img/make-main.svg')}
                            alt={he.translate('query__make_corpus_primary')} />
                    </a>
                    <h3>{props.label}</h3>
                    <a className="close-button" title={he.translate('query__remove_corpus')}
                            onClick={handleCloseClick}>
                        <img src={he.createStaticUrl('img/close-icon.svg')}
                                alt={he.translate('query__close_icon')} />
                    </a>
                </div>
                <table className="form">
                    <tbody>
                        <inputViews.TRPcqPosNegField sourceId={props.corpname}
                                value={props.pcqPosNegValue} actionPrefix="" />
                        <inputViews.TRQueryTypeField queryType={props.queryType}
                                sourceId={props.corpname}
                                actionPrefix=""
                                hasLemmaAttr={props.hasLemmaAttr} />
                        <inputViews.TRQueryInputField
                            sourceId={props.corpname}
                            queryType={props.queryType}
                            widgets={props.widgets}
                            wPoSList={props.wPoSList}
                            lposValue={props.lposValue}
                            matchCaseValue={props.matchCaseValue}
                            forcedAttr={props.forcedAttr}
                            defaultAttr={props.defaultAttr}
                            attrList={props.attrList}
                            tagsetDocUrl={props.tagsetDocUrl}
                            inputLanguage={props.inputLanguage}
                            queryStorageView={props.queryStorageView}
                            actionPrefix=""
                            useCQLEditor={props.useCQLEditor}
                            onEnterKey={props.onEnterKey}
                            tagHelperView={props.tagHelperView} />
                    </tbody>
                </table>
            </div>
        );
    };

    // ------------------ <AlignedCorpora /> -----------------------------

    const AlignedCorpora:React.SFC<AlignedCorporaProps> = (props) => {

        const handleAddAlignedCorpus = (evt) => {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_ADD_ALIGNED_CORPUS',
                props: {
                    corpname: evt.target.value
                }
            });
        };

        const findCorpusLabel = (corpname) => {
            const ans = props.availableCorpora.find(x => x.n === corpname);
            return ans ? ans.label : corpname;
        };

        const corpIsUnused = (corpname) => {
            return !props.alignedCorpora.contains(corpname);
        };

        return (
            <fieldset className="parallel">
                <legend>
                    {he.translate('query__aligned_corpora_hd')}
                </legend>
                <div id="add-searched-lang-widget">
                    <select onChange={handleAddAlignedCorpus} value="">
                        <option value="" disabled={true}>
                            {`-- ${he.translate('query__add_a_corpus')} --`}</option>
                        {props.availableCorpora
                            .filter(item => corpIsUnused(item.n))
                            .map(item => {
                                return <option key={item.n} value={item.n}>{item.label}</option>;
                            })}
                    </select>
                </div>
                {props.alignedCorpora.map(item => {
                    return <AlignedCorpBlock
                            key={item}
                            label={findCorpusLabel(item)}
                            corpname={item}
                            queryType={props.queryTypes.get(item)}
                            widgets={props.supportedWidgets.get(item)}
                            wPoSList={props.wPoSList}
                            lposValue={props.lposValues.get(item)}
                            matchCaseValue={props.matchCaseValues.get(item)}
                            forcedAttr={props.forcedAttr}
                            defaultAttr={props.defaultAttrValues.get(item)}
                            attrList={props.attrList}
                            tagsetDocUrl={props.tagsetDocUrls.get(item)}
                            tagHelperView={props.tagHelperView}
                            pcqPosNegValue={props.pcqPosNegValues.get(item)}
                            inputLanguage={props.inputLanguages.get(item)}
                            queryStorageView={props.queryStorageView}
                            hasLemmaAttr={props.hasLemmaAttr.get(item)}
                            useCQLEditor={props.useCQLEditor}
                            onEnterKey={props.onEnterKey} />;
                })}
            </fieldset>
        );
    };


    return {
        AlignedCorpora: AlignedCorpora
    };

}