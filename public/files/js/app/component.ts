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


import { Kontext } from '../types/common';
import { CoreViews } from '../types/coreViews';
import { PageModel } from './page';

/**
 * ComponentTools provide a set of runtime functions
 * used by React components (e.g. for message translation,
 * generating URLs, accessing shared components).
 */
export class ComponentTools {

    private pageModel:PageModel;

    public browserInfo:Kontext.IBrowserInfo;

    constructor(pageModel:PageModel) {
        this.pageModel = pageModel;
        this.browserInfo = {
            isFirefox: () => {
                return window.navigator.userAgent.indexOf('Firefox') > -1
                        && window.navigator.userAgent.indexOf('Seamonkey') === -1;
            }
        }
    }

    translate(s:string, values?:any):string {
        return this.pageModel.translate(s, values);
    }

    createActionLink<T>(path:string, args?:Array<[string, T]>|Kontext.IMultiDict<T>):string{
        return this.pageModel.createActionUrl(path, args);
    }

    createStaticUrl(path:string):string {
        return this.pageModel.createStaticUrl(path);
    }

    formatNumber(value:number, fractionDigits:number=2):string {
        return this.pageModel.formatNumber(value, fractionDigits);
    }

    formatDate(d:Date, timeFormat:number=0):string {
        return this.pageModel.formatDate(d, timeFormat);
    }

    getLayoutViews():CoreViews.Runtime {
        return this.pageModel.layoutViews;
    }

    addGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
        this.pageModel.addGlobalKeyEventHandler(fn);
    }

    removeGlobalKeyEventHandler(fn:(evt:Event)=>void):void {
        this.pageModel.removeGlobalKeyEventHandler(fn);
    }

    cloneState<T extends {[key:string]:any}>(obj:T):T {
        if (Object.assign) {
            return <T>Object.assign({}, obj);

        } else {
            const ans:{[key:string]:any} = {};
            for (let p in obj) {
                if (obj.hasOwnProperty(p)) {
                    ans[p] = obj[p];
                }
            }
            return <T>ans;
        }
    }

    getHelpLink(ident:string) {
        return this.pageModel.getHelpLink(ident);
    }

    getElmPosition(elm:HTMLElement):[number, number] {
        let x = 0;
        let y = 0;
        let srchElm = elm;
        while (srchElm) {
            if (srchElm.tagName === 'BODY') {
                const xScroll = srchElm.scrollLeft || document.documentElement.scrollLeft;
                const yScroll = srchElm.scrollTop || document.documentElement.scrollTop;
                x += (srchElm.offsetLeft - xScroll + srchElm.clientLeft);
                y += (srchElm.offsetTop - yScroll + srchElm.clientTop);

            } else {
                x += (srchElm.offsetLeft - srchElm.scrollLeft + srchElm.clientLeft);
                y += (srchElm.offsetTop - srchElm.scrollTop + srchElm.clientTop);
            }
            srchElm = srchElm.offsetParent as HTMLElement;
        }
        return [x, y];
    }
}