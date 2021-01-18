import * as React from 'react';
import { IActionDispatcher } from 'kombo';
import { List, pipe, Dict } from 'cnc-tskit';

import { FilterRecord, UDTagBuilderModelState } from './models';
import { Kontext } from '../../../types/common';
import { Actions, ActionName } from '../actions';


export function init(dispatcher:IActionDispatcher, ut:Kontext.ComponentHelpers):React.FC<UDTagBuilderModelState & {sourceId:string}> {

    // --------------------------- <CategoryDetail /> ------------------------------

    const CategoryDetail:React.FunctionComponent<{
        allValues:Array<string>;
        availableValues:Array<string>;
        onChangeHandler:(event) => void;
        categoryName:string;
        filterFeatures:Array<FilterRecord>;
    }> = (props) => {
        const categoryFilterRecord = new FilterRecord(props.categoryName, null);
        const checkboxes = pipe(
            props.allValues,
            List.sorted((v1, v2) => v1.localeCompare(v2)),
            List.map(value => {
                const filterRecord = categoryFilterRecord.setValue(value);
                return <li key={value}>
                    <input
                        onChange={props.onChangeHandler}
                        type="checkbox"
                        id={props.categoryName + '-' + value}
                        name={props.categoryName}
                        value={value}
                        checked={List.some(x => x.equals(filterRecord), props.filterFeatures)}
                        disabled={!List.some(x => x === value, props.availableValues)} />
                    <label htmlFor={props.categoryName + '-' + value}>{value}</label>
                </li>
            })
        );
        return <ul className="defaultTaghelper_PositionList">{checkboxes}</ul>;
    }

    // --------------------------- <CategorySelect /> ------------------------------

    const CategorySelect:React.FunctionComponent<{
        selectedCategory:string;
        allFeatures:{[key:string]:Array<string>};
        availableFeatures:{[key:string]:Array<string>};
        onSelectCategoryHandler:(event) => void;

    }> = (props) => {
        const categories = pipe(
            props.allFeatures,
            Dict.keys(),
            List.sorted((v1, v2) => v1.localeCompare(v2)),
            List.map(category => {
                const availableValuesCount = Dict.hasKey(category, props.availableFeatures) ?
                    props.availableFeatures[category].length : 0;
                return <option key={category} value={category} disabled={availableValuesCount === 0}>
                        {category + " (" + availableValuesCount + ")"}
                    </option>;
            })
        );
        return <select multiple size={20} onChange={props.onSelectCategoryHandler}
                        value={[props.selectedCategory]}>{categories}</select>;
    }

    // --------------------- <QueryLineCategory /> ----------------------------------------

    const QueryLineCategory:React.FunctionComponent<{
        categoryName:string;
        filterFeaturesCategory:Array<FilterRecord>;
        handleRemoveFilter:(event) => void;
    }> = (props) => {
        const buttonGroup = pipe(
            props.filterFeaturesCategory,
            List.sorted((f1, f2) => f1.name.localeCompare(f2.name)),
            List.map(filter => (
                <li key={filter.composeString()} className="item">
                    <span>{filter.value}</span>
                    <button name={filter.name} type="button" value={filter.value}
                            onClick={props.handleRemoveFilter} className="query-close">{'\u00D7'}</button>
                </li>
            ))
        );
        return (
            <li className = "query-button-group">
                {props.categoryName + ' = '}
                <ul key="cat-name">
                    {buttonGroup}
                </ul>
            </li>
        );
    }

    // ------------------------ <QueryExpression /> --------------------------------------------

    const QueryExpression:React.FunctionComponent<{
        filterFeatures:Array<FilterRecord>;
        handleRemoveFilter:(event) => void;
    }> = (props) => {
        const selected = pipe(
            props.filterFeatures,
            List.groupBy(item => item.name),
            List.sorted(([key1,], [key2,]) => key1.localeCompare(key2)),
            List.foldl(
                (acc, [key, recList]) => {
                    acc.push((
                        <React.Fragment key={`emp:${key}`}>
                            {acc.length ? <li className="query-button-group amp">{'&'}</li> : null}
                            <QueryLineCategory
                                categoryName={key}
                                filterFeaturesCategory={recList}
                                handleRemoveFilter={props.handleRemoveFilter} />
                        </React.Fragment>
                    ));
                    return acc;
                },
                []
            )
        );
        return (
            <div className="QueryExpression">
                {selected.length > 0 ? <ul className="query-line">{selected}</ul> : null}
            </div>
        );
    }

    // ---------------------------- <FeatureSelect /> ---------------------------------

    const FeatureSelect:React.FC<UDTagBuilderModelState & {sourceId:string}> = (props) => {

        const handleCheckboxChange = (event) => {
            if (event.target.checked) {
                dispatcher.dispatch<Actions.KVAddFilter>({
                    name: ActionName.KVAddFilter,
                    payload: {
                        sourceId: props.sourceId,
                        name: event.target.name,
                        value: event.target.value
                    }
                });

            } else {
                handleRemoveFilter(event);
            }
        };

        const handleRemoveFilter = (event) => {
            dispatcher.dispatch<Actions.KVRemoveFilter>({
                name: ActionName.KVRemoveFilter,
                payload: {
                    sourceId: props.sourceId,
                    name: event.target.name,
                    value: event.target.value
                }
            });
        };

        const handleCategorySelect = (event) => {
            dispatcher.dispatch<Actions.KVSelectCategory>({
                name: ActionName.KVSelectCategory,
                payload: {
                    sourceId: props.sourceId,
                    value: event.target.value
                }
            });
        };

        if (props.error) {
            return <div>Error: {props.error.message}</div>;

        } else {
            const featsWithoutPos = {...props.allFeatures};
            delete featsWithoutPos['POS'];

            return (
                <div className='FeatureSelect'>
                    <h4>{ut.translate('taghelper__selected_features_label')}:</h4>
                    <div className='QueryLine' style={{maxWidth: '39em', minHeight: '4em'}}>
                        <QueryExpression
                            filterFeatures={List.last(props.filterFeaturesHistory)}
                            handleRemoveFilter={handleRemoveFilter} />
                    </div>
                    <div style={{display: 'flex', alignItems: 'stretch'}}>
                        <div className='CategoryDetail' style={{marginRight: '5em'}}>
                            <h4>{ut.translate('taghelper__part_of_speech_label')}:</h4>
                            <CategoryDetail
                                onChangeHandler={(event) => handleCheckboxChange(event)}
                                filterFeatures={List.last(props.filterFeaturesHistory)}
                                categoryName="POS"
                                allValues={props.allFeatures['POS'] || []}
                                availableValues={props.availableFeatures['POS'] || []} />
                        </div>
                        <div>
                            <h4>{ut.translate('taghelper__features_label')}:</h4>
                            <div style={{display: 'flex', alignItems: 'flex-start'}}>
                                <div className='CategorySelect' style={{marginRight: '2em'}}>
                                    <CategorySelect
                                        allFeatures={featsWithoutPos}
                                        availableFeatures={props.availableFeatures}
                                        onSelectCategoryHandler={handleCategorySelect}
                                        selectedCategory={props.showCategory} />
                                </div>
                                <div className='CategoryDetail'>
                                    <CategoryDetail
                                        onChangeHandler={(event) => handleCheckboxChange(event)}
                                        filterFeatures={List.last(props.filterFeaturesHistory)}
                                        categoryName={props.showCategory}
                                        allValues={props.allFeatures[props.showCategory] || []}
                                        availableValues={props.availableFeatures[props.showCategory] || []} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    };

    return FeatureSelect;
}
