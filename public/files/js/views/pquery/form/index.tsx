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
import { Dict, List } from 'cnc-tskit';
import { ConcStatus, PqueryFormModelState } from '../../../models/pquery/common';
import { init as cqlEditoInit } from '../../query/cqlEditor';
import { AlignTypes } from '../../../models/freqs/twoDimension/common';

export interface PqueryFormViewsArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    model:PqueryFormModel;
}

interface PqueryFormProps {
    corparchWidget:React.ComponentClass;
}


export function init({dispatcher, he, model}:PqueryFormViewsArgs):React.ComponentClass<{
    corparchWidget:React.ComponentClass
}> {
    const layoutViews = he.getLayoutViews();
    const cqlEditorViews = cqlEditoInit(dispatcher, he, model);


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

    }> = (props) => {

        const queryInputElement = React.useRef();

        return (
            <QS.QueryArea>
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


    // ---------------------- <PositionSelect /> ---------------------

    const PositionSelect:React.FC<{
        positionIndex:number;
        positionRangeLabels:Array<string>;
    }> = (props) => {

        const handleSelection = (evt) => {
            dispatcher.dispatch<Actions.SetPositionIndex>({
                name: ActionName.SetPositionIndex,
                payload: {value: evt.target.value}
            });
        };

        return (
            <select onChange={handleSelection} value={props.positionIndex}>
                {props.positionRangeLabels.map((item, i) => {
                    return <option key={`opt_${i}`} value={i}>{item}</option>;
                })}
            </select>
        );
    };


    // ---------------------- <PosAlignmentSelect /> ---------------------

    const PosAlignmentSelect:React.FC<{
        alignType:AlignTypes
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

        const _renderMainFieldset = () => (
            <S.StylelessFieldset disabled={props.isBusy}>
                <S.EditorFieldset>
                    {Dict.mapEntries(
                        ([sourceId,]) => (
                            <EditorDiv key={sourceId} sourceId={sourceId}
                                    concStatus={props.concWait[sourceId]} corpname={props.corpname}
                                    numQueries={Dict.size(props.queries)}
                                    useRichQueryEditor={props.useRichQueryEditor} />
                        ),
                        props.queries
                    )}
                    <button type="button" className="util-button add" onClick={addQueryHandler}>
                        <img src={he.createStaticUrl('img/plus.svg')} />
                        {he.translate('pquery__add_btn')}
                    </button>
                </S.EditorFieldset>
                <S.ParametersFieldset>
                    <S.ParameterField>
                        <label htmlFor="attr">{he.translate('pquery__attr_input')}:</label>
                        <select id="attr" value={props.attr} onChange={handleAttrChange}>
                            {List.map(item => <option key={item.n}>{item.n}</option>, props.attrs)}
                            {List.map(item => <option key={item.n}>{item.n}</option>, props.structAttrs)}
                        </select>
                    </S.ParameterField>
                    <S.ParameterField>
                        <label htmlFor="freq">{he.translate('pquery__min_fq_input')}:</label>
                        <input id="freq" onChange={handleFreqChange} value={props.minFreq}/>
                    </S.ParameterField>
                    <S.ParameterField>
                        <label htmlFor="pos">{he.translate('pquery__pos_input')}:</label>
                        <PositionSelect positionIndex={props.posIndex} positionRangeLabels={model.getPositionRangeLabels()}/>
                        <label htmlFor="align">{he.translate('pquery__node_start_at')}</label>
                        <PosAlignmentSelect alignType={props.posAlign}/>
                    </S.ParameterField>
                </S.ParametersFieldset>
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
                <props.corparchWidget />
                <S.PqueryForm>
                    {props.receivedResults ?
                        <layoutViews.ExpandableArea initialExpanded={false} label={he.translate('pquery__query_form_hd')}>
                            <fieldset>
                                {_renderMainFieldset()}
                            </fieldset>
                        </layoutViews.ExpandableArea> :
                        _renderMainFieldset()
                    }
                </S.PqueryForm>
            </S.PqueryFormSection>
        )
    };

    return BoundWithProps<PqueryFormProps, PqueryFormModelState>(PqueryForm, model);
}
