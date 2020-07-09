import * as React from 'react';
import { IActionDispatcher } from 'kombo';
import { List, pipe, Dict } from 'cnc-tskit';

import { FilterRecord, FeatureSelectProps } from './models';
import { Kontext } from '../../../types/common';

export function init(dispatcher:IActionDispatcher, ut:Kontext.ComponentHelpers):React.ComponentClass<FeatureSelectProps> {

    const CategoryDetail:React.FunctionComponent<{
        allValues:Array<string>;
        availableValues:Array<string>;
        onChangeHandler:(event) => void;
        categoryName:string;
        filterFeatures:Array<FilterRecord>;
    }> = (props) => {
        const categoryFilterRecord = new FilterRecord(props.categoryName, null);
        const checkboxes = props.allValues.sort().map(value => {
            const filterRecord = categoryFilterRecord.setValue(value);
            return <li key={value}>
                <input
                    onChange={props.onChangeHandler}
                    type="checkbox"
                    id={props.categoryName + '-' + value}
                    name={props.categoryName}
                    value={value}
                    checked={props.filterFeatures.some(x => x.equals(filterRecord) ? true : false)}
                    disabled={props.availableValues.includes(value) ? false : true} />
                <label htmlFor={props.categoryName + '-' + value}>{value}</label>
            </li>
        });
        return <ul className="defaultTaghelper_PositionList">{checkboxes}</ul>;
    }

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
                return <option key={category} value={category}>
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

    class FeatureSelect extends React.Component<FeatureSelectProps> {

        constructor(props) {
            super(props);
            this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
            this.handleRemoveFilter = this.handleRemoveFilter.bind(this);
            this.handleCategorySelect = this.handleCategorySelect.bind(this);
        }

        handleCheckboxChange(event) {
            if (event.target.checked) {
                dispatcher.dispatch({
                    name: 'TAGHELPER_ADD_FILTER',
                    payload: {
                        sourceId: this.props.sourceId,
                        name: event.target.name,
                        value: event.target.value
                    }
                });
            } else {
                this.handleRemoveFilter(event);
            }
        }

        handleRemoveFilter(event) {
            dispatcher.dispatch({
                name: 'TAGHELPER_REMOVE_FILTER',
                payload: {
                    sourceId: this.props.sourceId,
                    name: event.target.name,
                    value: event.target.value
                }
            });
        };

        handleCategorySelect(event) {
            dispatcher.dispatch({
                name: 'TAGHELPER_SELECT_CATEGORY',
                payload: {
                    sourceId: this.props.sourceId,
                    value: event.target.value
                }
            });
        }

        render() {
            if (this.props.error) {
                return <div>Error: {this.props.error.message}</div>;

            } else {
                const featsWithoutPos = {...this.props.allFeatures};
                delete featsWithoutPos['POS'];
                return(
                    <div className='FeatureSelect'>
                        <h4>{ut.translate('taghelper__selected_features_label')}:</h4>
                        <div className='QueryLine' style={{maxWidth: '39em', minHeight: '4em'}}>
                            <QueryExpression
                                filterFeatures={List.last(this.props.filterFeaturesHistory)}
                                handleRemoveFilter={this.handleRemoveFilter} />
                        </div>
                        <div style={{display: 'flex', alignItems: 'stretch'}}>
                            <div className='CategoryDetail' style={{marginRight: '5em'}}>
                                <h4>{ut.translate('taghelper__part_of_speech_label')}:</h4>
                                <CategoryDetail
                                    onChangeHandler={(event) => this.handleCheckboxChange(event)}
                                    filterFeatures={List.last(this.props.filterFeaturesHistory)}
                                    categoryName="POS"
                                    allValues={this.props.allFeatures['POS'] || []}
                                    availableValues={this.props.availableFeatures['POS'] || []} />
                            </div>
                            <div>
                                <h4>{ut.translate('taghelper__features_label')}:</h4>
                                <div style={{display: 'flex', alignItems: 'flex-start'}}>
                                    <div className='CategorySelect' style={{marginRight: '2em'}}>
                                        <CategorySelect
                                            allFeatures={featsWithoutPos}
                                            availableFeatures={featsWithoutPos}
                                            onSelectCategoryHandler={this.handleCategorySelect}
                                            selectedCategory={this.props.showCategory} />
                                    </div>
                                    <div className='CategoryDetail'>
                                        <CategoryDetail
                                            onChangeHandler={(event) => this.handleCheckboxChange(event)}
                                            filterFeatures={List.last(this.props.filterFeaturesHistory)}
                                            categoryName={this.props.showCategory}
                                            allValues={this.props.allFeatures[this.props.showCategory] || []}
                                            availableValues={this.props.availableFeatures[this.props.showCategory] || []} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        }
    }

    return FeatureSelect;
}
