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
import {Kontext} from '../../types/common';
import {InputModuleViews} from './input';
import {QueryType} from '../../models/query/common';
import {PluginInterfaces} from '../../types/plugins';
import { IActionDispatcher } from 'kombo';
import { List, Dict } from 'cnc-tskit';


export interface AlignedModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    inputViews:InputModuleViews;
}

export interface AlignedCorporaProps {
    availableCorpora:Array<{n:string; label:string}>;
    alignedCorpora:Array<string>;
    queryTypes:{[key:string]:QueryType};
    supportedWidgets:{[key:string]:Array<string>};
    wPoSList:Array<{n:string; v:string}>;
    lposValues:{[key:string]:string};
    matchCaseValues:{[key:string]:boolean};
    forcedAttr:string;
    defaultAttrValues:{[key:string]:string};
    attrList:Array<Kontext.AttrItem>;
    tagsetDocUrls:{[key:string]:string};
    pcqPosNegValues:{[key:string]:string};
    includeEmptyValues:{[key:string]:boolean};
    inputLanguages:{[key:string]:string};
    queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
    hasLemmaAttr:{[key:string]:boolean};
    useCQLEditor:boolean;
    tagHelperViews:{[key:string]:PluginInterfaces.TagHelper.View};
    onEnterKey:()=>void;
}

export interface AlignedViews {
    AlignedCorpora:React.SFC<AlignedCorporaProps>;
}

export function init({dispatcher, he, inputViews}:AlignedModuleArgs):AlignedViews {


    // ------------------ <AlignedCorpBlock /> -----------------------------
    /*
     TODO, important note: I had to define this component as stateful
     even if it has no state to prevent problems with React production
     build where React always re-render this component (even if props
     were the same, incl. object references). This has been causing
     loss of input/select/etc. focus when interacting with form elements
     inside this component. And this almost "formal" change helped.
     Maybe it's a React bug. It would be nice to isolate the error
     but the logic behind query form is already quite complicated so
     it would take same time.
     */
    class AlignedCorpBlock extends React.Component<{
        corpname:string;
        label:string;
        pcqPosNegValue:string;
        includeEmptyValue:boolean;
        queryType:QueryType;
        widgets:Array<string>;
        hasLemmaAttr:boolean;
        wPoSList:Array<{n:string; v:string}>;
        lposValue:string;
        matchCaseValue:boolean;
        forcedAttr:string;
        defaultAttr:string;
        attrList:Array<Kontext.AttrItem>;
        tagsetDocUrl:string;
        inputLanguage:string;
        queryStorageView:PluginInterfaces.QueryStorage.WidgetView;
        useCQLEditor:boolean;
        tagHelperView:PluginInterfaces.TagHelper.View;
        onEnterKey:()=>void;

    }, {}> {

        constructor(props) {
            super(props);
            this.handleCloseClick = this.handleCloseClick.bind(this);
            this.handleMakeMainClick = this.handleMakeMainClick.bind(this);
        }

        handleCloseClick() {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS',
                payload: {
                    corpname: this.props.corpname
                }
            });
        }

        handleMakeMainClick() {
            dispatcher.dispatch({
                name: 'QUERY_MAKE_CORPUS_PRIMARY',
                 payload: {
                    corpname: this.props.corpname
                }
            });
        }
        render() {
            return (
                <div className="AlignedCorpBlock">
                    <div className="heading">
                        <h3>{this.props.label}</h3>
                        <span className="icons">
                            <a className="make-primary" title={he.translate('query__make_corpus_primary')}
                                    onClick={this.handleMakeMainClick}>
                                <img src={he.createStaticUrl('img/make-main.svg')}
                                    alt={he.translate('query__make_corpus_primary')} />
                            </a>
                            <a className="close-button" title={he.translate('query__remove_corpus')}
                                    onClick={this.handleCloseClick}>
                                <img src={he.createStaticUrl('img/close-icon.svg')}
                                        alt={he.translate('query__close_icon')} />
                            </a>
                        </span>
                    </div>
                    <table className="form">
                        <tbody>
                            <inputViews.TRPcqPosNegField sourceId={this.props.corpname}
                                    value={this.props.pcqPosNegValue} formType="query" />
                            <inputViews.TRIncludeEmptySelector value={this.props.includeEmptyValue}
                                    corpname={this.props.corpname} />
                            <inputViews.TRQueryTypeField queryType={this.props.queryType}
                                    formType="query"
                                    sourceId={this.props.corpname}
                                    hasLemmaAttr={this.props.hasLemmaAttr} />
                            <inputViews.TRQueryInputField
                                sourceId={this.props.corpname}
                                queryType={this.props.queryType}
                                widgets={this.props.widgets}
                                wPoSList={this.props.wPoSList}
                                lposValue={this.props.lposValue}
                                matchCaseValue={this.props.matchCaseValue}
                                forcedAttr={this.props.forcedAttr}
                                defaultAttr={this.props.defaultAttr}
                                attrList={this.props.attrList}
                                tagsetDocUrl={this.props.tagsetDocUrl}
                                inputLanguage={this.props.inputLanguage}
                                queryStorageView={this.props.queryStorageView}
                                useCQLEditor={this.props.useCQLEditor}
                                onEnterKey={this.props.onEnterKey}
                                tagHelperView={this.props.tagHelperView} />
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    // ------------------ <AlignedCorpora /> -----------------------------

    const AlignedCorpora:React.SFC<AlignedCorporaProps> = (props) => {

        const handleAddAlignedCorpus = (evt) => {
            dispatcher.dispatch({
                name: 'QUERY_INPUT_ADD_ALIGNED_CORPUS',
                payload: {
                    corpname: evt.target.value
                }
            });
        };

        const findCorpusLabel = (corpname) => {
            const ans = props.availableCorpora.find(x => x.n === corpname);
            return ans ? ans.label : corpname;
        };

        const corpIsUnused = (corpname:string) => {
            return !List.some(v => v === corpname, props.alignedCorpora);
        };

        return (
            <fieldset className="parallel">
                <legend>
                    {he.translate('query__aligned_corpora_hd')}
                </legend>
                {props.alignedCorpora.map(item => <AlignedCorpBlock
                        key={item}
                        label={findCorpusLabel(item)}
                        corpname={item}
                        queryType={props.queryTypes[item]}
                        widgets={props.supportedWidgets[item]}
                        wPoSList={props.wPoSList}
                        lposValue={props.lposValues[item]}
                        matchCaseValue={props.matchCaseValues[item]}
                        forcedAttr={props.forcedAttr}
                        defaultAttr={props.defaultAttrValues[item]}
                        attrList={props.attrList}
                        tagsetDocUrl={props.tagsetDocUrls[item]}
                        tagHelperView={props.tagHelperViews[item]}
                        pcqPosNegValue={props.pcqPosNegValues[item]}
                        includeEmptyValue={props.includeEmptyValues[item]}
                        inputLanguage={props.inputLanguages[item]}
                        queryStorageView={props.queryStorageView}
                        hasLemmaAttr={props.hasLemmaAttr[item]}
                        useCQLEditor={props.useCQLEditor}
                        onEnterKey={props.onEnterKey} />
                )}
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
            </fieldset>
        );
    };


    return {
        AlignedCorpora: AlignedCorpora
    };

}