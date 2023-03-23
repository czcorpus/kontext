/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as Kontext from '../../../types/kontext';
import { Dict, List, Maths, pipe } from 'cnc-tskit';
import { init as dataRowsInit } from '../dataRows';
import { init as initSaveViews } from './save';
import { init as initChartViews } from '../charts';
import { init as initFreqCommonViews } from '../common';
import { FreqDataRowsModel } from '../../../models/freqs/regular/table';
import { IActionDispatcher, BoundWithProps, Bound } from 'kombo';
import { Actions } from '../../../models/freqs/regular/actions';
import * as S from './style';
import { FreqChartsModel } from '../../../models/freqs/regular/freqCharts';
import { FreqDataRowsModelState, FreqViewProps, isEmptyResultBlock } from '../../../models/freqs/regular/common';
import { alphaToCoeffFormatter, FreqResultViews } from '../../../models/freqs/common';
import { FreqChartsSaveFormModel } from '../../../models/freqs/regular/saveChart';
import { FreqResultsSaveModel } from '../../../models/freqs/regular/save';
import { TabWrapperModel, TabWrapperModelState } from '../../../models/freqs/regular/tabs';

// --------------------------- exported types --------------------------------------


// ------------------------ factory --------------------------------

export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers,
        freqChartsModel:FreqChartsModel,
        freqChartsSaveModel:FreqChartsSaveFormModel,
        freqDataRowsModel:FreqDataRowsModel,
        freqTableSaveModel:FreqResultsSaveModel,
        tabSwitchModel:TabWrapperModel
) {
    const globalComponents = he.getLayoutViews();
    const drViews = dataRowsInit(dispatcher, he);
    const chartViews = initChartViews(
        dispatcher, he, freqChartsModel, freqChartsSaveModel);
    const saveViews = initSaveViews(dispatcher, he, freqTableSaveModel);
    const alphaToCoeff = alphaToCoeffFormatter(he);
    const {ShareLinkWidget} = initFreqCommonViews(dispatcher, he);


    // ----------------------- <Paginator /> -------------------------

    interface PaginatorProps {
        isLoading:boolean;
        currentPage:string;
        totalPages:number;
        totalItems:number;
        sourceId:string;
        shareLink:string|null;
        email:string;
        shareWidgetIsBusy:boolean;
        onShowShare:(sourceId:string)=>void;
        onHideShare:()=>void;
    }

    const Paginator:React.FC<PaginatorProps> = (props) => {

        const handlePageChange = (value:string) => {
            dispatcher.dispatch<typeof Actions.ResultSetCurrentPage>({
                name: Actions.ResultSetCurrentPage.name,
                payload: {
                    value: value,
                    sourceId: props.sourceId,
                }
            });
        };

        const shareIcon = <img
            src={he.createStaticUrl('img/share.svg')}
            alt="share"
            style={{width: '1em'}} />;

        return (
            <S.FreqPaginator className="ktx-pagination">
                <globalComponents.SimplePaginator
                    isLoading={props.isLoading}
                    currentPage={props.currentPage}
                    totalPages={props.totalPages}
                    handlePageChange={handlePageChange} />
                <div className="desc">
                    ({he.translate('freq__avail_label')}:{'\u00a0'}
                    {he.translate('freq__avail_items_{num_items}', {num_items: props.totalItems})})
                </div>
                <div className="share">
                    <label>{he.translate('freq__share_table')}:</label>
                    <a onClick={()=>props.onShowShare(props.sourceId)}>
                        <globalComponents.ImgWithMouseover
                                style={{width: '1em', verticalAlign: 'middle'}}
                                src={he.createStaticUrl('img/share.svg')}
                                alt={he.translate('freq__share_table')}
                                title={he.translate('freq__share_table')} />
                    </a>
                </div>
                { props.shareLink ?
                    <globalComponents.ModalOverlay onCloseKey={props.onHideShare}>
                        <globalComponents.CloseableFrame
                                onCloseClick={props.onHideShare}
                                label={he.translate('freq__share_table')}
                                icon={shareIcon}>
                            <ShareLinkWidget
                                    sourceId={props.sourceId}
                                    url={props.shareLink}
                                    isBusy={props.shareWidgetIsBusy}
                                    email={props.email} />
                        </globalComponents.CloseableFrame>
                    </globalComponents.ModalOverlay> : null
                }

            </S.FreqPaginator>
        );
    };

    // ----------------------- <MinFreqInput /> -------------------------

    const MinFreqInput:React.FC<{
        minFreqVal:Kontext.FormValue<string>;

    }> = ({minFreqVal}) => {

        const handleInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<typeof Actions.ResultSetMinFreqVal>({
                name: Actions.ResultSetMinFreqVal.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <S.MinFreqInputLabel>
                {he.translate('freq__limit_input_label')}:
                {'\u00a0'}
                <input type="text" name="flimit"
                        className={minFreqVal.isInvalid ? 'invalid' : null}
                        value={minFreqVal.value}
                        style={{width: '3em'}}
                        onChange={handleInputChange} />
            </S.MinFreqInputLabel>
        );
    };

    // ----------------------- <ConfidenceLevelSelector /> ------------

    const ConfidenceLevelSelector:React.FC<{
        value: Maths.AlphaLevel;

    }> = ({value}) => {

        const handleChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch<typeof Actions.ResultSetAlphaLevel>({
                name: Actions.ResultSetAlphaLevel.name,
                payload: {
                    value: evt.target.value as Maths.AlphaLevel
                }
            });
        }

        return (
            <label>
                {he.translate('freq__ct_conf_level_label')}:
                {'\u00a0'}
                <select value={value} onChange={handleChange}>
                    <option value={Maths.AlphaLevel.LEVEL_1}>{alphaToCoeff(Maths.AlphaLevel.LEVEL_1)}%</option>
                    <option value={Maths.AlphaLevel.LEVEL_5}>{alphaToCoeff(Maths.AlphaLevel.LEVEL_5)}%</option>
                    <option value={Maths.AlphaLevel.LEVEL_10}>{alphaToCoeff(Maths.AlphaLevel.LEVEL_10)}%</option>
                </select>
            </label>
        )
    }

    // ----------------------- <FilterForm /> -------------------------

    interface FilterFormProps {
        minFreqVal:Kontext.FormValue<string>;
        alphaLevel:Maths.AlphaLevel;
    }

    const FilterForm:React.FC<FilterFormProps> = (props) => {

        return (
            <S.FilterForm>
                <MinFreqInput minFreqVal={props.minFreqVal} />
                <ConfidenceLevelSelector value={props.alphaLevel} />
            </S.FilterForm>
        );
    };

    // ----------------------- <FreqResultLoaderView /> --------------------

    const reloadData = (sourceId:string) => {
        dispatcher.dispatch<typeof Actions.ReloadData>({
            name: Actions.ReloadData.name,
            payload: {
                sourceId
            }
        })
    };

    const FreqResultLoaderView:React.FC<{sourceId:string; label:string; error?:Error}> = ({sourceId, label, error}) => {

        React.useEffect(
            () => {
                reloadData(sourceId);
            },
            []
        );

        return (
            <S.FreqResultLoaderView>
                <h3>{label}</h3>
                {error ? [
                        <div className='error'>
                            <globalComponents.StatusIcon status='error' />
                            {error.message}
                        </div>,
                        <a className='util-button' onClick={() => reloadData(sourceId)}>&#x21bb; {he.translate('global__try_again')}</a>,
                    ] :
                    <globalComponents.AjaxLoaderImage />
                }
            </S.FreqResultLoaderView>
        );
    }

    // ----------------------- <FreqTablesView /> ------------------------

    const _FreqTablesView:React.FC<FreqDataRowsModelState & FreqViewProps> = (props) => {

        const handleSaveFormClose = () => {
            dispatcher.dispatch(
                Actions.ResultCloseSaveForm,
            );
        };

        const handleConfidenceToggle = (checked:boolean) => {
            dispatcher.dispatch<typeof Actions.ToggleDisplayConfidence>({
                name: Actions.ToggleDisplayConfidence.name,
                payload: {
                    value: checked
                }
            });
        };

        const hideShare = () => {
            dispatcher.dispatch(Actions.ResultHideShareLink);
        };

        const showShare = (sourceId:string) => {
            dispatcher.dispatch(
                Actions.ResultShowShareLink,
                {sourceId}
            );
        };

        return (
            <div className="FreqResultView">
                <S.TableViewToolbar>
                    <span>
                        <label htmlFor="display-confidence">{he.translate('freq__confidence_toggle')}</label>
                        <globalComponents.ToggleSwitch
                            id="display-confidence"
                            checked={props.displayConfidence}
                            onChange={handleConfidenceToggle} />
                    </span>
                    {props.displayConfidence ?
                        null :
                        <globalComponents.InlineHelp noSuperscript={true}
                                    isWarning={true} customStyle={{width: '15em'}}
                                    url="https://wiki.korpus.cz/doku.php/pojmy:konfidencni_intervaly">
                            {he.translate('freq__hidden_ci_warning')}
                        </globalComponents.InlineHelp>
                    }
                </S.TableViewToolbar>
                {pipe(
                    props.data,
                    Dict.toEntries(),
                    List.map(([sourceId, block], i) => (
                        <S.FreqBlock key={`block:${sourceId}`}>
                            <div className={isEmptyResultBlock(block) ? 'loading' : null}>
                            {isEmptyResultBlock(block) ?
                                <FreqResultLoaderView sourceId={sourceId} label={block.heading} error={props.isError[sourceId]} /> :
                                <>
                                    <Paginator currentPage={props.currentPage[sourceId]}
                                            sourceId={sourceId}
                                            totalPages={block.TotalPages}
                                            isLoading={props.isBusy[sourceId]}
                                            totalItems={block.Total}
                                            shareLink={
                                                props.shareLink && sourceId === props.shareLink.sourceId ?
                                                    props.shareLink.url :
                                                    null
                                                    }
                                            email={props.userEmail}
                                            shareWidgetIsBusy={props.shareWidgetIsBusy}
                                            onShowShare={showShare}
                                            onHideShare={hideShare} />
                                    <div>
                                        <drViews.DataTable head={block.Head}
                                                sortColumn={props.sortColumn[sourceId]}
                                                rows={block.Items}
                                                hasSkippedEmpty={block.SkippedEmpty}
                                                sourceId={sourceId}
                                                alphaLevel={props.alphaLevel}
                                                displayConfidence={props.displayConfidence} />
                                    </div>
                                </>
                            }
                            </div>
                        </S.FreqBlock>
                        )
                    )
                )}
                {props.saveFormActive ?
                    <saveViews.SaveFreqForm onClose={handleSaveFormClose} /> :
                    null
                }
            </div>
        );
    }

    const FreqTablesView = BoundWithProps<FreqViewProps, FreqDataRowsModelState>(_FreqTablesView, freqDataRowsModel)

    // ----------------------- <FreqResultView /> -------------------------

    const FreqResultView:React.FC<TabWrapperModelState & FreqViewProps> = (props) => {

        const handleTabSelection = (value:string) => {
            dispatcher.dispatch<typeof Actions.ResultSetActiveTab>({
                name: Actions.ResultSetActiveTab.name,
                payload: {
                    value: value as FreqResultViews
                }
            });
        }

        return (
            <S.FreqResultView>
                <FilterForm minFreqVal={props.flimit} alphaLevel={props.alphaLevel} />
                <hr />
                <globalComponents.TabView
                        noInternalState={true}
                        className="FreqViewSelector"
                        callback={handleTabSelection}
                        items={[
                            {id: 'charts', label: he.translate('freq__tab_charts_button')},
                            {id: 'tables', label: he.translate('freq__tab_tables_button')}
                        ]}
                        defaultId={props.activeTab}
                        noButtonSeparator={true} >
                    <div>
                        <chartViews.FreqChartsView userEmail={props.userEmail} />
                    </div>
                    <FreqTablesView userEmail={props.userEmail} />
                </globalComponents.TabView>
            </S.FreqResultView>
        );
    }


    return {
        FreqResultView: BoundWithProps<FreqViewProps, TabWrapperModelState>(FreqResultView, tabSwitchModel)
    };
}