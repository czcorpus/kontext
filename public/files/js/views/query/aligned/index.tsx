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
import { List, pipe, tuple } from 'cnc-tskit';
import { IActionDispatcher } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { InputModuleViews } from '../input';
import * as PluginInterfaces from '../../../types/plugins';
import { Actions } from '../../../models/query/actions';
import { Actions as GlobalActions } from '../../../models/common/actions';
import { AnyQuery } from '../../../models/query/query';
import * as S from './style';
import * as SC from '../style';


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
    const AlignedCorpBlock:React.FC<{
        corpname:string;
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
                <SC.ExpandableSectionLabel id="parallel-corpora-forms">
                    <layoutViews.ExpandButton isExpanded={props.sectionVisible} onClick={handleVisibilityChange} />
                    <a onClick={handleVisibilityChange}>
                        {he.translate('query__aligned_corpora_hd')}
                        {List.empty(props.alignedCorpora) || props.sectionVisible ?
                            null :
                            <>{':\u00a0'}<HeadingListOfAlignedCorpora
                                corpora={List.map(c => findCorpusLabel(c), props.alignedCorpora)} /></>
                        }
                    </a>

                </SC.ExpandableSectionLabel>
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
                <section className="AlignedCorporaLite">
                    <h2>
                        <layoutViews.ExpandButton isExpanded={props.alignedCorpora.length > 0} />
                        <span>{he.translate('query__aligned_corpora_hd')}</span>
                    </h2>
                    <div className="contents">
                        <table>
                            {List.map(
                                item => <tr>
                                    <td>{findCorpusLabel(item)}:</td>
                                    <td>{
                                        props.queries[item].queryHtml ?
                                        <span dangerouslySetInnerHTML={{__html: props.queries[item].queryHtml}}/> :
                                        "-- " + he.translate('qhistory__blank_query') +" --"
                                    }</td>
                                </tr>,
                                props.alignedCorpora
                            )}
                        </table>
                    </div>
                </section>
            );

        } else {
            return <section className="AlignedCorporaLite" />;
        }
    };

    return {
        AlignedCorpora,
        AlignedCorporaLite,
    };

}