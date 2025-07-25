/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { List, pipe } from 'cnc-tskit';
import { IActionDispatcher } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { InputModuleViews } from '../input/index.js';
import * as PluginInterfaces from '../../../types/plugins/index.js';
import { Actions } from '../../../models/query/actions.js';
import { Actions as GlobalActions } from '../../../models/common/actions.js';
import { AnyQuery } from '../../../models/query/query.js';
import * as S from './style.js';
import * as SC from '../style.js';
import * as theme from '../../theme/default/index.js';


export interface AlignedModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    inputViews:InputModuleViews;
}

export interface AlignedCorporaProps {
    availableCorpora:Array<{n:string; label:string}>;
    sectionVisible:boolean;
    primaryCorpus:string; // do not confuse with the maincorp
    alignedCorpora:Array<string>;
    subcorpus:string|undefined;
    subcAligned:Array<string>;
    activeCorpus:string;
    queries:{[key:string]:AnyQuery};
    supportedWidgets:{[key:string]:Array<string>};
    wPoSList:Array<{n:string; v:string}>;
    lposValues:{[key:string]:string};
    forcedAttr:string;
    attrList:Array<Kontext.AttrItem>;
    inputLanguages:{[key:string]:string};
    hasLemmaAttr:{[key:string]:boolean};
    useRichQueryEditor:boolean;
    tagHelperViews:{[key:string]:PluginInterfaces.TagHelper.View};
    tagsets:{[key:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>};
    onEnterKey:()=>void;
}

export interface AlignedCorporaLiteProps {
    availableCorpora:Array<{n:string; label:string}>;
    alignedCorpora:Array<string>;
    queries:{[key:string]:AnyQuery};
}

export interface AlignedViews {
    AlignedCorpora:React.FC<AlignedCorporaProps>;
    AlignedCorporaLite:React.FC<AlignedCorporaLiteProps>;
}

export function init({dispatcher, he, inputViews}:AlignedModuleArgs):AlignedViews {

    const layoutViews = he.getLayoutViews();

    // -------------- <DisabledControlsWarn /> -----------------------------

    const DisabledControlsWarn:React.FC<{onClose:()=>void}> = ({onClose}) => {

        return (
            <layoutViews.ModalOverlay onCloseKey={onClose}>
                <layoutViews.CloseableFrame onCloseClick={onClose} label={he.translate('global__note_heading')}>
                    <p>{he.translate('query__subc_aligned_controls_disabled_explain')}</p>
                    <p>
                        <button type="button" className="default-button" onClick={onClose}>
                            {he.translate('global__ok')}
                        </button>
                    </p>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        )
    }

    // ------------------ <AlignedCorpBlock /> -----------------------------
    const AlignedCorpBlock:React.FC<{
        corpname:string;
        activeCorpus:string;
        queries:{[corpus:string]:AnyQuery};
        label:string;
        widgets:Array<string>;
        hasLemmaAttr:boolean;
        wPoSList:Array<{n:string; v:string}>;
        lposValue:string;
        forcedAttr:string;
        attrList:Array<Kontext.AttrItem>;
        inputLanguage:string;
        useRichQueryEditor:boolean;
        tagsets:Array<PluginInterfaces.TagHelper.TagsetInfo>;
        tagHelperView:PluginInterfaces.TagHelper.View;
        removeDisabled:boolean;
        onEnterKey:()=>void;
        onChangePrimaryCorp:(corp:string)=>void;
        onRemoveCorp:(corpname:string)=>void;

    }> = (props) => {

        const [warningVisible, setWarningVisible] = React.useState(false);

        const handleMakeMainClick = () => {
            props.onChangePrimaryCorp(props.corpname);
        };

        const handleDisabledClick = () => {
            setWarningVisible(true);
        };

        const handleWarningClose = () => {
            setWarningVisible(false);
        };

        return (
            <S.AlignedCorpBlock>
                <S.AlignedCorpBlockHeading>
                    {warningVisible ? <DisabledControlsWarn onClose={handleWarningClose} /> : null}
                    <h3>{props.label}</h3>
                    <span className="icons">
                        {props.removeDisabled ?
                            <>
                                <a
                                    className="make-primary disabled"
                                    title={he.translate('query__make_corpus_primary')}
                                    aria-disabled="true"
                                    onClick={handleDisabledClick}
                                    >
                                    <img src={he.createStaticUrl('img/make-main_grey.svg')}
                                        alt={he.translate('query__make_corpus_primary')} />
                                </a>
                                <a className="close-button disabled"
                                        aria-disabled="true"
                                        onClick={handleDisabledClick}>
                                    <img src={he.createStaticUrl('img/close-icon_grey.svg')}
                                            alt={he.translate('query__close_icon')} />
                                </a>
                            </> :
                            <>
                                <a className="make-primary" title={he.translate('query__make_corpus_primary')}
                                        onClick={handleMakeMainClick}>
                                    <img src={he.createStaticUrl('img/make-main.svg')}
                                        alt={he.translate('query__make_corpus_primary')} />
                                </a>
                                <a className="close-button" title={he.translate('query__remove_corpus')}
                                        onClick={()=>props.onRemoveCorp(props.corpname)}>
                                    <img src={he.createStaticUrl('img/close-icon.svg')}
                                            alt={he.translate('query__close_icon')} />
                                </a>
                            </>
                        }
                    </span>
                </S.AlignedCorpBlockHeading>
                <div className="form">
                    <inputViews.TRQueryInputField
                        sourceId={props.corpname}
                        corpname={props.corpname}
                        widgets={props.widgets}
                        wPoSList={props.wPoSList}
                        lposValue={props.lposValue}
                        forcedAttr={props.forcedAttr}
                        attrList={props.attrList}
                        inputLanguage={props.inputLanguage}
                        useRichQueryEditor={props.useRichQueryEditor}
                        onEnterKey={props.onEnterKey}
                        tagHelperView={props.tagHelperView}
                        tagsets={props.tagsets}
                        isSingleInstance={false}
                        hasFocus={props.activeCorpus === props.corpname}
                        qsuggPlugin={null}
                        isNested={true}
                        customOptions={[
                            <inputViews.TRPcqPosNegField sourceId={props.corpname}
                                span={2}
                                value={props.queries[props.corpname].pcq_pos_neg}
                                formType={Kontext.ConcFormTypes.QUERY} />,
                            <inputViews.TRIncludeEmptySelector
                                value={props.queries[props.corpname].include_empty}
                                corpname={props.corpname}
                                span={1} />
                        ]} />
                </div>
            </S.AlignedCorpBlock>
        );
    }

    // ------------------ <HeadingListOfAlignedCorpora /> ------------------

    const HeadingListOfAlignedCorpora:React.FC<{
        corpora:Array<string>;

    }> = (props) => {
        const maxVisibleItems = 3;
        const suff = props.corpora.length > maxVisibleItems ? ', \u2026' : '';
        return (
            <S.HeadingListOfAlignedCorpora>
            {pipe(
                props.corpora,
                List.slice(0, maxVisibleItems),
                List.map(v => <span key={`i:${v}`} className="corp">{v}</span>),
                List.join(i => <span key={`s:${i}`}>, </span>)
            )
            }{suff}
            </S.HeadingListOfAlignedCorpora>
        );
    };

    // ------------------ <AlignedCorpora /> -----------------------------

    const AlignedCorpora:React.FC<AlignedCorporaProps> = (props) => {

        const handleAddAlignedCorpus = (evt) => {
            dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                name: GlobalActions.SwitchCorpus.name,
                payload: {
                    corpora: pipe(
                        [props.primaryCorpus],
                        List.concat(props.alignedCorpora),
                        List.push(evt.target.value)
                    ),
                    subcorpus: props.subcorpus
                }
            });
        };

