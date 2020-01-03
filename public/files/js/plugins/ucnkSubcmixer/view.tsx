/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
import { Kontext } from '../../types/common';
import { SubcMixerModel, SubcMixerExpression, CalculationResults, SubcMixerModelState } from './model';
import { init as subcorpViewsInit } from '../../views/subcorp/forms';
import { IActionDispatcher, BoundWithProps } from 'kombo';


export interface WidgetProps {
    isActive:boolean;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            subcMixerModel:SubcMixerModel):React.ComponentClass<WidgetProps, SubcMixerModelState> {

    const layoutViews = he.getLayoutViews();
    const subcFormViews = subcorpViewsInit({
        dispatcher: dispatcher,
        he: he,
        CorparchComponent: null,
        subcorpFormModel: null,
        subcorpWithinFormModel: null
    });

    // ------------ <CalculatedRatio /> -------------------------------------

    const CalculatedRatio:React.SFC<{
        ratio:number;
        success:boolean;
        limit:number;

    }> = (props) => {
        return <>
            {props.success ?
                null :
                <img className="warning" src={he.createStaticUrl('img/warning-icon.svg')} alt={he.translate('global__warning_icon')}
                            title={he.translate('ucnk_subc__condition_failed_{limit}', {limit: props.limit * 100})}/>
            }
            <strong>{he.formatNumber(props.ratio, 1) + '%'}</strong>
        </>;
    }

    // ------------ <ValueShareInput /> -------------------------------------

    const ValueShareInput:React.SFC<{
        hasResults:boolean;
        attrName:string;
        attrValue:string;
        ratio:Kontext.FormValue<string>;

    }> = (props) => {

        const handleRatioValueChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch({
                name: 'UCNK_SUBCMIXER_SET_RATIO',
                payload: {
                    attrName: props.attrName,
                    attrValue: props.attrValue,
                    ratio: evt.target.value
                }
            });
        };

        return (
            <span>
                <layoutViews.ValidatedItem invalid={props.ratio.isInvalid}>
                    <input type="text" className={props.hasResults ? ' disabled' : ''}
                        style={{width: '3em'}} value={props.ratio.value}
                        disabled={props.hasResults ? true : false}
                        onChange={handleRatioValueChange} />
                </layoutViews.ValidatedItem>
                {'\u00a0'}<strong>%</strong>
            </span>
        );
    }

    // ------------ <ValueShare /> -------------------------------------

    const ValueShare:React.SFC<{
        rowId:number;
        hasResults:boolean;
        attrName:string;
        attrValue:string;
        baseRatio:string;
        ratio:Kontext.FormValue<string>;
        result:[string, number, boolean];
        ratioLimit:number;

    }> = (props) => {

        return (
            <tr className="ucnkSyntaxViewer_ValueShare">
                <td className="num">{props.rowId}.</td>
                <td className="expression">
                    <strong>{props.attrName} = </strong>
                    {'\u0022' + props.attrValue + '\u0022'}
                </td>
                <td className="num">
                    {props.baseRatio}<strong>%</strong>
                </td>
                <td className="num">
                    <ValueShareInput hasResults={props.hasResults} attrName={props.attrName}
                            attrValue={props.attrValue} ratio={props.ratio} />
                </td>
                <td className="num">
                    {props.result ? <CalculatedRatio success={props.result[2]} limit={props.ratioLimit}
                                                ratio={props.result[1]} /> : <span>-</span>}
                </td>
            </tr>
        );
    };

    // ------------ <ValuesTable /> -------------------------------------

    const ValuesTable:React.SFC<{
        currentResult:CalculationResults;
        hasResults:boolean;
        items:Immutable.List<SubcMixerExpression>;
        ratioLimit:number;

    }> = (props) => {

        return (
            <table className="data subcmixer-ratios">
                <tbody>
                    <tr>
                        <th />
                        <th>{he.translate('ucnk_subc__ratios_th_expression')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_orig_ratio')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_required_ratio')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_calculated_ratio')}</th>
                    </tr>
                    {props.items.map((item, i) => (
                        <ValueShare key={i}
                                rowId={i + 1}
                                attrName={item.attrName}
                                hasResults={props.hasResults}
                                attrValue={item.attrValue}
                                baseRatio={item.baseRatio}
                                ratio={item.ratio}
                                result={props.currentResult ? props.currentResult['attrs'].get(i) : null}
                                ratioLimit={props.ratioLimit} />
                    ))}
                </tbody>
            </table>
        );
    };

    // ------------ <ReenterArgsButton /> -------------------------------------

    const ReenterArgsButton:React.SFC<{
        css:{[key:string]:string};

    }> = (props) => {

        const handleUpdateParamsButton = () => {
            dispatcher.dispatch({
                name: 'UCNK_SUBCMIXER_CLEAR_RESULT',
                payload: {}
            });
        };

        return (
            <button className="default-button" type="button"
                    style={props.css}
                    onClick={handleUpdateParamsButton}>
                {he.translate('ucnk_subc__modify_params_btn') + '\u2026'}
            </button>
        );
    };

    // ------------ <ResultsControls /> -------------------------------------

    const ResultsControls:React.SFC<{
        numOfErrors:number;
        totalSize:number;
        numConditions:number;
        currentSubcname:Kontext.FormValue<string>;
        isPublic:boolean;
        description:Kontext.FormValue<string>;

    }> = (props) => {

        const handleCreateSubcorpClick = () => {
            dispatcher.dispatch({
                name: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS',
                payload: {}
            });
        };

        const handleSubcnameInputChange = (evt) => {
            dispatcher.dispatch({
                name: 'SUBCORP_FORM_SET_SUBCNAME',
                payload: {
                    value: evt.target.value
                }
            });
        };

        const renderDesc = () => {
            if (props.numOfErrors === 0) {
                return (
                    <span>
                        <img className="icon"
                                src={he.createStaticUrl('img/info-icon.svg')}
                                alt={he.translate('global__info_icon')} />
                        {he.translate('ucnk_subc__subc_found_{size}',
                            {size: he.formatNumber(props.totalSize)})}
                    </span>
                );

            } else if (props.numOfErrors === props.numConditions) {
                return (
                    <span>
                        <img className="icon"
                                src={he.createStaticUrl('img/error-icon.svg')}
                                alt={he.translate('global__error_icon')} />
                        {he.translate('ucnk_subc__subc_not_found')}
                    </span>
                );

            } else {
                return he.translate('ucnk_subc__subc_found_with_errors{size}',
                        {size: he.formatNumber(props.totalSize)});
            }
        };

        const renderControls = () => {
            if (props.numOfErrors < props.numConditions) {
                return (
                    <div>
                        <p>
                            <label>
                                {he.translate('ucnk_subcm__new_subc_name')}:{'\u00a0'}
                                <layoutViews.ValidatedItem invalid={props.currentSubcname.isInvalid}>
                                    <input type="text" value={props.currentSubcname.value}
                                            onChange={handleSubcnameInputChange} />
                                </layoutViews.ValidatedItem>
                            </label>
                        </p>
                        <div>
                            {he.translate('subcform__set_as_public')}:
                            <layoutViews.InlineHelp customStyle={{width: '20em'}} noSuperscript={true}>
                                <p>{he.translate('subcform__publication_notes')}</p>
                                <p>{he.translate('subcform__publication_notes_2')}</p>
                            </layoutViews.InlineHelp>
                            <subcFormViews.SubcNamePublicCheckbox value={props.isPublic} />
                            {props.isPublic ?
                                (<div>
                                    <h3>{he.translate('subcform__public_description')}:</h3>
                                    <div>
                                        <subcFormViews.SubcDescription
                                            value={props.description} />
                                    </div>
                                </div>) : null
                            }
                        </div>
                        <p>
                            <button className="default-button" type="button"
                                    onClick={handleCreateSubcorpClick}>
                                {he.translate('ucnk_subcm__create_subc')}
                            </button>
                            <ReenterArgsButton css={{display: 'inline-block', marginLeft: '0.7em'}} />
                        </p>
                    </div>
                );

            } else {
                return <div><ReenterArgsButton css={{}} /></div>;
            }
        };

        return (
            <div>
                <p className="desc">
                    {renderDesc()}
                </p>
                {renderControls()}
            </div>
        );
    };

    // ------------ <Controls /> -------------------------------------

    const Controls:React.SFC<{
        isBusy:boolean;
        hasResults:boolean;
        totalSize:number;
        numOfErrors:number;
        numConditions:number;
        currentSubcname:Kontext.FormValue<string>;
        usedAttributes:Immutable.Set<string>;
        isPublic:boolean;
        description:Kontext.FormValue<string>;

    }> = (props) => {

        const handleCalculateCategoriesClick = () => {
            dispatcher.dispatch({
                name: 'UCNK_SUBCMIXER_SUBMIT_TASK',
                payload: {}
            });
        };

        const renderButtons = () => {
            if (props.isBusy) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                            alt={he.translate('global__calculating')} />;

            } else if (props.hasResults) {
                return <ResultsControls
                            totalSize={props.totalSize}
                            numOfErrors={props.numOfErrors}
                            numConditions={props.numConditions}
                            currentSubcname={props.currentSubcname}
                            isPublic={props.isPublic}
                            description={props.description} />;

            } else {
                return (
                    <div>
                        {props.usedAttributes.size > 1 ?
                            (<p className="attr-warning">
                                <img className="warning" src={he.createStaticUrl('img/warning-icon.svg')}
                                        alt={he.translate('global__warning_icon')} />
                                {he.translate('ucnk_subc__multiple_attrs_mixing_warning{attrs}',
                                    {attrs: props.usedAttributes.toArray().join(', ')})}
                            </p>)
                            : null}
                        <button className="default-button" type="button"
                                onClick={handleCalculateCategoriesClick}>
                            {he.translate('ucnk_subcm__calculate')}
                        </button>
                    </div>
                );
            }
        };

        return (
            <div className="controls">
                {renderButtons()}
            </div>
        );
    };

    // ------------ <SubcMixer /> -------------------------------------

    const SubcMixer:React.SFC<{
        selectedValues:Immutable.List<SubcMixerExpression>;
        currentResult:CalculationResults;
        numOfErrors:number;
        currentSubcname:Kontext.FormValue<string>;
        usedAttributes:Immutable.Set<string>;
        alignedCorpora:Immutable.List<string>;
        ratioLimit:number;
        closeClickHandler:()=>void;
        isBusy:boolean;
        isPublic:boolean;
        description:Kontext.FormValue<string>;
    }> = (props) => {

        const renderAlignedCorpInfo = () => {
            return (
                <p>
                    <img src={he.createStaticUrl('img/info-icon.svg')}
                            style={{width: '1em', marginRight: '0.3em', verticalAlign: 'middle'}}
                            alt={he.translate('global__info_icon')} />
                    {he.translate('ucnk_subcm__there_are_aligned_corpora_msg')}:{'\u00a0'}
                    <strong>{props.alignedCorpora.join(', ')}</strong>
                </p>
            );
        };

        const hasResults = !!props.currentResult;
        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.CloseableFrame onCloseClick={props.closeClickHandler}
                        customClass="subcmixer-widget"
                        label={he.translate('ucnk_subcm__widget_header')}>
                    <div>
                        {props.alignedCorpora.size > 0 ? renderAlignedCorpInfo() : null}
                        <ValuesTable items={props.selectedValues}
                                currentResult={props.currentResult}
                                hasResults={hasResults}
                                ratioLimit={props.ratioLimit} />
                        <Controls isBusy={props.isBusy}
                                hasResults={!!props.currentResult}
                                totalSize={props.currentResult ? props.currentResult['total'] : null}
                                numOfErrors={props.numOfErrors}
                                numConditions={props.selectedValues.size}
                                currentSubcname={props.currentSubcname}
                                usedAttributes={props.usedAttributes}
                                isPublic={props.isPublic}
                                description={props.description} />
                    </div>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }

    // ------------ <Widget /> -------------------------------------

    const Widget:React.SFC<WidgetProps & SubcMixerModelState> = (props) => {

        const handleCloseWidget = () => {
            dispatcher.dispatch({
                name: 'UCNK_SUBCMIXER_HIDE_WIDGET',
                payload: {}
            });
        };

        const handleActivationButton = () => {
            dispatcher.dispatch({
                name: 'UCNK_SUBCMIXER_SHOW_WIDGET'
            });
        }

        const renderButton = () => {
            if (props.isActive) {
                return (
                    <a className="trigger util-button"
                            title={he.translate('ucnk_subcm__set_shares')}
                            onClick={handleActivationButton}>
                        {he.translate('ucnk_subcm__define_proportions')}
                    </a>
                );

            } else {
                return (
                    <span className="util-button disabled"
                            title={he.translate('ucnk_subcm__currently_disabled_refine_to_enable')}>
                        {he.translate('ucnk_subcm__define_proportions')}
                    </span>
                );
            }
        };
        return (
            <div className="mixer-trigger">
                {renderButton()}
                {props.isVisible ?
                    <SubcMixer closeClickHandler={handleCloseWidget}
                            selectedValues={props.shares}
                            currentResult={props.currentResult}
                            numOfErrors={props.numOfErrors}
                            currentSubcname={props.currentSubcname}
                            usedAttributes={props.liveattrsSelections.keySeq().toSet()}
                            alignedCorpora={props.alignedCorpora}
                            ratioLimit={props.ratioLimit}
                            isBusy={props.isBusy}
                            isPublic={props.subcIsPublic}
                            description={props.subcDescription} />
                    : null}
            </div>
        );
    }

    return BoundWithProps<WidgetProps, SubcMixerModelState>(Widget, subcMixerModel);

}
