/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Observable } from 'rxjs';
import { ITranslator, IFullActionControl } from 'kombo';

import * as Kontext from '../kontext';
import * as CoreViews from '../coreViews';
import { ConcServerArgs } from '../../models/concordance/common';



export interface BasePlugin {
    isActive():boolean;
}


/**
 * An interface used by KonText plug-ins to access
 * core functionality (for core components, this is
 * typically provided by PageModel).
 */
 export interface IPluginApi extends ITranslator {
    getConf<T>(key:string):T;
    getNestedConf<T>(...keys:Array<string>):T;
    createStaticUrl(path:string):string;
    createActionUrl<T>(
        path:string, args?:Array<[keyof T, T[keyof T]]>|Kontext.IMultiDict<T>):string;
    ajax$<T>(method:string, url:string, args:any, options?:Kontext.AjaxOptions):Observable<T>;
    showMessage(type:string, message:any, onClose?:()=>void);
    userIsAnonymous():boolean;
    dispatcher():IFullActionControl;
    getComponentHelpers():Kontext.ComponentHelpers;
    renderReactComponent<T, U>(reactClass:React.ComponentClass<T>|React.FC<T>,
                            target:HTMLElement, props?:T):void;
    unmountReactComponent(element:HTMLElement):boolean;
    getModels():Kontext.LayoutModel;
    getViews():CoreViews.Runtime;
    pluginTypeIsActive(name:string):boolean;
    getConcArgs():ConcServerArgs;
    exportConcArgs():Kontext.IMultiDict<ConcServerArgs>;
    getCorpusIdent():Kontext.FullCorpusIdent;
    resetMenuActiveItemAndNotify():void;
    getHelpLink(ident:string):string;
    setLocationPost(path:string, args:Array<[string,string]>, blankWindow?:boolean):void;
}