        const handleVisibilityChange = () => {
            dispatcher.dispatch<typeof Actions.QueryToggleAlignedCorpora>({
                name: Actions.QueryToggleAlignedCorpora.name
            });
        };

        const findCorpusLabel = (corpname) => {
            const ans = props.availableCorpora.find(x => x.n === corpname);
            return ans ? ans.label : corpname;
        };

        const corpIsUnused = (corpname:string) => {
            return !List.some(v => v === corpname, props.alignedCorpora);
        };

        const handleMainCorpChange = (corp:string) => {
            const newAligned = [...props.alignedCorpora];
            const chngPos = List.findIndex(v => v === corp, newAligned);
            if (chngPos > -1) {
                newAligned[chngPos] = props.primaryCorpus;
                dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                    name: GlobalActions.SwitchCorpus.name,
                    payload: {
                        corpora: List.unshift(corp, newAligned),
                        subcorpus: '',
                        newPrimaryCorpus: corp
                    }
                });
            }
        }

        const handleRemoveAlignedCorp = (corp:string) => {
            dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                name: GlobalActions.SwitchCorpus.name,
                payload: {
                    corpora: pipe(
                        props.alignedCorpora,
                        List.removeValue(corp),
                        List.unshift(props.primaryCorpus)
                    ),
                    subcorpus: props.subcorpus
                }
            });
        }

        return (
            <S.AlignedCorpora className={props.sectionVisible ? '' : ' closed'} role="group" aria-labelledby="parallel-corpora-forms">
                <theme.ExpandableSectionLabel id="parallel-corpora-forms">
                    <layoutViews.ExpandButton isExpanded={props.sectionVisible} onClick={handleVisibilityChange} />
                    <a onClick={handleVisibilityChange}>
                        {he.translate('query__aligned_corpora_hd')}
                        {List.empty(props.alignedCorpora) || props.sectionVisible ?
                            null :
                            <>{':\u00a0'}<HeadingListOfAlignedCorpora
                                corpora={List.map(c => findCorpusLabel(c), props.alignedCorpora)} /></>
                        }
                    </a>

                </theme.ExpandableSectionLabel>
                {props.sectionVisible ?
                    <>
                        {List.map(
                            item => <AlignedCorpBlock
                                key={item}
                                label={findCorpusLabel(item)}
                                corpname={item}
                                queries={props.queries}
                                widgets={props.supportedWidgets[item]}
                                wPoSList={props.wPoSList}
                                lposValue={props.lposValues[item]}
                                forcedAttr={props.forcedAttr}
                                attrList={props.attrList}
                                tagHelperView={props.tagHelperViews[item]}
                                activeCorpus={props.activeCorpus}
                                inputLanguage={props.inputLanguages[item]}
                                hasLemmaAttr={props.hasLemmaAttr[item]}
                                useRichQueryEditor={props.useRichQueryEditor}
                                tagsets={props.tagsets[item]}
                                removeDisabled={!!List.find(x => x === item, props.subcAligned)}
                                onEnterKey={props.onEnterKey}
                                onChangePrimaryCorp={handleMainCorpChange}
                                onRemoveCorp={handleRemoveAlignedCorp} />,
                            props.alignedCorpora
                        )}
                        {props.alignedCorpora.length < props.availableCorpora.length ?
                            <S.NewAlignedCorpBlock>
                                <S.AlignedCorpBlockHeading>
                                    <select onChange={handleAddAlignedCorpus} disabled={List.size(props.subcAligned) > 0} value="">
                                        <option value="" disabled={true}>
                                            {`-- ${he.translate('query__add_a_corpus')} --`}</option>
                                        {pipe(
                                            props.availableCorpora,
                                            List.filter(item => corpIsUnused(item.n)),
                                            List.map(item => {
                                                return <option key={item.n} value={item.n}>{item.label}</option>;
                                            })
                                        )}
                                    </select>
                                </S.AlignedCorpBlockHeading>
                            </S.NewAlignedCorpBlock> :
                            null
                        }
                    </> :
                    null
                }
            </S.AlignedCorpora>
        );
    };

    // ------------------ <AlignedCorporaLite /> -----------------------------

    const AlignedCorporaLite:React.FC<AlignedCorporaLiteProps> = (props) => {

        const findCorpusLabel = (corpname) => {
            const ans = props.availableCorpora.find(x => x.n === corpname);
            return ans ? ans.label : corpname;
        };

        if (props.alignedCorpora.length > 0) {
            return (
                <S.AlignedCorporaLite>
                    <theme.ExpandableSectionLabel>
                        <layoutViews.ExpandButton isExpanded={props.alignedCorpora.length > 0} />
                        <span>{he.translate('query__aligned_corpora_hd')}</span>
                    </theme.ExpandableSectionLabel>
                    <div className="contents">
                        <table className="parallel-queries">
                            <tbody>
                            {List.map(
                                (item, i) => (
                                    <tr key={`${i}:{item}`}>
                                        <th>{findCorpusLabel(item)}:</th>
                                        <td>{
                                            props.queries[item].queryHtml ?
                                            <SC.SyntaxHighlight dangerouslySetInnerHTML={{__html: props.queries[item].queryHtml}}/> :
                                            <pre>-- {he.translate('qhistory__blank_query')} --</pre>
                                        }</td>
                                    </tr>
                                ),
                                props.alignedCorpora
                            )}
                            </tbody>
                        </table>
                        <p className="hint note" style={{marginLeft: '1.5em'}}>
                            ({he.translate('query__aligned_queries_cannot_be_changed')})
                        </p>
                    </div>
                </S.AlignedCorporaLite>
            );

        } else {
            return <S.AlignedCorporaLite />;
        }
    };

    return {
        AlignedCorpora,
        AlignedCorporaLite,
    };

}