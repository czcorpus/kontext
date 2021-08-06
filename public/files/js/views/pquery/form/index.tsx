/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import { BoundWithProps, IActionDispatcher } from 'kombo';

import { Kontext } from '../../../types/common';
import { PqueryFormModel } from '../../../models/pquery/form';
import { Actions, ActionName } from '../../../models/pquery/actions';
import * as S from './style';
import * as QS from '../../query/input/style';
import * as SC from '../../query/style';
import { Dict, List } from 'cnc-tskit';
import { ConcStatus, ExpressionRoleType, PqueryAlignTypes, PqueryExpressionRoles, PqueryFormModelState } from '../../../models/pquery/common';
import { init as cqlEditoInit } from '../../query/cqlEditor';
import { AlignTypes } from '../../../models/freqs/twoDimension/common';
import { HtmlHelpModel, HtmlHelpModelState } from '../../../models/help/help';
import { Actions as HelpActions } from '../../../models/help/actions';
import { AdvancedFormFieldsetProps } from '../../query/input';

export interface PqueryFormViewsArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    model:PqueryFormModel;
    helpModel:HtmlHelpModel;
}

interface PqueryFormProps {
    corparchWidget:React.ComponentClass;
}

interface PqueryHelpProps {
}

export interface PqueryViews {
    PqueryForm:React.ComponentClass<PqueryFormProps>;
    PqueryHelp:React.ComponentClass<PqueryHelpProps>;
}

