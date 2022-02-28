import * as React from 'react';
import { IActionDispatcher } from 'kombo';
import { List, pipe, Dict } from 'cnc-tskit';

import { FilterRecord, UDTagBuilderModelState } from './models';
import * as Kontext from '../../../types/kontext';
import { Actions } from '../actions';

import * as S from '../style';


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
        return <S.PositionList>{checkboxes}</S.PositionList>;
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
            <S.QueryExpression>
                {selected.length > 0 ? <S.QueryLine>{selected}</S.QueryLine> : null}
            </S.QueryExpression>
        );
    }

    // ---------------------------- <FeatureSelect /> ---------------------------------

    const FeatureSelect:React.FC<UDTagBuilderModelState & {sourceId: string}> = (props) => {

        const handleCheckboxChange = (event) => {
            if (event.target.checked) {
                dispatcher.dispatch<typeof Actions.KVAddFilter>({
                    name: Actions.KVAddFilter.name,
                    payload: {
                        tagsetId: props.tagsetInfo.ident,
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
            dispatcher.dispatch<typeof Actions.KVRemoveFilter>({
                name: Actions.KVRemoveFilter.name,
                payload: {
                    tagsetId: props.tagsetInfo.ident,
                    sourceId: props.sourceId,
                    name: event.target.name,
                    value: event.target.value
                }
            });
        };

        const handleCategorySelect = (event) => {
            dispatcher.dispatch<typeof Actions.KVSelectCategory>({
                name: Actions.KVSelectCategory.name,
                payload: {
                    tagsetId: props.tagsetInfo.ident,
                    sourceId: props.sourceId,
                    value: event.target.value
                }
            });
        };

        const data = props.data[props.sourceId];

        if (data.error) {
            return <div>Error: {data.error.message}</div>;

        } else {
            const featsWithoutPos = {...data.allFeatures};
            delete featsWithoutPos['POS'];

            return (
                <S.FeatureSelect>
                    <h4>{ut.translate('taghelper__selected_features_label')}:</h4>
                    <div className='QueryLine' style={{maxWidth: '39em', minHeight: '4em'}}>
                        <QueryExpression
                            filterFeatures={List.last(data.filterFeaturesHistory)}
                            handleRemoveFilter={handleRemoveFilter} />
                    </div>
                    <div style={{display: 'flex', alignItems: 'stretch'}}>
                        <S.CategoryDetail style={{marginRight: '5em'}}>
                            <h4>{ut.translate('taghelper__part_of_speech_label')}:</h4>
                            <CategoryDetail
                                onChangeHandler={(event) => handleCheckboxChange(event)}
                                filterFeatures={List.last(data.filterFeaturesHistory)}
                                categoryName="POS"
                                allValues={data.allFeatures['POS'] || []}
                                availableValues={data.availableFeatures['POS'] || []} />
                        </S.CategoryDetail>
                        <div>
                            <h4>{ut.translate('taghelper__features_label')}:</h4>
                            <div style={{display: 'flex', alignItems: 'flex-start'}}>
                                <S.CategorySelect className='CategorySelect' style={{marginRight: '2em'}}>
                                    <CategorySelect
                                        allFeatures={featsWithoutPos}
                                        availableFeatures={data.availableFeatures}
                                        onSelectCategoryHandler={handleCategorySelect}
                                        selectedCategory={data.showCategory} />
                                </S.CategorySelect>
                                <S.CategoryDetail>
                                    <CategoryDetail
                                        onChangeHandler={(event) => handleCheckboxChange(event)}
                                        filterFeatures={List.last(data.filterFeaturesHistory)}
                                        categoryName={data.showCategory}
                                        allValues={data.allFeatures[data.showCategory] || []}
                                        availableValues={data.availableFeatures[data.showCategory] || []} />
                                </S.CategoryDetail>
                            </div>
                        </div>
                    </div>
                </S.FeatureSelect>
            );
        }
    };

    return FeatureSelect;
}
