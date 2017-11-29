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

    export type Props = {[name:string]:any};

    export function createClass(src:{[attr:string]:any}):React.Component;

    export interface ReactElement {
    }

    class Component {

        constructor(props:{[key:string]:any});

        props:Props;

        state:Props;

        render():ReactElement;

        componentWillMount();

        componentDidMount();

        componentWillReceiveProps(nextProps:Props);

        shouldComponentUpdate(nextProps:Props, nextState:Props);

        componentWillUpdate(nextProps:Props, nextState:Props);

        componentDidUpdate(prevProps:Props, prevState:Props);

        componentWillUnmount(updater, [callback]);

        setState(newState:Props, callback?:() => any);
        setState(updater:(prevState:Props, props:Props) => Props, callback?:() => any);

        forceUpdate(callback?:() => any);
    }

    export type FuncComponent = (Props)=>ReactElement;

    export function createElement(elmType:typeof React.Component|React.FuncComponent, props:Props,
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