export function init({dispatcher, he, model, helpModel}:PqueryFormViewsArgs):PqueryViews {

    const layoutViews = he.getLayoutViews();
    const cqlEditorViews = cqlEditoInit(dispatcher, he, model);

    // ------------------- <PqueryInputTypeSymbol /> --------------------------------

    const PqueryInputTypeSymbol:React.FC<{
        roleType:PqueryExpressionRoles;
    }> = (props) => {
        switch (props.roleType) {
            case 'specification':
                return <S.PqueryInputTypeSpan title={he.translate('pquery__expression_role_specification')}>{'{\u2026}'}</S.PqueryInputTypeSpan>;
            case 'subset':
                return <S.PqueryInputTypeSpan title={he.translate('pquery__expression_role_never')}>{'!{\u2026}'}</S.PqueryInputTypeSpan>;
            case 'superset':
                return <S.PqueryInputTypeSpan title={he.translate('pquery__expression_role_always')}>{'?{\u2026}'}</S.PqueryInputTypeSpan>;
            default:
                return <span>??</span>;
        }
    };

    // ------------------- <AdvancedFormFieldsetDesc /> -----------------------------

    const AdvancedFormFieldsetDesc:React.FC<{
        html:string;
    }> = (props) => {

        const [opened, setOpened] = React.useState(false);

        const handleClick = () => {
            setOpened(!opened);
        }

        return (
            <QS.AdvancedFormFieldsetDesc>
                <a onClick={handleClick}><layoutViews.StatusIcon status="info" inline={true} /></a>
                {opened ?
                    <layoutViews.PopupBox onCloseClick={handleClick}>
                        <div className="html-code">
                            <div dangerouslySetInnerHTML={{__html: props.html}} />
                        </div>
                    </layoutViews.PopupBox> :
                    null
                }
            </QS.AdvancedFormFieldsetDesc>
        );
    };

    // ------------------- <AdvancedFormFieldset /> -----------------------------

    const AdvancedFormFieldset:React.FC<AdvancedFormFieldsetProps> = (props) => {

        const htmlClasses = [];
        htmlClasses.push(props.formVisible ? 'collapse' : 'expand');

        return (
            <QS.AdvancedFormFieldset className={`${props.isNested ? ' nested' : ''} ${props.htmlClass}${props.formVisible && props.htmlClass ? '' : ' closed'}`}
                    role="group" aria-labelledby={props.uniqId}>
                <SC.ExpandableSectionLabel id={props.uniqId}>
                    <layoutViews.ExpandButton isExpanded={props.formVisible} onClick={props.handleClick} />
                        <a onClick={props.handleClick}>{props.title}</a>
                    {props.formVisible ? null : props.closedStateHint}
                    {props.formVisible || !props.closedStateDesc ?
                        null :
                        <AdvancedFormFieldsetDesc html={props.closedStateDesc} />
                    }
                </SC.ExpandableSectionLabel>
                {props.formVisible ?
                    <div className="contents">
                        {props.children}
                    </div> :
                    null
                }
            </QS.AdvancedFormFieldset>
        );
    };

    // ---------------- <QueryStatusIcon /> --------------------------

    const QueryStatusIcon:React.FC<{
        sourceId:string;
        concLoadingStatus:ConcStatus|undefined;
        numQueries:number;

    }> = (props) => {

        const removeQueryHandler = (sourceId) => () => {
            dispatcher.dispatch<Actions.RemoveQueryItem>({
                name: ActionName.RemoveQueryItem,
                payload: {sourceId: sourceId}
            });
        };

        if (props.concLoadingStatus === 'none' && props.numQueries > 2) {
            return <layoutViews.DelItemIcon title={he.translate('pquery__remove_btn')}
                        onClick={removeQueryHandler(props.sourceId)} />;

        } else if (props.concLoadingStatus && props.concLoadingStatus === 'running') {
            return <layoutViews.AjaxLoaderBarImage htmlClass="loader"/>;

        } else if (props.concLoadingStatus && props.concLoadingStatus === 'finished') {
            return <span>{'\u2713'}</span>
        }
        return null;
    }

    // ------------ <EditorDiv /> -------------------------------------

    const EditorDiv:React.FC<{
        sourceId:string;
        corpname:string;
        useRichQueryEditor:boolean;
        numQueries:number;
        concStatus:ConcStatus;
        expressionRole:ExpressionRoleType;

    }> = (props) => {

        const handleExpressionRoleTypeChange = (evt) => {
            dispatcher.dispatch<Actions.SetExpressionRoleType>({
                name: ActionName.SetExpressionRoleType,
                payload: {sourceId: props.sourceId, value: evt.target.value}
            });
        };

        const handleExpressionRoleRatioChange = (evt) => {
            dispatcher.dispatch<Actions.SetExpressionRoleRatio>({
                name: ActionName.SetExpressionRoleRatio,
                payload: {
                    sourceId: props.sourceId,
                    value: evt.target.value
                }
            });
        };

        const queryInputElement = React.useRef();

        return (
            <QS.QueryArea>
                <S.QueryRowDiv>
                    <S.ExpressionRoleFieldset>
                        <PqueryInputTypeSymbol roleType={props.expressionRole.type} />
                        <select value={props.expressionRole.type} id={`roleType-${props.sourceId}`} onChange={handleExpressionRoleTypeChange}>
                            <option value="specification">{he.translate('pquery__expression_role_specification')}</option>
                            <option value="subset">{he.translate('pquery__expression_role_never')}</option>
                            <option value="superset">{he.translate('pquery__expression_role_always')}</option>
                        </select>
                        {props.expressionRole.type === 'specification' ? null :
                            <span>
                                <S.VerticalSeparator/>
                                <label htmlFor={`roleRatio-${props.sourceId}`}>{he.translate('pquery__expression_role_ratio')}</label>:{'\u00a0'}
                                <input id={`roleRatio-${props.sourceId}`}
                                        onChange={handleExpressionRoleRatioChange}
                                        value={props.expressionRole.maxNonMatchingRatio.value}
                                        className={props.expressionRole.maxNonMatchingRatio.isInvalid ? 'error' : null} />
                                {'\u00a0%'}
                            </span>
                        }
                    </S.ExpressionRoleFieldset>
                </S.QueryRowDiv>
                <S.QueryRowDiv>
                {props.useRichQueryEditor ?
                    <cqlEditorViews.CQLEditor
                            formType={Kontext.ConcFormTypes.QUERY}
                            sourceId={props.sourceId}
                            corpname={props.corpname}
                            takeFocus={false}
                            onReqHistory={() => undefined}
                            onEsc={() => undefined}
                            hasHistoryWidget={false}
                            historyIsVisible={false}
                            inputRef={queryInputElement} /> :
                    <cqlEditorViews.CQLEditorFallback
                            formType={Kontext.ConcFormTypes.QUERY}
                            sourceId={props.sourceId}
                            inputRef={queryInputElement}
                            onReqHistory={() => undefined}
                            onEsc={() => undefined}
                            hasHistoryWidget={false}
                            historyIsVisible={false} />
                    }
                    <QueryStatusIcon numQueries={props.numQueries}
                            concLoadingStatus={props.concStatus}
                            sourceId={props.sourceId} />
                </S.QueryRowDiv>
            </QS.QueryArea>
        );
    };

    // ---------------------- <PosAlignmentSelect /> ---------------------

    const PosAlignmentSelect:React.FC<{
        alignType:AlignTypes|PqueryAlignTypes
    }> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch<Actions.SetAlignType>({
                name: ActionName.SetAlignType,
                payload: {value: evt.target.value}
            });
        };

        return (
            <select className="kwic-alignment" value={props.alignType}
                    onChange={handleSelection}>
                <option value={AlignTypes.LEFT}>{he.translate('freq__align_type_left')}</option>
                <option value={AlignTypes.RIGHT}>{he.translate('freq__align_type_right')}</option>
                <option value={PqueryAlignTypes.WHOLE_KWIC}>{he.translate('pquery__align_type_whole_kwic')}</option>
            </select>
        );
    };

    // ---------------------- <PqueryForm /> ---------------------

    const PqueryForm:React.FC<PqueryFormModelState & PqueryFormProps> = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch<Actions.SubmitQuery>({
                name: ActionName.SubmitQuery,
                payload: {}
            });
        };

        const addQueryHandler = () => {
            dispatcher.dispatch<Actions.AddQueryItem>({
                name: ActionName.AddQueryItem,
                payload: {}
            });
        };

        const handleFreqChange = (e) => {
            dispatcher.dispatch<Actions.FreqChange>({
                name: ActionName.FreqChange,
                payload: {
                    value: e.target.value
                }
            });
        };

        const handleAttrChange = (e) => {
            dispatcher.dispatch<Actions.AttrChange>({
                name: ActionName.AttrChange,
                payload: {
                    value: e.target.value
                }
            });
        };

        const handleParamsFormVisibility = () => {
            dispatcher.dispatch<Actions.ParamsToggleForm>({
                name: ActionName.ParamsToggleForm
            });
        }

        const handleKwicRangeSelection = (left:number, right:number, inclKwic:boolean) => {
            dispatcher.dispatch<Actions.SetPositionIndex>({
                name: ActionName.SetPositionIndex,
                payload: {valueLeft: left, valueRight: right}
            });
        };

        const _renderMainFieldset = () => (
            <S.StylelessFieldset disabled={props.isBusy}>
                <S.EditorFieldset>
                    {Dict.mapEntries(
                        ([sourceId, query]) => (
                            <EditorDiv key={sourceId} sourceId={sourceId}
                                    concStatus={props.concWait[sourceId]} corpname={props.corpname}
                                    numQueries={Dict.size(props.queries)}
                                    useRichQueryEditor={props.useRichQueryEditor}
                                    expressionRole={query.expressionRole} />
                        ),
                        props.queries
                    )}
                    <button type="button" className="util-button add" onClick={addQueryHandler}>
                        <img src={he.createStaticUrl('img/plus.svg')} />
                        {he.translate('pquery__add_btn')}
                    </button>
                </S.EditorFieldset>

                <AdvancedFormFieldset
                    uniqId="section-pquery-params"
                    formVisible={props.paramsVisible}
                    title={he.translate('pquery__parameters_form')}
                    handleClick={handleParamsFormVisibility}
                >
                    <S.ParametersFieldset>
                        <S.ParameterField>
                            <label htmlFor="attr">{he.translate('pquery__attr_input')}:</label>
                            <select id="attr" value={props.attr} onChange={handleAttrChange}>
                                {List.map(item => <option key={item.n}>{item.n}</option>, props.attrs)}
                                {List.map(item => <option key={item.n}>{item.n}</option>, props.structAttrs)}
                            </select>
                        </S.ParameterField>
                        <S.MinFreqField>
                            <label htmlFor="freq">{he.translate('pquery__min_fq_input')}:</label>
                                <input id="freq" onChange={handleFreqChange} value={props.minFreq.value}
                                    className={props.minFreq.isInvalid ? 'error' : null} />
                        </S.MinFreqField>
                    </S.ParametersFieldset>
                    <S.ParametersFieldset>
                        <S.ParameterField>
                            <label htmlFor="pos">{he.translate('pquery__pos_input')}:</label>
                            <layoutViews.KwicRangeSelector
                                initialLeft={props.posLeft}
                                initialRight={props.posRight}
                                isKwicExcluded={false}
                                rangeSize={6}
                                onClick={handleKwicRangeSelection}>
                            </layoutViews.KwicRangeSelector>
                            <label htmlFor="align">{he.translate('pquery__node_start_at')}</label>
                            <PosAlignmentSelect alignType={props.posAlign}/>
                        </S.ParameterField>
                    </S.ParametersFieldset>
                </AdvancedFormFieldset>

                <S.BorderlessFieldset>
                    <button type="button" className="default-button submit" onClick={handleSubmit}>
                        {he.translate('query__search_btn')}
                    </button>
                    {props.isBusy ? <layoutViews.AjaxLoaderBarImage htmlClass="loader"/> : null}
                </S.BorderlessFieldset>
            </S.StylelessFieldset>
        );

        return (
            <S.PqueryFormSection>
                {props.corparchWidget ? <props.corparchWidget /> : null}
                <S.PqueryForm>
                    {_renderMainFieldset()}
                </S.PqueryForm>
            </S.PqueryFormSection>
        )
    };

    // ------------------- <PqueryHelp /> -----------------------------

    const PqueryHelp:React.FC<PqueryHelpProps & HtmlHelpModelState> = (props) => {

        const [visible, changeState] = React.useState(false);

        const toggleHelp = () => {
            if (!visible) {
                dispatcher.dispatch<typeof HelpActions.HelpRequested>({
                    name: HelpActions.HelpRequested.name,
                    payload: {
                        section: 'query'
                    }
                });
            };
            changeState(!visible);
        };

        return (
            <div className="QueryHelp topbar-help-icon">
                <a className="icon" onClick={toggleHelp}>
                    <layoutViews.ImgWithMouseover
                        htmlClass="over-img"
                        src={he.createStaticUrl('img/question-mark.svg')}
                        alt={he.translate('global__click_to_see_help')} />
                </a>
                {visible ?
                    <layoutViews.ModalOverlay onCloseKey={toggleHelp}>
                        <layoutViews.CloseableFrame onCloseClick={toggleHelp} label={he.translate('pquery__help')}>
                            <p>TODO</p>
                            <p>
                                <a className="external" href="https://trost.korpus.cz/~pavelv/para_dotaz/para-dotaz-sem.pdf" target="_blank">
                                    see a presentation
                                </a>
                            </p>
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay> :
                    null
                }
            </div>
        );
    };

    return {
        PqueryForm: BoundWithProps<PqueryFormProps, PqueryFormModelState>(PqueryForm, model),
        PqueryHelp: BoundWithProps<PqueryHelpProps, HtmlHelpModelState>(PqueryHelp, helpModel),
    }
}
