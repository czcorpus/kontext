/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/**
 * This is just a simplified type specification covering only
 * functions used by KonText.
 */
declare module React {

    export function createClass<T, U>(src:{[attr:string]:any}):React.Component<T, U>;

    export interface ReactElement {
    }

    interface ComponentClass<T = {}, U = {}> {
        new(props:T, context?:any):Component<T, U>;
    }

    class Component<T, U> {

        constructor(props:T, context?:any);

        props:T;

        state:U;

        render():ReactElement;

        componentWillMount();

        componentDidMount();

        componentWillReceiveProps(nextProps:T);

        shouldComponentUpdate(nextProps:T, nextState:U);

        componentWillUpdate(nextProps:T, nextState:U);

        componentDidUpdate(prevProps:T, prevState:U);

        componentWillUnmount(updater, [callback]);

        setState(newState:U, callback?:() => any);
        setState(updater:(prevState:U, props:T) => T, callback?:() => any);

        forceUpdate(callback?:() => any);
    }

    export interface FuncComponent<T> {
        (Props:T, context?:any):ReactElement;
    }

    export interface SyntheticEvent {
        bubbles:boolean;
        cancelable:boolean;
        currentTarget:EventTarget;
        defaultPrevented:boolean;
        eventPhase:number;
        isTrusted:boolean;
        nativeEvent:Event;
        target:EventTarget;
        type:string;
        timeStamp:Date;

        preventDefault():void;
        stopPropagation():void;
    }

    export interface KeyboardEvent extends SyntheticEvent {
        altKey:boolean;
        charCode:number;
        ctrlKey:boolean;
        getModifierState(key):boolean;
        key:string;
        keyCode:number;
        locale:string;
        location:number;
        metaKey:boolean;
        repeat:boolean;
        shiftKey:boolean;
        which:number;
    }

    export function createElement<T, U>(elmType:React.ComponentClass<T, U>|React.FuncComponent<T>, props:T,
                                  ...children:any[]):ReactElement;
}

declare module ReactDOM {

    export function render(element:React.ReactElement, container:HTMLElement, callback?:()=>void);

    export function unmountComponentAtNode(element:HTMLElement):boolean;

    export function findDOMNode(component:React.ReactElement):HTMLElement;
}

declare module "vendor/react" {
    export = React;
}

declare module "vendor/react-dom" {
    export = ReactDOM;
}
