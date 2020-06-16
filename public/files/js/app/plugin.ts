/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IPluginApi } from '../types/plugins';
import { Kontext } from '../types/common';
import { MultiDict } from '../multidict';
import { CommonViews } from '../views/common';
import { CoreViews } from '../types/coreViews';
import { Observable } from 'rxjs';
import { PageModel } from './page';


export enum PluginName {
    AUTH = 'auth',
    SETTINGS_STORAGE = 'settings_storage',
    TAGHELPER = 'taghelper',
    TOKEN_CONNECT = 'token_connect',
    APP_BAR = 'app_bar',
    FOOTER_BAR = 'footer_bar',
    CORPARCH = 'corparch',
    LIVE_ATTRIBUTES = 'live_attributes',
    SUBCMIXER = 'subcmixer',
    SYNTAX_VIEWER = 'syntax_viewer'
}

 /**
 * PluginApi exports some essential functions from PageModel
 * to plug-ins while preventing them from accessing whole
 * PageModel. This is expected to be used by plug-ins'
 * models. For React component helpers see 'ComponentTools'
 */
export class PluginApi implements IPluginApi {

    pageModel:PageModel;

    constructor(pageModel:PageModel) {
        this.pageModel = pageModel;
    }

    getConf<T>(key:string):T {
        return this.pageModel.getConf<T>(key);
    }

    getNestedConf<T>(...keys:Array<string>):T {
        return this.pageModel.getNestedConf<T>(...keys);
    }

    addConfChangeHandler<T>(key:string, handler:(v:T)=>void):void {
        this.pageModel.addConfChangeHandler(key, handler);
    }

    createStaticUrl(path) {
        return this.pageModel.createStaticUrl(path);
    }

    createActionUrl(path:string, args?:Array<[string,string]>|Kontext.IMultiDict) {
        return this.pageModel.createActionUrl(path, args);
    }

    ajax$<T>(method:string, url:string, args:any, options:Kontext.AjaxOptions):Observable<T> {
        return this.pageModel.ajax$.call(this.pageModel, method, url, args, options);
    }

    showMessage(type, message) {
        return this.pageModel.showMessage(type, message);
    }

    translate(msg:string, values?:any) {
        return this.pageModel.translate(msg, values);
    }

    formatNumber(v, fractionDigits:number=2) {
        return this.pageModel.formatNumber(v, fractionDigits);
    }

    formatDate(d:Date, timeFormat:number=0):string {
        return this.pageModel.formatDate(d, timeFormat);
    }

    userIsAnonymous():boolean {
        return this.getConf<boolean>('anonymousUser');
    }

    dispatcher() {
        return this.pageModel.dispatcher;
    }

    getComponentHelpers():Kontext.ComponentHelpers {
        return this.pageModel.getComponentHelpers();
    }

    renderReactComponent<T, U>(reactClass:React.ComponentClass<T>|React.SFC<T>,
            target:HTMLElement, props?:T):void {
        this.pageModel.renderReactComponent(reactClass, target, props);
    }

    unmountReactComponent(element:HTMLElement):boolean {
        return this.pageModel.unmountReactComponent(element);
    }

    getModels():Kontext.LayoutModel {
        return this.pageModel.getModels();
    }

    getViews():CoreViews.Runtime {
        return this.pageModel.layoutViews;
    }

    getCommonViews():CommonViews {
        return this.pageModel.commonViews;
    }

    pluginIsActive(name:string):boolean {
        return this.pageModel.pluginIsActive(name);
    }

    getConcArgs():MultiDict {
        return this.pageModel.getConcArgs();
    }

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.pageModel.getCorpusIdent();
    }

    registerSwitchCorpAwareObject(obj:Kontext.ICorpusSwitchAwareModel<any>):void {
        return this.pageModel.registerSwitchCorpAwareObject(obj);
    }

    resetMenuActiveItemAndNotify():void {
        this.pageModel.resetMenuActiveItemAndNotify();
    }

    getHelpLink(ident:string):string {
        return this.getHelpLink(ident);
    }

    setLocationPost(path:string, args:Array<[string,string]>, blankWindow:boolean=false):void {
        this.pageModel.setLocationPost(path, args, blankWindow);
    }
}
