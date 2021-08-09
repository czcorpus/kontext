/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import { UserMessageTypes } from '../kontext';
import { AutoWidth } from './common';


export interface Props {

    /**
     * a custom action to be performed once the component is mounted
     */
    onReady?:(elm:HTMLElement)=>void;

    /**
     * a custom action to be performed when user clicks 'close'
     */
    onCloseClick:()=>void;

    /**
     * An optional handler triggered in case user clicks anywhere
     * within PopupBox. This can be used e.g. to regain focus.
     */
    onAreaClick?:()=>void;

    status?:UserMessageTypes;

    /**
     * an optional inline CSS
     */
    customStyle?:React.CSSProperties;

    /**
     * if true then the "close" button will take the focus
     * allowing instant closing by ESC or handling keys
     * by a custom handler (see the next prop)
     */
    takeFocus?:boolean;

    /**
     * an optional function called in case of a 'onKeyDown' event
     */
    keyPressHandler?:(evt:React.SyntheticEvent<{}>)=>void;

    customClass?:string;

    autoWidth?:AutoWidth;

    children:React.ReactNode;
}

export interface State {}

export type Component = React.ComponentClass<Props>;
