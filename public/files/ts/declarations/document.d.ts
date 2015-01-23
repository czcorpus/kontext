/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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

/// <reference path="jquery.d.ts" />
/// <reference path="popupbox.d.ts" />
/// <reference path="dynamic.d.ts" />

declare module "tpl/document" {

    import popupBox = require("popupbox");


    /**
     * User message types
     */
    export enum MsgType {info, error, warning, plain }


    /**
     *
     */
    interface Promises {

        add(name:string, value:JQueryDeferred<any>);

        add(obj:{[name:string]: JQueryDeferred<any>});

        contains(key:string):boolean;

        get(key:string):JQueryDeferred<any>;

        doAfter(promiseId:string, fn:() => any);
    }


    /**
     *
     */
    export interface PluginApi {
        conf(key:string):any;
        ajax(...args:any[]);
        ajaxAnim(): JQuery;
        ajaxAnimSmall();
        appendLoader();
        showMessage(type:any, message:string); // TODO type: MsgType vs string
        translate(text:string):string;
        applySelectAll(elm:HTMLElement, context:HTMLElement);
        registerReset(fn:Function);
        resetToHomepage(params:any); // TODO
        userIsAnonymous():boolean;
        contextHelp(triggerElm:HTMLElement, text:string);
    }

    /**
     * This contains extensions required by pages which contain query input form
     */
    export interface QueryPagePluginApi extends PluginApi {
        bindFieldsetToggleEvent(callback:(fieldset:HTMLElement) => void);
    }

    /**
     *
     */
    export interface Plugin {
        init(api:PluginApi):void;
    }

    /**
     *
     */
    export interface CorpusInfoBox {

        appendAttribList(attribListData:{name:string; size:number; error?:string}[], jqAttribList:JQuery);

        appendStructList(structListData:Array<number>, jqStructList:JQuery);

        createCorpusInfoBox(tooltipBox:popupBox.TooltipBox, doneCallback:() => any);
    }

    /**
     *
     */
    interface MainMenu {

        init():void;

        getActiveSubmenuId():string;

        setActiveSubmenuId(id:string):void;

        closeSubmenu(id:string):void;

        getHiddenSubmenu(li:HTMLElement):JQuery;

        openSubmenu(activeLi:HTMLElement):void;

    }


    /**
     *
     */
    export interface LayoutModel {

        corpusInfoBox:CorpusInfoBox;

        mainMenu:MainMenu;

        init(conf:Runtime.Conf):Promises;

        registerPlugin(name:string, plugin:Plugin);

        getPlugin(name:string, plugin:Plugin);

        callPlugin(name:string, fnName:string, ...args:any[]);

        registerInitCallback(fn:()=>void);

        registerInitCallback(fn:{object:string; plugin:string; method:string; args?:any[]});

        escapeHTML(html:string):string;

        unpackError(obj):{message:string; error:Error; reset:boolean};

        appendLoader(elm:HTMLElement, options:{domId?:string; htmlClass?:string});

        appendLoader(elm:JQuery, options:{domId?:string; htmlClass?:string});

        appendLoader(elm:string, options:{domId?:string; htmlClass?:string});

        ajax(url:string, options:any):void; // TODO

        selectText(elm:HTMLElement):void;

        selectText(elm:JQuery):void;

        selectText(elm:string):void;

        showMessage(type:MsgType, message:string);

        contextHelp(triggerElm:HTMLElement, text:string);

        formChangeCorpus(event:Event);

        setAlignedCorporaFieldsDisabledState(state:boolean);

        formatNum(num:number, groupSepar:string, radixSepar:string);

        misc():void; // TODO this is a mess function

        renderOverview(data:{Desc:Array<{op:any; arg:any; size:number; tourl?:string}>}, tooltipBox:popupBox.TooltipBox);

        queryOverview():void;

        applySelectAll(actionElm:HTMLElement, context:HTMLElement);

        bindCorpusDescAction():JQueryDeferred<any>; // TODO should be private

        bindStaticElements():void; // TODO should be private

        timeoutMessages():void; // TODO should be private

        mouseOverImages():void; // TODO should be private

        enhanceMessages():void; // TODO should be private

        externalHelpLinks():void; // TODO should be private

        reload():void;

        createAjaxLoader():JQuery;

        createSmallAjaxLoader():JQuery;

        resetPlugins():void;

        translate(msg:string):string;

        pluginApi():Plugin;
    }

    /**
     *
     */
    export interface Closeable {
        close(): void;
    }
}




