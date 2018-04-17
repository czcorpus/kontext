/*
 * Copyright (c) 2016 Charles University, Faculty of Mathematics and Physics,
 *                    Institute of Formal and Applied Linguistics
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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
import {Kontext} from '../../types/common';
import { ActionDispatcher } from '../../app/dispatcher';
import {TreeWidgetModel, Node} from './model';
import * as Immutable from 'immutable';

export interface Views {
    CorptreePageComponent:React.ComponentClass<{}>;
    FilterForm:React.SFC<{}>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers,
            treeModel:TreeWidgetModel):Views {

    // --------------------------------- <TreeNode /> --------------------------

    const TreeNode:React.SFC<{
        ident:string;
        name:string;
        active:boolean;
        corplist:Immutable.List<Node>;
        activeFeat:string;
        activeLanguage:string;
        permitted:boolean;
        onActiveFeatSet:(feat:string)=>void;
        onActiveFeatDrop:()=>void;
        onActiveLanguageSet:(lang:string)=>void;
        onActiveLanguageDrop:()=>void;

    }> = (props) => {


        return (
            <div className="node" id={props.name}>
                    <div className="header">
                    {props.name}
                    </div>
                    <div className="wrapper-inner">
                    <ItemList name={props.name} corplist={props.corplist}
                                onActiveFeatSet={props.onActiveFeatSet}
                                onActiveFeatDrop={props.onActiveFeatDrop}
                                activeFeat={props.activeFeat}
                                activeLanguage={props.activeLanguage}
                                permitted={props.permitted}
                                onActiveLanguageSet={props.onActiveLanguageSet}
                                onActiveLanguageDrop={props.onActiveLanguageDrop} />
                    </div>
            </div>
        );
    };

    // --------------------------------- <SubTreeNode /> --------------------------

    class SubTreeNode extends React.Component<{
        ident:string;
        active:boolean;
        activeFeat:string;
        activeLanguage:string;
        name:string;
        corplist:Immutable.List<Node>;
        permitted:boolean;
        onActiveLanguageSet:(lang:string)=>void;
        onActiveLanguageDrop:()=>void;
        onActiveFeatSet:(feat:string)=>void;
        onActiveFeatDrop:()=>void;

    }, {active: boolean}> {

        constructor(props) {
            super(props);
            this.state = {active: false};
            this._clickHandler = this._clickHandler.bind(this);
        }
        _clickHandler() {
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_SET_NODE_STATUS',
                props: {
                    nodeId: this.props.ident
                }
            });
        }

        _getStateGlyph() {
            let glyph = this.props.active || this.props.activeFeat !== null || this.props.activeLanguage !== null ? 'glyphicon glyphicon-minus-sign icon toggle-plus' : 'glyphicon glyphicon-plus-sign icon toggle-plus';
            return glyph;
        }

        _getStateDisplay() {
            return this.props.active ||
                    this.props.activeFeat !== null ||
                    this.props.activeLanguage !== null ?
                {display: 'block'} :
                {display: 'none'};
        }

        render() {
            return (
                <div className="corpora-set-header toggle-below clickable">
                    <a onClick={this._clickHandler}>
                        <div className="corpus-details">Multiple corpora
                        </div>
                        <div className="subnode">
                            <span className={this._getStateGlyph()}> </span>
                            {this.props.name}
                        </div>
                    </a>
                    <div className="to-toggle" style={this._getStateDisplay()}>
                        <ItemList level="inner"
                                name={this.props.name}
                                corplist={this.props.corplist}
                                onActiveFeatSet={this.props.onActiveFeatSet}
                                onActiveFeatDrop={this.props.onActiveFeatDrop}
                                activeFeat={this.props.activeFeat}
                                activeLanguage={this.props.activeLanguage}
                                onActiveLanguageSet={this.props.onActiveLanguageSet}
                                onActiveLanguageDrop={this.props.onActiveLanguageDrop}
                                permitted={this.props.permitted} />
                    </div>
                </div>
            );
        }
    }

    // -------------------------------- <TreeLeaf /> -------------------------------

    class TreeLeaf extends React.Component<{
        access:any; // TODO ??
        ident:string;
        activeLanguage:string;
        language:Immutable.List<string>;
        features:Immutable.List<string>;
        activeFeat:string;
        pmltq:string;
        repo:string;
        size:number;
        name:string;
        description:string;
        permitted:boolean;
        onActiveLanguageSet:(lang:string)=>void;
        onActiveLanguageDrop:()=>void;
        onActiveFeatSet:(feat:string)=>void;
        onActiveFeatDrop:()=>void;

    }, {hover:boolean; opaque:boolean}> {

        constructor(props) {
            super(props);
            this.state = {hover:false, opaque: true};
            this._clickHandler = this._clickHandler.bind(this);
            this._mouseOut = this._mouseOut.bind(this);
            this._mouseOver = this._mouseOver.bind(this);
            this._searchFeatClick = this._searchFeatClick.bind(this);
            this._searchFeatDrop = this._searchFeatDrop.bind(this);
            this._searchLangClick = this._searchLangClick.bind(this);
            this._searchLangDrop = this._searchLangDrop.bind(this);
        }

        _mouseOver() {
            this.setState({hover: true});
        }

        _mouseOut() {
            this.setState({hover: false});
        }

        _myColor() {
            if (this.state.hover) {
                if (typeof this.props.permitted) {
                    return "#d8eff7";
                }
                else {
                    return "#ffcccc";
                }
            }
        }

        _myOpacity() {
            if ((this.props.activeLanguage !== null &&
                    !this.props.language.includes(this.props.activeLanguage)) ||
                    this.props.activeFeat !== null &&
                    this.props.features.indexOf(this.props.activeFeat) === -1) {
                        return 0.1
                }
            return 1;
        }

        _searchLangClick(event:React.MouseEvent<HTMLButtonElement>) {
            this.props.onActiveLanguageSet(event.currentTarget.textContent);
        }

        _searchLangDrop() {
            this.props.onActiveLanguageDrop();
        }

        _searchFeatClick(event) {
            this.props.onActiveFeatSet(event.currentTarget.textContent);
        }

        _searchFeatDrop() {
            this.props.onActiveFeatDrop();
        }

        _showLangSign() {
            if (this.props.language.includes(this.props.activeLanguage)) {
                return "inline";
            }
            return "none";
        }

        _showFeatSign(feat) {
            if (feat === this.props.activeFeat) { return "inline"; }
            return "none";
        }

        _clickHandler() {
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_LEAF_NODE_CLICKED',
                props: {
                    ident: this.props.ident
                }
            });
        }

        _pmltq(pmltq:string) {
            if (pmltq !== 'no' && this.props.permitted) {
            return <a href={this.props.pmltq} className="md-transparent" title={"Inspect " + this.props.name + " in PML-TQ"}>
                    <span className="glyphicon lindat-pmltq-logo">&nbsp;</span></a>
            }
        }

        _download(repo:string) {
            if (repo !== 'no' && this.props.permitted) {
            return <a href={this.props.repo} className="md-transparent" title={"Download " + this.props.name}>
                    <span className="glyphicon glyphicon-save"></span></a>
            }
        }

        _access() {
            if (!this.props.permitted) {
                return <span className="glyphicon glyphicon-lock"></span>
            }
        }

        _syntax() {
            if (this.props.features.includes('syntax')) {
                return <span className="glyphicon lindat-pmltq-logo">&nbsp;</span>;
            }
            return null;
        }

        render() {
            return <div className="leaf" style={{background: this._myColor(), opacity: this._myOpacity()}}
                                data-features={this.props.features.join(',')}
                                data-lang={this.props.language.join(',')} >
                    <div className="row">
                        <div className="corpus-details col-xs-4">
                        Features:&nbsp;
                            {this.props.features.map((item, index) =>
                            (<div key={index} style={{display: "inline-block"}}>
                                <span className="corpus-details-info corplist-search clickable underline-hover"
                                            data-search="features" onClick={this._searchFeatClick}>
                                {item}
                            </span>
                            <span className="glyphicon glyphicon-remove search-selected clickable" onClick={this._searchFeatDrop} style={{display: this._showFeatSign(item), fontSize: "10px"}}>&nbsp;</span>
                            </div>))}
                        Language(s):&nbsp;
                            <span className="corpus-details-info corplist-search clickable underline-hover"
                                        data-search="language" onClick={this._searchLangClick}>
                                {this.props.language}
                            </span>
                            <span className="glyphicon glyphicon-remove search-selected clickable" onClick={this._searchLangDrop} style={{display: this._showLangSign(), fontSize: "10px"}}> </span>
                        </div>
                    </div>
                    <div className="row">
                        <div className="corpus-main-info col-xs-9 col-md-10" onMouseOver={this._mouseOver} onMouseOut={this._mouseOut} onClick={this._clickHandler} title={"Search in " + this.props.name}>
                            <div className="row">
                                <div className="col-xs-3 tokens">
                                    Size
                                    <div className="corpus-details-info">
                                        {he.formatNumber(this.props.size) + " positions"}
                                    </div>
                                </div>
                                <div className="col-xs-9 details">
                                    <h3 className="title">
                                        {this._pmltq(this.props.pmltq)}
                                        {this._download(this.props.repo)}
                                        {this._access()}
                                        {this._syntax()}
                                        {this.props.name}
                                    </h3>
                                    <div className="desc">
                                        {this.props.description}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
            </div>;
        }
    }

    // -------------------------------- <ItemList /> -------------------------------

    const ItemList:React.SFC<{
        level?:string;
        htmlClass?:string;
        name?:string;
        corplist:Immutable.List<Node>;
        activeLanguage:string;
        activeFeat:string;
        permitted:boolean;
        onActiveLanguageSet:(lang:string)=>void;
        onActiveLanguageDrop:()=>void;
        onActiveFeatSet:(feat:string)=>void;
        onActiveFeatDrop:()=>void;

    }> = (props) => {

        const renderChildren = () => {
                return props.corplist.map((item, i) => {
                    if (item.corplist.size > 0) {
                        if (item.level === 'outer') {
                            return <TreeNode key={i} name={item.name} ident={item.ident}
                                             corplist={item.corplist}
                                             active={item.active}
                                             activeFeat={props.activeFeat}
                                             activeLanguage={props.activeLanguage}
                                             permitted={item.permitted}
                                             onActiveLanguageSet={props.onActiveLanguageSet}
                                             onActiveLanguageDrop={props.onActiveLanguageDrop}
                                             onActiveFeatSet={props.onActiveFeatSet}
                                             onActiveFeatDrop={props.onActiveFeatDrop} />;
                        } else {
                            return <SubTreeNode key={i} name={item.name} ident={item.ident}
                                                corplist={item.corplist}
                                                active={item.active}
                                                activeFeat={props.activeFeat}
                                                activeLanguage={props.activeLanguage}
                                                permitted={item.permitted}
                                                onActiveLanguageSet={props.onActiveLanguageSet}
                                                onActiveLanguageDrop={props.onActiveLanguageDrop}
                                                onActiveFeatSet={props.onActiveFeatSet}
                                                onActiveFeatDrop={props.onActiveFeatDrop} />;
                        }
                    } else {
                        return <TreeLeaf key={i} name={item.name} ident={item.ident}
                                         size={item.size} features={item.features}
                                         language={item.language} description={item.description}
                                         repo={item.repo} pmltq={item.pmltq}
                                         access={item.access}
                                         activeLanguage={props.activeLanguage}
                                         onActiveLanguageSet={props.onActiveLanguageSet}
                                         onActiveLanguageDrop={props.onActiveLanguageDrop}
                                         activeFeat={props.activeFeat}
                                         onActiveFeatSet={props.onActiveFeatSet}
                                         onActiveFeatDrop={props.onActiveFeatDrop}
                                         permitted={item.permitted} />;
                    }
                });
        };

        return (
            <div className={props.htmlClass}>
                {props.name ? <a id={props.name} /> : null}
                {renderChildren()}
            </div>
        );
    };

    // -------------------------------- <ItemListSorted /> -------------------------------

    class ItemListSorted extends React.Component<{
        corplist:Immutable.List<Node>;
        activeLanguage:string;
        activeFeat:string;
        htmlClass:string;
        permitted:boolean;
        onActiveLanguageSet:(lang:string)=>void;
        onActiveLanguageDrop:()=>void;
        onActiveFeatSet:(feat:string)=>void;
        onActiveFeatDrop:()=>void;

    }, {htmlClass:string}> {

        constructor(props) {
            super(props);
           this.state = {htmlClass: "corp-tree-sorted"};
        }

        _renderChildren() {
            return this.props.corplist.map((item, i) => (
                <TreeLeaf key={i} name={item.name} ident={item.ident}
                                size={item.size} features={item.features}
                                language={item.language} description={item.description}
                                repo={item.repo} pmltq={item.pmltq} access={item.access}
                                activeLanguage={this.props.activeLanguage}
                                onActiveLanguageSet={this.props.onActiveLanguageSet}
                                onActiveLanguageDrop={this.props.onActiveLanguageDrop}
                                activeFeat={this.props.activeFeat}
                                onActiveFeatSet={this.props.onActiveFeatSet}
                                onActiveFeatDrop={this.props.onActiveFeatDrop}
                                permitted={item.permitted} />
            ));
        }

        render() {
            return (
                <div className={this.props.htmlClass}>
                    <div className="wrapper-inner-sorted">
                        {this._renderChildren()}
                    </div>
                </div>
            );
        }
    }


    // ----------------------- <CorptreePageComponent /> -----------------

    class CorptreePageComponent extends React.Component<{

    }, {
        data:Node;
        sortedData:Immutable.List<Node>;
        sorted:boolean;
        activeLanguage:string;
        activeFeat:string;
    }> {

        constructor(props) {
            super(props);
            this.state = {
                data: treeModel.getData(),
                sortedData: treeModel.getSortedData(),
                sorted: false,
                activeLanguage: null,
                activeFeat: null
            };
            this._changeListener = this._changeListener.bind(this);
            this.handleActiveLanguageSet = this.handleActiveLanguageSet.bind(this);
            this.handleActiveFeatSet = this.handleActiveFeatSet.bind(this);
            this.handleActiveLanguageDrop = this.handleActiveLanguageDrop.bind(this);
            this.handleActiveFeatDrop = this.handleActiveFeatDrop.bind(this);
            this._sortClickHandler = this._sortClickHandler.bind(this);
        }

        _changeListener() {
            this.setState({
                data: treeModel.getData(),
                sortedData: treeModel.getSortedData(),
                sorted: this.state.sorted,
                activeLanguage: this.state.activeLanguage
            });
        }

        handleActiveLanguageSet(language) {
            this.setState({activeLanguage: language});
        }

        handleActiveFeatSet(feat) {
            this.setState({activeFeat: feat});
        }

        handleActiveLanguageDrop() {
            this.setState({activeLanguage: null});
        }

        handleActiveFeatDrop() {
            this.setState({activeFeat: null});
        }

        _bySize() {
            if (this.state.sorted) {
                return "none";
            }
            return "inline";
        }

        _byDefault() {
            if (this.state.sorted) {
                return "inline";
            }
            return "none";
        }

        _sortClickHandler() {
            this.setState({sorted: !this.state.sorted});
        }

        componentDidMount() {
            treeModel.addChangeListener(this._changeListener);
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_GET_DATA',
                props: {}
            });
        }

        componentWillUnmount() {
            treeModel.removeChangeListener(this._changeListener);
        }

        render() {
            return (
                <div className="corp-tree-component">
                    <div className="row tab-nav">
                        <div className="col-xs-9">
                            <ul className="nav nav-tabs">
                                <li role="presentation">
                                    <a href="#LINDAT monolingual corpora" title="Jump to group monolingual corpora">Monolingual Corpora</a>
                                </li>
                                <li role="presentation">
                                    <a href="#LINDAT parallel corpora" title="Jump to group parallel corpora">Parallel Corpora</a>
                                </li>
                                <li role="presentation">
                                    <a href="#LINDAT speech corpora" title="Jump to group speech corpora">Speech Corpora</a>
                                </li>
                            </ul>
                        </div>
                        <div className="col-xs-3 clickable btnlike">
                            <span className={`glyphicon glyphicon-sort-by-attributes`}
                                    style={{marginRight: 0.5 + 'em'}}></span>
                            <span id="for-corpus-list-sizes" className="corplist-tabs" title="Show by size" style={{display: this._bySize()}} onClick={this._sortClickHandler}>Show by size</span>
                            <span id="for-corpus-list-default" className="corplist-tabs" title="Show by category" style={{display: this._byDefault()}} onClick={this._sortClickHandler}>Show by category</span>
                        </div>
                    </div>
                    <div style={{display: this._bySize()}}>
                        <ItemList htmlClass="corp-tree"
                                  corplist={this.state.data.corplist}
                                  activeLanguage={this.state.activeLanguage}
                                  onActiveLanguageSet={this.handleActiveLanguageSet}
                                  onActiveLanguageDrop={this.handleActiveLanguageDrop}
                                  activeFeat={this.state.activeFeat}
                                  onActiveFeatSet={this.handleActiveFeatSet}
                                  onActiveFeatDrop={this.handleActiveFeatDrop}
                                  permitted={this.state.data.permitted} />
                    </div>
                    <div style={{display: this._byDefault()}}>
                        <ItemListSorted htmlClass="corp-tree-sorted"
                                  corplist={this.state.sortedData}
                                  activeLanguage={this.state.activeLanguage}
                                  onActiveLanguageSet={this.handleActiveLanguageSet}
                                  onActiveLanguageDrop={this.handleActiveLanguageDrop}
                                  activeFeat={this.state.activeFeat}
                                  onActiveFeatSet={this.handleActiveFeatSet}
                                  onActiveFeatDrop={this.handleActiveFeatDrop}
                                  permitted={this.state.data.permitted} />
                    </div>
                </div>
            );
        }
    }

    const FilterForm:React.SFC<{}> = (props) => {
        return <div />;
    }

    return {
        CorptreePageComponent: CorptreePageComponent,
        FilterForm: FilterForm
    };
}