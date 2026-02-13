import * as React from 'react';
import { IActionDispatcher, useModel } from 'kombo';
import { List, pipe, Dict, tuple } from 'cnc-tskit';

import { selectableValIsVisible, SelectableValue, TagsetStatus, UDTagBuilderModel } from './models.js';
import * as Kontext from '../../../types/kontext.js';
import { Actions } from '../actions.js';
import { Actions as QueryActions } from '../../../models/query/actions.js';

import * as S from '../style.js';


export function init(
    dispatcher:IActionDispatcher,
    ut:Kontext.ComponentHelpers,
    model:UDTagBuilderModel,
):React.FC<{sourceId:string; formType:Kontext.ConcFormTypes}> {

    const layoutViews = ut.getLayoutViews();

    // --------------------------- <AttrFilter /> ---------------------------

    const AttrFilter:React.FC<{
        sourceId:string;
        name:string;
        value:string;
        filterPlaceholder:string;

    }> = ({sourceId, name, value, filterPlaceholder}) => {

        const handleInput = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.KVSetAttrFilter,
                {
                    sourceId,
                    attr: name,
                    value: evt.target.value
                }
            );
        };

        return (
            <S.AttrFilter>
                <span className="icon">
                    <img src={ut.createStaticUrl('img/search.svg')} alt="magnifying glass" />
                </span>
                <input type="text" placeholder={filterPlaceholder} value={value} onChange={handleInput} />
            </S.AttrFilter>
        );
    };

    // --------------------------- <AttrSelection /> ------------------------------

    const AttrSelection:React.FC<{
        allValues:Array<SelectableValue>;
        sourceId:string;
        name:string;
        filterValue:string;
        onChangeHandler:(event) => void;
        categoryName:string;
    }> = (props) => {
        const checkboxes = pipe(
            props.allValues,
            List.sorted((v1, v2) => v1.value.localeCompare(v2.value)),
            List.filter(v => selectableValIsVisible(v)),
            List.map(value => (
                <li key={value.value} className={value.selected ? 'selected' : null}>
                <label className={value.available === 'locked' && !value.selected ? 'locked' : null}>
                    <input
                        onChange={value.available === 'locked' ? undefined : props.onChangeHandler}
                        readOnly={value.available === 'locked'}
                        type="checkbox"
                        id={props.categoryName + '-' + value}
                        name={props.categoryName}
                        value={value.value}
                        checked={value.selected}
                        disabled={!value.available} />
                    {value.value}
                    </label>
                </li>
            ))
        );
        return (
            <S.AttrSelection>
                <AttrFilter name={props.name} value={props.filterValue} sourceId={props.sourceId}
                        filterPlaceholder={ut.translate('taghelper__filter_attr_placeholder')} />
                <ul>{checkboxes}</ul>
            </S.AttrSelection>
        );
    }


    // ------------------------- <UDFeatExpLabel /> -------------------------

    const UDFeatExpLabel:React.FC<{
        sourceId:string;
        tagsetId:string;
        value:string;
        numAvail:number;
        expanded:boolean;

    }>  = (props) => {

        const handleFeatToggle = () => {
            dispatcher.dispatch<typeof Actions.KVToggleUDFeat>({
                name: Actions.KVToggleUDFeat.name,
                payload: {
                    sourceId: props.sourceId,
                    tagsetId: props.tagsetId,
                    value: props.value
                }
            });
        };

        const img = ut.createStaticUrl(props.expanded ? 'img/collapse.svg' : 'img/expand.svg');

        return (
            <S.UDFeatExpLabel>
                <a onClick={handleFeatToggle}>
                    <span className="img-wrapper">
                        <layoutViews.ImgWithMouseover src={img} src2={img} alt="expand/collapse" />
                    </span>
                    <span className="label">{props.value}</span>
                </a>
                <span className="info">[<span className="num">{props.numAvail}</span>]</span>
            </S.UDFeatExpLabel>
        );
    }

    // --------------------------- <UDSelection /> ------------------------------

    const UDSelection:React.FC<{
        udFeats:{[prop:string]:Array<SelectableValue>};
        sourceId:string;
        tagsetId:string;
        expandedFeat:string;
        filterValue:string;
        onChangeHandler:(event) => void;
    }> = (props) => {


        const checkboxes = pipe(
            props.udFeats,
            Dict.toEntries(),
            List.sorted(
                ([name1, ], [name2,]) => name1.localeCompare(name2)
            ),
            List.map(
                ([name, values], i) => (
                    List.some(v => selectableValIsVisible(v), values) ?
                        <li key={`${name}:${i}`}>
                            <UDFeatExpLabel
                                sourceId={props.sourceId}
                                tagsetId={props.tagsetId}
                                expanded={props.expandedFeat === name}
                                value={name}
                                numAvail={pipe(
                                    values,
                                    List.filter(v => selectableValIsVisible(v)),
                                    List.size()
                                )}
                                />
                            {props.expandedFeat === name ?
                                <ul className="subcat">
                                    {pipe(
                                        values,
                                        List.filter(
                                            v => selectableValIsVisible(v)
                                        ),
                                        List.map(
                                            (v, i) => (
                                                <li key={`${v.value}:${i}`} className={v.selected ? 'selected' : null}>
                                                    <label className={v.available === 'locked' && !v.selected ? 'locked' : null}>
                                                        <input type="checkbox"
                                                            checked={v.selected}
                                                            readOnly={v.available === 'locked'}
                                                            onChange={v.available === 'locked' ? undefined : props.onChangeHandler}
                                                            name={name}
                                                            value={v.value} />
                                                        {v.value}
                                                    </label>
                                                </li>
                                            )
                                        )
                                    )}
                                </ul> :
                                null
                            }
                        </li> :
                        null
                )
            )
        );
        return (
            <S.UDSelection>
                <AttrFilter name="ud" value={props.filterValue} sourceId={props.sourceId}
                        filterPlaceholder={ut.translate('taghelper__filter_ud_feat_placeholder')} />
                <ul>{checkboxes}</ul>
            </S.UDSelection>
        );
    }

    // --------------------- <QueryLineCategory /> ----------------------------------------

    const QueryLineCategory:React.FunctionComponent<{
        categoryName:string;
        filterFeaturesCategory:Array<[string, SelectableValue]>;
        handleRemoveFilter:(evt:React.MouseEvent<HTMLButtonElement>) => void;
    }> = (props) => {
        const buttonGroup = pipe(
            props.filterFeaturesCategory,
            List.sorted(([attName1,], [attName2,]) => attName1.localeCompare(attName2)),
            List.map(([attName, filter]) => (
                <li key={`${attName}:${filter.value}`} className="item">
                    <span>{filter.value}</span>
                    <button name={attName} type="button" value={filter.value}
                            onClick={props.handleRemoveFilter} className="query-close">{'\u00D7'}</button>
                </li>
            ))
        );
        return (
            <>
            <li className = "query-button-group">
                {props.categoryName + ' = '}
            </li>
            {buttonGroup}
            </>
        );
    }

    // ------------------------ <QueryBox /> --------------------------------------------

    const QueryBox:React.FunctionComponent<{
        data:TagsetStatus;
        handleRemoveFilter:(isUdFeat:boolean) => (evt:React.MouseEvent<HTMLButtonElement>) => void;
    }> = (props) => {
        const selected = pipe(
            [
                ...pipe(
                    props.data.allAttrs,
                    Dict.toEntries(),
                    List.map(
                        ([k, v]) => tuple(k, v, false)
                    )
                ),
                ...pipe(
                    props.data.allUdFeats,
                    Dict.toEntries(),
                    List.map(
                        ([k, v]) => tuple(k, v, true)
                    )
                )
            ],
            List.map(v => v),
            List.filter(([,v,]) => List.some(x => x.selected, v)),
            List.sorted(([key1,,], [key2,,]) => key1.localeCompare(key2)),
            List.map(
                ([key, recList, isUdFeat], i) => (
                    <React.Fragment key={`emp:${key}`}>
                        {i > 0 ? <li className="query-button-group amp">{'&'}</li> : null}
                        <QueryLineCategory
                            categoryName={key}
                            filterFeaturesCategory={pipe(
                                recList,
                                List.filter(v => v.selected),
                                List.map(v => [key, v])
                            )}
                            handleRemoveFilter={props.handleRemoveFilter(isUdFeat)} />
                    </React.Fragment>
                )
            )
        );
        return (
            <S.QueryBox>
                <h3>{ut.translate('taghelper__selected_features_label')}:</h3>
                <div className="expression">
                    {selected.length > 0 ? <S.QueryLine>{selected}</S.QueryLine> : null}
                </div>
            </S.QueryBox>
        );
    };

    // ---------------------------- <AttrLockStatus /> ------------------------------------

    const AttrLockStatus:React.FC<{
        locked:boolean;
    }> = ({locked}) => {
        return (
            <S.AttrLockStatus>
                {locked ?
                    <img src={ut.createStaticUrl('img/locked.svg')} alt="locked" /> :
                    <img src={ut.createStaticUrl('img/unlocked.svg')} alt="unlocked" />
                }
            </S.AttrLockStatus>
        )
    };

    // ---------------------------- <FeatureSelect /> ---------------------------------

    const FeatureSelect:React.FC<{sourceId: string; formType:Kontext.ConcFormTypes}> = (props) => {

        const state = useModel(model);
        const data = state.data[props.sourceId];

        const handleCheckboxChange = (isUdFeat:boolean) => (event:React.ChangeEvent<HTMLInputElement>) => {
            if (event.target.checked) {
                dispatcher.dispatch<typeof Actions.KVAddFilter>({
                    name: Actions.KVAddFilter.name,
                    payload: {
                        tagsetId: state.tagsetInfo.ident,
                        sourceId: props.sourceId,
                        name: event.target.name,
                        value: event.target.value,
                        isUdFeat
                    }
                });

            } else {
                dispatcher.dispatch<typeof Actions.KVRemoveFilter>({
                    name: Actions.KVRemoveFilter.name,
                    payload: {
                        tagsetId: state.tagsetInfo.ident,
                        sourceId: props.sourceId,
                        name: event.currentTarget.name,
                        value: event.currentTarget.value,
                        isUdFeat
                    }
                });
            }
        };

        const handleInsertButton = () => {
            dispatcher.dispatch(
                QueryActions.QueryInputSetQuery,
                {
                    formType: props.formType,
                    sourceId: props.sourceId,
                    insertRange: [-1, -1],
                    query: data.generatedQuery
                }
            );
            dispatcher.dispatch(
                QueryActions.SetActiveInputWidget,
                {
                    sourceId: props.sourceId,
                    formType: props.formType,
                    currQuery: '',
                    value: null,
                    appliedQueryRange: null
                }
            );
        }

        const handleRemoveFilter = (isUdFeat:boolean) => (event:React.MouseEvent<HTMLButtonElement>) => {
            dispatcher.dispatch<typeof Actions.KVRemoveFilter>({
                name: Actions.KVRemoveFilter.name,
                payload: {
                    tagsetId: state.tagsetInfo.ident,
                    sourceId: props.sourceId,
                    name: event.currentTarget.name,
                    value: event.currentTarget.value,
                    isUdFeat
                }
            });
        };

        const handleUndoButton = (tagsetId:string) => () => {
            dispatcher.dispatch(
                Actions.Undo,
                {
                    tagsetId,
                    sourceId: props.sourceId
                }
            );
        };

        const handleResetButton = (tagsetId:string) => () => {
            dispatcher.dispatch(
                Actions.Reset,
                {
                    tagsetId,
                    sourceId: props.sourceId
                }
            );
        };

        if (data.error) {
            return <div>Error: {data.error.message}</div>;

        } else {
            const canUndo = List.size(data.filterFeaturesHistory) > 1;
            const canInsert = pipe(
                {...data.allAttrs, ...data.allUdFeats},
                Dict.some(
                    (items, _) => List.some(v => v.selected, items)
                )
            );
            return (
                <S.FeatureSelect>
                    <QueryBox
                        data={data}
                        handleRemoveFilter={handleRemoveFilter} />
                    <div className="selections">
                        {pipe(
                            data.attrConf,
                            List.sortedBy(v => v.vertIdx),
                            List.map(
                                (attrConf, i) => {
                                    if (attrConf.isUdFeats) {
                                        const isLocked = Dict.some((items, _) => List.some(v2 => v2.available === 'locked', items), data.allUdFeats);
                                        return (
                                            <S.CategoryDetail key={`${attrConf.name}:${i}`} style={{marginRight: '5em'}}>
                                                <div className="heading">
                                                    <AttrLockStatus locked={isLocked} />
                                                    <h3>{attrConf.name}</h3>
                                                </div>
                                                <UDSelection
                                                    sourceId={props.sourceId}
                                                    tagsetId={state.tagsetInfo.ident}
                                                    filterValue={data.attrsFilters['ud']}
                                                    expandedFeat={data.expandedUdFeat}
                                                    onChangeHandler={handleCheckboxChange(true)}
                                                    udFeats={data.allUdFeats} />
                                            </S.CategoryDetail>
                                        );

                                    } else {
                                        const attrValues = data.allAttrs[attrConf.name] || [];
                                        return (
                                            <S.CategoryDetail key={`${attrConf.name}:${i}`} style={{marginRight: '5em'}}>
                                                <div className="heading">
                                                    <AttrLockStatus locked={List.some(v => v.available === 'locked', attrValues)} />
                                                    <h3>{attrConf.name}</h3>
                                                </div>
                                                <AttrSelection
                                                    sourceId={props.sourceId}
                                                    name={attrConf.name}
                                                    filterValue={data.attrsFilters[attrConf.name]}
                                                    onChangeHandler={handleCheckboxChange(false)}
                                                    categoryName={attrConf.name}
                                                    allValues={attrValues} />
                                            </S.CategoryDetail>
                                        )
                                    }
                                }
                            )
                        )}
                    </div>
                    <div className="buttons">
                        <button
                                type="button"
                                className={`util-button ${canInsert ? '' : 'disabled'}`}
                                onClick={canInsert ?
                                handleInsertButton : undefined}>
                            {ut.translate('taghelper__insert_btn')}
                        </button>
                        <span className="separ"></span>
                        <button
                            type="button"
                            className={`util-button cancel ${canUndo ? '' : 'disabled'}`}
                            onClick={canUndo ?
                                handleUndoButton(state.tagsetInfo.ident) : undefined}>
                            {ut.translate('taghelper__undo')}
                        </button>
                        <button
                                type="button"
                                className={`util-button cancel ${canUndo ? '' : 'disabled'}`}
                                onClick={canUndo ?
                                    handleResetButton(state.tagsetInfo.ident) : undefined}>
                            {ut.translate('taghelper__reset')}
                        </button>
                    </div>
                </S.FeatureSelect>
            );
        }
    };

    return FeatureSelect;
}
